# Commit Brief: `6c80af9` — enrich persona cards with full Nakamoto investment and historical data

| Field | Value |
|-------|-------|
| SHA | [`6c80af9`](https://github.com/iQube-Protocol/AigentZBeta/commit/6c80af9d2eea1af93e94024bb7dd652f943812b3) |
| Author | Claude |
| Date | 2026-03-24T10:36:37Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
enrich persona cards with full Nakamoto investment and historical data

- new GET /api/crm/personas/[id]/nakamoto joins persona email to
  nakamoto_knyt_personas and nakamoto_blak_qubes, fetches
  nakamoto_user_interactions and knyt_persona_rewards
- persona detail page now shows: profile image, profession, city,
  KNYT-ID, OM tier badge, Total Invested stat, social handles panel
  (Twitter/LinkedIn/Telegram/Discord/Instagram/GitHub/YouTube/TikTok),
  Web3 profile (EVM/BTC/MetaKeep/ThirdWeb keys, chain IDs, tokens,
  wallets of interest), Investment & Assets tab (investment summary,
  asset inventory: comics/posters/cards/characters, onboarding reward
  checklist), and Activity tab populated with real interaction history

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
