# myCartridge Phase 4a — DB foundation (config + roles)

**Date:** 2026-06-02
**Status:** shipped — schema-only, no spine writes, no UI surface
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §23, §26, §32 Phase 4

## Scope split

Phase 4 in the PRD's implementation plan (§33 row 4) bundles three concerns:

1. **DB schema** — new tables + extended columns
2. **Spine extension** — `getActivePersona` returns `cartridgeMemberships`, `evaluateAccess` resolves the new gate descriptor
3. **Role mapping** — `cartridgeAdminGrants` interaction with the new `cartridge_memberships` table

Per `CLAUDE.md` PARAMOUNT rule on spine files, `services/identity/getActivePersona.ts` and `services/access/evaluateAccess.ts` cannot be modified without explicit operator approval. This commit lands the schema-only portion (**Phase 4a**) so the rest of the workstream is unblocked. The spine-touching portion (**Phase 4b**) requires sign-off before proceeding.

## What landed in Phase 4a

### Migration

`supabase/migrations/20260602000000_mycartridge_phase4_config_and_roles.sql`

| Object | Kind | Purpose |
|---|---|---|
| `cartridge_memberships` | new table | (slug, persona_id, role) join. PK = (slug, persona). One role per persona per cartridge. |
| `cartridge_activations` | new table | Activation Catalogue entries. `status` defaults `'pending'`; transitions through `pending_metame → approved` via Phase 11 §21a flow. UNIQUE (slug, tab_slug). |
| `cartridge_codex_entries` | new table | Per-cartridge published Codex rows. Sourced from myCanvas / myWorkspace via the `publish-to-cartridge` action. |
| `codex_configs` | extended | Added `owner_persona_id`, `primary_tab_slug`, `available_specialists`, `token_whitelist`, `smart_triad_config`. All nullable to preserve hand-curated cartridges. |
| `codex_tabs` | extended | Added `member_only`, `invite_only`, `token_gated`, `role_required`. All default to permissive; existing tabs unaffected. |

**Explicitly NOT in this migration:**

- `cartridge_activation_approvals` — lands in Phase 11 alongside the `AdminActiveSurfaceApprovalsTab` UI and the approval API routes.
- `cartridge_kb_sources` — v0.5 surface; per-cartridge KB embedding pipeline isn't on the MVP scope.

### Types

`types/cartridgeMembership.ts` — new file. Carries:

- `CartridgeMembership` (T0 row shape)
- `CartridgeMembershipsMap = Record<slug, CartridgeRole>` (T1-safe projection the spine will emit in Phase 4b)
- `CARTRIDGE_ROLE_HIERARCHY` (the canonical descending-power array per PRD §23)
- `meetsCartridgeRole(held, required)` pure function for role comparison
- `CartridgeTabGateFlags` (the descriptor the Phase 4b `evaluateAccess` extension will resolve against)

The `CartridgeRole` enum is re-exported from `types/ventureQube.ts` so the v0.4 schema, Zod validator, DB CHECK constraint, and spine all reference the same union.

## Privacy posture

- `persona_id`, `granted_by`, `published_by`, `submitted_by` are all T0 — never exposed to the browser. The spine projects to T1-safe shapes (slug + role, or slug + role + boolean flags) at the boundary.
- All new tables: service-role-only RLS. Reads land via spine-gated routes only.

## Idempotency

Every DDL statement uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP POLICY IF EXISTS … CREATE POLICY …`. Safe to re-run.

## Operator action — run this once in Supabase

```sql
-- supabase/migrations/20260602000000_mycartridge_phase4_config_and_roles.sql
-- Open the file and paste the full body into the Supabase SQL editor.
-- The migration is idempotent; re-running has no effect after the first
-- successful run.
```

(Path is absolute from the repo root: `supabase/migrations/20260602000000_mycartridge_phase4_config_and_roles.sql`.)

## Smoke check after running the migration

```sql
-- Should return 3 (or higher if existing rows were already present)
SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('cartridge_memberships', 'cartridge_activations', 'cartridge_codex_entries');

-- Should return 5 new columns on codex_configs
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'codex_configs'
    AND column_name IN ('owner_persona_id','primary_tab_slug','available_specialists','token_whitelist','smart_triad_config')
  ORDER BY column_name;

-- Should return 4 new columns on codex_tabs
SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'codex_tabs'
    AND column_name IN ('member_only','invite_only','token_gated','role_required')
  ORDER BY column_name;
```

## What unlocks next

Phase 4a unblocks:
- **Phase 5 (tab templates)** — can read `codex_tabs.role_required` / `member_only` / etc. from `TabRenderer.tsx`.
- **Phase 6 (CartridgeSetupWizard)** — can write directly to the new `codex_configs` columns + insert a `(slug, owner_persona_id, role='owner')` row into `cartridge_memberships`.
- **Phase 7 (operator manager surface)** — can read `cartridge_memberships` for the member-list UI.
- **Phase 10 (catalogue receipts)** — can write to `cartridge_activations`.

Phase 4a does NOT unblock:
- Membership-gated tab visibility in the runtime — that needs Phase 4b's `evaluateAccess` extension.
- Cartridge admin role checks from any new code — must wait for Phase 4b's `getActivePersona.cartridgeFlags.cartridgeMemberships` field. New surfaces should NOT build a parallel resolver.

## Phase 4b (pending operator approval)

The spine extension splits into two precise edits, both protected files per CLAUDE.md PARAMOUNT rules:

1. **`services/identity/getActivePersona.ts`** — extend the resolver to read `cartridge_memberships` for the active persona and project to `cartridgeFlags.cartridgeMemberships: CartridgeMembershipsMap` (T1-safe; slugs + role only).
2. **`services/access/evaluateAccess.ts`** — extend the descriptor with `cartridgeRole?: CartridgeRole`, `memberOnly?: boolean`, `inviteOnly?: boolean`, `tokenGated?: { tokenId; minBalance }`. Resolve via `meetsCartridgeRole(persona.cartridgeFlags.cartridgeMemberships[slug], required)`.

Both edits are compositional — no parallel resolvers — and both come with tests extended in `tests/access-spine.test.ts` and `tests/persona-broadcast-handshake.test.ts` (the existing canary patterns).

**Request to operator:** confirm permission to land Phase 4b before the next session continues.
