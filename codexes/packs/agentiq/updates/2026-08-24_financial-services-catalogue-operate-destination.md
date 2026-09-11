# Financial Services / AEE reference surface closeout — MoneyPenny metaMe Catalogue card + the metaMe Catalogue Destination Helper

**Date:** 2026-08-24 (two passes — see "Revision history" at the bottom)
**Branch:** `claude/fs-aee-catalogue-operate-destination`
**Parent:** `2026-08-24_aee-differ-phase0-audit-financial-services.md`, `2026-08-24_differ-scan-package-v1-financial-services.md`

## What this closes out

The operator asked to wire the generic Bridge → Operate → metaMe → metaMe Catalogue → destination
pattern through to MoneyPenny, then — after reviewing the first pass — asked to promote the
one-off destination lookup into a first-class, generalized **metaMe Catalogue Destination Helper**,
and to make the Financial Services Operate stage deep-link directly to MoneyPenny Orchestration
(never stopping at MyCanvas, the Catalogue page, or MoneyPenny's own root tab), with the
destination projection varying by Passport threshold state. This document reflects the final,
combined implementation.

## Audit findings

- **The "metaMe Catalogue" is the existing Activations system** (`data/activation-catalog.ts` +
  `ActivationsTab.tsx` + `services/activations/spineActivations.ts`, read via
  `useActivations()`/`ActivationsContext.tsx`). The **live** backend is `spineActivations.ts`
  (qube/DVN-backed) — `personaActivations.ts` is a parallel, unused implementation.
- **MoneyPenny had no catalogue entry** under any id — confirmed by scanning all 13 pre-existing
  entries.
- **`MoneyPennyPanelTab`** is a generic, context-free dispatcher already used by the standalone
  `moneypenny-codex` cartridge's own Orchestration tab (`panel: 'service-orchestration'` →
  `ServiceOrchestrationPanel`) — mountable a second time inside `metame-codex` with no forking.
- **`/bridge/financial-services` and `/bridge/fs` already existed** (`components/journey/
  FinancialServicesBridgeFrontDoor.tsx`, dated 2026-08-12) and already mount
  `HORIZEN_MONEYPENNY_JOURNEY` via `PilotJourneyTab`/`JourneyRunSurface` — no new bridge page was
  needed.
- **`getCodexBySlug()` / `getCodexById()` / `resolveLegacyTabSlug()`** (`data/codex-configs.ts`)
  already do exactly the alias-resolution work the Catalogue Helper needed — reused, not
  reinvented.
- **The Horizen `aigentme` ("Operate") stage's only surface is `aigentme-welcome`**
  (`metame-codex?tab=aigent-me`). Its `completionEvidence` requires `focusDispositionRecorded`,
  recordable only inside that shell's Welcome Capsule (§24.8 Ceremony Capsule Principle). This is a
  real constraint that the "deep-link directly to Orchestration, never stop at a generic screen"
  requirement had to be reconciled with — see "The one real tension, and how it was resolved" below.

## What shipped

### 1. The metaMe Catalogue Destination Helper (new first-class module)

`services/journey/catalogueDestinationHelper.ts` — supersedes the earlier, simpler
`operateDestinationProjection.ts` from the first pass (deleted; nothing else referenced it after
migration). Two entry points:

- **`resolveOperatorDestination({ catalogueItemRef, tabRef }, navOptions?)`** — the generic,
  journey-agnostic resolver. Looks up the catalogue item in `ACTIVATION_CATALOG`, resolves its
  `sourceCartridge` to a real codex via the (also new, extracted) `embedSlugForSourceCartridge()` +
  `getCodexBySlug()`, resolves the requested tab (through `resolveLegacyTabSlug()` alias
  resolution), validates the tab actually belongs to the requested activation, and returns a
  routable `ResolvedOperatorDestination` (`catalogueItemId`, `cartridgeRef`, `cartridgeSlug`,
  `tabId`, `tabSlug`, `route` via `buildCodexUrl()`, `activationIntent`). **Never creates catalogue
  truth** — every field traces to a real `ACTIVATION_CATALOG` or `CodexConfig` record. **Fails
  visibly**: an unresolvable catalogue item, cartridge, or tab returns `{valid: false,
  failedLookup, reason}` naming exactly which lookup failed — never a silent fallback to a generic
  tab.
