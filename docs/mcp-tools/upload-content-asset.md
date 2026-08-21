# MCP Tool: `upload_content_asset`

## Overview

The `upload_content_asset` tool exposes native binary file uploads to the metaMe Threshold Gateway MCP server. It allows authenticated MCP clients (ChatGPT, Claude via Companion, external integrations) to upload media assets directly to Autonomys storage and optionally bind them to content records.

## Registration Location

**File:** `services/threshold/gateway.ts`

**Tool Name:** `upload_content_asset`

**Endpoint:** Requires authenticated MCP bearer token → routed through `/api/threshold/mcp` JSON-RPC dispatcher

## Authorization Requirements

- **Session Type:** Authenticated (requires Constitutional Handshake bearer token)
- **Privilege Gate:** `session.cartridgeFlags.isAdmin === true` OR `session.cartridgeFlags.isCreator === true`
- **Capability Check:** No additional capability scope required beyond admin/creator privilege
- **Error:** Returns "You do not hold this authorization" if credentials lack admin/creator status

## Request Schema

```json
{
  "tool": "upload_content_asset",
  "input": {
    "file": "string (base64-encoded binary file content)",
    "fileName": "string (original filename, e.g., 'cover.jpg')",
    "domain": "string (series/domain name, e.g., 'metaKnyts', 'qriptopian')",
    "role": "enum (cover | thumbnail | hero | social | pdf | video | audio | attachment)",
    "contentId": "string (optional, id to bind the asset to)",
    "bind": "boolean (default: true, whether to bind to contentId)"
  }
}
```

### Parameter Details

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | ✓ | Base64-encoded file content. Decoded before multipart upload. |
| `fileName` | string | ✓ | Original filename. Used to infer MIME type (extension-based mapping). |
| `domain` | string | ✓ | Series/domain name, stored in `series` field. Used in objectPath. |
| `role` | enum | ✓ | Asset role/category. Maps to `assetKind` for storage. |
| `contentId` | string | | Content ID to associate. Included in objectPath; skipped if unbound. |
| `bind` | boolean | | Bind the asset to contentId (default: true). Ignored if contentId absent. |

### Role-to-AssetKind Mapping

| Role | AssetKind | Use Case |
|------|-----------|----------|
| `cover` | `cover_image` | Episode cover / primary image |
| `thumbnail` | `cover_image` | Thumbnail variant |
| `hero` | `social_campaign_image` | Hero/banner image |
| `social` | `social_campaign_image` | Social media asset |
| `pdf` | `background_lore_doc` | PDF document / lore |
| `video` | `game_video` | Video media file |
| `audio` | `game_video` | Audio media (placeholder; adjust if audio asset kind exists) |
| `attachment` | `background_lore_doc` | General attachment |

## Response Schema (Success)

```json
{
  "ok": true,
  "assetId": "string (generated Autonomys asset id)",
  "cid": "string (content-addressed identifier, e.g., 'QmXx...')",
  "publicUrl": "string (e.g., 'https://autonomys-gateway.com/ipfs/QmXx...')",
  "objectPath": "string (domain/contentId/assetId or domain/unbound/assetId)",
  "mimeType": "string (inferred from fileName extension)",
  "bytes": "number (file size in bytes)",
  "sha256": "string (SHA256 hash of file content, 64 hex characters)",
  "role": "string (the requested role)",
  "contentId": "string | null (the provided contentId or null if unbound)",
  "bound": "boolean (whether binding was applied)"
}
```

## Response Schema (Error)

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "string (human-readable error message)"
    }
  ]
}
```

### Common Error Scenarios

| Condition | Message |
|-----------|---------|
| Missing bearer token | Constitutional Handshake required |
| Insufficient privileges | You do not hold this authorization |
| Missing required parameter | Missing required parameters: file, fileName, domain, role |
| Invalid role | Invalid role: X. Must be one of: cover, thumbnail, hero, social, pdf, video, audio, attachment |
| Invalid base64 | Invalid base64 encoding for file parameter |
| Upload failed | Upload failed: HTTP_CODE HTTP_STATUS. [server response] |

## MIME Type Detection

Extension mapping (case-insensitive):

| Extension | MIME Type |
|-----------|-----------|
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.pdf` | `application/pdf` |
| `.mp4` | `video/mp4` |
| `.webm` | `video/webm` |
| `.mp3` | `audio/mpeg` |
| `.wav` | `audio/wav` |
| (unknown) | `application/octet-stream` |

## Invocation Examples

### Via ChatGPT Plugin

```
[ChatGPT has access to the tool through the Threshold MCP server]

User: "Upload this cover image to the KNYT series"
ChatGPT: [fetches file from user, base64-encodes it, calls upload_content_asset]
Tool call:
{
  "name": "upload_content_asset",
  "arguments": {
    "file": "iVBORw0KGgo...",  // base64 PNG
    "fileName": "episode-42-cover.png",
    "domain": "metaKnyts",
    "role": "cover",
    "contentId": "episode-42",
    "bind": true
  }
}
```

