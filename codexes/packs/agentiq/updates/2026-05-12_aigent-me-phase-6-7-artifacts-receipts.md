# Aigent Me Phase 6 + 7 — Artifacts + Activity Receipts

**Date:** 2026-05-12
**Workstream:** metaMe Personal Assistant Alpha (Aigent Me) — Phase 6 (artifacts + receipts pipeline) and Phase 7 (receipts UI)
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`)
**Predecessors:**
- Phase 5 — Specialist routing (40e8daa)
- Phase 4 — Venture Progress (d7460e0)
- Phase 3.5 — Executable NBE cards (d168de7)

---

## Why combined

Phases 6 and 7 were originally planned as separate workstreams. They land together because:
- **Phase 6** writes activity receipts; **Phase 7** displays them. Same data, paired wiring.
- The artifact pipeline (Phase 6) is the canonical producer of receipts; rendering them next to the artifacts (Phase 7) is the canonical viewer. Decoupling adds plumbing without value.

---

## What landed

### Phase 6 — Artifact pipeline + receipt emission

| File | Purpose |
|---|---|
| `supabase/migrations/20260514000000_activity_receipts.sql` (new) | `activity_receipts` table. Per-persona ledger. Service-role RLS. Indexed on persona / cartridge / action_type / created_at. FKs to `assistant_sessions` + `nbe_plans` (both nullable). |
| `services/receipts/activityReceiptService.ts` (new) | Canonical writer + reader. `createActivityReceipt(input)` is best-effort (missing-table is warn+null, not throw). `listActivityReceiptsForPersona(personaId, options)` for the receipts panel. |
| `app/api/assistant/create-artifact/route.ts` (new) | `POST { artifactType, title?, sourceIntentId?, destination?, specialistId? }`. Alpha allowed destinations: `runtime` only. `drive`/`gmail`/`cartridge_store` return 501 with a clear "Phase 6.b" diagnostic. Emits `artifact_created` receipt automatically. |
| `app/api/assistant/intent/route.ts` (+) | Emits `intent_queued` receipts after IntentQube creation. |
| `app/api/assistant/ask-agent/route.ts` (+) | Emits `specialist_consulted` receipts after a successful specialist response. |
| `app/api/assistant/experience-model/route.ts` (+) | Emits `experience_model_updated` receipts on upsert. |
| `components/metame/cards/ArtifactCard.tsx` (new) | Renders one artifact: type icon, title, destination, status pill, optional location URL (Phase 6.b), receipt id, created-at. |

### Phase 7 — Receipts viewer

| File | Purpose |
|---|---|
| `app/api/assistant/receipts/route.ts` (new) | `GET ?limit&cartridge&actionType`. Persona-scoped via spine. Returns `{ receipts, count }`. |
| `components/metame/cards/ActivityReceiptCard.tsx` (new) | One receipt rendered with full trace: action label, cartridge chip, agents, tools, iQubes, context shared, artifacts created, approvals granted, DVN status pill, created-at. |
| `AigentMeWelcomeTab.tsx` (extended) | State for receipts + artifacts. New "Recent activity" section with **Show receipts / Hide receipts** toggle — fetches on open. ArtifactCards stack inline above receipts. Specialist response suggested-artifact chips are now clickable; they fire `POST /api/assistant/create-artifact` with `sourceIntentId` linked back to the queued NBE. |

---

## End-to-end flow now demonstrable

```
1. User clicks Set up my ExperienceModel → wizard → Save.
   → 'experience_model_updated' receipt emitted.

2. User clicks Brief me → NBE Act → Approve.
   → IntentQube created.
   → 'intent_queued' receipt emitted.

3. (Auto, if NBE.specialist is set) Aigent Me calls the specialist.
   → SpecialistResponseCard renders.
   → 'specialist_consulted' receipt emitted.

4. User clicks a suggested artifact chip on the SpecialistResponseCard.
   → POST /api/assistant/create-artifact { artifactType, sourceIntentId, specialistId }.
   → ArtifactCard renders inline at the top of the artifacts stack.
   → 'artifact_created' receipt emitted.

5. User clicks Show receipts.
   → GET /api/assistant/receipts.
   → ActivityReceiptCards stack with the full trace of what happened.
