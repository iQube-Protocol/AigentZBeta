# Community-Generated Content + Runtime Takeover — Workstream Brief

**Date:** 2026-04-29
**Status:** Live on dev — all five phases shipped, viewer + admin auth + runtime takeover integration complete
**Scope:** KNYT cartridge consumer remix flow; runtime carousel + takeover catalog integration
**Owner:** Claude Code (sessions `017i9fiE…` and `01Ths4F8…`)

---

## What it is

A consumer "Remix" flow on KNYT runtime capsules. User taps Remix on a capsule chip → picks Article or Story → prompt → Q¢ debited → LLM + image generated → 30s discard window OR publish → other users see it in a new KNYT cartridge tab and react via existing 21 Sats `KnytReactionBar` → admin promotes promising pieces → promoted pieces win runtime carousel slots and get the Runtime badge.

End-to-end loop:

```
user remix capsule
  → /api/community-content/generate (debit Q¢, gen text+image, persist draft)
preview
  → discard within 30s for refund (1/day) OR publish
  → publish also creates matching knyt_publication_states row
others browse KNYT "Community" tab
  → KnytReactionBar reactions via existing /api/codex/knyt/living-canon/react
  → share menu: copy link / X intent / mailto → /community-content/[id]
admin reviews queue in "Community Admin" tab
  → promote → status='runtime_promoted' (eligible for runtime carousel)
  → reject  → status='rejected'
admin tunes Q¢ pricing + daily caps in same tab without redeploy
runtime carousel + takeover infer pull promoted rows
  → LLM may pin them in the takeover manifest
  → click → public viewer page /community-content/[id]
```

## Pricing (admin-tunable, seeded defaults)

| Setting | Default |
|---|---|
| Article generation | 10 Q¢ (15 Q¢ after free quota) |
| Story generation | 6 Q¢ (9 Q¢ after free quota) |
| Surcharge multiplier | 1.5× (50%) |
| Free quota | 3 / persona / day |
| Discard refund | 1 / persona / day, within 30s of generation |
| Image | bundled into skill cost — never charged separately |

All tunable in `community_content_settings` via the Phase 5 admin UI without code changes.

## Database (Supabase)

**Migration:** `supabase/migrations/20260429000000_community_generated_content.sql` — applied.

| Table | Purpose |
|---|---|
| `community_generated_content` | one row per piece — `creator_persona_id`, `source_experience_id`, `parent_id` (remix lineage), `skill` (article\|story), `title`, `prompt`, `article_body`, `image_url`, `status` (draft\|shared\|pending_promotion\|runtime_promoted\|rejected), `qc_cost`, `generation_index`, promotion/rejection metadata |
| `community_content_quotas` | per-persona daily counters; rollover via `daily_free_used_date` compare (no cron). `total_generations` mirrors per-row `generation_index`. |
| `community_content_settings` | singleton (id=1, CHECK constraint) — pricing + caps |

**Open:** No RLS policies. Backlog at `codexes/packs/agentiq/updates/2026-04-29_community-content-rls-backlog.md`. Ship with cohort/alias RLS from the wallet-alias sprint.

## API surface (all under `/api/community-content/`)

| Route | Method | What it does | Auth |
|---|---|---|---|
| `/quota` | GET | returns `freeRemaining`, `refundRemaining`, base + surcharged costs, `currentQc` | none (read-only) |
| `/generate` | POST | debit Q¢ first → text+image in parallel → insert draft → bump quota; refunds on text-gen or insert failure | `personaId` in body |
| `/[id]/discard` | POST | owner-only refund + delete inside 30s window, 1/day; 410 expired, 429 quota, 409 status | owner persona |
| `/[id]/publish` | POST | owner-only `draft → shared`; idempotent. Also upserts a matching `knyt_publication_states` row with same UUID so 21 Sats `KnytReactionBar` works without modification | owner persona |
| `/list` | GET | shared + runtime_promoted; `mine=1+personaId` scopes to drafts; batched creator hydration | none |
| `/[id]` | GET | single row, only `shared`/`runtime_promoted`; drafts/rejected → 404 | none — powers public viewer |
| `/[id]/promote` | POST | `shared → runtime_promoted` | server-side admin check |
| `/[id]/reject` | POST | any → `rejected` | server-side admin check |
| `/settings` | GET / POST | single-row config; POST clamps each field | GET open / POST admin check |

