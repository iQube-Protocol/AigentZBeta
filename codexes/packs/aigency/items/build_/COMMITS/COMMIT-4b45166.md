# Commit Brief: `4b45166` — Add missing Invariant Intelligence tab to Polity Core cartridge

| Field | Value |
|-------|-------|
| SHA | [`4b45166`](https://github.com/iQube-Protocol/AigentZBeta/commit/4b451661d4ce69144fee2af3b57d210eb3a9e834) |
| Author | Claude |
| Date | 2026-07-04T04:28:43Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add missing Invariant Intelligence tab to Polity Core cartridge

The tab was only ever added to METAME_CODEX's polity-core mirror
section (pc-invariant-intelligence) — never to the actual
POLITY_CORE_CARTRIDGE constant, so it could never appear in the
canonical Polity Core cartridge regardless of the DB tab-merge fix.
Adds polity-core-invariant-intelligence to the constitution group,
pointing at the same already-registered col_invariant_intelligence
collection and constitutional-records/invariant-intelligence.md doc.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The tab was only ever added to METAME_CODEX's polity-core mirror
section (pc-invariant-intelligence) — never to the actual
POLITY_CORE_CARTRIDGE constant, so it could never appear in the
canonical Polity Core cartridge regardless of the DB tab-merge fix.
Adds polity-core-invariant-intelligence to the constitution group,
pointing at the same already-registered col_invariant_intelligence
collection and constitutional-records/invariant-intelligence.md doc.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 14 insertions(+)
