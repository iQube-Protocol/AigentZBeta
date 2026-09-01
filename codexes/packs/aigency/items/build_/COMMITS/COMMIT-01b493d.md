# Commit Brief: `01b493d` — Merge MoneyPenny MPY2-1+MPY2-2: capability rail + Financial Profile

| Field | Value |
|-------|-------|
| SHA | [`01b493d`](https://github.com/iQube-Protocol/AigentZBeta/commit/01b493d288b0f1f322c73a2160293a36cbdab353) |
| Author | Claude |
| Date | 2026-09-01T16:04:29Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Merge MoneyPenny MPY2-1+MPY2-2: capability rail + Financial Profile

Merges spec/moneypenny-cartridge-upgrade (rebased onto current dev,
regression-neutral) — the capability-led navigation rail/overview hub
(MPY2-1) plus bank-statement-derived Financial Profile aggregates and a
candidate risk envelope (MPY2-2, SPEC-MPY-002 §5).

Financial Profile reuses the existing per-persona upload facility
(services/uploads/*, new 'financial_document' useKind), derives aggregates
via a pure, honest function (financialProfileAggregation.ts — an
unrecognized statement shape or missing balance column reports itself
rather than guessing a number), and persists only the derived state
(financial_profile_qubes, mirroring experienceQube.ts's meta/blak split) —
never a copy of the raw statement, which stays in persona_uploads.

Both Supabase migrations (persona_uploads.use_kind extension,
financial_profile_qubes table + RLS) have been applied to dev by the
operator and verified live before this deploy.

[merge spec/moneypenny-cartridge-upgrade]
```

## Body

Merges spec/moneypenny-cartridge-upgrade (rebased onto current dev,
regression-neutral) — the capability-led navigation rail/overview hub
(MPY2-1) plus bank-statement-derived Financial Profile aggregates and a
candidate risk envelope (MPY2-2, SPEC-MPY-002 §5).

Financial Profile reuses the existing per-persona upload facility
(services/uploads/*, new 'financial_document' useKind), derives aggregates
via a pure, honest function (financialProfileAggregation.ts — an
unrecognized statement shape or missing balance column reports itself
rather than guessing a number), and persists only the derived state
(financial_profile_qubes, mirroring experienceQube.ts's meta/blak split) —
never a copy of the raw statement, which stays in persona_uploads.

Both Supabase migrations (persona_uploads.use_kind extension,
financial_profile_qubes table + RLS) have been applied to dev by the
operator and verified live before this deploy.

[merge spec/moneypenny-cartridge-upgrade]

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |

## Stats

 1 file changed, 1 insertion(+), 1 deletion(-)
