# Multi-Codex SmartTriad & Liquid UI Integration

## Overview

The multi-codex system maintains **full backward compatibility** with SmartTriad, Liquid UI, and smart actions while extending these capabilities to all codexes. This document details the integration architecture and ensures forward-facing functionality.

## SmartTriad Integration Architecture

### Core Components

#### 1. SmartContentActions
**Purpose**: Universal action buttons for content modalities (read, watch, listen, link, view, share)

**Integration Points**:
- All codex tab components support `ContentModalities` interface
- Actions are atomic and universal - determined by content, not context
- Global action handler via `SmartContentActionContext`

**Backward Compatibility**:
- Existing Qriptopian components continue to use `@agentiq/smarttriad` package
- New codex components use compatible modalities structure
- Same action types: `read`, `watch`, `listen`, `link`, `view`, `expand`, `share`

#### 2. SmartContentActionContext
**Purpose**: Global action handler preventing duplicate modal implementations

**Features**:
- Universal `executeAction()` method
- Factory `createHandler()` for component-specific handlers
- Global modals: VideoModal, ArticleReader, PDFPageViewer, SocialSharingModal

**Integration**:
```typescript
// Existing Qriptopian usage (maintained)
import { useSmartContentAction } from '@/contexts/SmartContentActionContext';
const { executeAction, createHandler } = useSmartContentAction();

// New codex usage (compatible)
const handleAction = (action: ActionType, item: ContentItem) => {
  executeAction(action, {
    id: item.id,
    title: item.title,
    modalities: item.modalities,
    // ... other fields
  });
};
```

### Content Modalities Structure

**Standard Interface** (backward compatible):
```typescript
interface ContentModalities {
  read?: {
    available?: boolean;
    text?: string;        // Article text content
    cid?: string;         // IPFS CID for PDF/document
  };
  watch?: {
    available?: boolean;
    video_url?: string;   // Video URL
    cid?: string;         // IPFS CID for video
    duration?: string;    // Display duration
  };
  listen?: {
    available?: boolean;
    audio_url?: string;   // Audio URL
    duration?: string;
  };
  link?: {
    available?: boolean;
    url?: string;         // External link
  };
  view?: {
    available?: boolean;
    image_url?: string;   // Image URL for lightbox
  };
}
```

## Liquid UI Integration

### Liquid UI Service Architecture

#### KnytLiquidUIService
**Purpose**: Template selection and screen composition based on user context

**Key Features**:
- Device-aware template selection (mobile, tablet, desktop)
- User intent recognition (browse, watch, read, character_deep_dive, etc.)
- Content mix analysis (episodes, characters, lore)
- Realm-based filtering (digiterra, terra)
- Task state integration (active, idle)

**Backward Compatibility**:
- Existing `CodexLiquidUITab` component maintained
- Template system continues to work with existing content
- New codexes can opt-in to Liquid UI via tab configuration

#### Template System

**Available Templates**:
1. `knyt:drawer_grid_v1` - Grid layout with drawer
2. `knyt:full_screen_v1` - Full-screen immersive view
3. `knyt:quest_focused_v1` - Quest/task-focused layout
4. `knyt:character_showcase_v1` - Character-focused layout

**Template Selection Context**:
```typescript
interface TemplateSelectionContext {
  userIntent: UserIntent;
  device: DeviceType;
  contentMix: ContentMix;
  realm?: Realm;
  taskState?: 'active' | 'idle';
  isFirstVisit?: boolean;
  personaId?: string;
}
```

### Liquid UI Tab Configuration

**Type**: `liquid-ui`
```typescript
{
  id: 'codex',
  type: 'liquid-ui',
  config: {
    liquidTemplate: 'qripto-codex-home',
    dataSource: '/api/codex/qripto/home'
  }
}
```

**Features**:
- Dynamic template rendering based on user context
- Content curation via Liquid UI service
- Automatic layout adaptation (mobile, tablet, desktop)
- Copilot integration (overlay, sidebar, fullscreen)

## Multi-Codex Integration Patterns

### Pattern 1: Static Tabs with SmartActions

**Use Case**: Traditional content display with smart actions

