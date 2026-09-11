# myCartridge Phase 7 — operator manager surface

**Date:** 2026-06-02
**Status:** shipped — `MyCartridgeTab` repurposed as the manager + 5 API routes + shared auth guard
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §14, §32 Phase 7, §33 row 7
**Predecessors:** Phase 4a (DB), Phase 4b (spine — `cartridgeMemberships` projection + `member:` / `role:` credentials), Phase 6 (wizard writes the rows the manager edits)

## Scope

Operator-tier surface so the cartridge creator (or any persona with an `owner` / `admin` role on a cartridge, or a platform `isAdmin`) can list, inspect, and edit their cartridges from inside metaMe — without ever touching `/admin/codex` (which is the super-admin tier).

## What landed

### Shared auth guard

`services/cartridge/manageGuard.ts` — single helper every Phase 7 route calls. Resolution rules:

| Caller property | Read | Write |
|---|---|---|
| `cartridgeFlags.isAdmin === true` (uber-tier) | ✓ | ✓ |
| `cartridgeFlags.adminCartridges.includes(slug)` (Phase 4b CRM grant) | ✓ | ✓ |
| `cartridgeMemberships[slug] === 'owner'` (Phase 4b cartridge_memberships) | ✓ | ✓ |
| `meetsCartridgeRole(memberships[slug], 'admin')` (admin role on this cartridge) | ✓ | ✓ |
| `meetsCartridgeRole(..., 'editor')` / contributor / member | ✓ | ✗ (403) |
| no role at all | ✗ (403) | ✗ (403) |

Returns either `CartridgeManageContext` (allow) or a `NextResponse` (deny) so a route can short-circuit in one line: `if (guard instanceof NextResponse) return guard;`.

