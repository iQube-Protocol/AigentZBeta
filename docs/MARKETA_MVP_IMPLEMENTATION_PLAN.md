# Aigent Marketa MVP Implementation Plan

## Executive Summary

**Marketa** is a sophisticated marketing orchestrator that will:
- Generate and deploy helix-consistent marketing content (Mythos + Logos)
- Run campaigns across owned and partner channels
- Coordinate incentives via $KNYT and Q¢ rewards
- Provide hyper-personalized marketing based on investment and engagement tiers
- Operate as an experience cartridge (experienceQube) deployable via Codex

## Architecture Overview

### Experience Cartridge Design

Marketa is designed as an **experienceQube** - a self-contained cartridge that can be deployed through the Codex system without requiring core AigentZ code modifications.

```
AigentZBeta/
├── codexes/
│   └── packs/
│       └── marketa/
│           ├── manifest.json          # Experience cartridge manifest
│           ├── components/            # Thin client React components
│           ├── pages/                # Lovable-generated UI pages
│           ├── services/             # API client services
│           ├── types/                # TypeScript definitions
│           └── assets/               # Static assets
├── app/api/marketa/                  # Backend API endpoints
└── lib/marketa/                      # Core business logic
```

### 1. Experience Cartridge Manifest

```json
{
  "id": "marketa-experience",
  "name": "Aigent Marketa - CMO Console",
  "version": "1.0.0",
  "type": "experienceQube",
  "category": "marketing",
  "description": "Chief Marketing Agent orchestrator for multi-channel campaigns and rewards",
  "author": "metaProof",
  "license": "proprietary",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "lucide-react": "^0.294.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0"
  },
  "apiEndpoints": [
    "/api/marketa/*"
  ],
  "permissions": [
    "marketa:read",
    "marketa:write",
    "marketa:publish",
    "marketa:rewards"
  ],
  "entryPoints": {
    "dashboard": "/marketa",
    "partners": "/marketa/partners",
    "campaigns": "/marketa/campaigns",
    "analytics": "/marketa/reports"
  },
  "thinClient": {
    "type": "lovable",
    "generatorUrl": "https://lovable.dev/generate/marketa-console",
    "buildOutput": "codexes/packs/marketa/components"
  }
}
```

### 2. Integration with Existing Orchestrator System

Marketa will be added as a new orchestrator in the existing Orchestrator submenu:

```typescript
// Updated Sidebar.tsx Orchestrator section
{
  label: "Orchestrator",
  icon: <Bot size={16} />,
  items: [
    { href: "/copilot", label: "Platform Copilot", icon: <Brain size={14} className="text-cyan-400" /> },
    { href: "/aigents/aigent-z", label: "Aigent Z (System AI)", icon: <Bot size={14} className="text-blue-400" /> },
    { href: "/aigents/aigent-moneypenny", label: "Aigent MoneyPenny", icon: <Bot size={14} className="text-purple-400" /> },
    { href: "/aigents/aigent-nakamoto", label: "Aigent Nakamoto", icon: <Bot size={14} className="text-orange-400" /> },
    { href: "/aigents/aigent-kn0w1", label: "Aigent Kn0w1", icon: <Bot size={14} className="text-green-400" /> },
    { href: "/marketa", label: "Aigent Marketa (CMO)", icon: <TrendingUp size={14} className="text-rose-400" /> },
  ],
}
```

### 3. Core Data Models (Supabase Schema)

