/**
 * Demo Content API - Returns mock content for testing UI
 * 
 * GET /api/content/demo - Get demo content without database
 */

import { NextRequest, NextResponse } from 'next/server';

const DEMO_CONTENTS = [
  {
    id: "demo-penny-digital",
    type: "SmartContentQube",
    app: "metaKnyts",
    title: "The Penny Goes Digital",
    slug: "the-penny-goes-digital",
    version: 1,
    description: "A 6-panel micro-episode exploring the digitization of currency through the eyes of Money Penny.",
    coverImageUri: "/images/demo/penny-digital.jpg",
    creatorRootDid: "did:iq:creator1",
    tenantId: "metaknyts",
    modalities: {
      read: { enabled: true, panels: [], textAssets: [], primaryOn: ["mobile", "tablet"] },
      watch: { enabled: false },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: {
      kind: "episode",
      panelCount: 6,
      episodeNumber: 1,
    },
    pricingModel: {
      tiers: [
        { kind: "payPerPanel", amount: 10, currency: "QCT", covers: 1 },
        { kind: "payPerEpisode", amount: 50, currency: "QCT", covers: 6 },
      ],
      freePreview: { panels: [1] },
      acceptedTokens: ["QCT", "QOYN"],
    },
    status: "draft",
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-qripto-chronicles",
    type: "SmartContentQube",
    app: "Qriptopian",
    title: "The Qriptopian Chronicles: Issue #1",
    slug: "qriptopian-chronicles-1",
    version: 1,
    description: "The first issue of the Qriptopian Chronicles, exploring decentralized finance.",
    coverImageUri: "/images/demo/qripto-chronicles.jpg",
    creatorRootDid: "did:iq:creator2",
    tenantId: "qriptopian",
    modalities: {
      read: { enabled: true, panels: [], textAssets: [], primaryOn: ["desktop", "tablet"] },
      watch: { enabled: false },
      listen: { enabled: true },
      interact: { enabled: false },
    },
    structure: {
      kind: "issue",
      issueNumber: 1,
    },
    pricingModel: {
      tiers: [
        { kind: "payPerIssue", amount: 299, currency: "QOYN", covers: 1 },
        { kind: "subscription", amount: 999, currency: "QOYN", covers: 12 },
      ],
      freePreview: {},
      acceptedTokens: ["QOYN", "QCT"],
    },
    status: "published",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-agentiq-tutorial",
    type: "SmartContentQube",
    app: "AgentiQ",
    title: "Building Your First AI Agent",
    slug: "building-first-ai-agent",
    version: 1,
    description: "A comprehensive tutorial on creating your first AI agent with AgentiQ.",
    coverImageUri: "/images/demo/agentiq-tutorial.jpg",
    creatorRootDid: "did:iq:creator3",
    tenantId: "agentiq",
    modalities: {
      read: { enabled: true, panels: [], textAssets: [], primaryOn: ["desktop"] },
      watch: { enabled: true },
      listen: { enabled: false },
      interact: { enabled: true },
    },
    structure: {
      kind: "article",
    },
    pricingModel: {
      tiers: [
        { kind: "free", amount: 0, currency: "QCT", covers: 1 },
      ],
      freePreview: {},
      acceptedTokens: [],
    },
    status: "published",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const app = searchParams.get('app');
  const status = searchParams.get('status');
  
  let filtered = DEMO_CONTENTS;
  
  if (app) {
    filtered = filtered.filter(c => c.app === app);
  }
  
  if (status) {
    filtered = filtered.filter(c => c.status === status);
  }
  
  return NextResponse.json({
    success: true,
    data: filtered,
    total: filtered.length,
    source: "demo",
    message: "This is demo data. Run the SQL migration in Supabase to use real data.",
  });
}
