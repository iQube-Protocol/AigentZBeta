# Cartridge isolation — hardening pass (detail-route gate + RLS + owner redaction)

**Date:** 2026-06-02
**Status:** shipped — follow-up to `2026-06-02_mycartridge-personal-system-isolation-fix.md`
**Predecessor:** the picker-level isolation fix earlier the same day.

The picker fix removed wizard-created cartridges from the platform-wide registry list. This hardening pass closes the three remaining surfaces where a personal cartridge could still leak: direct id enumeration on the detail route, browser-side authenticated Supabase reads, and the legacy `owner` text column carrying the persona id.

## Three fixes

### 1. Detail-route gate (`GET /api/codex/registry/[codexId]`)

`app/api/codex/registry/[codexId]/route.ts` now applies the same `owner_persona_id` discriminator on both GET paths (defaults mode + direct DB). Personal rows that fail the gate produce **404, not 403**, so the route doesn't even leak the existence of the row to a non-owner enumerating ids.

Allowed when:
- Row is a system cartridge (`owner_persona_id IS NULL`), OR
- Caller is the owner persona (`personaId === owner_persona_id`), OR
- Caller is uber-admin (`cartridgeFlags.isAdmin`), OR
- Caller has the slug in `cartridgeFlags.adminCartridges`, OR
- Caller holds any role on the cartridge per `cartridgeFlags.cartridgeMemberships` (Phase 4b spine projection).

Spine resolution is lazy (`await import('@/services/identity/getActivePersona')`) so the default unauthenticated path on system cartridges stays unauthenticated.

The visibility check returns `{ visible, callerPersonaId }` so the redaction helper (item 3 below) reuses the same persona resolution — no double spine hit.

### 2. RLS tightening (`supabase/migrations/20260602020000_codex_configs_personal_rls.sql`)

The legacy SELECT policy on `codex_configs` was `Authenticated users can view all codexes` with `USING (true)` — predates Phase 4a and lets any browser-side authenticated Supabase client read every personal cartridge row directly, bypassing the API-layer filter.

This migration replaces it with **"authenticated users see system cartridges only"** (`owner_persona_id IS NULL`). Same tightening applied symmetrically to `codex_tabs` SELECT policies (tab visibility now joins to `codex_configs.owner_persona_id IS NULL` as well). Service-role policies are untouched — every spine-gated API route uses the service role and continues to see all rows; per-persona scoping happens at the application layer (the spine + `manageGuard`).

Idempotent (`DROP POLICY IF EXISTS … CREATE POLICY`). Safe to re-run.

**Operator action:** paste the file into the Supabase SQL editor once. The policy IDs match by name; running the migration twice has no effect after the first successful run.

### 3. Owner-field redaction

The legacy `codex_configs.owner` text column is `NOT NULL` and carries the persona id for wizard-created rows (Phase 6 writes `owner: persona.personaId` because the column is required). This is a T0 leak through a legacy column.

Both list and detail responses now redact the field:

```ts
owner: owner_persona_id
  ? (callerPersonaId === owner_persona_id
      ? rawOwner          // owner sees their own — fine
      : `persona-${owner_persona_id.slice(0, 8)}`)  // non-owners see a display token
  : rawOwner;             // system rows pass through unredacted
```

System cartridges (where `owner_persona_id IS NULL`) carry display strings like `aigent-z` or `iqube-protocol` in `owner` and pass through untouched.

For wizard-created rows:
- The **owner persona** sees their own canonical id (no change in shape).
- **Any other caller** (admin, member, public) sees a stable display token derived from the persona id prefix. The token is non-correlatable to any other surface — it's display-only.

## What's now isolated

| Surface | Behaviour |
|---|---|
| Multi-Cartridge Viewer picker | System cartridges only (picker fix earlier today). |
| `GET /api/codex/registry` direct enumeration | System only by default; opt-in modes resolve persona via spine. |
| `GET /api/codex/registry/[codexId]` by id | Personal rows 404 unless caller owns / admins / holds a role on them. |
| Browser-side direct Supabase reads | RLS now hides personal rows from the `authenticated` role entirely. |
| `owner` field in any registry response | Redacted to a display token when the caller isn't the owner persona. |

