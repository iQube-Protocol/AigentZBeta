# Handoff — Community Content + Runtime Takeover (Post-Revert)

**Date:** 2026-04-29
**Status:** Phases 1–5 + FX fixes are LIVE on dev. Five follow-up commits were REVERTED under user pressure due to a runtime regression. This doc tells the next agent exactly what's in, what's out, why, and how to safely re-land the reverted work.
**Owner of next work:** TBD — picks up after the wallet-alias / blockchain agent finishes.

---

## Current state (what's live on dev right now)

The original five-phase community-generated-content build is intact:

| Phase | What | Commit |
|---|---|---|
| 1 | schema + quota API | `77d1dea` |
| 2 | generation pipeline | `b88fe24` |
| 3 | runtime remix UI (Remix dialog + capsule chip button) | `703c8db` |
| 4 | KNYT Community tab + reactions wiring + publish→`knyt_publication_states` | `980c593` |
| 5 | admin promotion queue + Q¢ pricing UI | `2401966` |
| FX | iframe admin-editor leakage | `692676d` |
| FX | RemixDialog UX (sign-in banner, generation steps) | `fad242a` |
| FX | standalone runtime persona resolver | `0aea03c` |

The user can remix capsules, draft → publish → react via 21 Sats `KnytReactionBar`, and an admin can promote/reject. **All of that still works.** What's missing is post-promotion surfacing and a few hardening pieces.

## What was reverted (and why)

Single revert commit `4404cbb` rolled back five commits:

| Commit | Scope | Reason for revert |
|---|---|---|
| `42a7585` | server-side admin checks on promote / reject / settings (`requireCommunityAdmin` helper) | Caught in blast radius of the broader revert. Does NOT touch runtime. Safe to re-land. |
| `14946a0` | public viewer page `/community-content/[id]` + GET single-row route | Caught in blast radius. Does NOT touch runtime. Safe to re-land. |
| `68f40ee` | RLS backlog doc | Doc-only. Caught in blast radius. Safe to re-land. |
| **`5cb71cf`** | **runtime takeover wiring (the actual culprit)** | Welcome banner stopped rendering, `/api/runtime/capsules` returned "No visual capsules". |
| `fef135e` | canonical workstream brief | Doc-only. Caught in blast radius. Safe to re-land. |

The user explicitly asked for a full session revert, so the three innocent commits got rolled back too. They can be re-landed individually after diagnosis.

## Why `5cb71cf` broke the runtime

The commit added `services/community-content/promotedCapsules.ts` and called it from two hot-path routes:

- `app/api/runtime/capsules/route.ts` — added `listPromotedCommunityCapsuleRecords()` to the `Promise.all` alongside `listPublishedRuntimeCapsuleRecords()`
- `app/api/runtime/takeover/infer/route.ts` — added `listPromotedCommunityCatalogEntries()` inside `fetchContentCatalog()` as a sequential await between the existing experience/smart-content fetch and the codex-tab loop

