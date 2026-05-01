# Commit Brief: `a3536fd` — add asset detail drilldown to Codex Manager dashboard

| Field | Value |
|-------|-------|
| SHA | [`a3536fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/a3536fd94e1a1ad8508b9539317d46b2808222d6) |
| Author | Claude |
| Date | 2026-05-01T14:06:19Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add asset detail drilldown to Codex Manager dashboard

Each Asset Category card (Episode Masters, Covers, Characters, Lore Docs,
Game Assets, Social Media) is now clickable. Clicking expands a detail
panel that lists every asset in that category with thumbnail, title,
episode, kind, tier, variant, and CID — so admin can deterministically
identify each asset and direct what needs to go where.

CIDs are click-to-copy. Click the same card again (or Close) to collapse.

New endpoint: GET /api/admin/codex/assets-by-category?series=&category=
```

## Body

Each Asset Category card (Episode Masters, Covers, Characters, Lore Docs,
Game Assets, Social Media) is now clickable. Clicking expands a detail
panel that lists every asset in that category with thumbnail, title,
episode, kind, tier, variant, and CID — so admin can deterministically
identify each asset and direct what needs to go where.

CIDs are click-to-copy. Click the same card again (or Close) to collapse.

New endpoint: GET /api/admin/codex/assets-by-category?series=&category=

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/admin/codex/assets-by-category/route.ts` |
| Modified | `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` |

## Stats

 2 files changed, 377 insertions(+), 10 deletions(-)
