"use client";

import React, { useMemo, useState, useEffect } from "react";
import { SmartContentCard, ContentViewer, SmartWalletDrawer, SmartTriadProvider } from "@/app/components/content";
import { PersonaSetupWizard } from "@/app/components/wallet";
import { agentConfigs } from "@/app/data/agentConfig";
import type { SmartContentQube } from "@/types/smartContent";
import type { SmartWalletNode } from "@/types/smartWallet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { liquidTemplateRegistry } from "@/app/triad/components/codex/liquidTemplates/registry";
import { DevicePreviewSwitcher, DeviceType } from "@/components/preview/DevicePreviewSwitcher";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IQubeTemplate } from "@/types/registry";
import { 
  Wallet, 
  BookOpen, 
  Video, 
  Headphones, 
  MessageSquare, 
  FileText, 
  LayoutGrid,
  Layers,
  Bot
} from "lucide-react";

// Agent wallet configurations for SmartContent payments
// Payer: AigentZ (the user/buyer)
// Recipient: Aigent Kn0w1 (content creator/seller)
const PAYER_AGENT = agentConfigs["aigent-z"];
const RECIPIENT_AGENT = agentConfigs["aigent-kn0w1"];

// =============================================================================
// DEMO DATA
// =============================================================================

// Demo data uses simplified mock structure - cast to any to bypass strict typing
const DEMO_CONTENTS: any[] = [
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
];

// Demo wallet uses simplified mock structure - cast to any to bypass strict typing
// Aigent Z is the primary persona with real wallet for payments
const DEMO_WALLET: any = {
  id: "demo-wallet",
  type: "SmartWalletNode",
  personaContext: {
    activePersonaId: "aigent-z",
    activePersona: {
      id: "aigent-z",
      displayName: "Aigent Z",
      fioHandle: "aigentz@aigent",
      identifiability: "agent",
      reputationBucket: 5,
      reputationScore: 100,
      badges: ["verified-agent", "early-adopter", "content-creator"],
      // Real wallet address for payments
      evmAddress: PAYER_AGENT.walletAddresses.evmAddress,
    },
    availablePersonas: [
      {
        id: "aigent-z",
        displayName: "Aigent Z",
        fioHandle: "aigentz@aigent",
        reputationBucket: 5,
        reputationScore: 100,
        evmAddress: PAYER_AGENT.walletAddresses.evmAddress,
      },
      {
        id: "00000000-0000-0000-0000-000000000001",
        displayName: "kn0w1@aigent",
        fioHandle: "kn0w1@aigent",
        reputationBucket: 3,
        reputationScore: 75,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        displayName: "shadow@knyt",
        fioHandle: "shadow@knyt",
        reputationBucket: 2,
        reputationScore: 45,
      },
    ],
    rootDid: "did:iq:aigent-z",
  },
  balances: {
    QCT: { available: 1250, pending: 50, locked: 0 },
    USDC: { available: 125.50, pending: 0, locked: 0 },
    KNYT: { available: 25, pending: 0, locked: 0 },
  },
  contentEntitlements: [
    {
      id: "ent-1",
      contentId: "demo-agentiq-tutorial",
      contentTitle: "Building Your First AI Agent",
      scope: "full",
      acquiredVia: "free",
      acquiredAt: new Date().toISOString(),
    },
  ],
  contentContext: {
    currentContentId: undefined,
    pricingSnapshot: undefined,
    accessStatus: "none",
    progressPercentage: 0,
  },
  agentContext: {
    activeAgentId: undefined,
    conversationId: undefined,
    lastInteraction: undefined,
  },
  tasks: [
    {
      id: "task-1",
      title: "Complete Episode 1",
      description: "Finish reading the first episode of metaKnyts",
      type: "content",
      priority: "medium",
      status: "pending",
      contentId: "demo-metaknyts-ep1",
      reward: { amount: 25, currency: "QCT" },
      createdAt: new Date().toISOString(),
    },
    {
      id: "task-2",
      title: "Share an article",
      description: "Share any Qriptopian article to earn rewards",
      type: "social",
      priority: "low",
      status: "pending",
      reward: { amount: 10, currency: "QCT" },
      createdAt: new Date().toISOString(),
    },
  ],
  activeQuests: [
    {
      questId: "onboarding",
      questTitle: "Welcome to the Platform",
      currentStep: 2,
      totalSteps: 5,
      stepDescriptions: ["Create account", "Verify identity", "Read first content", "Make first payment", "Join community"],
      rewards: [{ amount: 100, currency: "QCT" }],
      startedAt: new Date().toISOString(),
    },
  ],
  rewardsContext: {
    pendingRewards: [
      { id: "r1", amount: 50, tokenType: "QCT", reason: "Tutorial completion", status: "Proposed" },
    ],
    recentRewards: [
      { id: "r2", amount: 25, tokenType: "QCT", reason: "Daily login", status: "Distributed", distributedAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "r3", amount: 10, tokenType: "QCT", reason: "Content share", status: "Distributed", distributedAt: new Date(Date.now() - 172800000).toISOString() },
    ],
    lifetimeEarnings: { QCT: 285, USDC: 12.50, KNYT: 5 },
    rewardHubStatus: "connected",
  },
  preferences: {
    preferredCurrency: "QCT",
    autoPayEnabled: false,
    autoPayLimit: 100,
    notificationsEnabled: true,
    showBalances: true,
    showTasks: true,
    preferredDrawerLayout: "compact",
    drawerOverrides: {
      enabled: false,
      preferredDrawers: [],
    },
  },
  walletAddresses: {
    evm: "0x1234567890abcdef1234567890abcdef12345678",
  },
  lastSyncedAt: new Date().toISOString(),
  connectionStatus: "connected",
};

