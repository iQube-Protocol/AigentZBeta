# Commit Brief: `2b4733d` — Publish real placeholder media, close admin-picker gap, add review/availability split [merge spec/moneypenny-mpy2-3]

| Field | Value |
|-------|-------|
| SHA | [`2b4733d`](https://github.com/iQube-Protocol/AigentZBeta/commit/2b4733d6ca7c0833c5a90ed01cd5395cb94eab79) |
| Author | Claude |
| Date | 2026-09-02T23:27:25Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Publish real placeholder media, close admin-picker gap, add review/availability split [merge spec/moneypenny-mpy2-3]

- Published real, existing, provenance-labeled placeholder media (a Studio
  Sora video + a Qriptopian "AigentMe Constitutional Companion" infographic)
  to MoneyPenny's financial-basics bridge section, using the real
  assignDraftAsset/publishPlacement mechanism (mirrored via direct
  authorized DB access, no SUPABASE_SERVICE_ROLE_KEY available in this
  sandbox). Demonstrated the replace-in-place flow with a real second
  publish cycle (revision 1 -> 2, verified draft/published divergence).
- QriptopianAdminTab.tsx: added MoneyPenny as a selectable bridge in the
  native Bridges admin picker — the section was already server-allowed but
  had no admin UI entry point at all. Reuses the same KnytsBridgeAdminPanel
  + PlacementAssetsPanel pair every other section uses.
- isMoneyPennyLearnVideoRequest(): widened the chat-route learn-video
  short-circuit from an exact-string match to natural phrasing, evaluated
  as a plain regex classifier before the LLM ever runs (A-08 safety
  property fully preserved — the LLM never decides the video block).
- Financial profile: added an explicit reviewed_at signal, separate from
  hasProfile. A successful compute/manual-entry pass proves data
  availability; hasPreparedFinancialProfile() now also requires an
  explicit "mark as reviewed" action. Continue to Operate stays ungated.
- Investigated (not delegated, after a rate-limited research agent):
  confirmed a real email/password sign-in flow exists but no test account
  is documented anywhere in the repo — named precisely as the remaining
  authenticated-acceptance blocker, distinct from the service-role-key gap.

tsc holds at 677; full vitest suite at 48 failed / 15 failed files, the
same pre-existing tracked set, zero new failures (53 MoneyPenny-specific
tests pass across 4 touched/new files).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

- Published real, existing, provenance-labeled placeholder media (a Studio
  Sora video + a Qriptopian "AigentMe Constitutional Companion" infographic)
  to MoneyPenny's financial-basics bridge section, using the real
  assignDraftAsset/publishPlacement mechanism (mirrored via direct
  authorized DB access, no SUPABASE_SERVICE_ROLE_KEY available in this
  sandbox). Demonstrated the replace-in-place flow with a real second
  publish cycle (revision 1 -> 2, verified draft/published divergence).
- QriptopianAdminTab.tsx: added MoneyPenny as a selectable bridge in the
  native Bridges admin picker — the section was already server-allowed but
  had no admin UI entry point at all. Reuses the same KnytsBridgeAdminPanel
  + PlacementAssetsPanel pair every other section uses.
- isMoneyPennyLearnVideoRequest(): widened the chat-route learn-video
  short-circuit from an exact-string match to natural phrasing, evaluated
  as a plain regex classifier before the LLM ever runs (A-08 safety
  property fully preserved — the LLM never decides the video block).
- Financial profile: added an explicit reviewed_at signal, separate from
  hasProfile. A successful compute/manual-entry pass proves data
  availability; hasPreparedFinancialProfile() now also requires an
  explicit "mark as reviewed" action. Continue to Operate stays ungated.
- Investigated (not delegated, after a rate-limited research agent):
  confirmed a real email/password sign-in flow exists but no test account
  is documented anywhere in the repo — named precisely as the remaining
  authenticated-acceptance blocker, distinct from the service-role-key gap.

tsc holds at 677; full vitest suite at 48 failed / 15 failed files, the
same pre-existing tracked set, zero new failures (53 MoneyPenny-specific
tests pass across 4 touched/new files).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/(shell)/moneypenny/components/FinancialProfilePanel.tsx` |
| Modified | `app/api/codex/chat/route.ts` |
| Added | `app/api/moneypenny/financial-profile/review/route.ts` |
| Modified | `app/api/moneypenny/financial-profile/route.ts` |
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Modified | `services/journey/financialSovereigntyEvidence.ts` |
| Modified | `services/journey/knytsBridgeEditorialConfig.ts` |
| Modified | `services/journey/moneyPennyEducationalMedia.ts` |
| Modified | `services/moneypenny/financialProfileSummary.ts` |
| Added | `supabase/migrations/20260902020000_financial_profile_qubes_reviewed_at.sql` |
| Modified | `tests/moneypenny-b2-prepare.test.ts` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |
| Added | `tests/moneypenny-financial-profile-reviewed.test.ts` |
| Modified | `tests/qriptopian-admin-bridges-tab.test.ts` |

## Stats

 18 files changed, 795 insertions(+), 32 deletions(-)
