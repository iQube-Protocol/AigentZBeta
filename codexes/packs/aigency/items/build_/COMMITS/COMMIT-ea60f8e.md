# Commit Brief: `ea60f8e` — CLAUDE.md: document spine-fetch auth contract + per-cartridge admin grants

| Field | Value |
|-------|-------|
| SHA | [`ea60f8e`](https://github.com/iQube-Protocol/AigentZBeta/commit/ea60f8e87e08db5782fe0bf1bf1be7d34765de13) |
| Author | Claude |
| Date | 2026-05-26T09:53:25Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CLAUDE.md: document spine-fetch auth contract + per-cartridge admin grants

Two additions to the Identity & Access Spine — CANONICAL SoT section
so future agents don't repeat the 2026-05-26 admin-tab regression.

1) Don't-rebuild table grows two rows
   - Per-cartridge admin checks now flow through
     persona.cartridgeFlags.adminCartridges (slug array, server-
     resolved). Credential class `admin-cartridge:<slug>` for
     evaluateAccess paths. `isAdmin: true` satisfies any per-cartridge
     gate. This codifies the spine extension that landed earlier this
     session.
   - Client-side fetches to spine endpoints MUST use personaFetch,
     never raw fetch.

2) New PARAMOUNT sub-section "Client-side spine fetches"
   Spells out the auth contract explicitly:
   - Any route that calls getActivePersona / getCallerIdentityContext
     requires Authorization: Bearer <supabase-jwt>
   - Cookies + credentials: 'same-origin' are NOT sufficient
   - Use personaFetch from utils/personaSpine — auto-attaches the
     Bearer token via getSupabaseAccessToken()
   - Lists which route families fall under the rule (assistant, admin,
     persona, wallet/active-persona, access, connectors)
   - Includes the symptom signature (silent 401 → empty / fail-closed
     state → "feature just doesn't work for this user") so the next
     agent recognises it earlier
   - Documents the DevTools / browser-URL debugging workaround
     (manually pull token from localStorage, attach it) since neither
     of those contexts attaches Authorization by default

The 2026-05-26 root cause is preserved as the cautionary example so
the cost-context is concrete: a hook used raw fetch, every spine
endpoint returned 401, the admin-tab filter silently denied every
gated tab — even for global uber_admins — and the symptom looked
exactly like "admin grants aren't resolving" when in fact the FE
was just failing to send the token.
```

## Body

Two additions to the Identity & Access Spine — CANONICAL SoT section
so future agents don't repeat the 2026-05-26 admin-tab regression.

1) Don't-rebuild table grows two rows
   - Per-cartridge admin checks now flow through
     persona.cartridgeFlags.adminCartridges (slug array, server-
     resolved). Credential class `admin-cartridge:<slug>` for
     evaluateAccess paths. `isAdmin: true` satisfies any per-cartridge
     gate. This codifies the spine extension that landed earlier this
     session.
   - Client-side fetches to spine endpoints MUST use personaFetch,
     never raw fetch.

2) New PARAMOUNT sub-section "Client-side spine fetches"
   Spells out the auth contract explicitly:
   - Any route that calls getActivePersona / getCallerIdentityContext
     requires Authorization: Bearer <supabase-jwt>
   - Cookies + credentials: 'same-origin' are NOT sufficient
   - Use personaFetch from utils/personaSpine — auto-attaches the
     Bearer token via getSupabaseAccessToken()
   - Lists which route families fall under the rule (assistant, admin,
     persona, wallet/active-persona, access, connectors)
   - Includes the symptom signature (silent 401 → empty / fail-closed
     state → "feature just doesn't work for this user") so the next
     agent recognises it earlier
   - Documents the DevTools / browser-URL debugging workaround
     (manually pull token from localStorage, attach it) since neither
     of those contexts attaches Authorization by default

The 2026-05-26 root cause is preserved as the cautionary example so
the cost-context is concrete: a hook used raw fetch, every spine
endpoint returned 401, the admin-tab filter silently denied every
gated tab — even for global uber_admins — and the symptom looked
exactly like "admin grants aren't resolving" when in fact the FE
was just failing to send the token.

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |

## Stats

 1 file changed, 48 insertions(+)
