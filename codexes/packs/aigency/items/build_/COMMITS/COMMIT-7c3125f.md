# Commit Brief: `7c3125f` — CLAUDE.md: dual-source cartridge registration rule (hand-curated wins)

| Field | Value |
|-------|-------|
| SHA | [`7c3125f`](https://github.com/iQube-Protocol/AigentZBeta/commit/7c3125f382b6d9078474b850461a57bdf1549716) |
| Author | Claude |
| Date | 2026-05-26T09:55:18Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CLAUDE.md: dual-source cartridge registration rule (hand-curated wins)

New section "Cartridge / Codex Registration — Dual-Source Pattern"
documents the two registration paths (data/codex-configs.ts vs
auto-pack via packRegistry) so future agents don't repeat the
fb9f56bd ↔ b907029f flip-flop: when a duplicate appears, suppress
the pack-driven side via the packRegistry skip list, never remove
the hand-curated CODEX_DEFINITIONS entry.

Includes the disambiguation heuristic (id suffix -cartridge vs
-codex, interactive vs markdown-only tabs) and the historical
example so the rule is grounded in a concrete near-miss.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

New section "Cartridge / Codex Registration — Dual-Source Pattern"
documents the two registration paths (data/codex-configs.ts vs
auto-pack via packRegistry) so future agents don't repeat the
fb9f56bd ↔ b907029f flip-flop: when a duplicate appears, suppress
the pack-driven side via the packRegistry skip list, never remove
the hand-curated CODEX_DEFINITIONS entry.

Includes the disambiguation heuristic (id suffix -cartridge vs
-codex, interactive vs markdown-only tabs) and the historical
example so the rule is grounded in a concrete near-miss.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `CLAUDE.md` |

## Stats

 2 files changed, 30 insertions(+), 1 deletion(-)
