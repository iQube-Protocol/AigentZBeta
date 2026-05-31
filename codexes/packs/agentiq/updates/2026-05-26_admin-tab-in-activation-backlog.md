# Admin Tab in Activation Sub-Surface — Backlog + Protocol

**Status:** v1 shipped 2026-05-26 (KNYT Admin → metaMe Order of Metayé). Fast-follow items + the protocol going forward are captured here.

## What shipped (v1)

The "chief-of-staff unlock" for founder-operator personas. When a persona is an admin of cartridge Y, they now see Y's Admin tab — with full sub-nav — embedded inside their metaMe Cartridge's corresponding Activation sub-surface, without leaving metaMe. Non-admin personas see nothing.

Concretely landed in this commit chain:

| Layer | File |
|---|---|
| Server resolver | `services/access/cartridgeAdminGrants.ts` |
| API route | `app/api/persona/cartridge-admin-grants/route.ts` |
| Type extension | `types/codex.ts` — `CodexTab.adminOfCartridge?: string` |
| Filter pipeline | `app/hooks/useCodexConfig.ts` — `getEnabledTabs` accepts grants |
| Client hook | `app/hooks/useCartridgeAdminGrants.ts` |
| Panel wiring | `app/triad/components/CodexPanelDynamic.tsx` — top-level filter + subTab filter both honour the gate |
| First mirror | `data/codex-configs.ts` — `knytAdminTabsForMetameOrder()` + new "KNYT Admin" tab in METAME_CODEX's order group |
| Canary | `tests/cartridge-admin-grants.test.ts` — 7 tests locking no-leak guarantees |

## Protocol for future mirrors (best practice)

The pattern is now repeatable. To surface another cartridge's Admin tab inside a metaMe Activation sub-surface:

1. **Eligibility check.** The source cartridge must have a top-level `admin` tabGroup with `adminOnly: true`. Cartridges in scope today: KNYT (✓ wired), Qriptopian, AgentiQ OS (its own admin surface), Venture Lab (when its admin tab lands).

2. **Pick the metaMe group it pairs with.** Each activation's source cartridge maps to a tabGroup in METAME_CODEX (e.g. `order` ↔ KNYT, `qriptopia` ↔ Qriptopian).

3. **Mirror helper.** Add a `XAdminTabsForMetameY()` helper alongside `knytAdminTabsForMetameOrder()` that:
   - Filters the source cartridge's tabs by `group === 'admin'` + `enabled`
   - Maps each tab: drop `adminOnly`, set `adminOfCartridge: '<source-codex-slug>'`, reassign `group`, prefix slugs to avoid collisions.

4. **Add the mirror tab.** Add a new top-level tab (e.g. `order-knyt-admin`) to METAME_CODEX with the same activation gate as its siblings, `adminOfCartridge` set, and `subTabs: XAdminTabsForMetameY()`.

5. **Verify.** Canary test the no-leak guarantee for the new grant — non-admins MUST NOT see the new tab id in `getEnabledTabs(...)` output.

## Fast-follow backlog

### 1. Tenant ↔ cartridge slug mapping refinement

**Status:** Alpha assumption. The grants resolver treats `crm_tenants.slug` as the cartridge slug verbatim. This holds today because cartridges and tenants are 1:1 by slug. When multi-tenant cartridges arrive (e.g. the 21 Sats worlds — multiple tenants under one franchise that all share a single cartridge), we need an explicit mapping.

**Where to extend:** `services/access/cartridgeAdminGrants.ts`. Two clean options:

- **Table-driven**: add a `crm_cartridge_tenants(cartridge_slug TEXT, tenant_id UUID)` join table. Resolver reads this to fan tenant_id → cartridge_slug.
- **Convention-driven**: a registry-side declaration in `data/codex-configs.ts` of `CodexConfig.tenantSlugs?: string[]` and the resolver inverts that map.

Table-driven is more flexible for ops; convention-driven is simpler for engineering. Recommend table-driven once the second multi-tenant cartridge lands.

### 2. aigentMe recommender data context extension

