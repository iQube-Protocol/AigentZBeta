/**
 * Token Pricing Service
 * 
 * Handles pricing conversions between KNYT, Q¢ (Q-Cent), and USDC
 * Provides real-time pricing and conversion rates
 * 
 * EXACT RATES FROM NETLIFY APP:
 * - 1 KNYT = 0.0005 ETH (fixed)
 * - KNYT USD price = ETH_Price × 0.0005 (dynamic from CoinGecko)
 * - Q¢ = USD (1:1 parity)
 * - KNYT payments get 20% discount
 * - USDC payments have 4% total fee (1% fee + 3% premium)
 * - PayPal payments have 10% total fee (3% fee + 7% premium)
 */

export interface TokenPrice {
  knyt: number;
  qcent: number;
  usdc: number;
}

export interface PricingConfig {
  knytToEth: number;         // 1 KNYT = 0.0005 ETH (fixed)
  ethPriceUsd: number;       // Current ETH price in USD (from CoinGecko)
  knytPriceUsd: number;      // KNYT price in USD (ethPriceUsd × 0.0005)
  knytDiscountPercent: number; // 20% discount for KNYT payments
  usdcFeePercent: number;     // 1% fee for USDC
  usdcPremiumPercent: number;  // 3% premium for USDC
  paypalFeePercent: number;    // 3% fee for PayPal
  paypalPremiumPercent: number; // 7% premium for PayPal
}

export class TokenPricingService {
  private static instance: TokenPricingService;
  private pricingConfig: PricingConfig;
  private lastUpdated: Date;
  
  private constructor() {
    // Initial pricing configuration
    this.pricingConfig = {
      knytToEth: 0.0005,        // Fixed: 1 KNYT = 0.0005 ETH
      ethPriceUsd: 3500,        // Default ETH price (will be updated from API)
      knytPriceUsd: 1.75,       // Default KNYT price (3500 × 0.0005)
      knytDiscountPercent: 0.20, // 20% discount for KNYT payments
      usdcFeePercent: 0.01,       // 1% fee for USDC
      usdcPremiumPercent: 0.03,    // 3% premium for USDC (4% total)
      paypalFeePercent: 0.03,     // 3% fee for PayPal
      paypalPremiumPercent: 0.07, // 7% premium for PayPal (10% total)
    };
    this.lastUpdated = new Date();
  }

  static getInstance(): TokenPricingService {
    if (!TokenPricingService.instance) {
      TokenPricingService.instance = new TokenPricingService();
    }
    return TokenPricingService.instance;
  }

