# Multi-Codex System - Backward Compatibility Guide

## Overview

The multi-codex system has been designed to maintain **full backward compatibility** with existing Qriptopian Vite app integrations. This ensures that existing embeds, API endpoints, and Supabase hooks continue to work seamlessly.

## KNYT Codex - Backward Compatibility

### Existing Qriptopian Integration
The KNYT Codex maintains compatibility with the existing Qriptopian hooks and APIs:

#### Scrolls Tab
- **Component**: `ScrollsTab`
- **API Endpoint**: `/api/admin/codex/status?series=metaKnyts`
- **Compatible Hook**: `useCodexEpisodes()` from `@theqriptopian-web/src/hooks/useCodexData.ts`
- **Data Structure**: Episodes with cover images, motion masters, print variants
- **Auto-Drive Integration**: ✅ Fully integrated with existing IPFS/Auto-Drive CIDs

#### Characters Tab
- **Component**: `CharactersTab`
- **API Endpoint**: `/api/codex/knyt-cards`
- **Compatible Hook**: `useCodexCharacters()` from `@theqriptopian-web/src/hooks/useCodexData.ts`
- **Data Structure**: Character cards with front/back CIDs, rarity, episode numbers
- **Auto-Drive Integration**: ✅ Fully integrated with existing character card system

#### Lore Tab
- **Component**: `LoreTab`
- **API Endpoint**: `/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`
- **Compatible Hook**: `useCodexLore()` from `@theqriptopian-web/src/hooks/useCodexData.ts`
- **Data Structure**: Lore assets with Auto-Drive CIDs, display modes, extracted text
- **Auto-Drive Integration**: ✅ Fully integrated with existing lore document system

### Implementation Details
```typescript
// KNYT Codex tabs configuration
tabs: [
  {
    id: 'scrolls',
    type: 'static',
    config: {
      component: 'ScrollsTab',
      apiEndpoint: '/api/admin/codex/status?series=metaKnyts'
    }
  },
  {
    id: 'characters',
    type: 'static',
    config: {
      component: 'CharactersTab',
      apiEndpoint: '/api/codex/knyt-cards'
    }
  },
  {
    id: 'lore',
    type: 'static',
    config: {
      component: 'LoreTab',
      apiEndpoint: '/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept'
    }
  }
]
```

## Qripto Codex - Backward Compatibility

### Features Tab - Qriptopian Home Content Integration
The Features tab integrates **all content from The Qriptopian home page**, maintaining full compatibility with the existing Supabase content structure.

#### Content Sections Integrated

##### 1. Hero Articles (Top 3 Featured)
- **API Endpoint**: `/api/content/section/home-hero`
- **Compatible Hook**: `useLiquidUIContent('home-hero')`
- **Display**: 3-column grid with cover images, titles, excerpts, author, date
- **Content**: Main featured articles from home page hero section

##### 2. Latest News (News Carousel)
- **API Endpoint**: `/api/content/section/latest-news`
- **Compatible Hook**: `useLiquidUIContent('latest-news')`
- **Display**: 2-column grid with thumbnails, compact layout
- **Content**: News carousel articles from home page

##### 3. Second Hero (Bottom Featured)
- **API Endpoint**: `/api/content/section/second-hero`
- **Compatible Hook**: `useLiquidUIContent('second-hero')`
- **Display**: Large featured story with side-by-side image/content
- **Content**: Bottom featured article from home page

#### Component Implementation
```typescript
// FeaturesTab.tsx - Fetches all Qriptopian home content
export function FeaturesTab({ theme }: FeaturesTabProps) {
  const [heroArticles, setHeroArticles] = useState<ContentItem[]>([]);
  const [latestNews, setLatestNews] = useState<ContentItem[]>([]);
  const [secondHero, setSecondHero] = useState<ContentItem | null>(null);

  useEffect(() => {
    // Fetch from existing Qriptopian APIs
    fetch('/api/content/section/home-hero');
    fetch('/api/content/section/latest-news');
    fetch('/api/content/section/second-hero');
  }, []);
}
```

### Other Qripto Codex Tabs

#### PennyDrops Tab
- **API Endpoint**: `/api/content/section/pennydrops`
- **Compatible Hook**: `useLiquidUIContent('pennydrops')`
- **Content**: MoneyPenny financial insights and wisdom

