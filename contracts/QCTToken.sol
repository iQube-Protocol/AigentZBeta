// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title QCT Token
 * @dev Cross-chain QCT token with minting, burning, and bridge functionality
 */
contract QCTToken is ERC20, ERC20Burnable, Ownable, Pausable {
    
    // Maximum supply: 1 billion QCT tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    // Bridge contract address (can mint/burn for cross-chain operations)
    address public bridgeContract;
    
    // Events
    event BridgeContractUpdated(address indexed oldBridge, address indexed newBridge);
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds maximum");
        
        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
            emit TokensMinted(initialOwner, initialSupply, "Initial mint");
        }
    }
    
    /**
     * @dev Mint tokens - only owner or bridge contract
     */
    function mint(address to, uint256 amount) external onlyAuthorized whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed maximum supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, "Manual mint");
    }
    
    /**
     * @dev Mint tokens for bridge operations
     */
    function bridgeMint(address to, uint256 amount, string calldata bridgeId) external onlyBridge whenNotPaused {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed maximum supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount, string(abi.encodePacked("Bridge mint: ", bridgeId)));
    }
    
    /**
     * @dev Burn tokens for bridge operations
     */
    function bridgeBurn(address from, uint256 amount, string calldata bridgeId) external onlyBridge whenNotPaused {
        require(from != address(0), "Cannot burn from zero address");
        require(balanceOf(from) >= amount, "Insufficient balance to burn");
        
        _burn(from, amount);
        emit TokensBurned(from, amount, string(abi.encodePacked("Bridge burn: ", bridgeId)));
    }
    
    /**
     * @dev Set bridge contract address
     */
    function setBridgeContract(address newBridge) external onlyOwner {
        address oldBridge = bridgeContract;
        bridgeContract = newBridge;
        emit BridgeContractUpdated(oldBridge, newBridge);
    }
    
    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal of stuck tokens
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot withdraw QCT tokens");
        IERC20(token).transfer(to, amount);
    }
    
    // Modifiers
    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == bridgeContract, "Not authorized");
        _;
    }
    
    modifier onlyBridge() {
        require(msg.sender == bridgeContract, "Only bridge contract");
        _;
    }
    
    // Override required by Solidity for Pausable functionality
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
    
    /**
     * @dev Get contract info
     */
    function getInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        uint256 maxSupply_,
        address owner_,
        address bridge_,
        bool paused_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            owner(),
            bridgeContract,
            paused()
        );
    }
}
