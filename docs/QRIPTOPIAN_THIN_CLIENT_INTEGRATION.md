# Qriptopian Web App: Thin Client Integration with AG-UI

**Date**: 2025-12-21  
**Version**: 0.1.0  
**Status**: ✅ IMPLEMENTED

## Executive Summary

Successfully configured **Qriptopian web app** as a proper thin client of the **AigentiQ platform (Aigent Z)**, using AG-UI for server-authoritative UI state management with the existing **5 KNYT Liquid UI templates**.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│         Aigent Z Platform (Thick Server)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  CopilotKit v1.50 Runtime                              │ │
│  │  - Template selection logic                            │ │
│  │  - SmartTriad orchestration                            │ │
│  │  - 6 template rendering actions                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SmartTriadStateManager                                │ │
│  │  - Server-authoritative state                          │ │
│  │  - STATE_SNAPSHOT / STATE_DELTA emission              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AG-UI Endpoints                                       │ │
│  │  - GET /api/a2a/agui/stream (SSE)                     │ │
│  │  - POST /api/a2a/agui/send (actions)                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SSE + JSON Patch
                              ▼
┌─────────────────────────────────────────────────────────────┐
│      Qriptopian Web App (Thin Client)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AGUIClient Service                                    │ │
│  │  - Connects to Aigent Z via SSE                        │ │
│  │  - Receives STATE_SNAPSHOT + STATE_DELTA               │ │
│  │  - Sends user actions                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Hooks (useAGUIState, useTemplateState, etc.)   │ │
│  │  - Reactive state consumption                          │ │
│  │  - Action dispatching                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Existing Components (PRESERVED)                       │ │
│  │  - KnytTemplateRenderer (5 templates)                 │ │
│  │  - CopilotWalletDrawer (narrow/wide modes)            │ │
│  │  - CodexLiquidUITab (orchestrator)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## The 5 KNYT Templates (Confirmed)

From `knyt_liquid_ui_template_pack.json` and implemented in `KnytTemplateRenderer.tsx`:

### 1. knyt:drawer_grid_v1 - Scrolls Drawer Grid
**Component**: Implemented in KnytTemplateRenderer  
**Best for**: browse, discover, quick_switch, library  
**Regions**: drawer_grid, copilot_overlay, action_mini, smart_menu, copilot_drawer_narrow, copilot_drawer_wide  
**Geometry**: Mobile (1 col), Tablet (3 col), Desktop (4 col)

### 2. knyt:dual_poster_stage_v1 - Dual Poster Stage
**Component**: Implemented in KnytTemplateRenderer  
**Best for**: character_deep_dive, cover_art, page_review, collectible_display  
**Regions**: poster_stage_primary, poster_stage_secondary, info_card, quest_rail, copilot_overlay, copilot_drawer_narrow, copilot_drawer_wide  
**Geometry**: Mobile (1-up), Desktop (2-up + quest rail)

### 3. knyt:motion_stage_v1 - Immersive Motion Stage
**Component**: Implemented in KnytTemplateRenderer  
**Best for**: watch, motion_comics, trailers, scene_review  
**Regions**: motion_stage, clip_strip, quest_rail, copilot_overlay, copilot_drawer_narrow, copilot_drawer_wide  
**Geometry**: 16:9 or 21:9 landscape stage with clip navigation

### 4. knyt:quest_hud_hub_v1 - Quest HUD Hub
**Component**: Implemented in KnytTemplateRenderer  
**Best for**: ascension, earn_rewards, member_get_member, guided_paths  
**Regions**: content_stage, hud_left, hud_right, copilot_overlay, copilot_drawer_narrow, copilot_drawer_wide  
**Geometry**: Mobile (collapsed HUD), Desktop (3-column with HUD left/right)

### 5. knyt:realm_bridge_map_v1 - Realm Bridge Map
**Component**: Implemented in KnytTemplateRenderer  
**Best for**: realm_navigation, bridge_real_to_lore, contextual_story_routes  
**Regions**: realm_rail, bridge_stage, related_strip, copilot_overlay, copilot_drawer_narrow, copilot_drawer_wide  
**Geometry**: Explicit DigiTerra ↔ Terra ↔ metaTerra/or navigation

## SmartWallet Modal System

From `CopilotWalletDrawer.tsx` - fully integrated with templates:

