# Financial Services / AEE reference surface closeout — MoneyPenny metaMe Catalogue card + Operate destination projection

**Date:** 2026-08-24
**Branch:** `claude/fs-aee-catalogue-operate-destination`
**Parent:** `2026-08-24_aee-differ-phase0-audit-financial-services.md`, `2026-08-24_differ-scan-package-v1-financial-services.md`

## What this closes out

The operator asked to wire the generic Bridge → Operate → metaMe → metaMe Catalogue → destination
pattern through to MoneyPenny, since MoneyPenny had no metaMe Catalogue card at all. Audited the
existing catalogue/tab/journey architecture first (per instruction — "keep this surgical") and
reused it end to end; nothing was forked.

## Audit findings

- **The "metaMe Catalogue" is the existing Activations system** (`data/activation-catalog.ts` +
  `ActivationsTab.tsx` + `services/activations/spineActivations.ts`, read via
  `useActivations()`/`ActivationsContext.tsx`).
- **Two activation-persistence backends exist** (`spineActivations.ts`, qube/DVN-backed;
  `personaActivations.ts`, table-only). `ActivationsContext.tsx` imports **only**
  `spineActivations` — that is the live backend. It requires a `content_qubes` row
  (`content_kind='activation_tab'`) per catalogue entry, seeded by migration — confirmed via the
  `20260524000000` / `20260619000000` / `20260728000000` precedent migrations.
- **MoneyPenny had no catalogue entry** under `moneypenny` or any other id — confirmed by scanning
  all 13 existing entries.
- **`MoneyPennyPanelTab`** (`app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx`) is a generic,
  context-free dispatcher already used by the standalone `moneypenny-codex` cartridge's own
  Orchestration tab (`panel: 'service-orchestration'` → `ServiceOrchestrationPanel`). It takes no
  cartridge-specific props, so it can be mounted a second time (inside `metame-codex`) without any
  forking — the same "mirror a real tab into metaMe" pattern already used for `order-of-metaye`
  (KNYT) and the Venture Lab α mirror.
- **`/bridge/financial-services` and `/bridge/fs` already existed** (`components/journey/
  FinancialServicesBridgeFrontDoor.tsx`, dated 2026-08-12) and already mount
  `HORIZEN_MONEYPENNY_JOURNEY` via `PilotJourneyTab`/`JourneyRunSurface` — no new bridge page was
  needed.
- **The Horizen `aigentme` ("Operate") stage's only surface is `aigentme-welcome`**, an iframe of
  `metame-codex?tab=aigent-me`. Its `completionEvidence` requires `focusDispositionRecorded`,
  recordable only inside that shell's Welcome Capsule (§24.8 Ceremony Capsule Principle).

## What shipped

1. **`data/activation-catalog.ts`** — new `moneypenny` entry (`gate: 'open'`,
   `tabSlug: 'moneypenny-orchestration'`, `sourceCartridge: 'metame'`). MoneyPenny's own cartridge
   already declares `permissions.view: ['*']`, so `open` matches its existing access posture.
2. **`data/codex-configs.ts`** (`METAME_CODEX`) — new `moneypenny` tabGroup + one tab
   (`metame-moneypenny-orchestration`, slug `moneypenny-orchestration`), gated by
   `activationId: 'moneypenny'`, rendering `MoneyPennyPanelTab` with `panel: 'service-orchestration'`
   — the exact component+prop the standalone cartridge's own Orchestration tab uses. Orchestration
   is the only panel mirrored: it is the mode chooser, never Advisor/Architect/Runtime directly.
3. **`supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql`** — seeds the
   `content_qubes` row (+ `content_qube_access_policies`, `gating_kind='free'`) the live
   `spineActivations.ts` backend requires before `activate('moneypenny')` can succeed. Not yet
   applied to any live database — see "SQL to run" below.
4. **`services/journey/operateDestinationProjection.ts`** (new) — the generic, reusable
   `journeyId → { catalogueItemId, defaultTab, availableModes? }` lookup the task asked for.
   Seeded with one entry: `horizen-moneypenny-admission → { moneypenny, moneypenny-orchestration,
   [advisor, architect, runtime] }`.
5. **`types/adaptiveExperience.ts`** + **`services/adaptive/journeySpineAdapter.ts`** —
   `JourneyProjectionContext` gained an optional `operateDestination` field, populated from the
   module above inside `buildJourneyProjectionContext`. AEE can now read the destination
   projection through the existing `AdaptiveInteractionContext.journey` path; it does not own or
   derive it.
6. **`services/adaptive/applicationProjectionManifest.ts`** — the `fs.operate` row now carries the
   same `operateDestination` value for documentary/audit consistency with the manifest AEE reads.
7. **`tests/moneypenny-catalogue-operate-destination.test.ts`** (new) — pins the catalogue entry,
   the tab wiring, the projection lookup, and — critically — that the Horizen `aigentme` stage's
   surface was **not** swapped.

## What was considered and deliberately NOT done

The literal reading of "FS Operate lands on Orchestration" would swap the `aigentme` stage's
surface from `aigentme-welcome` to a MoneyPenny-Orchestration embed. **This was implemented, then
reverted before shipping**, because the stage's own `completionEvidence` requires
`focusDispositionRecorded`, which is only recordable inside the `aigentme-welcome` shell's Welcome
Capsule. Swapping the surface would have made the `aigentme` stage — and therefore the whole
Horizen journey — permanently uncompletable. That is exactly the "otherwise completely unchanged"
constraint the task set (no change to constitutional state resolution, evidence, or admission
behavior), so the swap was not shipped.

