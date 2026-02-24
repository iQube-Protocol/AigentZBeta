/**
 * x402 Micropayment Template Generator
 * 
 * Dynamically generates x402 payment templates from SmartContentQube pricing models.
 * Supports:
 * - Pay-per-panel (comics, graphic novels)
 * - Pay-per-episode (series content)
 * - Pay-per-stream (video/audio)
 * - Pay-per-article (publications)
 * - Subscription bundles
 * - Series/collection bundles
 * 
 * Templates are generated on-demand and can be cached for performance.
 */

import type {
  SmartContentQube,
  PricingModel,
  PricingTier,
  PricingKind,
  PaymentCurrency,
} from '@/types/smartContent';

// =============================================================================
// x402 TEMPLATE TYPES
// =============================================================================

export interface X402PaymentTemplate {
  /** Unique template ID */
  id: string;
  
  /** Template version */
  version: number;
  
  /** Content ID this template is for */
  contentId: string;
  
  /** Content title */
  contentTitle: string;
  
  /** Pricing kind */
  pricingKind: PricingKind;
  
  /** Payment amount */
  amount: number;
  
  /** Payment currency */
  currency: PaymentCurrency;
  
  /** Recipient wallet address */
  recipientAddress: string;
  
  /** Platform fee percentage */
  platformFeePercentage: number;
  
  /** Creator royalty percentage */
  creatorRoyaltyPercentage: number;
  
  /** What this payment covers */
  covers: string[];
  
  /** Access duration in seconds (for rentals/subscriptions) */
  accessDurationSeconds?: number;
  
  /** Usage limit (for usage-limited access) */
  usageLimit?: number;
  
  /** Metadata for payment processing */
  metadata: {
    app: string;
    tenantId: string;
    creatorRootDid: string;
    contentSlug: string;
    structureKind?: string;
  };
  
  /** Payment instructions */
  paymentInstructions: X402PaymentInstructions;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Expires timestamp (templates can expire) */
  expiresAt?: string;
}

export interface X402PaymentInstructions {
  /** Supported chains for payment */
  supportedChains: X402ChainConfig[];
  
  /** Payment memo/reference */
  memo: string;
  
  /** Callback URL for payment confirmation */
  callbackUrl?: string;
  
  /** Webhook URL for payment events */
  webhookUrl?: string;
  
  /** QR code data (for mobile payments) */
  qrCodeData?: string;
}

export interface X402ChainConfig {
  /** Chain ID */
  chainId: number;
  
  /** Chain name */
  chainName: string;
  
  /** Token contract address */
  tokenAddress: string;
  
  /** Recipient address on this chain */
  recipientAddress: string;
  
  /** Gas estimate */
  estimatedGas?: number;
  
  /** Is this the preferred chain */
  preferred: boolean;
}

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

const CHAIN_CONFIGS: Record<PaymentCurrency, X402ChainConfig[]> = {
  QCT: [
    {
      chainId: 421614, // Arbitrum Sepolia
      chainName: 'Arbitrum Sepolia',
      tokenAddress: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      recipientAddress: '', // Set per template
      estimatedGas: 100000,
      preferred: true,
    },
    {
      chainId: 11155111, // Ethereum Sepolia
      chainName: 'Ethereum Sepolia',
      tokenAddress: process.env.NEXT_PUBLIC_QCT_SEPOLIA || '',
      recipientAddress: '',
      estimatedGas: 150000,
      preferred: false,
    },
  ],
  QOYN: [
    {
      chainId: 0, // Bitcoin (special handling)
      chainName: 'Bitcoin',
      tokenAddress: 'native',
      recipientAddress: '',
      preferred: true,
    },
  ],
  KNYT: [
    {
      chainId: 421614,
      chainName: 'Arbitrum Sepolia',
      tokenAddress: process.env.NEXT_PUBLIC_KNYT_ARB_SEPOLIA || '',
      recipientAddress: '',
      preferred: true,
    },
  ],
  USDC: [
    {
      chainId: 11155111,
      chainName: 'Ethereum Sepolia',
      tokenAddress: process.env.NEXT_PUBLIC_USDC_SEPOLIA || '',
      recipientAddress: '',
      estimatedGas: 100000,
      preferred: true,
    },
  ],
  ETH: [
    {
      chainId: 11155111,
      chainName: 'Ethereum Sepolia',
      tokenAddress: 'native',
      recipientAddress: '',
      estimatedGas: 21000,
      preferred: true,
    },
  ],
  BTC: [
    {
      chainId: 0,
      chainName: 'Bitcoin Testnet',
      tokenAddress: 'native',
      recipientAddress: '',
      preferred: true,
    },
  ],
  sats: [
    {
      chainId: 0,
      chainName: 'Bitcoin Testnet',
      tokenAddress: 'native',
      recipientAddress: '',
      preferred: true,
    },
  ],
};

// =============================================================================
// TEMPLATE GENERATOR
// =============================================================================

