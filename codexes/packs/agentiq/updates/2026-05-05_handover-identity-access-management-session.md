# Handover — Identity & Access Management Workstream

**For:** the next Claude Code session starting fresh on Identity & Access Management
**From:** the session that just finished PDF debug saga + retail/investor purchase wiring + thumbnail/ownership SoT analysis (May 5, 2026)
**Branch:** `claude/review-session-setup-V82mB` (current — keep working on this branch unless instructed otherwise)
**Repo:** `/home/user/AigentZBeta` (production: dev → Amplify auto-merge → `dev-beta.aigentz.me`)

---

## 🛑 GOLDEN RULE — READ THIS FIRST AND READ IT TWICE

**DO NOT RE-CREATE. EXTEND WHAT IS ALREADY IN PLACE. DO NOT REBUILD. DO NOT CREATE NEW THINGS UNLESS ABSOLUTELY NECESSARY, AND SEEK OPERATOR APPROVAL BEFORE DOING SO.**

**95%+ of what is needed for identity & access management is already built.** This workstream is about **aligning** the existing pieces and **ensuring they work in concert** — not about building new features or rebuilding what works. There are a few specific exceptions that will be called out, but the default posture is:

1. Find the existing implementation
2. Read it fully
3. Understand the contract
4. Extend or wire it where misaligned
5. Only create new code as a last resort, with explicit operator authorization

If you find yourself opening a new file because "this would be cleaner" — STOP. The existing seam almost certainly already exists somewhere in `services/`, `app/hooks/`, `app/api/`, `app/contexts/`, or `utils/`. Search first. Ask second. Build never (without authorization).

This is not pedantry — every recent regression in this session has come from someone touching code that was already correct. Surgical changes only.

---

## Project context (in two paragraphs)

This is **AigentZ / iQube Protocol**, a multi-cartridge platform with KNYT being the active commerce + content cartridge. The system runs a dual-agent model (Aigent Z = orchestrator, Aigent C = customer guide) above a sovereign guardian (metaMe). Personas are first-class — every user can have multiple personas, and every meaningful interaction (ownership, balance, entitlement, NBE plan) is scoped per-persona. The platform is currently in alpha, primarily investor-only. **Phase 2** is when persona + access rights get tackled holistically; until then we operate with explicit operator authorization for any gate changes.

Identity flows through several layers: **auth profile** (Supabase auth) → **persona** (`personas` table, multiple per auth profile) → **CRM persona** (`crm_personas`, links to identity_persona_id for investor/cohort lookups) → **investor record** (`nakamoto_knyt_personas`). Ownership flows through two parallel entitlement systems (Rewards: `user_entitlements` + `purchases`; SmartContent: `content_entitlements` + `content_library`) which share `personas` as the identity anchor but otherwise don't fully reconcile. The wallet is the closest thing we have to a single source of truth for ownership today, via the `useOwnedEntitlements` hook which already federates these sources.

---

## ⚠️ MUST-READ (in order, before touching anything)

### 1. Project rules
- **`CLAUDE.md`** at repo root — every rule applies. Especially:
  - § "Security — Access Gates (PARAMOUNT)" — never weaken/remove a gate without explicit operator authorization
  - § "Core Principle: Extend, Don't Duplicate"
  - § "Inter-Cartridge Navigation — Identity Propagation (CANONICAL RULE)" — `personaId` MUST travel via URL params on inter-cartridge links
  - § "Gated Content — Confidential Exposure Rules"
  - § "Push Commit Messages — MANDATORY" — every push to dev needs a descriptive merge message

### 2. Architecture briefs
- `docs/agent-harness/metaproof-core.md` — role hierarchy, NBE contract, DVN receipt taxonomy
- `docs/agent-harness/aigent-z-aigent-c-contract.md` — full role definitions, routing sequence
- `docs/agent-harness/journey-state-schema.md` — JourneyState, ExperienceModel, NBEPlan + SQL

