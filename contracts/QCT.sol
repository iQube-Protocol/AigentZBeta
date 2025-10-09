// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QriptoCENT (QCT)
 * @notice Cross-chain fungible token bridged across Bitcoin, EVM chains, and Solana
 * @dev ERC20 implementation with burn capability for bridge operations
 */
contract QriptoCENT is ERC20, ERC20Burnable, Ownable {
    
    // Bridge address that can mint tokens (for cross-chain transfers)
    address public bridge;
    
    // Total supply cap (1 billion QCT)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    // Events
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event TokensMinted(address indexed to, uint256 amount, string sourceChain, string sourceTxHash);
    event TokensBurned(address indexed from, uint256 amount, string targetChain, string targetAddress);
    
    /**
     * @notice Constructor - Deploy QCT token
     * @param initialOwner Address that will own the contract
     */
    constructor(address initialOwner) ERC20("QriptoCENT", "QCT") Ownable(initialOwner) {
        // Mint initial supply to owner (can be distributed to liquidity pools)
        _mint(initialOwner, 400_000_000 * 10**18); // 40% premine
    }
    
    /**
     * @notice Set the bridge contract address
     * @param _bridge Address of the bridge contract
     */
    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "QCT: Bridge cannot be zero address");
        address oldBridge = bridge;
        bridge = _bridge;
        emit BridgeUpdated(oldBridge, _bridge);
    }
    
    /**
     * @notice Mint tokens (only callable by bridge)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param sourceChain Chain where tokens were locked/burned
     * @param sourceTxHash Transaction hash on source chain
     */
    function bridgeMint(
        address to,
        uint256 amount,
        string memory sourceChain,
        string memory sourceTxHash
    ) external {
        require(msg.sender == bridge, "QCT: Only bridge can mint");
        require(to != address(0), "QCT: Mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "QCT: Max supply exceeded");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, sourceChain, sourceTxHash);
    }
    
    /**
     * @notice Burn tokens for cross-chain transfer
     * @param amount Amount of tokens to burn
     * @param targetChain Chain to transfer to
     * @param targetAddress Address on target chain
     */
    function bridgeBurn(
        uint256 amount,
        string memory targetChain,
        string memory targetAddress
    ) external {
        require(amount > 0, "QCT: Amount must be greater than 0");
        require(bytes(targetChain).length > 0, "QCT: Target chain required");
        require(bytes(targetAddress).length > 0, "QCT: Target address required");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, targetChain, targetAddress);
    }
    
    /**
     * @notice Get token information
     */
    function tokenInfo() external pure returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxSupply_
    ) {
        return ("QriptoCENT", "QCT", 18, MAX_SUPPLY);
    }
}
