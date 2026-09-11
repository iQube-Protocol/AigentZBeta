# Commit Brief: `3bdae27` — uploads: keep status='ready' on enrichment failure + clarify Marketa label

| Field | Value |
|-------|-------|
| SHA | [`3bdae27`](https://github.com/iQube-Protocol/AigentZBeta/commit/3bdae274891dcb57df8bf86d295488a89d4a284f) |
| Author | Claude |
| Date | 2026-05-28T16:22:20Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
uploads: keep status='ready' on enrichment failure + clarify Marketa label

PersonaUploadService: when the indexer returns a partial with an error
(OpenAI vision 429 quota, Whisper failure, PDF parse error), the bytes
are already stored — storage.put succeeded before the indexer ran. The
upload is still attachable to a Gmail/Marketa send, embeddable in an
iQube, or savable to workbench, so flipping status to 'failed' was too
aggressive: it hid the row from /api/uploads?status=ready and the
attachment picker. New behaviour: status stays 'ready', the enrichment
error is preserved on persona_upload_index.error so the UI surfaces
"vision unavailable" / "transcription failed" copy. Only a hard catch
(indexer throws / metadata write fails) flips to 'failed'.

UploadDrawer: rename the email_attachment option label from
"Attach to an outbound email" to "Attach to a Gmail or Marketa send"
and expand the description so it's obvious the same use_kind covers
both the Gmail compose modal and the Marketa campaign compose modal
attachment pickers. No new use_kind needed — the picker filter +
sort logic in UploadAttachmentPicker already surfaces email_attachment
rows first in both consumers.
```

## Body

PersonaUploadService: when the indexer returns a partial with an error
(OpenAI vision 429 quota, Whisper failure, PDF parse error), the bytes
are already stored — storage.put succeeded before the indexer ran. The
upload is still attachable to a Gmail/Marketa send, embeddable in an
iQube, or savable to workbench, so flipping status to 'failed' was too
aggressive: it hid the row from /api/uploads?status=ready and the
attachment picker. New behaviour: status stays 'ready', the enrichment
error is preserved on persona_upload_index.error so the UI surfaces
"vision unavailable" / "transcription failed" copy. Only a hard catch
(indexer throws / metadata write fails) flips to 'failed'.

UploadDrawer: rename the email_attachment option label from
"Attach to an outbound email" to "Attach to a Gmail or Marketa send"
and expand the description so it's obvious the same use_kind covers
both the Gmail compose modal and the Marketa campaign compose modal
attachment pickers. No new use_kind needed — the picker filter +
sort logic in UploadAttachmentPicker already surfaces email_attachment
rows first in both consumers.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/uploads/UploadDrawer.tsx` |
| Modified | `services/uploads/personaUploadService.ts` |

## Stats

 2 files changed, 12 insertions(+), 4 deletions(-)
