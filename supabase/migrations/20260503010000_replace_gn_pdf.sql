-- Replace the GN PDF (mk_ep00_print_common) with the newly-uploaded
-- Supabase-hosted version. The codex/store/order surfaces all read this row
-- via /api/admin/codex/status, so updating it here is the single point of
-- truth — no code changes needed.
--
-- Stale pdf_page_manifests rows keyed by the OLD auto_drive_cid are dropped
-- so the page-renderer regenerates pages from the new PDF on next request.

DELETE FROM pdf_page_manifests
WHERE auto_drive_cid IN (
  SELECT auto_drive_cid FROM master_content_qubes WHERE id = 'mk_ep00_print_common'
);

UPDATE master_content_qubes
SET
  auto_drive_cid = 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/masters/metaKnyts/episode_print/ep00_1777828107652.pdf',
  pdf_lite_url   = 'https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/codex/masters/metaKnyts/episode_print/ep00_1777828107652.pdf',
  pages_ready    = FALSE,
  pages_count    = NULL,
  mime_type      = 'application/pdf',
  updated_at     = NOW()
WHERE id = 'mk_ep00_print_common';
