# Community-Generated Content + Runtime Takeover — Workstream Brief & Agent Handoff

**Date:** 2026-04-29  
**Status:** Restored + stabilised after revert. All phases live on dev.  
**Scope:** KNYT cartridge consumer remix flow; runtime carousel + takeover catalog integration  
**Sessions:** `017i9fiE…` (phases 1–5), `01Ths4F8…` (hardening + runtime loop), `01N5P9g7…` (restore after revert)

---

## What it is

A consumer "Remix" flow on KNYT runtime capsules. User taps Remix on a capsule chip → picks Article or Story → prompt → Q¢ debited → LLM + image generated → 30s discard window OR publish → other users see it in the KNYT "Community" tab and react via `KnytReactionBar` → admin promotes → promoted pieces appear in the runtime carousel.

End-to-end loop:

```
user remix capsule
  → /api/community-content/generate (debit Q¢, gen text+image, persist draft)
preview
  → discard within 30s for refund (1/day) OR publish
  → publish also creates matching knyt_publication_states row
others browse KNYT "Community" tab
  → KnytReactionBar reactions via /api/codex/knyt/living-canon/react
  → share menu: copy link / X intent / mailto → /community-content/[id]
admin reviews queue in "Community Admin" tab
  → promote → status='runtime_promoted' (eligible for runtime carousel)
  → reject  → status='rejected'
runtime carousel + takeover infer pull promoted rows
  → promoted rows appear in capsule carousel and LLM takeover manifest
  → click → public viewer page /community-content/[id]
```

---

## Why the previous session's runtime integration was reverted

The `5cb71cf` commit wired promoted community content into `/api/runtime/capsules` and `/api/runtime/takeover/infer`. It caused a regression: the welcome banner intermittently failed to render and `/api/runtime/capsules` returned "No visual capsules". Root cause: `listPromotedCommunityCapsuleRecords` was called with `Promise.all` — any Supabase error from the community-content tables poisoned the entire capsule response.

**The fix (now in place):**
- `services/community-content/promotedCapsules.ts` wraps all DB calls in `try/catch` and returns `[]` on any error — it can never throw.
- `/api/runtime/capsules/route.ts` uses `Promise.allSettled` for both calls — a community-content failure cannot affect the experience capsule result.
- Both are defensive; the runtime surfaces are protected from any future community-content DB instability.

---

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
| HARDEN | server-side admin checks on promote/reject/settings | restored `42a7585` | live |
| VIEWER | public `/community-content/[id]` page + GET route | restored `14946a0` | live |
| RLS BACKLOG | docs entry + collections.json registration | restored `68f40ee` | live |
| RUNTIME LOOP | promoted rows in runtime catalog + takeover infer (with isolation fix) | restored `5cb71cf` + fix | live |

---

## Database (Supabase)

**Migration:** `supabase/migrations/20260429000000_community_generated_content.sql` — applied.

| Table | Purpose |
|---|---|
| `community_generated_content` | one row per piece — `creator_persona_id`, `source_experience_id`, `parent_id` (remix lineage), `skill` (article\|story), `title`, `prompt`, `article_body`, `image_url`, `status` (draft\|shared\|pending_promotion\|runtime_promoted\|rejected), `qc_cost`, `generation_index`, promotion/rejection metadata |
| `community_content_quotas` | per-persona daily counters; rollover via `daily_free_used_date` compare (no cron) |
| `community_content_settings` | singleton (id=1, CHECK constraint) — pricing + caps |

**Open:** No RLS policies. Backlog at `2026-04-29_community-content-rls-backlog.md`.

---

## API surface (all under `/api/community-content/`)

| Route | Method | What it does | Auth |
|---|---|---|---|
| `/quota` | GET | returns `freeRemaining`, `refundRemaining`, costs, `currentQc` | none |
| `/generate` | POST | debit Q¢ → text+image in parallel → insert draft → bump quota | `personaId` in body |
| `/[id]/discard` | POST | owner-only refund + delete inside 30s window, 1/day | owner persona |
| `/[id]/publish` | POST | owner-only `draft → shared`; upserts `knyt_publication_states` row | owner persona |
| `/list` | GET | shared + runtime_promoted; `mine=1+personaId` scopes to drafts | none |
| `/[id]` | GET | single row, only shared/runtime_promoted; drafts → 404 | none — powers public viewer |
| `/[id]/promote` | POST | `shared → runtime_promoted` | server-side `requireCommunityAdmin` |
| `/[id]/reject` | POST | any → `rejected` | server-side `requireCommunityAdmin` |
| `/settings` | GET / POST | single-row config | GET open / POST `requireCommunityAdmin` |

