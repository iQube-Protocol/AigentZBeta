# Aigent Me Phase 6.b — Part 2: Google Connections Panel

**Date:** 2026-05-12
**Workstream:** Aigent Me Phase 6.b — Google Workspace UX
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`). Part 2 of 4.
**Predecessor:** `2026-05-12_aigent-me-phase-6b-part1-foundation.md` (commit 276af3e)

---

## What landed

User-facing UX over the Phase 6.b foundation. The welcome surface now renders a Google Workspace connection panel that reads `/api/assistant/google-status` and drives the consent flow.

### New

| File | Purpose |
|---|---|
| `components/metame/connections/GoogleConnectionsPanel.tsx` | Three render states keyed on `google-status` response: (a) **loading**, (b) **not-configured** — operator-action diagnostic for admins, "coming soon" notice for users, (c) **configured** — five per-source cards (Gmail / Calendar / Drive / Docs / Slides) with Connect / Disconnect buttons. Emerald-themed to match the metaMe brand. Uses `personaFetch` for all calls. |

### Extended

| File | Change |
|---|---|
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | Mounts `<GoogleConnectionsPanel isAdmin={...} theme={theme} />` directly below the QuickLinks card, above the context chips. Reads `cartridgeFlags.isAdmin` from the bootstrap surface to pick the operator vs user view. |

---

## End-to-end flow (once operator sets OAuth creds)

```
1. User opens Aigent Me welcome tab.
2. GoogleConnectionsPanel renders 5 source cards.
3. User clicks "Connect" on, e.g., Gmail.
   → POST /api/assistant/connect-google { source: 'gmail' }
   → server signs (personaId, source, nonce) into state token
   → returns { consentUrl }
4. Panel redirects window.location to consentUrl.
5. Google shows consent screen for gmail.compose + gmail.modify scopes.
6. User approves → Google redirects to GOOGLE_OAUTH_REDIRECT_URI.
7. /api/assistant/google-callback verifies state, exchanges code,
   persists tokens, emits approval_granted receipt, redirects back to
   the runtime.
8. Welcome surface reloads → panel shows Gmail as connected with the
   user's Google email below the label.
9. Click "Disconnect" any time → POST /api/assistant/disconnect-google
   → token revoked at Google + row deleted.
```

## Pre-config view

Until the operator sets the env vars, every visitor hits the "not configured" branch:

- **Admins** (`cartridgeFlags.isAdmin === true`) see a yellow operator-action card listing the missing env vars (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`) and a pointer to the Part 1 doc.
- **Regular users** see a neutral "Google Workspace connections — coming soon" notice. No diagnostics.

This keeps the panel useful + deployable today, even before OAuth is wired.

---

## Privacy held

- The panel never touches tokens directly — all communication goes through `/api/assistant/google-status` (which returns the T1-safe shape) and the connect / disconnect routes.
- `accountEmail` is surfaced because it's the **user's own** connected Google email (they entered it during consent); there's no cross-persona disclosure.
- Bearer auth on every call via `personaFetch` (PersonaSpine).

---

## What's not shipping in Part 2

Deferred to Part 2.5:

- **ArtifactCard send/share/publish buttons** with a second-tier ApprovalCard state. Needs a per-artifact-type → connector mapping (gmail-draft → google.gmail.send, calendar-block → google.calendar.invite-external, etc.) and the UX for the second-tier confirmation. Lands when the Phase 6.b Part 3 Marketa integration confirms the mapping for partner-campaign sends.

Phase 6.b Part 3 (Marketa Mailjet compose) and Part 4 (DVN anchoring) remain queued as documented in Part 1.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `utils/personaSpine::personaFetch` | ✓ — every client call |
| `/api/assistant/google-status` (Part 1) | ✓ — driver of all three render states |
| `/api/assistant/connect-google` / `disconnect-google` (Part 1) | ✓ — Connect / Disconnect actions |
| `cartridgeFlags.isAdmin` from bootstrap (Phase 1) | ✓ — picks operator vs user view |
| Emerald brand palette (from refinements commit 913b2aa) | ✓ — matches the welcome surface brand mix |
| `lucide-react` icons (existing dep) | ✓ |

No new dependencies, no new server routes, no protected files modified.

---

## Validation

Refresh the metaMe cartridge → Aigent Me tab after dev rebuilds:

1. **Not-configured + admin** — yellow operator-action card lists missing env vars and points to the Part 1 doc.
2. **Not-configured + user** — neutral "coming soon" notice; no diagnostics surfaced.
3. After operator sets env vars + runs the migration: five per-source cards appear. Clicking Connect opens Google's consent flow. Disconnect revokes + deletes the row.

---

## Files

- `components/metame/connections/GoogleConnectionsPanel.tsx` (new)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended — 2-line import + 5-line render)
