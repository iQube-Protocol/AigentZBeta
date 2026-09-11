# MCP Tool: `upload_content_asset`

## Overview

The `upload_content_asset` tool exposes file uploads to the metaMe Threshold Gateway, supporting two input interfaces:

1. **JSON-RPC clients** (ChatGPT plugins, external integrations): base64-encoded files via the MCP gateway
2. **Connector/action layer** (ChatGPT actions, Claude actions): native binary files via a thin HTTP adapter

Both paths share identical authorization (admin/creator privilege), MIME inference, role mapping, and response structure.

## Registration Locations

### MCP Gateway Tool

**File:** `services/threshold/gateway.ts` → `callTool('upload_content_asset')`

**Transport:** JSON-RPC 2.0 over HTTP (requires `fileBase64` parameter)

**Endpoint:** `/api/threshold/mcp` (dispatcher routed)

**Authentication:** Constitutional Handshake bearer token

### Connector Action Endpoint

**File:** `app/api/threshold/upload-action/route.ts` → `POST /api/threshold/upload-action`

**Transport:** multipart/form-data with native binary file

**Authentication:** Constitutional Handshake bearer token

**Target:** Forwards to `/api/content/assets/upload` (canonical user-facing upload endpoint)

## Authorization Requirements

- **Session Type:** Authenticated (requires Constitutional Handshake bearer token)
- **Privilege Gate:** `session.cartridgeFlags.isAdmin === true` OR `session.cartridgeFlags.isCreator === true`
- **Capability Check:** No additional capability scope required beyond admin/creator privilege
- **Error:** Returns "You do not hold this authorization" if credentials lack admin/creator status

## Request Schema

### MCP (JSON-RPC) Interface

```json
{
  "tool": "upload_content_asset",
  "input": {
    "fileBase64": "string (base64-encoded binary file content — exactly one of fileBase64 or file required)",
    "fileName": "string (original filename, e.g., 'cover.jpg')",
    "domain": "string (series/domain name, e.g., 'metaKnyts', 'qriptopian')",
    "role": "enum (cover | thumbnail | hero | social | pdf | video | audio | attachment)",
    "contentId": "string (optional, id to bind the asset to)",
    "bind": "boolean (default: true, whether to bind to contentId)"
  }
}
```

### Connector Action (multipart) Interface

```
POST /api/threshold/upload-action
Authorization: Bearer <constitutional_handshake_token>
Content-Type: multipart/form-data

file: <binary file content>
fileName: string (e.g., "cover.jpg")
domain: string (e.g., "metaKnyts")
role: enum (cover | thumbnail | hero | social | pdf | video | audio | attachment)
contentId: string (optional)
bind: boolean (optional, default: true)
```

### Parameter Details

| Parameter | Type | Required | MCP | Connector | Description |
|-----------|------|----------|-----|-----------|-------------|
| `fileBase64` | string | ✓ (MCP only) | ✓ | ✗ | Base64-encoded file. Mutually exclusive with `file`. |
| `file` | binary | ✓ (connector only) | ✗ | ✓ | Native binary file. Mutually exclusive with `fileBase64`. |
| `fileName` | string | ✓ | ✓ | ✓ | Original filename. Used to infer MIME type. |
| `domain` | string | ✓ | ✓ | ✓ | Series/domain name. Used in objectPath. |
| `role` | enum | ✓ | ✓ | ✓ | Asset role/category (8 options). |
| `contentId` | string | | ✓ | ✓ | Content ID to bind to (optional). |
| `bind` | boolean | | ✓ | ✓ | Whether to bind to contentId (default: true). |

**Validation Rules:**
- Exactly one of `file` or `fileBase64` must be supplied (not both, not neither).
- If both are supplied, request is rejected with error: `"Cannot supply both file and fileBase64"`
- If neither is supplied, request is rejected with error: `"Must supply either file or fileBase64, not neither"`

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

### Via MCP (JSON-RPC) — ChatGPT Plugin, Custom Integration

The MCP interface requires base64-encoded file content:

