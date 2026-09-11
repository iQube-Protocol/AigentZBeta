# myCartridge Phase 4b — spine extension (getActivePersona + policyResolvers)

**Date:** 2026-06-02
**Status:** shipped — surgical extension to PARAMOUNT spine files; operator pre-authorized
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §23, §33 row 4
**Predecessor:** `codexes/packs/agentiq/updates/2026-06-02_mycartridge-phase-4a-config-roles-db.md`

## Scope

Phase 4b lights up the schema landed in Phase 4a. Three protected files extended additively; no parallel resolvers introduced. The spine remains the single source of truth for cartridge role authorization per CLAUDE.md PARAMOUNT rules.

## Files modified

| File | Change | PARAMOUNT? |
|---|---|---|
| `types/access.ts` | Added optional `cartridgeMemberships?: CartridgeMembershipsMap` to both T0 `ActivePersonaContext.cartridgeFlags` and T1 `ActivePersonaSurface.cartridgeFlags`. Extended `ContentGatingDescriptor.credential` docs with the new `member:<slug>` and `role:<slug>:<role>` formats. | Yes |
| `services/identity/getActivePersona.ts` | Added `resolveCartridgeMemberships(personaId)` helper. Wired into the existing `Promise.all` next to `resolveAdminFlag` / `getCartridgeAdminGrants` (same pattern, same fail-closed posture). Surfaces `cartridgeMemberships` in the returned `cartridgeFlags`. | Yes |
| `services/access/policyResolvers.ts` | Extended `credentialMatchesCartridgeFlag` with branches for `member:<slug>` and `role:<slug>:<role>`. Both honour the existing `isAdmin` / `adminCartridges` short-circuits. Uses `meetsCartridgeRole()` from `types/cartridgeMembership.ts` for hierarchy comparison. | Yes |
| `tests/access-spine.test.ts` | Added 6 new tests for the credential resolvers + 1 privacy canary asserting role + slug never leak into the AccessDecision receipt. | No |

## What the new credential formats look like

| Credential | Allows when |
|---|---|
| `member:<slug>` | persona holds ANY role in `cartridgeMemberships[slug]`, OR `isAdmin === true`, OR `adminCartridges.includes(slug)` |
| `role:<slug>:<role>` | persona's role in `cartridgeMemberships[slug]` meets-or-exceeds `<role>` per PRD §23 hierarchy, OR `isAdmin === true`, OR `adminCartridges.includes(slug)` |

The PRD §23 hierarchy (descending power):

```
owner > admin > editor > contributor > member > partner > franchisee > correspondent > guest
```

Implemented in `types/cartridgeMembership.ts:CARTRIDGE_ROLE_HIERARCHY` and `meetsCartridgeRole()`.

## Surgical-precision posture (matches the operator approval)

1. **Optional field, not required.** `cartridgeMemberships?:` is optional on both T0 and T1 `cartridgeFlags`. Every existing literal across the codebase (`debugBypass.ts`, `resolveIframePersona.ts`, route-local types, test fixtures) continues to compile unchanged. Consumers treat absent as `{}`.

2. **Single-table parallel query.** `resolveCartridgeMemberships` adds one `SELECT cartridge_slug, role FROM cartridge_memberships WHERE persona_id = $1` to the existing `Promise.all` in `getActivePersona`. No N+1, no extra round trips, no blocking.

3. **Fail-closed.** Any DB error returns `{}` so a transient outage produces a no-membership posture, never a thrown spine. Mirrors the `resolveAdminFlag` pattern.

4. **No parallel resolver introduced.** The PRD §23 explicitly forbids call-site role checks. All gates flow through `evaluateAccess(persona, descriptor, action)` with descriptor credentials. The role hierarchy comparison lives in `meetsCartridgeRole()` (pure function) called only from `credentialMatchesCartridgeFlag()`.

5. **T1 safety preserved.** The `CartridgeMembershipsMap` projection is slug → role only. The underlying `cartridge_memberships.persona_id`, `granted_by`, `granted_at`, and `metadata` fields never appear in the projection. The new privacy canary in `access-spine.test.ts` (lines tied to `Phase 4b — cartridgeMemberships is T1-safe`) asserts the receipt never echoes the persona id or the role string.

## Test results

```
tests/access-spine.test.ts              — 31 passed, 1 pre-existing fail
                                          (isDebugBypassEnabled hardcoded-ON
                                          assertion; impl now env-gated;
                                          unrelated to this change)
tests/layer3-admin-cartridge-gating     — 6 passed (no regressions)
tests/require-cartridge-admin           — 5 passed (no regressions)
tests/spine-admin-cartridges            — 17 passed (no regressions)
tests/persona-broadcast-handshake       — 4 passed (no regressions)
```

Type-check on the full project: clean (only pre-existing tsconfig noise).

## Migration impact for downstream callers

**No callsite changes required.** The spine extension is purely additive:

- Existing code that reads `persona.cartridgeFlags.isAdmin` / `adminCartridges` / `isPartner` works unchanged.
- New code that needs to gate on cartridge membership uses an `evaluateAccess` descriptor with a `member:<slug>` or `role:<slug>:<role>` credential — same shape as the existing `admin-cartridge:<slug>` pattern.

**Don't write this:**
```ts
// ❌ parallel resolver — forbidden per PRD §23
if (persona.cartridgeFlags.cartridgeMemberships?.[slug] === 'editor') { ... }
```

**Write this instead:**
```ts
// ✅ all role checks flow through evaluateAccess
const decision = await evaluateAccess(persona, {
  ...descriptor,
  gating: { kind: 'credential', credential: `role:${slug}:editor` },
}, action);
if (decision.allow) { ... }
```

## What's next (Phase 5)

The unblocked path:

- **Phase 5 (tab templates):** `TabRenderer.tsx` can now consume `codex_tabs.role_required` / `member_only` / `invite_only` / `token_gated` from Phase 4a, evaluate them via `evaluateAccess` with the new credentials, and render conditionally.
- **Phase 6 (CartridgeSetupWizard):** can write `cartridge_memberships(slug, persona_id, role='owner')` for the wizard runner at cartridge creation time. Subsequent loads of `getActivePersona` will project the owner role into `cartridgeMemberships` automatically.
- **Phase 7 (operator manager):** owner-only member-list UI reads `cartridge_memberships` filtered by `cartridge_slug`. The list of members is admin-only — the spine continues to never expose other personas' ids to the browser.

No further spine writes required for Phases 5–11 — the extension here is sufficient for all downstream consumers.

## Reversibility

If a rollback is needed:

1. The `types/access.ts` field is optional — removing it never breaks consumers.
2. The `getActivePersona.ts` resolver returns `{}` on any error; deleting the call site leaves `cartridgeFlags.cartridgeMemberships` undefined and consumers treat it as no-memberships.
3. The `policyResolvers.ts` extension adds two new credential prefixes (`member:` / `role:`); removing those branches falls through to `return false` (deny), matching the original semantics.
4. The Phase 4a tables remain — they're harmless when unread.

All three edits are individually revertable without coordinated rollback.
