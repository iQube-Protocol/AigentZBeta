# persona-uploads Supabase Storage Bucket — Setup

**Date:** 2026-05-28
**Surface:** persona uploads backend (`services/uploads/supabaseUploadAdapter.ts`)
**Status:** One-time setup per Supabase environment (dev → staging → prod).

---

## Why this exists

The persona uploads pipeline writes the uploaded bytes to a Supabase Storage bucket named `persona-uploads` (defined at `services/uploads/supabaseUploadAdapter.ts:27`). The migration that ships the metadata tables (`supabase/migrations/20260527000000_persona_uploads.sql`) creates `persona_uploads` + `persona_upload_index` but **does not** create the storage bucket — buckets live outside the `public` schema, in `storage.buckets`, and are typically created via the Storage UI or a direct SQL insert.

Symptom when the bucket is missing: any upload (chat paperclip, compose-modal attachment picker, UploadDrawer) fails server-side with `storage upload failed: Bucket not found`. The metadata row is not written.

## Setup SQL (paste into Supabase SQL editor, once per environment)

```sql
-- 1. Create the bucket (private; service-role-only).
insert into storage.buckets (id, name, public)
values ('persona-uploads', 'persona-uploads', false)
on conflict (id) do nothing;

-- 2. Allow the service role to do anything on objects in this bucket.
--    Service role bypasses RLS but this policy documents intent and
--    keeps the bucket usable if a future client uses authenticated role.
drop policy if exists "persona-uploads service role full access" on storage.objects;
create policy "persona-uploads service role full access"
  on storage.objects for all
  using (bucket_id = 'persona-uploads')
  with check (bucket_id = 'persona-uploads');

-- 3. Verify.
select id, name, public from storage.buckets where id = 'persona-uploads';
```

Expected verify output: one row, `public = false`.

## Path convention

`services/uploads/supabaseUploadAdapter.ts` writes to:

```
<persona_id>/<yyyy-mm>/<upload_id>.<ext>
```

Example: `7e3f…/2026-05/9b2c…pdf`. The `<yyyy-mm>` folder gives a coarse partition for purge / archive operations.

## Access model

- **Service role only.** The bucket is private; only routes that run with the service-role key (everything under `app/api/uploads/*` plus the indexer) can read or write. No `NEXT_PUBLIC_` keys touch it.
- **No public URL is ever emitted to the browser.** Attachment delivery (Gmail multipart MIME, Marketa Mailjet attachments, iQube embed) reads through service-role helpers in `services/uploads/uploadAttachmentHelper.ts` and `services/uploads/iqubeUploadEmbed.ts`, encrypts / base64s as the destination requires, and ships the bytes — never a storage URL.

## Environments

Applied to:

| Env | Date | By |
|---|---|---|
| dev | _operator runs SQL_ | dele@metame.com |
| staging | _pending_ | — |
| prod | _pending_ | — |

When you cut over staging or prod, paste the same SQL block in the Supabase SQL editor for that project, then update the row above in this doc.

## Related migrations

- `supabase/migrations/20260527000000_persona_uploads.sql` — `persona_uploads` + `persona_upload_index` tables, RLS, helper indexes.
- `supabase/migrations/20260527010000_persona_uploads_attachment_kinds.sql` — adds `email_attachment` + `iqube_payload` to the `use_kind` enum.

These migrations DO ship in the repo and are applied via the standard Supabase migration flow. Only the Storage bucket is out-of-band.
