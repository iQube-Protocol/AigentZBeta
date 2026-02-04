# Browser Testing Instructions - Qriptopian Thin Client

**Date**: 2025-12-21  
**Status**: Ready for Testing

---

## 🎯 What to Test

The Qriptopian thin client should now receive server-driven template selection and content from the Aigent Z platform. This test validates the complete flow from user query to rendered UI.

---

## 🚀 Setup

### 1. Start Both Servers

**Terminal 1 - Platform (Aigent Z)**:
```bash
cd /Users/hal1/CascadeProjects/AigentZBeta
npm run dev
# Should start on http://localhost:3000
```

**Terminal 2 - Client (Qriptopian)**:
```bash
cd /Users/hal1/CascadeProjects/AigentZBeta/apps/theqriptopian-web
npm run dev
# Should start on http://localhost:8080
```

### 2. Open Browser
- Navigate to: http://localhost:8080
- Open DevTools Console (F12 or Cmd+Option+I)

---

## 📋 Test Steps

### Test 1: AG-UI Connection

**Action**: Load the page  
**Expected Console Logs**:
```
[AGUIProvider] Initializing thin client connection to: http://localhost:3000
[AGUIProvider] Thin client connected - consuming state via AG-UI hooks
[AGUIClient] 📸 STATE_SNAPSHOT received: {sessionId: "qript_...", template: null, contentCount: 0}
```

**What to Check**:
- ✅ AG-UI client connects to platform
- ✅ STATE_SNAPSHOT received with sessionId
- ✅ No connection errors

---

### Test 2: Codex Navigation

**Action**: Click Library icon (📚) on right navigation  
**Expected**:
- Codex drawer opens
- "Codex" tab is active
- CodexLiquidUITab renders

**Console Logs**:
```
[CodexLiquidUI] AG-UI template state: {selectedTemplateId: null, ...}
[CodexLiquidUI] ⚠️ No template from AG-UI, using local selection
[CodexLiquidUI] AG-UI content state: {mounted: [], ...}
[CodexLiquidUI] ⚠️ No content from AG-UI, using local content
```

**What to Check**:
- ✅ Drawer opens smoothly
- ✅ Initial state shows no platform template/content
- ✅ Local fallback template renders

---

### Test 3: Character Query (CRITICAL TEST)

**Action**: 
1. Hover bottom-right to reveal copilot button
2. Click to activate copilot
3. Type: "show me the characters"
4. Press Send

**Expected Platform Logs** (Terminal 1):
```
[Codex Query] Received: {query: "show me the characters", sessionId: "qript_...", ...}
[Codex Query] Intent analysis: {primary: "browse", focus: "characters", confidence: 0.9}
[Codex Query] Template selection: {templateId: "knyt:drawer_grid_v1", reason: "Browse characters"}
[ContentCuration] Fetching content: {intent: "browse", focus: "characters", realm: "digiterra"}
[ContentCuration] Fetching characters for realm: digiterra
[Codex Query] Content fetched: 24 items
[Codex Query] State updated for session: qript_...
```

**Expected Client Logs** (Browser Console):
```
[CodexCopilot] Sending query to platform with sessionId: qript_... show me the characters
[AGUIClient] 🔄 STATE_DELTA received: {sequenceNumber: 1, patchCount: 3, patches: [...]}
[AGUIClient] ✅ State updated: {template: "knyt:drawer_grid_v1", contentCount: 24}
[CodexLiquidUI] AG-UI template state: {selectedTemplateId: "knyt:drawer_grid_v1", ...}
[CodexLiquidUI] ✅ AG-UI template selected: knyt:drawer_grid_v1
[CodexLiquidUI] ✅ Template overridden by platform: knyt:drawer_grid_v1
[CodexLiquidUI] AG-UI content state: {mounted: [24 items], ...}
[CodexLiquidUI] ✅ AG-UI content mounted: 24 items
[CodexLiquidUI] ✅ Content overridden by platform: 24 items
```

**Expected UI**:
- ✅ Template changes from `dual_poster_stage_v1` to `drawer_grid_v1`
- ✅ Grid layout appears (not single character poster)
- ✅ 24 character cards render in grid
- ✅ Characters include: Satoshi Nakamoto, The Emissary, Owethu Shaka, etc.

**Bottom status bar should show**:
```
Template: knyt:drawer_grid_v1 | Intent: browse | Drawer: none
```

