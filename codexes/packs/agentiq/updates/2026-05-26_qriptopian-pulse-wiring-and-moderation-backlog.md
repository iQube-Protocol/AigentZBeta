# Qriptopian Pulse — wiring + moderation backlog

**Status:** Reserved · do NOT implement until prioritised
**Companion ship:** Qriptopian Cartridge v3.1 restructure (2026-05-26) — the surfaces are live; the wiring underneath is not. **What's live, what's NOT live, and what each missing piece costs.**

---

## What landed in v3.1

Visible surfaces — all navigable, none break, none mislead:

- **Store › KNYT** — promoted to its own top-level Store sub-tab. Renders `KnytStoreBundlesTab` directly.
- **Qriptopia › Features** — same `FeaturesTab` as Live Magazine, surfaced here too so the Qriptopia group travels cleanly into the metaMe cartridge mirror.
- **Qriptopia › Qriptopian Pulse** — Phase 1 stub. Real Pulse posts arrive once the publish path lands (item 1 below).
- **Qriptopia › Community Correspondent** — new `QriptoCommunityCorrespondentTab` renders the three-pill structure (Canon · Community · Correspondent) with branch blurbs and a "wiring in progress" note per pill. **Not blank** — the surface is real, just empty of posts.
- **Admin reordering** — Magazine and Codex Admin (existing `QriptopianAdminTab`) anchors the Admin group as the first sub-tab. Pulse Admin (with moderation duties below) follows.

What's NOT live underneath these surfaces:

1. **myCanvas → Pulse publish path** (for both KNYT and Qriptopian Pulse)
2. **Cartridge-parameterised Living Canon template** (so Qriptopia › Community Correspondent renders real data)
3. **Pulse Admin moderation actions** (delete / reject Qriptopian Pulse submissions)

Each item is scoped below with the existing patterns we'll mirror.

---

## 1. myCanvas → Pulse publish path

### Today's pattern (KNYT-flavoured, partial)

The KNYT publish flow has TWO entry points:

- **`components/metame/runtime/RemixDialog.tsx:537-560`** — `publish()` callback after the user generates content via `/api/community-content/generate`. POSTs to `/api/community-content/[id]/publish`.
- **`app/triad/components/codex/tabs/MyCanvasTab.tsx:725-742`** — "Publish" button rendered inside `ExperienceDerivedPanel`, conditional on the entry having a `metaJson.contentId`. Calls `handlePublishToCommunity()` at lines 233-255, which POSTs to the same endpoint.

The publish endpoint (`app/api/community-content/[id]/publish/route.ts:84-137`) writes a row into `knyt_publication_states` with `branch: 'community'`, `subject_type: 'community_content'`. **Hardcoded for KNYT.**

myCanvas entry types (`mycanvas_entries.entry_type`):
- `note` — free-form markdown draft, user-created via "+ New". **No publish button today.**
- `experience_origin` — bookmark to a source Experience Qube. No publish.
- `experience_derived` — AI-generated remix. **Has a publish button** (KNYT-only).

### What the v3.1 brief asks for

Two extensions:

**A. Cartridge separation at publish point.** When a remix is generated, the upstream `community_generated_content` row records which cartridge it came from. Publishing only lights up the matching Pulse:
- KNYT-flavoured remixes → KNYT Pulse only
- Qriptopian-flavoured remixes → Qriptopian Pulse only

**B. Publish for plain text ideas (`note` entries).** Add a publish button to the "+ New" idea section of myCanvas. User picks the cartridge (KNYT Pulse / Qriptopian Pulse) at publish time. End-to-end path from a `note` entry to a published Pulse post.

### Concrete steps

1. **DB schema:**
   - Add `cartridge: 'knyt' | 'qripto'` column to `community_generated_content` (default `'knyt'` for back-compat) — set on insert by `/api/community-content/generate` based on the source `experience` cartridge.
   - Create `qripto_publication_states` table mirroring `knyt_publication_states` — same columns, qripto-scoped.
   - Migration: `supabase/migrations/<date>_pulse_cartridge_split.sql`.
2. **Generate route:** `/api/community-content/generate/route.ts` derives `cartridge` from the source experience's owning cartridge and stores it on the new row.
3. **Publish route:** `/api/community-content/[id]/publish/route.ts` reads the row's `cartridge`, writes to the matching publication_states table. Refuses to publish a `cartridge='knyt'` row into qripto Pulse and vice versa.
4. **Note publish endpoint:** new route `POST /api/mycanvas/entries/[id]/publish-to-pulse` accepts `{ cartridge: 'knyt' | 'qripto' }`, takes a `note` entry, creates a corresponding `community_generated_content` row (or a new `community_notes` table — decision below), publishes it.
5. **myCanvas UI:** publish button on `note` entries with a cartridge picker. Same affordance as the existing `experience_derived` Publish.
6. **Decision needed before step 4:** notes are plain markdown without a generated image / Q¢ pricing. Do they ride on `community_generated_content` (with image_url null, qc_cost 0) or live in a separate `community_notes` table? The first is faster; the second keeps the AI-generated and user-authored streams cleanly separated.

### Cost

- ~1 migration
- 3 routes touched (`generate`, `publish`, new `publish-to-pulse`)
- ~1 UI affordance in myCanvas (publish + cartridge picker on `note` entries)
- ~50 lines of cartridge-aware filtering in the Pulse list endpoints

