# Codex Derivatives Generation Scripts

These scripts generate optimized derivatives of Autonomys-stored assets for fast Codex UI loading.

## Overview

**Problem**: CloudFront/Lambda 1MB response limits cause 413 errors when serving large images and PDFs from Autonomys.

**Solution**: Generate lightweight derivatives stored in Supabase Storage:
- **Cover thumbnails**: WebP format, 900px wide, ~50-250KB
- **PDF-lite**: Downsampled PDFs, 150dpi, /ebook preset, 2-8MB target

**Architecture**:
- Autonomys remains canonical source (provenance, minting, downloads)
- Supabase Storage serves fast derivatives for Codex UI
- Database tracks both: `cover_thumb_url`, `pdf_lite_url`

## Prerequisites

### 1. Database Migration

Run the SQL migration to add derivative URL columns:

```bash
# In Supabase SQL Editor, run:
cat scripts/migrations/add_cover_thumb_urls.sql
```

This adds:
- `cover_thumb_url` to `codex_media_assets` and `master_content_qubes`
- `pdf_lite_url` to `codex_media_assets` and `master_content_qubes`
- Indexes for fast lookups

### 2. Supabase Storage Bucket

Create the `codex-lite` bucket in Supabase:

1. Go to Storage in Supabase dashboard
2. Create new bucket: `codex-lite`
3. Set to **Public** (for now - can add signed URLs later)
4. Folder structure will be auto-created:
   - `covers/<cid>.webp`
   - `pdf-lite/<cid>.pdf`

### 3. Install Dependencies

```bash
# From repo root
npm install sharp @supabase/supabase-js dotenv

# For PDF-lite generation, install Ghostscript
brew install ghostscript  # macOS
# apt-get install ghostscript  # Linux
```

### 4. Environment Variables

Create or update `.env` with:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API Base (use local for reliability during generation)
AIGENT_API_BASE=http://localhost:3000
# Or production:
# AIGENT_API_BASE=https://dev-beta.aigentz.me
```

## Script 1: Cover Thumbnail Generation

**File**: `scripts/generate-cover-thumbs.mjs`

**What it does**:
1. Finds covers missing `cover_thumb_url` in database
2. Downloads encrypted covers via `/api/content/cover/[cid]?variant=full`
3. Converts to WebP (900px wide, quality 65)
4. Uploads to `codex-lite/covers/<cid>.webp`
5. Updates database with public URL

**Usage**:

```bash
# Generate 25 covers (default)
SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
AIGENT_API_BASE="http://localhost:3000" \
node scripts/generate-cover-thumbs.mjs

# Generate specific number
LIMIT=50 node scripts/generate-cover-thumbs.mjs

# Use production API (if local not available)
AIGENT_API_BASE="https://dev-beta.aigentz.me" \
node scripts/generate-cover-thumbs.mjs
```

**Output**:
```
=== Cover Thumbnail Generator ===
API Base: http://localhost:3000
Limit: 25

Found 14 covers to process

[1/14] Processing bafkr6ibxzafvntkmeb55gbfmwpuxbu5b6pfxsnbvuzcehuakwazkeup6ju...
  Downloaded: 2458623 bytes
  Converted to WebP: 234562 bytes
  ✅ Uploaded: https://...supabase.co/storage/v1/object/public/codex-lite/covers/bafkr6i...webp

=== Summary ===
Success: 14
Failed: 0
Total: 14
```

**Troubleshooting**:
- **413 errors from prod API**: Use local API (`http://localhost:3000`)
- **CORS errors**: Ensure Next.js server is running locally
- **Sharp errors**: Reinstall with `npm install sharp --force`

## Script 2: PDF-lite Generation

**File**: `scripts/generate-pdf-lite.mjs`

**What it does**:
1. Finds PDFs missing `pdf_lite_url` in database
2. Downloads encrypted PDFs via `/api/content/pdf/[cid]`
3. Compresses with Ghostscript (/ebook preset, 150dpi)
4. Uploads to `codex-lite/pdf-lite/<cid>.pdf`
5. Updates database with public URL

**Usage**:

```bash
# Generate 10 PDFs (default)
SUPABASE_URL="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
AIGENT_API_BASE="http://localhost:3000" \
node scripts/generate-pdf-lite.mjs

# Generate specific number
LIMIT=5 node scripts/generate-pdf-lite.mjs

# Use production API (if local not available)
AIGENT_API_BASE="https://dev-beta.aigentz.me" \
node scripts/generate-pdf-lite.mjs
```