**Symptoms observed:**
- Welcome screen takes ages to load
- `RuntimeTakeoverBanner` not rendering (manifest is null)
- Takeover quick links under prompt box not rendering (gated on same manifest)
- "No visual capsules were resolved for this intent yet"
- Browser console shows `DOMException: The operation was aborted` from `visibilityChangedCallback` (in-flight fetch aborted on tab visibility change — fetch was taking too long to complete before user's tab visibility changed)

**Likely root cause** (not confirmed before revert):
1. A long-running query inside the new helper (or its module-init time) pushed total `fetchContentCatalog()` runtime over Amplify's silent Lambda timeout, returning empty body / 504
2. The hook's silent-bail behavior (`if (!res.ok) return;`) means a failed infer leaves the manifest null forever — banner and takeover quick links disappear
3. Possible secondary cause: the `community_generated_content` table may not exist on the deployed Supabase, and even though the helper has `.catch(() => [])` and inner `try/catch`, the actual failure mode (e.g. cold-Lambda module load) may not be hitting those guards

**The pattern is the same as the wallet-alias 504 issue** the other agent fixed: sequential Supabase round-trips on cold Lambda blow past the timeout. That agent's fix used `Promise.all` parallelization and `maxDuration=30`. Same prescription likely applies here.

## How to safely re-land

### Step 0 — Verify the deploy is healthy first

Before touching any of this, confirm `4404cbb` is live on dev and `/api/runtime/takeover/infer` and `/api/runtime/capsules` are returning 200s with manifests / capsules. If the regression persists after the revert, the cause is NOT in the reverted commits — investigate the wallet-alias agent's `94231e5` / `612b05c` first.

### Step 1 — Re-land the doc-only and admin-auth commits (zero runtime risk)

Cherry-pick or re-create:
- `42a7585` — admin auth hardening. Adds `app/api/community-content/_lib/adminAuth.ts` with `requireCommunityAdmin()`. Wires it into `[id]/promote`, `[id]/reject`, and `settings` POST. Updates `KnytCommunityContentAdminTab` to send `adminPersonaId` on settings save. Does not touch runtime.
- `14946a0` — public viewer. New `app/community-content/[id]/page.tsx` (server component) and `app/api/community-content/[id]/route.ts` (single-row GET, only public-status rows). Does not touch runtime.
- `68f40ee` — RLS backlog doc.
- `fef135e` — workstream brief (or supersede with this doc).

Smoke test after each: confirm runtime carousel still loads, admin tab still works.

### Step 2 — Diagnose before re-attempting runtime takeover wiring

Before re-adding `services/community-content/promotedCapsules.ts` to the runtime routes, confirm:

1. **Is `community_generated_content` actually in the deployed Supabase?** Run `SELECT count(*) FROM community_generated_content` against prod. If it's missing, no amount of code-side defensive handling will save you — the migration was never applied.
2. **What's the cold-Lambda time for `/api/runtime/takeover/infer` today?** Hit it cold (after no requests for ~5 min) and time the response. Record the budget.
3. **What's the timeout / maxDuration for the route?** Check `export const maxDuration = ...` in the route file.

### Step 3 — Re-land the runtime wiring DEFENSIVELY

When re-adding `promotedCapsules.ts`:

1. **Use `Promise.allSettled`, not `Promise.all`** in `/api/runtime/capsules`:
   ```ts
   const [pubRes, promRes] = await Promise.allSettled([
     listPublishedRuntimeCapsuleRecords({...}),
     listPromotedCommunityCapsuleRecords({ limit: 30 }),
   ]);
   const publishedExperienceCapsules = pubRes.status === 'fulfilled' ? pubRes.value : [];
   const promotedCommunityCapsules = promRes.status === 'fulfilled' ? promRes.value : [];
   ```
   This way the community-content branch can throw at any depth and the main pipeline still ships.

2. **Add a hard timeout to the community-content query** itself:
   ```ts
   const result = await Promise.race([
     db.from('community_generated_content').select(...).limit(...),
     new Promise<{ data: null; error: { message: string } }>((resolve) =>
       setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2000)
     ),
   ]);
   ```
   2 seconds max for community content. If it doesn't return in that window, treat as empty.

3. **In `/api/runtime/takeover/infer`**, parallelize the catalog fetches instead of awaiting them sequentially:
   ```ts
   const [exp, prom] = await Promise.allSettled([
     listPublishedRuntimeCapsuleRecords({ limit: 30 }),
     listPromotedCommunityCatalogEntries({ limit: 12 }),
   ]);
   ```
   Then iterate each result and push into `catalog`.

4. **Add `export const maxDuration = 30` to both routes** if not already there. (`infer` already has it; verify `capsules` does too — if not, add it.)

5. **Verify the migration is applied to dev's Supabase** before deploy. If not, run the SQL from `supabase/migrations/20260429000000_community_generated_content.sql` against the dev project first.

### Step 4 — Validate before pushing

After local edits, hit `/api/runtime/capsules` and `/api/runtime/takeover/infer` against the dev API base. Both must return 200 with non-empty `capsules` / `manifest` payloads. Only then push to a `claude/...` branch.

## Files that will need to come back

| File | Source commit | Purpose |
|---|---|---|
| `app/api/community-content/_lib/adminAuth.ts` | `42a7585` | server-side admin role check |
| `app/api/community-content/[id]/route.ts` | `14946a0` | GET single-row for public viewer |
| `app/community-content/[id]/page.tsx` | `14946a0` | public viewer page |
| `services/community-content/promotedCapsules.ts` | `5cb71cf` | runtime catalog projection (re-write defensively) |
| `codexes/packs/agentiq/updates/2026-04-29_community-content-rls-backlog.md` | `68f40ee` | RLS doc |
| `codexes/packs/agentiq/updates/2026-04-29_community-content-workstream-brief.md` | `fef135e` | workstream brief |

Plus modifications to:
- `app/api/community-content/[id]/promote/route.ts`, `[id]/reject/route.ts`, `settings/route.ts` (admin-auth wiring)
- `app/triad/components/codex/tabs/KnytCommunityContentAdminTab.tsx` (sends `adminPersonaId` on settings save)
- `app/api/runtime/capsules/route.ts` and `app/api/runtime/takeover/infer/route.ts` (rewrite with `Promise.allSettled` + hard timeouts)
- `codexes/packs/agentiq/collections.json` (register the two backlog/brief docs)

The original commits remain in git history accessible by hash if you want to cherry-pick rather than re-write.

## Boundaries with the blockchain / wallet-alias workstream

This workstream **does not touch**:
- `wallet_alias_commitments`, `cohort_memberships`, `root_identity`, `did_persona`, `agent_*` tables
- `services/identity/walletAliasService.ts`, `services/identity/cohortAliasService.ts` (planned)
- `services/ops/idl/{escrow,rqh,fbc,dbc}.ts`
- `app/api/identity/wallet-alias/*`, `app/api/identity/cohort/*`
- `app/components/wallet/ExternalWalletConnect.tsx`

The only adjacent file is `personas.auth_profile_id` (read-only) — used by `requireCommunityAdmin()` for admin role lookup via existing canonicalization trigger.

## Open items

1. **RLS policies on the three community-content tables** — backlog (re-land the doc + ship policies with the wallet-alias sprint's RLS changes).
2. **No new `community-content` `RuntimeCapsuleSourceType`** — reused `'smart-content'` for KISS. If analytics need to distinguish user-generated from official, add it later.
3. **Promoted rows without an image are dropped** by the runtime carousel pipeline (`assetStatus !== 'resolved'` filter). Reasonable today.
4. **`generation_index` is surfaced in `/list` but no UI uses it** — kept for analytics / future achievements.
5. **Required env vars:** `OPENAI_API_KEY` (text + image fallback). Optional: `VENICE_API_KEY` (preferred image provider).
