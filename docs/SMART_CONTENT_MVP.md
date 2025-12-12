# Smart Content + Smart Menu + Smart Wallet MVP

## Overview

This document describes the Smart Content system implementation for metaKnyts and Qriptopian applications. The system follows a **Particle-Wave-Field-Node** architecture:

| Concept | Implementation |
|---------|----------------|
| **Particle** | `SmartContentQube` — self-aware content objects |
| **Wave** | `RelationshipQube` — connections between content and personas |
| **Field** | DIDQube + RQH + RewardHub + x402 + DVN |
| **Node** | `SmartWalletNode` — context-aware wallet |

## Files Created

### Type Definitions

| File | Description |
|------|-------------|
| `types/smartContent.ts` | SmartContentQube v0 schema with modalities, pricing, layout, rewards |
| `types/relationship.ts` | RelationshipQube for sequences, series, branches, persona relationships |
| `types/smartWallet.ts` | SmartWalletNode with persona context, balances, tasks, rewards |

### Database Migration

| File | Description |
|------|-------------|
| `docs/supabase-smartcontent.sql` | QubeBase migration for all smart content tables |

### Services

| File | Description |
|------|-------------|
| `services/content/smartContentService.ts` | CRUD, relationships, entitlements, pricing snapshots |
| `services/content/libraryService.ts` | User library, shelves, progress, recommendations |
| `services/content/storageAdapter.ts` | Storage abstraction (Supabase → IPFS/Autonomys) |
| `services/content/x402TemplateGenerator.ts` | Dynamic micropayment template generation |
| `services/content/smartMenuIntegration.ts` | Content-driven menu configuration |
| `services/content/index.ts` | Unified exports |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SMART CONTENT TRIAD                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ SmartContentQube│◄──►│   Smart Menu    │◄──►│Smart Wallet │ │
│  │   (Particle)    │    │   (Routing)     │    │   (Node)    │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
│           ▼                      ▼                     ▼        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    RelationshipQubes (Wave)                 ││
│  │         Sequences • Branches • Episodes • Series            ││
│  │                    Persona Relationships                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         FIELD LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ DIDQube  │  │   RQH    │  │RewardHub │  │      x402        ││
│  │ Identity │  │Reputation│  │ Rewards  │  │   Payments       ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATION                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Aigent Z Co-pilot (NL Compiler)                ││
│  │    NL → SmartContentQube → Smart Menu → Wallet Tasks        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## SmartContentQube v0 Schema

### Core Fields

```typescript
interface SmartContentQube {
  id: string;
  type: 'SmartContentQube';
  app: 'metaKnyts' | 'Qriptopian' | 'AgentiQ';
  title: string;
  slug: string;
  version: number;
  
  // Identity & Reputation
  identityRequirements: IdentityRequirements;
  reputationRequirements: ReputationRequirements;
  
  // Rewards (RewardHub integration)
  rewardOutcomes: RewardOutcomes;
  
  // Modalities
  modalities: {
    read: ReadModality;
    watch: WatchModality;
    listen: ListenModality;
    interact: InteractModality;
  };
  
  // Structure (Episode/Issue/Article/Series)
  structure?: ContentStructure;
  
  // Pricing (x402 integration)
  pricingModel: PricingModel;
  
  // Access
  accessPolicy: AccessPolicy;
  
  // Layout & Menu
  layoutHints: LayoutHints;
  menuIntegration: MenuIntegration;
  
  // Library
  libraryMetadata: LibraryMetadata;
}
```

### Modalities

| Modality | Description | Assets |
|----------|-------------|--------|
| **read** | Comics, articles, text | Panels, text assets |
| **watch** | Video content | Video assets, subtitles |
| **listen** | Audio, podcasts | Audio assets, transcripts |
| **interact** | Agent conversations | Agent IDs, tools |

### Content Structures

| Structure | Use Case | Key Fields |
|-----------|----------|------------|
| **episode** | Series content | seriesId, seasonNumber, position |
| **issue** | Publications | collectionId, section, issueNumber |
| **article** | Standalone/series articles | seriesId, headline, byline |
| **series** | Parent container | contentIds, status, totalPlanned |

### Pricing Models

| Kind | Description | Example |
|------|-------------|---------|
| `payPerPanel` | Per-panel micropayment | 5 QCT per panel |
| `payPerEpisode` | Episode purchase | 100 QCT per episode |
| `payPerStream` | Streaming access | 10 QCT per hour |
| `payPerArticle` | Article purchase | 50 QCT per article |
| `subscription` | Monthly access | 500 QCT/month |
| `bundle` | Series/collection bundle | 800 QCT for series |

