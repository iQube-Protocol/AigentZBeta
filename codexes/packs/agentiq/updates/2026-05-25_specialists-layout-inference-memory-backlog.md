# Specialists Layout — Inference Memory Linkage (Fast-Follow Backlog)

**Status:** backlog · proposed at v1 ship of `SpecialistsLayout` (DIS template `specialists-layout-v1`)

## Why

`SpecialistsLayout` v1 ships with a two-tier consultation history:

1. **Current session responses** — full `SpecialistResponseCard` render (preflight byline, recommendations, suggested artifacts, hand-off pill) for whatever the operator has asked in this session. Held in `askSpecialistResponses` React state, gone on remount.
2. **Prior consultations** — a thin list of pointers (summary + when + cartridge + intent id) read from `activity_receipts` rows where `action_type = 'specialist_consulted'`. This is what `/api/assistant/specialist-thread` returns today.

The gap: prior consultations cannot replay as a full `SpecialistResponseCard`. The receipt carries `summary` only — `recommendations`, `suggestedArtifacts`, `confidence`, `source`, `requestType`, and `preflightContext` are not persisted. So the layout shows a pointer the operator cannot expand.

## What to build

Tie each `specialist_consulted` consultation to the persona's existing inference memory store so the thread can replay full responses.

### Step 1 — Persistence

The platform already has a per-persona inference memory layer used elsewhere (KB chat, copilot turns). Audit which store is canonical for aigentMe specialist consults (candidates: `services/agents/memory/*`, the KB inference memory tables, the `inference_logs` table — TBD during this fast-follow). Whichever store wins:

- On every successful `askSpecialist()` call in `/api/assistant/ask-agent`, write a memory row keyed by `{ personaId, specialistId, consultationId }`. Payload: the full `SpecialistResponse` shape (omitting `preflightContext` which lives separately on the gateway side and is already correlated by `workOrderId`).
- Link `activity_receipts.id` → `specialist_memory_id` via a new nullable column on `activity_receipts`, or by storing `receiptId` on the memory row. Either direction works; pick whichever store has the cheaper migration.

### Step 2 — Thread route

Extend `GET /api/assistant/specialist-thread` so each entry can optionally include the full `SpecialistResponseData` payload:

```ts
interface ThreadEntry {
  receiptId: string;
  specialistId: SpecialistId;
  summary: string;
  activeCartridge: string;
  createdAt: string;
  intentId: string | null;
  fromHandoff: boolean;
  // NEW — only populated when ?expand=true is passed, to keep the
  // default list lightweight for the layout's mini-list render.
  response?: SpecialistResponseData;
}
```

Add `?expand=true` query param (defaults false). The layout calls without expand on initial mount, then per-row on demand.

### Step 3 — Layout UX

In `SpecialistsLayout.tsx`, make each row in the "Prior consultations" list clickable:

- Click on a row → fetch `/api/assistant/specialist-thread?specialistId=X&intentId=Y&expand=true` (single-row expand).
- Result renders inline below the row as a full `SpecialistResponseCard` — same component, same affordances (suggested-artifact chips clickable, hand-off pill, etc.).
- Add a small "↩ Re-ask" affordance per expanded card that pre-fills the composer with the prior question. Cheaper-but-still-useful version of "continue this thread" before we wire genuine multi-turn.

### Step 4 — Cross-session continuity

Once inference memory is the source of truth, the recommender (`services/orchestration/specialistRecommender.ts`) can also read it. Two improvements unlock:

- **Recency awareness across sessions** — today the recommender's "recently consulted" nudge reads `targetAgents` on the persona's recent `nbe_plans` rows. Reading actual consultation memory is stronger because it covers asks that didn't queue an IntentQube (most one-off asks).
- **Thread-continuation prompts** — when the operator opens the layout and the most recent consult is < 24h old, the recommendation card can offer "Continue with Marketa on the partner proposal?" as the top action instead of a fresh pick. Single-click → composer pre-fills with a continuation phrasing.

### Step 5 — Privacy + DVN posture

The memory store has T0 identifiers in its server-side keying (personaId). The layout never sees them. Reaffirm this in the canary tests (`tests/persona-broadcast-handshake.test.ts`) for the new endpoint — same posture as every other `/api/assistant/*` route.

DVN receipts already cover the consultation — the memory row is a *replay* artifact, not a separate trust surface. No new receipt class needed.

## Non-goals (explicitly out of scope)

- **Multi-turn back-and-forth with a single specialist.** Today every ask is a fresh round-trip. Multi-turn (where Marketa's response becomes the prompt context for the next ask) is a bigger workstream — needs a conversation thread primitive in `services/agents/` and is its own Phase 3 item.
- **Persisting in-flight composer drafts.** The composer prompt lives in React state. If the operator switches specialists mid-draft, the draft drops. That's intentional for v1 (clean slate per specialist); a per-specialist draft store is a separate UX call.

## Linked files

| Layer | File |
|---|---|
| Layout | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |
| Recommender | `services/orchestration/specialistRecommender.ts` |
| Thread route | `app/api/assistant/specialist-thread/route.ts` |
| Ask route | `app/api/assistant/ask-agent/route.ts` |
| Receipts (current SoT for thread) | `services/receipts/activityReceiptService.ts` |
| Tab orchestration | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |

## Priority

Medium-high. The layout is the right shape and the affordances are there, but every operator who clicks a prior-consult row and gets "summary only" will feel the gap immediately. Lands cleanly behind a single feature flag (`SPECIALIST_THREAD_EXPAND_ENABLED`) so we can ship the persistence + route first and turn on the UX last.