```

---

## Privacy contract

- `persona_id` is T0 on the `activity_receipts` table; never serialised to JSON.
- `context_shared` stores category labels only ("intent-summary", "experience-meta-slice", "nbe-catalogue-entry"). It MUST NOT contain payload values.
- `iqubes_used` lists the kinds (PersonaQube / ExperienceQube / IntentQube), never their contents.
- BlakQube values never reach the receipt or any artifact pipeline output.
- Artifact creation today writes a runtime-only record + emits a receipt; no external destination opens any T0 surface.

---

## What does NOT ship — deferred to Phase 6.b

- **Google Workspace OAuth + connectors** (Gmail / Calendar / Drive / Docs / Slides). The operator's locked decision Q3 already chose **per-source opt-in**. Phase 6.b builds the consent flow + tokens + API calls; until then `destination='drive'|'gmail'|'cartridge_store'` returns 501 with a diagnostic.
- **Real Approval Card gate before "send / share / publish"**. Today's ApprovalCard gates IntentQube creation (Phase 3.5). Phase 6.b will surface a second-tier ApprovalCard before the actual external action when Google connectors are live.
- **DVN-anchored receipts.** All receipts land at `receipt_status: 'local'`. Phase 6.b wires the DVN batch finalizer through `services/dvn/receiptFinalizationService.ts` to flip them through `dvn_pending → dvn_recorded`.
- **Edit-before-approve** on the ApprovalCard. Still rendered disabled with a tooltip pointing here.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `services/iqube/intentQube.ts` | ✓ — `getIntentQube` for artifact source binding |
| `services/identity/getActivePersona.ts` | ✓ — persona resolution |
| `personaFetch` (PersonaSpine) | ✓ — every client call |
| `IqubeContextDisclosure` (Phase 2.b) | ✓ — composed where receipts are visible |
| `assistant_sessions` table (Phase 1) | ✓ — receipts FK to it (nullable until session row creation lands; today receipts can stand alone) |
| `nbe_plans` table | ✓ — receipts FK to intent_id |
| Existing receipts service (`services/receipts/*`) | retained; the new file is purpose-specific for Aigent Me activity receipts. Phase 6.b can consolidate if useful. |

No protected files (CLAUDE.md identity-spine list) modified.

---

## Operator action

Run the new migration in Supabase SQL editor:

```sql
-- /home/user/AigentZBeta/supabase/migrations/20260514000000_activity_receipts.sql
```

Paste the file contents into the SQL editor and run. Idempotent.

Verify:

```sql
SELECT count(*) AS table_exists
FROM pg_tables
WHERE schemaname='public' AND tablename='activity_receipts';

SELECT policyname, cmd FROM pg_policies WHERE tablename='activity_receipts';
```

Expected: `table_exists: 1`, two policies (`activity_receipts_read_service` SELECT, `activity_receipts_write_service` ALL).

Until applied: routes that emit receipts log a warning and continue. The welcome surface's "Recent activity" panel will show "No receipts yet." cleanly. Nothing breaks.

---

## Validation steps once dev rebuilds

1. **Receipt emission** — Click Set up my ExperienceModel → wizard → Save. Open the **Recent activity** panel → an `experience_model_updated` receipt appears.
2. **Brief / Approve / Specialist consult** — Click Brief me → Act on any NBE → Approve. Open Recent activity → `intent_queued` + (if NBE.specialist set) `specialist_consulted` receipts appear.
3. **Artifact creation** — In a SpecialistResponseCard, click any suggested-artifact chip → an ArtifactCard appears at the top of the page, and a `artifact_created` receipt joins the panel.
4. **Persona switch** — switch persona via existing UI → all receipts clear and re-fetch on next open (PersonaSpine invalidation).

---

## Files

- `supabase/migrations/20260514000000_activity_receipts.sql` (new)
- `services/receipts/activityReceiptService.ts` (new)
- `app/api/assistant/create-artifact/route.ts` (new)
- `app/api/assistant/receipts/route.ts` (new)
- `components/metame/cards/ArtifactCard.tsx` (new)
- `components/metame/cards/ActivityReceiptCard.tsx` (new)
- `app/api/assistant/intent/route.ts` (+ receipt emission)
- `app/api/assistant/ask-agent/route.ts` (+ receipt emission)
- `app/api/assistant/experience-model/route.ts` (+ receipt emission)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (extended)
