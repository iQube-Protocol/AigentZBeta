-- Add cover_thumb_url and pdf_lite_url columns for Supabase Storage derivatives
-- This allows Codex to load fast thumbnails and lightweight PDFs instead of decrypting from Autonomys

-- Cover thumbnails
alter table codex_media_assets
  add column if not exists cover_thumb_url text;

alter table master_content_qubes
  add column if not exists cover_thumb_url text;

-- PDF-lite derivatives
alter table codex_media_assets
  add column if not exists pdf_lite_url text;

alter table master_content_qubes
  add column if not exists pdf_lite_url text;

-- Add indexes for fast lookups
create index if not exists idx_codex_media_assets_cover_thumb_url
  on codex_media_assets (cover_thumb_url);

create index if not exists idx_master_content_qubes_cover_thumb_url
  on master_content_qubes (cover_thumb_url);

create index if not exists idx_codex_media_assets_pdf_lite_url
  on codex_media_assets (pdf_lite_url);

create index if not exists idx_master_content_qubes_pdf_lite_url
  on master_content_qubes (pdf_lite_url);

-- Add comments for documentation
comment on column codex_media_assets.cover_thumb_url is 
  'Supabase Storage URL for optimized WebP thumbnail (900px, ~50-250KB). Interim solution to bypass CloudFront/Lambda limits.';

comment on column master_content_qubes.cover_thumb_url is 
  'Supabase Storage URL for optimized WebP thumbnail (900px, ~50-250KB). Interim solution to bypass CloudFront/Lambda limits.';

comment on column codex_media_assets.pdf_lite_url is 
  'Supabase Storage URL for downsampled PDF (150dpi, /ebook preset, 2-8MB target). Fast preview for Codex reading. Canonical PDF remains in Autonomys.';

comment on column master_content_qubes.pdf_lite_url is 
  'Supabase Storage URL for downsampled PDF (150dpi, /ebook preset, 2-8MB target). Fast preview for Codex reading. Canonical PDF remains in Autonomys.';
