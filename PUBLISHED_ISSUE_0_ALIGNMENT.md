# Published Issue #0 Alignment Status

## ✅ Completed Updates

### 1. Domain Configuration (`src/config/domains.ts`)
**Updated to match published spec:**
- ✅ **3 Active Domains**: PennyDrops (Droplets), Scrolls (BookOpen), Kn0wdZ (Code2)
- ✅ **Hidden Domains**: Signals (Zap) - exists but filtered
- ✅ **Excluded**: StayBull - reserved for MoneyPenny franchise
- ✅ Type definition updated: `QriptopianDomain = 'pennydrops' | 'scrolls' | 'kn0wdz' | 'signals'`

### 2. CodexQube Metadata (`src/data/issue-0.ts`)
**Header section updated:**
- ✅ Description: "Stories from the Quantum-Ready Internet"
- ✅ Tags: `['genesis', 'qriptocent', 'scrolls', 'knowledge', 'aigentiq']`
- ✅ Editorial theme: "Q¢ use cases, Chronicles, and Knowledge"
- ✅ Documentation comments reflect published v1.0 structure

---

## 🔄 Pending: CodexQube Domains Array Replacement

### Current Structure (Prototype - 4 domains)
```typescript
domains: [
  { domainId: 'signals', ... },     // Hidden domain
  { domainId: 'mythos', ... },      // OLD - needs replacement
  { domainId: 'markets', ... },     // OLD - needs replacement
  { domainId: 'city', ... },        // OLD - needs replacement
]
```

### Required Structure (Published - 3 active + 1 hidden)
```typescript
domains: [
  // Domain 1: PennyDrops
  {
    domainId: 'pennydrops',
    title: 'Penny Drops',
    description: 'Q¢ use cases - fun, practical, irreverent',
    icon: 'Droplets',
    color: 'cyan',
    articles: [
      // Q¢ stories (retrieved from contentService section='pennydrops')
    ],
    config: {
      tabs: [{ id: 'stories', label: 'Stories' }]
    }
  },
  
  // Domain 2: Scrolls
  {
    domainId: 'scrolls',
    title: 'Scrolls',
    description: 'Chronicles from the Quantum-Ready Internet',
    icon: 'BookOpen',
    color: 'purple',
    articles: [
      // Articles with placement.tab = 'metaknyts' or 'synthsims'
    ],
    config: {
      tabs: [
        { id: 'metaknyts', label: 'metaKnyts' },
        { id: 'synthsims', label: 'The SynthSims' }
      ]
    }
  },
  
  // Domain 3: Kn0wdZ
  {
    domainId: 'kn0wdz',
    title: 'Kn0wdZ',
    description: 'Builder & Developer Knowledge - How It Works',
    icon: 'Code2',
    color: 'blue',
    articles: [
      // Articles with placement.tab = 'dev' | 'creative' | 'exec'
    ],
    config: {
      tabs: [
        { id: 'dev', label: 'Dev' },
        { id: 'creative', label: 'Creative' },
        { id: 'exec', label: 'Exec' }
      ]
    }
  },
  
  // Domain 4: Signals (HIDDEN - exists but not in nav)
  {
    domainId: 'signals',
    title: 'Signals',
    description: 'What\'s happening now',
    icon: 'Zap',
    color: 'yellow',
    articles: [ /* keep existing */ ],
    config: {
      hidden: true,
      tabs: [
        { id: 'current', label: 'Current' },
        { id: 'archive', label: 'Archive' }
      ]
    }
  }
]
```

---

## 📊 Content Sections Mapping

### From Admin Portal Spec to CodexQube Domains

| Admin Section | CodexQube Domain | Tabs | Status |
|--------------|------------------|------|--------|
| `pennydrops` | `pennydrops` | stories | ✅ Active |
| `scrolls` | `scrolls` | metaknyts, synthsims | ✅ Active |
| `21knowdz` | `kn0wdz` | dev, creative, exec | ✅ Active |
| `signals` | `signals` | current, archive | 🔒 Hidden |
| `staybull` | N/A | N/A | ❌ Excluded |
| `home-hero` | N/A | N/A | Home page only |
| `latest-news` | N/A | N/A | Home carousel |
| `second-hero` | N/A | N/A | Home bottom |

---

## 🎯 Content Retrieval Strategy

### For Thin Client CodexProvider

**Option A: Static CodexQube** (current approach)
```typescript
// Load pre-built issue-0.ts
import { issue0 } from './data/issue-0';
<CodexProvider initialCodex={issue0} source={{ type: 'local' }} />
```

