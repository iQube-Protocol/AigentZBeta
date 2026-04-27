// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title iQubeNFT
 * @notice ERC721 token anchoring iQube identity on-chain.
 * @dev URI points to the metaQube location (IPFS / Autonomys CID or Supabase ref).
 *      _minterOf is stored separately from ERC721 ownership so the original creator
 *      can be looked up even after transfers — used by the off-chain key escrow to
 *      resolve which wrapped key belongs to which wallet.
 */
contract iQubeNFT is ERC721, Ownable, Pausable, ReentrancyGuard {

    uint256 private _tokenIdCounter;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => address) private _minterOf;

    event QubeAnchored(uint256 indexed tokenId, address indexed to, address indexed minter, string uri);
    event QubeTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor(address initialOwner)
        ERC721("iQubeNFT", "iQNFT")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mint a new iQube NFT.
     * @param to   Wallet receiving the token (the iQube owner).
     * @param uri  MetaQube location — IPFS CID, Autonomys CID, or `iq:<id>` ref.
     * @return tokenId The newly minted token ID.
     */
    function mintQube(address to, string memory uri)
        public
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(to != address(0), "iQubeNFT: mint to zero address");
        require(bytes(uri).length > 0, "iQubeNFT: empty URI");

        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        _minterOf[tokenId] = msg.sender;

        emit QubeAnchored(tokenId, to, msg.sender, uri);
        return tokenId;
    }

    /**
     * @notice Transfer a qube to a new owner.
     */
    function transferQube(address to, uint256 tokenId)
        public
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "iQubeNFT: transfer to zero address");
        safeTransferFrom(msg.sender, to, tokenId);
        emit QubeTransferred(tokenId, msg.sender, to);
    }

    /** @notice Returns the metaQube URI for a given token. */
    function getMetaQubeLocation(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "iQubeNFT: token does not exist");
        return _tokenURIs[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return getMetaQubeLocation(tokenId);
    }

    /** @notice Returns the wallet that originally minted this qube. */
    function minterOf(uint256 tokenId) public view returns (address) {
        require(_ownerOf(tokenId) != address(0), "iQubeNFT: token does not exist");
        return _minterOf[tokenId];
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function pause() public onlyOwner { _pause(); }
    function unpause() public onlyOwner { _unpause(); }
}
