# Commit Brief: `decbc07` — Revert "close IRL OS confidentiality breach: private-cartridge deep links + unauthenticated document routes + query-derived admin authority removed [merge sec/irl-os-containment-2026-08-27]"

| Field | Value |
|-------|-------|
| SHA | [`decbc07`](https://github.com/iQube-Protocol/AigentZBeta/commit/decbc07c8234961827ee04b046c5d1edc7415228) |
| Author | Claude |
| Date | 2026-08-27T09:02:18Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Revert "close IRL OS confidentiality breach: private-cartridge deep links + unauthenticated document routes + query-derived admin authority removed [merge sec/irl-os-containment-2026-08-27]"

This reverts commit e7021cfb299bcfdc80f3f7310e3262ed738547d4, reversing
changes made to a772be50744bc6f048bc36a86686c5d5b30c2a46.
```

## Body

This reverts commit e7021cfb299bcfdc80f3f7310e3262ed738547d4, reversing
changes made to a772be50744bc6f048bc36a86686c5d5b30c2a46.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` |
| Modified | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` |
| Modified | `app/(embed)/triad/embed/codex/page.tsx` |
| Modified | `app/api/codex/packs/[packId]/file/route.ts` |
| Modified | `app/api/experiments/access/route.ts` |
| Modified | `app/api/public/irl/doc/route.ts` |
| Modified | `app/triad/components/codex/tabs/AlphaProgrammeTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytAlphaTab.tsx` |
| Modified | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` |
| Modified | `components/composer/ComposerExperienceViewer.tsx` |
| Modified | `components/journey/BoundaryResearchProgressPanel.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `components/metame/cards/QuickLinksCard.tsx` |
| Modified | `data/codex-configs.ts` |
| Deleted | `docs/security/2026-08-27_irl-os-containment-breach-audit.md` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/boundary-research-experiment-scoping.test.ts` |
| Modified | `tests/irl-os-access-boundary.test.ts` |
| Deleted | `tests/irl-os-containment.test.ts` |
| Deleted | `tests/irl-os-query-derived-authority-removal.test.ts` |
| Modified | `tests/validation-programme-journey.test.ts` |
| Modified | `utils/codex-nav.ts` |

## Stats

 22 files changed, 93 insertions(+), 1313 deletions(-)