export class X402TemplateGenerator {
  private baseCallbackUrl: string;
  private baseWebhookUrl: string;
  private platformWalletAddress: string;
  
  constructor(config?: {
    callbackUrl?: string;
    webhookUrl?: string;
    platformWalletAddress?: string;
  }) {
    this.baseCallbackUrl = config?.callbackUrl || process.env.NEXT_PUBLIC_X402_CALLBACK_URL || '';
    this.baseWebhookUrl = config?.webhookUrl || process.env.X402_WEBHOOK_URL || '';
    this.platformWalletAddress = config?.platformWalletAddress || process.env.PLATFORM_WALLET_ADDRESS || '';
  }
  
  /**
   * Generate all payment templates for a SmartContentQube
   */
  generateTemplates(content: SmartContentQube): X402PaymentTemplate[] {
    const templates: X402PaymentTemplate[] = [];
    
    for (const tier of content.pricingModel.tiers) {
      const template = this.generateTemplate(content, tier);
      templates.push(template);
    }
    
    return templates;
  }
  
  /**
   * Generate a single payment template for a pricing tier
   */
  generateTemplate(content: SmartContentQube, tier: PricingTier): X402PaymentTemplate {
    const templateId = this.generateTemplateId(content.id, tier.kind);
    
    // Get chain configs for this currency
    const chainConfigs = this.getChainConfigs(
      tier.currency,
      content.pricingModel.creatorWalletAddress
    );
    
    // Calculate royalty percentage from reward outcomes
    const creatorRoyalty = content.rewardOutcomes.creatorRoyalties.find(
      r => r.asset === tier.currency
    );
    const creatorRoyaltyPercentage = creatorRoyalty?.percentage || 0;
    
    const template: X402PaymentTemplate = {
      id: templateId,
      version: 1,
      contentId: content.id,
      contentTitle: content.title,
      pricingKind: tier.kind,
      amount: tier.amount,
      currency: tier.currency,
      recipientAddress: content.pricingModel.creatorWalletAddress,
      platformFeePercentage: content.pricingModel.platformFeePercentage,
      creatorRoyaltyPercentage,
      covers: tier.covers,
      accessDurationSeconds: tier.durationSeconds,
      usageLimit: tier.usageLimit,
      metadata: {
        app: content.app,
        tenantId: content.tenantId,
        creatorRootDid: content.creatorRootDid,
        contentSlug: content.slug,
        structureKind: content.structure?.kind,
      },
      paymentInstructions: {
        supportedChains: chainConfigs,
        memo: this.generateMemo(content, tier),
        callbackUrl: `${this.baseCallbackUrl}/x402/callback/${templateId}`,
        webhookUrl: `${this.baseWebhookUrl}/x402/webhook/${templateId}`,
      },
      createdAt: new Date().toISOString(),
    };
    
    return template;
  }
  
  /**
   * Generate a pay-per-panel template for comics/graphic novels
   */
  generatePanelTemplate(
    content: SmartContentQube,
    panelIndex: number,
    panelCount: number
  ): X402PaymentTemplate | null {
    const panelTier = content.pricingModel.tiers.find(t => t.kind === 'payPerPanel');
    if (!panelTier) return null;
    
    const template = this.generateTemplate(content, panelTier);
    
    // Customize for specific panel
    template.id = `${template.id}_panel_${panelIndex}`;
    template.covers = [`panel_${panelIndex}`];
    template.paymentInstructions.memo = `Panel ${panelIndex + 1} of ${panelCount} - ${content.title}`;
    
    return template;
  }
  
  /**
   * Generate a streaming payment template
   */
  generateStreamTemplate(
    content: SmartContentQube,
    durationSeconds: number
  ): X402PaymentTemplate | null {
    const streamTier = content.pricingModel.tiers.find(t => t.kind === 'payPerStream');
    if (!streamTier) return null;
    
    const template = this.generateTemplate(content, streamTier);
    
    // Calculate prorated amount based on duration
    const baseDuration = streamTier.durationSeconds || 3600; // Default 1 hour
    const proratedAmount = Math.ceil((durationSeconds / baseDuration) * streamTier.amount);
    
    template.id = `${template.id}_stream_${durationSeconds}`;
    template.amount = proratedAmount;
    template.accessDurationSeconds = durationSeconds;
    template.paymentInstructions.memo = `Stream access for ${Math.ceil(durationSeconds / 60)} minutes - ${content.title}`;
    
    return template;
  }
  