```json
{
  "name": "upload_content_asset",
  "arguments": {
    "fileBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    "fileName": "episode-42-cover.png",
    "domain": "metaKnyts",
    "role": "cover",
    "contentId": "episode-42",
    "bind": true
  }
}
```

**ChatGPT plugin workflow:**
1. User selects file or provides image
2. Plugin base64-encodes the bytes
3. Plugin calls `upload_content_asset` with `fileBase64` parameter
4. MCP gateway decodes, uploads, returns response

### Via Connector Action Endpoint — ChatGPT Actions, Claude Actions

The connector action endpoint accepts native binary files without base64 encoding:

```bash
curl -X POST https://dev-beta.aigentz.me/api/threshold/upload-action \
  -H 'Authorization: Bearer <constitutional_handshake_bearer>' \
  -F 'file=@/path/to/cover.png' \
  -F 'fileName=episode-42-cover.png' \
  -F 'domain=metaKnyts' \
  -F 'role=cover' \
  -F 'contentId=episode-42' \
  -F 'bind=true'
```

**ChatGPT action workflow:**
1. User selects file or generates image
2. Action POSTs native binary to `/api/threshold/upload-action`
3. Endpoint validates auth, forwards to canonical `/api/content/assets/upload`
4. Returns same response as MCP path

**Advantages over base64:**
- No encoding/decoding overhead
- Streams binary directly to Supabase/Autonomys
- Cleaner multipart interface for action declarations
- Same final response and authorization

### Via Claude Companion

The Companion can invoke either path. MCP example:

```typescript
const result = await mcpClient.callTool('upload_content_asset', {
  fileBase64: base64EncodedContent,  // Must use fileBase64 for JSON-RPC
  fileName: 'hero.jpg',
  domain: 'metaKnyts',
  role: 'hero',
  contentId: 'campaign-2024-q1',
  bind: true,
});
```

### Via Direct HTTP (MCP path, for testing)

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
        "fileBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "fileName": "pixel.png",
        "domain": "metaKnyts",
        "role": "thumbnail",
        "contentId": "episode-0"
      }
    }
  }'
```

## Backend Flow

### MCP Path (JSON-RPC)

1. **MCP Dispatch** → `/api/threshold/mcp` JSON-RPC router
2. **JSON-RPC Handler** → `callTool('upload_content_asset', args, ctx)` in `services/threshold/gateway.ts`
3. **Parameter Validation** → Verify exactly one of `fileBase64` or `file` is supplied
4. **Authorization Check** → Verify bearer token + `session.cartridgeFlags.isAdmin || isCreator`
5. **Base64 Decode** → Convert `fileBase64` to Buffer (or `file` if pre-decoded)
6. **MIME Type Inference** → Map `fileName` extension to MIME type
7. **Role Validation** → Verify role is one of 8 allowed values
8. **Multipart Construction** → Build FormData with Buffer + metadata
9. **Upload POST** → `fetch('/api/admin/codex/upload-asset', { method: 'POST', body: formData })`
10. **Parse Response** → Extract CID, assetId, publicUrl from Autonomys response
11. **Construct Return** → Build JSON-RPC response with ok, assetId, cid, publicUrl, etc.

### Connector Action Path (multipart/form-data)

1. **HTTP Dispatch** → `/api/threshold/upload-action` Next.js route handler
2. **Multipart Parse** → `await req.formData()` extracts file + metadata
3. **Authorization Check** → Verify bearer token + `session.cartridgeFlags.isAdmin || isCreator` (via `getActivePersona`)
4. **Validation** → Verify file + role + required params
5. **Multipart Construction** → Build new FormData with native File object + metadata
6. **Forward Upload** → `fetch('/api/content/assets/upload', { method: 'POST', body: formData, headers: { Authorization } })`
7. **Pass-through Response** → Parse response from canonical endpoint, return to caller

## Upstream Endpoints

### MCP Path Target

**Endpoint:** `POST /api/admin/codex/upload-asset`

**Scope:** Admin-only, Autonomys storage, returns CID

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
