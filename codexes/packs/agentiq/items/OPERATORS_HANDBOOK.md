# Aigent Z / iQube Protocol — Operator's Handbook v1

> **Status:** Living reference. **Last reviewed:** 2026-05-23.
> **Audience:** human operators and agents (Claude Code, Codex, Lovable).
> **Purpose:** canonical map of the system so any change can be reasoned about
> end-to-end — what it touches, what it might break, and where the privacy /
> security seams are.

When you introduce a new feature, walk this doc front to back asking three
questions:

1. **What surfaces does this touch?** (cartridge tabs, studio, registry,
   runtime, wallet, copilot)
2. **What identity tier am I exposing?** (T0 / T1 / T2 — see §2)
3. **What downstream consumers does it implicate?** (relationship builder,
   Marketa partner pipeline, DVN receipts, batch jobs, etc.)

If you can't answer all three with file paths, the change isn't ready.

---

## 1. System Model

### 1.1 Agent hierarchy

| Role | Agent | Responsibility | Files |
|---|---|---|---|
| Sovereign guardian | **metaMe** | Final policy veto; identity + data sovereignty | `services/identity/getActivePersona.ts`, `services/access/evaluateAccess.ts` |
| System orchestrator | **Aigent Z** | Routes interactions, enforces policy, selects NBE | `services/orchestration/*`, `app/api/assistant/*` |
| Customer guide | **Aigent C** | Faces the user; executes NBE dispositions | `components/metame/MetaMeRuntimeClient.tsx`, copilot bridges |
| Cartridge lead | per-cartridge | Domain logic inside the cartridge boundary | `app/triad/components/codex/tabs/*` |
| Specialists | Marketa, Quill, Kn0w1, Nakamoto | Domain experts invoked by Aigent C | `services/specialists/*`, `data/agentConfig.ts` |

### 1.2 Routing priority chain

1. metaMe guardian (policy veto)
2. Active cartridge lead agent
3. Aigent Z (system orchestrator)
4. Aigent C (default handler)

### 1.3 Journey stages

`prospect → acolyte → keta → keji → first → zero`
(+ investor / collector / creator variants)

### 1.4 Experience depth ladder

`L0 pill → L1 capsule → L2 mini_runtime → L3 codex` — one step at a time.

### 1.5 Q¢ pricing (PARAMOUNT)

`$1 = 100 Q¢`. One Q¢ is worth $0.01. Stored as integer cents in
`qc_balances.balance`; never floating-point. Full rules in CLAUDE.md.

### 1.6 Ledger model

- **DVN Q¢** — ICP-anchored on-chain ledger; the user's day-to-day
  settlement balance. Table: `qc_balances` (currency `base_qc`).
- **Mainnet Q¢** — EVM ERC20 (QCT) on Base / Base Sepolia. The underlying
  canonical asset; treasury holds float.
- **Mainnet ↔ DVN swap**: `/api/wallet/base-qc/swap-in` (user signs QCT
  transfer → DVN credit). USDC top-up: `/api/wallet/base-qc/credit-from-usdc`.
- **DVN → Mainnet**: deferred minting batch job (backlog —
  `codexes/packs/agentiq/updates/2026-05-22_qc-dvn-mainnet-parity-backlog.md`).

### 1.7 KNYT ledger

Same shape, separate currency. DVN KNYT (table: `knyt_balances`) vs Mainnet
KNYT (EVM ERC20). Minting modes: `immediate` | `deferred` | `canonical` |
`remote`. See `services/wallet/knyt/types.ts` and `services/rewards/rewardService.ts:300+`.

---

## 2. Identity & Access Spine (PARAMOUNT)

> Every backend touchpoint involving identity, asset correlation, content
> gating, or rewards **MUST** flow through the spine. Do not build parallel
> resolvers, parallel gates, or parallel decision logic.

### 2.1 Identifier tiers — never mix

| Tier | Lives | Examples | Allowed surface | NEVER in |
|---|---|---|---|---|
| **T0** server-internal | Lambda memory, DB keys | `personaId`, `authProfileId`, `rootDid`, `fioHandle` | server-side only | browser JSON, URLs, receipts, localStorage |
| **T1** browser-safe | same-origin shell | `personaSessionToken`, `displayLabel`, `cartridgeFlags`, **own** `fioHandle` | localStorage, postMessage, URL (same-origin) | cross-origin, public chains |
| **T2** public-network | DVN, ordinals | `cohortAliasCommitment`, `cohortId` | DVN receipts, on-chain | nothing (these ARE the public layer) |

