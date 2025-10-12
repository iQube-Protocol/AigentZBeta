// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQCTToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

/**
 * @title QCTReserve
 * @notice Reserve contract for QCT micro-stablecoin (1 QCT = $0.01 USD)
 * @dev Manages minting and burning of QCT backed by USDC reserves
 * 
 * Key Features:
 * - Fixed ratio: 1 USDC = 100 QCT
 * - Configurable mint/burn fees (max 0.5%)
 * - Arbitrage fee discounts to maintain peg
 * - Emergency pause functionality
 * - Full reserve backing guarantee
 */
contract QCTReserve is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    IERC20 public immutable usdc;
    IQCTToken public immutable qct;
    
    uint256 public constant MINT_RATIO = 100; // 1 USDC = 100 QCT (immutable)
    uint256 public constant MAX_FEE = 50; // Max 0.5% (50 basis points)
    uint256 public constant FEE_DENOMINATOR = 10000; // For basis points
    
    uint256 public mintFee = 10; // 0.1% (10 basis points)
    uint256 public burnFee = 10; // 0.1% (10 basis points)
    uint256 public arbitrageFeeDiscount = 50; // 50% discount for arbitrage
    
    uint256 public totalUSDCDeposited;
    uint256 public totalUSDCWithdrawn;
    uint256 public totalQCTMinted;
    uint256 public totalQCTBurned;
    
    // ============ Events ============
    
    event Minted(
        address indexed user,
        uint256 usdcAmount,
        uint256 qctAmount,
        uint256 fee,
        bool isArbitrage
    );
    
    event Burned(
        address indexed user,
        uint256 qctAmount,
        uint256 usdcAmount,
        uint256 fee,
        bool isArbitrage
    );
    
    event FeesUpdated(uint256 newMintFee, uint256 newBurnFee);
    event ArbitrageFeeDiscountUpdated(uint256 newDiscount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    
    // ============ Constructor ============
    
    constructor(
        address _usdc,
        address _qct,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_qct != address(0), "Invalid QCT address");
        
        usdc = IERC20(_usdc);
        qct = IQCTToken(_qct);
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Mint QCT by depositing USDC
     * @param usdcAmount Amount of USDC to deposit (in USDC decimals, typically 6)
     * @return qctAmount Amount of QCT minted
     */
    function mint(uint256 usdcAmount) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 qctAmount) 
    {
        require(usdcAmount > 0, "Amount must be > 0");
        
        // Calculate fee (with potential arbitrage discount)
        uint256 fee = calculateMintFee(usdcAmount);
        uint256 netUSDC = usdcAmount - fee;
        
        // Calculate QCT amount (accounting for decimal differences)
        // USDC has 6 decimals, QCT has 18 decimals
        // 1 USDC (1e6) = 100 QCT (100e18)
        qctAmount = (netUSDC * MINT_RATIO * 1e18) / 1e6;
        
        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // Mint QCT to user
        qct.mint(msg.sender, qctAmount);
        
        // Update statistics
        totalUSDCDeposited += usdcAmount;
        totalQCTMinted += qctAmount;
        
        emit Minted(
            msg.sender,
            usdcAmount,
            qctAmount,
            fee,
            isArbitrageOpportunity()
        );
        
        return qctAmount;
    }
    
    /**
     * @notice Burn QCT to redeem USDC
     * @param qctAmount Amount of QCT to burn (in QCT decimals, 18)
     * @return usdcAmount Amount of USDC received
     */
    function burn(uint256 qctAmount) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 usdcAmount) 
    {
        require(qctAmount > 0, "Amount must be > 0");
        
        // Calculate USDC amount (accounting for decimal differences)
        // 100 QCT (100e18) = 1 USDC (1e6)
        uint256 grossUSDC = (qctAmount * 1e6) / (MINT_RATIO * 1e18);
        
        // Calculate fee (with potential arbitrage discount)
        uint256 fee = calculateBurnFee(grossUSDC);
        usdcAmount = grossUSDC - fee;
        
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient reserves");
        
        // Burn QCT from user
        qct.burnFrom(msg.sender, qctAmount);
        
        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, usdcAmount);
        
        // Update statistics
        totalUSDCWithdrawn += usdcAmount;
        totalQCTBurned += qctAmount;
        
        emit Burned(
            msg.sender,
            qctAmount,
            usdcAmount,
            fee,
            isArbitrageOpportunity()
        );
        
        return usdcAmount;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current reserve ratio (should always be >= 100%)
     * @return ratio Reserve ratio in basis points (10000 = 100%)
     */
    function getReserveRatio() external view returns (uint256 ratio) {
        uint256 totalSupply = qct.totalSupply();
        if (totalSupply == 0) return 10000; // 100% if no QCT minted
        
        uint256 reserves = usdc.balanceOf(address(this));
        uint256 requiredReserves = (totalSupply * 1e6) / (MINT_RATIO * 1e18);
        
        ratio = (reserves * 10000) / requiredReserves;
        return ratio;
    }
    
    /**
     * @notice Check if there's an arbitrage opportunity
     * @dev In production, this would check DEX prices
     * @return bool True if arbitrage opportunity exists
     */
    function isArbitrageOpportunity() public pure returns (bool) {
        // TODO: Implement actual DEX price checking
        // For now, always return false (no discount)
        return false;
    }
    
    /**
     * @notice Calculate mint fee for a given USDC amount
     */
    function calculateMintFee(uint256 usdcAmount) public view returns (uint256) {
        uint256 effectiveFee = isArbitrageOpportunity() 
            ? (mintFee * (100 - arbitrageFeeDiscount)) / 100
            : mintFee;
        return (usdcAmount * effectiveFee) / FEE_DENOMINATOR;
    }
    
    /**
     * @notice Calculate burn fee for a given USDC amount
     */
    function calculateBurnFee(uint256 usdcAmount) public view returns (uint256) {
        uint256 effectiveFee = isArbitrageOpportunity() 
            ? (burnFee * (100 - arbitrageFeeDiscount)) / 100
            : burnFee;
        return (usdcAmount * effectiveFee) / FEE_DENOMINATOR;
    }
    
    /**
     * @notice Get reserve statistics
     */
    function getReserveStats() external view returns (
        uint256 usdcReserves,
        uint256 qctSupply,
        uint256 reserveRatio,
        uint256 deposited,
        uint256 withdrawn,
        uint256 minted,
        uint256 burned
    ) {
        usdcReserves = usdc.balanceOf(address(this));
        qctSupply = qct.totalSupply();
        reserveRatio = this.getReserveRatio();
        deposited = totalUSDCDeposited;
        withdrawn = totalUSDCWithdrawn;
        minted = totalQCTMinted;
        burned = totalQCTBurned;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update mint and burn fees
     * @dev Only owner, max 0.5% each
     */
    function setFees(uint256 _mintFee, uint256 _burnFee) external onlyOwner {
        require(_mintFee <= MAX_FEE, "Mint fee too high");
        require(_burnFee <= MAX_FEE, "Burn fee too high");
        
        mintFee = _mintFee;
        burnFee = _burnFee;
        
        emit FeesUpdated(_mintFee, _burnFee);
    }
    
    /**
     * @notice Update arbitrage fee discount
     * @dev Only owner, max 100% discount
     */
    function setArbitrageFeeDiscount(uint256 _discount) external onlyOwner {
        require(_discount <= 100, "Discount too high");
        
        arbitrageFeeDiscount = _discount;
        
        emit ArbitrageFeeDiscountUpdated(_discount);
    }
    
    /**
     * @notice Pause minting and burning
     * @dev Emergency use only
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause minting and burning
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (use with extreme caution)
     * @dev Only for recovering stuck tokens or emergency situations
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(usdc), "Cannot withdraw USDC reserves");
        IERC20(token).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
}
