# Commit Brief: `1ec0495` — fix entitlements enrichment for all asset id formats

| Field | Value |
|-------|-------|
| SHA | [`1ec0495`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ec04957d2f5e7596c4fe4f46cad5a9d4a8f338e) |
| Author | Claude |
| Date | 2026-05-02T17:02:07Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix entitlements enrichment for all asset id formats

- character-card-[UUID]-still/motion: extract UUID, look up codex_media_assets
- episode-N and episode-N-tier-modality formats: extend regex to match
- bundle-* and investor bundle SKUs: use representative episode cover
- mk_ep01, ep1, etc: continue to work as before
```

## Body

- character-card-[UUID]-still/motion: extract UUID, look up codex_media_assets
- episode-N and episode-N-tier-modality formats: extend regex to match
- bundle-* and investor bundle SKUs: use representative episode cover
- mk_ep01, ep1, etc: continue to work as before

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/entitlements/list/route.ts` |

## Stats

 1 file changed, 75 insertions(+), 43 deletions(-)
