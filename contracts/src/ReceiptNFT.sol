// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Owned.sol";

contract ReceiptNFT is Owned {
    string public name = "THANK Support Receipt";
    string public symbol = "THANKR";
    address public minter;
    uint256 public totalSupply;

    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => string) public tokenURI;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MinterUpdated(address indexed minter);

    error NotMinter();
    error NonTransferable();
    error TokenNotFound();

    constructor(address initialOwner) Owned(initialOwner) {}

    function setMinter(address nextMinter) external onlyOwner {
        if (nextMinter == address(0)) {
            revert ZeroAddress();
        }
        minter = nextMinter;
        emit MinterUpdated(nextMinter);
    }

    function mint(address recipient, string calldata uri) external returns (uint256 tokenId) {
        if (msg.sender != minter && msg.sender != owner) {
            revert NotMinter();
        }
        if (recipient == address(0)) {
            revert ZeroAddress();
        }

        tokenId = ++totalSupply;
        ownerOf[tokenId] = recipient;
        tokenURI[tokenId] = uri;
        balanceOf[recipient] += 1;
        emit Transfer(address(0), recipient, tokenId);
    }

    function approve(address, uint256) external pure {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) external pure {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert NonTransferable();
    }
}
