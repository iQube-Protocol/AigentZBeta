# Commit Brief: `8680dca` — add InputManifestQube + OutputManifestQube — manifests, validation, normalization

| Field | Value |
|-------|-------|
| SHA | [`8680dca`](https://github.com/iQube-Protocol/AigentZBeta/commit/8680dcae1698ed9e2be46ce1699a34617d84ccb3) |
| Author | Claude |
| Date | 2026-03-26T01:10:26Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add InputManifestQube + OutputManifestQube — manifests, validation, normalization

- migration: workflow_input_manifests + workflow_output_manifests tables
  (versioned, unique active index per workflow)
- manifestTypes.ts: ManifestField, InputManifest, OutputManifest types;
  validateInput() returns missing required field names;
  normalizeAgainstManifest() projects engine output to declared fields
- manifestStore.ts: getActiveInputManifest, upsertInputManifest,
  getActiveOutputManifest, upsertOutputManifest
- GET/PUT /api/workflows/:id/manifest/input
- GET/PUT /api/workflows/:id/manifest/output
- invoke route: validates inputs against active InputManifest (400 on missing required);
  normalizes output through OutputManifest fields after adapter returns

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