```sql
-- Marketa namespace tables
CREATE SCHEMA IF NOT EXISTS marketa;

-- Core entities
CREATE TABLE marketa.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL,
  channels JSONB DEFAULT '[]',
  make_webhook_url TEXT,
  brand_constraints JSONB DEFAULT '{}',
  approval_contacts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- buffer, mailjet, discord, telegram, whatsapp, sms
  credentials JSONB NOT NULL,
  webhook_urls JSONB DEFAULT '[]',
  list_ids JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.audience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  wallet_address TEXT,
  persona_id TEXT,
  discord_id TEXT,
  telegram_id TEXT,
  whatsapp_id TEXT,
  investment_tier INTEGER DEFAULT 0, -- 0..4
  engagement_tier TEXT DEFAULT 'cold', -- cold|warm|active|advocate
  flags JSONB DEFAULT '{}', -- mythos_bias, logos_bias, builder_flag, partner_affinity
  consent JSONB DEFAULT '{}', -- email_opt_in, sms_opt_in, whatsapp_opt_in
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL, -- codex1, regcf, pre_fairlaunch, fairlaunch
  themes JSONB DEFAULT '[]',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  primary_cta TEXT,
  proof_points JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- owned_wpp, partner_wpp
  partner_id UUID REFERENCES marketa.partners(id),
  week_of DATE NOT NULL,
  phase TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, approved, sent
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.pack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID REFERENCES marketa.packs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- hero, short1, short2, short3, newsletter, community
  thread TEXT NOT NULL, -- mythos, logos, bridge, overlap
  mode TEXT NOT NULL, -- separate, bridge, overlap
  content JSONB NOT NULL,
  platform_variants JSONB DEFAULT '{}',
  utm_links JSONB DEFAULT '[]',
  assets JSONB DEFAULT '[]',
  cta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload_id TEXT NOT NULL,
  item_id UUID REFERENCES marketa.pack_items(id),
  platform TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, sent, delivered, failed
  post_url TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE TABLE marketa.reward_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- grant_knyt_deferred_mint, grant_qc_credit
  profile_id UUID REFERENCES marketa.audience_profiles(id),
  recipient_data JSONB NOT NULL, -- wallet, personaId, etc.
  amount DECIMAL(20,8) NOT NULL,
  network TEXT NOT NULL,
  reason TEXT NOT NULL,
  campaign_id UUID REFERENCES marketa.campaigns(id),
  status TEXT DEFAULT 'pending', -- pending, issued, failed
  transaction_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketa.crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES marketa.audience_profiles(id),
  event_type TEXT NOT NULL, -- sent, opened, clicked, purchased, activated, reward_issued
  campaign_id UUID REFERENCES marketa.campaigns(id),
  channel TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Views for optimized queries
CREATE VIEW marketa.v_profiles AS
SELECT 
  ap.*,
  p.persona_name,
  p.fio_handle,
  p.default_identity_state
FROM marketa.audience_profiles ap
LEFT JOIN personas p ON ap.persona_id = p.id;

-- RPC Functions
CREATE OR REPLACE FUNCTION marketa.segment_preview(filters JSONB)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Implementation for segment preview with counts and sample IDs
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'sample_ids', array_agg(id)[:10]
  ) INTO result
  FROM marketa.v_profiles ap
  WHERE ap.investment_tier = COALESCE((filters->>'valueTier')::INTEGER, ap.investment_tier)
    AND ap.engagement_tier = COALESCE(filters->>'engagementTier', ap.engagement_tier);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 4. API Endpoints Structure

```typescript
// /app/api/marketa/
├── packs/
│   ├── generate/
│   │   └── route.ts          // POST - Generate new pack
│   ├── [packId]/
│   │   ├── approve/
│   │   │   └── route.ts      // POST - Approve pack
│   │   ├── request-edits/
│   │   │   └── route.ts      // POST - Request edits
│   │   └── regenerate/
│   │       └── route.ts      // POST - Regenerate pack
├── publish/
│   └── route.ts              // POST - Publish pack
├── delivery-receipt/
│   └── route.ts              // POST - Handle delivery callbacks
├── segments/
│   └── preview/
│       └── route.ts          // POST - Preview segment
├── rewards/
│   └── issue/
│       └── route.ts          // POST - Issue rewards
├── crm/
│   └── event/
│       └── route.ts          // POST - Log CRM events
├── partners/
│   ├── route.ts              // GET/POST - List/create partners
│   └── [partnerId]/
│       └── route.ts          // GET/PUT/DELETE - Partner CRUD
└── campaigns/
    ├── route.ts              // GET/POST - List/create campaigns
    └── [campaignId]/
        └── route.ts          // GET/PUT/DELETE - Campaign CRUD
```

### 5. Helix Governance System

```typescript
// lib/marketa/helix.ts
export type ThreadType = 'mythos' | 'logos' | 'bridge' | 'overlap';
export type ModeType = 'separate' | 'bridge' | 'overlap';

export interface HelixConstraints {
  mythosAnchors: string[]; // Tech anchor words limit
  logosAnchors: string[];  // Mythos anchor words limit
  weeklyRatio: {           // Phase-based thread ratios
    codex1: { mythos: 60, logos: 40 };
    regcf: { mythos: 50, logos: 50 };
    pre_fairlaunch: { mythos: 40, logos: 60 };
    fairlaunch: { mythos: 30, logos: 70 };
  };
}

export class HelixGovernance {
  validateContent(thread: ThreadType, mode: ModeType, content: string): boolean {
    // Implementation for content validation
    return true;
  }
  
  enforceWeeklyRatio(phase: string, packs: PackItem[]): boolean {
    // Implementation for weekly ratio enforcement
    return true;
  }
  
