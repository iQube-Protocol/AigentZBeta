# Commit Brief: `510e7b3` — Wire CFS content pack into CI/KNYTS Discover-Cross stages

| Field | Value |
|-------|-------|
| SHA | [`510e7b3`](https://github.com/iQube-Protocol/AigentZBeta/commit/510e7b30fc7321fcf089201300a75a8017b0be05) |
| Author | Claude |
| Date | 2026-09-03T13:23:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire CFS content pack into CI/KNYTS Discover-Cross stages

Extends the twelve fs-* bridge-stage placements (six stages x two bridges,
plus Learn's three lesson plates) into the existing knyts_bridge_editorial_
config allow-list and native Admin -> Bridges panel (fsBridgeSectionKey/
fsLearnPlateSectionKey helpers, zero new tables/routes) so headline/copy/
infographic become admin draft->preview->publish editable per stage, same
pattern the View stage already uses.

Adds financialSovereigntyContent.ts (static topics/understanding-checks/
exercise summaries/CI+KNYTS contextual lines from CFS_Bridge_Content_Pack_
v1, with the brief's corrected Discover/Learn copy) and three small,
non-authoritative presentational components (FinancialSovereigntyStageExtras,
FinancialSovereigntyUnderstandingCheck, FinancialSovereigntyCostExample),
composed additively into FinancialSovereigntyIntroStage/PrepareCrossStage/
OperateStage. All existing functional pieces are preserved untouched:
LEARN_CONCEPTS acknowledgment gate, the live serviceCatalog + Compute
Financial Profile action, the MoneyPenny Financial Profile review embed,
the Cross ExperienceHandoff, and Operate's workspace-first default view.

Also fixes the pre-existing top-clipping bug on tall FS panels (top-aligned
scrollable containers instead of vertically-centered ones).

Asset publication (the 8 uploaded plates) and authenticated-admin browser
verification remain blocked in this sandbox: no test admin account, no
SUPABASE_SERVICE_ROLE_KEY, Threshold needs an interactive OAuth this
session can't run — same blockers recorded 2026-09-02. Per the wiring
brief's explicit instruction, this stops at that boundary rather than
bypassing it with direct DB writes or guessed credentials.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Extends the twelve fs-* bridge-stage placements (six stages x two bridges,
plus Learn's three lesson plates) into the existing knyts_bridge_editorial_
config allow-list and native Admin -> Bridges panel (fsBridgeSectionKey/
fsLearnPlateSectionKey helpers, zero new tables/routes) so headline/copy/
infographic become admin draft->preview->publish editable per stage, same
pattern the View stage already uses.

Adds financialSovereigntyContent.ts (static topics/understanding-checks/
exercise summaries/CI+KNYTS contextual lines from CFS_Bridge_Content_Pack_
v1, with the brief's corrected Discover/Learn copy) and three small,
non-authoritative presentational components (FinancialSovereigntyStageExtras,
FinancialSovereigntyUnderstandingCheck, FinancialSovereigntyCostExample),
composed additively into FinancialSovereigntyIntroStage/PrepareCrossStage/
OperateStage. All existing functional pieces are preserved untouched:
LEARN_CONCEPTS acknowledgment gate, the live serviceCatalog + Compute
Financial Profile action, the MoneyPenny Financial Profile review embed,
the Cross ExperienceHandoff, and Operate's workspace-first default view.

Also fixes the pre-existing top-clipping bug on tall FS panels (top-aligned
scrollable containers instead of vertically-centered ones).

Asset publication (the 8 uploaded plates) and authenticated-admin browser
verification remain blocked in this sandbox: no test admin account, no
SUPABASE_SERVICE_ROLE_KEY, Threshold needs an interactive OAuth this
session can't run — same blockers recorded 2026-09-02. Per the wiring
brief's explicit instruction, this stops at that boundary rather than
bypassing it with direct DB writes or guessed credentials.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |
| Added | `components/journey/FinancialSovereigntyCostExample.tsx` |
| Modified | `components/journey/FinancialSovereigntyIntroStage.tsx` |
| Modified | `components/journey/FinancialSovereigntyOperateStage.tsx` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Added | `components/journey/FinancialSovereigntyStageExtras.tsx` |
| Added | `components/journey/FinancialSovereigntyUnderstandingCheck.tsx` |
| Added | `services/journey/financialSovereigntyContent.ts` |
| Modified | `services/journey/knytsBridgeEditorialConfig.ts` |
| Added | `services/journey/useFsBridgeSection.ts` |
| Added | `tests/cfs-content-pack-integration.test.ts` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |
| Modified | `tests/qriptopian-admin-bridges-tab.test.ts` |

## Stats

 13 files changed, 1323 insertions(+), 39 deletions(-)
