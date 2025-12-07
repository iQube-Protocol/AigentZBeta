# Phase 5: AvatarHost Package with Persistent Iframe - COMPLETE ✅

## Summary
Successfully extracted and genericized the metaAvatar interface into `@agentiq/avatar-host` package. Created a reusable, persistent agent interface system with global state management that works across all franchise applications.

---

## ✅ Completed Work

### 1. Created @agentiq/avatar-host Package

**Location**: `/packages/avatar-host/`

**Package Structure:**
```
packages/avatar-host/
├── package.json          # React package with peer deps
├── tsconfig.json         # TypeScript configuration
├── README.md             # Documentation
└── src/
    ├── index.ts          # Public API exports
    ├── types.ts          # TypeScript interfaces
    ├── AvatarContext.tsx # Global state provider
    └── AvatarHost.tsx    # Avatar UI component
```

### 2. Core Components Created

**AvatarContext.tsx** - Global State Management
- `AvatarProvider` - React context provider for global avatar state
- `useAvatar()` - Hook to access avatar from any component
- Persistent state with localStorage
- PostMessage API for iframe communication
- Multi-agent switching support

**AvatarHost.tsx** - UI Component
- Persistent iframe container
- Minimized/expanded states
- Customizable positioning (bottom-right, bottom-left, top-right, top-left)
- Smooth animations and transitions
- Loading states
- Message passing to/from iframe

**types.ts** - Type Definitions
```typescript
- AvatarPosition
- AvatarState ('minimized' | 'expanded' | 'fullscreen' | 'hidden')
- AgentConfig
- AvatarMessage
- AvatarContext
- AvatarHostProps
- AvatarContextValue
```

### 3. Key Features Implemented

**✅ Persistent State**
- Avatar state survives page navigation
- localStorage persistence across sessions
- Optional: can disable persistence per franchise

**✅ Global Availability**
- `useAvatar()` hook accessible from any component
- Send messages to agent from anywhere in app
- Control avatar state globally (toggle, open, close, minimize, expand)

**✅ Context-Aware**
- Franchise context (franchiseId, tenantId)
- Content context (domainId, articleId, tags)
- Persona integration
- Auto-updates iframe with context changes

**✅ Multi-Agent Support**
- Switch between agents dynamically
- Default agent configuration
- Agent-specific system prompts (via AgentiQ SDK)

**✅ iframe Communication**
- PostMessage API for secure cross-origin messaging
- Message types: agent-context, user-message, agent-response, state-change, action
- Bidirectional communication

**✅ Customizable UI**
- Position: 4 corner options
- Z-index control
- Custom iframe URL
- Minimized button with gradient styling
- Expanded drawer with controls

---

## 📊 Integration with The Qriptopian

### App.tsx Changes

**BEFORE:**
```typescript
<BrowserRouter>
  <Layout>
    <Index />
  </Layout>
</BrowserRouter>
```

**AFTER:**
```typescript
<AvatarProvider
  context={{
    franchiseId: 'theqriptopian',
    tenantId: 'main',
  }}
  enablePersistence={true}
>
  <BrowserRouter>
    <Layout>
      <Index />
    </Layout>
  </BrowserRouter>
  
  {/* Global persistent metaAvatar */}
  <AvatarHost
    position="bottom-right"
    defaultAgent="copilot"
    zIndex={10000}
  />
</AvatarProvider>
```

### Usage Example from Any Component

```typescript
import { useAvatar } from '@agentiq/avatar-host';

function ArticleCard({ article }) {
  const { sendMessage, toggle } = useAvatar();
  
  return (
    <button onClick={() => {
      sendMessage(`Analyze this article: ${article.title}`, {
        articleId: article.qubeId,
        domainId: 'scrolls',
        tags: article.tags,
      });
      toggle();
    }}>
      Ask Agent About This
    </button>
  );
}
```

---

## 🎯 API Reference

### AvatarProvider

```typescript
<AvatarProvider
  initialState="minimized"    // Starting state
  context={{                   // Global context
    franchiseId: string;
    tenantId: string;
    personaId?: string;
  }}
  enablePersistence={true}     // localStorage persistence
>
  {children}
</AvatarProvider>
```

### AvatarHost

```typescript
<AvatarHost
  position="bottom-right"           // Corner placement
  defaultAgent="copilot"            // Initial agent
  enablePersistence={true}          // Persist state
  initialState="minimized"          // Starting state
  iframeUrl="https://..."           // metaAvatar service URL
  context={contextObject}           // Override context
  onStateChange={(state) => {}}    // State change callback
  onMessage={(msg) => {}}          // Message callback
  zIndex={10000}                    // CSS z-index
/>
```

### useAvatar() Hook