## RelationshipQube Types

| Type | Description | Use Case |
|------|-------------|----------|
| `sequence` | Linear progression | Episode 1 → 2 → 3 |
| `branch` | Alternative paths | Choose your adventure |
| `series` | Parent-child grouping | Episodes in a series |
| `collection` | Thematic grouping | Curated collections |
| `reference` | Cross-reference | Related content |
| `prerequisite` | Required before access | Must complete X first |
| `questPath` | Journey progression | Quest steps |
| `playlist` | Curated sequence | User playlists |
| `persona` | Persona relationships | Creator, consumer, mentor |

## SmartWalletNode

Context-aware wallet that shows:

- **Persona Context**: Active persona, identity state, reputation
- **Balances**: QCT, QOYN, KNYT across chains
- **Entitlements**: Owned content, subscriptions, rentals
- **Content Context**: Current content, pricing snapshot, progress
- **Tasks**: Active tasks, quest progress
- **Rewards**: Recent rewards, pending distribution

## Database Tables

| Table | Description |
|-------|-------------|
| `smart_content_qubes` | Main content table |
| `relationship_qubes` | Content/persona relationships |
| `content_library` | User's library items |
| `content_entitlements` | Access grants |
| `content_progress` | Detailed progress tracking |
| `user_shelves` | Custom collections |
| `content_series` | Series metadata |
| `media_assets` | Storage references |

## Storage Abstraction

```typescript
// Current: Supabase Storage
const adapter = StorageAdapterFactory.getAdapter('supabase');

// Future: IPFS
const adapter = StorageAdapterFactory.getAdapter('ipfs');

// Future: Autonomys
const adapter = StorageAdapterFactory.getAdapter('autonomys');
```

## x402 Payment Templates

Templates are dynamically generated from `SmartContentQube.pricingModel`:

```typescript
const generator = getX402TemplateGenerator();

// Generate all templates for content
const templates = generator.generateTemplates(content);

// Generate panel-specific template
const panelTemplate = generator.generatePanelTemplate(content, panelIndex, totalPanels);

// Generate bundle template with discount
const bundleTemplate = generator.generateBundleTemplate(contents, 'Series Bundle', 20);
```

## Smart Menu Integration

Content drives menu configuration:

```typescript
const service = getSmartMenuIntegrationService();

// Generate manifest from content
const manifest = service.generateManifest(content, wallet, userPreferences);

// Manifest includes:
// - activeDrawers (based on content modalities)
// - walletMode (compact/full/hidden)
// - layout configuration
// - available actions
```

User preferences can override content defaults when `menuIntegration.allowUserOverrides` is true.

## Next Steps

### Phase 1: Database Setup
1. Run `docs/supabase-smartcontent.sql` in QubeBase
2. Create Supabase Storage bucket `content-assets`
3. Configure RLS policies for production

### Phase 2: API Routes
1. Create `/api/content/smart/[id]` routes
2. Create `/api/library/[personaId]` routes
3. Create `/api/content/pricing/[id]` routes

### Phase 3: UI Components
1. Content viewer component (read/watch/listen/interact)
2. Library shelf component
3. Smart wallet drawer enhancements
4. Pricing/purchase modal

### Phase 4: Copilot Integration
1. Add `smartcontent_create_from_nl` action
2. Add `smartcontent_update_pricing` action
3. Add `wallet_create_task` action

### Phase 5: metaKnyts MVP
1. Create sample micro-episode (6 panels)
2. Wire Kn0w1 + MoneyPenny + Nakamoto agents
3. Implement panel-level micropayments
4. Test complete flow

### Phase 6: Qriptopian MVP
1. Create sample article
2. Implement article/issue pricing
3. Test complete flow

## Styling Guidelines

- Follow x402 wallet CSS patterns (`styles/drawer.css`)
- Use Qriptopian drawer compositions for content cards
- Support iFrame embedding where configured
- Responsive layouts: stack (mobile), grid (tablet), split (desktop)

## Integration Points

| System | Integration |
|--------|-------------|
| **DIDQube** | Identity requirements, persona context |
| **RQH** | Reputation requirements, bucket checks |
| **RewardHub** | Engagement rewards, creator royalties |
| **x402** | Payment templates, micropayments |
| **DVN** | Cross-chain payment verification |
| **Smart Menu** | Content-driven drawer configuration |
