# Cartridge isolation fix — wizard-created cartridges stay personal

**Date:** 2026-06-02
**Status:** shipped — bug fix
**Bug:** A persona with platform-admin rights created a cartridge via the metaMe wizard. The cartridge appeared in the Multi-Cartridge Viewer alongside system cartridges (KNYT, Qriptopian, AgentiQ, etc.), suggesting it had been elevated to platform tier.
**Operator rule (canonical):** Admin status confers ONLY the right to create more than one cartridge per persona (and to assign nested ventures). It does NOT elevate any wizard-created cartridge to system tier. Personal cartridges remain RLS-isolated to the owner persona regardless of the creator's admin scope. System cartridges are created via the `/admin/codex` super-admin surface with its own auth flow.

## Root cause

`GET /api/codex/registry` returned every `codex_configs` row regardless of whether the row was a hand-curated system cartridge or a wizard-created personal one. The Multi-Cartridge Viewer (and any other consumer of the registry list) merged personal rows into the platform-wide picker.

## Discriminator

Phase 4a added the `owner_persona_id` column to `codex_configs`. Wizard-created rows (Phase 6) populate it; hand-curated system cartridges (CODEX_DEFINITIONS + pack-loaded + `/admin/codex` admin-created) leave it NULL. The two populations are already cleanly separated on disk — the registry route just wasn't using the discriminator.

## Fix

`app/api/codex/registry/route.ts` — both the `?defaults=true` path AND the direct-DB path now apply the same isolation filter:

| Query | Behaviour |
|---|---|
| (default — no flag) | `owner_persona_id IS NULL` — system cartridges only. This is what the Multi-Cartridge Viewer hits. |
| `?includePersonal=true` | No DB filter; the caller's persona is resolved via the spine so a future unified picker can render system + the caller's own personal cartridges. |
| `?personalOnly=true` | `owner_persona_id = <callerPersonaId>` — only the caller's own personal cartridges. Equivalent surface to `/api/cartridge/list-mine` (Phase 7). When no persona is resolved, returns empty (fail-closed) rather than silently degrading to system. |

The spine resolution is lazy (`await import('@/services/identity/getActivePersona')`) so the existing unauthenticated default-path stays unauthenticated; only the opt-in personal modes hit the spine.

## What this fix does NOT touch

- `/admin/codex` super-admin surface — admin-created cartridges there continue to write rows with `owner_persona_id = NULL` (the admin surface doesn't write the Phase 4a column), so they remain system-tier as intended.
- `GET /api/cartridge/list-mine` (Phase 7) — already correctly scoped to the owner's persona via the manage guard; no change needed.
- `GET /api/cartridge/[slug]` (Phase 7) — gated on role membership via the manage guard; no change needed.
- The runtime tab tree — once a personal cartridge is rendered (the owner navigates to it via list-mine), the tab template framework (Phase 5/6/9) renders it without further isolation work.

## What this fix does NOT fully solve (follow-up)

The direct codex detail route `GET /api/codex/registry/[codexId]` does not yet apply the same `owner_persona_id` gate. If someone guesses or enumerates a personal cartridge's id, they can still pull the config. This is a lower-priority hardening since:
1. The picker no longer lists personal cartridges, so id discovery is harder.
2. RLS on the underlying tables would be the more durable fix (when we tighten `codex_configs` RLS from "authenticated users see all" → "authenticated users see system + their own personal").

Tracking: a future hardening pass should either (a) apply the same persona-scoped filter on the detail route, or (b) tighten the RLS policy on `codex_configs`. The PRD §14 super-admin tier already requires `/admin/codex` for system cartridge edits, so the tightening doesn't break the admin path.

## Privacy / spine alignment

- Default registry GET stays unauthenticated (system cartridges have always been a public-read concern).
- Personal-mode paths resolve the persona via `getActivePersona` per CLAUDE.md PARAMOUNT.
- Personal-mode results never include rows where `owner_persona_id !== callerPersonaId`.
- No T0 fields (`owner_persona_id`) propagate into the response body — list items continue to expose only `{ id, name, slug, enabled, owner, metadata, tabCount, createdAt, updatedAt }`. `owner` is the legacy text field carrying the persona id for wizard-created rows; this should also be redacted to a display token in a follow-up pass.

## What admin status gives you, exactly

| Capability | Granted by |
|---|---|
| Create one cartridge per persona via the metaMe wizard | Any authenticated persona |
| Create multiple cartridges per persona via the metaMe wizard | `cartridgeFlags.isAdmin = true` OR `adminCartridges.includes(slug)` (future enforcement — Phase 6 does not yet rate-limit) |
| Edit / publish system cartridges (CODEX_DEFINITIONS or `/admin/codex` rows) | `/admin/codex` super-admin auth (existing) |
| Create a system cartridge | `/admin/codex` super-admin surface (existing). The metaMe wizard NEVER creates system cartridges. |
| Assign nested ventures across multiple cartridges | Phase 4a `cartridge_memberships(role)` + Phase 4b spine projection — admin status accelerates but does not bypass |

## Follow-up backlog

- **Hardening:** apply the personal-cartridge gate on `GET /api/codex/registry/[codexId]` and tighten `codex_configs` RLS.
- **Admin-tier system cartridge wizard:** PRD note — operator may later replicate the wizard inside `/admin/codex` for ergonomic system cartridge creation. Different auth flow + UI surface. Not in scope for this fix.
- **`owner` field redaction:** the legacy `codex_configs.owner` text column carries the persona id for wizard-created rows. Should be projected to a display token at the API boundary so it doesn't leak into list-items.
