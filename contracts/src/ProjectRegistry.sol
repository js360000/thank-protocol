// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Owned.sol";

contract ProjectRegistry is Owned {
    struct Project {
        string repo;
        string manifestUri;
        bytes32 manifestHash;
        address controller;
        uint8 verificationLevel;
        bool active;
    }

    mapping(bytes32 => Project) private projects;
    mapping(bytes32 => bytes32) public repoHashToProjectId;

    event ProjectRegistered(
        bytes32 indexed projectId,
        string repo,
        string manifestUri,
        bytes32 manifestHash,
        address indexed controller,
        uint8 verificationLevel
    );
    event ProjectVerificationUpdated(bytes32 indexed projectId, uint8 verificationLevel);
    event ProjectControllerUpdated(bytes32 indexed projectId, address indexed controller);
    event ProjectManifestUpdated(bytes32 indexed projectId, string manifestUri, bytes32 manifestHash);
    event ProjectDeactivated(bytes32 indexed projectId);

    error ProjectNotFound();
    error ProjectAlreadyRegistered();
    error RepoAlreadyRegistered();
    error NotProjectController();
    error InvalidVerificationLevel();
    error InvalidProjectId();
    error EmptyString();
    error EmptyManifestHash();

    constructor(address initialOwner) Owned(initialOwner) {}

    function registerProject(
        bytes32 projectId,
        string calldata repo,
        string calldata manifestUri,
        bytes32 manifestHash,
        address controller,
        uint8 verificationLevel
    ) external onlyOwner {
        if (projectId == bytes32(0)) {
            revert InvalidProjectId();
        }
        if (bytes(repo).length == 0 || bytes(manifestUri).length == 0) {
            revert EmptyString();
        }
        if (manifestHash == bytes32(0)) {
            revert EmptyManifestHash();
        }
        if (controller == address(0)) {
            revert ZeroAddress();
        }
        if (verificationLevel > 4) {
            revert InvalidVerificationLevel();
        }
        if (projects[projectId].active) {
            revert ProjectAlreadyRegistered();
        }

        bytes32 repoHash = keccak256(bytes(repo));
        if (repoHashToProjectId[repoHash] != bytes32(0)) {
            revert RepoAlreadyRegistered();
        }

        projects[projectId] = Project({
            repo: repo,
            manifestUri: manifestUri,
            manifestHash: manifestHash,
            controller: controller,
            verificationLevel: verificationLevel,
            active: true
        });
        repoHashToProjectId[repoHash] = projectId;

        emit ProjectRegistered(projectId, repo, manifestUri, manifestHash, controller, verificationLevel);
    }

    function updateManifest(bytes32 projectId, string calldata manifestUri, bytes32 manifestHash) external {
        Project storage project = projects[projectId];
        if (!project.active) {
            revert ProjectNotFound();
        }
        if (bytes(manifestUri).length == 0) {
            revert EmptyString();
        }
        if (manifestHash == bytes32(0)) {
            revert EmptyManifestHash();
        }
        if (msg.sender != project.controller && msg.sender != owner) {
            revert NotProjectController();
        }

        project.manifestUri = manifestUri;
        project.manifestHash = manifestHash;
        emit ProjectManifestUpdated(projectId, manifestUri, manifestHash);
    }

    function updateVerification(bytes32 projectId, uint8 verificationLevel) external onlyOwner {
        if (verificationLevel > 4) {
            revert InvalidVerificationLevel();
        }
        Project storage project = projects[projectId];
        if (!project.active) {
            revert ProjectNotFound();
        }
        project.verificationLevel = verificationLevel;
        emit ProjectVerificationUpdated(projectId, verificationLevel);
    }

    function updateController(bytes32 projectId, address controller) external onlyOwner {
        if (controller == address(0)) {
            revert ZeroAddress();
        }
        Project storage project = projects[projectId];
        if (!project.active) {
            revert ProjectNotFound();
        }
        project.controller = controller;
        emit ProjectControllerUpdated(projectId, controller);
    }

    function deactivateProject(bytes32 projectId) external onlyOwner {
        Project storage project = projects[projectId];
        if (!project.active) {
            revert ProjectNotFound();
        }
        project.active = false;
        delete repoHashToProjectId[keccak256(bytes(project.repo))];
        emit ProjectDeactivated(projectId);
    }

    function getProject(bytes32 projectId) external view returns (Project memory) {
        Project memory project = projects[projectId];
        if (!project.active) {
            revert ProjectNotFound();
        }
        return project;
    }
}