  /**
   * Generate a bundle template for series/collection
   */
  generateBundleTemplate(
    contents: SmartContentQube[],
    bundleName: string,
    discountPercentage: number = 20
  ): X402PaymentTemplate | null {
    if (contents.length === 0) return null;
    
    // Calculate total price with discount
    let totalAmount = 0;
    let currency: PaymentCurrency = 'QCT';
    
    for (const content of contents) {
      const episodeTier = content.pricingModel.tiers.find(
        t => t.kind === 'payPerEpisode' || t.kind === 'payPerArticle'
      );
      if (episodeTier) {
        totalAmount += episodeTier.amount;
        currency = episodeTier.currency;
      }
    }
    
    const discountedAmount = Math.ceil(totalAmount * (1 - discountPercentage / 100));
    
    // Use first content as reference
    const referenceContent = contents[0];
    const templateId = this.generateTemplateId(`bundle_${bundleName}`, 'bundle');
    
    const chainConfigs = this.getChainConfigs(
      currency,
      referenceContent.pricingModel.creatorWalletAddress
    );
    
    const template: X402PaymentTemplate = {
      id: templateId,
      version: 1,
      contentId: `bundle_${bundleName}`,
      contentTitle: bundleName,
      pricingKind: 'bundle',
      amount: discountedAmount,
      currency,
      recipientAddress: referenceContent.pricingModel.creatorWalletAddress,
      platformFeePercentage: referenceContent.pricingModel.platformFeePercentage,
      creatorRoyaltyPercentage: 0,
      covers: contents.map(c => c.id),
      metadata: {
        app: referenceContent.app,
        tenantId: referenceContent.tenantId,
        creatorRootDid: referenceContent.creatorRootDid,
        contentSlug: bundleName.toLowerCase().replace(/\s+/g, '-'),
      },
      paymentInstructions: {
        supportedChains: chainConfigs,
        memo: `Bundle: ${bundleName} (${contents.length} items, ${discountPercentage}% off)`,
        callbackUrl: `${this.baseCallbackUrl}/x402/callback/${templateId}`,
        webhookUrl: `${this.baseWebhookUrl}/x402/webhook/${templateId}`,
      },
      createdAt: new Date().toISOString(),
    };
    
    return template;
  }
  
  /**
   * Generate subscription template
   */
  generateSubscriptionTemplate(
    content: SmartContentQube,
    periodMonths: number = 1
  ): X402PaymentTemplate | null {
    const subTier = content.pricingModel.tiers.find(t => t.kind === 'subscription');
    if (!subTier) return null;
    
    const template = this.generateTemplate(content, subTier);
    
    // Adjust for subscription period
    template.id = `${template.id}_sub_${periodMonths}m`;
    template.amount = subTier.amount * periodMonths;
    template.accessDurationSeconds = periodMonths * 30 * 24 * 60 * 60; // Approximate month in seconds
    template.paymentInstructions.memo = `${periodMonths}-month subscription - ${content.title}`;
    
    return template;
  }
  
  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================
  
  private generateTemplateId(contentId: string, kind: PricingKind): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `x402_${kind}_${contentId.substring(0, 8)}_${timestamp}_${random}`;
  }
  
  private getChainConfigs(
    currency: PaymentCurrency,
    recipientAddress: string
  ): X402ChainConfig[] {
    const baseConfigs = CHAIN_CONFIGS[currency] || CHAIN_CONFIGS.QCT;
    
    return baseConfigs.map(config => ({
      ...config,
      recipientAddress,
    }));
  }
  
  private generateMemo(content: SmartContentQube, tier: PricingTier): string {
    const kindLabels: Record<PricingKind, string> = {
      payPerPanel: 'Panel access',
      payPerEpisode: 'Episode access',
      payPerStream: 'Stream access',
      payPerArticle: 'Article access',
      payPerIssue: 'Issue access',
      payPerSeries: 'Series access',
      subscription: 'Subscription',
      bundle: 'Bundle',
      free: 'Free access',
    };
    
    return `${kindLabels[tier.kind]} - ${content.title}`;
  }
}

// =============================================================================
// TEMPLATE CACHE
// =============================================================================

class TemplateCache {
  private cache: Map<string, { template: X402PaymentTemplate; expiresAt: number }> = new Map();
  private ttlMs: number;
  
  constructor(ttlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.ttlMs = ttlMs;
  }
  
  get(key: string): X402PaymentTemplate | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.template;
  }
  
  set(key: string, template: X402PaymentTemplate): void {
    this.cache.set(key, {
      template,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
  
  invalidate(contentId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(contentId)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

let generatorInstance: X402TemplateGenerator | null = null;
const templateCache = new TemplateCache();

export function getX402TemplateGenerator(): X402TemplateGenerator {
  if (!generatorInstance) {
    generatorInstance = new X402TemplateGenerator();
  }
  return generatorInstance;
}

export function getCachedTemplate(
  content: SmartContentQube,
  tier: PricingTier
): X402PaymentTemplate {
  const cacheKey = `${content.id}_${tier.kind}_${tier.currency}`;
  
  let template = templateCache.get(cacheKey);
  if (!template) {
    const generator = getX402TemplateGenerator();
    template = generator.generateTemplate(content, tier);
    templateCache.set(cacheKey, template);
  }
  
  return template;
}

export function invalidateTemplateCache(contentId: string): void {
  templateCache.invalidate(contentId);
}
