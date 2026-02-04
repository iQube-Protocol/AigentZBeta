# MetaAvatar Persistence Pattern

## Overview

This document describes the global persistent MetaAvatar pattern implemented in The Qriptopian app. This pattern solves the problem of maintaining D-ID avatar iframe state across navigation and different UI containers.

## The Problem

The D-ID Agent SDK injects an iframe via a `<script>` tag. When the component hosting this script unmounts (e.g., navigating between drawers), the iframe is destroyed, causing:
- Loss of WebRTC connection
- Visible reconnection delays (2-5 seconds)
- Poor UX with "flashing" avatar

## The Solution: Global Singleton + CSS Positioning

We solve this by **never unmounting** the MetaAvatar component. Instead, we:
1. Render it once at the app root level (in `Layout.tsx`)
2. Use CSS transforms to position it wherever needed
3. Use context to coordinate who "owns" it at any given time

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Layout.tsx                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 MetaAvatarProvider                       │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │     LayoutContent                                │   │ │
│  │  │                                                  │   │ │
│  │  │  ┌──────────────────────┐                       │   │ │
│  │  │  │ Global MetaAvatar    │ ← NEVER UNMOUNTS     │   │ │
│  │  │  │ (fixed position)     │                       │   │ │
│  │  │  │                      │                       │   │ │
│  │  │  │ CSS classes change   │                       │   │ │
│  │  │  │ based on context     │                       │   │ │
│  │  │  └──────────────────────┘                       │   │ │
│  │  │                                                  │   │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │ │
│  │  │  │AigentDrawer│  │PennyDrops  │  │SmartWallet │ │   │ │
│  │  │  │ requests   │  │ requests   │  │ requests   │ │   │ │
│  │  │  │'immersive' │  │ 'sidebar'  │  │ 'copilot'  │ │   │ │
│  │  │  └────────────┘  └────────────┘  └────────────┘ │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## File Structure

| File | Purpose |
|------|---------|
| `src/contexts/MetaAvatarContext.tsx` | Global state: who owns the avatar |
| `src/components/metaVatar/MetaAvatar.tsx` | D-ID script injection + container |
| `src/components/Layout.tsx` | Renders avatar globally + CSS positioning |
| `src/components/navigation/drawers/AigentDrawer.tsx` | Requests avatar for "immersive" container |
| `src/components/navigation/drawers/PennyDropsDrawer.tsx` | Requests avatar for "sidebar" container |
| `src/components/wallet/SmartWalletDrawer.tsx` | Requests avatar for "copilot" container |

## Container Types

Generic container types that can be used across the estate:

| Container | Description | Use Case |
|-----------|-------------|----------|
| `immersive` | Full drawer/screen size | AigentDrawer, full-screen experiences |
| `sidebar` | 1/3 width, ~400px height | PennyDrops, article sidebars |
| `copilot` | Wallet copilot modal size | SmartWalletDrawer MoneyPenny mode |
| `mini` | Small floating pip (120x120) | Minimized state, notifications |
| `null` | Hidden (invisible but loaded) | When no container is active |

## Context API

```typescript
interface MetaAvatarContextType {
  /** Has the avatar been initialized (lazy loading) */
  avatarInitialized: boolean;
  
  /** Current container owning the avatar */
  activeContainer: MetaAvatarContainer;
  
  /** Current agent ID being displayed */
  activeAgent: string;
  
  /** Request avatar ownership for a container */
  requestAvatar: (container: MetaAvatarContainer, agentId?: string) => void;
  
  /** Release avatar ownership (with safety check) */
  releaseAvatar: (container?: MetaAvatarContainer) => void;
  
  /** Key to force avatar refresh/remount */
  avatarRefreshKey: number;
  
  /** Trigger avatar refresh */
  refreshAvatar: () => void;
  
  /** Set the active agent */
  setAgent: (agentId: string) => void;
}
```

## Usage Pattern

### In a Drawer Component

