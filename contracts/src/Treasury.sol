// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Owned.sol";

interface ITreasuryToken {
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract Treasury is Owned {
    event NativeReceived(address indexed sender, uint256 amount);
    event NativeWithdrawn(address indexed recipient, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    error TransferFailed();

    constructor(address initialOwner) Owned(initialOwner) {}

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    function withdrawNative(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }
        emit NativeWithdrawn(recipient, amount);
    }

    function withdrawToken(ITreasuryToken token, address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        bool success = token.transfer(recipient, amount);
        if (!success) {
            revert TransferFailed();
        }
        emit TokenWithdrawn(address(token), recipient, amount);
    }
}
