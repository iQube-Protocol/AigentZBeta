import { createSmartContentQube } from '@/types/smartContent';
import type { SmartContentQube } from '@/types/smartContent';

export const SAMPLE_CONTENT: Record<string, SmartContentQube> = {
  sample1: createSmartContentQube({
    id: 'sample-1',
    app: 'Qriptopian',
    title: 'The Quantum Codex: Chapter 1',
    slug: 'quantum-codex-chapter-1',
    description: 'Dive into a world where reality bends and digital consciousness emerges.',
    creatorRootDid: 'did:example:creator1',
    tenantId: 'tenant-qriptopian',
    coverImageUri: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=600&fit=crop',
    modalities: {
      read: { 
        enabled: true,
        panels: [],
        textAssets: [],
        primaryOn: ['desktop', 'mobile'],
        readingDirection: 'ltr',
        estimatedReadMinutes: 15
      },
      watch: { 
        enabled: false,
        videoAssets: [],
        primaryOn: [],
        subtitleTracks: [],
        allowPip: false,
        allowDownload: false
      },
      listen: { 
        enabled: false,
        audioAssets: [],
        primaryOn: [],
        hasTranscript: false,
        allowBackground: false
      },
      interact: { 
        enabled: false,
        agents: [],
        tools: [],
        primaryOn: []
      },
    },
    pricingModel: {
      primaryCurrency: 'QCT',
      tiers: [{ kind: 'free', amount: 0, currency: 'QCT', covers: [] }],
      freePreview: {},
      creatorWalletAddress: '0x0000000000000000000000000000000000000000',
      platformFeePercentage: 10,
    },
    status: 'published',
  }),
  sample2: createSmartContentQube({
    id: 'sample-2',
    app: 'metaKnyts',
    title: 'Cyberpunk Chronicles',
    slug: 'cyberpunk-chronicles',
    description: 'A neon-soaked journey through the digital underground.',
    creatorRootDid: 'did:example:creator2',
    tenantId: 'tenant-metaknyts',
    coverImageUri: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=600&fit=crop',
    modalities: {
      read: { 
        enabled: true,
        panels: [],
        textAssets: [],
        primaryOn: ['desktop', 'mobile'],
        readingDirection: 'ltr',
        estimatedReadMinutes: 20
      },
      watch: { 
        enabled: true,
        videoAssets: [],
        primaryOn: ['desktop', 'tv'],
        subtitleTracks: [],
        allowPip: true,
        allowDownload: false
      },
      listen: { 
        enabled: false,
        audioAssets: [],
        primaryOn: [],
        hasTranscript: false,
        allowBackground: false
      },
      interact: { 
        enabled: false,
        agents: [],
        tools: [],
        primaryOn: []
      },
    },
    pricingModel: {
      primaryCurrency: 'KNYT',
      tiers: [{ kind: 'subscription', amount: 50, currency: 'KNYT', covers: [] }],
      freePreview: { percentageOfContent: 20 },
      creatorWalletAddress: '0x0000000000000000000000000000000000000000',
      platformFeePercentage: 10,
    },
    status: 'published',
  }),
  sample3: createSmartContentQube({
    id: 'sample-3',
    app: 'MoneyPenny',
    title: 'Trading Algorithms Masterclass',
    slug: 'trading-algorithms-masterclass',
    description: 'Learn advanced DeFi trading strategies from the pros.',
    creatorRootDid: 'did:example:creator3',
    tenantId: 'tenant-moneypenny',
    coverImageUri: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop',
    modalities: {
      read: { 
        enabled: true,
        panels: [],
        textAssets: [],
        primaryOn: ['desktop', 'mobile'],
        readingDirection: 'ltr',
        estimatedReadMinutes: 45
      },
      watch: { 
        enabled: true,
        videoAssets: [],
        primaryOn: ['desktop', 'tv'],
        subtitleTracks: [],
        allowPip: true,
        allowDownload: true
      },
      listen: { 
        enabled: true,
        audioAssets: [],
        primaryOn: ['mobile'],
        hasTranscript: true,
        allowBackground: true
      },
      interact: { 
        enabled: true,
        agents: [],
        tools: [],
        primaryOn: ['desktop', 'mobile', 'tv']
      },
    },
    pricingModel: {
      primaryCurrency: 'USDC',
      tiers: [{ kind: 'payPerArticle', amount: 100, currency: 'USDC', covers: [] }],
      freePreview: { timeLimitSeconds: 300 },
      creatorWalletAddress: '0x0000000000000000000000000000000000000000',
      platformFeePercentage: 15,
    },
    status: 'published',
  }),
};

export function getSampleContentByVariant(variantId?: string): SmartContentQube {
  // Return appropriate sample based on variant
  if (variantId?.includes('hero')) return SAMPLE_CONTENT.sample1;
  if (variantId?.includes('poster')) return SAMPLE_CONTENT.sample2;
  if (variantId?.includes('carousel')) return SAMPLE_CONTENT.sample3;
  return SAMPLE_CONTENT.sample1;
}