### 3. Recent session updates (relevant context)
- `codexes/packs/agentiq/updates/2026-05-05_phase-2-backlog-tasks-rewards-pdf-persona.md` — Phase 2 backlog including persona issues to address
- `codexes/packs/agentiq/updates/2026-05-05_pdf-rendering-reference.md` — surgical-change protocol distilled from PDF saga
- `codexes/packs/agentiq/updates/2026-05-04_persona-hydration-pdf-video-admin-fixes.md`
- `codexes/packs/agentiq/updates/2026-05-04_smarttriad-ownership-unification-backlog.md`
- `codexes/packs/agentiq/updates/2026-04-29_identity-management-comprehensive-doc-backlog.md`
- `codexes/packs/agentiq/updates/2026-05-04_remix-modal-persona-fix.md`

---

## Canonical infrastructure that already exists (DO NOT RECREATE)

### Identity & persona resolution

| Capability | File / API | Notes |
|---|---|---|
| Multi-email identity merging | `services/wallet/multiEmailIdentity.ts` | `getMergedLinkedAuthProfileIds`, `getPersonaPrefs` |
| Persona repo (auth ↔ persona) | `services/wallet/personaRepo.ts` | `getCallerAuthProfileId` + persona lookups |
| Persona resolution from URL/localStorage | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` | Used by codex embeds; URL `?personaId=` is preferred, localStorage `currentPersonaId`/`activePersonaId` is fallback |
| `effectivePersonaId` resolver pattern | `app/triad/components/codex/tabs/KnytTab.tsx` lines 754–763 | Candidate chain: prop → activePersonaId → personas[0] → supabaseSessionPersonas[0]; trims and rejects 'default'/'guest' |
| Personas API | `GET /api/wallet/personas` | Returns persona list for the auth caller |
| Inter-cartridge nav (carries personaId) | `utils/codex-nav.ts` `buildCodexUrl()` | **Canonical helper** for any link that crosses a codex/cartridge boundary |
| Codex embed page (reads persona params) | `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` | Already reads `?personaId=`, `?isAdmin=`, `?isPartner=`, `?from=`, `?fromTab=` |

### Ownership & entitlements (the SoT story)

| Capability | File / API | Notes |
|---|---|---|
| **Canonical ownership hook (USE THIS)** | `app/hooks/useOwnedEntitlements.ts` | Federates `/api/entitlements/list` + `/api/codex/owned`; exposes `isEpisodeOwned`, `isCharacterOwned`, `entitlements`, `refresh()` |
| Entitlement enrichment API | `GET /api/entitlements/list?personaId=` | Returns user_entitlements with `assetMeta` (title + cover URL/CID) for thumbnail rendering |
| Codex SKU-expanded ownership | `GET /api/codex/owned?personaId=` | Returns `issues[]` (pricingEp numbers) + `characters[]` (UUIDs); does SKU expansion via `getOwnedAssetIds` |
| SKU expansion logic | `services/rewards/assetOwnership.ts` `getOwnedAssetIds()` | Resolves owned SKUs → master_content_qubes asset IDs |
| Rewards entitlement service | `services/rewards/entitlementService.ts` | Writes/reads `user_entitlements` table; used by cart purchases |
| SmartContent entitlement service | `services/content/smartContentService.ts` | Writes/reads `content_entitlements` + `content_library` tables; used by SmartContent direct grants |
| Purchase processing | `services/rewards/purchaseHandler.ts` `processPurchase()` | Cart settles through this |
| Cart settlement endpoint | `app/api/cart/complete/route.ts` | Loops `processPurchase` per line; writes asset_id from `line.id` |

### CRM & investor identity

| Capability | File / API | Notes |
|---|---|---|
| CRM client | `services/crm/crmDataAccess.ts` `getCrmClient()` | |
| Investor status check | `GET /api/crm/campaign/investor-status?personaId=` | Resolves persona → CRM email → checks `nakamoto_knyt_personas`. **KNOWN BROKEN: returns isInvestor:false even when persona email IS in nakamoto_knyt_personas. Investigate identity resolution path.** |
| Investor tab purchase wiring | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` | As of May 5, 2026 the button-level `isVerified` gate is force-true (operator-authorized for alpha). Tab-level gating in `data/codex-configs.ts` is already open. |