### 2.2 Five fields that MUST NEVER appear in browser-bound JSON or chain-bound receipts

1. `personaId` — T0; server-internal key
2. `authProfileId` — T0; multi-email-merged caller id
3. `rootDid` — T0; compliance-bearing (`did:fio:*`, `did:iq:*`)
4. `kybeAttestation` — KYC layer; only via `discloseCredential()` scope
5. Cross-persona `fioHandle` — your own handle on T1 is OK; resolving someone else's is forbidden

Enforced by canary tests in `tests/persona-broadcast-handshake.test.ts` and
`tests/access-spine.test.ts`. Mirror this pattern in every new test suite
that touches identity.

### 2.3 Canonical spine files (DO NOT FORK)

| File | Role | Public exports |
|---|---|---|
| `services/identity/getActivePersona.ts` | Single resolver for active-persona context (T0) | `getActivePersona(request)` |
| `services/identity/personaSessionToken.ts` | HMAC-signed T1 envelope, 30-min TTL, origin-bound | `issuePersonaSessionToken`, `verifyPersonaSessionToken`, `readTokenFromRequest` |
| `services/access/evaluateAccess.ts` | Single gate for read/write/mint/transfer/disclosure | `evaluateAccess(ctx, descriptor, action)` |
| `services/access/policyResolvers.ts` | Per-action receipt-mode + credential classification | `resolveReceiptMode`, `credentialMatchesCartridgeFlag`, etc. |
| `services/content/getContentDescriptor.ts` | Identity-agnostic descriptor from DB rows | `getContentDescriptor(assetId)`, `getContentDescriptorByCid(cid)` |
| `services/content/encryption.ts` | AES-256-GCM with per-asset HKDF key derivation | `deriveAssetKey`, `encryptBuffer`, `decryptBuffer` |
| `services/content/stateCDelivery.ts` | Decrypt + stream state-C content; no raw URL exposure | `streamStateCPlaintext`, `findStateCRowByUrl` |
| `types/access.ts` | Canonical type contract — ActivePersonaContext, AccessDecision, etc. | type definitions only |

Modifying any of these requires explicit operator approval. Extend by
composition only.

### 2.4 Resolver chain (`getActivePersona`)

1. **personaSessionToken** (PST) — preferred (T1)
2. **`x-persona-id` header** — existing convention
3. **`?personaId=` URL param** — legacy
4. **`crm_auth_profiles.default_persona_id`** — explicit per-profile default
   (added 2026-05-23; resolves brand-new-user devagent fallback)
5. **First owned by `created_at` ASC** — deterministic last-resort

### 2.5 `/api/wallet/active-persona` — T1 surface

`GET` returns the canonical browser-safe envelope. Strips every T0 field.
Returns:

```json
{
  "personaSessionToken": "<HMAC envelope>",
  "identifiability": "semi_anonymous | semi_identifiable | identifiable | anonymous",
  "cartridgeFlags": { "isAdmin": false, "isPartner": false },
  "cohortMemberships": ["default"],
  "sessionExpiresAt": "ISO",
  "displayLabel": "Work",
  "ownFioHandle": "user.fio"
}
```

**Every browser-side consumer reads from this endpoint.** Never from
`personas` directly.

### 2.6 Gated content rules (PARAMOUNT)

Purchased / entitled content is confidential. The underlying file URL and
bytes never reach the OS or browser outside the app's own viewers.

- **No `target="_blank"`** on gated PDF / video anchors
- **No raw Supabase Storage URLs in the browser** for gated content — proxy
  via `/api/content/pdf/[cid]` / `/api/content/video/[cid]`
- **No `window.open()`** on gated file URLs
- **PDF viewer split:**
  - `PDFLiteReaderModal` for `pdf_lite_url` (direct Supabase, free / public)
  - `PDFPageViewer` for Autonomys `pdf_cid` (avoids Lambda 6MB ceiling)
  - **Never** use the full-PDF proxy as a viewer source for Autonomys CIDs

