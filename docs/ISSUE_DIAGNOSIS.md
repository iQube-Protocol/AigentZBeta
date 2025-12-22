# Issue Diagnosis - Template Not Updating

**Problem**: Template still showing `dual_poster_stage_v1` instead of `drawer_grid_v1`

## Root Cause Identified

The local template selection logic was running **after** the AG-UI state arrived and **overwriting** the platform's template selection.

### Execution Order Issue

1. **AG-UI STATE_DELTA arrives** → Sets template to `drawer_grid_v1`
2. **Local useEffect runs** → Calls `service.selectTemplate()` → Overwrites to `dual_poster_stage_v1`

### Fix Applied

Added early return in the content bundling `useEffect` (line 512-516):

```typescript
// CRITICAL: Skip local template selection if platform has provided one via AG-UI
if (aguiTemplateState.selectedTemplateId) {
  console.log('[CodexLiquidUI] ⏭️ Skipping local template selection - using platform template:', aguiTemplateState.selectedTemplateId);
  return;
}
```

This prevents local template selection from running when the platform has already provided a template.

## Test Now

**Steps**:
1. Refresh browser at http://localhost:8080
2. Open Codex drawer
3. Activate copilot
4. Type: "show me the characters"
5. Send

**Expected Console Logs**:
```
[CodexCopilot] Sending query to platform with sessionId: qript_...
[AGUIClient] 🔄 STATE_DELTA received: {sequenceNumber: 1, patchCount: 3}
[AGUIClient] ✅ State updated: {template: "knyt:drawer_grid_v1", contentCount: 24}
[CodexLiquidUI] ✅ AG-UI template selected: knyt:drawer_grid_v1
[CodexLiquidUI] ✅ Template overridden by platform: knyt:drawer_grid_v1
[CodexLiquidUI] ⏭️ Skipping local template selection - using platform template: knyt:drawer_grid_v1
[CodexLiquidUI] ✅ Content overridden by platform: 24 items
```

**Expected UI**:
- Grid layout with 24 character cards
- Bottom status: `Template: knyt:drawer_grid_v1 | Intent: browse | Drawer: none`

## If Still Not Working

Check these in browser console:

1. **SessionId Match**:
   ```javascript
   // Should be the same sessionId in both logs
   [CodexCopilot] Sending query to platform with sessionId: qript_ABC123
   [AGUIClient] 📸 STATE_SNAPSHOT received: {sessionId: "qript_ABC123", ...}
   ```

2. **STATE_DELTA Received**:
   ```javascript
   // Should see this after sending query
   [AGUIClient] 🔄 STATE_DELTA received: {...}
   ```

3. **Template State**:
   ```javascript
   // Check what AG-UI state contains
   [CodexLiquidUI] AG-UI template state: {selectedTemplateId: "knyt:drawer_grid_v1", ...}
   ```

If you don't see STATE_DELTA, the issue is with SSE stream emission, not the client.

---

**Status**: Fix deployed, ready for browser test
**Build**: ✅ Successful
**Files Modified**: `CodexLiquidUITab.tsx` (added early return)
