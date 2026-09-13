# IRL OS Workspace — Austin/EXP-P1 Reviewer Dossier (Capability-Aware Projection)

**Status:** Shipped. Closes the Austin/EXP-P1 reviewer experience by projecting the existing
Laboratory content into the Workspace, gated by the already-shipped capability-ladder system —
never a new resolver, never a parallel reviewer UI.

## What changed

Reused, unchanged: `InstrumentValidationPanel`, `CrystalObserverReviewPanel`
(`IndependentReviewPanel reviewerMode` + Observer Review decision submission), `ExpP1ReadinessTab`,
`ReviewerAgreementPanel`, `resolveCapability`, `getParticipantResearchWorkspaceAccess`,
`callerMayReadExperimentReview`.

New, small:
- `resolveEffectiveExperimentCapability` (`services/research/accessCapabilities.ts`) — the one
  cascade (`run > write > review`, else `read`) any UI/MCP/agent surface calls for "the highest
  ordinary rung this persona holds at this resource." High-risk capabilities stay orthogonal,
  exactly as `resolveCapability`'s own header already requires.
- `Track2StateSummary` (`components/research/Track2StateSummary.tsx`) — a deliberately minimal,
  read-only projection of Track 2 programme state. NOT a reviewer-mode retrofit of
  `Track2ProgrammePanel` (~7,000 lines, dozens of mutation controls) — judged too large to safely
  audit for completeness in this pass. Every mutating Track 2 route remains admin-only, unchanged;
  this is a UI-completeness gap, not a security one, and is named in the resolution record rather
  than silently left partial.

Loosened four Laboratory GET routes from admin-only to `isAdmin || callerMayReadExperimentReview`
(the same reviewer-read admission check the sibling Crystal readiness route already used):
`GET /api/research/track2/[experimentId]`, `GET /api/research/crystal/[experimentId]/rehearsal`,
`GET /api/research/crystal/[experimentId]/freeze`. (`instrument-falsification` GET was found
already correctly loosened.) Every mutation route beneath these is untouched.

Extended `GET /api/participation/workspace-capabilities` + `WorkspaceCapabilitiesPanel.tsx` with
four new experiment-bound sections (Instrument Validation, Track 2, Crystal + Independent Review)
and a server-resolved capability badge — generalized around the canonical workspace/experiment
grant, never hardcoded to Austin or EXP-P1: any reviewer granted the same resource/capability
combination gets the identical projection.

## Files changed

- `services/research/accessCapabilities.ts` — added `resolveEffectiveExperimentCapability`.
- `app/api/participation/workspace-capabilities/route.ts` — four new capability flags +
  `effectiveCapability`.
- `components/research/WorkspaceCapabilitiesPanel.tsx` — four new sections + capability badge.
- `components/research/Track2StateSummary.tsx` — new, read-only.
- `app/api/research/track2/[experimentId]/route.ts` — GET loosened.
- `app/api/research/crystal/[experimentId]/rehearsal/route.ts` — GET loosened.
- `app/api/research/crystal/[experimentId]/freeze/route.ts` — GET loosened.
- `tests/irl-os-workspace-capability-projection.test.ts` — new, 6 tests.
- Resolution record + candidate invariant (below).

## Austin-equivalent acceptance verification

Real principal used: research-lab reviewer grant `19d67c72-2194-45ab-8310-c48fba242c32`, persona
`601ec26e-bd50-43d0-8dfb-5bfeca8bdfd3` ("Brozi"), `allowed_experiments` including `EXP-P1`. A
`review` capability row (`scope_type: experiment`, `scope_ref: EXP-P1`) was attached to this grant
for this pass, via direct Supabase access (no `SUPABASE_SERVICE_ROLE_KEY` was available in this
session's local environment to invoke the real TS functions end-to-end as a script, so verification
composed **direct read of the live `access_grants`/`access_grant_capabilities` rows** the
authorization functions query, plus **unit tests exercising the real functions** against an
equivalent seeded fake dataset — not a literal authenticated HTTP walkthrough as Austin, which would
have required fabricating a login credential this session does not have. That gap is named
explicitly, per this repo's No-Guessing rule, rather than glossed over.

Verified:
1. Austin's grant carries `EXP-P1` in `allowed_experiments` (read entitlement, confirmed live).
2. Exactly one `access_grant_capabilities` row exists for this grant: `review` @ `experiment:EXP-P1`
   (confirmed live) — no `run`, `write`, or any high-risk capability row exists anywhere for this
   grant, so `resolveCapability` returns `no-matching-capability` for all of them (verified by
   reading the gate's own query logic against the live row set, and by the unit tests below against
   an identical seeded shape).
3. `resolveEffectiveExperimentCapability` unit-verified (6 tests, real function, fake DB): returns
   `read` with no capability row; returns `review` with only a `review` row (Austin's actual case);
   cascades to `run` when a `run` row is also present; never leaks a capability granted at a
   different `experimentId`; ignores an expired row and falls back down the cascade; fails closed to
   `read` for an unknown persona.
4. **Revocation test (live DB):** flipped the `review` row to `status: 'revoked'`; the exact query
   `resolveCapability` runs then matched zero rows (confirmed live) — effective capability falls
   back to `read`. Restored to `active` afterward so Austin's real grant is left in the intended
   `review` state, not broken by this test.
5. Server-side security does not depend on the UI: every mutation/run route this dossier touches
   (Track 2's ~11 mutating routes, Crystal freeze/rehearsal/execution-rehearsal POST) remains gated
   on `isAdmin` or `resolveCapability('run'/high-risk)`, unchanged by this pass — none of them was
   loosened; only GETs were.

## Machine parity

`GET /api/participation/workspace-capabilities` is a plain authenticated JSON endpoint (via
`getActivePersona`) — it already serves human UI and any programmatic/agent caller identically; no
second MCP-specific authorization path exists or was built. `resolveCapability` and
`resolveEffectiveExperimentCapability` are the same functions both would call. **Not verified in
this pass:** an actual delegated-agent bearer-token call through this route, since no delegate
credential was available in this session — flagged as a remaining verification gap, not claimed as
proven.

## Resolution record

`codexes/packs/agentiq/resolution-records/records/RES-2026-09-12-IRL-OS-WORKSPACE-CAPABILITY-PROJECTION-001.json`
+ candidate invariant
`CI-2026-09-12-CAPABILITY-CASCADE-IS-ONE-FUNCTION-001.json` (status: `candidate` — not
self-ratified, per this repo's rule that an agent must not raise a candidate above `validated`).

**Pre-existing, unrelated defect found while running `npm run report:resolutions`:** two older
candidate-invariant files (`CI-2026-09-05-BATCH-PER-ITEM-SUBSTRATE-READS-BY-GROUPING-KEY-001.json`,
`CI-2026-09-05-FROZEN-GENERATIONS-IMMUTABLE-LINEAGES-EVOLUTIONARY-001.json`) are missing the
`projections` field the validator requires, crashing the report script for the whole registry. Not
caused by this pass and not fixed here (scope discipline) — flagged for a separate, deliberate fix.

## Known, named gaps (not silently left partial)

- Track 2's full grooming UI has no reviewer-safe mode; Workspace shows a minimal read-only summary
  instead. Server-side mutation gating is unaffected.
- MCP/delegated-agent parity is architectural, not behaviorally proven end-to-end (no delegate
  credential available this session).
- `crystal_groom` / `freeze_unfreeze` wiring remains an open operator decision from the 2026-10-01
  handoff, untouched by this pass, per the operator's explicit instruction to leave it be.