### 2.7 Smoke test gate

Before merging spine-touching work:
```
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<persona> --owned=<asset-owned> --txGuard=<asset-id>
```

---

## 3. Cartridges Inventory

> Cartridge config of record: `data/codex-configs.ts`.
> Tab components under `app/triad/components/codex/tabs/`.
> Pack content (markdown + collections): `codexes/packs/<pack>/`.

### 3.1 metaMe Cartridge (`metame-codex`)

Personal sovereignty surface. Hosts aigentMe, myCanvas, the Order activations,
the metaMe Studio entry, and admin sub-tabs.

| Tab | Component | Gate | Role | Touches |
|---|---|---|---|---|
| aigentMe | `AigentMeWelcomeSplitTab` | — | Personal assistant — split copilot/right-pane | NBE, brief, venture-progress, artifacts, Google connectors |
| Strategy | `MetaMeStrategyTab` | — | Inferred posture + ExperienceModel editor | `experience-model`, `inferred-strategy`, partners + KPIs editors |
| Experience Matrix | `PersonalExperienceMatrixTab` | — | Sphere × Maturity matrix | ExperienceMatrix table |
| Alignment Helper | `ExperienceAlignmentTab` | — | Personal-layer alignment guide | ExperienceGuide |
| Status | `MetaMeStatusTab` | — | Operational status + risks | DVN receipts |
| NBE | `MetaMeNbeTab` | — | Ranked next-best actions across cartridges | `/api/assistant/move-forward` |
| Analysis | `MetaMeAnalysisTab` | — | Pattern analysis | activity log |
| Activations | `ActivationsTab` | — | Toggle cartridge activations | `cartridge_activations` |
| myCanvas | `MyCanvasTab` | activationId | Personal publishing (notes, exQube origins/derived) | `mycanvas_entries`, social sharing, invites |
| Order of Metayé | (KNYT sub-tabs mirrored) | activationId | KNYT Order mirrored in metaMe | KNYT cartridge surfaces |
| Venture Lab | `VentureLabGrowthMatrixTab`, `RelationshipBuilderTab` | — | Venture Lab α surfaces | partners, growth matrix |
| Marketa | `MarketaMyCampaignTab`, `MarketaProposeTab`, `MarketaMyPacksTab`, `MarketaMyReportsTab`, `MarketaQubeTalk` | — | Campaign authoring + reports | Marketa partner pipeline |
| metaMe Studio | `MetaMeStudioTab` | — | Composer entry | studio composer |
| AgentiQ OS | (multiple) | activationId | OS surface | agentiq-os pack |
| Qriptopia | (Qriptopia tab) | activationId | Qriptopian world surface | qripto-codex |

**Privacy seams:** the cartridge-header Welcome badge reads `displayLabel` /
`ownFioHandle` only (T1). Never render UUIDs.

### 3.2 KNYT Cartridge (`knyt-codex`)

KNYT product surface — episodes, characters, store, Order, runtime, admin.

Tab groups: **Codex** (Scrolls, Characters, Lore, Terra, Living Canon,
Community), **Store** (Episodes, Cards, Bundles, Investor), **Order**
(Order, Treasury, Runtime, Shelf, Investor, Quests), **Admin** (Store,
Treasury, Community Content, Tasks/Rewards, Codex, Investments,
KNYT Wheel, Experience Dashboard, Investors, Outreach), **Docs**.

Admin-gated tabs: `KnytStoreAdminTab`, `KnytTreasuryAdminTab`,
`KnytCommunityContentAdminTab`, `KnytTasksRewardsAdminTab`, `KnytCodexAdminTab`,
`KnytInvestmentsAdminTab`, `KnytAlphaTab`, `AigentMissionsBoardTab` (KNYT
Wheel), `ExperienceDashboardTab`, `InvestorDirectoryTab`, `RelationshipBuilderTab`.

`KnytInvestorDashboardTab` is `investorOnly`.

**Cross-cartridge implications:**
- KNYT Cards purchase → Marketa activation (partner attribution)
- KNYT episode unlock → DVN KNYT credit + EVM mint mode per SKU config
  (`/api/admin/knyt/sku-config`)
