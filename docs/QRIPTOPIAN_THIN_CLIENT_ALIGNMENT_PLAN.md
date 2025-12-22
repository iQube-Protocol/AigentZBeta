# Qriptopian Thin Client Alignment Plan
## KNYT Codex → SmartTriad/LiquidUI/CopilotKit Model

**Date**: 2025-12-21  
**Status**: Analysis Complete - Implementation Plan Ready

---

## 🔍 Current State Analysis

### What's Working
✅ **Template System Exists**: 14 main stage + 9 wallet templates defined  
✅ **Template Selection Logic**: `KnytLiquidUIService.selectTemplate()` working  
✅ **Content Fetching**: Episodes, characters, lore loading from API  
✅ **AG-UI Hooks Integrated**: `useTemplateState()`, `useWalletState()`, `useContentState()`  
✅ **Basic Rendering**: `KnytTemplateRenderer` component functional

### What's Broken (Screenshot Evidence)

**Problem**: User asked "what are the characters of metaKNYTS" and got:
- ❌ Only 1 character shown ("The Emissary")
- ❌ Template: `knyt:dual_poster_stage_v1` (wrong - should be drawer grid)
- ❌ Intent: `character_deep_dive` (wrong - should be `browse`)
- ❌ Drawer: `none` (wrong - should show character grid)

**Root Causes Identified**:

1. **Client-Side Template Selection**: The thin client is making template decisions locally instead of consuming server-authoritative state from AG-UI
2. **No CopilotKit Integration**: The Codex isn't connected to the platform's CopilotKit agent for intent inference
3. **Local Content Curation**: Content bundling happens client-side instead of server-side via SmartTriadStateManager
4. **Copilot Context Not Used**: The `useCodexCopilot()` hook provides intent signals but they're not driving AG-UI state updates

---

## 🎯 Target Architecture: Thin Client Model

### SmartTriad State Flow

