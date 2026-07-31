# Commit Brief: `1b7c2f8` — harden aigentMe Capsule/Layout contract — single activator + guardrails

| Field | Value |
|-------|-------|
| SHA | [`1b7c2f8`](https://github.com/iQube-Protocol/AigentZBeta/commit/1b7c2f815589b2c32b83164cec12a0b79e7df571) |
| Author | Claude |
| Date | 2026-05-28T15:13:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
harden aigentMe Capsule/Layout contract — single activator + guardrails

- AigentMeWelcomeSplitTab: introduce CAPSULE_LAYOUT mapping (single source
  of truth) + engageCapsuleAndMount helper that atomically sets both
  activeCapsuleId and activeLayoutId. Both left-pane handleCtaClick chips
  and chat-copilot quickPrompts.onSelect handlers now route through it,
  eliminating drift between the two states.

- ComposerLayout: add OVERLAY CONTRACT docblock at the top of the file
  calling out the disallowed onRequestLayout('stack') pattern and naming
  the 2026-05-28 capsule-disappearance regression, so future agents
  don't reintroduce the layout swap "as a fallback".

- CLAUDE.md: new PARAMOUNT rule 'aigentMe Capsule ↔ Layout Contract' with
  canonical mapping table, four rules, failure history, and reference
  docs.

- agentiq/updates: new dev note 2026-05-28_aigentme-capsule-layout-contract.md
  registered in collections.json (col_updates), with background, mapping,
  failure history, guardrails in place, and a repro recipe.
```

## Body

- AigentMeWelcomeSplitTab: introduce CAPSULE_LAYOUT mapping (single source
  of truth) + engageCapsuleAndMount helper that atomically sets both
  activeCapsuleId and activeLayoutId. Both left-pane handleCtaClick chips
  and chat-copilot quickPrompts.onSelect handlers now route through it,
  eliminating drift between the two states.

- ComposerLayout: add OVERLAY CONTRACT docblock at the top of the file
  calling out the disallowed onRequestLayout('stack') pattern and naming
  the 2026-05-28 capsule-disappearance regression, so future agents
  don't reintroduce the layout swap "as a fallback".

- CLAUDE.md: new PARAMOUNT rule 'aigentMe Capsule ↔ Layout Contract' with
  canonical mapping table, four rules, failure history, and reference
  docs.

- agentiq/updates: new dev note 2026-05-28_aigentme-capsule-layout-contract.md
  registered in collections.json (col_updates), with background, mapping,
  failure history, guardrails in place, and a repro recipe.

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-28_aigentme-capsule-layout-contract.md` |
| Modified | `components/metame/welcome/layouts/ComposerLayout.tsx` |

## Stats

 5 files changed, 240 insertions(+), 18 deletions(-)