### Narrow Mode (Glance + Tap)
**Cards**:
- `wallet_card.balance` - KNYT balance display
- `wallet_card.reward_claim` - Pending rewards queue
- `wallet_card.unlock_offer` - Content unlock offers
- `wallet_card.referral_invite` - Growth/referral actions
- `wallet_card.task_step` - Next task action

**Dimensions**:
- Mobile: 28% height (slides from bottom)
- Desktop: 22% width (floats right)

### Wide Mode (Multi-Step Flows)
**Modals**:
- `wallet_modal.checkout` - Purchase/unlock flow
- `wallet_modal.send_request` - Send/request Q¢ via x402
- `wallet_modal.receipt` - Transaction confirmation
- `wallet_modal.permissions` - Auth/consent flow

**Dimensions**:
- Mobile: 62% height (slides from bottom)
- Desktop: 38% width (docks right)

## Files Created for Thin Client Integration

### 1. AG-UI Client Service
**File**: `apps/theqriptopian-web/src/services/aguiClient.ts`

```typescript
export class AGUIClient {
  connect(): void;           // Connect to SSE stream
  disconnect(): void;        // Disconnect
  sendAction(type, payload); // Send action to platform
  getState(): SmartTriadState | null;
  subscribe(listener): () => void;
}
```

**Features**:
- SSE connection management
- STATE_SNAPSHOT handling
- STATE_DELTA application (RFC6902 JSON Patch)
- Action dispatching to platform
- Reactive state updates

### 2. React Hooks for State Consumption
**File**: `apps/theqriptopian-web/src/hooks/useAGUIState.ts`

```typescript
// Main state hook
useAGUIState() => {
  state, connected, error, sendAction,
  session, content, wallet, menu, liquidUI
}

// Template-specific hook
useTemplateState() => {
  selectedTemplateId, templateBindings, copilotState,
  realmContext, userIntent, selectTemplate, changeRealm
}

// Wallet-specific hook
useWalletState() => {
  walletOpen, walletMode, purchaseInProgress, balances,
  pendingTx, openWallet, closeWallet, purchaseContent
}

// Content-specific hook
useContentState() => {
  currentContentId, ownedContentIds, libraryLoading,
  selectedIssueId, selectedSectionId, selectedTabId, selectContent
}
```

### 3. Updated TemplateRegistry
**File**: `services/agui/TemplateRegistry.ts`

- Now imports from actual Qriptopian template pack
- Maps to existing KnytTemplateRenderer components
- Provides CopilotKit action specs for all 5 templates

## Integration Pattern

### Server-Side (Aigent Z Platform)

**CopilotKit Actions** (already implemented):
```typescript
// Template selection
ui_select_template({ userIntent, device, contentMix, realm, sessionId })

// Template rendering
ui_render_drawer_grid({ contentObjects, device, sessionId })
ui_render_dual_poster({ primaryContent, secondaryContent, device, sessionId })
ui_render_motion_stage({ videoContent, clipStrip, device, sessionId })
ui_render_quest_hud({ hudData, contentStage, device, sessionId })
ui_render_realm_bridge({ currentRealm, realmContent, device, sessionId })
```

**State Management**:
- SmartTriadStateManager maintains server-authoritative state
- Emits STATE_SNAPSHOT on session start
- Emits STATE_DELTA on every state change
- Streams to connected clients via SSE

### Client-Side (Qriptopian Web App)

**Initialization** (add to App.tsx or main entry):
```typescript
import { initializeAGUIClient } from '@/services/aguiClient';

// Initialize on app start
const client = initializeAGUIClient({
  platformUrl: process.env.NEXT_PUBLIC_AIGENT_Z_URL || 'http://localhost:3000',
  personaId: currentPersonaId,
  tenantId: currentTenantId,
  device: detectDevice(),
  onStateUpdate: (state) => {
    console.log('State updated:', state.metadata.sequenceNumber);
  },
  onError: (error) => {
    console.error('AG-UI error:', error);
  },
});

// Connect to stream
client.connect();
```

**Component Usage**:
```typescript
import { useTemplateState, useWalletState } from '@/hooks/useAGUIState';

function CodexLiquidUITab() {
  const { selectedTemplateId, templateBindings, selectTemplate } = useTemplateState();
  const { walletOpen, walletMode, openWallet } = useWalletState();

  // State is automatically updated via SSE
  // Actions are sent to platform
  
  return (
    <KnytTemplateRenderer
      templateId={selectedTemplateId || 'knyt:drawer_grid_v1'}
      contentItems={templateBindings?.contentObjects || []}
      drawerMode={walletMode}
      drawerOpen={walletOpen}
      onDrawerToggle={(open) => open ? openWallet() : closeWallet()}
      // ... other props
    />
  );
}
```