**Option B: Dynamic from Content Service**
```typescript
// Fetch from contentService at runtime
const domains = await Promise.all([
  contentService.getContentBySection('pennydrops'),
  contentService.getContentBySection('scrolls'),
  contentService.getContentBySection('21knowdz'),
]);
// Transform to CodexQube structure
```

**Option C: Hybrid** (recommended for thin client)
```typescript
// Static structure + dynamic content URLs
// CodexQube provides structure
// Content fetched on-demand per article
```

---

## 🔧 Integration with Admin Portal

### Admin Portal Features to Wire into Codex

**1. Content Editor Integration**
```typescript
// In future: Codex Admin Component
interface CodexAdminProps {
  codexId: string;  // 'theqriptopian-issue-0'
  onUpdate: (codex: CodexQube) => Promise<void>;
  contentService: ContentService;
}
```

**2. Section Manager → Domain Sync**
- Each admin section manager edits content for a specific domain
- Changes in admin should sync to CodexQube structure
- Content status (draft/published) filters into Codex

**3. Access Rules from Admin**
```typescript
// Future: Admin UI for CodexAccessRules
interface AccessRulesEditor {
  free: boolean;
  price?: { amountQc, amountQct, ... };
  gates?: { minReputation, requiredQuests, ... };
}
```

---

## 📝 Drawer Component Alignment

### Current Drawer Components Need Updating

**Files to Update:**
1. ❌ `src/components/navigation/drawers/SignalsDrawer.tsx` (hidden, keep for admin)
2. ❌ `src/components/navigation/drawers/MythosDrawer.tsx` (DELETE or rename to PennyDropsDrawer)
3. ❌ `src/components/navigation/drawers/LogosDrawer.tsx` (DELETE or rename to Kn0wdZDrawer)
4. ❌ `src/components/navigation/drawers/MarketsDrawer.tsx` (DELETE)
5. ❌ `src/components/navigation/drawers/BuildersDrawer.tsx` (DELETE)
6. ❌ `src/components/navigation/drawers/CityDrawer.tsx` (DELETE)
7. ❌ `src/components/navigation/drawers/DispatchesDrawer.tsx` (DELETE)

**New Drawer Components Needed:**
1. ✅ `PennyDropsDrawer.tsx` - single "Stories" tab
2. ✅ `ScrollsDrawer.tsx` - tabs: metaKnyts, The SynthSims
3. ✅ `Kn0wdZDrawer.tsx` - tabs: Dev, Creative, Exec

---

## 🎨 Component Specs from Published App

### PennyDropsDrawer
```typescript
{
  title: "Penny Drops",
  subtitle: "Q¢ use cases - fun, practical, irreverent",
  columns: 3,
  tabs: [{ id: "stories", label: "Stories" }],
  layout: {
    desktop: {
      featureArea: "col-span-2",
      metaAvatarArea: "col-span-1 (placeholder)",
      thumbnailCarousel: "col-span-full, basis-1/4"
    },
    mobile: {
      metaAvatarSpace: "h-[calc(50vh-88px)]",
      thumbnailCarousel: "fixed bottom-0, basis-[43%]"
    }
  },
  features: {
    metaAvatarIntegration: true,
    modalityButtons: ["expand", "read", "watch", "listen", "link"],
    hoverActionMenu: true
  }
}
```

### ScrollsDrawer
```typescript
{
  title: "Scrolls",
  subtitle: "Chronicles from the Quantum-Ready Internet",
  columns: 2,
  tabs: [
    { id: "metaknyts", label: "metaKnyts" },
    { id: "synthsims", label: "The SynthSims" }
  ],
  layout: {
    desktop: {
      mainCarousel: "md:basis-1/2, large Kn0w1Viewer cards",
      paginationDots: "below carousel"
    },
    mobile: {
      heroImage: "h-[calc(100vh-180px)]",
      thumbnailCarousel: "fixed bottom-0, basis-[43%]"
    }
  },
  features: {
    mediaControls: ["replay", "next", "previous"],
    modalityButtons: ["expand", "read", "watch", "listen"]
  }
}
```

