-- =============================================================================
-- Raise content-media bucket file_size_limit so 300-500 MB media uploads
-- (motion comic videos, full graphic novels, masters) succeed via the
-- Supabase Storage signed-upload-URL path.
--
-- Default for new buckets is often a low cap (50 MB). For 376 MB GN PDF
-- uploads and 500 MB motion comic videos, set the bucket limit to 1 GB.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

UPDATE storage.buckets
SET file_size_limit = 1073741824   -- 1 GB in bytes
WHERE id = 'content-media';

-- Verify:
SELECT id, name, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'content-media';