## Backward Compatibility

✅ **100% backward compatible** with existing Qriptopian work:

1. **Existing Components Preserved**:
   - KnytTemplateRenderer.tsx - No changes needed
   - CopilotWalletDrawer.tsx - No changes needed
   - CodexLiquidUITab.tsx - Only needs AG-UI hooks added
   - All other Codex components - Unchanged

2. **Existing Services Preserved**:
   - knytLiquidUIService.ts - Still used for local template selection
   - liquidUIService.ts - Still used for content transformation
   - All existing data fetching - Unchanged

3. **Gradual Migration Path**:
   - Can run in **hybrid mode**: local state + AG-UI state
   - Can toggle AG-UI on/off via feature flag
   - Existing functionality continues to work without AG-UI

## Template Selection Flow

### Option 1: Server-Driven (Recommended)
```
User action → Qriptopian sends action → Aigent Z Copilot
  → Copilot calls ui_select_template
  → SmartTriadStateManager updates liquidUI.selectedTemplateId
  → STATE_DELTA emitted
  → Qriptopian receives delta
  → KnytTemplateRenderer re-renders with new template
```

### Option 2: Client-Driven (Fallback)
```
User action → useTemplateState().selectTemplate(templateId)
  → AGUIClient.sendAction('SELECT_TEMPLATE', { templateId })
  → Aigent Z updates state
  → STATE_DELTA emitted
  → Qriptopian receives delta
  → KnytTemplateRenderer re-renders
```

## Environment Configuration

### Aigent Z Platform (.env.local)
```bash
# Already configured
OPENAI_API_KEY=<your-key>
```

### Qriptopian Web App (.env.local)
```bash
# Add these
NEXT_PUBLIC_AIGENT_Z_URL=http://localhost:3000
NEXT_PUBLIC_AGUI_ENABLED=true
```

## Testing

### Test AG-UI Connection
```typescript
// In browser console
const client = getAGUIClient();
console.log('Connected:', client.getState() !== null);
console.log('Current template:', client.getState()?.liquidUI.selectedTemplateId);
```

### Test Template Selection
```typescript
// Send action from Qriptopian
await client.sendAction('SELECT_TEMPLATE', {
  templateId: 'knyt:motion_stage_v1',
  bindings: { videoContent: {...} }
});
```

### Test Wallet Integration
```typescript
// Open wallet
await client.sendAction('OPEN_WALLET', { mode: 'wide' });

// Check state
const state = client.getState();
console.log('Wallet open:', state?.smartTriad.wallet.walletOpen);
console.log('Wallet mode:', state?.smartTriad.wallet.walletMode);
```

## Next Steps

### Phase 1: Basic Integration (Current)
- ✅ AG-UI client service created
- ✅ React hooks for state consumption
- ✅ TemplateRegistry updated with actual 5 templates
- ⏳ Add AG-UI initialization to Qriptopian App.tsx
- ⏳ Update CodexLiquidUITab to use AG-UI hooks

### Phase 2: Full Integration
- Wire all 5 templates to AG-UI state
- Integrate SmartWallet modals with AG-UI
- Add realm navigation via AG-UI
- Test all template transitions

### Phase 3: Advanced Features
- Copilot-driven template selection
- Dynamic content loading via AG-UI
- Multi-session synchronization
- Offline support with state replay

## Key Benefits

1. **Server-Authoritative UI**: Aigent Z controls what users see
2. **Thin Client**: Qriptopian becomes lightweight renderer
3. **Real-Time Sync**: STATE_DELTA keeps UI instantly updated
4. **Backward Compatible**: Existing code continues to work
5. **GenUI Ready**: Foundation for Stage 2 dynamic generation
6. **Scalable**: Same pattern works for other thin clients

## References

- Specification files: `docs/specs/`
- Template pack: `apps/theqriptopian-web/src/data/knyt_liquid_ui_template_pack.json`
- Template renderer: `apps/theqriptopian-web/src/components/codex/templates/KnytTemplateRenderer.tsx`
- Wallet drawer: `apps/theqriptopian-web/src/components/codex/wallet/CopilotWalletDrawer.tsx`
- Main upgrade doc: `docs/COPILOTKIT_1_50_UPGRADE.md`

---

**Status**: ✅ Core infrastructure complete, ready for integration testing