Solid one focused PR.

---

## 2. Cartridge-parameterised Living Canon template

### Today

`app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` (391 lines) renders the three-pill cluster for the KNYT 21 Sats tab. Hardcoded throughout for KNYT:

| What's hardcoded | Locations (line refs) |
|---|---|
| API path `/api/codex/knyt/living-canon` | 175 (main GET), 162 (roles) |
| Branch schemas (`knyt:dispatch`, `knyt:community_submission`, `knyt:correspondent_report`) | 58, 64, 70 |
| Role checks (`knyt:steward`, `knyt:admin`) | 169 |
| Parked task slugs (`knyt:living-canon-vote` / `-contribute` / `-dispatch`) | 213-215 |
| `window.__knytPendingTaskSlug` listener | 228-230 |
| Reaction bar + remix button hardcoded to `active_cartridge: 'knyt'` (action routes) | external routes under `/api/codex/knyt/living-canon/{like,spark,react,vote,contribute,remix}` |

### Refactor shape

1. Add `cartridge: 'knyt' | 'qripto'` prop to `KnytLivingCanonTemplate` (default `'knyt'`).
2. Build every API path from the prop: `/api/codex/${cartridge}/living-canon/...`
3. Build schema slugs: `${cartridge}:dispatch` etc.
4. Build role checks: `${cartridge}:steward` etc.
5. Window event names: `${cartridge}:living-canon-vote` etc.
6. Register the same component under both `knyt:living_canon_v1` and `qripto:living_canon_v1` in the liquid template registry; the qripto config passes `props: { cartridge: 'qripto' }`.
7. Create stub `/api/codex/qripto/living-canon/route.ts` returning `[]`.
8. Create stub `/api/codex/qripto/living-canon/{like,spark,react,vote,contribute,remix}/route.ts` returning `{ ok: true }` (or full action handlers, depending on appetite).
9. Migration: `qripto_publication_states` table (also needed by item 1 — share migration).
10. Once the refactor lands, replace `QriptoCommunityCorrespondentTab` with the liquid-ui config so the Qriptopia tab serves the same template KNYT does.

### Cost

- 1 file refactored (~50 line diff, hardcoded strings → template literals)
- 8+ new route files (stubbed, then filled)
- 1 migration (shared with item 1)
- 1 config swap in `QRIPTO_CODEX` to use the liquid template

Medium-sized PR. Lower risk than it looks — the refactor is mostly string templating.

---

## 3. Pulse Admin moderation

### What's needed

Admin › Pulse Admin tab today is a stub. Operators flagged the need to **delete or reject Qriptopian Pulse submissions** for moderation.

Concrete UI:
- List of pending / published Pulse submissions for the active cartridge (qripto first, optionally knyt later)
- Per-row actions: **Reject** (sets `status='rejected'`, surfaces an optional reason to the author), **Delete** (hard delete, audited)
- Filters: status (pending / published / rejected), author, date range
- Bulk actions: select multiple → reject / delete

Concrete backend:
- `GET /api/community-content/admin/list?cartridge=qripto&status=pending` — admin-only, returns paginated list
- `POST /api/community-content/[id]/reject` — admin-only, `{ reason?: string }`
- `DELETE /api/community-content/[id]` — already exists for the author; need an admin-only variant that bypasses author check
- Each action emits a `community_content_moderation` receipt via the canonical activity_receipts spine

Auth path: `cartridgeFlags.adminCartridges.includes('qripto')` gates every route.

### Cost

- 1 new tab component (`QriptoPulseAdminTab.tsx`) — ~200 lines
- 3 new / extended routes
- Receipt taxonomy review (add `community_content_moderation` action_type)

Medium PR — gated by item 1 landing so the cartridge column exists on `community_generated_content`.

---

## Sequencing recommendation

Land items in this order:

1. **Item 2** (Living Canon refactor + qripto stub endpoints) — unblocks real data rendering in Community Correspondent; foundational
2. **Item 1** (myCanvas → Pulse publish + cartridge separation) — produces the data items 2 and 3 consume
3. **Item 3** (Pulse Admin moderation) — depends on item 1's data flowing

Items 1 and 2 are nearly independent and could ship in parallel; item 3 needs item 1 to have populated rows.

---

## Status board

| Item | Status | Blocked on |
|---|---|---|
| v3.1 visible surfaces (Store / Qriptopia / Admin reorders + Community Correspondent stub) | ✅ Shipped 2026-05-26 | — |
| 1. myCanvas → Pulse publish + cartridge separation | ⏸ Backlog | Prioritisation |
| 2. Cartridge-parameterised Living Canon template + qripto stub endpoints | ⏸ Backlog | Prioritisation |
| 3. Pulse Admin moderation | ⏸ Backlog | Item 1 lands |
| KNYT Pulse ↔ 21 Sats voting handoff (separate backlog) | ⏸ Backlog | — see 2026-05-26_knyt-pulse-21sats-handoff-backlog.md |

When opening any of these, link this doc and the v3 restructure brief in `2026-05-26_qriptopian-cartridge-v3-restructure` (auto-generated by the agentiq codex updater on commit `51d51fae`).