#### Scrolls Tab
- **API Endpoint**: `/api/content/section/scrolls`
- **Compatible Hook**: `useLiquidUIContent('scrolls')`
- **Content**: Qriptopian scrolls and archives

#### Kn0wdZ Tab
- **API Endpoint**: `/api/content/section/21knowdz`
- **Compatible Hook**: `useLiquidUIContent('21knowdz')`
- **Content**: Developer, creative, and executive knowledge resources

## Supabase Integration

All codex tabs maintain compatibility with the existing Supabase schema:

### Content Tables
- `content` - Main content items with metadata
- `content_placements` - Section and tab assignments
- `content_modalities` - Multi-modal content support

### API Routes (Existing)
- `/api/content/section/{section}` - Fetch content by section
- `/api/content/assets` - Fetch lore and asset content
- `/api/admin/codex/status` - Fetch episode/scroll status
- `/api/codex/knyt-cards` - Fetch character cards

### New API Routes (Multi-Codex)
- `/api/codex/registry` - List all codexes
- `/api/codex/registry/{codexId}` - Get codex configuration
- `/api/codex/registry/{codexId}/tabs` - List codex tabs

## Embed Routes

### Backward Compatible Routes
```
# Default KNYT Codex (maintains existing behavior)
/triad/embed/codex
/triad/embed/codex?tab=scrolls&theme=dark

# New Multi-Codex Routes
/triad/embed/codex/knyt
/triad/embed/codex/qripto
/triad/embed/codex/aigentiq
```

### Query Parameters (Maintained)
- `tab` - Initial tab to display
- `theme` - light | dark
- `density` - narrow | wide
- `personaId` - User persona context

## Testing Backward Compatibility

### KNYT Codex Tests
```bash
# Test existing Qriptopian hooks work
curl http://localhost:3000/api/admin/codex/status?series=metaKnyts
curl http://localhost:3000/api/codex/knyt-cards
curl http://localhost:3000/api/content/assets?kinds=background_lore_doc

# Test KNYT embed (should work as before)
curl http://localhost:3000/triad/embed/codex
curl http://localhost:3000/triad/embed/codex/knyt
```

### Qripto Codex Tests
```bash
# Test Qriptopian home content APIs
curl http://localhost:3000/api/content/section/home-hero
curl http://localhost:3000/api/content/section/latest-news
curl http://localhost:3000/api/content/section/second-hero

# Test Qripto embed with Features tab
curl http://localhost:3000/triad/embed/codex/qripto?tab=features
```

## Migration Path

### For Existing Qriptopian Embeds
1. **No changes required** - existing embeds continue to work
2. Default `/triad/embed/codex` routes to KNYT Codex
3. All existing query parameters supported

### For New Implementations
1. Use new multi-codex routes: `/triad/embed/codex/{codexSlug}`
2. Leverage codex registry API for dynamic codex discovery
3. Build admin UI for codex management

## Auto-Drive Integration

Both KNYT and Qripto codexes maintain full integration with Auto-Drive:

### KNYT Codex Auto-Drive
- Episode cover images via IPFS CIDs
- Motion master videos via IPFS CIDs
- Print variant images via IPFS CIDs
- Character card front/back via IPFS CIDs
- Lore documents via IPFS CIDs

### Qripto Codex Auto-Drive
- Article cover images from Supabase
- Content assets from Supabase
- Future: Direct IPFS integration for Qriptopian content

## Liquid UI Compatibility

The multi-codex system maintains full compatibility with the Liquid UI system:

### Liquid UI Tabs
- Codex tabs can be `type: 'liquid-ui'`
- Uses existing Liquid UI templates and data sources
- Compatible with `useLiquidUIContent()` hook
- Supports dynamic content rendering

### Example Configuration
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

## Summary

✅ **KNYT Codex**: Fully backward compatible with existing Qriptopian hooks and APIs
✅ **Qripto Codex**: Integrates all Qriptopian home content (hero, news, second hero)
✅ **Supabase**: All existing content APIs and hooks continue to work
✅ **Auto-Drive**: Full IPFS/Auto-Drive integration maintained
✅ **Liquid UI**: Compatible with existing Liquid UI system
✅ **Embeds**: Existing embed URLs continue to work without changes

The multi-codex system extends functionality while maintaining **100% backward compatibility** with existing Qriptopian implementations.
