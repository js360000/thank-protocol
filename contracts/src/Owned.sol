// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Owned {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed nextOwner);

    error NotOwner();
    error ZeroAddress();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert ZeroAddress();
        }
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) {
            revert ZeroAddress();
        }
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }
}