```typescript
const {
  isOpen,            // boolean: is avatar expanded?
  state,             // AvatarState: current state
  currentAgent,      // string | null: active agent ID
  toggle,            // () => void: toggle minimized/expanded
  open,              // () => void: open (expand)
  close,             // () => void: close (minimize)
  minimize,          // () => void: minimize
  expand,            // () => void: expand
  sendMessage,       // (msg: string, context?) => void
  setAgent,          // (agentId: string) => void
  updateContext,     // (context: Partial<AvatarContext>) => void
} = useAvatar();
```

---

## 🔧 Technical Implementation Details

### PostMessage Communication Protocol

**From App → iframe:**
```typescript
{
  type: 'user-message' | 'agent-change' | 'context-update',
  payload: {
    message?: string,
    context?: AvatarContext,
    agent?: string,
    // ...
  },
  timestamp: number
}
```

**From iframe → App:**
```typescript
{
  type: 'state-change' | 'agent-response' | 'action',
  payload: {
    state?: 'minimize' | 'expand' | 'close',
    // ...
  },
  timestamp: number
}
```

### LocalStorage Schema

```json
{
  "avatar-state": {
    "state": "minimized" | "expanded" | "fullscreen" | "hidden",
    "agent": "copilot" | "nakamoto" | "know1" | "moneypenny"
  }
}
```

### iframe Security

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  allow="microphone; camera; clipboard-read; clipboard-write"
/>
```

---

## 📦 Package Dependencies

### Peer Dependencies
```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0"
}
```

### Dev Dependencies
```json
{
  "@types/react": "^18.0.0",
  "@types/react-dom": "^18.0.0",
  "typescript": "^5.0.0"
}
```

---

## 🚀 Migration Path for Other Franchises

### MoneyPenny Integration Example

```typescript
// app/moneypenny/App.tsx
import { AvatarProvider, AvatarHost } from '@agentiq/avatar-host';

function App() {
  return (
    <AvatarProvider
      context={{
        franchiseId: 'moneypenny',
        tenantId: 'default',
      }}
    >
      <MoneyPennyApp />
      <AvatarHost
        position="bottom-left"
        defaultAgent="moneypenny"
        iframeUrl="https://metavatar.moneypenny.ai/metaVatar.html"
      />
    </AvatarProvider>
  );
}
```

### KNOW1 Integration Example

```typescript
// app/know1/App.tsx
import { AvatarProvider, AvatarHost } from '@agentiq/avatar-host';

function App() {
  return (
    <AvatarProvider
      context={{
        franchiseId: 'know1',
        tenantId: 'research',
      }}
    >
      <Know1App />
      <AvatarHost
        position="top-right"
        defaultAgent="know1"
        enablePersistence={false}  // Disable for research mode
      />
    </AvatarProvider>
  );
}
```

---

## 🎨 UI States & Transitions

### Minimized State
- **Size**: 16x16 (4rem x 4rem)
- **Appearance**: Circular gradient button
- **Icon**: Chat bubble SVG
- **Hover**: Scale effect + shadow increase
- **Position**: Fixed at chosen corner

### Expanded State
- **Size**: 400x600px (mobile), 500x700px (desktop)
- **Appearance**: Rounded rectangle with shadow
- **Controls**: Minimize button (top-right)
- **Content**: iframe with metaAvatar service
- **Loading**: Spinner overlay while iframe loads

### Transition
- **Duration**: 300ms
- **Easing**: ease-in-out
- **Properties**: width, height, opacity

---

## 🔄 Comparison to Previous Implementation

### BEFORE (Prototype)
- `MetaVatarFrame.tsx` in app components
- Modal-based, not persistent
- State managed locally per component
- No global access
- Re-renders on navigation

### AFTER (Phase 5)
- `@agentiq/avatar-host` reusable package
- Persistent across navigation
- Global state with `useAvatar()` hook
- Accessible from anywhere
- Single iframe instance
- Franchise-agnostic

---

## 📊 Build Results

**Package Build:**
```
✓ TypeScript compiled successfully
✓ Types generated
✓ Exports configured
```

**App Build:**
```
✓ 3420 modules transformed
✓ Build time: 17.71s
✓ Bundle size: 922.27 KB (292.66 KB gzipped)
✓ avatar-host integrated successfully
```

**Bundle Impact:**
- BEFORE: 917.35 KB
- AFTER: 922.27 KB
- **Increase: +4.92 KB** (minimal overhead for global persistent avatar)

---

## 🆕 New Capabilities Unlocked

### 1. Context-Aware Agent Interactions
```typescript
// Agent knows what content user is viewing
const { updateContext } = useAvatar();

