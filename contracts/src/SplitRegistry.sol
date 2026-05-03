// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Owned.sol";

contract SplitRegistry is Owned {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_RECIPIENTS = 64;

    struct Split {
        address payable recipient;
        uint16 basisPoints;
    }

    mapping(bytes32 => Split[]) private projectSplits;
    mapping(bytes32 => address) public projectController;

    event ControllerSet(bytes32 indexed projectId, address indexed controller);
    event SplitsSet(bytes32 indexed projectId, uint256 recipientCount, uint256 totalBasisPoints);

    error NotController();
    error EmptySplits();
    error InvalidSplitTotal();
    error TooManyRecipients();
    error InvalidProjectId();
    error InvalidBasisPoints();
    error DuplicateRecipient();

    constructor(address initialOwner) Owned(initialOwner) {}

    function setController(bytes32 projectId, address controller) external onlyOwner {
        if (projectId == bytes32(0)) {
            revert InvalidProjectId();
        }
        if (controller == address(0)) {
            revert ZeroAddress();
        }
        projectController[projectId] = controller;
        emit ControllerSet(projectId, controller);
    }

    function setSplits(bytes32 projectId, Split[] calldata splits) external {
        if (projectId == bytes32(0)) {
            revert InvalidProjectId();
        }
        address controller = projectController[projectId];
        if (msg.sender != owner && msg.sender != controller) {
            revert NotController();
        }
        if (splits.length == 0) {
            revert EmptySplits();
        }
        if (splits.length > MAX_RECIPIENTS) {
            revert TooManyRecipients();
        }

        uint256 total;
        delete projectSplits[projectId];

        for (uint256 index = 0; index < splits.length; index++) {
            if (splits[index].recipient == address(0)) {
                revert ZeroAddress();
            }
            if (splits[index].basisPoints == 0) {
                revert InvalidBasisPoints();
            }
            for (uint256 duplicateIndex = 0; duplicateIndex < index; duplicateIndex++) {
                if (splits[duplicateIndex].recipient == splits[index].recipient) {
                    revert DuplicateRecipient();
                }
            }
            total += splits[index].basisPoints;
            projectSplits[projectId].push(splits[index]);
        }

        if (total != BPS_DENOMINATOR) {
            revert InvalidSplitTotal();
        }

        emit SplitsSet(projectId, splits.length, total);
    }

    function getSplits(bytes32 projectId) external view returns (Split[] memory) {
        return projectSplits[projectId];
    }
}