**Output**:
```
=== PDF-lite Generator ===
API Base: http://localhost:3000
Limit: 10
Temp directory: /var/folders/.../pdf-lite-abc123

Found 13 PDFs to process

[1/13] Processing bafkr6ihv5dcaqdlqlvslrkytx2iymnypjdsot3n3ui7d7omb6aaywuy6ea...
  Downloaded: 45823456 bytes
  Running Ghostscript...
  Compressed to: 3456789 bytes (8% of original)
  ✅ Uploaded: https://...supabase.co/storage/v1/object/public/codex-lite/pdf-lite/bafkr6i...pdf

=== Summary ===
Success: 13
Failed: 0
Total: 13

Temp directory: /var/folders/.../pdf-lite-abc123 (can be deleted)
```

**Ghostscript Settings**:
- `/ebook` preset: Good balance for comics (150dpi color)
- `/screen` preset: More aggressive compression (72dpi, smaller files)
- Can adjust in script if needed

**Troubleshooting**:
- **Ghostscript not found**: Install with `brew install ghostscript`
- **Large output files**: Try `/screen` preset or lower `dColorImageResolution`
- **Quality issues**: Increase resolution to 200dpi or use `/printer` preset

## Batch Processing Strategy

**Recommended approach**:

1. **Start small** (test with 5-10 items):
   ```bash
   LIMIT=5 node scripts/generate-cover-thumbs.mjs
   LIMIT=5 node scripts/generate-pdf-lite.mjs
   ```

2. **Verify in Codex UI** that derivatives load correctly

3. **Process in batches** (25-50 at a time):
   ```bash
   LIMIT=25 node scripts/generate-cover-thumbs.mjs
   LIMIT=25 node scripts/generate-pdf-lite.mjs
   ```

4. **Monitor progress** in Supabase Storage dashboard

5. **Backfill remaining** assets when ready

## How Codex Uses Derivatives

### Cover Images

**Frontend logic** (in `CodexLiquidUITab.tsx`):
```typescript
// Prefers cover_thumb_url if available, falls back to Autonomys decrypt
const coverUrl = episode.coverThumbUrl || 
  `${apiUrl}/api/content/cover/${episode.coverImageCid}?variant=thumb`;
```

### PDF Reading

**Frontend logic** (in `CodexLiquidUITab.tsx`):
```typescript
// Prefers pdf_lite_url (native browser rendering)
// Falls back to PDFPageViewer (page-by-page WebP)
if (item.media?.pdf_lite_url) {
  // Open PDFLiteReaderModal (fast, native iframe)
} else if (item.media?.pdf_cid) {
  // Open PDFPageViewer (slower, page-by-page API calls)
}
```

**Benefits**:
- **PDFLiteReaderModal**: Native browser PDF rendering, instant loading, smooth scrolling
- **PDFPageViewer**: Fallback for assets not yet processed

## Monitoring & Maintenance

### Check Coverage

```sql
-- Count covers with thumbnails
SELECT 
  COUNT(*) FILTER (WHERE cover_thumb_url IS NOT NULL) as with_thumb,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cover_thumb_url IS NOT NULL) / COUNT(*), 1) as pct
FROM codex_media_assets
WHERE auto_drive_cid IS NOT NULL;

-- Count PDFs with lite versions
SELECT 
  COUNT(*) FILTER (WHERE pdf_lite_url IS NOT NULL) as with_lite,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pdf_lite_url IS NOT NULL) / COUNT(*), 1) as pct
FROM codex_media_assets
WHERE mime_type = 'application/pdf';
```

### Storage Usage

Check Supabase Storage dashboard for `codex-lite` bucket size and file count.

### Re-generate Derivatives

To regenerate (e.g., after quality adjustments):

```sql
-- Clear URLs to trigger regeneration
UPDATE codex_media_assets SET cover_thumb_url = NULL WHERE id = 'specific-id';
UPDATE codex_media_assets SET pdf_lite_url = NULL WHERE id = 'specific-id';
```

Then re-run scripts.

## Future Enhancements

### Signed URLs (Security)

Replace public bucket with signed URLs:
1. Set bucket to private
2. Generate signed URLs in API routes
3. Update frontend to fetch signed URLs

### Motion Comic Previews

Similar pattern for video derivatives:
- Poster frames (WebP thumbnails)
- Short preview clips (5-15s, optimized)

### Derivative CIDs in Autonomys

Store derivatives back in Autonomys:
- Maintains provenance chain
- Enables decentralized delivery
- Supports Phase C architecture

## Support

**Issues**:
- Check script output for specific error messages
- Verify environment variables are set correctly
- Ensure Next.js server is running for local API access
- Check Supabase Storage permissions

**Performance**:
- Scripts process sequentially (safe, predictable)
- Can run multiple instances in parallel if needed
- Temp files cleaned up automatically
