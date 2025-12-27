-- Add page_count column to asset tables for PDF caching
-- This avoids re-downloading and decrypting PDFs just to count pages

alter table codex_media_assets
  add column if not exists page_count integer;

alter table master_content_qubes
  add column if not exists page_count integer;

-- Add index for common query pattern
create index if not exists idx_codex_media_assets_auto_drive_cid 
  on codex_media_assets(auto_drive_cid);

create index if not exists idx_master_content_qubes_auto_drive_cid 
  on master_content_qubes(auto_drive_cid);