### Via Claude Companion

The Companion (the browser extension paired with a human's crossing) can invoke the tool after a Constitutional Handshake:

```typescript
const result = await mcpClient.callTool('upload_content_asset', {
  file: base64FileContent,
  fileName: 'hero.jpg',
  domain: 'metaKnyts',
  role: 'hero',
  contentId: 'campaign-2024-q1',
  bind: true,
});
```

### Via Direct HTTP (for testing)

```bash
curl -X POST https://dev-beta.aigentz.me/api/threshold/mcp \
  -H 'Authorization: Bearer <constitutional_handshake_bearer>' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "upload_content_asset",
      "arguments": {
        "file": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "fileName": "pixel.png",
        "domain": "metaKnyts",
        "role": "thumbnail",
        "contentId": "episode-0"
      }
    }
  }'
```

## Backend Flow

1. **MCP Dispatch** → `/api/threshold/mcp` route.ts
2. **JSON-RPC Handling** → `callTool('upload_content_asset', args, ctx)` in `gateway.ts`
3. **Authorization Check** → Verify `session.cartridgeFlags.isAdmin || isCreator`
4. **Base64 Decode** → Convert file parameter to Buffer
5. **MIME Type Inference** → Map fileName extension to MIME type
6. **Multipart Construction** → Build FormData with file + metadata
7. **Upload POST** → `fetch('/api/admin/codex/upload-asset', { method: 'POST', body: formData })`
8. **Parse Response** → Extract CID, assetId from upload response
9. **Construct Return** → Build structured response with all required fields

## Upstream Endpoint

The tool proxies to:

**Endpoint:** `POST /api/admin/codex/upload-asset`

**Payload (FormData):**
- `file`: Blob (multipart file field)
- `assetKind`: string (mapped from role)
- `title`: string (from fileName)
- `series`: string (from domain)
- `contentId`: string (optional)

**Response:**
```json
{
  "success": true,
  "id": "asset-uuid",
  "cid": "QmXx...",
  "kbDocumentId": "kb-doc-uuid",
  "data": { ... }
}
```

## Testing

**Integration Test File:** `tests/mcp-upload-content-asset.test.ts`

**Test Coverage:**
- PNG fixture generation + magic byte validation
- Base64 encoding/decoding round-trip
- MIME type detection for all extensions
- Role-to-assetKind mapping (all 8 roles)
- SHA256 hash computation
- Response structure validation
- Base64 validation
- Error handling

**Run Tests:**
```bash
npm test -- tests/mcp-upload-content-asset.test.ts
```

## Security Notes

### Authorization Boundary

- **No bearer?** MCP route returns HTTP 401 + WWW-Authenticate challenge (spec trigger for browser OAuth flow)
- **Invalid bearer?** Route returns JSON-RPC error (no 401, the session resolution itself is stateless)
- **Valid bearer, no admin/creator?** Tool returns honest "you do not hold this authorization" error in JSON text

### File Size Limits

- **Lambda Payload Limit:** 6 MB (Lambda response max)
- **Autonomys Limits:** Check `services/autonomysContentService` for file-size-specific constraints
- **No client-side validation:** Size enforcement is server-side only

### T0 Identifier Exposure

- No persona ID, auth profile ID, or raw session tokens in response
- Asset ID is Autonomys-assigned, not a primary identifier
- CID is content-addressed, public-safe
- ObjectPath includes domain + contentId but not any T0 secrets

## Future Enhancements

### Phase 2: Gated Content Encryption

Once iQube encryption lands, assets bound to gated content will be encrypted at rest on Autonomys. The tool's authorization model will be unchanged; the encryption happens downstream.

### Phase 2: Signed URLs

Replace direct Autonomys gateway URLs with short-lived signed redirects for gated assets, matching the Gated Content pattern in CLAUDE.md.

## Related Documentation

- **MCP Server:** `app/api/threshold/mcp/route.ts` — JSON-RPC dispatch
- **Gateway:** `services/threshold/gateway.ts` — Tool registration + implementation
- **Upload Endpoint:** `app/api/admin/codex/upload-asset/route.ts` — Upstream multipart handler
- **Content Service:** `server/services/autonomysContentService.ts` — Autonomys integration
- **Gated Content Rules:** `CLAUDE.md` § Gated Content
- **MCP Spec:** Model Context Protocol (JSON-RPC 2.0 over HTTP/SSE)

## Changelog

### 2026-08-21

- Initial implementation + integration test suite
- 8 roles supported (cover, thumbnail, hero, social, pdf, video, audio, attachment)
- Base64 file encoding support for JSON-RPC compatibility
- Admin/creator authorization gate
- SHA256 hash + CID + public URL in structured response
