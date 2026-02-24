
export const BASE_DEMO_CONTENTS: any[] = [
  {
    id: "capsule-qriptopian-read",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "Experience Capsule: Read Qriptopian",
    slug: "capsule-qriptopian-read",
    version: 1,
    description: "Launch a curated reading experience from the Qriptopian codex.",
    coverImageUri: "https://images.unsplash.com/photo-1452457807411-4979b707c5be?w=800&q=80",
    creatorRootDid: "did:iq:capsule-qriptopian",
    tenantId: "qriptopian",
    identityRequirements: {
      minimumState: "anonymous",
      requiredClaims: [],
      allowAgents: true,
      requireHumanProof: false,
    },
    reputationRequirements: {
      minimumBucket: 0,
      requiredBadges: [],
      minimumScore: 0,
    },
    rewardOutcomes: {
      engagementRewards: [],
      creatorRoyalties: [],
      rewardHubTenantId: "qriptopian",
    },
    modalities: {
      read: { enabled: true, panels: [], textAssets: [] },
      watch: { enabled: false, assets: [] },
      listen: { enabled: false, assets: [] },
      interact: { enabled: false, actions: [] },
    },
    structure: {
      kind: "article",
    },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    accessPolicy: {
      visibility: "public",
      allowAgents: true,
      allowAnonymous: true,
      requireWallet: false,
      requirePersona: false,
      allowOverrides: true,
    },
    layoutHints: {
      defaultCard: "compact",
      thumbnail: { size: "small", floating: false, position: "top-left" },
      carousels: { enabled: true, groupBy: "none", itemsPerView: 3 },
      responsive: {},
      iframe: { allowEmbed: false, allowFullscreen: false },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "agentChat"],
      optionalDrawers: ["walletCompact"],
      showWalletSummary: false,
      showLibraryStatus: true,
      showQuestProgress: false,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 1 },
    },
    createdAt: new Date().toISOString(),
    status: "published",
  },
  {
    id: "capsule-metaknyt-play",
    type: "SmartContentQube",
    app: "metaKnyts",
    title: "Experience Capsule: Play metaKNYT",
    slug: "capsule-metaknyt-play",
    version: 1,
    description: "Jump into a narrative capsule with smart modules and rewards.",
    coverImageUri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80",
    creatorRootDid: "did:iq:capsule-metaknyt",
    tenantId: "metaknyts",
    identityRequirements: {
      minimumState: "anonymous",
      requiredClaims: [],
      allowAgents: true,
      requireHumanProof: false,
    },
    reputationRequirements: {
      minimumBucket: 0,
      requiredBadges: [],
      minimumScore: 0,
    },
    rewardOutcomes: {
      engagementRewards: [{ trigger: "complete", amount: 20, currency: "QCT", cooldownMinutes: 1440 }],
      creatorRoyalties: [],
      rewardHubTenantId: "metaknyts",
    },
    modalities: {
      read: { enabled: true, panels: [], textAssets: [] },
      watch: { enabled: false, assets: [] },
      listen: { enabled: false, assets: [] },
      interact: { enabled: true, actions: [] },
    },
    structure: {
      kind: "episode",
      panelCount: 6,
    },
    pricingModel: {
      tiers: [{ kind: "payPerEpisode", amount: 50, currency: "QCT", covers: 6 }],
      acceptedTokens: ["QCT"],
    },
    accessPolicy: {
      visibility: "public",
      allowAgents: true,
      allowAnonymous: true,
      requireWallet: false,
      requirePersona: false,
      allowOverrides: true,
    },
    layoutHints: {
      defaultCard: "compact",
      thumbnail: { size: "small", floating: false, position: "top-left" },
      carousels: { enabled: true, groupBy: "none", itemsPerView: 3 },
      responsive: {},
      iframe: { allowEmbed: false, allowFullscreen: false },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "agentChat", "walletCompact"],
      optionalDrawers: ["walletCompact"],
      showWalletSummary: true,
      showLibraryStatus: true,
      showQuestProgress: true,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 2 },
    },
    createdAt: new Date().toISOString(),
    status: "published",
  },
  {
    id: "capsule-earn-reward",
    type: "SmartContentQube",
    app: "AgentiQ",
    title: "Experience Capsule: Earn Rewards",
    slug: "capsule-earn-reward",
    version: 1,
    description: "Complete a task flow and earn Q¢ rewards.",
    coverImageUri: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=800&q=80",
    creatorRootDid: "did:iq:capsule-agentiq",
    tenantId: "agentiq",
    identityRequirements: {
      minimumState: "anonymous",
      requiredClaims: [],
      allowAgents: true,
      requireHumanProof: false,
    },
    reputationRequirements: {
      minimumBucket: 0,
      requiredBadges: [],
      minimumScore: 0,
    },
    rewardOutcomes: {
      engagementRewards: [{ trigger: "questComplete", amount: 15, currency: "QCT", cooldownMinutes: 1440 }],
      creatorRoyalties: [],
      rewardHubTenantId: "agentiq",
    },
    modalities: {
      read: { enabled: true, panels: [], textAssets: [] },
      watch: { enabled: true, assets: [] },
      listen: { enabled: false, assets: [] },
      interact: { enabled: true, actions: [] },
    },
    structure: {
      kind: "article",
    },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: 1 }],
      acceptedTokens: [],
    },
    accessPolicy: {
      visibility: "public",
      allowAgents: true,
      allowAnonymous: true,
      requireWallet: false,
      requirePersona: false,
      allowOverrides: true,
    },
    layoutHints: {
      defaultCard: "compact",
      thumbnail: { size: "small", floating: false, position: "top-left" },
      carousels: { enabled: true, groupBy: "none", itemsPerView: 3 },
      responsive: {},
      iframe: { allowEmbed: false, allowFullscreen: false },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "questTracker", "rewardsPanel"],
      optionalDrawers: ["walletCompact"],
      showWalletSummary: true,
      showLibraryStatus: true,
      showQuestProgress: true,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "capsule",
      tags: ["capsule", "experience"],
      recommendedShelf: "capsules",
      expiry: { model: "permanent" },
      ownership: { status: "available", libraryStatus: "not_owned" },
      discovery: { featured: true, curated: true, priority: 3 },
    },
    createdAt: new Date().toISOString(),
    status: "published",
  },
  {
    id: "demo-metaknyts-ep1",
    type: "SmartContentQube",
    app: "metaKnyts",
    title: "Episode 1: The Awakening",
    slug: "episode-1-awakening",
    version: 1,
    description: "Kn0w1 discovers the hidden world of decentralized identity and begins their journey into the metaverse. A 6-panel micro-episode introducing the core concepts.",
    coverImageUri: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    creatorRootDid: "did:iq:creator-metaknyts",
    tenantId: "metaknyts",
    identityRequirements: {
      minimumState: "anonymous",
      requiredClaims: [],
      allowAgents: true,
      requireHumanProof: false,
    },
    reputationRequirements: {
      minimumBucket: 0,
      requiredBadges: [],
      minimumScore: 0,
    },
    rewardOutcomes: {
      engagementRewards: [{ trigger: "complete", amount: 10, currency: "QCT", cooldownMinutes: 1440 }],
      creatorRoyalties: [{ percentage: 85, asset: "QCT", recipientDid: "did:iq:creator-metaknyts" }],
      rewardHubTenantId: "metaknyts",
    },
    modalities: {
      read: {
        enabled: true,
        panels: [
          { index: 0, assetUri: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&q=80", caption: "The city sleeps, unaware of the digital revolution brewing beneath." },
          { index: 1, assetUri: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80", caption: "Kn0w1 receives the first signal..." },
          { index: 2, assetUri: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80", caption: "The blockchain reveals its secrets." },
          { index: 3, assetUri: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80", caption: "Identity fragments coalesce into meaning." },
          { index: 4, assetUri: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=800&q=80", caption: "The first iQube materializes." },
          { index: 5, assetUri: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80", caption: "Kn0w1 awakens to a new reality." },
        ],
        textAssets: [],
      },
      watch: { enabled: false, assets: [] },
      listen: { enabled: false, assets: [] },
      interact: {
        enabled: true,
        agents: ["Kn0w1", "MoneyPenny"],
        tools: ["identity-verify", "reputation-check"],
        contextPrompt: "You are Kn0w1, guiding the reader through the metaKnyts universe.",
      },
    },
    structure: {
      kind: "episode",
      seriesId: "metaknyts-book-1",
      seasonNumber: 1,
      episodeNumber: 1,
      positionInSeries: 1,
    },
    pricingModel: {
      tiers: [
        { kind: "payPerPanel", amount: 5, currency: "QCT", covers: ["panel"], durationSeconds: undefined },
        { kind: "payPerEpisode", amount: 25, currency: "QCT", covers: ["all_panels", "interact"] },
      ],
      creatorWalletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      platformFeePercentage: 15,
      allowBundling: true,
    },
    accessPolicy: {
      gatingType: "token",
      previewPanels: 2,
      requiresEntitlement: true,
      expiryModel: "perpetual",
    },
    layoutHints: {
      preferredLayout: "split",
      panelAspectRatio: "16:9",
      responsive: {
        mobile: { layout: "stack", columns: 1 },
        tablet: { layout: "grid", columns: 2 },
        desktop: { layout: "split", columns: 1 },
      },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "walletCompact", "agentChat"],
      optionalDrawers: ["libraryShelf", "questTracker"],
      showWalletSummary: true,
      showLibraryStatus: true,
      showQuestProgress: false,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "Graphic Novel",
      tags: ["sci-fi", "identity", "blockchain", "metaverse"],
      estimatedDuration: 300,
      difficulty: "beginner",
      featured: true,
      curatorNotes: "Perfect introduction to the metaKnyts universe",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    status: "published",
  },
  {
    id: "demo-qriptopian-article",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "The Penny is Dead: Why Micropayments Finally Work",
    slug: "the-penny-is-dead",
    version: 1,
    description: "An in-depth analysis of how x402 and blockchain technology have finally solved the micropayment problem that has plagued the internet for decades.",
    coverImageUri: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80",
    creatorRootDid: "did:iq:creator-qriptopian",
    tenantId: "qriptopian",
    identityRequirements: {
      minimumState: "pseudo",
      requiredClaims: [],
      allowAgents: true,
      requireHumanProof: false,
    },
    reputationRequirements: {
      minimumBucket: 1,
      requiredBadges: [],
      minimumScore: 10,
    },
    rewardOutcomes: {
      engagementRewards: [{ trigger: "complete", amount: 5, currency: "QCT", cooldownMinutes: 1440 }],
      creatorRoyalties: [{ percentage: 80, asset: "QCT", recipientDid: "did:iq:creator-qriptopian" }],
      rewardHubTenantId: "qriptopian",
    },
    modalities: {
      read: {
        enabled: true,
        panels: [
          { index: 0, assetUri: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80", caption: "The evolution of digital payments" },
        ],
        textAssets: [
          { uri: "", format: "markdown", wordCount: 2500 },
        ],
      },
      watch: { enabled: false, assets: [] },
      listen: {
        enabled: true,
        assets: [{ uri: "https://example.com/audio/penny-is-dead.mp3", format: "mp3", durationSeconds: 900 }],
      },
      interact: {
        enabled: true,
        agents: ["MoneyPenny"],
        tools: ["payment-simulator"],
        contextPrompt: "You are MoneyPenny, explaining micropayment concepts to the reader.",
      },
    },
    structure: {
      kind: "article",
      headline: "The Penny is Dead",
      subheadline: "Why Micropayments Finally Work",
      byline: "Qriptopian Research Team",
      seriesId: "future-of-money",
      positionInSeries: 1,
    },
    pricingModel: {
      tiers: [
        { kind: "payPerArticle", amount: 50, currency: "QCT", covers: ["full_article", "audio", "interact"] },
        { kind: "subscription", amount: 500, currency: "QCT", covers: ["all_content"], durationSeconds: 2592000 },
      ],
      creatorWalletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
      platformFeePercentage: 20,
      allowBundling: true,
    },
    accessPolicy: {
      gatingType: "paywall",
      previewPanels: 1,
      requiresEntitlement: true,
      expiryModel: "perpetual",
    },
    layoutHints: {
      preferredLayout: "stack",
      panelAspectRatio: "16:9",
      responsive: {
        mobile: { layout: "stack", columns: 1 },
        tablet: { layout: "stack", columns: 1 },
        desktop: { layout: "split", columns: 1 },
      },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "walletCompact"],
      optionalDrawers: ["agentChat", "libraryShelf"],
      showWalletSummary: true,
      showLibraryStatus: true,
      showQuestProgress: false,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "Finance",
      tags: ["micropayments", "x402", "blockchain", "economics"],
      estimatedDuration: 900,
      difficulty: "intermediate",
      featured: true,
      curatorNotes: "Essential reading for understanding the new payment paradigm",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    status: "published",
  },
  {
    id: "demo-agentiq-tutorial",
    type: "SmartContentQube",
    app: "AgentiQ",
    title: "Building Your First AI Agent",
    slug: "building-first-ai-agent",
    version: 1,
    description: "A hands-on tutorial for creating and deploying your first AI agent on the AgentiQ platform. Learn the fundamentals of agent design and iQube integration.",
    coverImageUri: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    creatorRootDid: "did:iq:creator-agentiq",
    tenantId: "agentiq",
    identityRequirements: {
      minimumState: "semi",
      requiredClaims: ["developer"],
      allowAgents: false,
      requireHumanProof: true,
    },
    reputationRequirements: {
      minimumBucket: 2,
      requiredBadges: [],
      minimumScore: 25,
    },
    rewardOutcomes: {
      engagementRewards: [
        { trigger: "complete", amount: 50, currency: "QCT", cooldownMinutes: 0 },
        { trigger: "share", amount: 10, currency: "QCT", cooldownMinutes: 1440 },
      ],
      creatorRoyalties: [{ percentage: 70, asset: "QCT", recipientDid: "did:iq:creator-agentiq" }],
      rewardHubTenantId: "agentiq",
    },
    modalities: {
      read: {
        enabled: true,
        panels: [
          { index: 0, assetUri: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80", caption: "Introduction to AI Agents" },
          { index: 1, assetUri: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&q=80", caption: "Setting up your development environment" },
          { index: 2, assetUri: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80", caption: "Designing agent capabilities" },
        ],
        textAssets: [],
      },
      watch: {
        enabled: true,
        assets: [
          { uri: "https://example.com/video/agent-tutorial.mp4", format: "mp4", durationSeconds: 1800, thumbnailUri: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=80" },
        ],
      },
      listen: { enabled: false, assets: [] },
      interact: {
        enabled: true,
        agents: ["AgentBuilder", "CodeAssist"],
        tools: ["code-sandbox", "agent-tester"],
        contextPrompt: "You are AgentBuilder, helping users create their first AI agent step by step.",
      },
    },
    structure: {
      kind: "episode",
      seriesId: "agentiq-tutorials",
      seasonNumber: 1,
      episodeNumber: 1,
      positionInSeries: 1,
    },
    pricingModel: {
      tiers: [{ kind: "free", amount: 0, currency: "QCT", covers: ["all"] }],
      creatorWalletAddress: "0x9876543210fedcba9876543210fedcba98765432",
      platformFeePercentage: 0,
      allowBundling: false,
    },
    accessPolicy: {
      gatingType: "identity",
      previewPanels: 3,
      requiresEntitlement: false,
      expiryModel: "perpetual",
    },
    layoutHints: {
      preferredLayout: "grid",
      panelAspectRatio: "16:9",
      responsive: {
        mobile: { layout: "stack", columns: 1 },
        tablet: { layout: "grid", columns: 2 },
        desktop: { layout: "grid", columns: 3 },
      },
    },
    menuIntegration: {
      preferredDrawers: ["contentViewer", "agentChat"],
      optionalDrawers: ["walletCompact", "questTracker"],
      showWalletSummary: false,
      showLibraryStatus: true,
      showQuestProgress: true,
      allowUserOverrides: true,
    },
    libraryMetadata: {
      category: "Tutorial",
      tags: ["ai", "agents", "development", "tutorial"],
      estimatedDuration: 1800,
      difficulty: "intermediate",
      featured: false,
      curatorNotes: "Great starting point for developers new to AI agents",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    status: "published",
  },
]

const buildMediaVariants = (id: string, url: string, hasVideo: boolean, videoUrl?: string) => {
  if (!url) return undefined;
  const baseId = id || 'demo-content';
  const image = {
    default: { id: `${baseId}-img-default`, url, ratio: '3:4', crop: 'cover', orientation: 'portrait', cache: { key: `${baseId}-img-default`, preferredSizes: ['320w','640w','1024w'] } },
    device: {
      mobile: { id: `${baseId}-img-mobile`, url, ratio: '3:4', crop: 'cover', orientation: 'portrait' },
      tablet: { id: `${baseId}-img-tablet`, url, ratio: '4:3', crop: 'cover', orientation: 'landscape' },
      desktop: { id: `${baseId}-img-desktop`, url, ratio: '16:9', crop: 'cover', orientation: 'landscape' },
    },
    ratios: {
      '16:9': { id: `${baseId}-img-16x9`, url, ratio: '16:9', crop: 'cover', orientation: 'landscape' },
      '4:3': { id: `${baseId}-img-4x3`, url, ratio: '4:3', crop: 'cover', orientation: 'landscape' },
      '1:1': { id: `${baseId}-img-1x1`, url, ratio: '1:1', crop: 'cover', orientation: 'portrait' },
      '3:4': { id: `${baseId}-img-3x4`, url, ratio: '3:4', crop: 'cover', orientation: 'portrait' },
    },
    sizes: {
      'screen-1-4': { id: `${baseId}-img-s14`, url, sizeRel: { h: 'screen-1-4' } },
      'screen-1-3': { id: `${baseId}-img-s13`, url, sizeRel: { h: 'screen-1-3' } },
      'screen-1-2': { id: `${baseId}-img-s12`, url, sizeRel: { h: 'screen-1-2' } },
      'screen-2-3': { id: `${baseId}-img-s23`, url, sizeRel: { h: 'screen-2-3' } },
      'screen-3-4': { id: `${baseId}-img-s34`, url, sizeRel: { h: 'screen-3-4' } },
      'screen-full': { id: `${baseId}-img-full`, url, sizeRel: { h: 'screen-full' } },
    },
  };

  if (!hasVideo || !videoUrl) {
    return { image };
  }

  const video = {
    default: { id: `${baseId}-vid-default`, url: videoUrl, ratio: '16:9', crop: 'cover', orientation: 'landscape', cache: { key: `${baseId}-vid-default` } },
    device: {
      mobile: { id: `${baseId}-vid-mobile`, url: videoUrl, ratio: '9:16', crop: 'cover', orientation: 'portrait', focalPoint: { x: 0.5, y: 0.5 } },
      tablet: { id: `${baseId}-vid-tablet`, url: videoUrl, ratio: '4:3', crop: 'cover', orientation: 'landscape' },
      desktop: { id: `${baseId}-vid-desktop`, url: videoUrl, ratio: '16:9', crop: 'cover', orientation: 'landscape' },
    },
    orientation: {
      portrait: { id: `${baseId}-vid-portrait`, url: videoUrl, ratio: '9:16', crop: 'cover', orientation: 'portrait', focalPoint: { x: 0.5, y: 0.5 } },
    },
  };

  return { image, video };
};

export const DEMO_CONTENTS: any[] = BASE_DEMO_CONTENTS.map((item) => {
  const cover = item.coverImageUri || '';
  const watchAsset = item.modalities?.watch?.assets?.[0]?.assetUri;
  const hasVideo = Boolean(item.modalities?.watch?.enabled && watchAsset);
  const mediaVariants = buildMediaVariants(item.id || item.slug || 'demo-content', cover, hasVideo, watchAsset);
  return {
    ...item,
    mediaVariants,
  };
});