  /**
   * Fetch real-time ETH price from CoinGecko API
   */
  async updateEthPrice(): Promise<void> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      
      if (data?.ethereum?.usd) {
        const newEthPrice = data.ethereum.usd;
        this.pricingConfig.ethPriceUsd = newEthPrice;
        this.pricingConfig.knytPriceUsd = newEthPrice * this.pricingConfig.knytToEth;
        this.lastUpdated = new Date();
        
        console.log(`[TokenPricingService] Updated ETH price: $${newEthPrice}, KNYT price: $${this.pricingConfig.knytPriceUsd}`);
      }
    } catch (error) {
      console.error('[TokenPricingService] Failed to update ETH price:', error);
    }
  }

  /**
   * Convert KNYT to other tokens using market pricing
   */
  convertFromKnyt(knytAmount: number): TokenPrice {
    const knytPriceUsd = this.pricingConfig.knytPriceUsd;
    
    return {
      knyt: knytAmount,
      qcent: knytAmount * knytPriceUsd,        // Q¢ = USD at par
      usdc: knytAmount * knytPriceUsd,        // USDC = USD at par (before fees)
    };
  }

  /**
   * Convert Q¢ to other tokens
   */
  convertFromQcent(qcentAmount: number): TokenPrice {
    const knytPriceUsd = this.pricingConfig.knytPriceUsd;
    
    return {
      knyt: qcentAmount / knytPriceUsd,
      qcent: qcentAmount,
      usdc: qcentAmount,                     // Q¢ = USDC = USD at par
    };
  }

  /**
   * Convert USDC to other tokens
   */
  convertFromUsdc(usdcAmount: number): TokenPrice {
    const knytPriceUsd = this.pricingConfig.knytPriceUsd;
    
    return {
      knyt: usdcAmount / knytPriceUsd,
      qcent: usdcAmount,                     // USDC = Q¢ = USD at par
      usdc: usdcAmount,
    };
  }

  /**
   * Calculate pricing for different payment rails
   */
  calculatePaymentPricing(baseKnyt: number): {
    knyt: { amount: number; discount: number };
    qcent: { amount: number };
    usdc: { amount: number; fee: number; premium: number };
    paypal: { amount: number; fee: number; premium: number };
  } {
    const knytPriceUsd = this.pricingConfig.knytPriceUsd;
    const usdBase = baseKnyt * knytPriceUsd;
    
    return {
      knyt: {
        amount: baseKnyt * (1 - this.pricingConfig.knytDiscountPercent),
        discount: this.pricingConfig.knytDiscountPercent,
      },
      qcent: {
        amount: usdBase, // Q¢ = USD at par
      },
      usdc: {
        amount: usdBase * (1 + this.pricingConfig.usdcFeePercent + this.pricingConfig.usdcPremiumPercent),
        fee: this.pricingConfig.usdcFeePercent,
        premium: this.pricingConfig.usdcPremiumPercent,
      },
      paypal: {
        amount: usdBase * (1 + this.pricingConfig.paypalFeePercent + this.pricingConfig.paypalPremiumPercent),
        fee: this.pricingConfig.paypalFeePercent,
        premium: this.pricingConfig.paypalPremiumPercent,
      },
    };
  }

  /**
   * Format price display with multiple tokens
   */
  formatPriceDisplay(price: TokenPrice): string {
    const parts = [];
    
    if (price.knyt > 0) {
      parts.push(`${price.knyt} KNYT`);
    }
    
    if (price.qcent > 0) {
      parts.push(`${price.qcent} Q¢`);
    }
    
    if (price.usdc > 0) {
      parts.push(`$${price.usdc.toFixed(2)} USDC`);
    }
    
    return parts.join(' / ');
  }

  /**
   * Get pricing for content type (using exact Netlify prices)
   */
  getContentPricing(contentType: string, isPreOrder: boolean = false): TokenPrice {
    const basePrices = {
      'scroll_still': 3,           // 3 KNYT for episode (still)
      'scroll_motion': 5,          // 5 KNYT for episode (motion)
      'character_card': 2,         // 2 KNYT for character card (still)
      'character_card_motion': 4,  // 4 KNYT for character card (motion)
      'bundle_3_still': 8,          // 8 KNYT for 3-episode bundle
      'bundle_5_still': 12,        // 12 KNYT for 5-episode bundle
      'bundle_3_motion': 12,       // 12 KNYT for 3-episode bundle (motion)
      'bundle_5_motion': 18,       // 18 KNYT for 5-episode bundle (motion)
      'season_codex_still': 25,     // 25 KNYT for season codex (still)
      'season_codex_motion': 40,    // 40 KNYT for season codex (motion)
    };

    // Pre-sale pricing for QriptoGraphic Novel variants (USD prices)
    const presalePrices = {
      'episode_-1_legendary': 2100,  // Episode -1 (#-4) Preorder Drop (Legendary)
      'episode_-1_epic': 186,        // Episode -1 (#-3) Preorder Drop (Epic)
      'episode_-1_rare': 86,         // Episode -1 (#-2) Preorder Drop (Rare)
      'episode_-1_common': 68,       // Episode -1 (#-1) Preorder Drop (Common)
    };

    // Default to episode pricing for backward compatibility
    let priceKey = contentType;
    if (contentType === 'episode') {
      priceKey = isPreOrder ? 'scroll_motion' : 'scroll_still';
    }

    // Check for pre-sale variant pricing
    if (presalePrices[contentType as keyof typeof presalePrices]) {
      const usdPrice = presalePrices[contentType as keyof typeof presalePrices];
      const knytAmount = usdPrice / this.pricingConfig.knytPriceUsd;
      return this.convertFromKnyt(knytAmount);
    }

    const knytPrice = basePrices[priceKey as keyof typeof basePrices] || 3;
    return this.convertFromKnyt(knytPrice);
  }

  /**
   * Get pre-sale pricing for QriptoGraphic Novel variants
   */
  getPresalePricing(): {
    legendary: TokenPrice;
    epic: TokenPrice;
    rare: TokenPrice;
    common: TokenPrice;
  } {
    const presaleUsdPrices = {
      legendary: 2100,  // Episode -1 (#-4) Preorder Drop (Legendary)
      epic: 186,        // Episode -1 (#-3) Preorder Drop (Epic)
      rare: 86,         // Episode -1 (#-2) Preorder Drop (Rare)
      common: 68,       // Episode -1 (#-1) Preorder Drop (Common)
    };

    const knytPriceUsd = this.pricingConfig.knytPriceUsd;

    return {
      legendary: this.convertFromKnyt(presaleUsdPrices.legendary / knytPriceUsd),
      epic: this.convertFromKnyt(presaleUsdPrices.epic / knytPriceUsd),
      rare: this.convertFromKnyt(presaleUsdPrices.rare / knytPriceUsd),
      common: this.convertFromKnyt(presaleUsdPrices.common / knytPriceUsd),
    };
  }

  /**
   * Format pre-sale price display with rarity
   */
  formatPresalePriceDisplay(rarity: 'legendary' | 'epic' | 'rare' | 'common'): string {
    const presalePricing = this.getPresalePricing();
    const price = presalePricing[rarity];
    const rarityLabels = {
      legendary: 'Legendary (#-4)',
      epic: 'Epic (#-3)',
      rare: 'Rare (#-2)',
      common: 'Common (#-1)',
    };

    return `${rarityLabels[rarity]}: ${this.formatPriceDisplay(price)}`;
  }

  /**
   * Get current pricing configuration
   */
  getPricingConfig(): PricingConfig {
    return { ...this.pricingConfig };
  }

  /**
   * Get ETH price in USD
   */
  getEthPriceUsd(): number {
    return this.pricingConfig.ethPriceUsd;
  }

  /**
   * Get KNYT price in USD (market-based)
   */
  getKnytPriceUsd(): number {
    return this.pricingConfig.knytPriceUsd;
  }

  /**
   * Get KNYT to ETH conversion rate
   */
  getKnytToEthRate(): number {
    return this.pricingConfig.knytToEth;
  }

  /**
   * Check if pricing is stale
   */
  isPricingStale(maxAgeMinutes: number = 60): boolean {
    const ageInMinutes = (Date.now() - this.lastUpdated.getTime()) / (1000 * 60);
    return ageInMinutes > maxAgeMinutes;
  }

  /**
   * Initialize pricing service with real-time data
   */
  async initialize(): Promise<void> {
    await this.updateEthPrice();
    
    // Update price every 5 minutes
    setInterval(() => {
      this.updateEthPrice();
    }, 5 * 60 * 1000);
  }
}

// Export singleton instance
export const tokenPricingService = TokenPricingService.getInstance();
