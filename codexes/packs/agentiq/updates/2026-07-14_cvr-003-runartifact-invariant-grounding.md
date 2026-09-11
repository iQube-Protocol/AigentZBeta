# CVR-003 (candidate) — runArtifact invariant grounding + cited-invariant recording

**Constitutional Validation Run 003 (candidate).** Makes the Artifact Runtime itself
invariant-AWARE: every non-disposable production now resolves the canonical invariants it
reasons under, carries them on the result / the constitutional object / the durable record,
and cites them through the consequence return path (Reach). Commissioned directly by the
operator after the "is the AR/CPS invariant aware and driven yet?" audit found the composition
engine grounded (via `buildInvariantSlice`) but the runtime blind to it.

**Date:** 2026-07-14 · **Harness:** Claude Code (D1 — execution stays human) · **Pattern precedent:** CVR-001/CVR-002 stage order; the `_evidence`/`WithEvidence` non-contract carrier; CFS-006 §4 consequence return path

## Intent

> `runArtifact` consumes the composition's grounded invariant ids when present, else resolves a
> live profile-scoped slice; the cited ids ride the result (`groundingOf`), the
> ConstitutionalObject (payload + `authority.governingInvariants`), and — via the record seams —
> `artifact_records.cited_invariant_ids`; consequential runs cite the invariants for Reach
> (Law XII: adoption, never Standing); disposable runs never ground and never cite.

## Capability Evidence (gathered by reconnaissance, not asserted)

- EXISTING · `services/composition/composeArtifact.ts` already grounds compositions via
  `buildInvariantSlice` and exposes them on `CompositionResult.grounded.invariantIds`
  (`types/composition.ts:GroundedComponent`). The runtime consumes `input.result` but ignored
  `grounded` entirely. [consume, never fork]
- EXISTING · `services/invariants/grounding.ts` — `buildInvariantSlice(context)` (statuses
  canonical+validated, `rankByStanding`, default limit 12) returning `citedIds`;
  `citeInvariants(ids)` bumping usage → **Reach only** (Law XII stated in its own header;
  best-effort by contract). [use_directly]
- EXISTING · `services/artifact/runArtifact.ts` — the tier router: disposable | operational |
  constitutional runners, `buildArtifactObject` with static
  `governingInvariants: ['CFS-025']`, the `_evidence`/`WithEvidence` additive-extra pattern,
  `findForbiddenObjectKey` T0 guard. [extend]
- EXISTING · `services/artifact/artifactRecordStore.ts` — best-effort, soft-fail insert; schema
  (migration 20260712000000) has NO cited-invariants column. [extend + migration]
- EXISTING · record-writing callers: `softwarePilot`, homecoming `produce` route (both call
  `saveArtifactRecord` directly off a `runArtifact` result — the two seams that can thread the
  grounding today); `studioArtifactTiering`/`businessArtifactTiering` classify route payloads
  without a runArtifact result in hand. [wire the first two; the tierings are a named follow-on]
- EXISTING · observers: `/api/research/overview` + `/api/composer/artifact-production` project
  `recentRecords` off `listArtifactRecords` (`select('*')` — new column flows for free). [extend projection]
- NEVER · touch dvn/identity/access/encryption files · widen the ratified `ArtifactResult`
  contract · block or fail a production on grounding I/O · let disposable runs read the crystal
  or inflate Reach · put anything but public knowledge-object ids in the record (T2-safe by
  construction).

## Constitutional Decision (taken before implementation)

**Mechanism: `code`** — extend three existing seams; nothing parallel. The grounding resolver,
the citation path, and composition-grounded ids ALL already exist; the runtime just doesn't
consume or record them. Alternatives rejected:
- *Ground inside every caller* — forks the same resolve+cite logic across pilots/routes (CS-001).
- *Ground only from composition, no live fallback* — most operational runs (softwarePilot,
  homecoming) build a minimal `ArtifactCompositionInput` without engine grounding; they would
  stay blind forever.
- *Widen `ArtifactResult` with a grounding field* — the result contract is ratified; the
  `_grounding`/`WithGrounding` additive extra mirrors the accepted `_evidence` pattern instead.

Resolution order (the compose-never-fork rule applied to data): composition-supplied ids WIN
(`source: 'composition'`, zero new I/O); else a live profile-scoped slice
(`source: 'live'`, limit 8, dynamic import so the propose path takes no hard DB dependency);
any failure degrades to `source: 'none'` and production proceeds — grounding informs the
record, it never gates it.

| Profile | Grounding namespaces |
|---|---|
| research | constitutional, epistemology, reasoning |
| software | constitutional, engineering |
| white-paper | constitutional, narrative, epistemology |
| multimedia | constitutional, style, narrative |
| (all others) | constitutional, engineering (default) |

**`noBuildRequired: false`** — alternative `none` (leave the runtime ungrounded) rejected: an
invariant-driven platform whose own artifact runtime cannot say which invariants governed a
production fails the operator's discoverability principle, and EXP-006A's Reach stream needs
real production citations to observe.

