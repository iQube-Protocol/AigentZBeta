# Commit Brief: `4bdd99c` — B.1 (1.5/3): metrics + actions move onto ACTIVATION_CATALOG entries — KPIs/NBAs now dynamically driven by the persona's Activations tab; declared all 7 catalog activations with their metrics + actions; metric registry is now a one-row edit per activation, no separate file

| Field | Value |
|-------|-------|
| SHA | [`4bdd99c`](https://github.com/iQube-Protocol/AigentZBeta/commit/4bdd99c7cf0b9f41808d55702eda9146cb66b071) |
| Author | Claude |
| Date | 2026-05-24T02:32:00Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
B.1 (1.5/3): metrics + actions move onto ACTIVATION_CATALOG entries — KPIs/NBAs now dynamically driven by the persona's Activations tab; declared all 7 catalog activations with their metrics + actions; metric registry is now a one-row edit per activation, no separate file
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `data/activation-catalog.ts` |
| Modified | `services/strategy/kpiResolver.ts` |
| Modified | `services/strategy/kpiTypes.ts` |

## Stats

 4 files changed, 163 insertions(+), 91 deletions(-)