```tsx
import { useMetaAvatar } from "@/contexts/MetaAvatarContext";

function MyDrawer({ isOpen, onClose }) {
  const { requestAvatar, releaseAvatar } = useMetaAvatar();

  useEffect(() => {
    if (isOpen) {
      requestAvatar('sidebar', 'moneypenny');
    } else {
      releaseAvatar('sidebar');
    }
    
    return () => releaseAvatar('sidebar');
  }, [isOpen, requestAvatar, releaseAvatar]);

  return (
    <div>
      {/* Avatar renders globally, positioned via CSS */}
      <div className="avatar-placeholder" />
    </div>
  );
}
```

### Race Condition Safety

The `releaseAvatar` function includes a safety check:

```typescript
const releaseAvatar = (container?: MetaAvatarContainer) => {
  setActiveContainer(current => {
    // CRITICAL: Only release if YOU are the current owner
    if (container && current !== container) {
      console.log(`${container} tried to release, but ${current} is active - ignoring`);
      return current; // Don't change anything
    }
    return null;
  });
};
```

This prevents race conditions where Drawer A closes and tries to release, but Drawer B already took ownership.

## CSS Positioning

The avatar's position is controlled by CSS classes in `Layout.tsx`:

```typescript
const METAAVATAR_POSITION_CLASSES = {
  immersive: `
    block right-4 top-[96px] left-4 h-[calc(100vh-104px)]
    md:right-[80px] md:top-[172px] md:left-auto
    md:w-[calc(100vw-160px)] md:h-[calc(100vh-180px)]
    opacity-100 z-[100]
  `,
  sidebar: `
    block inset-x-0 top-[88px] h-[calc(50vh-88px)]
    md:right-[92px] md:top-[216px] md:left-auto md:inset-x-auto
    md:w-[calc((100vw-92px)/3-40px)] md:h-[400px]
    opacity-100 z-[100] md:rounded-lg overflow-hidden
  `,
  copilot: `
    block right-4 top-[200px]
    w-[calc(28rem-2rem)] h-[280px]
    opacity-100 z-[100] rounded-xl overflow-hidden
  `,
  mini: `
    block right-4 bottom-4
    w-[120px] h-[120px]
    opacity-100 z-[100] rounded-full overflow-hidden
  `,
  hidden: `
    opacity-0 pointer-events-none -z-10
  `,
};
```

## D-ID Integration

The `MetaAvatar` component handles D-ID SDK script injection:

```typescript
const script = document.createElement('script');
script.type = 'module';
script.src = 'https://agent.d-id.com/v2/index.js';
script.setAttribute('data-mode', 'full');
script.setAttribute('data-client-key', DID_CLIENT_KEY);
script.setAttribute('data-agent-id', DID_AGENT_ID);
script.setAttribute('data-target-id', containerId);
document.body.appendChild(script);
```

The `data-target-id` attribute tells the D-ID SDK which DOM element to inject the iframe into.

## Environment Variables

```bash
VITE_DID_CLIENT_KEY=your-client-key
VITE_DID_AGENT_ID=your-agent-id
```

## Refresh Mechanism

For cases where the D-ID SDK gets into a bad state:

```typescript
// In context
const refreshAvatar = () => {
  setAvatarRefreshKey(prev => prev + 1);
  window.dispatchEvent(new CustomEvent('metaAvatarRefresh'));
};

// In Layout - forces remount
<MetaAvatar key={avatarRefreshKey} />
```

## Summary

1. **SINGLETON RENDER**: MetaAvatar component rendered ONCE in Layout.tsx, never unmounts
2. **CONTEXT COORDINATION**: MetaAvatarContext tracks who owns the avatar
3. **CSS POSITIONING**: Fixed positioning with different classes per container type
4. **DRAWER INTEGRATION**: Drawers call `requestAvatar` on open, `releaseAvatar` on close
5. **MODAL AWARENESS**: Release avatar when modals/fullscreen open, re-request when they close

This pattern can be applied to any embedded third-party SDK that doesn't support dynamic repositioning.
