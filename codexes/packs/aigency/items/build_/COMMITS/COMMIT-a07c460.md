# Commit Brief: `a07c460` — google: write Doc body via Drive multipart upload — bypass Docs API

| Field | Value |
|-------|-------|
| SHA | [`a07c460`](https://github.com/iQube-Protocol/AigentZBeta/commit/a07c460bf1a2a57e4cedd94cd4269d995f763766) |
| Author | Claude |
| Date | 2026-05-24T20:59:10Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
google: write Doc body via Drive multipart upload — bypass Docs API

The Google Doc body was missing because the prior path called the
Docs API (docs.googleapis.com batchUpdate) to insert text after
creating an empty file via Drive. That API isn't enabled on the
operator's GCP project (project 73021901849), so every body insert
returned 403 and the doc landed title-only.

Replaces the two-step Drive-create-then-Docs-batchUpdate path with a
single Drive multipart upload. When bodyText is present we POST to
/upload/drive/v3/files?uploadType=multipart with the metadata
declaring mimeType=application/vnd.google-apps.document and the
bodyText as a text/plain part. Drive converts the upload into a
Google Doc on the server side — no separate Docs API call needed,
so the disabled-API failure goes away. Metadata-only creates (no
bodyText) still take the simple JSON path.

requiredScopes drops docs since we no longer hit docs.googleapis.com.
Only Drive scope is needed now, which every operator already has if
they could create the title-only file before.

Reference for multipart upload format:
  https://developers.google.com/drive/api/guides/manage-uploads#multipart

The Enable-API CTA + warning rendering from the prior commit stay
useful for any connector that does emit a partial-success warning
(other Google APIs, future connectors) — Docs just won't be one of
them anymore.
```

## Body

The Google Doc body was missing because the prior path called the
Docs API (docs.googleapis.com batchUpdate) to insert text after
creating an empty file via Drive. That API isn't enabled on the
operator's GCP project (project 73021901849), so every body insert
returned 403 and the doc landed title-only.

Replaces the two-step Drive-create-then-Docs-batchUpdate path with a
single Drive multipart upload. When bodyText is present we POST to
/upload/drive/v3/files?uploadType=multipart with the metadata
declaring mimeType=application/vnd.google-apps.document and the
bodyText as a text/plain part. Drive converts the upload into a
Google Doc on the server side — no separate Docs API call needed,
so the disabled-API failure goes away. Metadata-only creates (no
bodyText) still take the simple JSON path.

requiredScopes drops docs since we no longer hit docs.googleapis.com.
Only Drive scope is needed now, which every operator already has if
they could create the title-only file before.

Reference for multipart upload format:
  https://developers.google.com/drive/api/guides/manage-uploads#multipart

The Enable-API CTA + warning rendering from the prior commit stay
useful for any connector that does emit a partial-success warning
(other Google APIs, future connectors) — Docs just won't be one of
them anymore.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/google/connectors.ts` |

## Stats

 1 file changed, 71 insertions(+), 72 deletions(-)