**Example**: KNYT Codex Scrolls Tab
```typescript
// ScrollsTab.tsx
export function ScrollsTab({ theme }: TabProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  
  // Fetch from existing API
  useEffect(() => {
    fetch('/api/admin/codex/status?series=metaKnyts')
      .then(res => res.json())
      .then(data => setEpisodes(data.episodes));
  }, []);
  
  // Transform to include modalities
  const episodesWithModalities = episodes.map(ep => ({
    ...ep,
    modalities: {
      read: { 
        available: !!ep.printRareCid,
        cid: ep.printRareCid 
      },
      watch: { 
        available: !!ep.motionMasterCid,
        cid: ep.motionMasterCid,
        duration: '~10 min'
      }
    }
  }));
  
  return (
    <div>
      {episodesWithModalities.map(episode => (
        <EpisodeCard 
          key={episode.id}
          episode={episode}
          modalities={episode.modalities}
        />
      ))}
    </div>
  );
}
```

### Pattern 2: Liquid UI Tabs

**Use Case**: Dynamic, context-aware content rendering

**Example**: KNYT Codex with Liquid UI
```typescript
// Configuration
{
  id: 'codex',
  type: 'liquid-ui',
  config: {
    liquidTemplate: 'knyt-codex-v1',
    dataSource: '/api/codex/knyt/content'
  }
}

// Component renders via KnytTemplateRenderer
<KnytTemplateRenderer
  templateId={templateResult.templateId}
  device={device}
  contentItems={curatedContent}
  userIntent={userIntent}
  copilotMode={copilotMode}
  onContentSelect={handleContentSelect}
/>
```

### Pattern 3: Hybrid Tabs (Qriptopian Home Content)

**Use Case**: Integrate existing Supabase content with SmartActions

**Example**: Qripto Codex Features Tab
```typescript
// FeaturesTab.tsx
export function FeaturesTab({ theme }: TabProps) {
  const [heroArticles, setHeroArticles] = useState<ContentItem[]>([]);
  
  // Fetch from existing Qriptopian APIs
  useEffect(() => {
    Promise.all([
      fetch('/api/content/section/home-hero'),
      fetch('/api/content/section/latest-news'),
      fetch('/api/content/section/second-hero')
    ]).then(([hero, news, second]) => {
      // Process and set content with modalities
    });
  }, []);
  
  // Content includes modalities from Supabase
  return (
    <div>
      {heroArticles.map(article => (
        <ArticleCard
          key={article.id}
          article={article}
          modalities={article.modalities}
        />
      ))}
    </div>
  );
}
```

## Backward Compatibility Matrix

### Existing Qriptopian Components

| Component | SmartTriad | Liquid UI | Status |
|-----------|-----------|-----------|--------|
| `HeroSection` | ✅ SmartContentActions | ✅ useLiquidUIContent | ✅ Working |
| `LatestNewsCarousel` | ✅ SmartContentActions | ✅ useLiquidUIContent | ✅ Working |
| `SecondHeroSection` | ✅ SmartContentActions | ✅ useLiquidUIContent | ✅ Working |
| `PennyDropsDrawer` | ✅ SmartContentActions | ✅ useLiquidUIContent | ✅ Working |
| `ScrollsDrawer` | ✅ SmartContentActions | ✅ useLiquidUIContent | ✅ Working |
| `CodexLiquidUITab` | ✅ Full integration | ✅ KnytLiquidUIService | ✅ Working |

### New Multi-Codex Components

| Component | SmartTriad | Liquid UI | Status |
|-----------|-----------|-----------|--------|
| `CodexPanelDynamic` | ✅ Modalities support | ✅ Tab type: liquid-ui | ✅ Implemented |
| `TabRenderer` | ✅ Component registry | ✅ Dynamic rendering | ✅ Implemented |
| `FeaturesTab` | ✅ Modalities structure | ✅ Content API integration | ✅ Implemented |
| `ScrollsTab` | ✅ Episode modalities | ⚠️ Static (can upgrade) | ✅ Implemented |
| `CharactersTab` | ✅ Character modalities | ⚠️ Static (can upgrade) | ✅ Implemented |

## API Integration Points

### Content APIs with Modalities

**Existing APIs** (maintain modalities):
```typescript
// /api/content/section/{section}
{
  content: [
    {
      id: "content:123",
      title: "Article Title",
      excerpt: "...",
      modalities: {
        read: { available: true, text: "..." },
        watch: { available: true, video_url: "..." }
      }
    }
  ]
}

// /api/admin/codex/status?series=metaKnyts
{
  episodes: [
    {
      episodeNumber: 1,
      printRareCid: "Qm...",
      motionMasterCid: "Qm...",
      // Transform to modalities in component
    }
  ]
}

// /api/codex/knyt-cards
{
  characters: [
    {
      id: "char_1",
      name: "Character Name",
      front_cid: "Qm...",
      back_cid: "Qm...",
      // Transform to modalities in component
    }
  ]
}
```