### Generation pipeline (`_lib/generate.ts`)

- Text: OpenAI `gpt-4o-mini` with `STORY_SYSTEM_PROMPT` (250–500 words, sensory) or `ARTICLE_SYSTEM_PROMPT` (600–900 words, deck + 3–4 H2s)
- Image: Venice (preferred) → OpenAI fallback. Failure returns null (text is the hard requirement).
- `debitQc/creditQc` mirror existing `qc_balances + qc_transactions` patterns.

### Persona context (`_lib/personaContext.ts`)

Joins `nakamoto_knyt_personas + journey_states`, returns handle, journey stage, character preference, owned scrolls. Injected into system prompt so KNYT users get personalised output.

### Admin auth (`_lib/adminAuth.ts`)

`requireCommunityAdmin(supabase, adminPersonaId)` resolves `personas.auth_profile_id` (canonicalized via existing trigger) → checks `crm_admin_roles` for active unexpired role. Same lookup `/api/codex/admin-check` uses for embed-bridge auth. Returns 401 if no `adminPersonaId`, 403 if no auth profile or no active role.

## UI surfaces

| Surface | File | Role |
|---|---|---|
| Remix dialog | `components/metame/runtime/RemixDialog.tsx` | Modal triggered from capsule chip. Article↔Story toggle, prompt with live char counter, cost summary (free vs surcharged), generation-step state machine (`charging→writing→rendering→done`), preview with Discard/Redo/Publish, sign-in banner for guests. Mounted in all three runtime return paths (embed/fullscreen/default). |
| Capsule chip | `components/metame/MetaMeRuntimeClient.tsx` | Remix button replaces the consumer-side null branch. Admin path (full `RuntimeCapsuleAdminEditor`) unchanged. Gate is `runtimeAdminMode` only — `embedMode` no longer implies admin. |
| KNYT Community tab | `app/triad/components/codex/tabs/KnytCommunityContentTab.tsx` | Tab `community-content`, order 5, no admin gate. All/Mine filter, 1/2/3-col card grid, skill icon, Free badge, Runtime badge, per-card `KnytReactionBar`. Detail view: hero + byline + body + share menu (copy / X intent / mailto, no SDK). |
| KNYT Community Admin tab | `app/triad/components/codex/tabs/KnytCommunityContentAdminTab.tsx` | Tab `community-content-admin`, order 7, `adminOnly=true`. "Admin access required" defence-in-depth pill. Promotion queue (Promote emerald / Reject red, optimistic). Q¢ pricing grid (Save disabled until draft diverges; clamped server response re-syncs). Sends `adminPersonaId` on settings save. |
| Public viewer | `app/community-content/[id]/page.tsx` | Server component, dark theme, skill + Runtime/Free badges, hero image, byline, prose body, OpenGraph metadata for X/social previews, back link to KNYT community tab. Works for unauthed visitors landing from share links. |

## Runtime takeover integration

| File | Role |
|---|---|
| `services/community-content/promotedCapsules.ts` | `listPromotedCommunityCapsuleRecords()` projects `runtime_promoted` rows into `RuntimeCapsuleRecord` (sourceType=`'smart-content'` so existing renderer handles them with no changes). Filters out rows without `image_url` since the carousel pipeline drops anything with `assetStatus !== 'resolved'`. `listPromotedCommunityCatalogEntries()` is the lighter shape for the LLM catalog. |
| `app/api/runtime/capsules/route.ts` | Includes promoted records alongside published experience capsules in `primaryCapsules`. Fetched in parallel. |
| `app/api/runtime/takeover/infer/route.ts` | Includes promoted entries in the LLM catalog when cartridge accepts `'smart-content'` AND has `'knyt-codex'` in eligible `cartridgeSlugs`. |
| Capsule ID format | Both surfaces emit `community-<row.id>` — manifest pin/priority matches against the rendered capsule by ID via existing `applyTakeoverPriority` in `MetaMeRuntimeClient`. |
| Launch target | `/community-content/[id]` (the public viewer). |