- KNYT Wheel campaign → CRM cohort assignment, Mailjet sends
- Community Content (community articles) → publish path through
  `/api/community-content/publish` → optionally promoted to runtime

### 3.3 Qriptopian Cartridge (`qripto-codex`)

Storyworld surface — features, scrolls, knowdz, penny drops, KNYT-cross
content via Terra.

Tab components: `FeaturesTab`, `QriptoScrollsTab`, `Kn0wdZTab`,
`PennyDropsTab`, `QriptoLiquidCodexTab`, plus `KnytCommunityContentTab` for
community-remixed posts.

**Note:** no `collections.json` of its own — content lives in the
`qriptopian` pack but the cartridge composes external sources.

### 3.4 AgentiQ Cartridge (`agentiq`) — admin engineering KB

Single-purpose: the engineering knowledge base for Aigent Z. Tab structure
mirrors collections:

| Tab | Pack | Purpose |
|---|---|---|
| Start | `aigency/col_start_here` | Orientation |
| Architecture | `aigency/col_architecture` | System architecture |
| Codebase | `aigency/col_codebase` | Repo map, conventions |
| Knowledge | `aigency/col_knowledge` | API reference, schemas |
| Decisions | `aigency/col_decisions` | Decision briefs |
| Changelog | `aigency/col_changelog` | Release history |
| PR Briefs | `aigency/col_pr_briefs` | PR summaries |
| Recent Commits | `aigency/col_recent_commits` | Latest commits |
| **Venture Lab α** | `alpha-knyt/col_venture_lab` | Phase 2 build plan (23 docs) |
| Alpha Program | `agentiq/col_alpha_program` | Platform launch programme |
| AgentiQ OS | live | Builder dashboard |
| Updates | `agentiq/col_updates` | Session updates |
| Retrieval Index | `agentiq/col_retrieval_index` | Index schema |
| Factory Intake | live | Registry intake stage |
| Registry Supply | live | Registry browse by trust |
| **Operators Manual** | `agentiq/col_operators` | This handbook + trust scoring |

**All tabs `adminOnly`.**

### 3.5 AgentiQ OS Cartridge (`agentiq-os-cartridge`) — developer entry

Public-facing developer surface. Sub-groups: Home, Docs (KB, SDK, SmartTriad,
Liquid UI, Runtime ref, Studio ref, Aigent ref), Build (Persona, Delegation,
Ingestion Factory, Build Dashboard, NanOS), Bind (Codex), Deploy
(Updates), Missions (Dev Missions, KNYT Missions reference), Community.

### 3.6 Other cartridges

- **`marketa-codex`** — Marketa Console (partner activations, campaigns)
- **`moneypenny-codex`** — Treasury / settlement console
- **`nakamoto-codex`** — Blockchain expertise / Aigent Nakamoto
- **`aigency`** — Aigent Z's own KB (the pack, not the tab cartridge)
- **`alpha-knyt`** — Venture Lab α planning pack (read-through to AgentiQ Venture Lab α tab)

---

## 4. Studio Composer

File: `components/composer/ComposerStudio.tsx`. Single canonical authoring
surface for experiences.

### 4.1 Top-level tabs

| Tab value | Role | Writes to |
|---|---|---|
| `template` | Bundle template selection | (in-memory only until applied) |
| `customizer` | ExperienceQube editor | `experiences` table |
| `resources` | Assets + style guides | embedded in experience record |
| `exqubes` | Experience catalogue browser | reads `experiences` |

### 4.2 Customizer sub-tabs (parity panel)

Mounted when an experience is selected: `experience` (strategy / model /
matrix / ladder / journey / NBE / analysis), `design` (style-guides /
parity), `workflows`, `surfaces`, `pipeline`, `receipts`.

### 4.3 Publish path

1. Experience saved to `experiences` table on Customizer save.
2. `recordExperienceLifecycle('experience_launch', exp, 'studio-launch')`
   fires.
3. `POST /api/registry/publish` creates a `studio_artifacts` row with
   `source_surface: 'studio-publish'`, `status: 'approved'`,
   `codex_entry_ids: [experienceId]`.
