// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface ISplitRegistry {
    struct Split {
        address payable recipient;
        uint16 basisPoints;
    }

    function getSplits(bytes32 projectId) external view returns (Split[] memory);
}

contract ThankRouter {
    uint256 public constant BPS_DENOMINATOR = 10_000;

    ISplitRegistry public immutable splitRegistry;

    mapping(address => uint256) public nativeCredits;
    mapping(address => mapping(address => uint256)) public tokenCredits;

    bool private locked;

    event NativeFundingQueued(
        bytes32 indexed projectId,
        address indexed donor,
        uint256 amount,
        string message,
        string receiptUri
    );
    event TokenFundingQueued(
        bytes32 indexed projectId,
        address indexed donor,
        address indexed token,
        uint256 requestedAmount,
        uint256 receivedAmount,
        string message,
        string receiptUri
    );
    event AllocationQueued(
        bytes32 indexed projectId,
        address indexed asset,
        address indexed recipient,
        uint256 amount,
        uint16 basisPoints
    );
    event NativeClaimed(address indexed recipient, uint256 amount);
    event TokenClaimed(address indexed token, address indexed recipient, uint256 amount);

    error NoSplits();
    error InvalidAmount();
    error InvalidRegistry();
    error InvalidToken();
    error NoCredit();
    error TransferFailed();
    error Reentrancy();

    constructor(ISplitRegistry registry) {
        if (address(registry) == address(0)) {
            revert InvalidRegistry();
        }
        splitRegistry = registry;
    }

    modifier nonReentrant() {
        if (locked) {
            revert Reentrancy();
        }
        locked = true;
        _;
        locked = false;
    }

    function fundNative(
        bytes32 projectId,
        string calldata message,
        string calldata receiptUri
    ) external payable nonReentrant {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        ISplitRegistry.Split[] memory splits = _loadSplits(projectId);
        _creditNative(projectId, splits, msg.value);

        emit NativeFundingQueued(projectId, msg.sender, msg.value, message, receiptUri);
    }

    function fundToken(
        bytes32 projectId,
        address token,
        uint256 amount,
        string calldata message,
        string calldata receiptUri
    ) external nonReentrant {
        if (token == address(0)) {
            revert InvalidToken();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        ISplitRegistry.Split[] memory splits = _loadSplits(projectId);
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) {
            revert InvalidAmount();
        }

        _creditToken(projectId, token, splits, received);

        emit TokenFundingQueued(projectId, msg.sender, token, amount, received, message, receiptUri);
    }

    function claimNative() external nonReentrant {
        _claimNative(payable(msg.sender));
    }

    function claimNativeFor(address payable recipient) external nonReentrant {
        _claimNative(recipient);
    }

    function claimToken(address token) external nonReentrant {
        _claimToken(token, msg.sender);
    }

    function claimTokenFor(address token, address recipient) external nonReentrant {
        _claimToken(token, recipient);
    }

    function _loadSplits(bytes32 projectId) internal view returns (ISplitRegistry.Split[] memory splits) {
        splits = splitRegistry.getSplits(projectId);
        if (splits.length == 0) {
            revert NoSplits();
        }
    }

    function _creditNative(
        bytes32 projectId,
        ISplitRegistry.Split[] memory splits,
        uint256 amount
    ) internal {
        uint256 remaining = amount;
        for (uint256 index = 0; index < splits.length; index++) {
            uint256 share = index == splits.length - 1
                ? remaining
                : (amount * splits[index].basisPoints) / BPS_DENOMINATOR;
            remaining -= share;
            nativeCredits[splits[index].recipient] += share;
            emit AllocationQueued(projectId, address(0), splits[index].recipient, share, splits[index].basisPoints);
        }
    }

    function _creditToken(
        bytes32 projectId,
        address token,
        ISplitRegistry.Split[] memory splits,
        uint256 amount
    ) internal {
        uint256 remaining = amount;
        for (uint256 index = 0; index < splits.length; index++) {
            uint256 share = index == splits.length - 1
                ? remaining
                : (amount * splits[index].basisPoints) / BPS_DENOMINATOR;
            remaining -= share;
            tokenCredits[token][splits[index].recipient] += share;
            emit AllocationQueued(projectId, token, splits[index].recipient, share, splits[index].basisPoints);
        }
    }

    function _claimNative(address payable recipient) internal {
        uint256 amount = nativeCredits[recipient];
        if (amount == 0) {
            revert NoCredit();
        }

        nativeCredits[recipient] = 0;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            nativeCredits[recipient] = amount;
            revert TransferFailed();
        }

        emit NativeClaimed(recipient, amount);
    }

    function _claimToken(address token, address recipient) internal {
        if (token == address(0)) {
            revert InvalidToken();
        }

        uint256 amount = tokenCredits[token][recipient];
        if (amount == 0) {
            revert NoCredit();
        }

        tokenCredits[token][recipient] = 0;
        _safeTransfer(token, recipient, amount);
        emit TokenClaimed(token, recipient, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