### Tables (read these schemas before changing anything)

```
personas                       — base persona records (id, fio_handle, auth_profile_id, ...)
crm_personas                   — CRM persona with identity_persona_id link
nakamoto_knyt_personas         — investor cohort table (kickstarter_backed_at, campaign_state, ...)
user_entitlements              — Rewards entitlement system (asset_id, persona_id, tier, source_purchase_id)
content_entitlements           — SmartContent entitlement system (content_id, persona_id, scope)
content_library                — wallet library shelves (content_id, persona_id, shelf_name)
purchases                      — top-level purchase rows
knyt_purchases                 — character-card direct KNYT purchases
master_content_qubes           — episodes/print/motion masters; id format `mk_epNN_<type>_<tier>`, episode_number = db convention
codex_media_assets             — display assets (cover thumbs, character posters); episode_number = db convention
store_skus                     — SKU definitions with grants_episodes_*, grants_character_cards, episode_numbers[]
wallet_balances                — KNYT/Q¢ balances per persona
```

### Useful UI surfaces

| Where | File |
|---|---|
| Wallet "Your Library" | `app/components/content/SmartWalletDrawer.tsx` lines 3045–3140 |
| Wallet drawer | `app/components/content/SmartWalletDrawer.tsx` |
| Library shelf | `app/components/content/LibraryShelf.tsx` |
| Codex KNYT tab | `app/triad/components/codex/tabs/KnytTab.tsx` |
| Codex panel host | `app/triad/components/CodexPanelDynamic.tsx` |
| Cart drawer | `app/triad/components/codex/tabs/KnytCartDrawer.tsx` |
| Smart content actions context | `app/contexts/SmartContentActionContext.tsx` |

---

## Open identity issues from the prior session (queued, not in current scope unless instructed)

These are open items the operator flagged. Do NOT fix them without explicit instruction — they're listed so you have the context, not as a TODO list. Your scope from the operator will be specific.

1. **Firefox auto-switches back to anonym@knyt** — changing any persona in Firefox snaps back to anonym@knyt. Brave doesn't. Suspect persona state hydration race between cookie/localStorage/server session. Investigation start: `app/contexts/SmartContentActionContext.tsx`, `app/triad/components/codex/tabs/KnytTab.tsx` `effectivePersonaId` useMemo (754–763), persona switcher emit point.

2. **EVM wallet ↔ persona mapping inversion** — `anonym@knyt` persona shows `arkagent@knyt`'s EVM KNYT balance in both Brave and Firefox. The EVM wallet is assigned to `arkagent@knyt`, not `anonym@knyt`. Suspect: `/api/wallet/knyt/balance` resolves wallet by some shared key (auth_profile_id?) instead of strict `persona_id`. Check `services/wallet/personaRepo.ts` and how `getCallerAuthProfileId` interacts with persona-scoped wallet lookups.

3. **Thin-client (`metame.live`) vs platform (`beta.aigentz.me`) divergence** — KNYT codex renders different content for the same persona between surfaces. Most likely: thin-client iframe builder doesn't append `?personaId=` to the codex URL, so localStorage from a different origin can't be read. CLAUDE.md canonical rule: every inter-cartridge link MUST carry `personaId` via URL param — use `buildCodexUrl()` from `utils/codex-nav.ts`. Check how metaMe runtime constructs the KNYT codex iframe URL.

4. **CRM investor lookup broken** — `dele@metame.com` is in CRM as a verified investor but `/api/crm/campaign/investor-status` returns `isInvestor: false`. This is what forced the alpha-phase decision to open the investor tab buy buttons. The actual identity-resolution path is broken somewhere in `services/crm/crmDataAccess.ts` or the route's two-strategy resolution.

5. **`/api/codex/owned` and `/api/wallet/knyt/balance` no fetch timeout** — both routes use raw `createClient` instead of `getSupabaseServer()`. When DB is slow these hang to Lambda 30s and return empty 504, which clients then fail to JSON-parse. Migration to `getSupabaseServer()` is queued — one route per commit.

