# Instructions for Lovable: The Qriptopian UI/UX Refinement

## Overview

You are working on **The Qriptopian** thin client application which is part of the AgentiQ monorepo. All framework packages are ALREADY built and integrated. Your job is to enhance the UI/UX within defined boundaries.

## Repository Setup

### Clone the Monorepo

```bash
git clone [YOUR_GITHUB_REPO_URL]
cd AigentZBeta
pnpm install
```

### Navigate to Your Workspace

```bash
cd apps/theqriptopian-web
```

This is your primary working directory.

## Project Structure (What Exists)

```
AigentZBeta/
├── packages/                        # ❌ DO NOT MODIFY
│   ├── codex/                       # Content management layer
│   ├── smartwallet/                 # Blockchain wallet
│   ├── smarttriad/                  # Navigation system
│   ├── avatar-host/                 # Persistent metaAvatar
│   ├── article-reader/              # Markdown reader
│   └── agentiq-sdk/                 # AA-API client
│
└── apps/
    └── theqriptopian-web/           # ✅ YOUR WORKSPACE
        ├── src/
        │   ├── components/          # ✅ SAFE TO EDIT
        │   │   ├── navigation/      # Navigation UI (styling only)
        │   │   ├── content/         # Content viewers
        │   │   ├── wallet/          # Wallet UI (not core logic)
        │   │   └── ...
        │   ├── pages/               # ✅ SAFE TO EDIT
        │   ├── data/
        │   │   └── issue-0.ts       # ✅ SAFE TO EDIT (content data)
        │   ├── lib/                 # ⚠️ EDIT WITH CAUTION
        │   │   └── aigentiq-client.ts
        │   ├── config/              # ⚠️ EDIT WITH CAUTION
        │   └── App.tsx              # ⚠️ PROVIDER STACK - BE CAREFUL
        └── package.json             # ❌ DO NOT MODIFY DEPENDENCIES
```

## What You CAN Do ✅

### 1. Component Styling & Layout
**Location**: `src/components/**/*.tsx`

- Refine TailwindCSS classes
- Add animations and transitions
- Improve responsive design
- Enhance accessibility (ARIA labels, keyboard nav)
- Polish visual hierarchy
- Add loading states
- Improve error states

**Example**:
```tsx
// src/components/content/Kn0w1Viewer.tsx
// ✅ You can enhance this:
<div className="relative w-full h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
  {/* Add more sophisticated gradients, animations, etc. */}
</div>
```

### 2. Content Data
**Location**: `src/data/issue-0.ts`

- Update article content
- Add new sections
- Enhance metadata
- Improve descriptions

**Example**:
```typescript
// ✅ You can modify content like this:
export const pennyDropsSection: SectionQube = {
  id: 'section-pennydrops',
  title: 'Penny Drops', // ✅ Can change
  description: 'Q¢ use cases...', // ✅ Can enhance
  // ...
};
```

### 3. New Pages
**Location**: `src/pages/`

- Create new routes
- Add feature pages
- Build marketing pages
- Design onboarding flows

### 4. Drawer Content
**Location**: `src/components/navigation/drawers/`

- Enhance `PennyDropsDrawer.tsx`
- Polish `ScrollsDrawer.tsx`
- Refine `Kn0wdZDrawer.tsx`
- Add richer interactions within drawers

### 5. Hero Sections
**Location**: `src/components/content/MoneyPennyHero.tsx` etc.

- Improve hero animations
- Add interactive elements
- Enhance CTAs
- Better imagery/backgrounds

## What You CANNOT Do ❌

### 1. Package Modifications
**Location**: `/packages/**`

❌ Do NOT modify anything in the packages folder. These are shared across multiple franchises.

**Why**: Changes here would affect MoneyPenny, KNOW1, and future franchises.

### 2. Package Dependencies
**File**: `apps/theqriptopian-web/package.json`

❌ Do NOT add, remove, or change versions of `@agentiq/*` packages:
```json
// ❌ DO NOT MODIFY THESE:
"@agentiq/codex": "workspace:*",
"@agentiq/smartwallet": "workspace:*",
"@agentiq/smarttriad": "workspace:*",
"@agentiq/avatar-host": "workspace:*",
"@agentiq/article-reader": "workspace:*",
"@agentiq/agentiq-sdk": "workspace:*"
```

✅ You CAN add NEW dependencies for UI libraries:
```json
// ✅ SAFE to add:
"framer-motion": "^10.0.0",
"react-spring": "^9.0.0"
```

### 3. Provider Stack Structure
**File**: `src/App.tsx`

⚠️ Be VERY careful with provider nesting:
```tsx
// ❌ DO NOT change this order or remove providers:
<WalletProvider>
  <CodexProvider>
    <AvatarProvider>
      {/* Your content */}
    </AvatarProvider>
  </CodexProvider>
</WalletProvider>
```

