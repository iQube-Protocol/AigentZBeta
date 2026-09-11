# Commit Brief: `1597f98` — CFS-035: invariant-derived discovery weighting — make the flip meaningful

| Field | Value |
|-------|-------|
| SHA | [`1597f98`](https://github.com/iQube-Protocol/AigentZBeta/commit/1597f98a163c26f47298f5ec89bdca406e98f08d) |
| Author | Claude |
| Date | 2026-07-16T17:28:56Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035: invariant-derived discovery weighting — make the flip meaningful

The discovery-ranking node's dimension weights now derive from the EARNED
standing of the discovery-governing invariants (via a cached Field Snapshot),
so the projection can DIVERGE from the incumbent magic numbers — the point at
which a shadow->authoritative flip stops being a no-op.

- discoveryRanking: DIMENSION_INVARIANT_SEED (importance/novelty/trust/need ->
  inv.reasoning.086-089, domain 'discovery') + deriveDimensionWeights (weight
  proportional to the governing invariant's standing, mean-normalised to 1 so
  the score scale is preserved and only the dimension balance shifts) + the
  weighted composite. Faithful (all weights 1) until those invariants exist,
  are validated, and earn standing — buildInvariantSlice only surfaces
  canonical/validated, so proposed/absent leaves it faithful automatically.
- getDiscoveryFieldSnapshot: per-instance 60s-TTL cached snapshot (domain
  'discovery'), guarded (null -> faithful) so the capsules hot path is safe.
- capsules route: passes the cached snapshot to the shadow run.

Flywheel: weights track EARNED standing, not mere existence (zero-standing ->
faithful), so a flip delivers improvement only once the discovery field has
proven itself. Verified faithful@zero + diverges@earned via harness.

Operator follow-on (ingest-gated, #36): seed inv.reasoning.086-089 with domain
'discovery' + validate them so the weights go live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The discovery-ranking node's dimension weights now derive from the EARNED
standing of the discovery-governing invariants (via a cached Field Snapshot),
so the projection can DIVERGE from the incumbent magic numbers — the point at
which a shadow->authoritative flip stops being a no-op.

- discoveryRanking: DIMENSION_INVARIANT_SEED (importance/novelty/trust/need ->
  inv.reasoning.086-089, domain 'discovery') + deriveDimensionWeights (weight
  proportional to the governing invariant's standing, mean-normalised to 1 so
  the score scale is preserved and only the dimension balance shifts) + the
  weighted composite. Faithful (all weights 1) until those invariants exist,
  are validated, and earn standing — buildInvariantSlice only surfaces
  canonical/validated, so proposed/absent leaves it faithful automatically.
- getDiscoveryFieldSnapshot: per-instance 60s-TTL cached snapshot (domain
  'discovery'), guarded (null -> faithful) so the capsules hot path is safe.
- capsules route: passes the cached snapshot to the shadow run.

Flywheel: weights track EARNED standing, not mere existence (zero-standing ->
faithful), so a flip delivers improvement only once the discovery field has
proven itself. Verified faithful@zero + diverges@earned via harness.

Operator follow-on (ingest-gated, #36): seed inv.reasoning.086-089 with domain
'discovery' + validate them so the weights go live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/runtime/capsules/route.ts` |
| Modified | `services/invariants/nodes/discoveryRanking.ts` |

## Stats

 2 files changed, 80 insertions(+), 4 deletions(-)
