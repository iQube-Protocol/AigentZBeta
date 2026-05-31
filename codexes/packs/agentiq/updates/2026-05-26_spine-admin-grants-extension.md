# Spine Extension: Per-Cartridge Admin Grants on `ActivePersonaContext`

**Date:** 2026-05-26
**Scope:** PARAMOUNT spine file modifications — explicit operator approval recorded below.
**Status:** Shipped. Canary tests passing. ContentQube layer (Layer 3) deferred to fast-follow.

## Why this change

The prior commit train (`784c4bff` → `7dd0dd25`) introduced per-cartridge admin authorization as a bolted-on resolver outside the canonical Identity & Access Spine:

- A bespoke `services/access/cartridgeAdminGrants.ts` read CRM directly.
- A dedicated `GET /api/persona/cartridge-admin-grants` endpoint fetched the data.
- The UI consumed it via a separate `useCartridgeAdminGrants` hook.

This violated three explicit CLAUDE.md guarantees in the **Identity & Access Spine — CANONICAL SoT** section:

1. **"Don't rebuild these — the spine already provides them"** — `cartridgeFlags` is the canonical surface for cartridge-role authorization; a parallel resolver fragments the source of truth.
2. **"Extend by composition, not by forking"** — admin scope is a natural extension of the existing `cartridgeFlags` shape, not a separate API.
3. **"Every backend touchpoint involving identity, asset correlation, content gating, or rewards MUST flow through the identity spine"** — admin tab visibility and admin endpoint authorization are both identity/gating decisions and should flow through `getActivePersona` → `evaluateAccess`, not a side path.

The operator (Q1, 2026-05-26 playback) explicitly approved touching the four PARAMOUNT files to fix this:

> **Operator decision, 2026-05-26:** *"1. Yes [green light to modify the four PARAMOUNT spine files] and make note why and how you did. 2. Array. 3. Yes agreed [ship layers 1+2 now, defer layer 3 ContentQube to fast-follow]."*

This note is the record requested by point 1.

## What changed (file-by-file)

### PARAMOUNT spine file edits

**`types/access.ts`** — Two T1-safe field additions:

- `ActivePersonaContext.cartridgeFlags.adminCartridges: string[]` — the per-cartridge admin scope array, server-internal context shape.
- `ActivePersonaSurface.cartridgeFlags.adminCartridges: string[]` — same field on the browser-broadcast surface (slugs only; no underlying tenant/franchise ids).

Both are slug strings — T1-safe by construction. No T0 ids ever reach this shape.

**`services/identity/getActivePersona.ts`** — Single change in the `cartridge flags` resolution pass:

- The prior `Promise.all([resolveAdminFlag, resolvePartnerFlag])` grew a third leg calling the existing `getCartridgeAdminGrants(authProfileId, linkedAuthProfileIds)` helper (formerly the public resolver — now repositioned as a private spine implementation detail).
- `cartridgeFlags.isAdmin` is now the OR of the legacy `resolveAdminFlag` result and `getCartridgeAdminGrants().isGlobalAdmin` — either signal counts as global admin. Single boolean for downstream callers.
- `cartridgeFlags.adminCartridges` populated from `getCartridgeAdminGrants().cartridgeSlugs`.
- New `getCartridgeAdminGrants` import.

**`services/access/policyResolvers.ts`** — Extended `credentialMatchesCartridgeFlag`:

- Signature widened: third arg in `flags` is now optional `adminCartridges?: string[]`. Backwards compatible — legacy callers passing only `{isAdmin, isPartner}` still work.
- New credential class: `admin-cartridge:<slug>`. Matches when either `flags.isAdmin` is true (global uber-admin override) or `flags.adminCartridges.includes(slug)`.
- Malformed input (`admin-cartridge:` with no slug, or just `admin-cartridge` with no colon) returns false — fail-closed.

**`services/access/evaluateAccess.ts`** — No edit required. `evaluateAccess` already calls `credentialMatchesCartridgeFlag(credential, context.cartridgeFlags)` with the full flags object; the type widening on `ActivePersonaContext.cartridgeFlags` flows through transparently. This was the fourth PARAMOUNT file the operator approved touching but turned out not to need modification — the spine's existing wholesale-pass pattern absorbed the extension for free.

### Non-PARAMOUNT consumers updated

