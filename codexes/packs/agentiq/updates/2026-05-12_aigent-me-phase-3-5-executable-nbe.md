# Aigent Me Phase 3.5 — Executable NBE Cards (Approval + IntentQube)

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 3.5
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Trigger:** User report — "Move this forward option but they don't do anything. No edit or select function for either. Aren't they supposed to be executable?"

---

## Why this is "Phase 3.5"

Phases 5 (specialist routing) and 6 (artifacts + approvals + receipts) are full workstreams. Without their key UX primitive — the **Approval Card** + **IntentQube creation** — the NBE cards from Phase 3 were render-only: users could see recommendations but not act on them, which made the alpha demo flow incomplete.

Phase 3.5 brings just enough of Phase 5/6 forward to make Phase 3 actually clickable:

- An `ApprovalCard` component (the canonical "approve before any consequential action" surface per PRD §9.2 + §10 FR11).
- A `POST /api/assistant/intent` endpoint that creates an IntentQube row from a catalogue NBE id.
- Wired into every NBE card the welcome surface renders — both the Brief Card's stacked NBEs and the Move-Forward hero + alternates.

The full pipeline (specialist routing, runtime execution, receipt persistence) lands in Phases 5 and 6. Phase 3.5 is the on-ramp.

---

## What landed

| File | Status | Purpose |
|---|---|---|
| `app/api/assistant/intent/route.ts` | **new** | `POST { nbeId, cartridge?, rationale? }` → validates against `NBE_CATALOGUE` → creates IntentQube via `services/iqube/intentQube.ts` → returns the IntentQube surface + a `queueMessage` describing what Phase 5/6 will do. Persona resolved from spine. |
| `components/metame/cards/ApprovalCard.tsx` | **new** | PRD §9.2 — action + cartridge + specialist + suggested artifact + iQube disclosure + approve/edit/cancel. Two states: **pending** (approve gate) and **queued** (post-IntentQube confirmation with intent id). Edit button is rendered disabled with a tooltip ("Phase 6") — actual edit-before-queue is a Phase 6 deliverable. |
| `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` | **extended** | Adds `pendingApprovalNbe`, `submittingApproval`, `approvalError`, `queuedIntents` state. Three new handlers — `handleNbeAct`, `handleApprovalApprove`, `handleApprovalCancel`. Wires `onAct` into BriefCard's NBE list and into the Move-Forward hero + alternates. Single pending-approval slot at the top of the surface; queued intents stack below until dismissed. |

---

## Flow end-to-end

```
1. User clicks Act on any NBE card (Brief or Move-Forward).
2. ApprovalCard appears at the top of the welcome surface showing:
     - the action label + rationale
     - cartridge + specialist + suggested artifact
     - whether approval is required for external action
     - iQube disclosure ("Using: PersonaQube, ExperienceQube, IntentQube")
     - Approve / Edit (disabled, Phase 6) / Cancel
3. User clicks Approve.
4. POST /api/assistant/intent — IntentQube row written via services/iqube/intentQube.ts.
   IntentQube stored in nbe_plans (Phase 2 sentinel-pack design — no new table).
5. ApprovalCard flips to "Queued — <label>" with intent id + status + queue message.
6. The queued chip stays until the user dismisses it; the user can click Act on
   another NBE and the cycle repeats.
```

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `services/iqube/intentQube.ts` (Phase 2) | ✓ — sole creator path for IntentQube rows |
| `services/orchestration/nbeCatalog.ts` (Phase 3) | ✓ — catalogue is the source of valid nbeIds |
| `services/identity/getActivePersona.ts` | ✓ — sole personaId source at the new route |
| `utils/personaSpine.tsx::personaFetch` | ✓ — client → /api/assistant/intent |
| `IqubeContextDisclosure` (Phase 2.b) | ✓ — composed inside ApprovalCard |
| `nbe_plans` table (existing) | ✓ — IntentQube storage; no new migration needed |
| `assistant_sessions` table (Phase 1 migration) | Not yet — Phase 6 wires session→intent linking |

No new server resolver. No new table. No protected files modified (CLAUDE.md identity-spine list untouched).

---

## Privacy held

- `personaId` resolved from the spine; never read from request body.
- IntentQube payload is server-internal; the API surface returns only `intentId`, `intentName`, `status`, `cartridge`, `approvalRequired`, `targetAgents`, `allowedTools`, `createdAt`, `queueMessage` — all T1-safe.
- ApprovalCard surfaces `using` (iQube kinds, not contents). No BlakQube values touch the wire.

---

## What still doesn't happen (deferred — by design)

- **Specialist invocation.** Approving an `ask-marketa` or `ask-quill`-flavoured NBE doesn't yet call Marketa or Quill. The IntentQube is created with `approvalRequired: true` and `targetAgents` set; Phase 5 will pick those rows up and route them. The queued message names this expectation ("will coordinate with Marketa when Phase 5 specialist routing lands").
- **Artifact creation.** Approving a `create-something`-flavoured NBE doesn't yet write a Google Doc / Gmail draft / brief. Phase 6 wires the artifact pipeline + the actual external-action approval gate.
- **Receipt persistence.** No `orchestration_event` or `activity_receipt` is emitted yet. Phase 6 wires the receipt pipeline; the queued IntentQube already carries enough metadata to become a receipt.
- **Edit-before-queue.** The Edit button on ApprovalCard is rendered disabled with a tooltip. The PRD §11 `ApprovalRequest.edited_payload` shape lives in Phase 6.

---

## Operator action

None required. No new migration. The `nbe_plans` table already exists (from the Phase 2 journey-states migration). Refresh the welcome surface after this commit deploys to dev → Act buttons become live.

---

## Validation

1. **Click `Brief me`** → BriefCard renders with NBEs. Each card now shows an **Act** button on the right.
2. Click **Act** on any NBE → ApprovalCard appears at the top of the welcome surface, scrolled into view if needed.
3. Click **Approve** → fetch fires → card flips to "Queued — <label>" with truncated intent id + status.
4. Click the close (X) on the queued card → it disappears.
5. Click **Move this forward** → hero NBE renders with Act button. Same flow.
6. **Edit** button is rendered disabled with a tooltip pointing to Phase 6.
7. The IntentQube can be inspected via Supabase:
   ```sql
   SELECT id, persona_id, experience_id, disposition, expires_at, created_at
   FROM nbe_plans
   WHERE rationale LIKE '__intent_qube_v1__:%'
   ORDER BY created_at DESC LIMIT 10;
   ```
   Each Approve produces one row. The packed extras (intentName, intentType, targetAgents, allowedTools, status) live in the `rationale` column behind the sentinel.

---

## Files

- `app/api/assistant/intent/route.ts` (new)
- `components/metame/cards/ApprovalCard.tsx` (new)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
