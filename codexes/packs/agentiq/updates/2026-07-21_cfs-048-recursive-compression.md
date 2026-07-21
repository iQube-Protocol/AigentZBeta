# CFS-048 — Recursive compression (parent-child keystone)

**Date:** 2026-07-21
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

The first live Compare run compressed independently-discovered sub-domain
invariants into earned **domain** invariants (10 sub-domains → one accountability
invariant, etc.). The next keystone the operator + Aletheon identified: some of
those domain invariants **compress into each other** (Risk Management is
downstream of Cybersecurity + Data Protection; a Harmonized Regulatory Framework
derives from Accountability + Transparency). This ships that second-order pass.

## What it does

`compressDomainInvariants(admin, domain)` — a **recursive compression** over the
domain's own earned invariants (Compare outputs + any domain baseline, `candidate`
OR `promoted`). A deterministic (temp 0), strictly-grounded LLM pass classifies
each as:

- **root** — foundational; does not derive from another invariant in the set (a
  **constitutional candidate** for the domain).
- **derived** — entailed by / a specialisation of / a consequence of one or more
  OTHER invariants; `derivesFrom` names the parents.

Defensive: parent indices must be in range, never self, deduped; the result is
acyclic. The classification is persisted **additively** into each candidate's
`discovery_provenance.compression = { depth, derivesFromCandidateIds, rationale }`
— it never touches confidence, status, or promotion (structure discovery, not
validity — Law XII). Because parents are recorded per candidate, **promotion can
later materialise the hierarchy as `specializes` edges** via the existing
`promoteCandidate` / `linkPromotedParents` machinery (roots promote first, then
derived children carry their roots as parents).

## Surfaces

- Service: `services/invariants/discoveryEngine.ts` — `compressDomainInvariants`,
  `DomainCompressionNode`, `CandidateRow.compression` (+ `parseCompression`).
- Route: `POST /api/invariants/discovery` action `compress-domain`.
- UI (`InvariantDiscoveryTab`): a **"Compress (recursive)"** button beside
  Compare (domain-baseline scope). Candidate cards show a **◆ Root** or
  **→ Derived (N)** badge (tooltip = the derivation rationale). The run notice
  reports a **depth compression ratio** — `total → roots` (e.g. `6 → 3 = 2.0:1`),
  a second-order compression metric alongside Compare's sub-domain ratio.

## Canary

`tests/discovery-scope-convergence.test.ts` → "Recursive compression discipline":
≥2-invariant guard, strict grounding (no invented relationships), acyclic +
self-ref/out-of-range parent drop, root/derived rule, additive provenance merge,
and that the function never writes confidence/status/canonize (structure only).

## Not done here (deliberate)

- **Edge materialisation on promotion** for domain→domain derivation (the current
  `linkPromotedParents` handles sub-domain→domain; extending it to the recursive
  layer is a small follow-on).
- **Full graph visualisation** of the hierarchy (the badges + tooltips are the v1
  read; a tree/graph view is a later surface).
- Promotion of these as `proposed`, never `canonical` — unchanged discipline.
