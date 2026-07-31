# myCartridge Phase 10 — Publish to myCluster

**Date:** 2026-06-03
**Status:** shipped

Implements the "Publish to myCluster" flow so a persona's personal cartridge
surfaces as a named tab in their own myCluster group strip within the metaMe
cartridge (e.g. "metaWill" appears alongside myCanvas / myWorkspace / myCartridge / myLedger).

## What ships

### DB migration

`supabase/migrations/20260603000000_codex_configs_published_to_cluster.sql`

Adds `published_to_cluster BOOLEAN NOT NULL DEFAULT false` to `codex_configs`.
Idempotent (`ADD COLUMN IF NOT EXISTS`). One paste in the Supabase SQL editor.

### API

| Route | Verb | Purpose |
|---|---|---|
| `/api/cartridge/[slug]/publish-to-cluster` | POST | Toggle `published_to_cluster`. Body `{ published: boolean }`. Gate: `cartridgeManageGuard requireWrite=true` — owner / admin / uber only. |
| `/api/cartridge/published-for-cluster` | GET | Returns `{ ok, cartridges: [{id, slug, title}] }` for the calling persona's published personal cartridges. Spine-gated via `getActivePersona`. T1-safe (no T0 fields in response). Silently returns `[]` on auth/DB failure so the metaMe render is never blocked. |
| `/api/cartridge/[slug]` | DELETE | Safe owner-only delete. Body `{ confirmSlug: "<slug>" }` required — typed confirmation. Guardrails: system cartridges (owner_persona_id IS NULL) cannot be deleted via this route; only the owner persona can delete (uber-admins use /admin/codex). Cascades cartridge_memberships + cartridge_activations explicitly (slug-keyed, no FK); codex_tabs cascades via FK. Receipts and orchestration_events are preserved as append-only audit trails. |

`GET /api/cartridge/[slug]` now includes `publishedToCluster: boolean` in its response.

### Frontend

**`PersonalCartridgeTab.tsx`** (new)

Self-contained component that fetches a personal cartridge's configured tabs
from `/api/cartridge/[slug]` and renders them via the existing `TabRenderer`
dispatch (same `TAB_TEMPLATES` path that system cartridges use). Shows a
nested sub-tab strip when the cartridge has multiple tabs. Owner sees the
same rendered view that external visitors would see.

**`TabRenderer.tsx`** — `PersonalCartridgeTab` registered in the static
component registry so it can be resolved by name from the tab config.

**`CodexPanelDynamic.tsx`** (minimal addition)

When `codexId === 'metame-codex'`, fetches `/api/cartridge/published-for-cluster`
via `personaFetch` and injects the result as extra `CodexTab[]` into
`enabledTabs` with `group: 'mycluster'`. Applies the same `activeActivations.has('mycanvas')`
gate that the static mycluster tabs use, so published cartridge tabs only appear
when the mycanvas activation is active. No change to the generic panel logic.

**`MyCartridgeTab.tsx`** — Adds a dedicated "Cartridge actions" panel at the top
of the detail view with:
- "Publish to myCluster" / "Published to myCluster" toggle (green when live)
- "Delete cartridge" button (owner-only; opens a typed-slug confirmation modal)

The action panel is a bordered card so the publish and delete affordances are
immediately visible — not buried in the header chrome. A "live in myCluster"
status chip also appears in the header when the cartridge is published, so the
operator can see at a glance whether their cartridge is currently surfacing.

**Delete confirmation modal** — requires the operator to type the cartridge slug
verbatim before the "Delete permanently" button activates. Server-side, the
DELETE endpoint also requires `confirmSlug` in the body matching the path
parameter, so a stray fetch can't wipe out a cartridge accidentally.

## UX flow

1. Persona creates a cartridge via the wizard → `MyCartridgeTab` shows the manager.
2. In the detail header, persona clicks **"Publish to myCluster"**.
3. `POST /api/cartridge/[slug]/publish-to-cluster` → `published_to_cluster = true`.
4. On next metaMe render (or after a page refresh), `CodexPanelDynamic` fetches
   `/api/cartridge/published-for-cluster` and adds "metaWill" (or whatever the
   cartridge title is) to the mycluster group strip.
5. Clicking the "metaWill" chip renders `PersonalCartridgeTab` which in turn
   renders the cartridge's configured tabs via `TabRenderer` + `TAB_TEMPLATES`.
6. To remove, persona returns to `myCartridge`, clicks the now-green button again
   → `published_to_cluster = false` → the tab disappears from the strip.

## Operator SQL (one paste)

```sql
ALTER TABLE public.codex_configs
  ADD COLUMN IF NOT EXISTS published_to_cluster BOOLEAN NOT NULL DEFAULT false;
```

Or paste the full migration file:
```
supabase/migrations/20260603000000_codex_configs_published_to_cluster.sql
```

## Privacy / isolation

- `published_to_cluster = true` does **not** make the cartridge visible to other
  personas. The RLS tightening from 2026-06-02 still applies — personal rows
  are system-gated behind the service-role API layer. The only change is the
  owner's own metaMe view picks them up.
- The `published-for-cluster` endpoint scopes by `owner_persona_id = persona.personaId`
  — only the owner's own cartridges are returned.
- T0 `personaId` never echoes in the response (only `{ id, slug, title }`).

## What's not changed

- The RLS isolation hardening (2026-06-02) is untouched.
- System cartridges are unaffected — they have `owner_persona_id IS NULL` and
  `published_to_cluster = false` by default.
- Phase 7 manager surface is unchanged except for the new toggle button.