Two safe follow-ups exist if a one-click auto-hop from Operate to Orchestration is still wanted:

- **A Welcome-Capsule CTA** (matching the aigentMe Capsule↔Layout contract, `CLAUDE.md`'s PARAMOUNT
  section) that reads `operateDestination` and offers "Continue to MoneyPenny Orchestration" once
  `focusDispositionRecorded` is already true — same-window tab switch inside the same
  `metame-codex` embed, no new surface. Deliberately not built this pass: that Capsule system is
  flagged PARAMOUNT with a documented regression history, and touching it wasn't necessary to close
  the actual gap (MoneyPenny had no card at all).
- **Do nothing further** — once the persona activates MoneyPenny from the now-existing catalogue
  card, the `moneypenny` tabGroup is a first-class, permanent tab in metaMe's own nav; reaching
  Orchestration after Operate is one additional click on an already-visible tab, not a dead end.

## Verification against the 10 items requested

| # | Item | Status |
|---|---|---|
| 1 | MoneyPenny catalogue card exists via the real architecture | ✅ `ACTIVATION_CATALOG` entry `moneypenny` |
| 2 | Clicking it opens the real MoneyPenny capability | ✅ same `MoneyPennyPanelTab`/`ServiceOrchestrationPanel` the standalone cartridge uses |
| 3 | Default tab is Orchestration | ✅ only panel mirrored is `service-orchestration` |
| 4 | `/bridge/financial-services` resolves | ✅ pre-existing (2026-08-12), confirmed live in code |
| 5 | `/bridge/fs` aliases to the same journey | ✅ pre-existing, same `FinancialServicesBridgeFrontDoor` |
| 6 | FS Operate lands on Orchestration | ⚠️ Not done as a surface swap — see "considered and NOT done" above. Destination is projected into AEE context and reachable via the new tab, one click from Operate. |
| 7 | Horizen Operate inherits the behavior, otherwise unchanged | ✅ stage, evidence, receipts, authority logic all byte-identical (diff is comment-only) |
| 8 | User can navigate away normally | ✅ ordinary tab, no special trap |
| 9 | No global preference mutated | ✅ everything is either a new static catalogue/tab entry or a pure per-journeyId lookup — no persona-level write |
| 10 | Existing tests stay green apart from known pre-existing failures | ✅ new test file passes (10/10); full suite run below |

## Tests / typecheck

- `tests/moneypenny-catalogue-operate-destination.test.ts` — 10/10 pass.
- `tests/journey-single-copilot.test.ts`, `journey-agent-scoped-embed.test.ts`, `dcir-aigentme.test.ts`
  (the three suites keyed on the `aigentme-welcome` fixture) — all still pass unchanged.
- `tests/journey-monotonic-admission.test.ts` (3 failing) and `tests/journey-admission-spine.test.ts`
  (3 failing) — confirmed **pre-existing on `origin/dev`** via `git stash` A/B comparison; unrelated
  to this change (my diff to `horizenMoneyPennyJourney.ts` is comment-only).
- `npx tsc --noEmit` — 682 pre-existing errors before and after (identical count via `git stash`
  A/B), zero new errors in any touched file.

## SQL to run

The migration file is committed at `supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql`.
No live database was written to from this session (no Supabase MCP connector was invoked). If your
deploy pipeline doesn't auto-apply new migration files before the next release, run this directly:

```sql
INSERT INTO public.content_qubes
  (id, series, content_kind, content_type, title, description, lifecycle_state)
VALUES
  ('00000000-0000-4000-8000-000000ac100f', 'metame', 'activation_tab', 'moneypenny',
    'MoneyPenny',
    'Aigent MoneyPenny — the Constitutional Financial Services Agent. Advisor, Architect, and Runtime orchestration.',
    'canonized')
ON CONFLICT (id) DO UPDATE SET
  series = EXCLUDED.series,
  content_kind = EXCLUDED.content_kind,
  content_type = EXCLUDED.content_type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  lifecycle_state = EXCLUDED.lifecycle_state;

INSERT INTO public.content_qube_access_policies
  (content_qube_id, gating_kind)
VALUES
  ('00000000-0000-4000-8000-000000ac100f', 'free')
ON CONFLICT (content_qube_id) DO UPDATE SET
  gating_kind = EXCLUDED.gating_kind;
```

Without this row, clicking "Activate" on the MoneyPenny card will fail server-side with
`content_qube-missing — migration not applied?` (the same failure mode the three prior seed
migrations above each document).

## Files changed

- `data/activation-catalog.ts`
- `data/codex-configs.ts`
- `services/journey/operateDestinationProjection.ts` (new)
- `services/journey/horizenMoneyPennyJourney.ts` (comment only)
- `services/adaptive/applicationProjectionManifest.ts`
- `services/adaptive/journeySpineAdapter.ts`
- `types/adaptiveExperience.ts`
- `supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql` (new)
- `tests/moneypenny-catalogue-operate-destination.test.ts` (new)

## Answers to the deliverable questions

- **MoneyPenny catalogue item ID:** `moneypenny`
- **Orchestration tab ID (inside metaMe):** `metame-moneypenny-orchestration` (slug `moneypenny-orchestration`); the standalone cartridge's own tab is `moneypenny-service-orchestration` (slug `service-orchestration`) — unchanged, still the reused source component.
- **Dev URLs:** `/bridge/financial-services` (canonical), `/bridge/fs` (alias) — both pre-existing; the new catalogue card appears in metaMe's own Activations tab once deployed.