## What this does NOT change

- `/admin/codex` super-admin surface — admin-created cartridges there still write rows with `owner_persona_id = NULL` and remain system-tier as intended. The super-admin can edit those rows.
- `GET /api/cartridge/list-mine` (Phase 7) — already correctly scoped via manageGuard.
- `GET /api/cartridge/[slug]` (Phase 7) — already gated on role membership.
- The runtime tab tree — once the owner navigates to their personal cartridge, the tab template framework (Phase 5/6/9) renders it as before.
- Service-role access — every server-side API route continues to use service role to fetch what it needs, then applies the spine-resolved scoping at the application layer.

## Privacy + spine alignment

- All persona resolution uses `getActivePersona` per CLAUDE.md PARAMOUNT.
- The visibility helper and the redaction helper share one persona lookup per request — no double spine hit.
- `personaId` (T0) never echoes verbatim to a non-owner in any registry response.
- The display token (`persona-${first 8 chars}`) is not a correlatable handle — it's surface-local and used only to populate the legacy `owner` field.

## What admin status gives you, after this hardening

| Capability | Granted by |
|---|---|
| Create one cartridge per persona via the metaMe wizard | Any authenticated persona. |
| Create multiple cartridges per persona via the metaMe wizard | `cartridgeFlags.isAdmin = true` OR `adminCartridges.includes(slug)` — future Phase 6 rate-limit will enforce. |
| Read any personal cartridge across personas | `cartridgeFlags.isAdmin = true` only. Tenant admins (per-cartridge grants) read their cartridge's rows. Editor / contributor / member can read their cartridge's rows. |
| Create / edit a system cartridge | `/admin/codex` super-admin surface only. The metaMe wizard NEVER creates system cartridges. |
| Direct browser-side Supabase read of `codex_configs` rows | System rows (`owner_persona_id IS NULL`) only. Personal rows are RLS-hidden from the `authenticated` role. |

## Operator action (one SQL paste)

Open Supabase SQL editor and paste the body of:

```
supabase/migrations/20260602020000_codex_configs_personal_rls.sql
```

Then verify with:

```sql
-- Existing policies on codex_configs
SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'codex_configs'
  ORDER BY policyname;

-- Expect: "Authenticated users can view system codexes",
--         "Public can view enabled system codexes",
--         "Service role has full access to codexes"

-- Confirm tightening
SELECT policyname FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'codex_configs'
    AND (policyname LIKE '%view all%');
-- Expect: 0 rows. The old "view all" policy should be gone.
```

## Test posture

- TS clean.
- 42 sibling spine tests pass; same pre-existing `isDebugBypassEnabled` failure (logged in backlog).
- No new tests added for the hardening — the discriminator is the column already present in Phase 4a, the visibility helper mirrors the existing `cartridgeManageGuard` pattern from Phase 7 (already tested via the layer3 and require-cartridge-admin suites), and the RLS migration is verified by the operator SQL above.

## Follow-up still on the backlog

- **`cartridge_kind` enum column.** The current `owner_persona_id IS NULL` discriminator captures the system-vs-personal split cleanly but doesn't express richer concepts like `'tenant'` (multi-persona cartridge owned by an organisation rather than a single persona). A future migration could add `kind TEXT CHECK (kind IN ('system','personal','tenant'))`. Not required for the operator's primary rule today.
- **Admin-tier system cartridge wizard.** PRD note — the metaMe wizard's UX could be replicated inside `/admin/codex` with a different auth flow for ergonomic system cartridge creation. Tracked as a separate workstream.
- **Owner field rename.** The legacy `codex_configs.owner` text column has two distinct semantics (system display string vs. persona id) and should eventually be split: `owner_display_label TEXT` for the system display, plus `owner_persona_id` for personal rows.
