# Commit Brief: `42f99e3` — CRP-003a Increment 3b: tier-gate the three Financial Services experiences

| Field | Value |
|-------|-------|
| SHA | [`42f99e3`](https://github.com/iQube-Protocol/AigentZBeta/commit/42f99e33bb89a8823ae115b01ed0c0df445e3a67) |
| Author | Claude |
| Date | 2026-07-17T14:37:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CRP-003a Increment 3b: tier-gate the three Financial Services experiences

Reuses the existing plan (GET /api/billing/plan) — no parallel tiering:
- Constitutional Preview (Run shadow): open to all
- Founder Office experience (agreement form/accept/authorize + authoritative
  run): gated on ventureLabAccess; upgrade banner + disabled controls otherwise
- Advanced: gated on venture_tier pro/elite (labelled)
Fails closed to preview-only if the plan can't be read. Admins get full access
via the plan route's admin override.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Reuses the existing plan (GET /api/billing/plan) — no parallel tiering:
- Constitutional Preview (Run shadow): open to all
- Founder Office experience (agreement form/accept/authorize + authoritative
  run): gated on ventureLabAccess; upgrade banner + disabled controls otherwise
- Advanced: gated on venture_tier pro/elite (labelled)
Fails closed to preview-only if the plan can't be read. Admins get full access
via the plan route's admin override.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/FinancialServicesTab.tsx` |

## Stats

 1 file changed, 45 insertions(+), 10 deletions(-)
