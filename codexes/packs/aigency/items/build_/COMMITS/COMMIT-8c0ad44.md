# Commit Brief: `8c0ad44` — /api/uploads: extend VALID_USE_KINDS allowlist to include attachment + iqube_payload + venture_iqube

| Field | Value |
|-------|-------|
| SHA | [`8c0ad44`](https://github.com/iQube-Protocol/AigentZBeta/commit/8c0ad44bd484222f184dd06750023e2b419d4963) |
| Author | Claude |
| Date | 2026-05-30T02:46:18Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
/api/uploads: extend VALID_USE_KINDS allowlist to include attachment + iqube_payload + venture_iqube

Route's runtime allowlist was stuck on the original four use_kinds
(context / tool / workbench / general) — when the type union grew
(email_attachment in 6841d32d, iqube_payload in cf77ceb3, venture_iqube
in this session) the allowlist never caught up. POST coerced any other
kind to 'general' silently, which is why the operator picked "Ingest
as Venture iQube" in UploadDrawer and the file still landed tagged
'general'. /api/persona/venture-iqube/ingest then refused with
upload-wrong-use-kind.

Extend the array to mirror UploadUseKind exactly. Comment added so
future kind additions catch the lockstep requirement.

Suspect email_attachment + iqube_payload uploads have been silently
landing as 'general' for weeks too — the attachment picker happens to
sort 'email_attachment' first but the compose modal works even when
the row is 'general' since the picker fetches status=ready regardless,
so this regression was invisible until venture_iqube made the
upstream consumer strict about use_kind.
```

## Body

Route's runtime allowlist was stuck on the original four use_kinds
(context / tool / workbench / general) — when the type union grew
(email_attachment in 6841d32d, iqube_payload in cf77ceb3, venture_iqube
in this session) the allowlist never caught up. POST coerced any other
kind to 'general' silently, which is why the operator picked "Ingest
as Venture iQube" in UploadDrawer and the file still landed tagged
'general'. /api/persona/venture-iqube/ingest then refused with
upload-wrong-use-kind.

Extend the array to mirror UploadUseKind exactly. Comment added so
future kind additions catch the lockstep requirement.

Suspect email_attachment + iqube_payload uploads have been silently
landing as 'general' for weeks too — the attachment picker happens to
sort 'email_attachment' first but the compose modal works even when
the row is 'general' since the picker fetches status=ready regardless,
so this regression was invisible until venture_iqube made the
upstream consumer strict about use_kind.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/uploads/route.ts` |

## Stats

 1 file changed, 18 insertions(+), 1 deletion(-)