// =============================================================================
// DEMO PAGE COMPONENT
// =============================================================================

export default function SmartContentDemoPage() {
  const [demoTab, setDemoTab] = useState<"content" | "templates">("content");
  const [selectedContent, setSelectedContent] = useState<SmartContentQube | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [unlockedPanels, setUnlockedPanels] = useState<number[]>([]);
  const [liveContent, setLiveContent] = useState<SmartContentQube[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [purchaseContent, setPurchaseContent] = useState<SmartContentQube | null>(null);
  const [showPersonaWizard, setShowPersonaWizard] = useState(false);
  const [liquidTemplates, setLiquidTemplates] = useState<IQubeTemplate[]>([]);
  const [loadingLiquidTemplates, setLoadingLiquidTemplates] = useState(true);
  const [templateDeviceById, setTemplateDeviceById] = useState<Record<string, DeviceType>>({});
  const [templateSeedById, setTemplateSeedById] = useState<Record<string, number>>({});
  const [templateGroup, setTemplateGroup] = useState<"discovery" | "detail" | "utility">("discovery");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Dynamic wallet state - starts with DEMO_WALLET and updates on actions
  const [walletState, setWalletState] = useState<any>(DEMO_WALLET);
  
  // Handle persona switching
  const handlePersonaChange = (personaId: string) => {
    const persona = walletState.personaContext.availablePersonas.find((p: any) => p.id === personaId);
    if (persona) {
      setWalletState((prev: any) => ({
        ...prev,
        personaContext: {
          ...prev.personaContext,
          activePersonaId: personaId,
          activePersona: {
            ...persona,
            badges: persona.badges || prev.personaContext.activePersona?.badges || [],
          },
        },
      }));
    }
  };
  
  // Add content to library - stores full content object for rendering
  const addToLibrary = (content: SmartContentQube, acquiredVia: 'purchase' | 'free' | 'reward') => {
    const newEntitlement = {
      id: `ent-${Date.now()}`,
      contentId: content.id,
      contentTitle: content.title,
      // Store full content object for SmartContentCard rendering
      content: content,
      // QubeBase reference - in production this would be IPFS CID or Supabase blob ref
      qubeBaseRef: {
        type: 'supabase' as const,
        table: 'smart_content',
        id: content.id,
        // For IPFS: { type: 'ipfs', cid: 'Qm...' }
      },
      scope: 'full' as const,
      acquiredVia,
      acquiredAt: new Date().toISOString(),
    };
    
    setWalletState((prev: any) => ({
      ...prev,
      contentEntitlements: [...(prev.contentEntitlements || []), newEntitlement],
    }));
  };

  // Fetch real content from database
  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch('/api/content/smart?status=published');
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setLiveContent(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch live content:', error);
      } finally {
        setLoadingLive(false);
      }
    }
    fetchContent();
  }, []);

  const contentPool = liveContent.length > 0 ? liveContent : DEMO_CONTENTS;

  const templateContentById = useMemo(() => {
    const shuffleWithSeed = (items: any[], seed: number) => {
      const result = [...items];
      let nextSeed = seed || 1;
      for (let i = result.length - 1; i > 0; i -= 1) {
        nextSeed = (nextSeed * 9301 + 49297) % 233280;
        const rand = nextSeed / 233280;
        const j = Math.floor(rand * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };

    const mapped: Record<string, SmartContentQube[]> = {};
    liquidTemplates.forEach((template) => {
      const seed = templateSeedById[template.id] ?? 0;
      const shuffled = shuffleWithSeed(contentPool, seed);
      mapped[template.id] = shuffled.slice(0, Math.min(6, shuffled.length));
    });
    return mapped;
  }, [contentPool, liquidTemplates, templateSeedById]);

  const templateGroups = useMemo(() => {
    const groups: Record<"discovery" | "detail" | "utility", IQubeTemplate[]> = {
      discovery: [],
      detail: [],
      utility: [],
    };

    liquidTemplates.forEach((template) => {
      const liquidTemplateId = template.metaExtras?.find((kv) => kv.k === 'liquid_template_id')?.v;
      const fingerprint = `${template.name} ${template.description ?? ""} ${liquidTemplateId ?? ""}`.toLowerCase();
      if (/(feed|grid|catalog|gallery|list|stream|collection|browse)/.test(fingerprint)) {
        groups.discovery.push(template);
      } else if (/(detail|reader|viewer|article|story|offer|checkout|player|preview)/.test(fingerprint)) {
        groups.detail.push(template);
      } else {
        groups.utility.push(template);
      }
    });

    return groups;
  }, [liquidTemplates]);

  const templatesForGroup = templateGroups[templateGroup] || [];

  useEffect(() => {
    if (templatesForGroup.length === 0) {
      setSelectedTemplateId("");
      return;
    }
    if (!selectedTemplateId || !templatesForGroup.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templatesForGroup[0].id);
    }
  }, [templatesForGroup, selectedTemplateId]);

  // Fetch Liquid UI template archetypes from iQube registry
  useEffect(() => {
    async function fetchLiquidTemplates() {
      try {
        const res = await fetch('/api/registry/templates?type=LiquidUITemplateArchetypeQube&limit=50');
        const json = await res.json();
        const items: IQubeTemplate[] = Array.isArray(json?.data) ? json.data : [];
        setLiquidTemplates(items);
      } catch (error) {
        console.error('Failed to fetch Liquid UI templates:', error);
      } finally {
        setLoadingLiquidTemplates(false);
      }
    }
    fetchLiquidTemplates();
  }, []);

  const handleContentSelect = (content: SmartContentQube) => {
    setSelectedContent(content);
    setViewerOpen(true);
  };

  const handlePurchase = (content: SmartContentQube) => {
    // Set the content for purchase and open wallet drawer
    setPurchaseContent(content);
    setWalletOpen(true);
  };

  const handlePurchaseComplete = (content?: SmartContentQube) => {
    if (!content) {
      console.warn('Purchase complete called without content');
      return;
    }
    // Add to library after successful purchase
    addToLibrary(content, 'purchase');
    console.log('Purchase complete, added to library:', content.title);
    setPurchaseContent(null);
  };
  
  // Handle adding free content to library
  const handleAddFreeToLibrary = (content: SmartContentQube) => {
    addToLibrary(content, 'free');
    console.log('Added free content to library:', content.title);
  };
  
  // Handle task actions (complete/dismiss)
  const handleTaskAction = (task: any, action: string) => {
    if (action === 'complete') {
      // Update task status and add reward
      setWalletState((prev: any) => {
        const updatedTasks = prev.tasks.map((t: any) => 
          t.id === task.id ? { ...t, status: 'completed' } : t
        );
        
        // Add reward to pending if task has one
        const newReward = task.reward ? {
          id: `reward-${Date.now()}`,
          amount: task.reward.amount,
          tokenType: task.reward.currency,
          reason: `Completed: ${task.title}`,
          status: 'Proposed',
        } : null;
        
        return {
          ...prev,
          tasks: updatedTasks,
          rewardsContext: {
            ...prev.rewardsContext,
            pendingRewards: newReward 
              ? [...(prev.rewardsContext?.pendingRewards || []), newReward]
              : prev.rewardsContext?.pendingRewards || [],
          },
        };
      });
      alert(`Task "${task.title}" completed! Reward pending.`);
    } else {
      // Dismiss task
      setWalletState((prev: any) => ({
        ...prev,
        tasks: prev.tasks.filter((t: any) => t.id !== task.id),
      }));
    }
  };
  
  // Handle reputation claim submission
  const handleSubmitReputationClaim = () => {
    alert('Reputation claim flow coming soon! This will allow you to submit evidence of contributions.');
    // TODO: Open a modal for claim submission
  };

  const handlePanelPayment = (panelIndex: number) => {
    if (!selectedContent) return;
    const tier = selectedContent.pricingModel?.tiers?.find(t => t.kind === "payPerPanel");
    if (tier) {
      alert(`Unlock panel ${panelIndex + 1} for ${tier.amount} ${tier.currency}`);
      setUnlockedPanels(prev => [...prev, panelIndex]);
    } else {
      // No pricing - just unlock
      setUnlockedPanels(prev => [...prev, panelIndex]);
    }
  };

  const handleAddToLibrary = (content: SmartContentQube) => {
    // Check if already in library
    const alreadyInLibrary = walletState.contentEntitlements?.some(
      (ent: any) => ent.contentId === content.id
    );
    if (alreadyInLibrary) {
      alert(`"${content.title}" is already in your library!`);
      return;
    }
    // Determine if free or needs purchase
    const isFree = !content.pricingModel?.tiers?.length || 
                   content.pricingModel.tiers.some(t => t.amount === 0);
    if (isFree) {
      addToLibrary(content, 'free');
      alert(`Added "${content.title}" to your library!`);
    } else {
      // Open wallet for purchase
      handlePurchase(content);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-white">
                {demoTab === "content" ? (
                  <BookOpen className="h-5 w-5 text-emerald-300" />
                ) : (
                  <Layers className="h-5 w-5 text-purple-300" />
                )}
                <h1 className="text-xl font-bold text-white">
                  {demoTab === "content" ? "Smart Content Demo" : "Smart Templates Demo"}
                </h1>
              </div>
              <Tabs value={demoTab} onValueChange={(value) => setDemoTab(value as "content" | "templates")}>
                <TabsList className="bg-white/5 p-1">
                  <TabsTrigger value="content" className="px-3">Smart Content (Registry)</TabsTrigger>
                  <TabsTrigger value="templates" className="px-3">Liquid UI Templates (Registry)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <p className="text-sm text-slate-400">
              Payer: <span className="text-blue-400">{PAYER_AGENT.name}</span> → 
              Recipient: <span className="text-green-400">{RECIPIENT_AGENT.name}</span>
            </p>
          </div>
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 ring-1 ring-purple-500/30 text-white/90 hover:from-purple-500/30 hover:to-fuchsia-500/30 transition-colors"
          >
            <Wallet className="w-5 h-5 text-purple-400" />
            <span className="font-medium">{PAYER_AGENT.name}</span>
          </button>
        </div>
      </header>

      {demoTab === "content" && (
        <>
          {/* Hero Full (100vh) */}
          <section>
            <SmartContentCard
              content={DEMO_CONTENTS[0]}
              variant="hero"
              heroHeight="full"
              onSelect={handleContentSelect}
              onPurchase={handlePurchase}
              onAddToLibrary={handleAddToLibrary}
            />
          </section>

          <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
            {/* LIVE CONTENT FROM DATABASE */}
            {liveContent.length > 0 && (
              <section className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-purple-500/10 ring-1 ring-emerald-500/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-lg font-semibold text-emerald-400">Live Content from Database ({liveContent.length})</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveContent.map((content) => (
                    <SmartContentCard
                      key={content.id}
                      content={content}
                      variant="standard"
                      onSelect={handleContentSelect}
                      onPurchase={handlePurchase}
                      onAddToLibrary={handleAddToLibrary}
                    />
                  ))}
                </div>
              </section>
            )}

            {loadingLive && (
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 text-center">
                <div className="w-8 h-8 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-slate-400">Loading live content...</p>
              </section>
            )}

        {/* Hero Short (66vh) */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Hero Short (66vh)</h2>
          <SmartContentCard
            content={DEMO_CONTENTS[1]}
            variant="hero"
            heroHeight="short"
            onSelect={handleContentSelect}
            onPurchase={handlePurchase}
            onAddToLibrary={handleAddToLibrary}
          />
        </section>

        {/* Poster3 - 3 per row, tall portrait (SS5) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">poster3 - Portrait Cards (3/row)</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-slate-400 hover:text-white">‹</button>
              <button className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-slate-400 hover:text-white">›</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {DEMO_CONTENTS.map((content, i) => (
              <SmartContentCard
                key={content.id}
                content={content}
                variant="poster3"
                isLimited={i === 0}
                showProgress={i === 2}
                progressPercentage={i === 2 ? 65 : 0}
                onSelect={handleContentSelect}
              />
            ))}
          </div>
        </section>

        {/* Poster2 - 2 per row, large posters (SS3 top) */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">poster2 - Large Posters (2/row)</h2>
          <div className="grid grid-cols-2 gap-6">
            <SmartContentCard
              content={DEMO_CONTENTS[0]}
              variant="poster2"
              onSelect={handleContentSelect}
            />
            <SmartContentCard
              content={DEMO_CONTENTS[1]}
              variant="poster2"
              onSelect={handleContentSelect}
            />
          </div>
        </section>

        {/* Carousel3 - 3.25 per row with description (SS2) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">carousel3 - News Cards (3.25/row)</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-slate-400 hover:text-white">‹</button>
              <button className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-slate-400 hover:text-white">›</button>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...DEMO_CONTENTS, DEMO_CONTENTS[0]].map((content, i) => (
              <div key={`${content.id}-${i}`} className="flex-shrink-0 w-[calc(25%-12px)]">
                <SmartContentCard
                  content={content}
                  variant="carousel3"
                  onSelect={handleContentSelect}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Carousel4 - 4 per row, narrow thumbnails (SS1 bottom) */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">carousel4 - Narrow Thumbnails (4/row)</h2>
          <div className="grid grid-cols-4 gap-4">
            {[...DEMO_CONTENTS, DEMO_CONTENTS[0]].slice(0, 4).map((content, i) => (
              <SmartContentCard
                key={`${content.id}-c4-${i}`}
                content={content}
                variant="carousel4"
                onSelect={handleContentSelect}
              />
            ))}
          </div>
        </section>

        {/* Thumbnail6 - 6+ per row, small squares (SS3 bottom) */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">thumbnail6 - Small Squares (6+/row)</h2>
          <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
            {[...DEMO_CONTENTS, ...DEMO_CONTENTS, ...DEMO_CONTENTS].slice(0, 8).map((content, i) => (
              <SmartContentCard
                key={`${content.id}-t6-${i}`}
                content={content}
                variant="thumbnail6"
                onSelect={handleContentSelect}
              />
            ))}
          </div>
        </section>

        {/* ThumbnailRect - 6+ per row, short rectangles */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">thumbnailRect - Short Rectangles (6+/row)</h2>
          <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
            {[...DEMO_CONTENTS, ...DEMO_CONTENTS, ...DEMO_CONTENTS].slice(0, 8).map((content, i) => (
              <SmartContentCard
                key={`${content.id}-tr-${i}`}
                content={content}
                variant="thumbnailRect"
                onSelect={handleContentSelect}
              />
            ))}
          </div>
        </section>

        {/* Compound variants - full, 2-col, 1-col */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">compound - Full Width</h2>
          <SmartContentCard
            content={DEMO_CONTENTS[2]}
            variant="compound"
            codeSnippet={`to: 'did:qiri:recipient',
amount: 100, // Q¢
memo: 'Payment for services'
});`}
            compoundLinks={[
              { label: "Documentation", icon: "Full API reference" },
              { label: "GitHub Repos", icon: "Open source examples" },
              { label: "Discord", icon: "Developer community" },
              { label: "Video Tutorials", icon: "Step-by-step guides" },
            ]}
            onSelect={handleContentSelect}
          />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">compound2 & compound1 - Column Width Variants (3/row)</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <SmartContentCard
              content={DEMO_CONTENTS[0]}
              variant="compound1"
              compoundLinks={[
                { label: "Docs", icon: "API reference" },
                { label: "GitHub", icon: "Source code" },
              ]}
              onSelect={handleContentSelect}
            />
            <SmartContentCard
              content={DEMO_CONTENTS[1]}
              variant="compound1"
              compoundLinks={[
                { label: "Watch", icon: "Video tutorial" },
                { label: "Read", icon: "Documentation" },
              ]}
              onSelect={handleContentSelect}
            />
            <SmartContentCard
              content={DEMO_CONTENTS[2]}
              variant="compound1"
              compoundLinks={[
                { label: "Learn", icon: "Tutorial" },
                { label: "Try", icon: "Demo" },
              ]}
              onSelect={handleContentSelect}
            />
          </div>
        </section>

        {/* Iframe variants for D-id avatars - 1-col, 2-col, full-row */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">iframe - D-id Avatar Embeds (1-col, 2-col, full)</h2>
          <div className="space-y-4">
            {/* Row 1: 1-col iframe + 2-col contentWide (cinematic) */}
            <div className="grid grid-cols-3 gap-4">
              <SmartContentCard
                content={DEMO_CONTENTS[0]}
                variant="iframe"
                iframeWidth="col1"
                iframeHeight="short"
                onSelect={handleContentSelect}
              />
              <div className="col-span-2">
                <SmartContentCard
                  content={DEMO_CONTENTS[1]}
                  variant="contentWide"
                  onSelect={handleContentSelect}
                />
              </div>
            </div>
            {/* Row 2: 2-col iframe + 1-col iframe */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <SmartContentCard
                  content={DEMO_CONTENTS[1]}
                  variant="iframe"
                  iframeWidth="col2"
                  iframeHeight="short"
                  onSelect={handleContentSelect}
                />
              </div>
              <SmartContentCard
                content={DEMO_CONTENTS[2]}
                variant="iframe"
                iframeWidth="col1"
                iframeHeight="short"
                onSelect={handleContentSelect}
              />
            </div>
            {/* Row 3: Full width */}
            <SmartContentCard
              content={DEMO_CONTENTS[2]}
              variant="iframe"
              iframeWidth="full"
              iframeHeight="short"
              onSelect={handleContentSelect}
            />
          </div>
        </section>

        {/* Featured Content */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">featured - Large Cards (2/row)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <SmartContentCard
              content={DEMO_CONTENTS[0]}
              variant="featured"
              onSelect={handleContentSelect}
              onPurchase={handlePurchase}
              onAddToLibrary={handleAddToLibrary}
            />
            <SmartContentCard
              content={DEMO_CONTENTS[1]}
              variant="featured"
              onSelect={handleContentSelect}
              onPurchase={handlePurchase}
              onAddToLibrary={handleAddToLibrary}
            />
          </div>
        </section>

        {/* Standard Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">standard - Grid Cards (3/row)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_CONTENTS.map((content) => (
              <SmartContentCard
                key={content.id}
                content={content}
                variant="standard"
                onSelect={handleContentSelect}
                onPurchase={handlePurchase}
                onAddToLibrary={handleAddToLibrary}
                isOwned={content.id === "demo-agentiq-tutorial"}
              />
            ))}
          </div>
        </section>

        {/* Compact Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">compact - List Rows</h2>
          <div className="max-w-md space-y-2">
            {DEMO_CONTENTS.map((content) => (
              <SmartContentCard
                key={content.id}
                content={content}
                variant="compact"
                showProgress
                progressPercentage={content.id === "demo-metaknyts-ep1" ? 33 : content.id === "demo-agentiq-tutorial" ? 100 : 0}
                onSelect={handleContentSelect}
              />
            ))}
          </div>
        </section>

        {/* ==================== MOBILE VARIANTS ==================== */}
        <div className="pt-8 border-t border-white/10">
          <h2 className="text-xl font-bold text-fuchsia-400 mb-6">📱 Mobile Variants (iPhone 16 Proportions)</h2>
        </div>

        {/* iPhone Wireframe Component */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Mobile Cards in iPhone Wireframes (3/row)</h2>
          <div className="grid grid-cols-3 gap-6">
            {/* iPhone 1: mobileHero */}
            <div className="relative">
              {/* iPhone frame */}
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                {/* Dynamic Island */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                {/* Screen */}
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  {/* Status bar */}
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="px-3 pb-3">
                    <SmartContentCard
                      content={DEMO_CONTENTS[0]}
                      variant="mobileHero"
                      onSelect={handleContentSelect}
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">mobileHero</p>
            </div>

            {/* iPhone 2: mobileFeatured */}
            <div className="relative">
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <SmartContentCard
                      content={DEMO_CONTENTS[1]}
                      variant="mobileFeatured"
                      onSelect={handleContentSelect}
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">mobileFeatured</p>
            </div>

            {/* iPhone 3: mobileSplit */}
            <div className="relative">
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <SmartContentCard
                      content={DEMO_CONTENTS[2]}
                      variant="mobileSplit"
                      onSelect={handleContentSelect}
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">mobileSplit</p>
            </div>
          </div>
        </section>

        {/* Second row of iPhones */}
        <section className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* iPhone 4: mobileCard */}
            <div className="relative">
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="px-3 pb-3 space-y-3">
                    <SmartContentCard
                      content={DEMO_CONTENTS[0]}
                      variant="mobileCard"
                      onSelect={handleContentSelect}
                    />
                    <SmartContentCard
                      content={DEMO_CONTENTS[1]}
                      variant="mobileCard"
                      onSelect={handleContentSelect}
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">mobileCard</p>
            </div>

            {/* iPhone 5: mobileThumb carousel */}
            <div className="relative">
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    {/* Hero at top */}
                    <div className="mb-3">
                      <SmartContentCard
                        content={DEMO_CONTENTS[0]}
                        variant="mobileHero"
                        onSelect={handleContentSelect}
                      />
                    </div>
                    {/* Thumbnail carousel - 2.25 visible */}
                    <div className="flex gap-2 overflow-hidden">
                      {[...DEMO_CONTENTS, DEMO_CONTENTS[0]].slice(0, 3).map((content, i) => (
                        <div key={`thumb-${i}`} className="flex-shrink-0" style={{ width: 'calc((100% - 8px) / 2.25)' }}>
                          <SmartContentCard
                            content={content}
                            variant="mobileThumb"
                            onSelect={handleContentSelect}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">mobileThumb (2.25 visible)</p>
            </div>

            {/* iPhone 6: Combined view */}
            <div className="relative">
              <div className="rounded-[2.5rem] bg-slate-800 p-2 ring-1 ring-white/20">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                <div className="rounded-[2rem] bg-slate-900 overflow-hidden aspect-[393/852]">
                  <div className="h-10 flex items-center justify-between px-6 text-[10px] text-white">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                  <div className="px-3 pb-3 space-y-3">
                    <SmartContentCard
                      content={DEMO_CONTENTS[1]}
                      variant="mobileFeatured"
                      onSelect={handleContentSelect}
                    />
                    {/* Thumbnail row */}
                    <div className="flex gap-2 overflow-hidden">
                      {DEMO_CONTENTS.slice(0, 2).map((content, i) => (
                        <div key={`thumb2-${i}`} className="flex-shrink-0" style={{ width: 'calc((100% - 8px) / 2.25)' }}>
                          <SmartContentCard
                            content={content}
                            variant="mobileThumb"
                            onSelect={handleContentSelect}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">Combined Layout</p>
            </div>
          </div>
        </section>

        {/* Component Info */}
        <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Component Overview</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <LayoutGrid className="w-8 h-8 mb-2 text-purple-400" />
              <h3 className="font-medium text-white">SmartContentCard</h3>
              <p className="text-white/60 mt-1">20 variants for all layout needs</p>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <Layers className="w-8 h-8 mb-2 text-blue-400" />
              <h3 className="font-medium text-white">ContentViewer</h3>
              <p className="text-white/60 mt-1">4 modalities: read, watch, listen, interact</p>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <BookOpen className="w-8 h-8 mb-2 text-emerald-400" />
              <h3 className="font-medium text-white">LibraryShelf</h3>
              <p className="text-white/60 mt-1">Filters, stats, favorites, shelves</p>
            </div>
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
              <Wallet className="w-8 h-8 mb-2 text-amber-400" />
              <h3 className="font-medium text-white">SmartWalletDrawer</h3>
              <p className="text-white/60 mt-1">Wallet, Library, Tasks, Rewards tabs</p>
            </div>
          </div>

          {/* Card Variants Reference */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-medium text-white mb-3">Desktop Variants (15)</h3>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 text-xs">
              <div className="rounded-lg bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30 p-2 text-center">
                <div className="font-medium text-fuchsia-300">hero</div>
                <div className="text-slate-500 mt-0.5">splash</div>
              </div>
              <div className="rounded-lg bg-purple-500/10 ring-1 ring-purple-500/30 p-2 text-center">
                <div className="font-medium text-purple-300">poster3</div>
                <div className="text-slate-500 mt-0.5">3/row</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 ring-1 ring-blue-500/30 p-2 text-center">
                <div className="font-medium text-blue-300">poster2</div>
                <div className="text-slate-500 mt-0.5">2/row</div>
              </div>
              <div className="rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 p-2 text-center">
                <div className="font-medium text-cyan-300">carousel3</div>
                <div className="text-slate-500 mt-0.5">3.25/row</div>
              </div>
              <div className="rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30 p-2 text-center">
                <div className="font-medium text-teal-300">carousel4</div>
                <div className="text-slate-500 mt-0.5">4/row</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 p-2 text-center">
                <div className="font-medium text-emerald-300">thumbnail6</div>
                <div className="text-slate-500 mt-0.5">6+/row</div>
              </div>
              <div className="rounded-lg bg-green-500/10 ring-1 ring-green-500/30 p-2 text-center">
                <div className="font-medium text-green-300">thumbRect</div>
                <div className="text-slate-500 mt-0.5">6+/row</div>
              </div>
              <div className="rounded-lg bg-lime-500/10 ring-1 ring-lime-500/30 p-2 text-center">
                <div className="font-medium text-lime-300">compound</div>
                <div className="text-slate-500 mt-0.5">full</div>
              </div>
              <div className="rounded-lg bg-yellow-500/10 ring-1 ring-yellow-500/30 p-2 text-center">
                <div className="font-medium text-yellow-300">compound2</div>
                <div className="text-slate-500 mt-0.5">2-col</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 p-2 text-center">
                <div className="font-medium text-amber-300">compound1</div>
                <div className="text-slate-500 mt-0.5">1-col</div>
              </div>
              <div className="rounded-lg bg-orange-500/10 ring-1 ring-orange-500/30 p-2 text-center">
                <div className="font-medium text-orange-300">iframe</div>
                <div className="text-slate-500 mt-0.5">embed</div>
              </div>
              <div className="rounded-lg bg-red-500/10 ring-1 ring-red-500/30 p-2 text-center">
                <div className="font-medium text-red-300">featured</div>
                <div className="text-slate-500 mt-0.5">2/row</div>
              </div>
              <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 p-2 text-center">
                <div className="font-medium text-rose-300">standard</div>
                <div className="text-slate-500 mt-0.5">3/row</div>
              </div>
              <div className="rounded-lg bg-pink-500/10 ring-1 ring-pink-500/30 p-2 text-center">
                <div className="font-medium text-pink-300">compact</div>
                <div className="text-slate-500 mt-0.5">list</div>
              </div>
              <div className="rounded-lg bg-slate-500/10 ring-1 ring-slate-500/30 p-2 text-center">
                <div className="font-medium text-slate-300">contentWide</div>
                <div className="text-slate-500 mt-0.5">2-col</div>
              </div>
            </div>
            
            <h3 className="text-sm font-medium text-white mb-3 mt-4">📱 Mobile Variants (5)</h3>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="rounded-lg bg-violet-500/10 ring-1 ring-violet-500/30 p-2 text-center">
                <div className="font-medium text-violet-300">mobileHero</div>
                <div className="text-slate-500 mt-0.5">portrait</div>
              </div>
              <div className="rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/30 p-2 text-center">
                <div className="font-medium text-indigo-300">mobileFeat</div>
                <div className="text-slate-500 mt-0.5">featured</div>
              </div>
              <div className="rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30 p-2 text-center">
                <div className="font-medium text-sky-300">mobileSplit</div>
                <div className="text-slate-500 mt-0.5">split</div>
              </div>
              <div className="rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 p-2 text-center">
                <div className="font-medium text-cyan-300">mobileCard</div>
                <div className="text-slate-500 mt-0.5">card</div>
              </div>
              <div className="rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30 p-2 text-center">
                <div className="font-medium text-teal-300">mobileThumb</div>
                <div className="text-slate-500 mt-0.5">thumb</div>
              </div>
            </div>
          </div>
        </section>
      </main>
        </>
      )}

      {demoTab === "templates" && (
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-sm text-slate-400">Browse template families and preview device-specific layouts.</p>
              <div className="text-xs text-slate-500">
                {liquidTemplates.length} templates loaded
              </div>
            </div>

            {loadingLiquidTemplates ? (
              <div className="text-slate-400">Loading templates…</div>
            ) : liquidTemplates.length === 0 ? (
              <div className="text-slate-400">No Liquid UI templates found in registry.</div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Template Group</div>
                    <Select value={templateGroup} onValueChange={(value) => setTemplateGroup(value as "discovery" | "detail" | "utility")}>
                      <SelectTrigger className="bg-slate-950/60 border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discovery">Discovery</SelectItem>
                        <SelectItem value="detail">Detail</SelectItem>
                        <SelectItem value="utility">Utility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Template</div>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="bg-slate-950/60 border-slate-800">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesForGroup.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Device</div>
                    <DevicePreviewSwitcher
                      value={templateDeviceById[selectedTemplateId] || "mobile"}
                      onChange={(next) =>
                        setTemplateDeviceById((prev) => ({ ...prev, [selectedTemplateId]: next }))
                      }
                      className="bg-slate-950/60 border border-slate-800"
                    />
                  </div>
                </div>

                {selectedTemplateId && (() => {
                  const selectedTemplate = liquidTemplates.find((t) => t.id === selectedTemplateId);
                  if (!selectedTemplate) return null;
                  const liquidTemplateId = selectedTemplate.metaExtras?.find((kv) => kv.k === 'liquid_template_id')?.v;
                  const FallbackComponent = liquidTemplateRegistry['liquidui:reader_viewer_v1'];
                  const TemplateComponent = (liquidTemplateId && liquidTemplateRegistry[liquidTemplateId]) || FallbackComponent;
                  const device = templateDeviceById[selectedTemplate.id] || "mobile";
                  const templateContents = templateContentById[selectedTemplate.id] || contentPool;
                  const primaryContent = templateContents[0] || DEMO_CONTENTS[0];

                  return (
                    <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-slate-400">{liquidTemplateId || 'unknown-template'}</div>
                          <div className="text-white font-medium">{selectedTemplate.name}</div>
                          <div className="text-xs text-slate-500">{selectedTemplate.description}</div>
                        </div>
                        <button
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-500"
                          onClick={() =>
                            setTemplateSeedById((prev) => ({ ...prev, [selectedTemplate.id]: Date.now() }))
                          }
                        >
                          Refresh Modules
                        </button>
                      </div>

                      <div className="h-[520px]">
                        {TemplateComponent ? (
                          <PreviewFrame
                            key={`${selectedTemplate.id}-${device}-${templateSeedById[selectedTemplate.id] || 0}`}
                            defaultDevice={device}
                            showToolbar={false}
                            chromeless
                          >
                            <div className="min-h-[520px]">
                              <SmartTriadProvider initialContent={primaryContent}>
                                <TemplateComponent
                                  contentObjects={templateContents}
                                  device={device}
                                  contentObject={primaryContent}
                                  messages={[]}
                                  events={[]}
                                  lineItems={[]}
                                  listings={[]}
                                  columns={[]}
                                  points={[]}
                                  session={{ intent: "template-demo" }}
                                  document={{}}
                                  nodes={[]}
                                  project={{}}
                                  cells={[]}
                                  settings={{ device }}
                                />
                              </SmartTriadProvider>
                            </div>
                          </PreviewFrame>
                        ) : (
                          <div className="text-slate-400">Template component not registered.</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        </main>
      )}

      {/* Content Viewer Modal */}
      {viewerOpen && selectedContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewerOpen(false)} />
          <div className="relative w-full max-w-4xl h-[80vh]">
            <ContentViewer
              content={selectedContent}
              onClose={() => setViewerOpen(false)}
              onPanelPayment={handlePanelPayment}
              hasAccess={selectedContent.id === "demo-agentiq-tutorial"}
              accessScope={selectedContent.id === "demo-agentiq-tutorial" ? "full" : "panel"}
              unlockedPanels={unlockedPanels}
            />
          </div>
        </div>
      )}

      {/* Smart Wallet Drawer - Using AigentZ as payer */}
      <SmartWalletDrawer
        open={walletOpen}
        onClose={() => {
          setWalletOpen(false);
          setPurchaseContent(null);
        }}
        agent={{
          id: PAYER_AGENT.id,
          name: PAYER_AGENT.name,
          evmSepolia: PAYER_AGENT.walletAddresses.evmAddress as `0x${string}`,
          evmArb: PAYER_AGENT.walletAddresses.evmAddress as `0x${string}`,
          btcAddress: PAYER_AGENT.walletAddresses.btcAddress,
          fioHandle: PAYER_AGENT.fioId,
        }}
        personaId={walletState.personaContext.activePersonaId}
        walletNode={walletState}
        currentContent={purchaseContent || selectedContent || undefined}
        onContentSelect={handleContentSelect}
        onPurchaseComplete={handlePurchaseComplete}
        recipientAddress={RECIPIENT_AGENT.walletAddresses.evmAddress}
        onCreatePersona={() => setShowPersonaWizard(true)}
        onPersonaChange={handlePersonaChange}
        onTaskAction={handleTaskAction}
        onSubmitReputationClaim={handleSubmitReputationClaim}
        onOpenCopilot={() => console.log('Copilot opened - Smart Triad ready')}
      />

      {/* Persona Setup Wizard */}
      {showPersonaWizard && (
        <PersonaSetupWizard
          onComplete={(persona) => {
            setShowPersonaWizard(false);
          }}
          onCancel={() => setShowPersonaWizard(false)}
        />
      )}
    </div>
  );
}
