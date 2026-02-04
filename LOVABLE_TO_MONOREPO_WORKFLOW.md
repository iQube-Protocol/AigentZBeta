# Lovable to Monorepo Porting Workflow

**Version**: 0.1 - Design Brief Workflow  
**Date**: December 7, 2025  
**Purpose**: Establish Lovable as frontend staging environment for The Qriptopian

---

## Architecture Philosophy

```
DESIGN ENVIRONMENT (Lovable)
    ├── UI/UX experimentation
    ├── Component styling and layouts
    ├── Animation and interaction design
    └── Quick iteration with Lovable AI
    
                    ↓ PORT ↓
                    
PRODUCTION ENVIRONMENT (Monorepo)
    ├── Integration with @agentiq/* packages
    ├── CodexQube data consumption
    ├── QubeBase database connections
    ├── Production build and deployment
```

**Key Principle**: Lovable = Design Staging, Monorepo = Production Source of Truth

---

## Phase 1: Initial Replication (Dry Run)

### Objective
Port the current Lovable Qriptopian design v0.1 to the monorepo to establish the workflow.

### Step 1: Export from Lovable

**In Lovable Project** (`iQube-Protocol/qriptopian`, `alpha` branch):

1. **Identify all changed files**:
   ```bash
   # In Lovable, commit your current state
   git status
   git log --oneline -20  # Review recent changes
   ```

2. **List components to port**:
   - [ ] `src/components/Hero.tsx`
   - [ ] `src/components/Layout.tsx`
   - [ ] `src/components/Navigation.tsx`
   - [ ] `src/components/content/*.tsx`
   - [ ] `src/components/navigation/drawers/*.tsx`
   - [ ] `src/components/ui/*.tsx` (if modified)
   - [ ] `src/pages/*.tsx`
   - [ ] `src/index.css` (styling changes)
   - [ ] `tailwind.config.ts` (theme updates)

3. **Create export archive**:
   ```bash
   # On your local machine
   cd /path/to/lovable/qriptopian
   
   # Create component snapshot
   tar -czf qriptopian-design-v0.1.tar.gz \
     src/components/ \
     src/pages/ \
     src/index.css \
     tailwind.config.ts \
     src/assets/
   ```

### Step 2: Prepare Monorepo

**In Monorepo** (`/Users/hal1/CascadeProjects/AigentZBeta`):

1. **Create design import branch**:
   ```bash
   cd /Users/hal1/CascadeProjects/AigentZBeta
   git checkout dev
   git pull origin dev
   git checkout -b design/qriptopian-v0.1-import
   ```

2. **Backup current state**:
   ```bash
   cd apps/theqriptopian-web
   cp -r src/components src/components.backup
   ```

### Step 3: Port Components

**Manual Port Process** (recommended for precision):

For each component:

1. **Open side-by-side**:
   - Lovable version (source)
   - Monorepo version (destination)

2. **Identify differences**:
   - [ ] JSX structure changes
   - [ ] TailwindCSS class updates
   - [ ] New props or state
   - [ ] Animation additions
   - [ ] Responsive design improvements

3. **Port carefully**:
   - Copy UI/styling changes
   - Preserve package integrations
   - Keep hooks from monorepo (useCodex, useWallet, etc.)
   - Test after each component

4. **Critical preservation checklist**:
   ```typescript
   // ✅ KEEP THESE FROM MONOREPO:
   import { useCodex } from '@agentiq/codex';
   import { useWallet } from '@agentiq/smartwallet';
   import { useAvatar } from '@agentiq/avatar-host';
   import { ArticleReader } from '@agentiq/article-reader';
   
   // ✅ PORT THESE FROM LOVABLE:
   - className strings (TailwindCSS)
   - JSX structure and layout
   - Animation libraries (framer-motion, etc.)
   - New UI components
   ```

### Step 4: Systematic Component Port Order

**Priority 1 - Core Layout** (Port First):
1. `src/components/Layout.tsx` - Main layout structure
2. `src/components/Navigation.tsx` - Navigation wrapper
3. `src/components/navigation/IconBar.tsx` - Sidebar
4. `src/components/navigation/DrawerLayer.tsx` - Drawer container

**Priority 2 - Content Viewers**:
5. `src/components/content/MoneyPennyHero.tsx` - Hero section
6. `src/components/content/Kn0w1Viewer.tsx` - Content viewer
7. `src/components/content/HeroSection.tsx` - Secondary hero
8. `src/components/content/LatestNewsCarousel.tsx` - Carousel

**Priority 3 - Domain Drawers**:
9. `src/components/navigation/drawers/PennyDropsDrawer.tsx`
10. `src/components/navigation/drawers/ScrollsDrawer.tsx`
11. `src/components/navigation/drawers/Kn0wdZDrawer.tsx`

**Priority 4 - UI Polish**:
12. Update `src/index.css` - Global styles
13. Update `tailwind.config.ts` - Theme customization
14. Port any new UI primitives from `src/components/ui/`

### Step 5: Testing Checklist

After each component port:

```bash
cd apps/theqriptopian-web
pnpm dev
```

Test:
- [ ] Component renders without errors
- [ ] Styling matches Lovable design
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Package integrations still work (useCodex, etc.)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Animations smooth
- [ ] Navigation functional

### Step 6: Build Verification

```bash
cd apps/theqriptopian-web
pnpm build
```

Check:
- [ ] Build succeeds
- [ ] Bundle size reasonable (< 500 KB gzipped)
- [ ] No missing imports
- [ ] Production preview works (`pnpm preview`)

---