  generateCTA(thread: ThreadType, campaign: Campaign): string {
    // Implementation for CTA generation
    return '';
  }
}
```

### 6. Personalization Engine

```typescript
// lib/marketa/personalization.ts
export interface PersonalizationRules {
  valueTier: number;        // 0..4 (follower to whale)
  engagementTier: string;   // cold|warm|active|advocate
  flags: {
    mythosBias: boolean;
    logosBias: boolean;
    builderFlag: boolean;
    partnerAffinity: string;
  };
}

export class PersonalizationEngine {
  selectNextMessage(profile: AudienceProfile, campaign: Campaign): MessageStrategy {
    // Implementation for next best message selection
    return {} as MessageStrategy;
  }
  
  generateVariants(baseContent: string, segments: PersonalizationRules[]): ContentVariant[] {
    // Implementation for content variant generation
    return [];
  }
  
  enforceFrequencyCaps(profile: AudienceProfile, channel: string): boolean {
    // Implementation for frequency cap enforcement
    return true;
  }
}
```

### 7. Publishing Adapters

```typescript
// lib/marketa/adapters/
export interface PublishingAdapter {
  publish(payload: MarketaPublishPayload): Promise<PublishResult>;
}

export class MakeWebhookAdapter implements PublishingAdapter {
  async publish(payload: MarketaPublishPayload): Promise<PublishResult> {
    // Buffer, WhatsApp, Telegram, SMS via Make.com
    return {} as PublishResult;
  }
}

export class MailjetAdapter implements PublishingAdapter {
  async publish(payload: MarketaPublishPayload): Promise<PublishResult> {
    // Direct email sending
    return {} as PublishResult;
  }
}

export class DiscordWebhookAdapter implements PublishingAdapter {
  async publish(payload: MarketaPublishPayload): Promise<PublishResult> {
    // Direct Discord posting
    return {} as PublishResult;
  }
}

export class PartnerMakeAdapter implements PublishingAdapter {
  async publish(payload: MarketaPublishPayload): Promise<PublishResult> {
    // Partner channel publishing
    return {} as PublishResult;
  }
}
```

### 8. Thin Client Console (Lovable Integration)

#### Lovable Prompt Template

```
Build a thin-client marketing console called "Marketa Console" as an experience cartridge.