6. **SoT consolidation across surfaces** — the wallet uses `useOwnedEntitlements` hook (canonical). The codex (`KnytTab`) does its own `fetchOwnedEpisodes` and stores `ownedIssues` in local state. Store tabs each do their own thing. Plan documented in the Phase 2 backlog: migrate codex to the hook (single file change), then store tabs (one tab per commit).

---

## Critical operating rules for this session

### A. Surgical-change protocol (NON-NEGOTIABLE)

Every change must be:

1. **One file, one symptom, one commit per deploy.** No "while I'm here" cleanups.
2. **Use the existing `getSupabaseServer()` factory** for any new server-side Supabase access. Never `createClient` directly — the timeout guard is non-negotiable and missing it has caused 504-cascade outages.
3. **Don't touch upload-time and read-time code paths in the same change.** Different blast radii.
4. **Verify the actual deployed commit before debugging the next symptom.** Browser caches and Amplify build queues lie. When something seems off, ask the operator to test in a private/incognito window before changing code.
5. **For UI/auth changes, test on multiple surfaces before declaring done:** Brave, Firefox, mobile Safari, thin-client (metame.live), platform (beta.aigentz.me). Divergence between dev-beta and staging-beta is itself a signal.
6. **Cache lies.** When something looks broken, FIRST rule out cache (private window) before touching code.

### B. Security gates (PARAMOUNT)

Per CLAUDE.md: **NEVER remove, weaken, or bypass any access control gate without explicit written consent from the operator.** This includes:
- `adminOnly` flags on codex tabs/routes/UI
- Role checks (`isAdmin`, `isSuperAdmin`, RBAC guards)
- Supabase RLS policies
- API route authentication middleware

If a gate appears to be blocking legitimate access:
1. Report to operator and ask for explicit authorization
2. Investigate the auth resolution upstream — fix the resolution, don't remove the gate
3. Never remove a gate as a debugging shortcut

### C. Push & merge discipline

- Branch: `claude/review-session-setup-V82mB` (continue here)
- Push: `git push -u origin claude/review-session-setup-V82mB` (auto-merges to `dev`)
- Every push must carry a descriptive commit message naming what's being pushed (CLAUDE.md "Push Commit Messages — MANDATORY" is non-negotiable)
- Never use `--no-edit` on merge commits
- Never use `--no-verify` to skip hooks unless operator explicitly says so

### D. When in doubt, ask

The operator (Hal) prefers being asked over being surprised. For anything ambiguous:
- Whether a change is in scope
- Whether to remove a gate
- Whether to introduce a new file
- Whether to change a security-sensitive flow

— ask first. The cost of confirming is low; the cost of unwanted changes is very high.

---

## Where to start

The operator will tell you the specific scope when you arrive. Common starting points:

- "Audit the persona resolution path across surfaces" → start with `useCodexEmbedAuthBridge`, `effectivePersonaId` resolver, follow up to wallet hooks
- "Fix the CRM investor lookup" → start with `/api/crm/campaign/investor-status/route.ts` + `services/crm/crmDataAccess.ts`, trace identity resolution
- "Migrate codex to useOwnedEntitlements" → see KnytTab, replace `ownedIssues` state with hook
- "Wire personaId propagation from metaMe runtime" → find iframe builder, ensure `buildCodexUrl()` is used

Whatever the scope, **start by searching for what already exists**. Use `Explore` agent or `grep` aggressively. The seam you need almost certainly exists.

---

## Communication

- Update operator (Hal) with brief progress notes; one sentence per checkpoint is enough
- Don't narrate internal deliberation; state results and decisions
- End-of-turn: one sentence on what changed and what's next
- For exploratory questions ("what could we do about X"), 2–3 sentences with a recommendation and the main tradeoff. Don't implement until operator agrees.

---

## Final reminder

**95%+ of what you need is already built.** This workstream is alignment, not construction. The temptation to "tidy" or "refactor" or "create a cleaner abstraction" will arise — resist it. Every regression in the prior session traced back to someone changing code that was already correct.

Find the seam. Read it fully. Ask before extending. Never recreate.

Good luck.
