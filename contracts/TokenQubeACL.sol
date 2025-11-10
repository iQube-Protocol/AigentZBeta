// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TokenQubeACL {
    event CapabilityGranted(uint256 indexed tokenId, address indexed to, bytes32 scopeHash, uint64 ttl, bytes32 nonce);
    event OwnerTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    // tokenId => to => scopeHash => ttl
    mapping(uint256 => mapping(address => mapping(bytes32 => uint64))) public ttlByScope;
    // tokenId => owner (optional, for demo transferOwnerWithDID)
    mapping(uint256 => address) public ownerOf;

    function grantCapability(
        uint256 tokenId,
        address to,
        bytes32 scopeHash,
        uint64 ttl,
        bytes calldata /*limits*/,
        bytes calldata /*dvnAttestation*/,
        bytes calldata /*msgSig*/
    ) external {
        ttlByScope[tokenId][to][scopeHash] = ttl;
        // derive a pseudo-nonce from params (demo); production should pass in a real nonce
        bytes32 nonce = keccak256(abi.encode(tokenId, to, scopeHash, ttl, block.number));
        emit CapabilityGranted(tokenId, to, scopeHash, ttl, nonce);
    }

    function revokeCapability(uint256 tokenId, address to, bytes32 scopeHash) external {
        ttlByScope[tokenId][to][scopeHash] = 0;
        emit CapabilityGranted(tokenId, to, scopeHash, 0, bytes32(0));
    }

    function transferOwnerWithDID(
        uint256 tokenId,
        address to,
        bytes calldata /*dvnAttestation*/,
        bytes calldata /*msgSig*/
    ) external {
        address from = ownerOf[tokenId];
        ownerOf[tokenId] = to;
        emit OwnerTransferred(tokenId, from, to);
    }
}