```
User Query: "what are the characters of metaKNYTS"
        ↓
┌───────────────────────────────────────────────────┐
│  Qriptopian Thin Client (Port 8080)               │
│  ┌─────────────────────────────────────────────┐  │
│  │  CodexCopilotLayer                          │  │
│  │  - User types query                         │  │
│  │  - Sends to platform via API                │  │
│  └─────────────────────────────────────────────┘  │
│                    ↓ HTTP POST                    │
└───────────────────┼───────────────────────────────┘
                    │
                    ↓
┌───────────────────┼───────────────────────────────┐
│  Aigent Z Platform (Port 3000)                    │
│  ┌─────────────────────────────────────────────┐  │
│  │  CopilotKit Agent                           │  │
│  │  - Receives: "what are the characters..."   │  │
│  │  - Infers: intent=browse, focus=characters  │  │
│  │  - Calls: ui_render_drawer_grid_auto        │  │
│  └─────────────────────────────────────────────┘  │
│                    ↓                              │
│  ┌─────────────────────────────────────────────┐  │
│  │  SmartTriadStateManager                     │  │
│  │  - Updates liquidUI.selectedTemplateId      │  │
│  │  - Updates liquidUI.templateBindings        │  │
│  │  - Curates content: all characters          │  │
│  │  - Emits STATE_DELTA via SSE                │  │
│  └─────────────────────────────────────────────┘  │
│                    ↓ SSE Stream                   │
└───────────────────┼───────────────────────────────┘
                    │
                    ↓
┌───────────────────┼───────────────────────────────┐
│  Qriptopian Thin Client                           │
│  ┌─────────────────────────────────────────────┐  │
│  │  useTemplateState() Hook                    │  │
│  │  - Receives STATE_DELTA                     │  │
│  │  - selectedTemplateId: drawer_grid_v1       │  │
│  │  - contentObjects: [12 characters]          │  │
│  └─────────────────────────────────────────────┘  │
│                    ↓                              │
│  ┌─────────────────────────────────────────────┐  │
│  │  CodexLiquidUITab                           │  │
│  │  - Renders drawer grid template             │  │
│  │  - Shows all 12 characters                  │  │
│  │  - Layout: auto-selected variant (1A-3B)    │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### Phase 1: Connect Codex to Platform CopilotKit (HIGH PRIORITY)

**Goal**: Send user queries to platform for intent inference and template selection

**Tasks**:
1. **Update CodexCopilotLayer** to send messages to platform API
   - Current: Uses local `useCodexCopilot()` context only
   - Target: POST to `/api/copilotkit` or dedicated Codex endpoint
   - Include: User query, current context (realm, device, personaId)

2. **Create Platform Codex Endpoint** (if needed)
   - Endpoint: `/api/codex/query` or use existing CopilotKit runtime
   - Receives: User query + context
   - Processes: Via CopilotKit agent with template actions
   - Returns: Updates SmartTriad state via StateManager

3. **Wire AG-UI State to CodexLiquidUITab**
   - Remove local template selection logic
   - Use `aguiTemplateState.selectedTemplateId` as source of truth
   - Use `aguiContentState.mounted` for content objects
   - Keep local state only for UI interactions (drawer open/close, etc.)

**Files to Modify**:
- `apps/theqriptopian-web/src/components/codex/CodexCopilotLayer.tsx`
- `apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx`
- `app/api/codex/query/route.ts` (new - platform side)

### Phase 2: Server-Side Content Curation

**Goal**: Move content bundling and curation to platform

**Tasks**:
1. **Create Content Curation Service** (platform)
   - Service: `services/codex/ContentCurationService.ts`
   - Fetches content from Qriptopian API
   - Applies intent-based filtering and sorting
   - Returns curated content bundles

2. **Integrate with Template Actions**
   - Update `ui_render_drawer_grid_*` actions to fetch content
   - Pass curated content to SmartTriadStateManager
   - Include in `liquidUI.templateBindings.contentObjects`

3. **Remove Client-Side Curation**
   - Remove content bundling logic from CodexLiquidUITab
   - Remove `contentBundle` state management
   - Use only AG-UI provided content

**Files to Modify**:
- `services/codex/ContentCurationService.ts` (new - platform)
- `app/copilot/actions/templateUIComplete.ts` (platform)
- `apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx` (client)

### Phase 3: Intent Inference on Platform

**Goal**: Let CopilotKit agent infer user intent from natural language

**Tasks**:
1. **Enhance CopilotKit System Prompt**
   - Add Codex-specific instructions
   - Define intent categories: browse, discover, character_deep_dive, etc.
   - Map intents to template actions

2. **Create Intent Analysis Action**
   - Action: `codex_analyze_intent`
   - Input: User query string
   - Output: Intent classification + confidence
   - Updates: SmartTriad `liquidUI.userIntent`

3. **Connect Intent to Template Selection**
   - Template actions check current intent
   - Auto-select appropriate template
   - Update both template and content in single state update

**Files to Modify**:
- `app/api/copilotkit/route.ts` (system prompt)
- `app/copilot/actions/codexIntent.ts` (new)
- `app/copilot/actions/templateUIComplete.ts` (update)

### Phase 4: Template Variant Selection

**Goal**: Platform selects optimal drawer grid variant (1A-3B) based on content

**Tasks**:
1. **Implement Variant Selection Logic** (platform)
   - Analyze content mix (characters vs episodes vs lore)
   - Consider device type (mobile vs desktop)
   - Apply layout rules from template pack JSON
   - Return variant in template bindings

2. **Update Template Actions**
   - Add `layoutVariant` parameter to drawer grid actions
   - Pass to SmartTriadStateManager
   - Include in STATE_DELTA

3. **Consume Variant in Client**
   - Read `aguiTemplateState.templateBindings.layoutVariant`
   - Pass to `KnytTemplateRenderer`
   - Remove local variant selection logic

**Files to Modify**:
- `services/agui/TemplateRegistry.ts` (platform)
- `app/copilot/actions/templateUIComplete.ts` (platform)
- `apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx` (client)

### Phase 5: Wallet Integration

**Goal**: Sync wallet drawer state with SmartTriad

**Tasks**:
1. **Connect Wallet Actions to AG-UI**
   - Use `aguiWalletState.walletOpen` for drawer state
   - Use `aguiWalletState.walletMode` for narrow/wide
   - Send wallet actions via `sendAction('OPEN_WALLET', ...)`

2. **Platform Wallet State Management**
   - Update SmartTriad `wallet.walletOpen` on actions
   - Select wallet UI components based on context
   - Emit STATE_DELTA for wallet changes

3. **Remove Local Wallet State**
   - Remove `drawerOpen` state from CodexLiquidUITab
   - Use only AG-UI state
   - Keep only UI transition states local

**Files to Modify**:
- `apps/theqriptopian-web/src/components/codex/wallet/CopilotWalletDrawer.tsx`
- `apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx`
- `services/agui/SmartTriadStateManager.ts` (platform)

---

## 🔧 Technical Details

### AG-UI State Schema for Codex

```typescript
interface LiquidUIState {
  selectedTemplateId: KnytTemplateId | null;
  templateBindings: {
    contentObjects: KnytContentItem[];
    layoutVariant?: DrawerGridLayoutVariant;
    device: DeviceType;
    layoutDecisions: any[];
  };
  copilotState: {
    mode: CopilotOverlayMode;
    visible: boolean;
    position: { x: number; y: number; w: number; h: number };
  };
  realmContext: Realm | null;
  userIntent: UserIntent | null;
}
```

### Content Curation API

**Platform Endpoint**: `/api/codex/content/curate`

```typescript
POST /api/codex/content/curate
{
  "intent": "browse",
  "focus": "characters",
  "realm": "digiterra",
  "device": "desktop",
  "personaId": "user123"
}