### Kn0wdZDrawer
```typescript
{
  title: "Kn0wdZ",
  subtitles: {
    dev: "Builder & Developer Knowledge - How It Works",
    creative: "Creative Storytelling & Visual Content",
    exec: "Impact Imperatives & Business Development"
  },
  columns: 3,
  tabs: [
    { id: "dev", label: "Dev" },
    { id: "creative", label: "Creative" },
    { id: "exec", label: "Exec" }
  ],
  layout: {
    desktop: {
      featureViewer: "md:col-span-1",
      contentArea: "md:col-span-2",
      thumbnailCarousel: "basis-1/4"
    },
    mobile: {
      heroImage: "h-[calc(100vh-180px)]",
      thumbnailCarousel: "fixed bottom-0, basis-[43%]"
    }
  },
  tabContent: {
    exec: {
      specialPanels: [
        { title: "Strategic Impact & Business Development", icon: "Building2" },
        { title: "Focus Areas", icon: "TrendingUp" }
      ]
    }
  }
}
```

---

## ⚠️ Breaking Changes Required

### Navigation Component Updates

**1. MoneyPennyNav.tsx**
```typescript
// BEFORE (prototype)
const domains = [
  { id: 'signals', icon: Zap, ... },
  { id: 'mythos', icon: BookOpen, ... },
  { id: 'logos', icon: Cog, ... },
  // ... 7 total
];

// AFTER (published)
const domains = [
  { id: 'pennydrops', icon: Droplets, label: 'Penny Drops' },
  { id: 'scrolls', icon: BookOpen, label: 'Scrolls' },
  { id: 'kn0wdz', icon: Code2, label: 'Kn0wdZ' },
];
```

**2. Layout.tsx**
```typescript
// BEFORE
<SignalsDrawer isOpen={activeDomain === 'signals'} .../>
<MythosDrawer isOpen={activeDomain === 'mythos'} .../>
<LogosDrawer isOpen={activeDomain === 'logos'} .../>
<MarketsDrawer isOpen={activeDomain === 'markets'} .../>
<BuildersDrawer isOpen={activeDomain === 'builders'} .../>
<CityDrawer isOpen={activeDomain === 'city'} .../>
<DispatchesDrawer isOpen={activeDomain === 'dispatches'} .../>

// AFTER
<PennyDropsDrawer isOpen={activeDomain === 'pennydrops'} .../>
<ScrollsDrawer isOpen={activeDomain === 'scrolls'} .../>
<Kn0wdZDrawer isOpen={activeDomain === 'kn0wdz'} .../>
```

---

## 🚀 Recommended Approach

### Phase 4.5 Completion Steps

1. **Create New Drawer Components** (3 files)
   - PennyDropsDrawer.tsx
   - ScrollsDrawer.tsx  
   - Kn0wdZDrawer.tsx

2. **Update Navigation**
   - MoneyPennyNav.tsx → filter to 3 active domains
   - MobileNav.tsx → filter to 3 active domains
   - Layout.tsx → wire 3 new drawers

3. **Update CodexQube Data**
   - Replace domains array in issue-0.ts
   - Match tab structures from spec
   - Add sample articles per domain

4. **Delete Old Drawers** (optional - can keep for reference)
   - Or move to `/archive` folder

5. **Build & Test**
   - Verify navigation shows 3 domains only
   - Verify drawers open with correct tabs
   - Verify CodexProvider loads correctly

---

## 📋 Sample Article Structure for Each Domain

### PennyDrops Article
```typescript
{
  qubeId: 'qube://theqriptopian/article/pennydrop-coffee-qc',
  title: 'Buying Coffee with Q¢',
  description: 'How quantum micropayments work in everyday life',
  tags: ['pennydrops', 'qc', 'microtransactions'],
  access: {
    free: true,
    rewards: { earnQc: 5 }
  },
  // ... read/watch/listen content
}
```

### Scrolls Article (metaKnyts)
```typescript
{
  qubeId: 'qube://theqriptopian/article/scroll-metaknyts-ep1',
  title: 'metaKnyts: Episode 1',
  description: 'The Awakening - A visual narrative',
  tags: ['scrolls', 'metaknyts', 'comic'],
  metadata: {
    tab: 'metaknyts',
    format: 'visual-narrative'
  },
  // ... comic/video content
}
```

### Kn0wdZ Article (Dev)
```typescript
{
  qubeId: 'qube://theqriptopian/article/knowdz-dev-smart-contracts',
  title: 'Building with iQubes',
  description: 'Developer guide to iQube protocol',
  tags: ['kn0wdz', 'dev', 'tutorial'],
  metadata: {
    tab: 'dev',
    difficulty: 'intermediate'
  },
  access: {
    free: true,
    gates: { requiredPersonaTags: ['developer'] }
  },
  // ... technical content
}
```

---

**Status**: Domain config updated ✅ | CodexQube domains pending 🔄 | New drawers pending 🔄  
**Next**: Create 3 new drawer components, update navigation, complete CodexQube data alignment  
**Date**: 2025-12-07
