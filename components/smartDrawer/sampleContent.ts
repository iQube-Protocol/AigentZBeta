import type { SmartContentQube } from '@/types/smartContent';

export const SAMPLE_CONTENT: Record<string, SmartContentQube> = {
  sample1: {
    id: 'sample-1',
    title: 'The Quantum Codex: Chapter 1',
    description: 'Dive into a world where reality bends and digital consciousness emerges.',
    app: 'Qriptopian',
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
    structure: { kind: 'series' },
    pricingModel: {
      tiers: [{ kind: 'free', amount: 0, currency: 'Q¢' }],
    },
  },
  sample2: {
    id: 'sample-2',
    title: 'Cyberpunk Chronicles',
    description: 'A neon-soaked journey through the digital underground.',
    app: 'metaKnyts',
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
    structure: { kind: 'series' },
    pricingModel: {
      tiers: [{ kind: 'premium', amount: 50, currency: 'KNYT' }],
    },
  },
  sample3: {
    id: 'sample-3',
    title: 'Trading Algorithms Masterclass',
    description: 'Learn advanced DeFi trading strategies from the pros.',
    app: 'MoneyPenny',
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
    structure: { kind: 'series' },
    pricingModel: {
      tiers: [{ kind: 'premium', amount: 100, currency: 'USDC' }],
    },
  },
};

export function getSampleContentByVariant(variantId?: string): SmartContentQube {
  // Return appropriate sample based on variant
  if (variantId?.includes('hero')) return SAMPLE_CONTENT.sample1;
  if (variantId?.includes('poster')) return SAMPLE_CONTENT.sample2;
  if (variantId?.includes('carousel')) return SAMPLE_CONTENT.sample3;
  return SAMPLE_CONTENT.sample1;
}