---

## 🔍 What to Look For

### Success Indicators ✅

1. **SessionId Synchronization**:
   - Same sessionId in query and STATE_DELTA
   - Example: `qript_1734809123456_abc123def`

2. **STATE_DELTA Received**:
   - Console shows: `🔄 STATE_DELTA received`
   - Patches include template and content updates

3. **Template Override**:
   - Console shows: `✅ Template overridden by platform`
   - UI switches from local to platform template

4. **Content Rendering**:
   - Console shows: `✅ Content overridden by platform: 24 items`
   - Grid displays 24 character cards

### Failure Indicators ❌

1. **SessionId Mismatch**:
   - Query uses: `codex_1234567890`
   - SSE stream uses: `qript_9876543210`
   - **Fix**: Already implemented - should use same sessionId

2. **No STATE_DELTA**:
   - Only see STATE_SNAPSHOT, no DELTA
   - **Cause**: SessionId mismatch or SSE not emitting

3. **Template Not Changing**:
   - Still shows `dual_poster_stage_v1`
   - Console shows: `⚠️ No template from AG-UI`
   - **Cause**: STATE_DELTA not reaching client

4. **No Content**:
   - Grid is empty or shows 1 character
   - Console shows: `⚠️ No content from AG-UI`
   - **Cause**: Content not in state update

---

## 🐛 Debugging

### Check SessionId Alignment

**In Browser Console**:
```javascript
// Get AG-UI client sessionId
const client = window.__AGUI_CLIENT__;
console.log('Client sessionId:', client?.getState()?.session?.sessionId);
```

**In Platform Terminal**:
- Look for: `[Codex Query] Received: {sessionId: "..."}`
- Should match browser sessionId

### Check SSE Stream

**In Browser Console**:
```javascript
// Check if EventSource is connected
console.log('EventSource:', window.__EVENT_SOURCE__);
```

**Manual SSE Test**:
```bash
# In Terminal 3
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/a2a/agui/stream?sessionId=test_manual&personaId=guest&device=desktop"

# Should see:
# event: STATE_SNAPSHOT
# data: {"session":{"sessionId":"test_manual",...},...}
```

### Check State Update

**After sending query, in Browser Console**:
```javascript
// Check current AG-UI state
const client = window.__AGUI_CLIENT__;
const state = client?.getState();
console.log('Template:', state?.liquidUI?.selectedTemplateId);
console.log('Content count:', state?.liquidUI?.templateBindings?.contentObjects?.length);
```

**Expected**:
```
Template: "knyt:drawer_grid_v1"
Content count: 24
```

---

## 📊 Test Matrix

| Test | Query | Expected Template | Expected Content Count | Status |
|------|-------|-------------------|------------------------|--------|
| Characters | "show me the characters" | drawer_grid_v1 | 24 | ⏳ |
| Episodes | "show me the episodes" | drawer_grid_v1 | ~10 | ⏳ |
| Watch | "watch the motion comic" | motion_stage_v1 | ~5 | ⏳ |
| Mixed | "show me everything" | drawer_grid_v1 | 10 | ⏳ |

---

## ✅ Success Criteria

The test is successful if:

1. ✅ AG-UI client connects and receives STATE_SNAPSHOT
2. ✅ Query sent with correct sessionId
3. ✅ Platform processes query and fetches 24 characters
4. ✅ STATE_DELTA emitted with template + content
5. ✅ Client receives STATE_DELTA
6. ✅ Template changes to `drawer_grid_v1`
7. ✅ 24 character cards render in grid layout
8. ✅ No console errors

---

## 📝 Notes

### Current Implementation Status

- ✅ Phase 1: Platform integration complete
- ✅ Phase 2: Content curation complete
- ⏳ Phase 3: Browser validation (this test)

### Known Issues

1. **SessionId Generation**: Fixed - now uses AG-UI client's sessionId
2. **Content Fetching**: Implemented - fetches 24 characters from Codex API
3. **Template Override**: Implemented - AG-UI state overrides local selection

### Next Steps After Success

1. Test other query types (episodes, watch, lore)
2. Test on mobile viewport
3. Add CopilotKit agent integration (Phase 4)
4. Implement content variant selection (Phase 5)

---

**Generated**: 2025-12-21  
**Ready for Testing**: YES ✅