4. `runtimeProjection` is copied into the `runtime_publication` field.
5. The runtime capsule list re-renders via
   `listPublishedRuntimeCapsuleRecords()` filtered by active persona.

### 4.4 Save-to-myCanvas (2026-05-23)

Each ExperienceQube card on the `exqubes` tab now has a "Save to myCanvas"
button → POST `/api/mycanvas/entries` with `entryType: 'experience_origin'`.

---

## 5. Registry

Files: `app/api/registry/*`, `types/registryIngestion.ts`,
`components/registry/`.

### 5.1 Main iQube classes

`ToolQube` · `SkillQube` · `WorkflowQube` · `ConnectorQube` · `DataQube` ·
`IntakeQube` (inbound submissions).

### 5.2 Ownership + visibility

- `created_by` (persona id) + `tenantId` scoping
- `visibility: 'public' | 'private'`
- `policyClass` governs RLS
- **Persona resolution goes through the spine** — `getActivePersona(request)`.
  Never re-implement.

### 5.3 Mint vs Publish

| Operation | Today | Plan |
|---|---|---|
| **Publish** | `POST /api/registry/publish` creates `studio_artifacts` row, status `approved`, no chain | Eventual DVN receipt + ICP anchor |
| **Mint** | Stub (`chain_mint: null`) | EVM/ICP mint for `canonical` issuance mode |

---

## 6. Runtime

Files: `components/metame/MetaMeRuntimeClient.tsx`,
`app/api/aa/v1/runtime/_lib/runtimeShell.ts`.

### 6.1 Compass menu (BE / EARN / PLAY / MAKE / SHARE)

Five top-level intents, all returned by `GET /api/aa/v1/runtime/shell`.
Each carries a `trigger.prompt` that the copilot routes.

### 6.2 Quick links

- `quick-watch` / `quick-listen` / `quick-read` — content modality entries
- `quick-find` — open-ended search
- `quick-share` — share-capable surfaces
- Floating: `quick-refresh`, `quick-reset`, `quick-preview-toggle`

### 6.3 Capsules

`RuntimeCapsuleRecord` — what the runtime renders.

```typescript
{
  id, sourceType, title, description,
  heroAsset, thumbnailAsset,
  metadata: { tenantId, codexId, durationMinutes, contentKind },
  launchTarget: { type, href },
}
```

Listed via `listPublishedRuntimeCapsuleRecords()`, persona-scoped.

### 6.4 Iframe bridge message types

Inbound on `MetaMeRuntimeClient.tsx`:

`SHELL_READY`, `HANDOFF`, `CONTEXT_UPDATE`, `DEVICE_CONTEXT_UPDATE`,
`SELECTOR_CHANGE`, `MENU_ACTION`, `PROMPT_SUBMIT`, `RUNTIME_CONTEXT_CHANGE`,
`LAUNCH_CARTRIDGE`, `RESET_WELCOME`, `aa-persona-change-v1`.

### 6.5 DRAWER_ACTION_HANDLERS

Drawers / surfaces opened by `MENU_ACTION { action_id }`:

`wallet`, `settings`, `connections`, `memory`, `identity`, `persona`,
`make-create-design`, `make-build`, `make-remix`, `play-knyt`, `share`,
`invite`, `share-refer`, `close_codex`.

Adding a new action: register the handler, mount any modal it opens in
`MetaMeRuntimeClient`, and have the thin-client (Lovable) dispatch with the
matching `action_id`.

---

## 7. Orchestration Types

File: `types/orchestration.ts`, `types/studioArtifact.ts`.

### 7.1 NBE dispositions (5)

`ask` · `act` · `wait` · `escalate` · `deny`

Every NBE plan carries a disposition. The chip on the left pane interprets
it: `act` fires immediately, `ask` waits for explicit user input, `wait`
queues silently, `escalate` hands off to a specialist, `deny` is
policy-blocked.

### 7.2 StudioArtifact

Canonical handoff format for Studio → Codex → Runtime closed loop.
Includes `target_surfaces`, `journey_segments_affected`,
`ui_surfaces_affected`, `state_changes`, `proof_requirements`,
`acceptance_checks`, `follow_up_tasks`, `validation_status`,
`rollback_available`, `dvn_receipt_ids`.

