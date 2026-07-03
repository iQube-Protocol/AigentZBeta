# New Session Setup Notes — AigentZ / iQube Protocol

> Orientation layer for a fresh Claude Code (or Codex / Lovable) session. Read this
> first, then `CLAUDE.md` (auto-loaded, authoritative) and `docs/platform-ontology.md`.
> This note tells you *what the stack is, how it deploys, and where the landmines are* so
> you can act correctly in the first five minutes.

---

## 0. First five minutes

1. **`CLAUDE.md`** is the authoritative dev-rules file and is auto-loaded into context. This note does not replace it — it orients you to it.
2. **`docs/platform-ontology.md`** — canonical spellings/meanings (BlakQube, aigentMe, iQube, DVN, MAF, PSC-001). Using a non-canonical spelling is a bug. Read before writing any code, UI copy, or docs.
3. **Branch flow:** develop on your assigned `claude/<session-id>` branch. Never push to another branch without explicit permission.
4. **Deploy flow:** push to `claude/**` → the `merge-claude-to-dev` GitHub Action auto-merges to `dev` → Amplify builds `dev`. Amplify is *not* a GitHub Action — its build status is not visible from GitHub MCP. Verify code reached dev with `git log origin/dev`; the live build lags the merge by a few minutes.
5. **Sandbox reality:** outbound HTTPS is blocked. `curl`/QubeTalk to external hosts fail (403 CONNECT). GitHub is only reachable via the `mcp__github__*` tools (repo scope: `iqube-protocol/aigentzbeta`). Agent-to-agent coordination uses the file-based QubeTalk bridge (`docs/qubetalk-bridge/`).

---

## 1. Stack at a glance

