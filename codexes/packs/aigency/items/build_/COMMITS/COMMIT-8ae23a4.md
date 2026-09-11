# Commit Brief: `8ae23a4` — add /api/admin/debug/pem-status diagnostic for PEM parse failures

| Field | Value |
|-------|-------|
| SHA | [`8ae23a4`](https://github.com/iQube-Protocol/AigentZBeta/commit/8ae23a46e20ab98271b467bae5b5fb3a5cd9370f) |
| Author | Claude |
| Date | 2026-06-09T01:13:50Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add /api/admin/debug/pem-status diagnostic for PEM parse failures

Surfaces exactly why DFX_IDENTITY_PEM is failing to parse: env-var
source, raw shape (length, line markers, whitespace), normalised
shape, isPemLike result, and the explicit error from each
Ed25519KeyIdentity.fromPem / Secp256k1KeyIdentity.fromPem attempt.

Returns previews only (first/last 30 chars) — never the PEM body
itself, so safe to expose to admin operators. Admin-gated via
getActivePersona.
```

## Body

Surfaces exactly why DFX_IDENTITY_PEM is failing to parse: env-var
source, raw shape (length, line markers, whitespace), normalised
shape, isPemLike result, and the explicit error from each
Ed25519KeyIdentity.fromPem / Secp256k1KeyIdentity.fromPem attempt.

Returns previews only (first/last 30 chars) — never the PEM body
itself, so safe to expose to admin operators. Admin-gated via
getActivePersona.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/admin/debug/pem-status/route.ts` |

## Stats

 1 file changed, 125 insertions(+)