- `app/api/wallet/active-persona/route.ts` — already spreads `cartridgeFlags` wholesale; new field flows through automatically.
- `app/api/assistant/bootstrap/route.ts` — inline interface declaration widened to mirror the spine shape.
- `app/contexts/PersonaContext.tsx` — `BroadcastSurface` type widened to accept optional `adminCartridges`.
- `app/api/persona/cartridge-admin-grants/route.ts` — **rewritten as a thin pass-through over `getActivePersona()`**. No longer re-queries CRM. Marked deprecated in JSDoc; carries a `_deprecated` hint field in responses so anyone reading the JSON sees the migration path. Existing clients keep working unchanged.

### Canary tests

- **NEW** `tests/spine-admin-cartridges.test.ts` — 10 tests locking:
  - T1 surface serialisation never contains `tenant_id` / `franchise_id` / `auth_profile_id` / `kybe_did` / `rootDid` / `did:fio:` (the standard no-leak guarantee).
  - T0 context's `adminCartridges` carries strings only (never UUIDs).
  - `credentialMatchesCartridgeFlag` semantics:
    - Matches `admin-cartridge:<slug>` against the array.
    - Global `isAdmin` satisfies any `admin-cartridge:<slug>` (uber override).
    - Tenant-admin grants do NOT promote to global `isAdmin`.
    - Partner credential unaffected by `adminCartridges`.
    - Malformed credentials return false.
    - Legacy callers without `adminCartridges` field still work (backwards compat).
  - Spine resolver returns the expected cartridge slug set and never leaks internal ids.

- **Extended** `tests/cartridge-admin-grants.test.ts` — already had 10 tests covering the resolver; no changes needed since the helper was repositioned, not rewritten.

- **Already-passing** `tests/persona-broadcast-handshake.test.ts` — 11 tests, all still pass. The existing no-leak assertions naturally extend to the new field since they regex against forbidden T0 strings rather than enumerating allowed shapes.

## What did NOT change

- **ContentQube admin descriptors (Layer 3)** — deferred to fast-follow per operator decision. The plan stands: model admin-tier content via the existing `ContentAccessDescriptor` shape with `gating.credential: 'admin-cartridge:<slug>'`. The policy resolver extension landed in this commit IS the prerequisite — once Layer 3 wires admin descriptors via `getContentDescriptor()`, the existing `evaluateAccess` path handles them with no further changes.

- **Existing routes that gate on `cartridgeFlags.isAdmin`** — every admin endpoint that previously checked the global flag still does. They get a refinement window: a tenant-admin who isn't a global admin now passes UI gates but those endpoints still 403 them. The fast-follow (#4 in the prior backlog doc) extends each `/api/admin/<cartridge>/*` route to also accept `admin-cartridge:<slug>` so endpoint authorization matches UI gating.

- **Multi-tenant cartridge mapping (`21 Sats worlds`)** — the alpha tenant↔cartridge slug alias table inside `cartridgeAdminGrants.ts` is unchanged. Backlog item from prior doc stands.

## How to audit / verify

1. **Spine canary** — `npx vitest run tests/spine-admin-cartridges.test.ts`. All 10 tests must pass.
2. **No regression** — `npx vitest run tests/cartridge-admin-grants.test.ts tests/persona-broadcast-handshake.test.ts`. 21/21 must pass.
3. **Wire inspection** — load `/api/wallet/active-persona` as a KNYT-admin persona. Response should contain `cartridgeFlags.adminCartridges: ["knyt-codex"]`. No `tenant_id`, no `auth_profile_id` anywhere in the response body.
4. **UI parity** — admin tabs surface inside metaMe Activation groups as before. The hook still fetches `/api/persona/cartridge-admin-grants`; the endpoint now pulls from the spine instead of re-querying CRM, but the response shape is identical to clients.
5. **Backwards compat** — legacy admin checks like `if (persona.cartridgeFlags.isAdmin)` still work everywhere. The new field is additive.

## Next (Layer 3 fast-follow scope)

- Define `'admin-surface'` or `'admin-cartridge'` as a recognized `ContentGatingDescriptor.kind` in `types/access.ts`.
- Extend `services/content/getContentDescriptor.ts` so admin-tier content slices carry the new descriptor.
- Update `services/access/evaluateAccess.ts` to route admin descriptors through the new credential class (the resolver already understands it; just needs to wire from the gating branch).
- Server-side enforcement on `/api/admin/<cartridge>/*` endpoints — replace bespoke `if (!ctx.cartridgeFlags.isAdmin)` checks with `await evaluateAccess(ctx, descriptor, action)` so the gate decision is centralized.

These are tracked in the prior backlog doc `2026-05-26_admin-tab-in-activation-backlog.md` and can be tackled as a separate commit train once this Layer 1+2 spine extension settles.
