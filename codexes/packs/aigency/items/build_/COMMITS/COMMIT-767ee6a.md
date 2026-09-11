# Commit Brief: `767ee6a` — fix Qriptopian essay cover corruption at its two real root causes

| Field | Value |
|-------|-------|
| SHA | [`767ee6a`](https://github.com/iQube-Protocol/AigentZBeta/commit/767ee6a160a9d1157fa3911293e24fe367edaa65) |
| Author | Claude |
| Date | 2026-08-22T08:50:37Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Qriptopian essay cover corruption at its two real root causes

Forensic finding (live-verified against dev-beta before any fix): three
different failure modes traced to two distinct defects, not a display bug.

1. app/api/threshold/mcp/route.ts::callUploadContentAsset decoded the
   JSON-RPC fileBase64/file argument with Buffer.from(x, 'base64')
   unconditionally. Node's base64 decoder silently skips characters outside
   the base64 alphabet instead of rejecting them, so a data-URL prefix or
   any malformed input decoded to a plausible-length but corrupt buffer with
   no error anywhere in the pipeline. Confirmed live: essays 002 and 003's
   cover assets fail at Sharp decode ("Input buffer contains unsupported
   image format") even though GCM-authenticated decryption succeeds —
   proving the bytes that were originally encrypted were never a valid
   image. Added decodeBase64Strict() (rejects data-URL prefixes, whitespace,
   non-base64 chars, bad length) and assertDecodableImage() (full Sharp
   decode before persistence for cover/thumbnail/hero/social roles), both in
   services/threshold/uploadContentAsset.ts, wired into the one live MCP
   upload path.

2. app/api/qriptopian/essay-cover/[id]/route.ts and
   app/api/content/media/[id]/route.ts trusted an existing object in public
   storage by filename match alone. Confirmed live: essay 004's cached
   derivative is a structurally valid 1024x1536 WebP (Sharp decodes it
   without error) whose bottom ~45% is a flat RGB(128,128,128) fill — the
   signature of a decoder given a truncated source. A decode-success/
   dimension check cannot catch this; added
   server/services/imageDerivativeValidation.ts
   (hasSuspiciousUniformBand + assertValidImageDerivative) and wired it into
   both the cache-trust path (purge + regenerate on failure) and the
   post-materialization path in both routes, independently — hero/social
   delivery is not merged into the cover contract.

Essays 002 and 003's canonical Autonomys objects are themselves corrupt
(proven via authenticated decrypt yielding non-image bytes) and cannot be
repaired without a re-upload of the source image; that repair is now
validated end-to-end so it cannot silently recur.

No new proxy route, no proxy chaining, no browser/persona auth added to the
public cover path — existing contracts fixed in place.

Adds: tests/qriptopian-essay-cover-validation.test.ts (16 deterministic
canaries reproducing both defect classes), scripts/smoke-qriptopian-essay-covers.ts
(live dev-beta smoke test — already confirms the current 3 live failures).
Updates: tests/threshold-upload-path-invariant.test.ts (prior canary asserted
the exact pre-fix source string; updated to assert the corrected, equally
protective invariant — no pooled-ArrayBuffer .buffer usage — plus the new
image-validation call).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Forensic finding (live-verified against dev-beta before any fix): three
different failure modes traced to two distinct defects, not a display bug.

1. app/api/threshold/mcp/route.ts::callUploadContentAsset decoded the
   JSON-RPC fileBase64/file argument with Buffer.from(x, 'base64')
   unconditionally. Node's base64 decoder silently skips characters outside
   the base64 alphabet instead of rejecting them, so a data-URL prefix or
   any malformed input decoded to a plausible-length but corrupt buffer with
   no error anywhere in the pipeline. Confirmed live: essays 002 and 003's
   cover assets fail at Sharp decode ("Input buffer contains unsupported
   image format") even though GCM-authenticated decryption succeeds —
   proving the bytes that were originally encrypted were never a valid
   image. Added decodeBase64Strict() (rejects data-URL prefixes, whitespace,
   non-base64 chars, bad length) and assertDecodableImage() (full Sharp
   decode before persistence for cover/thumbnail/hero/social roles), both in
   services/threshold/uploadContentAsset.ts, wired into the one live MCP
   upload path.

2. app/api/qriptopian/essay-cover/[id]/route.ts and
   app/api/content/media/[id]/route.ts trusted an existing object in public
   storage by filename match alone. Confirmed live: essay 004's cached
   derivative is a structurally valid 1024x1536 WebP (Sharp decodes it
   without error) whose bottom ~45% is a flat RGB(128,128,128) fill — the
   signature of a decoder given a truncated source. A decode-success/
   dimension check cannot catch this; added
   server/services/imageDerivativeValidation.ts
   (hasSuspiciousUniformBand + assertValidImageDerivative) and wired it into
   both the cache-trust path (purge + regenerate on failure) and the
   post-materialization path in both routes, independently — hero/social
   delivery is not merged into the cover contract.

Essays 002 and 003's canonical Autonomys objects are themselves corrupt
(proven via authenticated decrypt yielding non-image bytes) and cannot be
repaired without a re-upload of the source image; that repair is now
validated end-to-end so it cannot silently recur.

No new proxy route, no proxy chaining, no browser/persona auth added to the
public cover path — existing contracts fixed in place.

Adds: tests/qriptopian-essay-cover-validation.test.ts (16 deterministic
canaries reproducing both defect classes), scripts/smoke-qriptopian-essay-covers.ts
(live dev-beta smoke test — already confirms the current 3 live failures).
Updates: tests/threshold-upload-path-invariant.test.ts (prior canary asserted
the exact pre-fix source string; updated to assert the corrected, equally
protective invariant — no pooled-ArrayBuffer .buffer usage — plus the new
image-validation call).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/content/media/[id]/route.ts` |
| Modified | `app/api/qriptopian/essay-cover/[id]/route.ts` |
| Modified | `app/api/threshold/mcp/route.ts` |
| Added | `scripts/smoke-qriptopian-essay-covers.ts` |
| Added | `server/services/imageDerivativeValidation.ts` |
| Modified | `services/threshold/uploadContentAsset.ts` |
| Added | `tests/qriptopian-essay-cover-validation.test.ts` |
| Modified | `tests/threshold-upload-path-invariant.test.ts` |

## Stats

 8 files changed, 587 insertions(+), 10 deletions(-)
