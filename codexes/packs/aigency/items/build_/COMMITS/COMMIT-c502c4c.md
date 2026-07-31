# Commit Brief: `c502c4c` — NBA cards: contextual title rewrites via LLM rerank

| Field | Value |
|-------|-------|
| SHA | [`c502c4c`](https://github.com/iQube-Protocol/AigentZBeta/commit/c502c4c82975eaf27d99c7a4505f93284f874cb0) |
| Author | Claude |
| Date | 2026-05-31T19:41:29Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
NBA cards: contextual title rewrites via LLM rerank

Operator-driven hardening: the catalogue labels ("Coordinate with
Marketa", "Generate a venture progress report") read generic on the
NBA cards even after the Venture iQube hydration landed because the
LLM rerank only emitted nbaPromptHints (the COMPOSE prompt) — not a
label override. So the cards stayed cold-open even when the underlying
strategy was rich.

Extend the rerank pipeline with nbaContextualTitles:

  services/orchestration/nbeLlmRerank.ts
    - SYSTEM_PROMPT gains a nbaContextualTitles rule: for each id in
      the order array, rewrite the catalogue label into a verb-first
      title that names the operator's actual venture / partner / goal
      ("Ask Marketa for a Metaiye Media partner proposal on Operation
      metaWill launch") within 140 chars. Skip the title when the LLM
      has no grounded signal — never invent a name.
    - NbeRerankResult gains nbaContextualTitles: Record<string,string>
    - Parser captures + validates the new field; returns empty record
      on no-key / parse-fail / no-LLM paths so callers don't crash.

  services/orchestration/briefBuilder.ts
    - BriefShape + MoveForwardResult gain optional nbaContextualTitles
    - Both paths thread rerank.nbaContextualTitles through to callers

  components/metame/cards/NextBestActionCard.tsx
    - NextBestActionData gains contextualTitle?: string|null
    - h4 title now renders contextualTitle ?? label

  app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx
    - Brief / Move-forward → NBA construction reads
      data.nbaContextualTitles?.[a.id] ?? null into contextualTitle,
      same pattern as the existing promptHint plumbing.

Falls through to catalogue label cleanly when:
  - ANTHROPIC_API_KEY unset
  - LLM call fails / returns unparseable JSON
  - The LLM judged no grounded signal exists for that NBA
  - The Venture iQube hasn't been ingested yet (no experienceGoals
    populated → LLM has nothing to anchor on)

Together with the Phase A2 ExperienceQube hydration just shipped, the
next render of Brief / Move-forward should ground titles in Operation
metaWill's actual ventures + objectives. If titles still read generic
after the deploy + a re-ingest, the failure mode is one of: Anthropic
quota, the LLM judging no signal, or the experienceGoals not making it
through hydration — DevTools the /api/assistant/brief response and
look for nbaContextualTitles in the JSON.
```

## Body

Operator-driven hardening: the catalogue labels ("Coordinate with
Marketa", "Generate a venture progress report") read generic on the
NBA cards even after the Venture iQube hydration landed because the
LLM rerank only emitted nbaPromptHints (the COMPOSE prompt) — not a
label override. So the cards stayed cold-open even when the underlying
strategy was rich.

Extend the rerank pipeline with nbaContextualTitles:

  services/orchestration/nbeLlmRerank.ts
    - SYSTEM_PROMPT gains a nbaContextualTitles rule: for each id in
      the order array, rewrite the catalogue label into a verb-first
      title that names the operator's actual venture / partner / goal
      ("Ask Marketa for a Metaiye Media partner proposal on Operation
      metaWill launch") within 140 chars. Skip the title when the LLM
      has no grounded signal — never invent a name.
    - NbeRerankResult gains nbaContextualTitles: Record<string,string>
    - Parser captures + validates the new field; returns empty record
      on no-key / parse-fail / no-LLM paths so callers don't crash.

  services/orchestration/briefBuilder.ts
    - BriefShape + MoveForwardResult gain optional nbaContextualTitles
    - Both paths thread rerank.nbaContextualTitles through to callers

  components/metame/cards/NextBestActionCard.tsx
    - NextBestActionData gains contextualTitle?: string|null
    - h4 title now renders contextualTitle ?? label

  app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx
    - Brief / Move-forward → NBA construction reads
      data.nbaContextualTitles?.[a.id] ?? null into contextualTitle,
      same pattern as the existing promptHint plumbing.

Falls through to catalogue label cleanly when:
  - ANTHROPIC_API_KEY unset
  - LLM call fails / returns unparseable JSON
  - The LLM judged no grounded signal exists for that NBA
  - The Venture iQube hasn't been ingested yet (no experienceGoals
    populated → LLM has nothing to anchor on)

Together with the Phase A2 ExperienceQube hydration just shipped, the
next render of Brief / Move-forward should ground titles in Operation
metaWill's actual ventures + objectives. If titles still read generic
after the deploy + a re-ingest, the failure mode is one of: Anthropic
quota, the LLM judging no signal, or the experienceGoals not making it
through hydration — DevTools the /api/assistant/brief response and
look for nbaContextualTitles in the JSON.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/cards/NextBestActionCard.tsx` |
| Modified | `services/orchestration/briefBuilder.ts` |
| Modified | `services/orchestration/nbeLlmRerank.ts` |

## Stats

 4 files changed, 72 insertions(+), 8 deletions(-)