When you ship something that crosses surfaces, **emit a StudioArtifact** —
it's the audit + rollback breadcrumb.

---

## 8. Privacy & Security Posture

### 8.1 Posture

Privacy-first, encryption-first, minimum-disclosure. Every change is
evaluated against the five forbidden fields (§2.2) and the gated-content
rules (§2.6).

### 8.2 Access gate inventory

Never remove these without explicit admin consent (CLAUDE.md PARAMOUNT):

- `adminOnly` / `partnerOnly` / `investorOnly` flags on codex tabs
- Role checks (`isAdmin`, `isSuperAdmin`)
- Supabase RLS policies
- API route auth middleware
- Feature flags gating sensitive functionality

### 8.3 Confidentiality classes for content

`A` public · `B` member-gated · `C` paid / encrypted · `D` invite-only ·
`E` confidential / partner. State-C content always streams through
`stateCDelivery.streamStateCPlaintext` — never via raw URL.

### 8.4 Receipt taxonomy

DVN receipts are **T2** — only `cohortAliasCommitment` / `cohortId` may
appear. Never `personaId`, never `fioHandle`. Use
`emitReceiptSilent({ actorId: personaId })` only because that's a
server-internal call; the receipt body itself must be alias-only.

### 8.5 Test canaries

- `tests/persona-broadcast-handshake.test.ts` — T0 leak in postMessage
- `tests/access-spine.test.ts` — T0 leak in JSON responses

Both run on every PR. Adding a new identity-touching route → mirror the
canary pattern in the route's test file.

---

## 8a. Design Fidelity Posture (PARAMOUNT)

Design fidelity is a first-class invariant — same status as security and
privacy. Symmetry, simplicity, and elegance are not aesthetic
preferences; they are the difference between users walking in and users
walking away. A change that breaks visual rhythm fails review regardless
of how correct the code is.

### 8a.1 The four-axis test

Every UI change passes only if it holds on all four:

1. **Symmetry** — left/right balance, header/footer balance, button
   pairs aligned, control clusters mirrored. Off-axis elements break
   the eye's resting line.
2. **Rhythm** — consistent spacing scale (4 px grid; tokens below).
   Cards, sections, modal padding all snap to the same intervals.
3. **Hierarchy** — one primary action per surface, exactly. Secondary
   actions secondary. Tertiary muted. Never three buttons fighting for
   the same emphasis.
4. **Restraint** — every element earns its place. Add nothing
   speculatively. Five carefully placed affordances beat fifteen
   crowded ones.

### 8a.2 Canonical tokens (do not invent new ones)

| Token | Value | Source |
|---|---|---|
| Spacing grid | 4 px (Tailwind default scale: 1=4, 2=8, 3=12, 4=16, 5=20, 6=24) | tailwind.config.js |
| Border radius | sm=4 px, md=8 px, lg=12 px (`var(--radius)`), xl=16 px | app/globals.css `--radius: 0.5rem` |
| Modal width | sm=400 / md=600 / lg=800 / xl=1000 (px) | metaproof-core.md §8 |
| Breakpoints | sm=640, md=768, lg=1024, xl=1280, 2xl=1536 | Tailwind defaults |
| Typography | base=14 px, ratio 1.25 | globals.css |
| Surface bg (dark) | `bg-slate-900/40` to `bg-slate-900/60` | composer + cards |
| Border (dark) | `border-slate-700/60` | composer + cards |
| Accent (primary) | violet — `text-violet-300`, `bg-violet-500/10`, `border-violet-500/40` | aigentMe |
| Accent (KNYT) | emerald — `text-emerald-300`, `bg-emerald-500/10` | KNYT cartridge |
| Accent (warning) | amber — `text-amber-300`, `border-amber-500/40` | blockers, payment |
| Accent (error) | rose — `text-rose-300`, `border-rose-500/30` | error states |
| Muted text | `text-slate-400` (dark), `text-slate-600` (light) | universal |

**No raw hex in components.** If you reach for `#1a2a3c`, stop and use a
token. New tokens are added to globals.css + tailwind.config.js with
explicit operator approval.

### 8a.3 Composition rules

- **One primary CTA per pane.** If a layout needs two equally weighted
  actions, redesign — they're not equally weighted.