## What was built (additive, surgical)

1. **`services/artifact/runArtifact.ts`** — `ArtifactGrounding` (`{ invariantIds, source:
   'composition'|'live'|'none' }`), `resolveGrounding` (composition-first, live fallback,
   fail-to-none), `PROFILE_GROUNDING_NAMESPACES`; grounding threaded through
   `runOperational`/`runConstitutional` (stage evidence names the grounding honestly) and
   `buildArtifactObject` (payload `groundedInvariantIds` + `groundingSource`;
   `authority.governingInvariants: ['CFS-025', ...ids]` — real citations replace the bare
   static label); the run seam resolves grounding for operational + constitutional, cites via
   `citeGrounding` (dynamic-import `citeInvariants`, awaited-with-catch), and attaches
   `_grounding`; exports `WithGrounding` + `groundingOf(result)`. Disposable path untouched —
   explicitly never grounds, never cites.
2. **`services/artifact/artifactRecordStore.ts`** — `SaveArtifactRecordInput.citedInvariantIds?`;
   sent only when non-empty, so on a pre-migration DB grounded saves soft-fail (logged) while
   every ungrounded save keeps working unchanged; `ArtifactRecordRow.cited_invariant_ids?`.
3. **`supabase/migrations/20260714000000_artifact_records_cited_invariants.sql`** —
   `cited_invariant_ids JSONB NOT NULL DEFAULT '[]'` (additive; pre-existing rows read `[]`).
4. **`services/artifact/pilots/softwarePilot.ts`** + **`app/api/homecoming/agent/produce/route.ts`**
   — the two record-writing runArtifact callers thread
   `citedInvariantIds: groundingOf(artifact).invariantIds` into `saveArtifactRecord`.
5. **Observer half** — `/api/research/overview` + `/api/composer/artifact-production`
   `recentRecords` projections gain `groundedInvariants` (count; 0 for pre-migration rows), so
   the lab copilot and Studio observer narrate grounding coverage, not just production.

## Constitutional Validation

- esbuild parse gates: **6/6** touched files (`--bundle --packages=external --alias:@=.`).
- Stub-bundle drill (esbuild + node, grounding + receipt modules stubbed with recording fakes
  whose shapes were verified against the real module signatures): **30/30** —
  composition ids consumed verbatim (`source 'composition'`, no live slice drawn); live
  fallback profile-scoped (research → [constitutional, epistemology, reasoning], limit 8;
  unlisted profile → default); disposable never grounds/never cites; `citeInvariants` fired
  exactly once per operational and constitutional run with the resolved ids; constitutional
  object payload + `governingInvariants` carry the ids; propose-mode still writes no receipt;
  publish-mode passes the T0 guard with grounding attached; grounding outage degrades to
  `'none'` with production ok and no citation; `groundingOf` on a bare result returns the
  empty grounding.
- No ratified contract widened (`ArtifactResult` untouched; `_grounding` is the `_evidence`
  pattern); no forbidden file touched; no receipt semantics changed; invariant ids are public
  knowledge-object ids — T2-safe in the record, the object payload, and the observer projection.

## Operator action required

Run the migration (Supabase SQL editor):

```sql
ALTER TABLE public.artifact_records
  ADD COLUMN IF NOT EXISTS cited_invariant_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.artifact_records.cited_invariant_ids IS
  'CVR-003: canonical invariant ids (public knowledge-object ids, T2-safe) that grounded this production. Source: runArtifact groundingOf(result) or the composition grounded component.';
```

Until it runs, grounded saves soft-fail with the standard `[artifact records]` log line and
production continues response-only — nothing breaks, nothing blocks.

## Constitutional Receipt

- The implementation receipts are the session-branch commits carrying this increment + this run
  record. In-app receipted twin: any post-deploy constitutional publish through `runArtifact`
  now carries its grounded ids on the `artifact_published` receipt's object.

## Honest limits

- **Reach ≠ validation.** `citeInvariants` bumps usage/Reach only (Law XII). Standing accrual
  from production outcomes is EXP-006A's receipted design — deliberately NOT this seam.
- **The tiering seams don't ground yet.** `studioArtifactTiering` / `businessArtifactTiering`
  classify route payloads without a `runArtifact` result in hand, so their records carry no
  cited ids. Wiring them means either running those payloads through the runtime or accepting
  a caller-supplied grounding — named follow-on, not smuggled in here.
- **Live-fallback ids are scope-ranked, not content-matched.** The profile-namespace slice is
  "the top standing-ranked invariants in this profile's regions", not a semantic match against
  the artifact's content. Content-aware grounding (embedding/keyword context on
  `buildInvariantSlice`'s `GroundingContext`) is a quality follow-on.
- **Double-citation is possible when the composition already cited.** `composeArtifact`'s own
  flow may cite the slice it grounds with; a runtime run over that composition cites again.
  Reach is a usage counter, not a ledger — acceptable signal inflation at current volume,
  noted for the EXP-006 instrumentation pass.
- Migration is operator-run; until then grounded records exist only in responses/objects.