Tech Stack:
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui components
- API calls to /api/marketa/* endpoints only
- No direct database access

Core Features:
1) Dashboard
- Current phase selector (codex1/regcf/pre_fairlaunch/fairlaunch)
- KPI tiles: Packs Pending, Approved, Sent, Rewards Issued
- Recent activity feed

2) Partners Management
- Partner list with webhook status
- Partner detail: edit brand constraints, channels, approval contacts
- Save via /api/marketa/partners endpoints

3) Campaign & Pack Generation
- Wizard: pack type, partner, phase, channels, week of
- Generate calls POST /api/marketa/packs/generate
- Pack list with status tracking
- Pack detail: edit items, approve, regenerate

4) Publishing Interface
- Select pack and targets (Make webhook, Mailjet, Discord, etc.)
- Dry run toggle
- Publish calls POST /api/marketa/publish
- Delivery results display

5) Audience Segments
- Builder: value tier, engagement tier, flags, consent
- Preview button calls POST /api/marketa/segments/preview
- Show counts and sample profiles

6) Reports & Analytics
- By partner/channel/campaign metrics
- Charts: sends, deliveries, clicks, activations, rewards
- Export functionality

Components to generate:
- Dashboard, PartnerForm, SegmentBuilder, PackWizard, PackEditor, PublishTargetPicker, AnalyticsCharts

Output Structure:
- codexes/packs/marketa/components/ (React components)
- codexes/packs/marketa/pages/ (Page components)
- codexes/packs/marketa/services/ (API client)
- codexes/packs/marketa/types/ (TypeScript types)

The console must be consumable as an experience cartridge that can be deployed via Codex without core code changes.
```

#### Experience Cartridge Structure

```
codexes/packs/marketa/
├── manifest.json                    # Cartridge manifest
├── components/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── KPIStats.tsx
│   │   └── ActivityFeed.tsx
│   ├── Partners/
│   │   ├── PartnerList.tsx
│   │   ├── PartnerForm.tsx
│   │   └── PartnerCard.tsx
│   ├── Campaigns/
│   │   ├── PackWizard.tsx
│   │   ├── PackList.tsx
│   │   ├── PackEditor.tsx
│   │   └── PackItemEditor.tsx
│   ├── Publishing/
│   │   ├── PublishInterface.tsx
│   │   ├── TargetPicker.tsx
│   │   └── DeliveryResults.tsx
│   ├── Segments/
│   │   ├── SegmentBuilder.tsx
│   │   ├── SegmentPreview.tsx
│   │   └── ProfileFilters.tsx
│   └── Reports/
│       ├── AnalyticsDashboard.tsx
│       ├── CampaignMetrics.tsx
│       └── PerformanceCharts.tsx
├── pages/
│   ├── page.tsx                     # Main dashboard
│   ├── partners/page.tsx
│   ├── campaigns/page.tsx
│   ├── publish/page.tsx
│   ├── segments/page.tsx
│   └── reports/page.tsx
├── services/
│   ├── marketaApi.ts               # API client
│   ├── types.ts                    # Shared types
│   └── utils.ts                    # Helper functions
└── assets/
    ├── icons/
    └── images/
```

### 9. Codex Integration

```typescript
// app/marketa/page.tsx - Experience cartridge entry point
import { ExperienceCartridge } from '@/components/codex/ExperienceCartridge';
import { MarketaDashboard } from '@/codexes/packs/marketa/components/Dashboard/Dashboard';

export default function MarketaPage() {
  return (
    <ExperienceCartridge 
      cartridgeId="marketa-experience"
      title="Aigent Marketa - CMO Console"
    >
      <MarketaDashboard />
    </ExperienceCartridge>
  );
}
```

### 10. Deployment as ExperienceQube

```typescript
// services/codex/marketaCartridgeService.ts
export class MarketaCartridgeService {
  async deployCartridge(): Promise<void> {
    // 1. Validate cartridge manifest
    // 2. Deploy API endpoints
    // 3. Register with Codex system
    // 4. Enable thin client access
  }
  
  async updateCartridge(version: string): Promise<void> {
    // Hot-swap cartridge components without core changes
  }
  
  async configurePermissions(permissions: string[]): Promise<void> {
    // Set up role-based access for Marketa features
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
1. **Database Setup**: Create Supabase schema and migrations
2. **API Layer**: Implement core CRUD endpoints
3. **Cartridge Structure**: Set up experience cartridge framework
4. **Basic UI**: Dashboard and Partners pages via Lovable

### Phase 2: Content Generation (Week 3-4)
1. **Helix Governance**: Implement content validation and rules
2. **Pack Generator**: Build content generation engine with templates
3. **Personalization**: Basic segmentation and variant generation
4. **Cartridge UI**: Pack management components

### Phase 3: Publishing System (Week 5-6)
1. **Adapters**: Implement Make.com, Mailjet, Discord adapters
2. **Publishing UI**: Campaign publishing interface
3. **Delivery Tracking**: Callback handling and logging
4. **Cartridge Updates**: Publishing interface components

### Phase 4: Rewards & Analytics (Week 7-8)
1. **Rewards Integration**: Connect to existing $KNYT and Q¢ systems
2. **CRM Events**: Comprehensive event logging
3. **Advanced Analytics**: Full reporting dashboard
4. **Cartridge Optimization**: Performance and UX improvements

## Key Technical Decisions

1. **Experience Cartridge Pattern**: Self-contained, deployable via Codex
2. **Thin Client Architecture**: Lovable-generated UI, API-only backend
3. **Supabase Integration**: Leverages existing QubeBase infrastructure
4. **Make.com-First Publishing**: Avoids Buffer API rebuilding issues
5. **Helix Governance**: Built-in content validation and brand consistency
6. **Modular Adapters**: Easy to add new publishing channels
7. **Hot-Swappable UI**: Update console without core code changes

## Lovable Integration Benefits

- **Rapid UI Development**: Generate console interface without coding
- **No Core Modifications**: Deploy updates via cartridge system
- **Consistent Design**: Use established component patterns
- **Easy Maintenance**: Update UI independently of backend
- **Version Control**: Track cartridge versions and rollbacks
- **Multi-Tenant Ready**: Deploy different console versions per partner

## Success Metrics

- **Cartridge Deployment**: Successful deployment via Codex system
- **Content Generation**: Can generate WPP for 3+ partners in one run
- **Multi-Channel Publishing**: Successful delivery to all target channels
- **Personalization**: 3+ content variants per segment
- **Rewards Integration**: $KNYT and Q¢ rewards functioning
- **Thin Client Adoption**: Full console interface operational via Lovable
- **Hot-Swap Capability**: UI updates without core code deployment

This architecture ensures Marketa can be developed, deployed, and maintained as an independent experience cartridge while leveraging the full power of the AigentZ ecosystem.