**Status:** Confirmed scope (Q4 in the playback). The UI gate is now in place; the next workstream is having aigentMe's NBE/NBA recommender server-side ALSO consume admin-tier slices when the persona has admin grants. So a KNYT-admin persona's brief / move-forward / venture-progress recommendations get framed with full KNYT operational state, not just the persona's own surface-tier data.

**Where to extend:**
- `services/orchestration/briefBuilder.ts` — fetch `getCartridgeAdminGrants(personaId)` early. For each granted cartridge, optionally pull an admin-tier summary (NBE candidates with elevated weighting, blocked items, partner ops state, etc.) from the source cartridge's existing admin endpoints. Fold into the LLM rerank `liveContext` field (already plumbed for Capability Gateway preflight).
- `services/orchestration/specialistRecommender.ts` — same idea; admin grants influence the deterministic baseline (e.g. KNYT admin → bias toward Kn0w1 + Marketa for KNYT-related queries).

Keep the admin-tier slice strictly within recommender prompt input. Never surface the raw admin data through the UI unless it routes through the existing admin tab (which already has the gate). DVN receipts should still tag the surfaced consultations with `tools_used: ['admin-tier-context']` so the receipts ledger flags when admin grants influenced a recommendation.

### 3. Admin tree alignment (uber / franchise / tenant ↔ cartridge)

**Status:** Today's resolver hard-codes the role-type buckets:

- `uber_admin` / `category_uber_admin` / `platform_super_admin` → `isGlobalAdmin = true`
- `franchise_super_admin` → fan-out to child tenants
- `tenant_super_admin` / `category_admin` → that tenant

When the proper "admin tree" specification lands (per the operator's note: "We can add the proper specification of this admin tree structure to the backlog"), three things to revisit:

- **Category admins**: today they're treated as tenant-scoped admins. The spec may grant them broader scope (e.g. `category_admin` of `marketing` could imply admin of every cartridge in the marketing category).
- **Inherited grants**: an uber admin should also appear as a tenant admin for each tenant when audited. The grants resolver currently short-circuits at uber; the audit view should expand the inheritance.
- **Expiry + suspension**: the resolver already filters on `is_active = true`, but doesn't honour `expires_at`. When admin roles start carrying expiry windows in production, fold that into the WHERE clause.

### 4. Server-side enforcement on admin endpoints

**Status:** Soft gap.

The UI gate prevents non-admins from rendering the mirrored KNYT admin tab. But the underlying admin endpoints (e.g. `/api/admin/knyt/tasks-rewards`, `/api/admin/knyt/store/...`) gate on `persona.cartridgeFlags.isAdmin` — the GLOBAL admin flag. A tenant-only admin of KNYT today passes the per-cartridge gate to RENDER the tab, but the endpoints they'd call may reject them with 403 because they aren't a global admin.

Two clean fixes (either or both):

- Extend each admin endpoint to call `getCartridgeAdminGrants(persona)` + check the per-cartridge grant when the endpoint is cartridge-scoped (`/api/admin/knyt/...` → require `grants.cartridgeSlugs.includes('knyt-codex')` OR `grants.isGlobalAdmin`).
- Or grant tenant-admins the corresponding global admin flag in the spine when they're acting inside that cartridge's surface. (Riskier — broadens the global admin set.)

Recommend the first; gives endpoint-level granularity.

### 5. UI affordance — admin-tab visual treatment

**Status:** Cosmetic. Today the mirrored "KNYT Admin" tab renders identically to its siblings in the metaMe Order group. A subtle treatment (small lock icon, amber accent, "admin" badge) would make the elevated scope obvious to the operator — useful when they're switching between their own metaMe context and admin-tier KNYT context within the same surface.

Add a CSS treatment keyed off `tab.adminOfCartridge` in CodexPanelDynamic's tab-render path. Small change; defer until the data context extension (#2) lands so the visual hierarchy is informed by the full UX.

## Linked

- Playback that locked the design: this session, 2026-05-26
- Per-cartridge admin grants implementation commit: `784c4bff` (resolver + route + canary)
- Mirror commit: pending (about to land)
- Q4 fast-follow: `services/orchestration/briefBuilder.ts` + `specialistRecommender.ts`