Response:
{
  "contentObjects": [
    { "id": "char_01", "type": "character_portrait", "title": "The Emissary", ... },
    { "id": "char_02", "type": "character_portrait", "title": "Nakamoto", ... },
    // ... 10 more characters
  ],
  "templateId": "knyt:drawer_grid_v1",
  "layoutVariant": "1a",
  "reason": "Browse intent with character focus - using grid layout"
}
```

### CopilotKit Action Flow

```typescript
// User query: "what are the characters of metaKNYTS"

// 1. Agent analyzes intent
await copilot.call('codex_analyze_intent', {
  query: "what are the characters of metaKNYTS",
  context: { realm: "digiterra", device: "desktop" }
});
// Returns: { intent: "browse", focus: "characters", confidence: 0.95 }

// 2. Agent fetches curated content
const content = await fetchCodexContent({
  intent: "browse",
  focus: "characters",
  realm: "digiterra"
});
// Returns: 12 character items

// 3. Agent selects template and renders
await copilot.call('ui_render_drawer_grid_auto', {
  contentObjects: content,
  device: "desktop",
  sessionId: "user123"
});
// Updates SmartTriad state → emits STATE_DELTA → client renders
```

---

## 🚀 Migration Strategy

### Step 1: Parallel Implementation (Safe)
- Keep existing client-side logic working
- Add AG-UI state consumption alongside
- Use feature flag to switch between modes
- Test both paths independently

### Step 2: Gradual Cutover
- Default to AG-UI state when available
- Fall back to local logic if AG-UI disconnected
- Monitor console logs for state sync issues
- Validate template selection matches expectations

### Step 3: Remove Legacy Code
- Once AG-UI proven stable, remove local template selection
- Remove content bundling logic
- Remove local intent inference
- Keep only UI interaction state local

---

## 📊 Success Metrics

### Before (Current State)
- ❌ Query "characters" → shows 1 character
- ❌ Template: dual_poster_stage (wrong)
- ❌ Intent: character_deep_dive (wrong)
- ❌ No grid layout

### After (Target State)
- ✅ Query "characters" → shows 12 characters
- ✅ Template: drawer_grid_v1 (correct)
- ✅ Intent: browse (correct)
- ✅ Grid layout: variant 1A-3B (auto-selected)
- ✅ Server-driven: All decisions made by platform
- ✅ Thin client: Only renders what platform tells it

---

## 🔍 Key Architectural Principles

1. **Server Authority**: Platform makes ALL content and template decisions
2. **Thin Client**: Qriptopian only renders and handles UI interactions
3. **State Sync**: Single source of truth via SmartTriadStateManager
4. **Intent Inference**: CopilotKit agent understands natural language
5. **Template Compilation**: Platform curates content bundles per intent
6. **Backward Compatible**: Existing UI components unchanged, just wired differently

---

## 📁 Files Summary

### Platform (Aigent Z - Port 3000)
**New Files**:
- `services/codex/ContentCurationService.ts` - Content fetching and curation
- `app/copilot/actions/codexIntent.ts` - Intent analysis action
- `app/api/codex/query/route.ts` - Codex query endpoint (optional)

**Modified Files**:
- `app/copilot/actions/templateUIComplete.ts` - Add content fetching
- `services/agui/SmartTriadStateManager.ts` - Codex state updates
- `app/api/copilotkit/route.ts` - Enhanced system prompt

### Client (Qriptopian - Port 8080)
**Modified Files**:
- `apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx` - Use AG-UI state
- `apps/theqriptopian-web/src/components/codex/CodexCopilotLayer.tsx` - Send to platform
- `apps/theqriptopian-web/src/components/codex/wallet/CopilotWalletDrawer.tsx` - AG-UI wallet state

**Preserved Files** (no changes needed):
- `apps/theqriptopian-web/src/components/codex/templates/KnytTemplateRenderer.tsx`
- `apps/theqriptopian-web/src/services/knytLiquidUIService.ts` (keep for local fallback)
- `apps/theqriptopian-web/src/hooks/useAGUIState.ts` (already created)

---

## 🎯 Next Steps

**Immediate Action**: Start with Phase 1
1. Create platform Codex query endpoint
2. Wire CodexCopilotLayer to send queries to platform
3. Test CopilotKit agent receives and processes queries
4. Verify STATE_DELTA emitted with correct template selection

**Validation**: Test with query "what are the characters of metaKNYTS"
- Should trigger `browse` intent
- Should select `drawer_grid_v1` template
- Should curate all 12 characters
- Should render grid layout with all characters visible

---

**This plan transforms the Qriptopian Codex from a fat client with local logic into a true thin client consuming server-authoritative state from the Aigent Z platform via the SmartTriad/LiquidUI/CopilotKit model.**
