# Commit Brief: `8954ca7` — add polity namespace to invariant CHECK constraints (unblocks polity seed ingest)

| Field | Value |
|-------|-------|
| SHA | [`8954ca7`](https://github.com/iQube-Protocol/AigentZBeta/commit/8954ca7ea0599f73dc7cec293e0863c4fabc76cf) |
| Author | Claude |
| Date | 2026-07-17T21:25:26Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add polity namespace to invariant CHECK constraints (unblocks polity seed ingest)

The Polity canonization pass added the polity namespace + inv.polity.160-174
to the seed crystal, but the ontology_classes/invariants/invariant_collections
namespace CHECKs were never widened — the ingest aborts on the polity ontology
class. Additive widening, same pattern as 20260713000000.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The Polity canonization pass added the polity namespace + inv.polity.160-174
to the seed crystal, but the ontology_classes/invariants/invariant_collections
namespace CHECKs were never widened — the ingest aborts on the polity ontology
class. Additive widening, same pattern as 20260713000000.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `supabase/migrations/20260720000000_polity_invariant_namespace.sql` |

## Stats

 1 file changed, 27 insertions(+)