- **Pair buttons symmetrically.** Cancel/Confirm always right-aligned;
  primary on the right, secondary on the left (or vice versa
  cartridge-wide — pick one and hold).
- **Close affordances are tertiary.** Top-right X with muted hover.
  Never a "Close" button that competes with primary actions.
- **No piling.** Stacks of cards in a single column accumulate visual
  debt. If a layout needs more than 3–4 cards simultaneously, it's the
  wrong layout — split into a different right-pane intent (Phase 2
  pattern).
- **Loading states match the resting state.** Skeletons preserve the
  same dimensions and shape as the loaded content. No content jump.
- **Empty states are designed, not stubbed.** "No goals yet — add your
  first below" is a deliberate sentence with deliberate placement, not
  an afterthought.
- **Animation is restraint.** Fades and slides only at 150–200ms;
  spinners only on actions >300ms. Never animate decoration.

### 8a.4 Symmetry contract (right-pane specifically)

For every aigentMe right-pane layout (Phase 2):

- Header strip = ≤56 px, one icon-left / title-center / actions-right
  pattern.
- Body padding = `p-5 lg:p-6` (20/24 px). Same on every layout.
- Footer (if present) = `p-3 lg:p-4` (12/16 px), right-aligned actions,
  never split across edges.
- Outer radius = `rounded-2xl` (16 px) on cards; `rounded-lg` (8 px) on
  sub-cards. Never mix radii within a card.
- Dismiss control (top-right X) sits at the same coordinate on every
  layout — 6×6 button, `right-3 top-3` from the card edge.

### 8a.5 Review checklist (before any UI PR)

- [ ] No raw hex; only design tokens / Tailwind classes from the table above.
- [ ] Spacing snaps to the 4 px grid.
- [ ] Border radii consistent within the surface.
- [ ] One primary CTA on the pane / card.
- [ ] Loading state preserves layout dimensions.
- [ ] Empty state written, not stubbed.
- [ ] Dismiss / close affordance follows the symmetry contract.
- [ ] Component is reused (`CodexActionRow`, `IQubeCard`, `FilterSection`,
      `ViewModeToggle`, `ConfirmDialog`) — not re-implemented.
- [ ] iOS / mobile rendered (no `hidden md:*` on first-class
      affordances unless explicitly designed to be desktop-only).
- [ ] Theme honored (dark/light variant for every new component).

When in doubt, defer to the existing reference patterns
(`BriefCard`, `VentureProgressCard`, `RemixDialog`, `ExperienceGoalsEditor`)
and ask if a change extends or breaks them.

The `ui-parity-reviewer` subagent (`.claude/agents/ui-parity-reviewer.md`)
runs this checklist on demand.

---

## 9. Change Impact Checklist

Use this before opening a PR.

### 9.1 Identity / persona changes

- [ ] Does this touch `getActivePersona` or any file in §2.3? → Operator
      approval required.
- [ ] Am I exposing a T0 field in JSON / URL / postMessage? → Strip it.
- [ ] Did I read persona from spine (`useActivePersona` / `getActivePersona`)
      or invent a parallel resolver? → Use the spine.
- [ ] Did I add a new T1 surface? → Strip to canonical envelope.

### 9.2 Content changes

- [ ] Is the content gated? → Stream through `/api/content/...` proxy, no
      `target="_blank"`, no raw URL in browser.
- [ ] Did I pick the right PDF viewer? `pdf_lite_url` → `PDFLiteReaderModal`;
      `pdf_cid` only → `PDFPageViewer`.
- [ ] Will my list endpoint return base64 image bytes? → Strip them; upload
      to Supabase Storage and return the HTTPS URL
      (`/api/community-content/generate` shows the pattern).

### 9.3 Payment changes

- [ ] Am I treating Q¢ as cents (integer) or dollars? → Cents. `qc / 100 = USD`.
- [ ] Did I update both DVN and Mainnet ledger paths? → Single
      settlement, dual write via `attemptCustodialSettlement`.
- [ ] Does my refund path use the **creator's** persona (for content) or
      the **caller's**? → Creator for content, caller for own ledger
      operations.

### 9.4 Cartridge / tab additions

