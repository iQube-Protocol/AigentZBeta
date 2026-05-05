# Phase 2 Backlog — Tasks/Rewards/Reputation + PDF/Persona Stabilization

**Status:** backlog · sprint queue · resumes once PDF + baseline persona issues stabilize
**Captured:** 2026-05-05
**Predecessor docs:**
- `2026-05-04_tasks-rewards-reputation-integration-plan.md` (full plan + sprint sequencing)
- `2026-04-27_cohort-escrow-root-did-reputation-backlog.md` (reputation event taxonomy)

---

## 0. Why this backlog exists

We were mid-flight on **Sprint 1 → Sprint 2** of the tasks/rewards/reputation integration when a cluster of cross-browser PDF rendering + persona-state regressions surfaced. To prevent further drift, the team paused Sprint 2 and is stabilizing the PDF and persona baselines first. This doc consolidates everything queued for Phase 2 so nothing is lost.

**Resume condition:** clean baseline confirmed across:
- Brave platform + thin-client (metame.live) — KNYT codex renders all scrolls, ownership badges correct, persona switching stable
- Firefox — PDFs render inline (not download), persona stays on selected
- DB queries return < 2s consistently (post Postgres upgrade aftermath cleared)

---

## 1. Tasks · Rewards · Reputation — what shipped vs what's left

### Shipped (Sprint 1 — `6d4d2114` on 2026-05-04)
- **Phase A** — `20260504000000_seed_general_task_templates.sql` seeded 3 General task families (`knyt:bring-a-knight`, `knyt:knight-of-attention`, `knyt:herald-of-the-order`)
- **Phase B** — `GET /api/wallet/tasks?personaId=` unified endpoint returns `{cards, questRail, summary, reputation}`
- **Phase D** — KnytTab fetches and populates Order tab right-HUD QuestRail (Active Quest / Rewards / Order Rank)

### Remaining sprints

#### Sprint 2 — Phase C: Wallet Tasks/Reputation/Rewards tabs full wire-up
- Replace hardcoded JSX in `app/components/content/SmartWalletDrawer.tsx` (lines ~3155–3260) with bindings to `/api/wallet/tasks` payload
- Wallet **Tasks tab** — render `cards.{active, available, completed}` with claim CTAs
- Wallet **Reputation tab** (currently empty stub) — render `reputation.{overall, technical, creative, entrepreneurial, dataArch, community}` radar/bar chart + recent reputation events
- Wallet **Rewards tab** (currently empty stub) — render lifetime KNYT earned, claimable balance, ascension rank progression
- All three tabs share the single `/api/wallet/tasks` fetch — debounced + cache-keyed by `personaId`

#### Sprint 3 — Investor Dashboard (Investor sub-tab)
- DB tables (RLS-gated):
  - `investor_capital_events` — investment / share_grant / token_grant / vesting_milestone / distribution
  - `investor_documents` — `storage_master_id` references `master_content_qubes` (gated PDF viewer inheritance)
- Codex config — add `investor` (investorGated) sub-tab to `knyt-codex` order group
- API: `GET /api/codex/investor-dashboard?personaId=`
- UI: `KnytInvestorDashboardTab.tsx` — 4 cards (capital summary, holdings, documents stub, contact-IR)
- "My Documents" stub initially shows "contact your IR rep" until Sprint 4 admin upload exists

#### Sprint 4 — Admin Investments sub-tab
- Codex config — add `investments` (adminOnly) sub-tab to `knyt-codex` order group
- APIs:
  - `GET /api/admin/investor-dashboard?personaId=` — admin per-investor view
  - `POST /api/admin/investor-events` — record capital events
  - `POST /api/admin/investor-documents` — upload & attach
  - `PATCH /api/admin/investor-documents/[id]` — flip `visible_to_investor`
- UI: `KnytInvestmentsAdminTab.tsx` — expandable per-investor rows + upload + visibility toggle
- Once admins start populating, the Sprint 3 "My Documents" stub becomes live

#### Sprint 5 — Phase E: end-to-end loop verification
- Verify task → reward → reputation loop across all 6 task families:
  - Bring a Knight (referrals)
  - Knight of Attention (episode reading + streaks)
  - Herald of the Order (links + signups + conversions)
  - Living Canon: Dispatch / Theory / Observation / Correspondent
- Confirm `crm_contributions` → `crm_rewards` → `crm_persona_reputation` writes are atomic
- Confirm `/api/wallet/tasks` reflects updates within 2s of completion

#### Phase F (post-Sprint 5) — Copilot integration
- Aigent C (customer guide) surfaces task suggestions based on persona's active/available cards
- NBE plan disposition `act` triggers task initiation; `wait` defers to user

---

## 2. PDF Viewer — open items

### Cross-browser inline rendering (Firefox specifically)
- **Current state:** Firefox downloads PDFs from PDFLiteReaderModal even with `Content-Disposition: inline` set in Supabase Storage metadata
- **Confirmed working:** Brave, Chrome, Safari mobile, Chrome mobile
- **Hypothesis for fix:** route `pdf_lite_url` through a Next.js redirect that generates a Supabase signed URL with `download: false` (avoids 6 MB Lambda body limit since redirect)
- **Why deferred:** prior blob-URL attempt (`385769be`) coincided with broader regressions (catalog rendering, ownership badges, persona switching) across Brave platform AND thin-client. Reverted as `e8b690f7`. Root cause not yet isolated — could be unrelated DB upgrade aftermath, but cannot risk re-introducing until baseline is stable.
- **Surgical retry plan:**
  1. Build POC route `/api/content/pdf-signed-redirect` in isolation
  2. Test in dev-beta only against ONE PDF, not in modal flow
  3. Confirm headers + Firefox renders inline
  4. Wire into PDFLiteReaderModal as a one-line src change

