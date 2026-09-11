# Commit Brief: `2deac7d` — add persona-uploads bucket setup runbook

| Field | Value |
|-------|-------|
| SHA | [`2deac7d`](https://github.com/iQube-Protocol/AigentZBeta/commit/2deac7d1196005083f433fb2bb2567a7f55367b8) |
| Author | Claude |
| Date | 2026-05-28T16:11:00Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add persona-uploads bucket setup runbook

The Supabase Storage bucket persona-uploads is not created by the
20260527000000_persona_uploads.sql migration — it lives in
storage.buckets and has to be created via the Storage UI or a direct
SQL insert per environment. Missing-bucket failure mode surfaces as
"storage upload failed: Bucket not found" on any chat-paperclip /
compose-modal-attachment / UploadDrawer upload.

Doc carries the exact runnable SQL block, path convention, access
model (service-role only, no public URLs ever emitted to the browser),
an environments table (dev today; staging + prod pending cut-over),
and links to the two related repo migrations.
```

## Body

The Supabase Storage bucket persona-uploads is not created by the
20260527000000_persona_uploads.sql migration — it lives in
storage.buckets and has to be created via the Storage UI or a direct
SQL insert per environment. Missing-bucket failure mode surfaces as
"storage upload failed: Bucket not found" on any chat-paperclip /
compose-modal-attachment / UploadDrawer upload.

Doc carries the exact runnable SQL block, path convention, access
model (service-role only, no public URLs ever emitted to the browser),
an environments table (dev today; staging + prod pending cut-over),
and links to the two related repo migrations.

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-28_persona-uploads-bucket-setup.md` |

## Stats

 2 files changed, 71 insertions(+)