- **`resolveJourneyOperatorDestination({ journeyId, participantState, navOptions? })`** — the
  threshold-aware wrapper. `JOURNEY_OPERATOR_DESTINATIONS` is the **only** per-journey data (today:
  `horizen-moneypenny-admission → { moneypenny, moneypenny-orchestration, [advisor, architect,
  runtime] }`); the resolution logic itself is completely journey-agnostic — a second consumer is a
  new map entry, never new branching code. `participantState.citizenPassportUsable` (supplied by
  the caller — the helper never derives Passport truth itself) selects `PRE_PASSPORT` /
  `PUBLIC_ORIENTATION` or `POST_PASSPORT` / `CATALOGUE_ACTIVATION`.
- **`registeredJourneyIds()`** — backs the validation gate (see below).
- **`resolveOperateDestination(journeyId)`** — a thin back-compat shape (`{catalogueItemId,
  defaultTab, availableModes?}`, no threshold logic) kept specifically for the AEE adapter/manifest,
  which want the plain declared destination rather than a live resolution.

**Extraction, not duplication:** `SOURCE_CARTRIDGE_EMBED_SLUG` / `embedSlugForSourceCartridge()`
used to be a private copy inside `ActivationsTab.tsx` (its "copy embed URL" affordance). Moved to
`data/activation-catalog.ts` as the single source of truth; `ActivationsTab.tsx` now imports it
too — inv.engineering.036/037.

### 2. Validation gate (closeout brief item 6 / item 18)

`tests/moneypenny-catalogue-operate-destination.test.ts`'s "Validation gate" block calls
`registeredJourneyIds()` and asserts `resolveJourneyOperatorDestination(...)` returns `valid: true`
for every one of them. A future journey whose registered catalogue item or tab is renamed/removed
fails this test immediately, by name, rather than shipping a silently-broken destination. The same
file also proves the resolver **generalizes**: it resolves `mycanvas`/`mycanvas` — a real,
pre-existing, unrelated catalogue item (the KNYTS/CI MyCanvas-remix precedent) — with no
MoneyPenny-specific code path, and separately proves three distinct fail-visibly cases (unknown
catalogue item, unknown tab, tab that belongs to a different activation than requested).

### 3. MoneyPenny metaMe Catalogue card (unchanged from the first pass)

- `data/activation-catalog.ts` — `moneypenny` entry (`gate: 'open'`, `tabSlug:
  'moneypenny-orchestration'`, `sourceCartridge: 'metame'`).
- `data/codex-configs.ts` (`METAME_CODEX`) — new `moneypenny` tabGroup + tab
  (`metame-moneypenny-orchestration`, slug `moneypenny-orchestration`), rendering
  `MoneyPennyPanelTab` with `panel: 'service-orchestration'`.
- `supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql` — seeds the
  `content_qubes` row the live `spineActivations.ts` backend requires. **Not yet applied to any
  live database** — exact SQL below.

### 4. The one real tension, and how it was resolved (refined twice — read this in order)

**First pass:** briefly swapped the `aigentme` stage's own surface to MoneyPenny Orchestration,
caught that its `completionEvidence` (`focusDispositionRecorded`) is only recordable inside the
`aigentme-welcome` shell's Welcome Capsule, and reverted before shipping — that swap would have made
the stage permanently uncompletable.

**Second pass:** implemented "deep-link directly to Orchestration" by gating it on BOTH Passport
AND the `aigentme` stage's own completion (`operateComplete`) — i.e., the direct deep-link only
activated once the focus-disposition ceremony was already done, with the Journey stepper shown
until then.