### Phase 2 secure URL handling (already in CLAUDE.md, restated for visibility)
- Replace direct `pdf_lite_url` exposure in `/api/admin/codex/status` response with authenticated server-side redirect route `GET /api/content/pdf-signed/[masterId]`
  1. Validates persona owns the episode
  2. Generates 5-min Supabase Storage signed URL
  3. Returns 302 redirect
- Eliminates URL-leakage window without requiring `pdfjs-dist` or full-PDF Lambda buffering
- Keep direct URL only for free/public content (GN episode 0)

### Server-side timeout guards (DB resilience)
- Routes that bypass `getSupabaseServer()` and use `createClient()` directly hang to Lambda 30s when DB is slow → 504 with empty body → `JSON.parse: unexpected end of data` on client
- **Confirmed affected (timed out during DB upgrade):**
  - `app/api/codex/owned/route.ts`
  - `app/api/wallet/personas/route.ts`
  - `app/api/entitlements/list/route.ts`
  - `app/api/wallet/knyt/balance/route.ts`
  - `app/api/wallet/identity/profile/route.ts`
  - `app/api/wallet/identity/consolidate/route.ts`
  - `app/api/x402/custody/route.ts`
  - `app/api/x402/claims/route.ts`
- **Fix:** migrate each to `getSupabaseServer()` (has `SUPABASE_FETCH_TIMEOUT_MS` 8s timeout)
- **Surgical principle:** one route per commit, verify each in dev-beta before next

---

## 3. Persona / Identity baseline issues

### Firefox — auto-switches back to anonym@knyt
- Symptom: changing any persona snaps back to `anonym@knyt`
- Brave does NOT auto-switch back (different bug surface)
- Suspect: persona state hydration race between cookie/localStorage/server session
- Investigation start points:
  - `app/contexts/SmartContentActionContext.tsx` (persona resolution)
  - `app/triad/components/codex/tabs/KnytTab.tsx` `effectivePersonaId` useMemo (754–763)
  - Persona switcher component (find which file emits the change event)

### EVM wallet ↔ persona mapping inversion (both browsers)
- `anonym@knyt` persona shows `arkagent@knyt`'s EVM KNYT balance
- The EVM wallet is assigned to `arkagent@knyt`, not `anonym@knyt`
- Suspect: `/api/wallet/knyt/balance` is resolving wallet by some shared key (auth_profile_id?) instead of strict `persona_id`
- Check: `services/wallet/personaRepo.ts` and how `getCallerAuthProfileId` interacts with persona-scoped wallet lookups

### Thin-client vs platform divergence
- `metame.live` (thin-client) and `beta.aigentz.me` (platform) render KNYT codex differently for the same persona
- CLAUDE.md canonical rule: `personaId` MUST travel via URL params for inter-cartridge navigation (`utils/codex-nav.ts` `buildCodexUrl()`)
- **Investigation:** trace how metaMe runtime at `metame.live` constructs the KNYT codex iframe URL — is `?personaId=` appended?
- **Likely fix:** patch the iframe builder in metaMe runtime to call `buildCodexUrl()` with the active persona

---

## 4. Surgical-change protocol (lessons from this debug cycle)

To prevent the kind of compound regressions that triggered this rollback, every Phase 2 change follows:

1. **One file, one surface, one symptom per deploy.** No "while I'm here" cleanups.
2. **Verify the actual deployed commit before debugging next symptom.** Browser caches and Amplify build queues lie.
3. **For new server-side Supabase access, always use `getSupabaseServer()`.** Never `createClient` directly — the timeout guard is non-negotiable.
4. **Don't touch upload-time and read-time code paths in the same change.** Different blast radii.
5. **Test the same surface on dev-beta AND staging-beta before declaring done.** Divergence between them is itself a signal.
6. **For PDF/viewer changes, always test in Brave + Firefox + mobile Safari + thin-client + platform** — five surfaces, no assumptions.

---

## 5. Resume order when baseline is stable

1. **Sprint 2** — Phase C wallet tabs (highest leverage; user-facing on every signed-in session)
2. **PDF Firefox surgical retry** — POC route first, no modal changes until verified
3. **Server-side timeout guards** — one route at a time, starting with `/api/codex/owned`
4. **Persona Firefox snap-back fix** — root-cause investigation before patching
5. **Wallet ↔ persona mapping fix** — service-layer audit
6. **Sprint 3** — Investor Dashboard
7. **Sprint 4** — Admin Investments
8. **Sprint 5** — End-to-end loop verification
9. **Phase F** — Copilot integration

---

## 6. References

- `services/rewards/rewardService.ts` — `RewardTaskType` enum
- `services/crm/taskService.ts` — `completeTask` atomic flow
- `app/api/wallet/tasks/route.ts` — Sprint 1 unified endpoint (shipped)
- `app/components/content/SmartWalletDrawer.tsx` ~3155–3260 — Sprint 2 wire-up site
- `app/triad/components/codex/templates/KnytTemplateRenderer.tsx` ~1212–1300 — Order tab right-HUD (Sprint 1 shipped)
- `app/triad/components/content/PDFLiteReaderModal.tsx` — current baseline (post-revert at `e8b690f7`)
- `app/api/_lib/supabaseServer.ts` — canonical timeout-guarded client factory
- `utils/codex-nav.ts` — `buildCodexUrl()` for personaId propagation
- CLAUDE.md § Gated Content, § Inter-Cartridge Navigation, § Phase 2 Backlog — Secure PDF URL handling
