# Commit Brief: `e2ac273` — feat(qriptopian): one-card Reading and Research editions for Thresholds 006

| Field | Value |
|-------|-------|
| SHA | [`e2ac273`](https://github.com/iQube-Protocol/AigentZBeta/commit/e2ac27372238cf2fa2faa847233f2f968b12f4b2) |
| Author | Kn0w1 |
| Date | 2026-09-02T09:17:35-04:00 |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(qriptopian): one-card Reading and Research editions for Thresholds 006

Preserve canonical research text/PDF and paper 005. Add prose edition, edition-aware reader/PDF/Listen, additive machine projection, mobile title and failed-cover fallback. 20 focused tests pass. Direct deployment requested; no QubeTalk relay.
```

## Body

Preserve canonical research text/PDF and paper 005. Add prose edition, edition-aware reader/PDF/Listen, additive machine projection, mobile title and failed-cover fallback. 20 focused tests pass. Direct deployment requested; no QubeTalk relay.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/codex/qripto/essays/[slug]/machine/route.ts` |
| Modified | `app/components/content/ContentViewer.tsx` |
| Modified | `app/triad/components/codex/tabs/QriptoEssaysTab.tsx` |
| Added | `docs/qriptopian/thresholds/006-editions-manifest.json` |
| Added | `docs/qriptopian/thresholds/006-reading-edition.md` |
| Added | `scripts/render-threshold-reading-edition.py` |
| Added | `services/smartcontent/readingEditions.ts` |
| Added | `tests/content-viewer-editions.test.tsx` |
| Added | `tests/reading-editions.test.ts` |
| Added | `tests/threshold-machine-editions.test.ts` |
| Modified | `types/smartContent.ts` |

## Stats

 12 files changed, 541 insertions(+), 13 deletions(-)
