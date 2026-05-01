# Codex Manager Dashboard — Storage-aware Views (Backlog)

**Date raised:** 2026-05-01
**Status:** backlog — not yet implemented
**Operator request:** "this tab now needs a supabase view to show the supabase uploads as well as the autodrive view for where there are supabase files that do not as yet have autodrive uploads. Maybe once we have large files in supabase we can upload them to autodrive server side without lambda but anyhow for now I just want — add to the backlog."

## Scope

The Codex Manager admin tab (`QriptopianAdminTab.tsx`) currently shows a single
combined view of every asset, regardless of which storage backend (Auto-Drive
vs Supabase Storage) hosts the bytes. The operator wants two separable views:

1. **Auto-Drive view** — only assets whose `auto_drive_cid` is a real Autonomys
   CID (i.e. `bafkr…`-style content-address). Default historical view.
2. **Supabase view** — only assets whose `auto_drive_cid` is an HTTPS URL
   (i.e. uploaded via the Supabase toggle, not yet promoted to Auto-Drive).

A row's storage origin is detectable today: if `auto_drive_cid` starts with
`http://` or `https://` → Supabase, otherwise → Auto-Drive. (The
`storage/register` route stores the public Supabase URL in that column; the
Auto-Drive upload service stores a CID.)

## Suggested implementation

- Add a third toggle in the panel header: `[ Auto-Drive | Supabase | All ]`
  next to the existing `Show archived` checkbox.
- Pass the filter to `assets-by-category` as a query param
  (`?storage=autodrive|supabase|all`, default `all`).
- In the route, add a `.like('auto_drive_cid', ...)` or post-filter on the
  mapped `assets[]` based on URL prefix detection.
- Stat cards (Motion / Still / Covers / etc.) should respect the toggle and
  recount per-storage so the operator can see, e.g., "12 Auto-Drive covers,
  4 Supabase covers, 0 yet to be promoted to Auto-Drive."

## Stretch goal — server-side promotion to Auto-Drive

Once a file is in Supabase Storage, the server can stream it (no Lambda body
limit on the way out — the Lambda fetches from Supabase and pushes to Auto-Drive
chunked). Add a "Promote to Auto-Drive" action per Supabase row that:

1. Fetches the file from the Supabase URL on the server
2. Encrypts it via `autonomysContentService` flow
3. Uploads the ciphertext to Auto-Drive
4. Replaces the row's `auto_drive_cid` with the resulting CID and sets
   `encryption_iv`, `token_qube_id`, etc.

This sidesteps the 10MB Lambda inbound limit by using Supabase as the staging
buffer and streaming server-side to Auto-Drive.

## Related files

- `app/triad/components/codex/tabs/QriptopianAdminTab.tsx` — UI
- `app/api/admin/codex/assets-by-category/route.ts` — query
- `app/api/admin/codex/storage/register/route.ts` — Supabase upload registration
- `server/services/autonomysContentService.ts` — Auto-Drive upload pipeline