This centralises the permission boundary per PRD §14 — no parallel resolvers at call sites. Adding a new write tier means one edit here, not five.

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/cartridge/list-mine` | GET | Returns the operator's owned cartridges + cartridges they hold a role on. Each row carries `role` and `canEdit`. T0 `owner_persona_id` is stripped. |
| `/api/cartridge/[slug]` | GET | Returns full cartridge detail: config, tabs, memberships, caller permission posture. Memberships render as `personaDisplayToken` (8-char prefix), not raw `persona_id`, to keep the response T1-safe. |
| `/api/cartridge/[slug]` | PATCH | Edit identity (title, description, purpose, category, visibility), primaryTabSlug, availableSpecialists (cap 3), tokenWhitelist. Zod-validated. Slug-uniqueness already pinned by the DB. |
| `/api/cartridge/[slug]/tabs` | PATCH | Bulk edit tabs — per-tab visibility (member/admin/invite/token-gated → `member_only` / `invite_only` / `role_required` / `token_gated` columns from Phase 4a), enabled, order, label. Sequential per-row updates; per-row failure returns `partial.updated` so the UI can recover. |
| `/api/cartridge/[slug]/members` | POST | Invite by personaId. Upserts so re-invite acts as a change-role. Refuses to grant `owner` (Phase 7b's transfer-ownership flow handles that). |
| `/api/cartridge/[slug]/members/[personaId]` | DELETE | Revoke membership. Refuses to delete the `owner` row (409 with hint to use the Phase 7b transfer flow). |

All write routes go through `cartridgeManageGuard(..., { requireWrite: true })`. Reads go through `requireWrite: false`.

### `MyCartridgeTab.tsx`

Replaces the Phase 2 stub with the operator manager surface.

Layout: left rail lists the operator's cartridges (showing role + tab count + visibility); right panel renders the detail editor for the selected slug. When the list is empty, the surface shows a "Create your first cartridge" CTA that opens the Phase 6 wizard.

The detail editor has five sections:

1. **Identity** — title, description, category, visibility. Dirty-aware save button.
2. **Tabs** — primary-tab radio + per-tab visibility picker + enabled toggle. Calls `/api/cartridge/[slug]/tabs` PATCH.
3. **Specialists** — chip-toggle multi-select capped at 3 with the free-tier lock per §35 R7.
4. **Wallet tokens** — Q¢ / USDC / KNYT chip-toggle.
5. **Members** — invite form (personaId + role select) + roster list. Revoke surfaces a clear "Phase 7b will resolve display tokens server-side" message; the manual DELETE path is documented for the operator who needs the action today.

The wizard is also mounted at the bottom so the rail's `+` button opens it.

### Permissions display

Every detail header carries a `caller: <reason>` chip (`uber-admin` / `cartridge-admin-grant` / `owner` / `admin-role` / `editor-role` / `contributor-role` / `member-role`) so the operator can see at a glance why they can or can't edit. Read-only callers also see a `read-only` chip; all write buttons are disabled.

## What's intentionally NOT in Phase 7

- **Transfer ownership** (PRD §14 implicit; the routes refuse to grant or delete `owner`) — Phase 7b.
- **Invite by fioHandle / displayLabel** (resolves to personaId server-side) — Phase 7b.
- **One-click revoke** from the roster (requires server-side display-token → personaId resolution) — Phase 7b. The manual DELETE path is documented inline.
- **Tab reorder UI** — `order` is accepted by the PATCH /tabs route; the drag-handle UI is a Phase 7b polish.
- **Per-tab metrics + actions composer** — the wizard wrote the initial metrics/actions arrays; editing them inline lands alongside Phase 10's Activations Catalogue review flow.
- **Tab add / remove** — Phase 7b. The wizard writes the initial set; the manager today edits visibility + ordering only.
- **Bootstrap-driven CTA chip** in AigentMeWelcomeTab — `set-up-cartridge` handler is wired; the chip strip extension is best landed alongside the `primaryCtas` bootstrap touch-up Phase 7b sweep.

## Privacy / spine alignment

- All client calls use `personaFetch` per CLAUDE.md PARAMOUNT.
- `manageGuard.ts` always goes through `getActivePersona(req)` — no parallel persona resolution.
- Membership listings render `personaDisplayToken` (8-char prefix), never raw `persona_id`. The `cartridge-membership-invite` payload accepts a full id (operator must paste it from a known source), but the GET response never surfaces it.
- T0 `owner_persona_id` is converted to `isOwnerCaller: true|false` on GET — the underlying id never leaves the server.
- All writes are guarded by spine-resolved flags — no surface-level role check duplicates the spine.

## Test posture

- Full TS typecheck: clean.
- Sibling spine tests (`access-spine`, `layer3-admin-cartridge-gating`, `require-cartridge-admin`): **42 pass**, 1 pre-existing fail (`isDebugBypassEnabled` mismatch, logged at `2026-06-02_debug-bypass-test-assertion-mismatch-backlog.md`). Zero new regressions.
- No new unit tests in Phase 7 — the routes are thin wrappers around Supabase ops behind a centralised guard; the guard itself is small and pure. Integration tests against a live DB are the natural next layer (lands in Phase 7b alongside the smoke-test harness for the operator wizard → manager round-trip).

## Operator smoke test (after deploy)

1. Confirm Phase 6 cartridge exists (see `2026-06-02_mycartridge-phase-6-wizard.md`).
2. Open metaMe → myCluster → myCartridge tab.
3. The left rail should list your cartridge with `role: owner` + `canEdit: true`.
4. Click the row → detail panel populates.
5. Edit the title → click "Save identity" → success.
6. Toggle a tab's visibility from `public` → `member` → confirm the dropdown persists after refresh.
7. Invite a second persona (need their full personaId) with role `editor` → verify it appears in the roster.
8. Verify in Supabase:
   ```sql
   SELECT cartridge_slug, persona_id, role FROM cartridge_memberships
     WHERE cartridge_slug = '<slug>';
   SELECT slug, member_only, role_required FROM codex_tabs
     WHERE codex_id = '<slug>-cartridge' ORDER BY "order";
   ```
9. As the invited persona (open the app as them), confirm:
   - `personaFetch('/api/wallet/active-persona')` shows `cartridgeMemberships[slug] = 'editor'`.
   - GET `/api/cartridge/<slug>` returns `caller.canEdit: false` and `caller.reason: 'editor-role'`.
   - Write attempts return 403 with `detail: 'editor role grants read only on Phase 7'`.

## What unlocks next

- **Phase 8 (Triad scoping):** `/api/codex/chat` extension reads `availableSpecialists` from `codex_configs` — the manager already edits this.
- **Phase 9 (wallet integration):** wallet primitives consult `token_whitelist` — the manager edits this.
- **Phase 10 (receipts + catalogue):** every PATCH from the manager surfaces emits a DVN receipt with `actionType: 'cartridge_state_change'`.
- **Phase 11 (Active Surface Access / Requests):** the approval inbox reads `cartridge_activations` with `status = 'pending_metame'` — the manager will gain a "Catalogue queue" indicator showing pending status.