✅ You CAN add NEW providers around the stack:
```tsx
// ✅ SAFE:
<MyThemeProvider>
  <WalletProvider>
    {/* ... */}
  </WalletProvider>
</MyThemeProvider>
```

### 4. Integration Logic
**Files**: `src/lib/*.ts`, `src/config/*.ts`

⚠️ These files wire the packages together. Only modify if you understand the integration model.

## Development Workflow

### Run Dev Server

```bash
cd apps/theqriptopian-web
pnpm dev
```

Open `http://localhost:5173`

### Build for Production

```bash
pnpm build
```

Should produce a `dist/` folder with optimized assets.

### Verify Everything Works

After your changes:

```bash
# From the root
pnpm -r build

# Then test the app
cd apps/theqriptopian-web
pnpm dev
```

**Checklist**:
- ✅ Navigation works (sidebar icons)
- ✅ Drawers slide out (PennyDrops, Scrolls, Kn0wdZ)
- ✅ Content displays correctly
- ✅ Article reader modal opens
- ✅ Avatar host appears (bottom-right)
- ✅ No console errors
- ✅ Build succeeds without warnings

## Package API Reference

### Using @agentiq/codex

```typescript
import { useCodex } from '@agentiq/codex';

const { codex, getArticle, getDomain } = useCodex();

// Get an article
const article = getArticle('article-id');

// Get a domain
const domain = getDomain('pennydrops');
```

### Using @agentiq/smartwallet

```typescript
import { useWallet } from '@agentiq/smartwallet';

const { 
  address, 
  isConnected, 
  personas,
  selectedPersona,
  connectWallet,
  selectPersona 
} = useWallet();
```

### Using @agentiq/avatar-host

```typescript
import { useAvatar } from '@agentiq/avatar-host';

const { 
  isOpen, 
  toggle, 
  sendMessage, 
  currentAgent 
} = useAvatar();

// Open avatar and send a message
sendMessage('Analyze this content');
```

### Using @agentiq/article-reader

```typescript
import { ArticleReader, theQriptopianStyleGuide } from '@agentiq/article-reader';

<ArticleReader
  article={article}
  isOpen={isReading}
  onClose={() => setIsReading(false)}
  styleGuide={theQriptopianStyleGuide}
/>
```

## Your Mission

### Primary Goals

1. **Polish the UI** - Make The Qriptopian visually stunning
2. **Enhance UX** - Smooth animations, intuitive interactions
3. **Improve Responsiveness** - Perfect on mobile, tablet, desktop
4. **Accessibility** - WCAG 2.1 AA compliance
5. **Performance** - Optimize images, lazy loading, code splitting

### Specific Tasks

- [ ] Refine drawer transitions and animations
- [ ] Enhance hero section with interactive elements
- [ ] Improve content card designs (Kn0w1Viewer, etc.)
- [ ] Add loading skeletons for async content
- [ ] Polish the reading experience (ArticleReader integration)
- [ ] Enhance mobile navigation
- [ ] Add micro-interactions (hover states, click feedback)
- [ ] Improve error states and empty states
- [ ] Optimize image loading and caching
- [ ] Add scroll animations and parallax effects

### Design System

**Colors**: Cyan/Teal theme (already defined in Tailwind config)
**Typography**: Modern, readable, hierarchical
**Spacing**: Consistent, generous white space
**Components**: Use existing Radix UI primitives
**Icons**: Lucide React (already imported)

## Getting Help

### Documentation Files

1. **PROJECT_COMPLETE.md** - Full project overview
2. **PUBLISHED_ISSUE_0_ALIGNMENT.md** - Domain structure details
3. **ARTICLE_READER_SPEC.md** - ArticleReader component spec

### Questions?

If you need to understand how a package works:
1. Read the package source in `/packages/[package-name]/src/`
2. Check the TypeScript types for APIs
3. Look at existing usage in the app

### Common Pitfalls

❌ **Don't do this**:
```typescript
// Creating custom context when one exists
const [wallet, setWallet] = useState();
```

✅ **Do this instead**:
```typescript
// Use the provided hook
const { wallet } = useWallet();
```

---

## Success Criteria

Your work is successful when:

✅ The app builds without errors  
✅ All existing functionality still works  
✅ UI/UX is noticeably improved  
✅ No regressions in core features  
✅ Mobile experience is excellent  
✅ Performance metrics are maintained or improved  

---

## Safety Checklist (Before Committing)

- [ ] Ran `pnpm build` successfully
- [ ] Tested all navigation paths
- [ ] Verified drawers open/close correctly
- [ ] Checked console for errors
- [ ] Tested on mobile viewport
- [ ] No modifications to `/packages/**`
- [ ] No dependency version changes for `@agentiq/*`
- [ ] Provider stack order unchanged

---

**Remember**: You're enhancing a fully-functional app. The framework is solid. Focus on making it beautiful and delightful to use! 🎨✨
