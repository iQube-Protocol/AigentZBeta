// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ContentQubeEditions
 * @notice ERC-1155 editions contract for the iQube Protocol's ContentQube
 *         canonical-mintable edition layer. Each token id corresponds to a
 *         single canonical edition of a rare/epic/legendary ContentQube
 *         (commons are NOT minted here — they use remote-custody streaming).
 *
 * @dev The minting service is `services/chain/baseTokenMint.ts`, which
 *      derives the token id deterministically as
 *      `SHA-256("edition:<contentQubeId>:<editionNumber>")` and calls
 *      `mint(to, id, amount, data)`. The owner of this contract IS the
 *      minter (same wallet that deployed it). A future upgrade can split
 *      ownership and minter authority by introducing AccessControl with
 *      a MINTER_ROLE — out of scope for v0.1.
 *
 *      URI strategy:
 *      - Per-token URIs are stored in `_tokenURIs[id]` and returned by
 *        `uri(id)` when present.
 *      - Falls back to the ERC1155 base URI (set via constructor; can be
 *        updated by the owner via `setBaseURI()`) when no per-token URI
 *        is registered. The base URI follows the EIP-1155 `{id}`
 *        substitution convention.
 */
contract ContentQubeEditions is ERC1155, Ownable, Pausable, ReentrancyGuard {

    // Per-token URI overrides (most editions will have one of these
    // pointing at the metaQube location — IPFS / Autonomys CID).
    mapping(uint256 => string) private _tokenURIs;

    // Track which token ids have been minted to prevent re-mints of the
    // same deterministic id. ERC-1155 itself allows the same id to be
    // minted multiple times (additive supply); we lock to single-mint
    // semantics because each token id corresponds to one specific
    // edition row in `content_qube_editions`.
    mapping(uint256 => bool) private _minted;

    event TokenURISet(uint256 indexed id, string uri);
    event BaseURISet(string baseUri);

    /**
     * @param initialOwner The address that owns the contract AND holds
     *                     the only mint authority. Typically the
     *                     AigentZ EOA used for deployment.
     */
    constructor(address initialOwner)
        ERC1155("")
        Ownable(initialOwner)
    {}

    // ─── Minting ────────────────────────────────────────────────────────

    /**
     * Mint a single canonical edition to the holder. Reverts if the id
     * has already been minted (single-mint semantics — see contract
     * NatSpec for rationale).
     *
     * @param to       Holder address (typically the buyer's wallet).
     * @param id       Deterministic token id derived off-chain.
     * @param amount   Always 1 in current usage; left as a parameter for
     *                 ABI compatibility with the OpenZeppelin mint shape
     *                 the off-chain service uses.
     * @param data     Optional payload (e.g. metadata pointer); usually
     *                 empty bytes.
     */
    function mint(address to, uint256 id, uint256 amount, bytes memory data)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        require(!_minted[id], "ContentQubeEditions: id already minted");
        _minted[id] = true;
        _mint(to, id, amount, data);
    }

    /**
     * Batch variant of `mint()`. Same single-mint semantics per id.
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        for (uint256 i = 0; i < ids.length; i++) {
            require(!_minted[ids[i]], "ContentQubeEditions: id already minted");
            _minted[ids[i]] = true;
        }
        _mintBatch(to, ids, amounts, data);
    }

    /**
     * Check whether a token id has been minted. Useful for the off-chain
     * service to avoid re-submitting a duplicate mint tx.
     */
    function isMinted(uint256 id) external view returns (bool) {
        return _minted[id];
    }

    // ─── URI management ─────────────────────────────────────────────────

    /**
     * Returns the URI for a specific token id. Prefers the per-token
     * override; falls back to the ERC1155 base URI (with `{id}`
     * substitution per EIP-1155).
     */
    function uri(uint256 id) public view override returns (string memory) {
        string memory tokenUri = _tokenURIs[id];
        if (bytes(tokenUri).length > 0) {
            return tokenUri;
        }
        return super.uri(id);
    }

    /**
     * Set a per-token URI override. Owner-only. Idempotent — overwrites
     * any existing override for the same id.
     */
    function setTokenURI(uint256 id, string memory tokenUri) external onlyOwner {
        _tokenURIs[id] = tokenUri;
        emit TokenURISet(id, tokenUri);
    }

    /**
     * Replace the contract-wide base URI. Useful if the off-chain
     * metadata host changes. Per-token overrides continue to take
     * precedence over the base.
     */
    function setBaseURI(string memory newBaseUri) external onlyOwner {
        _setURI(newBaseUri);
        emit BaseURISet(newBaseUri);
    }

    // ─── Lifecycle controls ────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
