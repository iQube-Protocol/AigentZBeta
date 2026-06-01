# myCartridge PRD — Draft v0.1

**Date:** 2026-06-01
**Status:** Draft for review — pre-implementation
**Owner:** dele@metame.com
**Sibling rails:** myWorkspace · myCanvas · myLedger · myCluster · myCartridge
**Companion wizards:** myExperienceModel · myExperienceGuide · myCartridge (new)
**Schema:** ventureQube v0.3 → v0.4 (extension proposed below)

> **Anchor framing.** myWorkspace is where the user works. myCanvas is where the user creates. myLedger is where the user verifies. myCartridge is where the user engages. myCluster is where the user organizes what they own.

---

## 1. Executive Summary

myCartridge is the final user-facing rail in the metaMe / aigentMe alpha. It gives every metaMe user their own configurable engagement estate — a domain surface where they can publish a Codex, activate a cartridge co-pilot, set public/private/member boundaries, integrate wallet primitives, and let aigentMe operate the community, venture, project, or knowledge domain they are building.

The existing **Codex Manager** at `app/(shell)/admin/codex/` is the closest thing the platform has today to a cartridge administration surface. It is admin-only, system-cartridge-focused, and assumes a small fixed set of hand-curated cartridges (KNYT, Qriptopian, metaMe, AgentiQ OS, Venture Lab). The PRD rebrands and generalizes it to **myCartridge and Codex Manager** — a single surface with two tiers (operator-tier for the user's own cartridge, admin/super-admin tier for platform cartridges) — so that every metaMe user can spin up, configure, and operate a cartridge from inside their own runtime.

Alongside myCartridge, this PRD introduces:

- **myCluster** — the rebranded TabGroup (currently `myArtifacts` at `data/codex-configs.ts:2290`) that holds myCanvas, myWorkspace, myLedger, and the new myCartridge sub-tab. The rebrand is a one-line group rename + three sub-tab `group:` updates + adding the fourth sub-tab. See §6.
- **ventureQube v0.4** — schema extension that adds a first-class `myCartridge` configuration block so the user's intent ("this is what I want my cartridge to be") becomes durable, validatable, and consumable by aigentMe and specialists. See §27.
- **CartridgeSetupWizard** — a third wizard, mounted in `AigentMeWelcomeTab` alongside `ExperienceModelSetupWizard` and `PersonalGuideSetupWizard`, that walks the user through cartridge identity, purpose, tabs, audience, wallet primitives, and active tab selection. See §28.
- **Active Surface Approval gate** — a metaMe-side approval flow for promoting a user's myCartridge active tab into the platform-wide Activation Catalogue. Extends the existing `admin-access-requests` sub-tab pattern in the metaMe Admin group with a new `admin-active-surface-approvals` sub-tab. See §21a.

The MVP reuses ~80% of existing primitives (Codex Manager, CodexConfig/CodexTab, SmartWalletDrawer, CodexCopilotLayer, Activations Catalogue, specialistRouter, ExperienceQube wizards). The net-new work is the wizard surface, the operator-tier UI on the Codex Manager, the v0.4 schema field, the `primaryTabSlug` concept, and the persistence wiring through ExperienceQube and ventureQube.

---

## 2. Product Context

**Framework:** metaMe is the user's personal operating environment. aigentMe is the user's personal regent. Around them, five rails:

| Rail | Role | Existing surface |
|---|---|---|
| **myWorkspace** | Private work, intents, drafts, uploads, cohorts | `MyWorkspaceTab.tsx` (live) |
| **myCanvas** | Creation, remix, publish | `MyCanvasTab.tsx` (live) |
| **myLedger** | DVN-receipted state changes, audit ledger | `MyLedgerTab.tsx` (live) |
| **myCartridge** | Owned engagement estate (this PRD) | New — generalized Codex Manager |
| **myCluster** | Organizing layer for what the user owns | New — replaces myArtifacts naming |

A **cartridge** is not a content container — it is a domain-specific engagement surface. A user may want one as a venture, community, creative universe, knowledge estate, franchise surface, professional domain, learning cohort, partner portal, or private inner-circle room. The same primitive must support all of these without forking.

**Permission boundary is at the tab level, not the cartridge level.** Cartridge X may have a public Pulse tab, a member-only Community tab, an admin-only Settings tab, an invite-only inner-room tab, and a token-gated content tab — all in one cartridge config.

---

## 3. Current Codebase Findings

### 3.1 Codex Manager (`app/(shell)/admin/codex/`)
- Admin list: `app/(shell)/admin/codex/page.tsx` — list all codexes, toggle enabled flag, filter.
- Detail editor: `app/(shell)/admin/codex/[codexId]/page.tsx` — rename/description/enable; reorder tabs via `/api/codex/registry/{codexId}/tabs/reorder`.
- Create scaffold (empty stub): `app/(shell)/admin/codex/new/page.tsx`.
- API: `app/api/codex/registry/route.ts` (GET list, POST create — minimal), `app/api/codex/registry/[codexId]/route.ts` (GET detail, PATCH update), plus admin upload/status routes under `app/api/admin/codex/`.
- DB: `supabase/migrations/20250101_codex_registry.sql` defines `codex_configs` + `codex_tabs` with RLS.
- **No user-facing creation flow exists today.** All cartridges are system-defined.

### 3.2 Cartridge data model
- Types: `types/codex.ts` (lines 71–137) defines `CodexConfig` and `CodexTab`.
- Hand-curated source: `data/codex-configs.ts` — `KNYT_CODEX` (line 293), `QRIPTO_CODEX` (line 870), `METAME_CODEX`, `VENTURE_LAB_CODEX` (line 2035), `CODEX_DEFINITIONS` array (line 3308).
- Pack-loaded source: `app/api/codex/registry/_lib/packRegistry.ts` reads `codexes/packs/{slug}/meta.json`.
- Per CLAUDE.md: hand-curated id ends in `-cartridge`; pack-generated ends in `-codex`. Hand-curated wins for inter-cartridge nav.
- CodexConfig carries: `id`, `slug`, `name`, `description`, `owner`, `enabled`, `version`, `tabs[]`, `tabGroups[]`, `permissions{view,edit,admin}`, optional `liquidUI`, optional `runtimeTakeover`.
- CodexTab carries: `id`, `label`, `slug`, `enabled`, `type` ('static'|'dynamic'|'liquid-ui'), `config`, `adminOnly`, `partnerOnly`, `investorOnly`, `adminOfCartridge`, `activationId`, `group`, `subTabs`.

### 3.3 Permissions
- Resolved server-side via the identity spine (`services/access/cartridgeAdminGrants.ts`, `services/identity/getActivePersona.ts`).
- `persona.cartridgeFlags.isAdmin` (global), `persona.cartridgeFlags.adminCartridges: string[]` (per-cartridge slugs).
- Only **admin or public** roles exist today — no per-cartridge member/contributor/editor/viewer model.

### 3.4 Reference cartridges
- **KNYT** (`KNYT_CODEX`, slug `knyt-codex`, owner `aigent-kn0w1`): Order tab is active tab. Dual progression axes (patronage_stage + pcs_stage). $KNYT token. Living Canon (canon/community/correspondent branches). `KNYT_RUNTIME_TAKEOVER` at line 45.
- **Qriptopian** (`QRIPTO_CODEX`, slug `qripto`, owner `qriptopian`): Qriptopia tab group is active tab. Single journey axis. QC token. Pulse pattern via `QriptoPulseTab` thin-wrapping `KnytCommunityContentTab` with `cartridge="qripto"`. Three-pill canon/community/correspondent in `QriptoCommunityCorrespondentTab`.
- **Venture Lab α** (`VENTURE_LAB_CODEX`, slug `venture-lab`, internal id `alpha-knyt-codex`, owner `aigent-z`): AlphaProgrammeTab (active tab, all `adminOnly`). Six-workstream hardcoded dashboard, doc 33 reference, trust/receipt posture model. **Extraction challenge:** tight coupling — needs parametrization for other ventures.

### 3.5 Smart Triad
- `app/components/content/SmartTriadProvider.tsx` coordinates SmartContent + SmartWallet + SmartMenu.
- `app/components/codex/CodexCopilotLayer.tsx` is the embedded copilot drawer (`personaId`, `contextId`, `getChatRequestContext()`).
- Chat backend: `app/api/codex/chat/route.ts` — accepts `domain: ContentDomain` (`metaKnyts | qriptopian | protocol`), runs `embeddingService.hybridSearch(query, domain)` for KB hits.
- **Gap:** no `cartridgeSlug` parameter on the chat route — KB is domain-scoped, not cartridge-scoped. A new myCartridge can't get cartridge-scoped KB hits without backend extension.

### 3.6 Active Tab & Activation Catalogue
- **Active Tab:** no explicit `activeTabSlug` / `primaryTabSlug` field exists. `getEnabledTabs()` in `app/hooks/useCodexConfig.ts:144–177` returns first enabled tab. `CodexPanelDynamic` (`app/triad/components/CodexPanelDynamic.tsx:149–243`) resolves default tab from this.
- **Activation Catalogue:** lives at `data/activation-catalog.ts` (static array of 10+ entries). Provider: `services/activations/ActivationsContext.tsx`. UI: `app/triad/components/codex/tabs/ActivationsTab.tsx`. Each `ActivationCatalogEntry` = `{id, tabSlug, sourceCartridge, mode, metrics, actions}`. API: `/api/assistant/activations`. Backed by `persona_activations` table (implied — contract opaque).
- **Gap:** no UI to author a new activation; adding one requires editing `data/activation-catalog.ts` and shipping code.

### 3.7 Smart Wallet
- `app/components/content/SmartWalletDrawer.tsx` (line 1–4378) — primary surface, accepts `cartridgeSlug` prop, per-cartridge persona defaults (`getCartridgeDefault` / `setCartridgeDefault`).
- Tokens supported: KNYT (EVM, DVN), Q¢/QCT (Ethereum, Arbitrum, Base, Optimism, Polygon, Solana, Bitcoin), USDC.
- `TransactionModal` (`app/components/wallet/TransactionModal.tsx`) — generic send/receive/verify, multi-chain.
- Pricing: `app/services/token/pricingService.ts` — singleton with `convertFromKnyt/Qcent/Usdc`. Per CLAUDE.md: `qcent` return values are USD-equivalent here, not cents — propagation hazard.

### 3.8 Specialists
- Canonical list: `services/agents/specialistRouter.ts` — `SpecialistId = 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto' | 'moneypenny' | 'metaye'`.
- `SpecialistContext.activeCartridge` field already exists — specialist responses can be scoped per cartridge.
- **Gap:** no per-cartridge specialist whitelist or capability matrix.

### 3.9 myCanvas / myWorkspace / myLedger / myArtifacts
- `MyCanvasTab.tsx` (live, public publishing), `MyWorkspaceTab.tsx` (live, private), `MyLedgerTab.tsx` (live, receipts) — all registered in `TabRenderer.tsx`.
- **Finding:** the string "myArtifacts" only appears as an in-flight rename comment at `MyCanvasTab.tsx:52`. **No live `MyArtifactsTab.tsx` exists.** See §6 for the implication and the proposed reading of the rebrand instruction.

### 3.10 ventureQube schema v0.3
- `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` — root carries `cartridgeSlug` enum, `operator`, `strategy`, `ventures[]` with `cartridgeBindings`, `objectives`, `plan`, `horizon`, `specialistId`.
- Ingest: `/api/persona/venture-iqube/ingest`.
- **No TypeScript types file** for VentureQube — JSON-only contract.
- **No myCartridge sub-schema** today.

### 3.11 Existing wizards
- `components/metame/setup/ExperienceModelSetupWizard.tsx` — 3 steps (Project, Scope, Privacy). POSTs `/api/assistant/experience-model`. Persists into ExperienceQube meta + blak.
- `components/metame/setup/PersonalGuideSetupWizard.tsx` — 7 steps (Focus, Energy+Body, Mind+Emotion, Relationship+Community, Legacy, Alignment, Review). POSTs `/api/assistant/experience-guide`. Persists into `ExperienceQube.blak.personalGuide`.
- Both triggered from `AigentMeWelcomeTab.tsx` (lines 1207–1220 and 2228–2233) based on `configured` flags from `/api/assistant/bootstrap`.
- Shared primitives (Field, RadioGroup, MicButton, Dialog, personaFetch, rehydration pattern on false→true open) — to be reused.

---

## 4. Existing Components to Reuse

| Surface | Reuse | Extend | Net-new |
|---|---|---|---|
| Codex Manager (`app/(shell)/admin/codex/`) | List/detail UI shell, tab reorder API, RLS-aware fetch | Operator-tier vs admin-tier separation; user-facing entry; per-cartridge ownership column | `MyCartridgeManagerTab` user-facing surface |
| `CodexConfig` / `CodexTab` types | Whole structure | Add `primaryTabSlug` on config; add `memberOnly`, `inviteOnly`, `tokenGated` flags on CodexTab; add `ownerPersonaId` on CodexConfig | `CartridgeRole` enum, `CartridgeMembership` row |
| `data/codex-configs.ts` hand-curated entries | KNYT/Qripto/Venture Lab as templates | Promote to **templates** consumable by the wizard | `CartridgeTemplate[]` selector source |
| Activations Catalogue (`data/activation-catalog.ts`, `ActivationsContext`) | Whole flow | Allow new activations to be added at cartridge creation time (DB-backed alongside static catalog) | `cartridge_activations` table; admin endpoint to author |
| Smart Triad (`SmartTriadProvider`, `CodexCopilotLayer`) | Whole layer | `/api/codex/chat` accepts optional `cartridgeSlug`; KB hybridSearch accepts cartridge-scoped filter | Per-cartridge KB ingestion route |
| Smart Wallet (`SmartWalletDrawer`, `TransactionModal`) | Whole drawer + send/receive/verify | Cartridge-scoped token whitelist; cartridge-scoped fee surface | Crypto-send primitive surfaced in cartridge active tab |
| Specialists (`specialistRouter.ts`) | Whole router | Per-cartridge whitelist; capability matrix | `cartridge_specialists` table; admin grant flow |
| Wizards (`ExperienceModelSetupWizard`, `PersonalGuideSetupWizard`) | Shell, primitives, rehydration, personaFetch | Step gates with conditional validation, multi-target persistence (ventureQube + ExperienceQube) | `CartridgeSetupWizard` |
| Reference cartridges (KNYT/Qripto/Venture Lab tabs) | Pulse, Codex, Experience, Order/Active tabs | Generalize as **tab templates** (cartridge-agnostic) | Pulse template, Experience template, Codex template, Active template, Wallet template, Ledger template, Community template, Venture template |
| Tab Renderer (`TabRenderer.tsx`) | Dispatcher | Template dispatch (`type: 'template'`) so a cartridge can declare `templateId: 'pulse-v1'` instead of a hardcoded component import | n/a |
| ExperienceQube service (`services/iqube/experienceQube.ts`) | upsert + receipt emission | Add `upsertCartridgeConfig(personaId, slug, config)` | `cartridge_configs` slice in blak |
| ventureQube ingest (`/api/persona/venture-iqube/ingest`) | Validation + storage | v0.4 with `myCartridge` block | TypeScript types file |

---

## 5. Naming / Rebrand Requirements

- **Codex Manager → myCartridge and Codex Manager** (admin route stays at `/admin/codex` for super-admin tier; a new operator-tier surface mounts inside the metaMe runtime as a tab named `myCartridge`).
- **myArtifacts → myCluster** (see §6 caveat).
- **Canonical names** (per brief §16): metaMe, aigentMe, myCartridge, myCluster, myCanvas, myWorkspace, myLedger, myCartridge and Codex Manager, KNYT cartridge, Qriptopian cartridge, Qriptopia, Codex, iQube, ContentQube, QriptoCENT / Qc.
- Do **not** use: "myCodex", "myCodex Manager", "My Cartridge" (with capital M and space), "myArtefacts", "Cryptopian", "Night cartridge".

---

## 6. myCluster — Rebrand of the myArtifacts TabGroup

**Codebase finding (corrected after operator confirmation + screenshot):**

`myArtifacts` is a **TabGroup**, not a tab. It is declared in `data/codex-configs.ts:2290` as part of the metaMe cartridge config:

```ts
{ id: 'myartifacts', label: 'myArtifacts', icon: 'PenSquare', order: 0.5, activationId: 'mycanvas' }
```

Its three sub-tabs are declared at lines 2465 / 2481 / 2497 with `group: 'myartifacts'` — myCanvas, myWorkspace, myLedger.

**Rebrand path:**

1. Rename the TabGroup in `data/codex-configs.ts:2290`:
   - `id: 'myartifacts'` → `id: 'mycluster'`
   - `label: 'myArtifacts'` → `label: 'myCluster'`
   - Keep `icon: 'PenSquare'` and `order: 0.5` for visual continuity (or pick a new icon if the operator prefers; `Network` / `LayoutGrid` / `Boxes` are reasonable alternatives).
2. Update the three sub-tab `group:` references at lines 2465 / 2481 / 2497 from `'myartifacts'` to `'mycluster'`.
3. Add a **fourth sub-tab** to the same group: `myCartridge`. It declares `group: 'mycluster'`, opens the user's owned cartridge (or the wizard if none configured), and gets the same `activationId` pattern so it lights up alongside its siblings.

After the rebrand, the metaMe cartridge top-level tab strip reads:

```
aigentMe · myCluster · Activations · KNYT · Qriptopia · Admin
              │
              ├── myCanvas
              ├── myWorkspace
              ├── myLedger
              └── myCartridge  ◄── NEW sub-tab
```

**Why this is the right rebrand:**
- It matches the conceptual framing — myCluster IS where the user organizes everything they own, and a myCartridge is one of those things.
- It avoids creating a sibling tab at the top-level (which would compete with Activations/KNYT/Qriptopia for tab strip real estate).
- It mirrors the user's mental model surfaced in the screenshot: "myArtifacts" was already where canvases, workbench output, and ledger lived. Adding myCartridge there is the natural extension.

**Out of scope for this rebrand:**
- We do NOT rename the underlying React components (`MyCanvasTab.tsx`, `MyWorkspaceTab.tsx`, `MyLedgerTab.tsx`) — those names are accurate and load-bearing.
- We do NOT touch the `activationId: 'mycanvas'` on the TabGroup itself — that gate is keyed off the myCanvas activation (the user can see the group iff they've activated myCanvas). If the operator wants myCluster to have its own activation key, that's a follow-up.
- We do NOT touch the `MyCanvasTab.tsx:52` comment that says "2026-05-29 myArtifacts restructure" — that's historical context for an in-flight artifact-typing change inside myCanvas, unrelated to this rebrand.

**Membership of myCluster (data model side):**
The myCluster sub-tab "myCartridge" is the **owner view** of the user's cartridge(s). The cluster as a *concept* — the user's collection of owned cartridges + activated tabs + published content pointers — is surfaced inside the myCartridge sub-tab as a landing/index view. We do NOT create a separate "myCluster index API" or fifth sub-tab; the cluster's contents naturally live across the four existing sub-tabs:
- myCanvas: what the user has created.
- myWorkspace: what the user is working on privately.
- myLedger: what the user has verified / received receipts for.
- myCartridge: what the user has spun up as their own engagement estate, plus pointers to the canvases/ledger entries scoped to it.

---

## 7. Problem Statement

Today, only Anthropic-side operators can create a cartridge. Cartridges require hand-curation in `data/codex-configs.ts`, custom tab components, a pack registry entry, a CRM tenant slug mapping in `cartridgeAdminGrants.ts`, and (for any KB) bespoke embedding pipelines. The cost to spin up a new cartridge is days of engineering, not minutes of user configuration.

For the metaMe alpha to deliver on "every metaMe user has an aigentMe", we need every user to also have a **myCartridge** — a configurable engagement estate they can spin up from inside the runtime, populate with their own Codex, gate at the tab level, point their wallet at, invite others into, and have aigentMe operate for them.

The Codex Manager is the right substrate. It already models cartridges, tabs, permissions, ownership, and activation gating. The gap is (a) operator-tier UI that doesn't require admin role, (b) cartridge templates the user picks from, (c) a wizard that captures the user's intent, (d) a schema (ventureQube v0.4) that makes that intent durable, and (e) per-cartridge scoping on the copilot, KB, wallet, and specialists.

---

## 8. User Stories

**As a metaMe user creating my first cartridge:**
- I can open the myCartridge tab in my metaMe runtime and see "You haven't set up a cartridge yet — let's start" with a CTA.
- The CartridgeSetupWizard walks me through 5 steps (Identity, Purpose, Tabs, Audience, Wallet+Active Tab).
- aigentMe suggests a cartridge template based on my Experience Model (e.g., I'm a founder-operator → Venture template; I'm a creator → Pulse + Codex; I'm a community lead → Community + Members + Pulse).
- I can pick from cartridge templates and tab templates.
- I see my cartridge appear in myCluster with a default Codex, an Active Tab, and a co-pilot.

**As a cartridge owner operating my cartridge:**
- I open my cartridge from myCluster and see my tabs.
- I can edit tab visibility (public/private/member/admin/invite-only/token-gated) inline.
- I can invite members by persona handle or email.
- I can publish a Codex entry from myCanvas straight into my cartridge's Codex tab.
- I can post a Pulse update.
- The cartridge co-pilot is aware of my cartridge purpose, Codex, KB, and active tab.
- I can crypto-send from my wallet inside my cartridge's Wallet tab.

**As an aigentMe user with my cartridge live:**
- aigentMe recommends Next Best Experiences scoped to my cartridge.
- aigentMe surfaces specialist suggestions (Marketa for partner engagement, Kn0w1 for community, Aigent Z for system orchestration, Quill for editorial) based on my cartridge purpose.
- aigentMe summarizes cartridge activity in my daily brief.
- aigentMe coordinates between my cartridge, myCanvas (for content), myLedger (for receipts), and myWorkspace (for private planning).

**As a user activating a foreign cartridge's tab:**
- I browse the Activation Catalogue from my Activations tab.
- I activate the Qriptopia tab from the Qriptopian cartridge — I'm not now a Qriptopian admin, but I have the Qriptopia surface live inside my metaMe.
- The activated tab respects the source cartridge's permission boundaries (I see public/member-level content, not admin content).

---

## 9. MVP Scope

1. **Rebrand** the admin Codex Manager surface label to "myCartridge and Codex Manager" (super-admin tier).
2. **Mount** an operator-tier `MyCartridgeManagerTab` inside the metaMe runtime.
3. **CartridgeSetupWizard** — 5-step wizard mirroring the Experience Model wizard pattern.
4. **CartridgeTemplate** — promote KNYT / Qriptopian / Venture Lab as templates (operator selects from a small starter set: Community, Venture, Knowledge Estate, Creative Universe).
5. **Tab templates** — Pulse, Codex, Experience, Active, Wallet, Ledger, Community, Members, Settings — each declared as `type: 'template'` with `templateId` in the cartridge config; rendered by extending `TabRenderer`.
6. **One declared `primaryTabSlug` per cartridge** — add the field to `CodexConfig`, default to first enabled.
7. **Tab-level demarcation** — extend `CodexTab` with `memberOnly`, `inviteOnly`, `tokenGated`, `roleRequired`.
8. **Cartridge ownership** — add `ownerPersonaId` to `CodexConfig`; add a `cartridge_memberships` table (`{cartridge_slug, persona_id, role, granted_at}`).
9. **Activation surfacing** — the cartridge's Active Tab auto-registers in the Activation Catalogue (DB-backed catalogue alongside the static `data/activation-catalog.ts`).
10. **Codex inside cartridge** — every new myCartridge gets a default Codex tab; myCanvas entries can be published into it.
11. **Cartridge KB stub** — extend `/api/codex/chat` to accept optional `cartridgeSlug` and pass through to `embeddingService.hybridSearch` (cartridge-scoped filter; if no embeddings yet, fall back to domain).
12. **Smart wallet stub** — mount `SmartWalletDrawer` with `cartridgeSlug` in the cartridge's Wallet tab. Crypto-send works via existing `TransactionModal`. Token whitelist defaults to {Q¢, USDC, KNYT} until v0.5 introduces per-cartridge tokens.
13. **Specialist stub** — every cartridge declares an `availableSpecialists: SpecialistId[]` array; the cartridge co-pilot surfaces only those.
14. **myCluster rebrand** — `data/codex-configs.ts:2290` TabGroup `myartifacts` → `mycluster`; three sub-tab `group:` references updated; new `myCartridge` sub-tab added inside the same group.
15. **ventureQube v0.4** — schema extension with a `myCartridge` block (see §27).
16. **State change receipts** — every cartridge creation, member invite, tab visibility change, crypto-send, catalogue submission, and catalogue review decision emits a DVN receipt to myLedger.
17. **Active Surface Approval gate (§21a)** — a user-created myCartridge active tab is `pending` by default; only metaMe admins can flip it to `approved`; the public Activation Catalogue renders approved entries only.

---

## 10. Non-MVP / Future Scope

- Public discovery marketplace for cartridges.
- Multi-cartridge per persona.
- Bespoke cartridge tokens (like $KNYT for myCartridge owners).
- Full token-gated tab UI (gating works at MVP; configuration UI deferred).
- Multi-owner / co-owner cartridges.
- Franchise cloning (one cartridge → many derived).
- Full Aigent-run autonomous community management.
- Per-cartridge analytics and cross-cartridge reputation.
- Marketa-driven partner ladder inside myCartridge.
- Cartridge governance / voting primitives.
- Full ContentQube minting from inside myCartridge (today: stub via myCanvas).
- Public iQube registry listings of myCartridges.

---

## 11. Information Architecture

```
metaMe cartridge top-level tab strip (data/codex-configs.ts:2287):
  ├── metame.com (web)
  ├── aigentMe
  ├── myCluster ◄── RENAMED from myArtifacts (tabGroups[2290])
  │     ├── myCanvas        (existing sub-tab — group changes from 'myartifacts' to 'mycluster')
  │     ├── myWorkspace     (existing sub-tab — group rename)
  │     ├── myLedger        (existing sub-tab — group rename)
  │     └── myCartridge     ◄── NEW sub-tab in the same group
  │           ├── (if no cartridge) → CartridgeSetupWizard CTA
  │           └── (if configured)   → owner view of the user's cartridge:
  │                 ├── index landing (cartridge identity, members, active tab, KB status)
  │                 ├── pointer rows to canvases published to this cartridge
  │                 └── pointer rows to ledger receipts scoped to this cartridge
  ├── Activations
  ├── KNYT          (activation-gated)
  ├── Venture Lab   (activation-gated)
  ├── Marketa       (activation-gated)
  ├── metaMe Studio (activation-gated)
  ├── AgentiQ OS    (activation-gated)
  ├── Qriptopia     (activation-gated)
  └── Admin         (admin-gated)
        ├── Journey Dashboard
        ├── Access Requests
        ├── Active Surface Approvals  ◄── NEW sub-tab (§28a)
        └── (other admin sub-tabs)

Cartridge runtime (per-cartridge, reachable at /triad/embed/codex/{slug}):
  ├── Overview        (template)
  ├── [Active Tab]    (template — declared by primaryTabSlug)
  ├── Codex           (template)
  ├── Pulse           (template, optional)
  ├── Experience      (template, optional)
  ├── Community       (template, optional)
  ├── Members         (template, optional)
  ├── Wallet          (template, optional)
  ├── Ledger          (template, optional)
  ├── Venture         (template, optional)
  ├── Admin           (template, owner+admin only)
  └── Settings        (template, owner only)

Super-admin surface:
  └── /admin/codex (rebrand label to "myCartridge and Codex Manager")
        ├── All cartridges (system + user-created)
        ├── Tenant ↔ cartridge slug mapping
        └── Activation Catalogue admin (same model as in-runtime Active Surface Approvals,
            with platform-tier scope)
```

---

## 12. myCluster Integration

myCluster is the rebranded TabGroup that holds myCanvas / myWorkspace / myLedger / myCartridge. The rail itself is implemented as a one-line edit in `data/codex-configs.ts:2290` (group id + label) and three one-line edits to the existing sub-tabs (`group: 'myartifacts'` → `'mycluster'` at lines 2465 / 2481 / 2497).

The **net-new sub-tab** inside myCluster is `myCartridge`:

- Component: `MyCartridgeTab.tsx`, registered in `TabRenderer.tsx` alongside MyCanvas/MyWorkspace/MyLedger.
- Position: fourth sub-tab in the myCluster group (order: 3, after myLedger which is at order 2).
- Behavior:
  - If the active persona has no cartridge configured (`ventureQube.myCartridge.configured !== true` AND no row in `codex_configs WHERE owner_persona_id = $personaId`) → show the CartridgeSetupWizard CTA.
  - If configured → show the owner view: cartridge identity card, member roster, active tab summary, KB status, links to canvases published to this cartridge, links to ledger receipts scoped to it, and a button to open the cartridge runtime at `/triad/embed/codex/{slug}?personaId=...` via `buildCodexUrl`.
- Backing API: `GET /api/mycartridge/owner-view?personaId=...` returns `{cartridge, members, activeTab, kbStatus, publishedEntries[], ledgerReceipts[]}` (the contents are pointers — never copies).

The myCluster TabGroup does NOT need its own dedicated API or container component; its identity is a TabGroup row in codex-configs, which the existing CodexPanelDynamic / TabRenderer chain already handles.

---

## 13. myCartridge Creation Flow

1. User opens **myCluster tab** → "No cartridges yet — Start one" CTA.
2. Or: aigentMe (in chat) suggests "Looks like you're tending a venture — want to set up a myCartridge for it?" → CTA opens the wizard.
3. **CartridgeSetupWizard** runs (see §27).
4. On Save: POST `/api/assistant/cartridge-config` creates the cartridge row in `codex_configs` with `owner_persona_id` set, mounts default tabs from the chosen template, registers the active tab in `cartridge_activations`, emits a DVN receipt.
5. The new cartridge appears in myCluster.
6. The cartridge runtime is reachable at `/triad/embed/codex/{slug}?personaId=...` like any other cartridge — the `buildCodexUrl` helper handles identity propagation per CLAUDE.md inter-cartridge nav rules.

---

## 14. myCartridge and Codex Manager Requirements

**Super-admin tier** (`/admin/codex`, existing): no behavior change; rebrand label only.

**Operator tier** (`MyCartridgeManagerTab` in metaMe runtime):
- List the operator's own cartridges (filter `codex_configs.owner_persona_id = $personaId`).
- Per-cartridge: edit name/description/icon, toggle tab visibility, edit tab gates (public/member/admin/invite-only/token-gated), reorder tabs (uses existing `/api/codex/registry/{codexId}/tabs/reorder`), edit the `primaryTabSlug`.
- Per-cartridge: manage members (invite by persona handle, change role, revoke).
- Per-cartridge: edit `availableSpecialists[]`.
- Per-cartridge: edit `tokenWhitelist[]` (MVP: pick from {Q¢, USDC, KNYT}; future: per-cartridge tokens).
- Per-cartridge: view + publish Codex entries (delegated to myCanvas publishing flow).
- Per-cartridge: view DVN receipts (delegated to myLedger filter).

**Permission boundary**: operator tier writes are gated by `persona.cartridgeFlags.adminCartridges.includes(cartridgeSlug)` (which gets auto-granted to `owner_persona_id` on cartridge creation) — reuse the existing spine.

---

## 15. Smart Triad Requirements

Every myCartridge is a Smart Triad. The cartridge config declares:

```ts
smartTriad: {
  copilot: {
    specialistId?: SpecialistId;        // default: aigentMe (the user's own)
    promptContext: string;              // cartridge purpose summary
    kbDomainOverride?: ContentDomain;   // fallback when cartridge KB has no hits
  };
  knowledgeBase: {
    sources: KBSource[];                // myCanvas entries, uploaded docs, Codex pages
    embeddingStatus: 'pending' | 'ready' | 'stale';
  };
  codex: {
    enabled: boolean;
    rootTabSlug: 'codex';
  };
  wallet: {
    enabled: boolean;
    tokenWhitelist: TokenId[];
    cartridgeScopedPersona?: PersonaId;
  };
}
```

These five blocks (copilot, KB, Codex, wallet, identity-via-spine) ride together. Removing one without the others breaks the Triad contract.

---

## 16. Cartridge Co-Pilot Model

Reuse `CodexCopilotLayer`. Extend by:
- Passing `cartridgeSlug` to `getChatRequestContext()` so `/api/codex/chat` can scope KB + system prompt.
- Adding a `cartridgePromptContext` string to the chat request (cartridge purpose, audience, owner's stated intent) — sourced from ventureQube v0.4 `myCartridge.purpose`.
- The cartridge co-pilot can be **aigentMe** (default — the user's own regent operating their cartridge), a specialist (e.g., Kn0w1 for community cartridges), or a stubbed cartridge-specific assistant.

**Server-side:** `/api/codex/chat` accepts optional `cartridgeSlug`. If provided:
- `embeddingService.hybridSearch(query, domain, { cartridgeSlug })` (extended signature).
- System prompt prepends `cartridgePromptContext` and the cartridge's `availableSpecialists` list (so the model can suggest handoffs).

---

## 17. Cartridge Knowledge Base Model

MVP: cartridge KB is a thin index over (a) the cartridge's Codex entries, (b) the owner's myCanvas entries published into the cartridge, (c) uploaded docs (MVP: 5 docs per cartridge limit).

Storage: a `cartridge_kb_sources` table `{cartridge_slug, source_type, source_id, embedded_at, status}`. Embeddings live alongside existing `content_embeddings` but with a `cartridge_slug` column for scoping.

Per-cartridge KB is a v0.5 deliverable. MVP falls back to domain-scoped KB if the cartridge KB is empty.

---

## 18. Cartridge Codex Model

Every myCartridge auto-gets a Codex tab. The Codex tab is a thin viewer over `cartridge_codex_entries` (new table) `{cartridge_slug, entry_id, title, body_md, published_at, status, source}` where `source` can be `mycanvas | upload | direct`.

Publishing path from myCanvas: extend `MyCanvasTab` "Publish" action with an optional `targetCartridgeSlug` selector. POST to `/api/mycanvas/publish-to-cartridge` writes the row.

---

## 19. Smart Wallet / Crypto-Send Requirements

MVP wallet primitive: **crypto-send via existing `TransactionModal`**.

Cartridge Wallet tab mounts `SmartWalletDrawer` with `cartridgeSlug` prop (already supported, line 182). Token whitelist from cartridge config defaults to `{q¢, usdc, knyt}`. Send/Receive/Verify works as today.

Future (post-MVP):
- Per-cartridge token (bespoke ERC-20 deploy from inside the wizard).
- Token-gated tabs (`tokenGated: { tokenId, minBalance }` on CodexTab).
- Cartridge-scoped fee tier overrides (per-cartridge `pricingService` config).

---

## 20. Active Tab Pattern

Add to `CodexConfig`:
```ts
primaryTabSlug?: string;     // default-open tab when user enters the cartridge runtime
activeTabRegistration?: {     // exposes this tab to the Activation Catalogue
  catalogId: string;          // unique id (e.g., "mycartridge-x:active")
  metrics: ActivationMetric[];
  actions: ActivationAction[];
};
```

`getEnabledTabs()` and `CodexPanelDynamic` resolve `primaryTabSlug` first, fall back to first enabled.

The Active Tab is the daily-engagement surface. For myCartridge MVP, the wizard defaults the active tab based on cartridge template:
- Community → Pulse
- Venture → Venture Cockpit (template version of Venture Lab α's AlphaProgrammeTab)
- Knowledge Estate → Codex
- Creative Universe → Canvas (cartridge-scoped publishing wall)

---

## 21. Activation Catalogue Requirements

Today: static `data/activation-catalog.ts` + `ActivationsContext`. Persona activations stored server-side (table inferred).

Extend to:
- Read entries from BOTH `data/activation-catalog.ts` (system entries) AND `cartridge_activations` table (user-created entries from myCartridges).
- New POST `/api/activations/register` (called on cartridge creation) inserts a **pending** row — see §21a for the approval gate that must clear before the entry becomes browsable.
- Activation Catalogue UI (`ActivationsTab.tsx`) renders only entries with `status = 'approved'`. Pending and rejected entries are hidden from non-owner personas.

When a user activates an approved tab from a foreign cartridge:
- `persona_activations` row written.
- The tab appears in the user's metaMe runtime via the existing `activationId` gate on `getEnabledTabs()`.
- The tab respects the source cartridge's tab gates (server-side enforcement via spine).

---

## 21a. Active Surface Approval — metaMe Catalogue Gate

**Requirement (operator addition, 2026-06-01):** A user-created myCartridge active tab being included in the metaMe Activation Catalogue MUST clear a metaMe-side approval gate. This is the **distribution boundary** between a user's private engagement estate and the platform-wide catalogue browseable by all metaMe users.

### 21a.1 Lifecycle

```
[wizard save / register]
        │
        ▼
   status=pending  ────► visible only to: cartridge owner, metaMe admins
        │
        │  (metaMe admin reviews in Admin → Active Surface Approvals)
        │
        ├─► status=approved    ────► visible in Activation Catalogue, browseable by any persona
        ├─► status=rejected    ────► hidden; owner sees rejection reason + can edit + resubmit
        └─► status=needs_changes ──► hidden; owner sees feedback + can edit + resubmit
```

A cartridge being **created** is never blocked by this gate — the user can operate their cartridge privately the moment the wizard saves. The gate ONLY governs **catalogue inclusion** (i.e., whether another persona can discover and activate the cartridge's active tab via the metaMe Activations surface).

### 21a.2 Storage

New table `cartridge_activation_approvals`:

```sql
catalog_id          TEXT PRIMARY KEY,         -- from cartridge_activations.catalog_id
cartridge_slug      TEXT NOT NULL,
tab_slug            TEXT NOT NULL,
owner_persona_id    UUID NOT NULL,
status              TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
reviewed_at         TIMESTAMPTZ,
reviewed_by         UUID,                      -- metaMe admin persona
review_notes        TEXT,
metrics_proposed    JSONB,                     -- mirrors activation-catalog metrics[]
actions_proposed    JSONB,                     -- mirrors activation-catalog actions[]
visibility_proposed TEXT NOT NULL CHECK (visibility_proposed IN ('public','member','invite-only')),
revision            INTEGER NOT NULL DEFAULT 1
```

RLS: owner can read their own rows; metaMe admins (`persona.cartridgeFlags.adminCartridges` includes `'metame-cartridge'`) can read/write all.

### 21a.3 Submission paths

1. **Automatic at wizard save** — if the user picks `visibility: public` in Step 4 of the CartridgeSetupWizard AND opts in to "Submit for catalogue inclusion" in Step 5, the `/api/assistant/cartridge-config` POST also inserts a `pending` row.
2. **Manual later** — from the operator-tier `MyCartridgeManagerTab`, the owner clicks "Submit active tab to metaMe catalogue" which POSTs `/api/cartridge-activations/submit` with the catalog_id.
3. **Re-submission** — if `status = needs_changes` or `rejected`, the owner can edit and resubmit; revision counter increments; reviewed_at + reviewed_by clear.

### 21a.4 Approval surface — new sub-tab under metaMe Admin

Add a new sub-tab to the metaMe cartridge Admin group (`data/codex-configs.ts` ~line 2898, between `admin-access-requests` and `admin-persona-360`):

```ts
{
  id: 'admin-active-surface-approvals',
  label: 'Active Surface Approvals',
  slug: 'active-surface-approvals',
  enabled: true,
  adminOnly: true,
  group: 'admin',
  order: 61.5,
  type: 'static',
  config: { component: 'AdminActiveSurfaceApprovalsTab', props: {} },
  metadata: {
    icon: 'Check',
    description: 'Review and approve user-created cartridge active tabs for inclusion in the metaMe Activation Catalogue',
    color: 'cyan'
  }
}
```

Component: `app/triad/components/codex/tabs/AdminActiveSurfaceApprovalsTab.tsx`. UX mirrors `AdminAccessRequestsTab` (which already exists at `admin-access-requests`):

- Tabbed status filter: `Pending (N) · Needs Changes (N) · Approved · Rejected`
- Row per submission: cartridge name + owner + category + proposed metrics/actions + visibility + revision #.
- Detail drawer per row: full cartridge config snapshot, proposed catalogue entry preview, owner's stated purpose, review history.
- Actions: `Approve` · `Request Changes (textarea)` · `Reject (textarea + reason code)`.
- Decisions emit a DVN receipt: `actionType: 'cartridge_activation_reviewed'`, summary includes catalog_id, status, reviewer persona.

API routes:
- `GET /api/admin/cartridge-activations?status=pending` — list submissions (admin-only via spine).
- `POST /api/admin/cartridge-activations/{catalogId}/approve` — set status, write reviewer, emit receipt, flip `cartridge_activations.status` to `approved`.
- `POST /api/admin/cartridge-activations/{catalogId}/request-changes` — set status to `needs_changes`, save notes, notify owner (QubeTalk or in-runtime aigentMe message).
- `POST /api/admin/cartridge-activations/{catalogId}/reject` — set status to `rejected`, save notes + reason code.

### 21a.5 Approval criteria (review rubric for metaMe admins)

The PRD defines the rubric so reviewers have a consistent bar:

1. **Identity completeness** — name, description, purpose, category all present and non-trivial.
2. **Purpose alignment** — the active tab actually does something a visiting persona could engage with (not just a dead landing page).
3. **Tab template integrity** — picked templateId matches the cartridge category (e.g., a Knowledge Estate cartridge surfacing only a Wallet tab as active = mismatch).
4. **Audience honesty** — declared audience kind/size aligns with actual content posture; e.g., declaring `audience.kind = 'open'` but gating all content `member-only` is misleading.
5. **No prohibited content** — same content policy as existing system cartridges (no harassment, illegal content, PII leakage, etc.).
6. **No spine violations** — does the active tab respect `evaluateAccess`? Does the cartridge config use `personaFetch` not raw fetch? (Automated check — see 21a.6.)

### 21a.6 Automated pre-checks

Before a submission reaches a human reviewer, run automated checks via `/api/admin/cartridge-activations/precheck`:

- Verifies `owner_persona_id` matches `codex_configs.owner_persona_id` (no impersonation).
- Verifies all referenced `tab_slug`s exist in `codex_tabs`.
- Verifies `templateId` is in the approved `TAB_TEMPLATES` registry.
- Verifies `metrics[]` / `actions[]` shapes match `ActivationCatalogEntry`.
- Runs `verify-spine.mjs --cartridge=<slug>` if the cartridge declares spine-touching surfaces.

Pre-check failures mark the submission `needs_changes` automatically with a machine-generated reason; no human time spent on broken submissions.

### 21a.7 Notification surface

When status changes, the cartridge owner sees:
- An aigentMe in-runtime card on next welcome surface load: "Your cartridge X active tab has been approved/needs changes/rejected — [open MyCartridgeManagerTab]".
- A row in their myLedger (`actionType: 'cartridge_activation_reviewed'`).
- Optional email if `notify_on_review` flag set on the persona (not MVP).

### 21a.8 Super-admin tier passthrough

The same approval queue is also surfaced in the super-admin Codex Manager at `/admin/codex` (rebranded "myCartridge and Codex Manager") under a new "Catalogue Submissions" section. Same data, same actions, same audit. The in-runtime metaMe Admin sub-tab is the daily-use surface; the super-admin surface is the platform-wide tier with cross-cartridge visibility.

---

## 22. Tab Template Framework

Today: each tab `type` ∈ {static, dynamic, liquid-ui}; tab content comes from a hardcoded React component dispatched in `TabRenderer.tsx`.

Add: `type: 'template'` + `templateId: string` to `CodexTab.config`. `TabRenderer` extended with a registry:

```ts
const TAB_TEMPLATES: Record<TabTemplateId, React.ComponentType<TabTemplateProps>> = {
  'pulse-v1':        PulseTabTemplate,
  'codex-v1':        CodexTabTemplate,
  'experience-v1':   ExperienceTabTemplate,
  'active-v1':       ActiveTabTemplate,
  'wallet-v1':       WalletTabTemplate,
  'ledger-v1':       LedgerTabTemplate,
  'community-v1':    CommunityTabTemplate,
  'members-v1':      MembersTabTemplate,
  'venture-v1':      VentureTabTemplate,
  'settings-v1':     SettingsTabTemplate,
  'admin-v1':        AdminTabTemplate,
  'overview-v1':     OverviewTabTemplate,
};
```

Templates receive `{cartridgeSlug, personaId, permissions, config}` props and render cartridge-agnostic UI. The first templates extracted from production code:
- `PulseTabTemplate` — extracted from `QriptoPulseTab` (drop the hardcoded reaction routes; route via `/api/cartridge/{slug}/pulse/...`).
- `CodexTabTemplate` — extracted from KNYT Scrolls + Qripto Codex.
- `ActiveTabTemplate` — extracted from KNYT Order tab Liquid template.
- `VentureTabTemplate` — extracted from AlphaProgrammeTab with workstream count parameterized.
- Others stubbed for MVP.

---

## 23. Permissions / Roles / Gating Model

Extend `CodexTab` with:
```ts
memberOnly?: boolean;
inviteOnly?: boolean;
tokenGated?: { tokenId: string; minBalance: string };
roleRequired?: CartridgeRole;
```

New enum `CartridgeRole`:
```ts
type CartridgeRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'member' | 'partner' | 'franchisee' | 'correspondent' | 'guest';
```

New table `cartridge_memberships`:
```sql
cartridge_slug TEXT NOT NULL,
persona_id     UUID NOT NULL,
role           TEXT NOT NULL CHECK (role IN (...)),
granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
granted_by     UUID,           -- persona who granted (audit)
PRIMARY KEY (cartridge_slug, persona_id)
```

Server-side resolution: extend `getActivePersona` to also return `cartridgeMemberships: Record<string, CartridgeRole>` on `cartridgeFlags`. `getEnabledTabs()` checks `tab.roleRequired` against `cartridgeMemberships[cartridgeSlug]`.

**CRITICAL (per CLAUDE.md spine paramount rule):** do NOT build a parallel role resolver. All role checks flow through `evaluateAccess(persona, descriptor, action)` — extend `descriptor.cartridgeRole` and the resolver, not the call sites.

---

## 24. Specialist Aigent Integration

Per-cartridge `availableSpecialists: SpecialistId[]` (subset of the 8 registered). Default for new cartridges:
- Community → `['aigent-c', 'marketa', 'kn0w1']`
- Venture → `['aigent-z', 'moneypenny', 'marketa']`
- Knowledge Estate → `['quill', 'kn0w1']`
- Creative Universe → `['quill', 'metaye']`

Cartridge co-pilot surfaces only the available specialists. `SpecialistContext.activeCartridge` (existing) carries the slug. Specialist responses with `requiresApproval: true` route through myWorkspace pending-approval flow (existing). All specialist invocations emit DVN receipts to myLedger (existing).

---

## 25. myCanvas / myWorkspace / myLedger Relationship

myCartridge does not absorb the rails — it joins them.

- **myCanvas** publishes into a cartridge's Codex tab via the `publish-to-cartridge` action.
- **myWorkspace** holds the private drafts that haven't been published yet; on publish, the draft flows into the cartridge's Codex.
- **myLedger** receives DVN receipts for every cartridge state change (cartridge created, member invited, tab visibility changed, crypto-send executed, Codex entry published).
- **myCluster** is the per-cartridge view of all the above.

---

## 26. Data Model / Schema Implications

**New tables:**
- `cartridge_memberships` (slug, persona_id, role, granted_at, granted_by).
- `cartridge_activations` (catalog_id, cartridge_slug, tab_slug, mode, metrics_json, actions_json, status). `status` defaults to `'pending'`; flips to `'approved'` only via §21a flow.
- `cartridge_activation_approvals` (catalog_id, cartridge_slug, tab_slug, owner_persona_id, status, submitted_at, reviewed_at, reviewed_by, review_notes, metrics_proposed, actions_proposed, visibility_proposed, revision) — see §21a.
- `cartridge_codex_entries` (cartridge_slug, entry_id, title, body_md, published_at, status, source, source_id).
- `cartridge_kb_sources` (cartridge_slug, source_type, source_id, embedded_at, status). [v0.5 fully wired]

**Extended tables:**
- `codex_configs`: add `owner_persona_id UUID`, `primary_tab_slug TEXT`, `available_specialists TEXT[]`, `token_whitelist TEXT[]`, `smart_triad_config JSONB`.
- `codex_tabs`: add `member_only BOOLEAN`, `invite_only BOOLEAN`, `token_gated JSONB`, `role_required TEXT`.
- `journey_states.blak` (ExperienceQube): add `cartridgeConfigs: Record<slug, CartridgeConfigData>`.

**RLS:** new tables follow the existing `codex_configs` RLS pattern — owner persona has full access; members have read-only unless `role IN ('owner','admin','editor')`.

---

## 27. ventureQube v0.4 Schema Extension

Extend `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` → v0.4 with a top-level `myCartridge` block (sibling to `strategy`, `ventures`):

```jsonc
{
  "schemaVersion": "venture-iqube/v0.4",
  "operator": "string",
  "strategy": "string",
  "ventures": [ /* unchanged from v0.3 */ ],

  "myCartridge": {
    "configured": true,
    "slug": "string (URL-safe, unique per persona)",
    "title": "string",
    "description": "string",
    "purpose": "string (operator's stated intent; feeds copilot system prompt)",
    "category": "community | venture | knowledge | creative | media | franchise | learning | research | professional | private",
    "template": "community-v1 | venture-v1 | knowledge-v1 | creative-v1 | custom",
    "visibility": "public | private | invite-only | member-only",
    "ownerPersonaId": "string (T0 — NEVER serialized to browser; resolved server-side from spine)",
    "audience": {
      "kind": "open | gated | franchise | inner-circle",
      "estimatedSize": "1-10 | 10-100 | 100-1k | 1k-10k | 10k+",
      "languages": ["en"]
    },
    "tabs": [
      {
        "slug": "string",
        "templateId": "pulse-v1 | codex-v1 | experience-v1 | active-v1 | wallet-v1 | ledger-v1 | community-v1 | members-v1 | venture-v1 | settings-v1 | admin-v1 | overview-v1",
        "visibility": "public | member | admin | invite | token-gated",
        "primary": "boolean (true for the active tab)",
        "tokenGate": { "tokenId": "string", "minBalance": "string" }
      }
    ],
    "smartTriad": {
      "copilot": {
        "specialistId": "marketa | quill | kn0w1 | aigent-z | aigent-c | aigent-nakamoto | moneypenny | metaye | null",
        "promptContext": "string (derived from purpose+audience+category)"
      },
      "knowledgeBase": {
        "ingestSources": ["mycanvas", "uploads", "codex"],
        "embeddingScope": "cartridge | domain"
      },
      "codex": { "enabled": true, "rootTabSlug": "codex" },
      "wallet": {
        "enabled": true,
        "tokenWhitelist": ["q-cent", "usdc", "knyt"],
        "cryptoSendEnabled": true
      }
    },
    "specialists": {
      "available": ["aigent-c", "marketa"],
      "primary": "aigent-c"
    },
    "activeTab": {
      "slug": "string (must equal one of tabs[].slug where primary=true)",
      "catalogId": "string (used to surface in Activation Catalogue)",
      "metrics": ["string"],
      "actions": ["string"]
    },
    "membershipModel": {
      "rolesEnabled": ["owner", "admin", "member"],
      "invitePolicy": "owner-only | admin-allowed | public-request",
      "membershipReceipts": true
    },
    "stateChangeReceipts": {
      "enabled": true,
      "receiptKinds": ["created", "tab_visibility", "member_invited", "crypto_send", "codex_published"]
    }
  }
}
```

**Type file (net-new):** `types/ventureQube.ts` with `VentureQubeV04`, `MyCartridgeConfig`, `CartridgeTabSpec`, etc. — and a runtime validator (e.g., Zod) at `services/iqube/ventureQubeSchema.ts` so the ingest route and the wizard share one source of truth.

**Ingest behavior:** `/api/persona/venture-iqube/ingest` accepts v0.3 OR v0.4; if v0.4 with `myCartridge.configured = true`, also writes to `codex_configs` and seeds the new cartridge.

---

## 28. The Third Wizard — CartridgeSetupWizard

Mounted alongside the two existing wizards in `AigentMeWelcomeTab` (per `AigentMeWelcomeTab.tsx:1207–1220` for ExperienceModel, `:2228–2233` for PersonalGuide). The CTA appears when bootstrap returns `myCartridge.configured = false`.

**Path:** `components/metame/setup/CartridgeSetupWizard.tsx`.

**Reuses:** Dialog shell, Field, RadioGroup, MicButton, progress bar, false→true open rehydration, personaFetch, error/saving state pattern.

**5 steps:**

1. **Identity** — name (text + Mic), slug (auto-derived, editable), description (text + Mic), icon (small picker), category (radio: 10 options from §27).
2. **Purpose** — purpose statement (large textarea + Mic — feeds copilot prompt), audience kind (radio: open/gated/franchise/inner-circle), estimated size (radio), visibility (radio: public/private/invite-only/member-only).
3. **Tabs** — template picker (radio: Community / Venture / Knowledge Estate / Creative Universe / Custom). On non-Custom: pre-fills the default tab set for that template (multi-select to add/remove from a fixed list of available templateIds). On Custom: free multi-select. Inline reorder.
4. **Audience & Permissions** — for each tab, set visibility (public/member/admin/invite/token-gated). Token-gating UI MVP-stubbed (label only — wiring in v0.5). Pick `primaryTabSlug` from the enabled tabs.
5. **Smart Triad & Active Tab** — pick the cartridge co-pilot (radio: aigentMe (default), or a specialist from the cartridge's recommended `availableSpecialists`). Pick wallet tokens (multi-select from {Q¢, USDC, KNYT}). Pick the cartridge's `activeTab` (defaults to `primaryTabSlug`). Confirm + Save.

**Persistence:** POST `/api/assistant/cartridge-config` writes:
- ventureQube v0.4 `myCartridge` block via the existing ingest route.
- `codex_configs` row with `owner_persona_id`, `primary_tab_slug`, `available_specialists`, `token_whitelist`, `smart_triad_config`.
- `codex_tabs` rows for each picked template.
- `cartridge_activations` row for the active tab.
- `cartridge_memberships` row granting `owner` to the persona.
- DVN receipt: `actionType: 'cartridge_configured'`, summary text.

**Resumption:** mirrors the two existing wizards. Wizard re-opens with `initial = currentConfig` to allow re-configuration (e.g., adding tabs later).

**aigentMe assistance:** on entering step 2 (Purpose), aigentMe (via `/api/assistant/cartridge-recommend`) returns suggested category + template based on the user's Experience Model and active intents — shown as a "Recommended:" chip the user can accept or override.

---

## 29. UI/UX Requirements

- Wizard modal shell, dark theme, same `max-w-2xl` as Experience Model wizard.
- myCluster tab uses the same list/group/filter pattern as MyCanvasTab.
- MyCartridgeManagerTab uses the same row-edit pattern as `/admin/codex/[codexId]/page.tsx` but scoped to one cartridge.
- All inter-cartridge nav uses `buildCodexUrl(slug, {personaId, ...})` per CLAUDE.md spine rule.
- All client fetches to spine endpoints use `personaFetch` per CLAUDE.md PARAMOUNT rule.
- All R/T dot strips follow the metaMe Client Protocol spec.

---

## 30. State Change / Ledger / DVN Receipt Requirements

Every myCartridge state change emits an `activity_receipts` row via `createActivityReceipt()`:

| Action | actionType | activeCartridge | iqubesUsed |
|---|---|---|---|
| Cartridge created | `cartridge_configured` | new slug | ventureQube + ExperienceQube |
| Tab visibility changed | `cartridge_tab_updated` | slug | ventureQube |
| Member invited | `cartridge_member_invited` | slug | — |
| Crypto send | `cartridge_crypto_send` | slug | — |
| Codex entry published | `cartridge_codex_published` | slug | ContentQube (when applicable) |
| Catalogue submission | `cartridge_activation_submitted` | slug | ventureQube |
| Catalogue review decision | `cartridge_activation_reviewed` | slug + 'metame-cartridge' | — |

Receipts appear in myLedger filtered by `activeCartridge`.

---

## 31. iQube / ContentQube / Codex Considerations

- ventureQube v0.4 (extended in this PRD) holds the user's myCartridge intent declaration.
- ExperienceQube (existing) holds `cartridgeConfigs` slice mirroring the wizard output for fast read.
- ContentQube minting from a Codex entry: MVP defers — Codex entries are markdown rows. v0.5 adds "mint as ContentQube" action on Codex entries.

---

## 32. Migration / Rebrand Plan

**Phase 1 — terminology & doc.**
- Rebrand label on `/admin/codex` to "myCartridge and Codex Manager" (string change only).
- Land this PRD in `codexes/packs/agentiq/updates/`.
- Register in `codexes/packs/agentiq/collections.json` under `col_updates`.

**Phase 2 — myCluster rail.**
- Land `MyClusterTab.tsx` + `/api/mycluster/summary`.
- Register in `TabRenderer.tsx`.
- Mount in metaMe runtime tab strip.

**Phase 3 — schema + types.**
- ventureQube v0.4 doc.
- `types/ventureQube.ts` + Zod validator.
- Extend `/api/persona/venture-iqube/ingest` to accept v0.4.

**Phase 4 — config + roles.**
- DB migration: `cartridge_memberships`, `cartridge_activations`, `cartridge_codex_entries`; add `owner_persona_id`, `primary_tab_slug`, etc. to `codex_configs`; add new gate flags to `codex_tabs`.
- Extend `getActivePersona` to return `cartridgeMemberships`.
- Extend `evaluateAccess` (no parallel resolvers).

**Phase 5 — tab templates.**
- Land `TAB_TEMPLATES` registry in `TabRenderer.tsx`.
- Extract first 4 templates (Pulse, Codex, Active, Overview).
- Stub the rest.

**Phase 6 — wizard.**
- Land `CartridgeSetupWizard.tsx`.
- Land `/api/assistant/cartridge-config` route.
- Land `/api/assistant/cartridge-recommend` route.
- Wire CTA into `AigentMeWelcomeTab`.

**Phase 7 — operator-tier surface.**
- Land `MyCartridgeManagerTab.tsx` inside myCluster.
- Wire member invite, tab visibility editor, primary tab editor.

**Phase 8 — Smart Triad scoping.**
- Extend `/api/codex/chat` with `cartridgeSlug`.
- Extend `embeddingService.hybridSearch` with cartridge-scoped filter.

**Phase 9 — wallet integration.**
- Mount `SmartWalletDrawer` with `cartridgeSlug` in cartridge Wallet tab template.
- Wire token whitelist from cartridge config.

**Phase 10 — receipts & catalogue.**
- Emit all DVN receipts per §30.
- Register active tab in Activation Catalogue via `/api/activations/register` (writes `pending`).

**Phase 11 — Active Surface Approval gate.**
- DB migration: `cartridge_activation_approvals` table.
- New sub-tab `admin-active-surface-approvals` in metaMe Admin group.
- `AdminActiveSurfaceApprovalsTab.tsx` component (mirroring `AdminAccessRequestsTab`).
- Admin API routes: GET list, POST approve/request-changes/reject.
- Automated pre-check route.
- Owner notification card in aigentMe welcome surface.
- Super-admin tier passthrough in `/admin/codex`.

---

## 33. Implementation Plan

| Phase | Effort | Dependencies |
|---|---|---|
| 1 — rebrand label + PRD land | 0.5d | — |
| 2 — myCluster rail (TabGroup rename + myCartridge sub-tab) | 0.5d | — |
| 3 — ventureQube v0.4 | 1d | — |
| 4 — DB + roles | 2d | 3 |
| 5 — tab templates | 3d | 4 |
| 6 — wizard (incl. Step 5 "submit to catalogue" toggle) | 2d | 3, 5 |
| 7 — operator manager | 2d | 4, 5 |
| 8 — Smart Triad scoping | 2d | 4 |
| 9 — wallet integration | 1d | 5 |
| 10 — receipts + catalogue (pending entries) | 1d | 4, 7 |
| 11 — Active Surface Approval gate (§21a) | 2d | 4, 10 |

**Total MVP:** ~17 engineering days (one engineer, conservative).

---

## 34. Acceptance Criteria

1. ✓ myCluster tab exists in the metaMe runtime tab strip and lists the user's cartridges, activated tabs, and owned content.
2. ✓ A user with no cartridge sees the CartridgeSetupWizard CTA in their aigentMe welcome surface.
3. ✓ The 5-step wizard completes and produces a `codex_configs` row with `owner_persona_id` set, plus rows in `cartridge_memberships`, `cartridge_activations`, `codex_tabs`.
4. ✓ The new cartridge is reachable at `/triad/embed/codex/{slug}` and renders its primary tab.
5. ✓ The cartridge co-pilot loads with cartridge-scoped prompt context.
6. ✓ The cartridge Wallet tab opens `SmartWalletDrawer` with `cartridgeSlug` prop and the token whitelist from config.
7. ✓ Tab visibility gates (`memberOnly`, `inviteOnly`, `roleRequired`) are enforced server-side through the spine.
8. ✓ DVN receipts for every state change appear in myLedger filtered by `activeCartridge`.
9. ✓ The active tab is registered in the Activation Catalogue and visible to other personas who browse it.
10. ✓ `/admin/codex` label reads "myCartridge and Codex Manager" and continues to function for super-admin tier.
11. ✓ ventureQube v0.4 schema doc lands; ingest accepts both v0.3 and v0.4; types file exists.
12. ✓ All access decisions flow through `evaluateAccess` — no parallel resolvers (CLAUDE.md spine PARAMOUNT).
13. ✓ All client-side spine fetches use `personaFetch` — no raw `fetch` on spine routes (CLAUDE.md PARAMOUNT).
14. ✓ A cartridge active tab is NOT visible in the public Activation Catalogue until status flips to `approved` via the §21a flow.
15. ✓ The metaMe Admin → Active Surface Approvals sub-tab lists pending submissions, supports approve / request-changes / reject, and emits DVN receipts for every decision.
16. ✓ The myArtifacts TabGroup is renamed to myCluster, contains four sub-tabs (myCanvas, myWorkspace, myLedger, myCartridge), and the rename is a sub-1-day code change.

---

## 35. Risks and Open Questions

**Risks:**

- **R1: Cartridge proliferation cost.** Every metaMe user spinning up a cartridge means N×(codex_configs row, codex_tabs rows, cartridge_kb_sources, embeddings). Embedding cost balloons unless we gate cartridge KB enablement (MVP: KB is off by default, opt-in per cartridge).
- **R2: Permission surface area.** Adding `memberOnly`/`inviteOnly`/`roleRequired` doubles the gate matrix. Spine tests in `tests/access-spine.test.ts` must extend canary cases. Without that, regressions silently leak content.
- **R3: Codex Manager super-admin tier confusion.** Operators may use `/admin/codex` to edit a system cartridge thinking it's their own. The label rebrand isn't enough — needs a tier-divider banner (`You are operating on a system cartridge. Edits affect all users.`).
- **R4: ventureQube v0.3 / v0.4 dual ingest.** Until every consumer is on v0.4, both shapes must round-trip. Risk of subtle field-name collisions.
- **R5: Activation Catalogue spam.** If every user's myCartridge active tab auto-registers, the catalogue becomes unbrowsable. MVP: cartridges marked `visibility: public` get auto-registered; private/member/invite-only do not.
- **R6: Wallet exposure.** Cartridge crypto-send uses the persona's own funds. Per-cartridge personas (already supported by `SmartWalletDrawer.setCartridgeDefault`) must be set explicitly by the user; do not infer.
- **R7: Specialist invocation cost.** If every cartridge can invoke 8 specialists, LLM cost climbs. MVP: per-cartridge `availableSpecialists` defaults to ≤3; user can extend.
- **R8: Inter-cartridge nav identity leakage.** Per CLAUDE.md, never serialize `personaId` (T0) in browser links. `buildCodexUrl` already handles this. Audit every new myCluster → cartridge link.

**Open questions for operator:**

- **Q1:** ~~Confirm myCluster reading per §6~~ — **Resolved 2026-06-01:** myArtifacts is the TabGroup at `data/codex-configs.ts:2290`; rebrand = rename + add myCartridge sub-tab. PRD §6 updated.
- **Q2:** Should myCartridge MVP allow multiple cartridges per persona, or strictly 1? PRD assumes 1; relaxing later is straightforward.
- **Q3:** Should the cartridge co-pilot default to aigentMe (the user's regent operating their cartridge) or to a specialist? PRD assumes aigentMe-as-cartridge-copilot is the default; specialist is opt-in.
- **Q4:** Activation Catalogue auto-registration policy — public-only (PRD default), all-visibilities (chatty), opt-in checkbox in wizard (cleanest)?
- **Q5:** ventureQube v0.4 — sibling block (PRD default) vs. nested under `ventures[]` (lets one operator have multiple ventures each with their own cartridge)?
- **Q6:** Should the cartridge `slug` be auto-derived from the title (PRD default) or strictly user-chosen?
- **Q7:** Token whitelist MVP — is `{Q¢, USDC, KNYT}` correct, or should KNYT be opt-in (only relevant to KNYT-aligned cartridges)?
- **Q8:** Tab template extraction order — Pulse + Codex + Active + Overview first (PRD), or different priority?
- **Q9:** Approval rubric (§21a.5) — confirm the 6-point review bar, or extend with additional criteria (e.g., minimum cartridge age before submission eligible, minimum member count, owner verification tier)?
- **Q10:** Approval reviewers — who has the `metame-cartridge` admin grant for the approval queue? Today the grant resolver maps CRM tenant slugs to cartridge slugs (`services/access/cartridgeAdminGrants.ts:43`) — does `metame` already grant `metame-cartridge` admin, or does this need a new mapping?

---

## 36. Files Touched (forecast)

**New:**
- `components/metame/setup/CartridgeSetupWizard.tsx`
- `app/triad/components/codex/tabs/MyCartridgeTab.tsx` (owner view inside the myCluster TabGroup)
- `app/triad/components/codex/tabs/MyCartridgeManagerTab.tsx` (operator-tier surface; reached from MyCartridgeTab)
- `app/triad/components/codex/tabs/AdminActiveSurfaceApprovalsTab.tsx` (metaMe Admin sub-tab — §21a)
- `app/triad/components/codex/templates/{Pulse,Codex,Active,Overview,Wallet,Ledger,Community,Members,Venture,Settings,Admin,Experience}TabTemplate.tsx`
- `app/api/assistant/cartridge-config/route.ts`
- `app/api/assistant/cartridge-recommend/route.ts`
- `app/api/mycartridge/owner-view/route.ts`
- `app/api/activations/register/route.ts`
- `app/api/cartridge-activations/submit/route.ts`
- `app/api/admin/cartridge-activations/route.ts` (list, filterable by status)
- `app/api/admin/cartridge-activations/[catalogId]/approve/route.ts`
- `app/api/admin/cartridge-activations/[catalogId]/request-changes/route.ts`
- `app/api/admin/cartridge-activations/[catalogId]/reject/route.ts`
- `app/api/admin/cartridge-activations/precheck/route.ts`
- `app/api/mycanvas/publish-to-cartridge/route.ts`
- `types/ventureQube.ts`
- `services/iqube/ventureQubeSchema.ts`
- `supabase/migrations/2026XXXX_cartridge_memberships.sql`
- `supabase/migrations/2026XXXX_cartridge_activation_approvals.sql`

**Modified:**
- `types/codex.ts` (CodexConfig + CodexTab extensions)
- `types/access.ts` (cartridgeMemberships on cartridgeFlags)
- `app/(shell)/admin/codex/page.tsx` (label rebrand)
- `app/(shell)/admin/codex/[codexId]/page.tsx` (label rebrand)
- `app/triad/components/codex/TabRenderer.tsx` (template registry + MyCartridgeTab + AdminActiveSurfaceApprovalsTab registration)
- `app/triad/components/CodexPanelDynamic.tsx` (primaryTabSlug resolution)
- `app/hooks/useCodexConfig.ts` (primaryTabSlug + role-gated tabs)
- `services/identity/getActivePersona.ts` (return cartridgeMemberships)
- `services/access/evaluateAccess.ts` (cartridgeRole descriptor)
- `services/access/cartridgeAdminGrants.ts` (auto-grant owner_persona_id)
- `app/api/codex/chat/route.ts` (cartridgeSlug param)
- `app/api/persona/venture-iqube/ingest/route.ts` (v0.4 acceptance)
- `services/agents/specialistRouter.ts` (per-cartridge whitelist resolution)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (wizard CTA wiring + approval-status notification card)
- `app/triad/components/codex/tabs/MyCanvasTab.tsx` (publish-to-cartridge action)
- `services/activations/ActivationsContext.tsx` (read approved entries only; merge static + DB sources)
- `app/triad/components/codex/tabs/ActivationsTab.tsx` (status-filtered render)
- `data/codex-configs.ts`:
  - Line 2290: `id: 'myartifacts'` → `'mycluster'`, `label: 'myArtifacts'` → `'myCluster'`
  - Lines 2465 / 2481 / 2497: `group: 'myartifacts'` → `'mycluster'`
  - Add fourth sub-tab `myCartridge` in the same group
  - Add `admin-active-surface-approvals` sub-tab in the `admin` group (~line 2898)
  - Promote KNYT/Qripto/Venture Lab as `CartridgeTemplate` exports
- `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` (cross-link to v0.4)

**Spine-paramount files** (per CLAUDE.md — touch only with operator approval):
- `services/identity/getActivePersona.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `types/access.ts`

Approval requested before Phase 4 lands.

---

## 37. Required Reading Before Implementation

Per CLAUDE.md spine PARAMOUNT rule, before any code in Phases 4/8/10 lands:

1. `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md` (end-to-end).
2. `types/access.ts`.
3. `services/identity/getActivePersona.ts`.
4. `services/access/evaluateAccess.ts`.
5. `services/content/getContentDescriptor.ts`.

And run `node scripts/verify-spine.mjs` before merging any Phase that extends spine surface area.

---

## 38. References

| Concern | File |
|---|---|
| Codex Manager admin | `app/(shell)/admin/codex/page.tsx`, `app/(shell)/admin/codex/[codexId]/page.tsx` |
| Codex types | `types/codex.ts:71–137` |
| Codex configs | `data/codex-configs.ts:293` (KNYT), `:870` (Qripto), `:2035` (Venture Lab), `:3308` (definitions array) |
| Cartridge admin grants | `services/access/cartridgeAdminGrants.ts:91+` |
| Activation Catalogue | `data/activation-catalog.ts`, `services/activations/ActivationsContext.tsx`, `app/triad/components/codex/tabs/ActivationsTab.tsx` |
| Smart Triad | `app/components/content/SmartTriadProvider.tsx`, `app/components/codex/CodexCopilotLayer.tsx`, `app/api/codex/chat/route.ts` |
| Smart Wallet | `app/components/content/SmartWalletDrawer.tsx`, `app/components/wallet/TransactionModal.tsx`, `app/services/token/pricingService.ts` |
| ExperienceQube wizards | `components/metame/setup/ExperienceModelSetupWizard.tsx`, `components/metame/setup/PersonalGuideSetupWizard.tsx`, `app/api/assistant/experience-model/route.ts`, `app/api/assistant/experience-guide/route.ts` |
| Sibling rails | `app/triad/components/codex/tabs/MyCanvasTab.tsx`, `MyWorkspaceTab.tsx`, `MyLedgerTab.tsx`, `TabRenderer.tsx` |
| Specialists | `services/agents/specialistRouter.ts` |
| ventureQube schema | `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` |
| Welcome surface CTAs | `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx:1207–1220, 2228–2233` |
| Spine PARAMOUNT contract | `CLAUDE.md` § Identity & Access Spine |
| Inter-cartridge nav | `utils/codex-nav.ts`, `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` |

---

**End of draft v0.1. Awaiting operator review.**