- [ ] Registered in `data/codex-configs.ts`?
- [ ] Pack file under `codexes/packs/<pack>/`?
- [ ] Gates declared (`adminOnly`, `partnerOnly`, `activationId`)?
- [ ] Cross-cartridge links use `buildCodexUrl()` with `personaId`?
- [ ] Welcome badge / persona context wired (no UUIDs rendered)?

### 9.5 Smart actions on content thumbnails

- [ ] Using `CodexActionRow`?
- [ ] Auto-dedup: Watch + View on same content collapses (handled by row);
      pass `showView={true}` explicitly only when View shows different
      content.
- [ ] Share + Invite: pass `onShare` / `onInvite` (defaults to true when
      handler is provided).
- [ ] Listen: pass `showListen + getListenText` for TTS.

### 9.6 Cross-system propagation (THIS IS THE COMMON MISS)

When the user declares something in one cartridge, ask: where else does it
need to live?

| Declaration | Downstream consumers to check |
|---|---|
| Priority partner (`blak.priorityPartners`) | Relationship Builder, Marketa partner pipeline, CRM `crm_investors` |
| Active KPI (`blak.activeKpis`) | Venture progress, brief, NBE rerank |
| ExperienceGoal | Brief, NBE rerank, strategy inference keyword pool |
| Cartridge activation toggle | Tab visibility, runtime capsule list, copilot context |
| Persona switch | Wallet drawer, copilot, runtime, every cartridge tab |
| Q¢ debit | DVN balance, qc_transactions ledger, persona spend cap |
| KNYT reward | DVN KNYT, EVM mint if canonical, CRM reward record, repuation event |
| Content publish | Registry, runtime capsule list, codex feed, social-share analytics |
| Invite (myCanvas) | Invite table, recipient persona's pending list, future notifications |

When in doubt, the right move is to surface a chip on the left pane:
"Add this to Relationship Builder too?" — let the spine propagate.

### 9.7 Receipts / audit

- [ ] Receipt body uses T2 aliases only?
- [ ] StudioArtifact emitted for cross-surface change?
- [ ] Rollback path defined (or `rollback_available: false` with reason)?

### 9.8 Tests

- [ ] T0 canary test added if route returns identity?
- [ ] Spine smoke (`scripts/verify-spine.mjs`) green?

---

## 10. Pointers for future expansion

This handbook is a v1 baseline. Areas where it'll need to deepen as we
build:

- **Per-cartridge integration matrix** — for each cartridge, the explicit
  write-paths into other cartridges (Marketa partner pipeline, KNYT
  campaign cohorts, etc.). Today this is "ask Aigent Z"; should be a
  table.
- **Phase-2 layout registry** (aigentMe right-pane layouts) — when shipped,
  document each layout: which data hooks it owns, what chip dispositions
  mount it, what unmount behaviour clears.
- **Marketa activation events** — the canonical list of "this happened →
  Marketa should know" triggers.
- **Receipt schema per intent** — for each `x402` intent, the exact T2
  fields that appear in the chain receipt.
- **Operator playbooks** — for common ops (rotate keys, re-anchor DVN
  batch, force-promote a community post, drain a stuck claim).

When a section of this doc goes stale or wrong, **fix it in the same
commit** that broke it. The handbook is a living artifact; out-of-date
docs are worse than no docs.

---

## Reference index (file paths)

- `CLAUDE.md` — repo dev rules
- `data/codex-configs.ts` — cartridge / tab registry
- `services/identity/getActivePersona.ts` — persona resolver
- `services/access/evaluateAccess.ts` — access gate
- `services/content/stateCDelivery.ts` — encrypted content streamer
- `types/access.ts` — canonical type contract
- `types/orchestration.ts` — NBE plan + StudioArtifact
- `components/composer/ComposerStudio.tsx` — Studio
- `components/metame/MetaMeRuntimeClient.tsx` — runtime shell
- `app/triad/components/codex/tabs/` — all cartridge tabs
- `app/triad/components/codex/CodexActionRow.tsx` — smart-action row (Watch/Read/View/Share/Invite/Listen)
- `scripts/verify-spine.mjs` — pre-merge smoke
- `codexes/packs/agentiq/updates/2026-05-22_qc-dvn-mainnet-parity-backlog.md` — DVN/Mainnet plan