**Third pass, per explicit operator correction (this document's current state) — "separate metaMe
activation from aigentMe activation":** the second pass's `operateComplete` gate was **removed**.
The DEFAULT foregrounded content for a Passport-holding visitor at Operate is now MoneyPenny
Orchestration **unconditionally** — never gated on whether the aigentMe ceremony happened. aigentMe
is a separate agent/capability WITHIN metaMe, reachable through the SAME embed's ordinary
navigation (chrome is never suppressed — no `chrome=focused`/`depth=` on the resolved route) or
through the page's "View Journey" toggle, exactly as it always was. Journey guidance determines the
*default*, never the *maximum accessible depth*.

`horizenMoneyPennyJourney.ts` is **completely untouched** across all three passes (`git diff` shows
only a comment referencing the new module's name). `components/journey/
FinancialServicesBridgeFrontDoor.tsx` — the bare-page host both `/bridge/financial-services` and
`/bridge/fs` mount, NOT the shared `JourneyRunSurface`/`journeySurfaceRegistry.ts` plumbing every
other journey also depends on — tracks exactly one signal from the SAME observer read
`PilotJourneyTab` already performs (`onRuntimeStateChange`, threaded through as an optional,
additive prop with zero behavior change for the existing Partner-cartridge caller):
`citizenPassportUsable` (from the `passport` stage's evidence, same signal CI's bridge page already
derives the identical way).

Once that's true, the page swaps its primary content from the Journey stepper to a direct,
full-bleed embed of `resolveJourneyOperatorDestination(...).operatorDestination.route` — MoneyPenny
Orchestration, with no stop at MyCanvas, the Catalogue tab, or MoneyPenny's root, and no navigation
chrome suppressed. A "View Journey" toggle lets the operator reach the stepper on purpose (other
stages, receipts, progress, and — if they navigate to the aigentMe tab from there or from inside the
MoneyPenny embed's own metaMe nav — the existing aigentMe welcome/focus-disposition ceremony,
completely unchanged); a "Continue to MoneyPenny Orchestration →" banner switches back.

**Net effect:** every Passport-holding visit to Operate lands directly on MoneyPenny Orchestration,
with zero dependency on whether aigentMe's own ceremony has ever run. aigentMe's completion path is
exactly as it always was — reachable, unmodified, and never touched by MoneyPenny. MoneyPenny has
no code path that references, derives, or writes `focusDispositionRecorded` at all (asserted by a
grep-based canary test — see Tests below).

### 5. AEE integration

`types/adaptiveExperience.ts`'s `JourneyProjectionContext` carries an optional
`operateDestination` (`catalogueItemId`, `defaultTab`, `availableModes?`), populated by
`services/adaptive/journeySpineAdapter.ts`'s `buildJourneyProjectionContext()` via
`resolveOperateDestination()` — present only for a journey with a registered destination.
`services/adaptive/applicationProjectionManifest.ts`'s `fs.operate` row carries the same value for
audit-manifest consistency. AEE reads this; it does not own the catalogue item, cartridge, tab, or
journey truth — all of that remains `data/activation-catalog.ts` / `data/codex-configs.ts` /
`services/journey/horizenMoneyPennyJourney.ts`.

### 6. Companion

No Companion code changes this pass (per the brief — "No need to expand Companion functionality in
this pass"). The destination context is available through the same `JourneyProjectionContext` /
`AdaptiveInteractionContext` path the Companion seam already reads from, so a future pass can wire
narration ("You've reached Operate — MoneyPenny Orchestration is next") without new plumbing.

## Verification against the 18 items requested

| # | Item | Status |
|---|---|---|
| 1 | `/bridge/financial-services` exists, canonical FS/AEE route | ✅ pre-existing (2026-08-12), confirmed live in code |
| 2 | `/bridge/fs` resolves to the same journey | ✅ pre-existing, same `FinancialServicesBridgeFrontDoor` |
| 3 | MoneyPenny exists as a real metaMe Catalogue item | ✅ `ACTIVATION_CATALOG` entry `moneypenny` |
| 4 | Added through the canonical mechanism if absent | ✅ same pattern as all 13 existing entries + matching migration |
| 5 | MoneyPenny resolves to its real capability/cartridge | ✅ via the Catalogue Helper, `cartridgeRef: 'metame-codex'` (the mirror), same `MoneyPennyPanelTab` the standalone cartridge uses |
| 6 | Orchestration is a real, valid MoneyPenny tab/surface | ✅ `moneypenny-orchestration` tab, `panel: 'service-orchestration'` |
| 7 | Post-Passport Operate deep-links DIRECTLY to Orchestration | ✅ unconditionally, from the first Passport-holding visit — never gated on the aigentMe ceremony (see tension section above) |
| 8 | Does not stop at MyCanvas | ✅ |
| 9 | Does not stop at the Catalogue page | ✅ |
| 10 | Does not stop at generic MoneyPenny | ✅ — lands on Orchestration specifically, not the cartridge root |
| 11 | Pre-Passport users get the appropriate threshold/public projection | ✅ `PUBLIC_ORIENTATION` — the Journey's own existing Register/Claim/Orient/Passport stepper (no separate page invented — see note below) |
| 12 | Destination stays MoneyPenny Orchestration across the threshold | ✅ same `JOURNEY_OPERATOR_DESTINATIONS` entry drives both threshold branches |
| 13 | Horizen inherits the same destination, otherwise unchanged | ✅ `git diff` on `horizenMoneyPennyJourney.ts` is comment-only |
| 14 | Users can navigate elsewhere in metaMe after arriving | ✅ the Orchestration embed carries full metaMe nav chrome (not suppressed); "View Journey" toggle for the stepper |
| 15 | No global user preference mutated | ✅ every new module is either static catalogue/tab data or a pure per-request resolver; no persona-level write anywhere in this closeout |
| 16 | Fails visibly if catalogue/cartridge/tab topology is invalid | ✅ `{valid:false, failedLookup, reason}` — three cases covered by tests |
| 17 | Existing Journey Spine tests stay green apart from known failures | ✅ confirmed via `git stash` A/B — see Tests below |
| 18 | Helper tested against ≥2 destinations (FS + a KNYTS/CI one) | ✅ `moneypenny`/`moneypenny-orchestration` and `mycanvas`/`mycanvas`, both resolving through the same generic code path |

**Note on item 11:** Financial Services has no separate, bespoke "public/threshold orientation"
page distinct from the Journey's own Register → Claim → Orient → Passport stages — those stages
already ARE the pre-Passport, public-facing surface (this is the same shape as the Journey's
existing 'orient' stage). Inventing a second, parallel pre-Passport page for FS specifically would
have been exactly the "parallel Financial Services application" the brief explicitly forbids, so
`PUBLIC_ORIENTATION` resolves to "keep rendering the Journey stepper as it already does" rather
than a fabricated `metame.com`-style URL. This is a deliberate, honest scope decision, not an
oversight — flagged here rather than silently assumed.

## Tests / typecheck

- `tests/moneypenny-catalogue-operate-destination.test.ts` — 22/22 pass (generic resolver, threshold
  resolution, three fail-visibly cases, the validation gate, the AEE back-compat shape, the
  Horizen-stage-unchanged canary, a nav-chrome-not-suppressed assertion on the resolved route, and a
  grep-based canary proving no MoneyPenny source file references `focusDispositionRecorded`).
- `tests/journey-single-copilot.test.ts`, `journey-agent-scoped-embed.test.ts`, `dcir-aigentme.test.ts`
  (the three suites keyed on the `aigentme-welcome` fixture) — unchanged/passing.
- `tests/partner-workspace.test.ts` — unchanged/passing (confirms `PilotJourneyTab`'s new optional
  `onRuntimeStateChange` prop is additive; the Partner cartridge's own call site doesn't pass it).
- Three pre-existing, unrelated failures confirmed via `git stash` A/B comparison (identical with
  and without this change): `journey-monotonic-admission.test.ts` (3), `journey-admission-spine.test.ts`
  (3), `knyts-bridge-ci-parity.test.ts` (1) — none reference anything this closeout touched.
- `npx tsc --noEmit` — 682 errors before and after (identical count via `git stash` A/B); zero new
  errors in any touched file (confirmed by name-grepping the touched-file list against the error
  output).

## SQL — applied

The migration file is committed at `supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql`
and has been **applied to the live database** (Supabase project `bsjhfvctmduxhohtllly`, "Aigent Z" —
identified by checking which of the three Supabase projects visible to this session already held
all 14 existing `activation_tab` rows, not by guessing from the project name). Verified post-apply:

```
id: 00000000-0000-4000-8000-000000ac100f
content_type: moneypenny
title: MoneyPenny
lifecycle_state: canonized
gating_kind: free
```

For reference, the SQL that was run:

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

"Activate" on the MoneyPenny catalogue card no longer fails with
`content_qube-missing — migration not applied?`.

## Files changed (final, cumulative)

- `data/activation-catalog.ts` — `moneypenny` entry + extracted `SOURCE_CARTRIDGE_EMBED_SLUG`/`embedSlugForSourceCartridge`
- `data/codex-configs.ts` — MoneyPenny tabGroup + tab in `METAME_CODEX`
- `app/triad/components/codex/tabs/ActivationsTab.tsx` — imports the extracted embed-slug map instead of a private copy
- `app/triad/components/codex/tabs/PilotJourneyTab.tsx` — new optional `onRuntimeStateChange` passthrough prop
- `components/journey/FinancialServicesBridgeFrontDoor.tsx` — direct-to-Orchestration deep-link, threshold- and completion-aware
- `services/journey/catalogueDestinationHelper.ts` (new) — the metaMe Catalogue Destination Helper; supersedes `operateDestinationProjection.ts` (deleted)
- `services/journey/horizenMoneyPennyJourney.ts` (comment only — module name reference)
- `services/adaptive/applicationProjectionManifest.ts`
- `services/adaptive/journeySpineAdapter.ts`
- `types/adaptiveExperience.ts`
- `supabase/migrations/20260824000200_seed_moneypenny_activation_qube.sql` (new)
- `tests/moneypenny-catalogue-operate-destination.test.ts` (new/rewritten, 19 tests)

## Answers to the deliverable questions

- **MoneyPenny catalogue registration existed?** No — confirmed absent, added.
- **MoneyPenny canonical catalogue ID:** `moneypenny`
- **MoneyPenny cartridge/capability ID (as mirrored into metaMe):** `metame-codex` (tab
  `metame-moneypenny-orchestration`); the standalone source cartridge is `moneypenny-codex` (its own
  tab `moneypenny-service-orchestration`, unchanged, still the reused component).
- **Orchestration canonical tab ID:** `metame-moneypenny-orchestration` (slug `moneypenny-orchestration`)
- **Generic destination-helper location/API:** `services/journey/catalogueDestinationHelper.ts` —
  `resolveOperatorDestination()`, `resolveJourneyOperatorDestination()`, `registeredJourneyIds()`,
  `resolveOperateDestination()` (AEE back-compat).
- **Pre-Passport behavior:** Journey stepper as today (Register → Claim → Orient → Passport) — see
  the item-11 note above for why no separate page was invented.
- **Post-Passport behavior:** every visit lands directly on MoneyPenny Orchestration by default,
  unconditionally — the aigentMe welcome/focus-disposition ceremony is a separate, still-fully-
  functional path reachable through the same embed's ordinary navigation or the "View Journey"
  toggle, never a gate on reaching MoneyPenny.
- **Horizen inheritance result:** Zero change to `horizenMoneyPennyJourney.ts` beyond one comment;
  stages/evidence/receipts/authority logic byte-identical.
- **Dev URLs:** `/bridge/financial-services` (canonical), `/bridge/fs` (alias) — both pre-existing.
- **Genuine remaining blocker:** none. The migration SQL has been applied to the live database
  (verified above) — "Activate" on the MoneyPenny card will succeed. Live browser verification
  against `dev-beta.aigentz.me` was not performed from this sandbox — recommend a check once
  Amplify finishes building `dev`.

## Revision history

- **2026-08-24, first pass:** shipped the catalogue card + a simple per-journey `journeyId ->
  {catalogueItemId, defaultTab}` map; deliberately did NOT deep-link Operate to Orchestration
  because of the `focusDispositionRecorded` constraint, and flagged two possible follow-ups.
- **2026-08-24, second pass:** promoted the map into the generalized metaMe Catalogue Destination
  Helper, added threshold-aware (Passport) resolution and the validation gate, and implemented a
  direct-to-Orchestration deep-link gated on BOTH Passport AND the `aigentme` stage's own
  completion.
- **2026-08-24, third pass (current, supersedes the second's gating) — operator correction:**
  "separate metaMe activation from aigentMe activation." Removed the `aigentme`-completion gate:
  MoneyPenny Orchestration is now the unconditional default at Operate once Passport is
  established; the aigentMe ceremony remains reachable, unmodified, and fully independent — never a
  precondition for reaching MoneyPenny. Added tests asserting navigation chrome/depth is preserved
  and that no MoneyPenny source references `focusDispositionRecorded`.