- **App:** Next.js (App Router) + TypeScript. Server logic in `app/api/**` route handlers.
- **Data:** Supabase (Postgres + RLS). Server code uses the service-role client via `getSupabaseServer()`.
- **State/anchoring:** ICP canisters (DVN), EVM/Base (iQube NFTs, USDC, KNYT token reads).
- **AI:** Anthropic (Haiku/Sonnet/Opus per plan tier), OpenAI, Venice; embeddings via OpenAI/Voyage.
- **Build tolerance:** `next.config` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`. A build fails only on a genuine parse/webpack error, not on TS/lint. Validate quickly with `npx esbuild --bundle --outfile=/dev/null <file>` (external `@/*`, `react`, `@supabase/*`, `next/server`).

### Architecture layers (respect the boundaries)
| Layer | Responsibility | Tech |
|---|---|---|
| Context | Semantic intelligence, RAG, iQube content | LangChain, blakQube |
| Service | API integration, wallet, CRUD | Next.js API routes, Supabase, AA-API |
| State | Chain-backed persistence, audit trail | ICP canisters, EVM, Supabase |

### Key directories
`app/api/**` (server routes) · `services/**` (backend services) · `components/**` (`ui/`, `composer/`, `registry/`, `metame/`) · `data/` (`codex-configs.ts`, `activation-catalog.ts`) · `supabase/migrations/` · `docs/` · `codexes/packs/agentiq/updates/` (this folder — canonical session-doc location).

---

## 2. Identity & Access Spine — the single source of truth (PARAMOUNT)

Every backend touchpoint for identity, asset ownership, gating, or rewards flows through the spine. **Do not build parallel resolvers/gates.**

- Who is the caller? → `getActivePersona(request)`
- Does persona own asset? → `userOwnsAsset(personaId, assetId)`
- Allow this read/tx? → `evaluateAccess(persona, descriptor, action)`
- Browser view of persona → `GET /api/wallet/active-persona` (T1)

**Identifier tiers — never mix:**
- **T0** server-internal only: `personaId`, `authProfileId`, `rootDid`, `fioHandle`, `caseId`. Never serialise to JSON, never put in receipts/chain/locker.
- **T1** browser-safe: `personaSessionToken`, `displayLabel`, `cartridgeFlags`.
- **T2** public-network: `cohortAliasCommitment`, `cohortId` — the only ids allowed in DVN receipts.

**Client fetches to spine routes MUST use `personaFetch`** (from `@/utils/personaSpine`) — it attaches the Supabase Bearer token. Raw `fetch` returns 401 and the feature silently fails closed. Applies to `/api/wallet/active-persona`, `/api/persona/*`, `/api/assistant/*`, `/api/admin/*`, `/api/access/*`, `/api/connectors/*`, `/api/billing/*`.

**Do not modify without operator approval:** `services/identity/getActivePersona.ts`, `services/identity/personaSessionToken.ts`, `services/access/evaluateAccess.ts`, `services/access/policyResolvers.ts`, `services/content/getContentDescriptor.ts`, `services/content/encryption.ts`, `services/content/stateCDelivery.ts`, `types/access.ts`.

---

## 3. DVN pipeline — critical infrastructure (PARAMOUNT)

The DVN (Decentralised Verification Network) anchors activity receipts on-chain (chain-of-provenance). Failures are never silent — they escalate (`[DVN ESCALATION]` at `console.error`, receipt row → `dvn_failed`, operator retry route).

- **Do NOT modify without approval:** `services/dvn/activityReceiptDvnPipeline.ts`, `services/ops/icAgent.ts`, `services/ops/idl/cross_chain_service.ts`.
- **Only permitted unilateral change:** adding a new action type to `ANCHORABLE_ACTION_TYPES`.

---

## 4. Commercial / plan model (current — built through 2026-07-03)

Two independent axes on `persona_plans`:
- **`plan_tier`** (citizen ladder): `citizen` (free) → `sovereign_citizen` → `steward` (+ `first_citizen`).
- **`venture_tier`** (Founder Office): `none` → `lite` (Operator) → `pro` (Operator+) → `elite` (Portfolio Operator).

Resolver: **`services/billing/personaPlan.ts` → `getPersonaPlan(admin, personaId)`** returns a `PersonaPlan` with all entitlements. `cancelled` → free; `past_due` → keeps tier (grace).

### Tier ladder & entitlements
| Tier | Model | Personas | Bounded delegates | Goals/KPIs/Cartridges |
|---|---|---|---|---|
| Free | Haiku | 1 | 3 | 1 / 3 / 1 |
| Sovereignty ($29) | Sonnet | 3 | 10 | 5 / 7 / 5 |
| Stewardship ($99) | **Opus** | 8 | 28 | ∞ |
| Operator / `venture_lite` ($299) | Opus | 10 | 35 | ∞ |
| Operator+ / `venture_pro` ($999) | Opus | 15 | 50 | ∞ |
| Portfolio / `venture_elite` ($2,999) | Opus | ∞ | ∞ | ∞ |

- **Q¢ rule:** `$1 = 100 Q¢`, one Q¢ = `$0.01`. Store as integer cents. Display USD primary.
- **Payment rails:** Q¢ · USDC (Base) · PayPal. **KNYT is NOT a plan rail** — it stays in-cartridge.
- **Model routing:** `services/billing/planModelTier.ts` — `stewardAccess` (steward + all FO) → Opus; `sovereignAccess` → Sonnet; else Haiku.

### Upgrade UI (two modals + comp access)
- `components/metame/billing/CitizenLadderModal.tsx` — Free / Sovereignty / Stewardship, 3-column comparison.
- `components/metame/billing/PlanUpgradeModal.tsx` — Founder Office (Operator / Operator+ / Portfolio), 3-column comparison.
- Shared table primitives: `components/metame/billing/comparisonTable.tsx`.
- Router hook: `usePlanUpgradeModal.tsx` — `openUpgrade({defaultTierKey})` auto-routes citizen vs FO; also `openCitizenUpgrade` / `openFoUpgrade`.
- **Comp access:** `CompAccessRequest.tsx` → `POST /api/billing/comp-request` writes an `admin_access_requests` row (tier encoded as `plan:<tier>` slug + reason) → admin approves in the **Access Requests** tab → decide route grants `persona_plans`.
- The Activations header chip recommends the **next tier up** from the current plan (`/api/billing/plan`).

### Enforcement (live)
- **Personas:** `/api/wallet/persona` POST — per-subscriber cap via `getSubscriberPersonaLimit` (highest active plan across the auth_profile's personas).
- **Bounded delegates:** `services/agents/sponsorPolityAgent.ts` — `plan.boundedDelegateLimit` is the authoritative sponsorship-capacity base (admin base + Standing-earned still stack). Total capacity *includes* aigentMe.
- **Experience model caps:** enforced at the experience-model write path.
- **Subscription failure (grace → cancel):** `services/billing/planRenewal.ts` — renewal debit fail → `past_due` (7-day grace, full access); still unpaid past grace → `cancelled` + reconcile (revoke live bounded-delegate session via `revokeActiveGrant`). Personas/agents are flagged (fall to free caps), never deleted.

### Admin
- **Plan Pricing** tab (metaMe admin cartridge, `adminOnly`) — `PlanPriceConfigAdminTab` ↔ `/api/admin/billing/price-config` ↔ `plan_price_config`. Edits take effect immediately; code-level fallbacks exist so modals render before the migration is applied.

### Migrations these rely on (apply in Supabase)
`20260625000003_plan_price_config.sql`, `20260625000002_persona_plans_steward_tier.sql`, `20260625000004_plan_checkout_sessions.sql`, `20260625000005_plan_premium_config.sql`, `20260625000006_passport_steward_role.sql`, plus the sponsorship-capacity columns migration.

---

## 5. Activations system

- `data/activation-catalog.ts` — the catalog (id, label, `gate: 'open' | 'gated'`, source cartridge).
- `services/activations/activationPlanGate.ts` — `ACTIVATION_PLAN_GATE`: single source of truth for which activations are plan-gated and the `requiredTier`.
- `services/activations/spineActivations.ts` — the live path (activation state in `content_qube_editions`); `personaActivations.ts` is the parallel `persona_activations` path (pending state).
- Admin grants flow through `admin_access_requests` → decide route. `cartridge_access` grants a `persona_activations` row; `plan_grant` (comp) writes `persona_plans`.
- Gotcha (fixed 2026-06): a *revoked* edition must not keep a re-gated surface self-activatable — only a currently-held edition counts. Client interceptor opens the upgrade modal on the server's "upgrade required" reason.

---

## 6. Non-negotiable dev rules (see CLAUDE.md for full text)

- **Push/merge commit messages must name the actual content.** No generic `Merge remote-tracking branch …`. When merging dev before push: `git merge origin/dev -m "merge dev: sync before pushing <what changed>"`. Never `--no-edit` on a deployable merge.
- **No guessing.** Never invent URLs, env values, IDs, endpoints. If not in the codebase or given by the operator, say "I cannot find X — please provide it."
- **Access gates are sacred.** Never remove/weaken `adminOnly`, role checks, RLS, or auth middleware without written admin consent. Fix the upstream auth flow instead.
- **HMS identifier isolation:** `caseId`/`personaId`/agent ids never appear in locker `display_name`, DVN receipts, or chain records. Use the T2-safe `sha256('hms:locker:'+caseId).slice(0,16)` commitment.
- **Gated content:** no `target="_blank"` / `window.open()` on gated PDFs/videos; no raw Supabase storage URLs to the browser; PDF viewer split (`PDFLiteReaderModal` vs `PDFPageViewer`); grids of PDF assets use image covers, never server-side rasterising.
- **Outbound email** referencing an attachment must include the URL inline.
- **Extend, don't duplicate.** Search first; reuse/modify existing units. Don't create new files/components without checking `components/ui|composer|registry`. One concern per commit.
- **Capsule containment / capsule↔layout contract** (metaMe right pane): derivative content renders inside the originating capsule; `activeCapsuleId` + `activeLayoutId` move in lockstep (see CLAUDE.md).

---

## 7. Deploy & git flow (the mechanics)

```bash
git branch --show-current                 # confirm claude/<session-id>
# ... make changes, commit with a descriptive message ...
git fetch origin dev
git merge origin/dev -m "merge dev: sync before pushing <what changed>"
git push -u origin claude/<session-id>    # auto-merge → dev → Amplify
```
- Auto-merge requires `merge-claude-to-dev.yml` on `main`. If broken, push directly to dev after merging (`git push origin HEAD:dev`) with a descriptive `-m`.
- Confirm dev advanced with an `until` loop on `git rev-parse origin/dev`. Do not poll Amplify; it's not a GitHub Action.
- Avoid **doc-only** pushes (they still trigger a full build) — batch with code or register the doc in `collections.json` so it's a functional change.

---

## 8. Three workstreams — do not conflate

1. **AgentiQ Alpha** — platform build (current). `codexes/packs/agentiq/items/ALPHA_*.md`.
2. **Venture Lab α / AgentiQ Lab** — next-phase engine (metaMe/AgentiQ OS). Pack `alpha-knyt`; docs `docs/alpha/agentiq-knyt/`.
3. **KNYT Wheel** — marketing/ops activation campaign. `codexes/packs/knyt/`.

System model: **Aigent Z** (orchestrator) · **Aigent C** (customer guide) · **metaMe** (sovereign guardian) · per-cartridge leads. NBEPlan disposition = `ask | act | wait | escalate | deny`.

---

## 9. Sandbox / environment gotchas

- Outbound HTTPS blocked → QubeTalk `curl` fails; use the file bridge (`docs/qubetalk-bridge/outbox/` via `scripts/qubetalk_bridge/create_packet.py`, relayed by Lovable).
- GitHub only via `mcp__github__*` tools; repo scope is `iqube-protocol/aigentzbeta` (use `mcp__claude-code-remote__list_repos` / `add_repo` to work with others).
- Chromium + Playwright pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); never run `playwright install`.
- Worldcoin keys: four public app/action vars (server + `NEXT_PUBLIC_`) drive verification; `WORLD_DEVELOPER_API_KEY` is a separate MCP-only concern.
- Treasury: USDC plan payments fall back to `NEXT_PUBLIC_KNYT_TREASURY_ADDRESS` when `TREASURY_ADDRESS` is unset.

---

## 10. Where to look next

- `CLAUDE.md` — authoritative dev rules (read in full).
- `docs/platform-ontology.md` — canonical terms.
- `docs/agent-harness/*` — role hierarchy, NBE contract, DVN taxonomy, journey/studio schemas.
- `types/orchestration.ts`, `types/access.ts`, `types/studioArtifact.ts` — core contracts.
- `codexes/packs/agentiq/updates/` — dated session docs (this folder); newest = current state.
- `.claude/agents/` — specialist sub-agents (aigent-z-orchestrator, metame-guardian, ui-parity-reviewer, security-reviewer).