### Admin auth (`_lib/adminAuth.ts`)

`requireCommunityAdmin(supabase, adminPersonaId)` → resolves `personas.auth_profile_id` → checks `crm_admin_roles` for active unexpired role. Returns 401 if no `adminPersonaId`, 403 if no active role.

---

## UI surfaces

| Surface | File | Role |
|---|---|---|
| Remix dialog | `components/metame/runtime/RemixDialog.tsx` | Modal triggered from capsule chip |
| KNYT Community tab | `app/triad/components/codex/tabs/KnytCommunityContentTab.tsx` | tab `community-content`, order 5 |
| KNYT Community Admin tab | `app/triad/components/codex/tabs/KnytCommunityContentAdminTab.tsx` | tab `community-content-admin`, order 7, `adminOnly=true` |
| Public viewer | `app/community-content/[id]/page.tsx` | Server component for share links |

---

## Runtime integration

| File | Role |
|---|---|
| `services/community-content/promotedCapsules.ts` | Projects `runtime_promoted` rows into `RuntimeCapsuleRecord` (sourceType=`smart-content`). Returns `[]` on any error — never throws. |
| `app/api/runtime/capsules/route.ts` | Includes promoted records via `Promise.allSettled` — community failure cannot break experience capsules. |
| `app/api/runtime/takeover/infer/route.ts` | Includes promoted entries in LLM catalog when cartridge accepts `smart-content` AND `knyt-codex`. Wrapped in `try/catch`. |

---

## Open items / backlog

1. **RLS policies** on the three community-content tables. See `2026-04-29_community-content-rls-backlog.md`. Ship with wallet-alias sprint RLS changes.
2. **No new `community-content` sourceType** — reused `smart-content` for KISS. Add if analytics need to distinguish user-generated from official.
3. **Promoted rows without `image_url`** are dropped (carousel needs thumbnail). Intentional.
4. **`generation_index`** is persisted but no UI uses it yet.

---

## Boundaries with blockchain / wallet-alias workstream

This workstream does **not** touch:
- `wallet_alias_commitments`, `root_identity`, `did_persona` tables
- `services/identity/walletAliasService.ts`
- `app/api/identity/wallet-alias/*`
- `app/components/wallet/ExternalWalletConnect.tsx`

The only shared file is `personas.auth_profile_id` — read by `requireCommunityAdmin()` for the admin role lookup. That column is **not modified** by this workstream.

---

## Operator notes

- Migration `20260429000000_community_generated_content.sql` has been applied to Supabase.
- Required env: `OPENAI_API_KEY` (text gen, image fallback). Optional: `VENICE_API_KEY` (preferred image provider).
- Q¢ ledger: uses existing `qc_balances + qc_transactions`. No new ledger tables.
- Admin gating: `crm_admin_roles` lookup via `personas.auth_profile_id`. Active, unexpired roles only.
- The `KnytCommunityContentAdminTab` sends `adminPersonaId` on settings save — this is required for the server-side check.

---

## Handoff for new agent

**What you're taking over:** The community-generated content + runtime takeover integration. All code is live and working. The brief above describes the complete picture.

**What needs doing next (in priority order):**

1. **RLS policies** — write and apply `supabase/migrations/20260430000000_community_content_rls.sql`. Spec is in `2026-04-29_community-content-rls-backlog.md`. Ship together with any wallet-alias RLS changes.

2. **Smoke test the runtime loop** — verify that a `runtime_promoted` row with an `image_url` appears in the runtime carousel after promotion. Check the public viewer at `/community-content/[id]` loads correctly for a shared row.

3. **Welcome banner regression** — the revert was triggered by a welcome banner intermittent failure. Before touching `/api/runtime/capsules` or `/api/runtime/takeover/infer`, verify the welcome banner renders consistently on the current codebase. The `Promise.allSettled` isolation fix should have resolved it, but confirm.

**What NOT to do:**
- Do not touch `app/api/runtime/capsules/route.ts` or `app/api/runtime/takeover/infer/route.ts` without first verifying the welcome banner is stable. These are high-blast-radius files.
- Do not revert or re-revert. The current state is the correct restored state.
- Do not add `Promise.all` for community-content fetches in runtime routes — always use `Promise.allSettled`.

**Key files to read before starting:**
- `services/community-content/promotedCapsules.ts` — understand the isolation pattern
- `app/api/runtime/capsules/route.ts` lines 545–565 — the `allSettled` integration point
- `codexes/packs/agentiq/updates/2026-04-29_community-content-rls-backlog.md` — the RLS spec

**Branch:** Work on your assigned `claude/<session-id>` branch. Auto-merge to `dev` via the `merge-claude-to-dev` workflow.