useEffect(() => {
  updateContext({
    currentPage: '/scrolls',
    contentContext: {
      domainId: 'scrolls',
      articleId: article.qubeId,
      tags: article.tags,
    },
  });
}, [article]);
```

### 2. Programmatic Agent Control
```typescript
// Open avatar and ask question from any component
function QuickHelp() {
  const { sendMessage, open } = useAvatar();
  
  return (
    <button onClick={() => {
      sendMessage('Explain this concept');
      open();
    }}>
      Quick Help
    </button>
  );
}
```

### 3. Multi-Agent Switching
```typescript
// Switch agents based on content domain
const { setAgent } = useAvatar();

useEffect(() => {
  const agentMap = {
    'pennydrops': 'moneypenny',
    'scrolls': 'know1',
    'kn0wdz': 'copilot',
  };
  
  setAgent(agentMap[currentDomain] || 'copilot');
}, [currentDomain]);
```

### 4. Persona Integration
```typescript
<AvatarProvider
  context={{
    franchiseId: 'theqriptopian',
    tenantId: 'main',
    personaId: user.selectedPersona?.id,  // Auto-syncs with iframe
  }}
>
```

---

## ⚠️ Known Considerations

### 1. iframe URL Configuration
Currently using placeholder URL:
```typescript
const DEFAULT_IFRAME_URL = 'https://metavatar.agentiq.ai/metaVatar.html';
```

**TODO:** Update with actual metaAvatar service endpoint per franchise

### 2. Security & Origin Validation
PostMessage handler should validate origin in production:
```typescript
const handleMessage = (event: MessageEvent) => {
  // TODO: Validate event.origin against whitelist
  if (!trustedOrigins.includes(event.origin)) return;
  // ...
};
```

### 3. Message Type Safety
Consider adding runtime validation for message types:
```typescript
import { z } from 'zod';

const AvatarMessageSchema = z.object({
  type: z.enum(['agent-context', 'user-message', ...]),
  payload: z.any(),
  timestamp: z.number(),
});
```

### 4. Inline Styles (Lint Warning)
Two intentional inline styles for dynamic props:
- Line 100: `style={{ zIndex }}` - allows runtime z-index control
- Line 115: `style={{ backgroundColor: 'transparent' }}` - iframe transparency

**Resolution:** These are necessary for prop-driven customization. Acceptable.

---

## 📝 Future Enhancements

### Phase 5.5+ Possibilities

**1. Voice Interface**
```typescript
<AvatarHost
  enableVoice={true}
  voiceConfig={{
    language: 'en-US',
    autoSpeak: true,
  }}
/>
```

**2. Notification System**
```typescript
const { notify } = useAvatar();

notify({
  message: 'New insight available',
  action: () => open(),
});
```

**3. Analytics Integration**
```typescript
<AvatarHost
  onMessage={(msg) => {
    analytics.track('avatar-interaction', {
      type: msg.type,
      agent: currentAgent,
    });
  }}
/>
```

**4. Offline Mode**
```typescript
<AvatarHost
  enableOffline={true}
  fallbackAgent="local-copilot"
/>
```

**5. Multi-Window Sync**
- Sync avatar state across browser tabs
- BroadcastChannel API for tab communication

---

## 🎉 Success Criteria Met

- [x] Extracted MetaVatarFrame logic into reusable package
- [x] Created global state management with React Context
- [x] Implemented persistent state with localStorage
- [x] Built customizable UI component with animations
- [x] Integrated with The Qriptopian app
- [x] PostMessage communication protocol
- [x] Multi-agent support
- [x] Context-aware agent interactions
- [x] useAvatar() hook for global access
- [x] TypeScript types and documentation
- [x] Build successful with minimal bundle impact
- [x] Franchise-agnostic design

---

## 🚀 Phase 5 Complete!

**Status**: ✅ AvatarHost package extracted and integrated  
**Package**: @agentiq/avatar-host v0.1.0  
**Build**: ✅ Successful (922.27 KB, +4.92 KB)  
**Integration**: ✅ Global persistent avatar in The Qriptopian  
**Reusability**: ✅ Ready for all franchises (MoneyPenny, KNOW1, etc.)  

**Major Achievement**: Created a reusable, persistent agent interface system that:
- Works across all franchises
- Maintains state across navigation
- Provides global access via hooks
- Enables context-aware agent interactions
- Supports multi-agent switching
- Minimizes bundle overhead

**Next Phase**: ArticleReader & Franchise Style Guide (Phase 5.5)

---

**Date**: 2025-12-07  
**Phases Complete**: 0, 1, 2, 3, 3.5, 4, 4.5, 5 (8/10)  
**Remaining**: 5.5 (ArticleReader), 6 (AgentiQ SDK), 7 (Documentation)