### New Codex Registry APIs

**Codex Configuration** (includes Liquid UI settings):
```typescript
// /api/codex/registry/{codexId}
{
  id: "knyt-codex",
  tabs: [
    {
      id: "codex",
      type: "liquid-ui",
      config: {
        liquidTemplate: "knyt-codex-v1",
        dataSource: "/api/codex/knyt/content"
      }
    }
  ],
  liquidUI: {
    enabled: true,
    templateId: "knyt-codex-v1"
  }
}
```

## Forward-Facing Enhancements

### 1. Universal Modalities Support
All new codex tabs support modalities structure, enabling:
- Consistent action buttons across all codexes
- Global modal management
- Content-driven behavior (not context-driven)

### 2. Liquid UI Extensibility
New codexes can leverage Liquid UI:
- Set tab `type: 'liquid-ui'`
- Specify `liquidTemplate` and `dataSource`
- Automatic template selection based on context
- Device-aware rendering

### 3. Smart Actions Evolution
Future enhancements maintain backward compatibility:
- New action types (e.g., `mint`, `trade`, `stake`)
- Enhanced modalities (e.g., `interact`, `play`)
- Richer metadata (e.g., `price`, `owned`, `locked`)

### 4. Copilot Integration
All codexes support Copilot modes:
- `overlay` - Floating copilot overlay
- `sidebar` - Side-by-side copilot
- `fullscreen` - Immersive copilot experience

## Migration Guide

### Upgrading Existing Components

**Step 1**: Add modalities to content items
```typescript
// Before
const episode = {
  id: "ep1",
  title: "Episode 1",
  printCid: "Qm..."
};

// After
const episode = {
  id: "ep1",
  title: "Episode 1",
  printCid: "Qm...",
  modalities: {
    read: { available: true, cid: "Qm..." }
  }
};
```

**Step 2**: Use SmartContentActions
```typescript
import { SmartContentActions } from '@agentiq/smarttriad';

<SmartContentActions
  modalities={episode.modalities}
  context="card"
  showExpand={false}
  onAction={handleAction}
/>
```

**Step 3**: Integrate global action handler
```typescript
import { useSmartContentAction } from '@/contexts/SmartContentActionContext';

const { createHandler } = useSmartContentAction();
const handleAction = createHandler(episode);
```

### Adding Liquid UI to Static Tabs

**Step 1**: Update tab configuration
```typescript
{
  id: "scrolls",
  type: "liquid-ui",  // Changed from "static"
  config: {
    liquidTemplate: "scrolls-grid-v1",
    dataSource: "/api/codex/knyt/scrolls"
  }
}
```

**Step 2**: Create Liquid UI template
```typescript
// Register template in KnytLiquidUIService
service.registerTemplate({
  id: "scrolls-grid-v1",
  regions: {
    main_grid: {
      layout: "grid",
      columns: 3,
      gap: 4
    }
  }
});
```

## Testing Backward Compatibility

### Test Suite

**1. SmartContentActions**
```bash
# Test existing Qriptopian components
- HeroSection with read/watch actions
- LatestNewsCarousel with read/link actions
- PennyDropsDrawer with read/watch actions
- ScrollsDrawer with read/watch actions
```

**2. Liquid UI**
```bash
# Test template selection
- CodexLiquidUITab with different devices
- Template switching based on user intent
- Content curation and filtering
- Copilot mode changes
```

**3. API Integration**
```bash
# Test content APIs return modalities
curl /api/content/section/home-hero
curl /api/content/section/latest-news
curl /api/admin/codex/status?series=metaKnyts
curl /api/codex/knyt-cards
```

**4. Multi-Codex**
```bash
# Test all codexes with SmartActions
- KNYT Codex: Scrolls, Characters, Lore tabs
- Qripto Codex: Features tab with home content
- AigentiQ Codex: Placeholder tabs
```

## Summary

✅ **SmartTriad**: Fully integrated with backward compatibility
✅ **Liquid UI**: Maintained for existing components, available for new codexes
✅ **Smart Actions**: Universal modalities structure across all codexes
✅ **Global Handlers**: SmartContentActionContext prevents duplicate implementations
✅ **Forward Compatible**: New action types and modalities can be added seamlessly
✅ **API Integration**: All existing APIs continue to work, new APIs support modalities
✅ **Qriptopian Components**: All existing components work without changes

The multi-codex system extends SmartTriad and Liquid UI capabilities while maintaining **100% backward compatibility** with existing Qriptopian implementations.
