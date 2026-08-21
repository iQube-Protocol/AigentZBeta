# Canonical Content Asset Upload Tool

Status: implemented on `dev` (platform route) and Aigent Z Supabase Edge Function v1.

## Purpose

Provide one cross-platform primitive for binary publication assets: cover, thumbnail, hero, social, PDF, video, audio, and attachment.

## Canonical tool shape

`uploadContentAsset(file, domain, contentId?, role, bind=true)`

### Inputs

- `file` — binary file parameter (required; connector/MCP schema MUST mark this as a file parameter, not base64 text)
- `domain` — publication/application domain, e.g. `qriptopian`
- `contentId` — canonical QubeBase `content.id` when binding to content
- `role` — `cover | thumbnail | hero | social | pdf | video | audio | attachment`
- `bind` — when true and `contentId` is supplied, update the canonical content record
- optional: `name`, `bucket`

### Output

```json
{
  "ok": true,
  "bound": true,
  "asset": {
    "role": "thumbnail",
    "bucket": "content-media",
    "objectPath": "assets/qriptopian/<content-id>/thumbnail/<timestamp>-name.png",
    "publicUrl": "https://...",
    "mimeType": "image/png",
    "bytes": 12345,
    "sha256": "...",
    "originalName": "...",
    "uploadedAt": "..."
  }
}
```

## Surface A — platform binding service

`POST /api/content/assets/upload`

- Multipart/form-data.
- Uses active persona and fails closed unless `persona.cartridgeFlags.isAdmin`.
- Uploads to Supabase Storage.
- Calculates SHA-256.
- Maintains `content.assets` manifest.
- Role bindings:
  - `thumbnail` → `content.thumbnail`
  - `cover` → `content.cover`
  - `hero` → `content.hero`
  - `social` → `content.social`
  - `pdf` → `modalities.read.pdf_url`
- Other roles are retained in the canonical asset manifest.

This is the preferred publication path because storage and ContentQube/QubeBase binding occur as one operation.

## Surface B — direct Supabase Storage service

Supabase project: `Aigent Z` (`bsjhfvctmduxhohtllly`)

Edge Function: `content-asset-upload`

- JWT verification enabled.
- Allows service-role or approved admin roles from JWT metadata.
- Multipart/form-data with the same `file`, `domain`, `contentId`, and `role` vocabulary.
- Uploads directly to the `content-media` bucket and returns canonical storage metadata + SHA-256.
- Does not mutate QubeBase; use Surface A when binding is required.

## Connector / MCP requirement

To make generated local binaries directly usable by ChatGPT, Claude, or another agent runtime, register either surface as an invokable connector/MCP action whose schema declares top-level `file` as a **file parameter**. The runtime can then pass mounted/generated files without base64 shuttling.

Recommended action name: `upload_content_asset`.

Recommended default: call Surface A. Retain Surface B as a lower-level direct-storage primitive and operational fallback.

## Constitutional properties

- Authority: admin-gated / JWT-gated.
- Provenance: SHA-256 + original filename + upload timestamp.
- Consequence: explicit content binding via `role`.
- Evidence: canonical public URL/object path + content manifest.
- Portability: same role vocabulary across Qriptopian, KNYT, CI, Studio, and future cartridges.
