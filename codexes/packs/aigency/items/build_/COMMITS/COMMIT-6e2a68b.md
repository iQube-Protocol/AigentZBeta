# Commit Brief: `6e2a68b` — complete phase 1: remove artifact class selector, simplify to series picker

| Field | Value |
|-------|-------|
| SHA | [`6e2a68b`](https://github.com/iQube-Protocol/AigentZBeta/commit/6e2a68ba69bedb55032b79dc9c99c79975fc7c81) |
| Author | Claude |
| Date | 2026-08-11T22:35:32Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
complete phase 1: remove artifact class selector, simplify to series picker

Remove qriptoArtifactClass and selectedCanonicalCategory state variables and
all UI sections that depended on them. Canonical assets (e.g. Constitutional
Internet Bridge plates) now flow through the existing QRIPTO_SERIES picker
with seriesScope='canonical/constitutional-internet' persisted to the database.

This eliminates the enum mismatch that was causing PostgreSQL errors with
'stack_canonical_plate' and 'stack_canonical_video' asset kinds. The canonical
series option now appears in the series dropdown (optgroup='canonical'), and
upload items automatically read their seriesScope from the selected series item.

Changes:
- Remove artifact class state and toggle UI (lines 580-581, 1074-1097)
- Remove conditional category picker branching (lines 1099-1148)
- Flatten series picker to single control with all three groups
- Update handleQriptoFileSelect to extract seriesScope from selected series
- Update dependency array to use only [selectedQriptoCategory, selectedQriptoSeries]
```

## Body

Remove qriptoArtifactClass and selectedCanonicalCategory state variables and
all UI sections that depended on them. Canonical assets (e.g. Constitutional
Internet Bridge plates) now flow through the existing QRIPTO_SERIES picker
with seriesScope='canonical/constitutional-internet' persisted to the database.

This eliminates the enum mismatch that was causing PostgreSQL errors with
'stack_canonical_plate' and 'stack_canonical_video' asset kinds. The canonical
series option now appears in the series dropdown (optgroup='canonical'), and
upload items automatically read their seriesScope from the selected series item.

Changes:
- Remove artifact class state and toggle UI (lines 580-581, 1074-1097)
- Remove conditional category picker branching (lines 1099-1148)
- Flatten series picker to single control with all three groups
- Update handleQriptoFileSelect to extract seriesScope from selected series
- Update dependency array to use only [selectedQriptoCategory, selectedQriptoSeries]

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/admin/codex/components/CodexUploadModal.tsx` |

## Stats

 1 file changed, 43 insertions(+), 110 deletions(-)