**Why reuse `smart-content`:** The runtime renderer matches manifest `capsule.id` against existing `capsuleContents`. A new `community-content` source type would need parallel renderer work. By emitting promoted rows under `'smart-content'` with a `community-<id>` ID, both surfaces compose on top of existing types and renderers — zero schema or runtime client changes.

## Phase ledger

| Phase | What | Commit | State |
|---|---|---|---|
| 1 | schema + quota API | `77d1dea` | live |
| 2 | generation pipeline | `b88fe24` | live |
| 3 | runtime remix UI | `703c8db` | live |
| 4 | KNYT Community tab + reactions wiring | `980c593` | live |
| 5 | admin queue + budget UI | `2401966` | live |
| FX1 | iframe admin-editor leakage fix | `692676d` | live |
| FX2 | RemixDialog UX polish (sign-in banner, generation steps) | `fad242a` | live |
| FX3 | standalone runtime persona resolver | `0aea03c` | live |
| HARDEN | server-side admin checks on promote/reject/settings | `42a7585` | live |
| VIEWER | public `/community-content/[id]` page + GET route | `14946a0` | live |
| RLS BACKLOG | docs entry + collections.json registration | `68f40ee` | live |
| RUNTIME LOOP | promoted rows in runtime catalog + takeover infer | `5cb71cf` | live |

## Open items / backlog

1. **RLS policies on the three community-content tables.** Backlog doc filed; ship with the wallet-alias sprint's RLS changes. See `2026-04-29_community-content-rls-backlog.md`.
2. **No new `community-content` type in `RuntimeCapsuleSourceType`.** Reused `smart-content` for KISS. If you later want analytics that distinguish user-generated from official, add it.
3. **Promoted rows without an image are dropped** by the existing carousel pipeline (`assetStatus !== 'resolved'` filter). Reasonable today; worth knowing.
4. **`generation_index` is surfaced in `/list` but no UI uses it.** Per-persona ordinal of every generation that persona has ever made (mirrors `community_content_quotas.total_generations`). Kept for analytics / future achievements; can be ignored.
5. **Dev defaults assume `OPENAI_API_KEY` set.** Image gen falls through to OpenAI if `VENICE_API_KEY` absent. Without either, generation falls back to a placeholder draft.
6. **Public viewer Share Menu URLs** point at `${origin}/community-content/${id}`. Works on dev once Amplify rebuilds; no other env config needed.

## Boundaries with the blockchain / wallet-alias workstream

This workstream **does not touch**:

- `wallet_alias_commitments`, `cohort_memberships`, `root_identity`, `did_persona`, `agent_root_identity`, `agent_persona` tables
- `services/identity/walletAliasService.ts`, `services/identity/cohortAliasService.ts` (planned)
- `services/ops/idl/{escrow,rqh,fbc,dbc}.ts`
- `app/api/identity/wallet-alias/*`, `app/api/identity/cohort/*`
- `app/components/wallet/ExternalWalletConnect.tsx`

The only adjacent file is `personas.auth_profile_id` — read by `requireCommunityAdmin()` for the admin role lookup. That column is canonicalized by an existing trigger and is **not modified** by this workstream.

## Operator notes

- Migration `20260429000000_community_generated_content.sql` has been applied to Supabase.
- Required env: `OPENAI_API_KEY` (text gen, image fallback). Optional: `VENICE_API_KEY` (preferred image provider).
- Q¢ ledger: uses existing `qc_balances + qc_transactions` (Base Q¢). No new ledger tables.
- Reactions: uses existing `knyt_reactions` table via `/api/codex/knyt/living-canon/react`. The publish endpoint inserts a parallel row in `knyt_publication_states` so the existing reaction route accepts the content row's UUID as a `publicationId`.
- Admin gating: `crm_admin_roles` lookup via `personas.auth_profile_id`. Active, unexpired roles only. UI tab `adminOnly=true` is defence-in-depth on top of the server check.
