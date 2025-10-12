// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC for testnet use only
 * @dev Simple ERC20 with public minting for testing
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals;
    
    constructor() ERC20("Mock USD Coin", "USDC") {
        _decimals = 6; // USDC uses 6 decimals
        
        // Mint initial supply for testing (1 million USDC)
        _mint(msg.sender, 1_000_000 * 10**6);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @notice Public mint function for testing
     * @dev Anyone can mint testnet USDC
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @notice Faucet function - mint 1000 USDC to caller
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**6); // 1000 USDC
    }
}