## Phase 2: Establish Ongoing Workflow

### Design Iteration Cycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DESIGN in Lovable                                         │
│    - Lovable AI helps with UI/UX                            │
│    - Quick iterations                                        │
│    - Visual polish                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. REVIEW Design Brief                                       │
│    - Screenshot/record Lovable version                      │
│    - Document changes in design brief                       │
│    - Get stakeholder approval                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PORT to Monorepo (You + Windsurf)                        │
│    - Create feature branch                                   │
│    - Port components systematically                         │
│    - Preserve package integrations                          │
│    - Test thoroughly                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. INTEGRATE & TEST                                          │
│    - Verify CodexQube data flows                            │
│    - Test QubeBase connections                              │
│    - Ensure package APIs work                               │
│    - Production build test                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. DEPLOY from Monorepo                                      │
│    - Merge to dev branch                                     │
│    - Deploy to staging                                       │
│    - Final QA                                                │
│    - Deploy to production                                    │
└─────────────────────────────────────────────────────────────┘
```

### Decision Matrix: Where to Make Changes

| Type of Change | Where? | Why? |
|----------------|--------|------|
| **New UI component** | Lovable → Port | Faster iteration with Lovable AI |
| **Styling updates** | Lovable → Port | Visual design is Lovable's strength |
| **Animation additions** | Lovable → Port | Quick prototyping |
| **Package integration** | Monorepo only | Packages not in Lovable |
| **Data fetching logic** | Monorepo only | QubeBase/Codex integration |
| **API client updates** | Monorepo only | @agentiq/agentiq-sdk |
| **Wallet features** | Monorepo only | @agentiq/smartwallet |
| **Content data** | Either | Port Issue data to Lovable for design context |

### When to Port

**Port after**:
- Design brief milestone (v0.1, v0.2, etc.)
- Stakeholder approval
- Lovable work reaches stable state
- Before production deployment

**Don't port**:
- Mid-experimentation
- Every tiny change
- Before design is settled

---

## Phase 3: Component Porting Template

### Template for Each Component Port

```markdown
## Component: [ComponentName]

**Source**: Lovable `src/components/[path]`
**Destination**: Monorepo `apps/theqriptopian-web/src/components/[path]`
**Design Brief**: v0.1

### Changes to Port:
- [ ] Updated className strings
- [ ] New JSX structure
- [ ] Added animations (framer-motion, etc.)
- [ ] Responsive breakpoint changes
- [ ] New props or state

### Monorepo-Specific Preservations:
- [ ] Package imports preserved
- [ ] useCodex hook intact
- [ ] useWallet integration maintained
- [ ] ArticleReader integration working

### Testing:
- [ ] Renders correctly
- [ ] No TypeScript errors
- [ ] Package integrations work
- [ ] Responsive design matches

### Notes:
[Any specific considerations or issues encountered]
```

---

## Phase 4: Automated Helpers

### Diff Tool Setup

Create a simple diff script:

```bash
#!/bin/bash
# File: scripts/lovable-diff.sh

LOVABLE_PATH="/path/to/lovable/qriptopian"
MONOREPO_PATH="/Users/hal1/CascadeProjects/AigentZBeta/apps/theqriptopian-web"

# Compare specific component
if [ -z "$1" ]; then
  echo "Usage: ./lovable-diff.sh <component-path>"
  exit 1
fi

diff -u "$MONOREPO_PATH/$1" "$LOVABLE_PATH/$1"
```

### Port Checklist Generator

```typescript
// scripts/generate-port-checklist.ts
// Generates a checklist of files that differ between Lovable and monorepo

import { execSync } from 'child_process';
import * as fs from 'fs';

const lovablePath = process.env.LOVABLE_PATH || '/path/to/lovable';
const monorepoPath = './apps/theqriptopian-web';

// Compare directories and generate port list
// [Implementation details]
```

---

## Phase 5: Content Strategy

### CodexQube Data in Both Environments

**Option A: Shared Source File**

Keep `issue-0.ts` in sync:
1. Maintain master in monorepo
2. Copy to Lovable when content updates
3. Lovable uses for design context

**Option B: API-Driven (Future)**

Lovable could fetch from QubeBase:
```typescript
// In Lovable (future enhancement)
const { data } = useQuery('issue-0', async () => {
  const response = await fetch('https://qubebase.io/api/codex/theqriptopian-issue-0');
  return response.json();
});
```

---

## Quick Reference

### Before Starting a Port

1. ✅ Lovable design is approved
2. ✅ Created feature branch in monorepo
3. ✅ Backed up current monorepo state
4. ✅ Have Lovable files accessible
5. ✅ Windsurf IDE open for precise editing

### During Port

1. ✅ Port one component at a time
2. ✅ Test after each component
3. ✅ Preserve package imports
4. ✅ Document any issues
5. ✅ Commit frequently

### After Port

1. ✅ Full build test
2. ✅ Visual comparison with Lovable
3. ✅ Integration tests pass
4. ✅ Code review (if team)
5. ✅ Merge to dev branch
6. ✅ Tag design version

---

## Current Task: Dry Run

Let's port the current Qriptopian v0.1 design:

**Next Steps**:
1. You provide access to the Lovable project files
2. I'll create a detailed port plan for each component
3. We'll port systematically, testing as we go
4. We'll document lessons learned for future ports

**How to Proceed**:
- Share the Lovable GitHub repo URL
- Or zip and share the `src/` folder from Lovable
- Or we can screen-share/pair on porting key components

---

This workflow will allow Lovable to be your design sandbox while keeping the monorepo as production truth!
