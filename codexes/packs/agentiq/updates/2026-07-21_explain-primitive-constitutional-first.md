# metaMe Threshold — `explain_primitive` answers constitutional-first

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** fix
**Charter:** PRD-THR-001 (metaMe Threshold) · surfacing defect found via a live "what is standing?" query

## The defect (surfacing, not canon)

A principal asked the Threshold "what is standing?" and the gateway returned an
operational scoring vector — importance / novelty / trust / need — with a
p0-shadow, 0.72-confidence tag. That looked like a canon gap. It is not.

**The constitutional definition of Standing is canonical and rich.** Verbatim,
ratified:

- `inv.constitutional.145` (canonical) — "Standing is operational confidence, not truth… it separates Use from Truth."
- `inv.polity.315` (canonical) — "Standing accrues to the person, not to the persona."
- `inv.polity.169` (canonical) — "Participant agents hold Standing but never citizenship."
- `inv.constitutional.018` — "Standing is confidence in the veracity of declarations, **not reputation**."
- `inv.constitutional.066` — "Identity… yields reputation, not standing."

The real defect was in the gateway tool. `explain_primitive` delegated 100% to
the IRE resolver (`POST /api/public/irl/resolve`), whose `ipeProjection.standing`
is **literally the `discovery.ranking` node's weight vector** (`DIMENSION_INVARIANT_SEED`
= importance/novelty/trust/need = `inv.reasoning.134–137`). That is the engine's
internal ranking landscape (`inv.reasoning.146`: "standing shapes the operational
potential landscape"), surfaced under the colliding word "standing." The tool
showed the machinery instead of the meaning.

## The fix (constitutional-first, canon-backed)

`explain_primitive` now answers in two clearly-separated layers:

- **Layer 1 — Constitutional definition (leads).** The verbatim ratified defining
  invariants, canonical statements first. Backed by a curated lead-set of **real,
  verified invariant ids** per primitive (standing, delegation, personhood,
  citizenship, authority, reputation, Polity Passport). An un-curated term falls
  back to a canon text search (highest-authority first). No content is invented —
  every statement is fetched verbatim from the live substrate.
- **`distinctions`** — the load-bearing "X is not Y" guards, each sourced from a
  named invariant: **Standing is personhood-bound (not persona-bound); Standing is
  NOT reputation; Standing never confers citizenship.** The tool can no longer
  equate Standing with reputation.
- **Layer 2 — Operational model (labelled).** The IRE/IPE resolver projection,
  explicitly marked as a p0-shadow ranking with its confidence — "the how, not the
  what" — with a caveat naming the discovery-ranking collision so it is never read
  as the definition.

### Files

- `app/api/public/irl/invariants/route.ts` — additive `ids=` read (comma-separated,
  capped, read-only, T2-safe) so Layer 1 fetches exact defining invariants in one call.
- `services/threshold/irlAdapter.ts` — `definePrimitive(term)` + the curated
  `PRIMITIVE_DEFINITIONS` map (verified ids) + fallback; `resolveCanon` kept as the
  Layer-2 operational fetch.
- `services/threshold/gateway.ts` — `explain_primitive` → `definePrimitive`; tool
  description now instructs the agent to lead with Layer 1.
- `tests/threshold-gateway.test.ts` — canary asserts `constitutionalDefinition.layer === 1`
  and `operationalModel.layer === 2` (constitutional-first is now contract).

## Scope note

Aletheon's broader proposal — a two-layer schema on the invariant model for every
term, three separate query tools (explain / show-canon / explain-implementation),
and "Threshold as a constitutional linting engine" — was **not** built here
(operator chose the bounded fix). It remains a ratify-before-build candidate.

## Deploy

No migration, no gate touched, no canon mutated. Read-only gateway change; ships
with the normal dev push.
