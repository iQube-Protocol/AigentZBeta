# Standalone Standing Canister (BACKLOG)

**Status:** BACKLOG — scoped, stubbed, not built.
**Date:** 2026-07-18
**Raised by:** operator direction during the CFS-035 invariant-engine build — "establish a
separate standing canister so we can manage standing properly independently of reputation and
then correlate them as need be. Let's stub for that and add creating a standalone standing
canister to the backlog."

---

## Problem

Standing (the veracity of a persona's declarations — `services/standing/standingScore.ts`) and
reputation (accrued adoption/contribution) are currently entangled: the composite blends
veracity and contribution in one computed score, and there is no store that manages standing as
its own primitive. The operator wants the two **decoupled** — standing managed independently, on
its own canister, and **correlated with reputation on demand** rather than fused.

## Proposed shape

A dedicated **Standing canister**, mirroring the existing DVN / cross-chain canister pattern:

- **Own store, own lifecycle.** Standing records live on the canister keyed by a **T2-safe
  `standingRef` commitment** (never the raw personaId — same rule as the DVN pipeline / HMS
  locker refs, CLAUDE.md PARAMOUNT). Each record carries `{ score, veracityScore,
  contributionScore, updatedAt }`.
- **Independent management.** Standing recomputation submits to the canister; reads come from it.
  Reputation stays in its own accrual path. Neither is the other's source of truth.
- **Correlation on demand.** A correlation view joins a standing record with a reputation
  snapshot and reports the divergence — the "correlate as need be" the operator asked for.

## What's stubbed already (this session)

`services/standing/standingCanister.ts` defines the intended surface so call sites can adopt the
interface now and the backing implementation can swap in without a call-site change:

- `CanisterStandingRecord` + `StandingReputationCorrelation` types.
- `isStandingCanisterEnabled()` — gates on `STANDING_CANISTER_ID` (unset ⇒ stub).
- `submitStandingToCanister` / `readStandingFromCanister` — no-ops until the canister is deployed
  (fall through to the local computation).
- `correlateStandingWithReputation` — the correlation shape (pure, works now).

The CFS-035 **standing-score Invariant Decision Node** (`services/invariants/nodes/standingScore.ts`)
is canister-agnostic — it projects the composite from the sub-scores wherever they are computed —
so it works against both the local computation and the future canister unchanged.

## The build (when chartered)

1. **Deploy the canister** (Motoko/Rust, mirroring the cross-chain service canister) with the
   record store + a query for the correlation view. Add `STANDING_CANISTER_ID` to the env
   allowlist (`scripts/create-env-production.js`).
2. **Wire the IC actor** — mirror `services/ops/icAgent.ts` + a Candid IDL binding (do NOT fork
   the DVN pipeline files; compose the shared actor factory).
3. **Migrate reads/writes** — `computeStandingScore` submits the recomputed record;
   standing-consuming surfaces read via `readStandingFromCanister` with the local computation as
   the fallback during migration.
4. **Correlation surface** — expose the standing↔reputation correlation where the operator needs
   it (Standing cartridge / admin diagnostics).
5. **T-tier canary** — a test asserting no raw personaId ever reaches the canister payload (mirror
   `tests/access-spine.test.ts`).

## Why deferred

The split is an infrastructure upgrade (own canister + IC actor + migration), not a functional
gap in standing today. The stub + the canister-agnostic node let the invariant-engine work
proceed now; the canister build is its own chartered increment.
