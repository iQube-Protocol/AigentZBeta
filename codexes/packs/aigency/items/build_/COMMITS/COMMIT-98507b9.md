# Commit Brief: `98507b9` — surface chrysalis work in cartridges: foundation/experiments tabs (agentiq) + invariant intelligence tab (polity core)

| Field | Value |
|-------|-------|
| SHA | [`98507b9`](https://github.com/iQube-Protocol/AigentZBeta/commit/98507b96a04426d1d40e79c7249ab188f3490ecf) |
| Author | Claude |
| Date | 2026-07-04T02:11:49Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
surface chrysalis work in cartridges: foundation/experiments tabs (agentiq) + invariant intelligence tab (polity core)

Root cause of 'I don't see any of this in the front end': the hand-curated cartridges in data/codex-configs.ts surface pack collections only through explicitly wired AgentiqCartridgeTab tabs — collections were registered in the packs but no tabs pointed at them. Added: Polity Core -> Invariant Intelligence tab (order 0.5, constitutional-records/invariant-intelligence.md); AgentiQ memory group -> Foundation tab (col_foundation, CFS-000..014) + Experiments tab (col_experiments, EXP-001/002). Session doc registered in col_updates with the full front-end visibility map + the remaining gap (live invariant-data browser is API-only today).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Root cause of 'I don't see any of this in the front end': the hand-curated cartridges in data/codex-configs.ts surface pack collections only through explicitly wired AgentiqCartridgeTab tabs — collections were registered in the packs but no tabs pointed at them. Added: Polity Core -> Invariant Intelligence tab (order 0.5, constitutional-records/invariant-intelligence.md); AgentiQ memory group -> Foundation tab (col_foundation, CFS-000..014) + Experiments tab (col_experiments, EXP-001/002). Session doc registered in col_updates with the full front-end visibility map + the remaining gap (live invariant-data browser is API-only today).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_cfs-013-014-coherence-cartridge-tabs.md` |
| Modified | `data/codex-configs.ts` |

## Stats

 3 files changed, 100 insertions(+), 1 deletion(-)
