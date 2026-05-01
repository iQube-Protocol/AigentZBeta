# Commit Brief: `516b95d` — gate community-content admin endpoints with server-side role check

| Field | Value |
|-------|-------|
| SHA | [`516b95d`](https://github.com/iQube-Protocol/AigentZBeta/commit/516b95d7ff38b8cf573161d5483b558834150dd0) |
| Author | Claude |
| Date | 2026-04-29T20:43:04Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
gate community-content admin endpoints with server-side role check

Restores the admin-auth hardening that was reverted in 4404cbb. Does
not touch the runtime — only the three community-content admin routes
and the admin tab that calls them.

Adds requireCommunityAdmin() helper that resolves adminPersonaId →
personas.auth_profile_id → crm_admin_roles, mirroring the lookup
/api/codex/admin-check uses for embed bridge auth. Returns 401 if no
adminPersonaId, 403 if no auth profile or no active role.

Wired into:
- POST /api/community-content/[id]/promote
- POST /api/community-content/[id]/reject
- POST /api/community-content/settings  (now also requires adminPersonaId
  in the body — the admin tab sends it on save)

Closes the gap noted in the phase 5 commit (\"admin gating is UI-side
... does not perform a server-side role check\"). UI tab gating
remains as defence in depth.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Restores the admin-auth hardening that was reverted in 4404cbb. Does
not touch the runtime — only the three community-content admin routes
and the admin tab that calls them.

Adds requireCommunityAdmin() helper that resolves adminPersonaId →
personas.auth_profile_id → crm_admin_roles, mirroring the lookup
/api/codex/admin-check uses for embed bridge auth. Returns 401 if no
adminPersonaId, 403 if no auth profile or no active role.

Wired into:
- POST /api/community-content/[id]/promote
- POST /api/community-content/[id]/reject
- POST /api/community-content/settings  (now also requires adminPersonaId
  in the body — the admin tab sends it on save)

Closes the gap noted in the phase 5 commit (\"admin gating is UI-side
... does not perform a server-side role check\"). UI tab gating
remains as defence in depth.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/community-content/[id]/promote/route.ts` |
| Modified | `app/api/community-content/[id]/reject/route.ts` |
| Added | `app/api/community-content/_lib/adminAuth.ts` |
| Modified | `app/api/community-content/settings/route.ts` |
| Modified | `app/triad/components/codex/tabs/KnytCommunityContentAdminTab.tsx` |

## Stats

 5 files changed, 78 insertions(+), 2 deletions(-)
