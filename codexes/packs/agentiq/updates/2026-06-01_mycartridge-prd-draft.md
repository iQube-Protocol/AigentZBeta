# myCartridge PRD — Draft v0.2

**Date:** 2026-06-01 (v0.1) · 2026-06-01 v0.2 (operator refinements folded)
**Status:** Draft for review — pre-implementation
**Owner:** dele@metame.com
**Sibling rails:** myWorkspace · myCanvas · myLedger · myCluster · myCartridge
**Companion wizards:** myExperienceModel · myExperienceGuide · myCartridge (new)
**Schema:** ventureQube v0.3 → v0.4 (extension proposed below)

> **Anchor framing.** myWorkspace is where the user works. myCanvas is where the user creates. myLedger is where the user verifies. myCartridge is where the user engages. myCluster is where the user organizes what they own.

> **System-level Triad (canonical, set in v0.2):** every engagement surface is a **Triad of {Cartridge, Copilot, Wallet}**. The Cartridge primitive itself decomposes into **Codex · Content · Menu · SmartActions** as sub-classes. The legacy "SmartTriad" label (SmartContent + SmartWallet + SmartMenu) is superseded — those become Cartridge sub-classes (Content, Menu) and a sibling rail (Wallet).

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

1. **Rebrand** the admin Codex Manager surface label to "myCartridge and Codex Manager" (super-admin tier; still gated by `isAdmin: true`).
2. **Mount** an operator-tier `MyCartridgeManagerTab` as a sub-tab in the **metaMe Admin group** (NOT a new top-level tab). Owner-scoped queries only — cannot see system cartridges.
3. **CartridgeSetupWizard** — 5-step wizard mirroring the Experience Model wizard pattern (Identity, Purpose, Tabs, Audience, Triad+ActiveTab+CatalogueOptIn).
4. **CartridgeTemplate** — promote KNYT / Qriptopian / Venture Lab as templates (operator selects from a starter set: Community, Venture, Knowledge Estate, Creative Universe).
5. **Tab templates** — Pulse, Codex, Active, Overview first; Wallet, Ledger, Community, Members, Settings, Admin, Experience, Venture stubbed.
6. **`primaryTabSlug` per cartridge** — auto-derived from category template, editable in wizard Step 4.
7. **Tab-level demarcation** — extend `CodexTab` with `memberOnly`, `inviteOnly`, `tokenGated`, `roleRequired`.
8. **Cartridge ownership** — add `ownerPersonaId` to `CodexConfig`; add a `cartridge_memberships` table.
9. **Activation surfacing** — opt-in at wizard time; enters `pending_metame` (MVP) or `pending_registry` (post-pilot).
10. **Codex inside cartridge** — every new myCartridge gets a default Codex tab; **myCanvas AND myWorkspace** entries can be published into it OR the Community tab.
11. **Cartridge KB stub** — extend `/api/codex/chat` with `cartridgeSlug`; support **JSON blob upload as a KB source**; embedding pipeline ships in v0.5.
12. **Cartridge Wallet** — `SmartWalletDrawer` with `cartridgeSlug` in the cartridge's Wallet tab. Send + receive + payment-request + reward primitives. Token whitelist defaults to **{Q¢, USDC}** with KNYT opt-in.
13. **Specialist stub with free-tier gate** — `availableSpecialists` capped at ≤3 in free tier; 4th+ payment-gated (UI ships in MVP; payment flow stubbed).
14. **Triad nomenclature** — system-level rename from "SmartTriad" to **Triad = {Cartridge, Copilot, Wallet}**; Codex/Content/Menu/SmartActions become Cartridge sub-classes.
15. **myCluster rebrand** — `data/codex-configs.ts:2290` TabGroup rename + sub-tab `group:` updates + new `myCartridge` sub-tab. Order: **myCanvas / myWorkspace / myCartridge / myLedger**.
16. **ventureQube v0.4** — schema extension with `myCartridge` block **nested under `ventures[]`** (1 venture per persona for MVP; sys-admins may exceed); see §27.
17. **State change receipts** — every cartridge creation, tab visibility change, crypto-send, payment-request, reward, catalogue submission, and stage transition emits a DVN receipt to myLedger.
18. **Active Surface Access / Requests (§21a)** — MVP runs **metaMe stage only** with Registry + Studio stages typed but auto-approved via `CARTRIDGE_APPROVAL_STAGES = 'metame-only'`; pilot flips to full three-stage chain. Owner-side primary surface is `MyCartridgeTab → Activation Requests` sub-tab + new `admin-active-surface-access-requests` sub-tab in metaMe Admin (extending the existing `admin-access-requests` non-admin-extended pattern).
19. **System cartridge isolation** — operator-tier `MyCartridgeManagerTab` cannot list system cartridges. RLS + tokenQube + `isAdmin` gate compounded.

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
  │     ├── myCanvas        (existing — group rename)
  │     ├── myWorkspace     (existing — group rename)
  │     ├── myCartridge     ◄── NEW sub-tab (order matters: between Workspace and Ledger)
  │     │     ├── (if no cartridge) → CartridgeSetupWizard CTA
  │     │     └── (if configured)   → owner view (mostly external-facing summary):
  │     │           ├── identity, primary tab, copilot stance, wallet stance
  │     │           ├── public-facing card preview (what visitors see)
  │     │           └── shortcut to Cartridge runtime + Activation Requests sub-tab
  │     └── myLedger        (existing — group rename; moved AFTER myCartridge)
  ├── Activations
  ├── KNYT          (activation-gated)
  ├── Venture Lab   (activation-gated)
  ├── Marketa       (activation-gated)
  ├── metaMe Studio (activation-gated)
  ├── AgentiQ OS    (activation-gated)
  ├── Qriptopia     (activation-gated)
  └── Admin         (admin-gated — operator's own admin panel for their cartridge(s))
        ├── Journey Dashboard
        ├── Access Requests (existing — already extended to non-admin user requests)
        ├── Active Surface Access / Requests ◄── NEW sub-tab — owner-side primary surface (§21a)
        ├── My Cartridge Manager ◄── NEW sub-tab — operator-tier cartridge admin:
        │     ├── Identity edit (name, description, purpose, icon)
        │     ├── Tabs edit (visibility, reorder, primaryTabSlug)
        │     ├── Members & roles (invite, role change, revoke)
        │     ├── Copilot config (source, KB sources, JSON blob upload)
        │     ├── Wallet config (token whitelist, primitives)
        │     ├── Specialists (≤3 free; payment-gated above)
        │     ├── Activated foreign tabs (cartridges I've activated tabs from)
        │     ├── Published content pointers (canvases/workspace published here)
        │     └── Ledger receipts scoped to this cartridge
        └── (other system admin sub-tabs)

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

myCluster is the rebranded TabGroup that holds **myCanvas / myWorkspace / myCartridge / myLedger** (in that order, v0.2). The rail itself is implemented as a one-line edit in `data/codex-configs.ts:2290` (group id + label) plus updates to the existing sub-tabs (`group: 'myartifacts'` → `'mycluster'` at lines 2465 / 2481 / 2497) and one new sub-tab insertion.

### 12.1 Sub-tab order and intent

The order matters — it mirrors the user's workflow:
1. **myCanvas** (create) — the user makes something.
2. **myWorkspace** (refine) — the user works on it privately.
3. **myCartridge** (engage) — the user surfaces what they own as an external-facing engagement estate.
4. **myLedger** (verify) — the user reviews receipts for everything that happened.

The myCartridge sub-tab is **mostly external-facing** — it shows what visitors to the user's cartridge see. The heavy operational content (owned cartridges list, activated foreign tabs, published content pointers, ledger receipts scoped to a cartridge) lives in the **metaMe Admin → My Cartridge Manager** sub-tab (see §11 IA). That separation reflects an operator framing: the cartridge surface is public-facing posture; the admin surface is the operator's private control room.

### 12.2 What lives where

| Surface | Primary audience | Content |
|---|---|---|
| myCluster → myCartridge sub-tab | Cartridge owner reviewing their external posture | Identity card, primary tab summary, public-facing preview, copilot/wallet stance, shortcut to cartridge runtime, shortcut to Activation Requests |
| metaMe Admin → My Cartridge Manager | Cartridge owner operating their cartridge | Identity edit, tabs edit, members + roles, copilot config + KB sources + JSON blob upload, wallet config, specialist whitelist, activated foreign tabs list, published-here pointers, ledger receipts filtered by cartridge |
| Cartridge runtime (`/triad/embed/codex/{slug}`) | Visitors AND owner | The cartridge as anyone sees it — Overview, Active Tab, Codex, Pulse, etc. |

### 12.3 Implementation surface

- Component: `MyCartridgeTab.tsx`, registered in `TabRenderer.tsx`.
- Position: third sub-tab in the myCluster group (order: 2; myLedger shifts to order 3).
- Behavior:
  - If the active persona has no cartridge configured → CartridgeSetupWizard CTA.
  - If configured → external-facing summary (per 12.2 row 1).
- Backing API: `GET /api/mycartridge/owner-summary?personaId=...` returns the external-facing fields only. Owner-tier control fields go to `GET /api/mycartridge/admin-detail?personaId=...` (called from MyCartridgeManagerTab inside the metaMe Admin group).

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

## 15. Triad Requirements (Cartridge + Copilot + Wallet)

**Naming correction (v0.2):** the system-level engagement Triad is **Cartridge + Copilot + Wallet**. The Cartridge primitive contains **Codex · Content · Menu · SmartActions** as sub-classes. The previously-named "SmartTriad" (SmartContent / SmartWallet / SmartMenu) is retired as a top-level concept; its members fold into this taxonomy.

### 15.1 The three Triad primitives

```ts
type Triad = {
  cartridge: CartridgePrimitive;   // the engagement estate
  copilot:   CopilotPrimitive;     // the operator + KB
  wallet:    WalletPrimitive;      // the value rail
};
```

### 15.2 Cartridge sub-classes

A Cartridge decomposes into four sub-classes — each addressable independently in code, but all riding under the cartridge identity:

```ts
type CartridgePrimitive = {
  identity: {                       // who/what the cartridge is
    slug: string;
    title: string;
    description: string;
    purpose: string;
    category: CartridgeCategory;
    visibility: 'public' | 'private' | 'invite-only' | 'member-only';
    ownerPersonaId: string;         // T0 — server-only
  };
  codex: {                          // canonical, structured assets — INCLUDES DVN receipts
    enabled: boolean;
    rootTabSlug: 'codex';
    receiptKinds: ReceiptKind[];    // DVN receipts surfaced inside Codex
    registryEligible: boolean;      // cartridge active tab is iQube-eligible — gates §21a chain
    mintingEnabled: boolean;        // ContentQube minting from Codex entries (v0.5)
  };
  content: {                        // myCanvas + myWorkspace publishing surface
    publishSources: ('mycanvas' | 'myworkspace')[];  // both can publish
    publishTargets: ('codex' | 'community')[];       // tabs that accept publishes
  };
  menu: {                           // tab strip + navigation
    tabs: CartridgeTabSpec[];
    primaryTabSlug: string;
  };
  smartActions: {                   // action chips, NBE invocations, specialist routing
    availableSpecialists: SpecialistId[];   // gated: free tier ≤3 (see §35 R7)
    actionWhitelist: string[];
  };
};
```

### 15.3 Copilot primitive

```ts
type CopilotPrimitive = {
  // MVP: default is the user's own aigentMe operating the cartridge
  // Future stub: cartridge-level copilot persona separate from owner's aigentMe
  source: 'aigentMe' | 'cartridge-copilot' | 'specialist';
  cartridgeCopilotPersonaId?: string;   // STUB for future; null in MVP
  promptContext: string;                // derived from cartridge.identity.purpose
  knowledgeBase: {
    sources: KBSource[];
    // NEW (v0.2): JSON blob upload as a first-class KB source
    jsonBlob?: { uri: string; uploadedAt: string; sizeBytes: number };
    embeddingStatus: 'pending' | 'ready' | 'stale';
  };
};
```

**MVP default:** `source = 'aigentMe'`. The user's own regent operates the cartridge. **Future stub (typed but not wired):** `source = 'cartridge-copilot'` lets a cartridge owner spin up a cartridge-scoped copilot persona with its own KB, separate from their personal aigentMe. Stub the field; defer the wiring.

**KB sources (v0.2):**
- `mycanvas` entries published into the cartridge.
- `myworkspace` entries the owner explicitly tags `kb-include`.
- Uploaded docs (≤5 in MVP).
- **NEW:** uploaded JSON blob (single file, schema-free, treated as opaque text for embedding). Cartridge owner picks the upload in Step 5 of the wizard or later from MyCartridgeManagerTab.

### 15.4 Wallet primitive

```ts
type WalletPrimitive = {
  enabled: boolean;
  tokenWhitelist: TokenId[];                            // MVP: {Q¢, USDC, KNYT (KNYT opt-in)}
  cartridgeScopedPersonaId?: string;
  primitives: {
    cryptoSend: boolean;                                // rewards + payments
    cryptoReceive: boolean;                             // owner can receive
    paymentRequest: boolean;                            // owner can request payment from visitor
    rewardPayout: boolean;                              // owner can issue rewards
  };
};
```

**Wallet primitives MVP scope:** crypto-send (for rewards and payments), crypto-receive, and payment-request (the cartridge owner can request payment from a visiting persona inside the cartridge Wallet tab — the visitor sees the request as a TransactionModal pre-fill).

### 15.5 Triad contract

The three primitives ride together. You cannot configure a Cartridge without declaring its Copilot and Wallet stance — even if Wallet is `enabled: false`, the cartridge config records that explicit choice. The wizard collects all three in Step 5.

Removing or stubbing any primitive without the others breaks the Triad contract.

---

## 16. Cartridge Copilot Model

Reuse `CodexCopilotLayer`. Extend by:
- Passing `cartridgeSlug` to `getChatRequestContext()` so `/api/codex/chat` can scope KB + system prompt.
- Adding a `cartridgePromptContext` string to the chat request (cartridge purpose, audience, owner's stated intent) — sourced from ventureQube v0.4 `myCartridge.purpose`.

**MVP default — `source: 'aigentMe'`:** the cartridge copilot IS the cartridge owner's own aigentMe operating their cartridge with cartridge-scoped context. No new persona is created. Visitors to the cartridge see the owner's aigentMe in the copilot drawer.

**Future stub — `source: 'cartridge-copilot'`:** the cartridge owner can spin up a cartridge-scoped copilot persona separate from their personal aigentMe. This copilot has its own KB, its own prompt context, and visitors see it (not the owner's aigentMe) when they invoke the copilot drawer. The field is TYPED in v0.4 schema but UNWIRED in MVP — see §29.6.

**Future stub — `source: 'specialist'`:** the cartridge owner can pin a specialist (Kn0w1 for community, Marketa for partner, etc.) as the primary copilot voice. Stub in v0.4 schema; specialist routing already exists in `specialistRouter.ts` so wiring is straightforward in v0.5.

**Server-side:** `/api/codex/chat` accepts optional `cartridgeSlug`. If provided:
- `embeddingService.hybridSearch(query, domain, { cartridgeSlug })` (extended signature).
- System prompt prepends `cartridgePromptContext` and the cartridge's `availableSpecialists` list (so the model can suggest handoffs).
- The aigentMe persona resolves to the cartridge owner (not the visitor) for MVP — so the copilot speaks as the owner's regent on their behalf.

---

## 17. Cartridge Knowledge Base Model

MVP: cartridge KB is a thin index over the following sources:
- **a)** the cartridge's Codex entries,
- **b)** the owner's **myCanvas** entries published into the cartridge,
- **c)** the owner's **myWorkspace** entries explicitly tagged `kb-include`,
- **d)** uploaded docs (MVP: 5 docs per cartridge limit),
- **e)** **NEW (v0.2):** uploaded **JSON blob** (single file, schema-free, embedded as opaque text). The blob is the simplest path for a cartridge owner to seed KB with structured domain knowledge they already maintain elsewhere (FAQ JSON, product catalogue JSON, lore bible JSON, etc.).

Storage:
- `cartridge_kb_sources` table `{cartridge_slug, source_type, source_id, embedded_at, status}` — `source_type` includes `'codex' | 'mycanvas' | 'myworkspace' | 'upload' | 'json_blob'`.
- Embeddings live alongside existing `content_embeddings` but with a `cartridge_slug` column for scoping.
- JSON blob storage: a single row per cartridge in `cartridge_kb_sources` with `source_type = 'json_blob'`; the blob itself goes to Supabase Storage at `cartridge-kb/{cartridge_slug}/blob.json` (RLS: owner read/write, no public read).

Per-cartridge KB is a v0.5 deliverable in full. MVP wires the JSON blob upload path and the source-type column; embedding pipeline + RAG retrieval against cartridge-scoped KB ships in v0.5. MVP fallback: if cartridge KB is empty, copilot falls back to domain-scoped KB.

---

## 18. Cartridge Codex Model

Every myCartridge auto-gets a Codex tab. The Codex tab is a thin viewer over `cartridge_codex_entries` (new table) `{cartridge_slug, entry_id, title, body_md, published_at, status, source, source_id, dvn_receipt_id}` where:
- `source` ∈ `'mycanvas' | 'myworkspace' | 'upload' | 'direct'`
- `dvn_receipt_id` (nullable) — when set, the Codex entry surfaces its DVN receipt inline. Codex is the canonical surface for cartridge state-change receipts visible to members; the underlying receipt also lives in myLedger for the owner.

**Publishing paths (v0.2):**

1. **From myCanvas** — extend `MyCanvasTab` "Publish" action with `targetCartridgeSlug` + `targetTabSlug` selectors (`codex` or `community`). POST to `/api/mycanvas/publish-to-cartridge` writes either a `cartridge_codex_entries` row (Codex target) or a `cartridge_community_posts` row (Community target).
2. **From myWorkspace** — same path, extended on `MyWorkspaceTab`. The owner can promote a private workspace entry into the cartridge Codex or Community tab; the entry stays in myWorkspace as the working copy with a "published" badge.
3. **Direct authoring** — owner can author directly in the Codex tab via a markdown editor.

**Registry / Studio / metaMe approval chain (see §21a):** Codex entries flagged `registryEligible: true` (e.g., the cartridge's active tab promotion to the metaMe Activations Catalogue) must clear the three-stage approval chain before they become discoverable beyond the cartridge.

---

## 19. Cartridge Wallet — Send / Receive / Request / Reward

MVP wallet primitives in the cartridge Wallet tab:

- **Crypto-send for rewards** — owner can send a reward (e.g., Q¢ payout to a member who completed a Codex quest).
- **Crypto-send for payments** — owner can send a payment (e.g., paying a contributor).
- **Crypto-receive** — owner can receive any whitelisted token; address QR + copy.
- **Payment request** — owner can request a payment from a visiting persona. The request renders to the visitor as a pre-filled `TransactionModal` with the recipient and amount locked.

Cartridge Wallet tab mounts `SmartWalletDrawer` with `cartridgeSlug` prop (already supported, `app/components/content/SmartWalletDrawer.tsx:182`). Token whitelist from cartridge config:
- Defaults: **Q¢, USDC** (always available unless explicitly disabled).
- **KNYT is opt-in** at wizard time — only relevant to KNYT-aligned cartridges; off by default.
- Bespoke per-cartridge tokens deferred to v0.5.

Send / Receive / Verify mechanics work as today via the existing `TransactionModal`. New: a `mode: 'request'` variant on `TransactionModal` for the payment-request flow (generates a shareable / cartridge-embedded request payload).

Future (post-MVP):
- Per-cartridge token (bespoke ERC-20 deploy from inside the wizard) — payment-gated (see §35 R7).
- Token-gated tabs (`tokenGated: { tokenId, minBalance }` on CodexTab — typed in MVP, UI deferred).
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

## 21a. Active Surface Access / Requests — Three-Stage Approval Chain

**Naming correction (v0.2):** what v0.1 called "Active Surface Approvals" is renamed **"Active Surface Access / Requests"** to reflect that the primary user of this surface is the **non-admin cartridge owner** submitting their own active tab for catalogue inclusion, NOT a platform admin. The existing `admin-access-requests` sub-tab in the metaMe Admin group was already extended for non-admin user requests; this surface generalizes that pattern.

### 21a.0 MVP scope — single-stage (metaMe only); three-stage stubbed for pilot

**For MVP:** the approval chain runs **metaMe admin stage only**. Registry and Studio stages are **typed in the schema and table but auto-approved** at submission time. Owners see a single approval gate. This keeps MVP shippable without standing up two new reviewer cohorts.

**For post-MVP pilot phase:** the auto-approve flags on Registry and Studio stages flip off; the full three-stage chain activates. The schema, table columns, lifecycle enum values (`pending_registry`, `pending_studio`, `needs_registry_changes`, `needs_studio_changes`, etc.), reviewer sub-tabs (Registry / Studio), and pre-check route signatures are all wired in MVP so the v0.5 pilot can flip a feature flag rather than refactor.

Implementation toggle: a server-side flag `CARTRIDGE_APPROVAL_STAGES` ∈ `{'metame-only', 'registry+studio+metame'}` controls whether Registry and Studio stages auto-approve. MVP ships with `'metame-only'`. The three reviewer sub-tabs (§21a.4.2 A and B) ship typed but hidden in MVP via a `pilotOnly: true` flag honored by `getEnabledTabs()`. metaMe stage sub-tab (§21a.4.2 C) ships visible.

**Three-stage approval chain (post-MVP pilot):** A user-created myCartridge active tab being included in the metaMe Activation Catalogue MUST clear three sequential gates:

```
[wizard save / register]
        │
        ▼
   stage 1: iQube Registry approval
        │   (cartridge active tab IS an iQube — must clear Registry threshold)
        ▼
   stage 2: Studio approval
        │   (verifies template/agent/service integrations; material if cartridge
        │    integrates new agents or outside services)
        ▼
   stage 3: metaMe admin approval
        │   (final distribution gate — only approved entries surface in the
        │    public Activation Catalogue)
        ▼
   approved ────► visible in Activation Catalogue, browseable by any persona
```

A cartridge being **created** is never blocked by this chain — the owner can operate their cartridge privately the moment the wizard saves. The chain ONLY governs **catalogue inclusion** (whether another persona can discover and activate the cartridge's active tab via the metaMe Activations surface).

**Why three stages:** The cartridge active tab is an iQube. As cartridges scale, they will integrate Studio services, custom agents, and Registry-listed primitives. Registry + Studio gating ensures that what gets distributed at platform scale clears the same quality + safety bar as any platform iQube. metaMe admin approval is the final editorial/distribution filter — as the system scales, approval standards and criteria rise.

### 21a.1 Lifecycle

```
status flow per submission:
  pending_registry  →  needs_registry_changes  →  pending_registry (re-submit)
                   →  registry_rejected (terminal)
                   →  pending_studio  →  needs_studio_changes  →  pending_studio
                                     →  studio_rejected (terminal)
                                     →  pending_metame  →  needs_metame_changes  →  pending_metame
                                                       →  metame_rejected (terminal)
                                                       →  approved (terminal, catalogue-visible)
```

Visibility:
- `pending_*` and `needs_*_changes`: visible to cartridge owner + the relevant reviewer tier.
- `*_rejected` (any stage): visible to owner with reason; resubmission opens a new chain.
- `approved`: visible everywhere via Activation Catalogue.

### 21a.2 Storage

New table `cartridge_activation_approvals`:

```sql
catalog_id          TEXT PRIMARY KEY,         -- from cartridge_activations.catalog_id
cartridge_slug      TEXT NOT NULL,
tab_slug            TEXT NOT NULL,
owner_persona_id    UUID NOT NULL,
status              TEXT NOT NULL,            -- see lifecycle enum above
current_stage       TEXT NOT NULL CHECK (current_stage IN ('registry','studio','metame','approved')),
submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
registry_reviewed_at TIMESTAMPTZ,
registry_reviewed_by UUID,
registry_notes       TEXT,
studio_reviewed_at  TIMESTAMPTZ,
studio_reviewed_by  UUID,
studio_notes        TEXT,
metame_reviewed_at  TIMESTAMPTZ,
metame_reviewed_by  UUID,
metame_notes        TEXT,
metrics_proposed    JSONB,
actions_proposed    JSONB,
visibility_proposed TEXT NOT NULL CHECK (visibility_proposed IN ('public','member','invite-only')),
revision            INTEGER NOT NULL DEFAULT 1
```

RLS:
- Owner can read their own rows.
- Registry reviewers (`persona.cartridgeFlags.adminCartridges` includes `'iqube-registry'`) can read all + write registry-stage fields.
- Studio reviewers (`adminCartridges` includes `'metame-studio'`) can read all + write studio-stage fields.
- metaMe admins (`adminCartridges` includes `'metame-cartridge'`) can read all + write metame-stage fields.

### 21a.3 Submission paths

1. **Automatic at wizard save** — if the user picks `visibility: public` in Step 4 AND opts in to "Submit for catalogue inclusion" in Step 5, the `/api/assistant/cartridge-config` POST also inserts a row at `status: 'pending_registry'`.
2. **Manual later** — from the operator-tier `MyCartridgeManagerTab`, the owner clicks "Submit active tab to metaMe catalogue" which POSTs `/api/cartridge-activations/submit` with the catalog_id.
3. **Re-submission after needs-changes or rejection** — the owner can edit and resubmit at the same stage; revision counter increments; stage-specific reviewed_at / reviewed_by clear.

### 21a.4 Approval surfaces

#### 21a.4.1 Owner-side: Active Surface Access / Requests (in the cartridge owner's metaMe runtime)

This is the **primary surface** — non-admin cartridge owners viewing the status of their own submissions and authoring new ones.

Surface: a sub-tab inside `MyCartridgeTab` (the new sub-tab in the myCluster TabGroup) labelled "Activation Requests". Component: `MyCartridgeActivationRequestsTab.tsx`.

Owner sees:
- Each of their cartridges' submissions with current stage + status.
- A timeline view: Registry → Studio → metaMe — each stage shows ✓ approved / ⏳ pending / ↺ needs changes / ✕ rejected with notes from the reviewer.
- "Resubmit" button when in a `needs_changes` state.
- "Submit new active tab" button to start a chain manually.

#### 21a.4.2 Reviewer-side: three new admin sub-tabs (one per stage)

Each reviewer tier gets its own admin sub-tab. None of these is the "primary" surface — owners are the primary group per the operator brief.

**A. Registry stage** — new sub-tab in the **iQube Registry cartridge** Admin group (NOT the metaMe Admin group):
```ts
{
  id: 'admin-registry-activation-review',
  label: 'Active Surface Registry Review',
  slug: 'registry-activation-review',
  group: 'admin',
  type: 'static',
  config: { component: 'AdminRegistryActivationReviewTab', props: {} },
  metadata: { icon: 'ShieldCheck', description: 'Stage 1 of 3: verify active-tab iQube against Registry threshold', color: 'amber' }
}
```

**B. Studio stage** — new sub-tab in the **metaMe Studio cartridge** Admin group:
```ts
{
  id: 'admin-studio-activation-review',
  label: 'Active Surface Studio Review',
  slug: 'studio-activation-review',
  group: 'admin',
  type: 'static',
  config: { component: 'AdminStudioActivationReviewTab', props: {} },
  metadata: { icon: 'Wand2', description: 'Stage 2 of 3: verify template + agent + service integrations', color: 'violet' }
}
```

**C. metaMe stage** — new sub-tab in the **metaMe cartridge** Admin group (extends the existing `admin-access-requests` pattern):
```ts
{
  id: 'admin-active-surface-access-requests',
  label: 'Active Surface Access / Requests',
  slug: 'active-surface-access-requests',
  group: 'admin',
  type: 'static',
  config: { component: 'AdminActiveSurfaceAccessRequestsTab', props: {} },
  metadata: { icon: 'Check', description: 'Stage 3 of 3: final distribution approval for the metaMe Activation Catalogue', color: 'cyan' }
}
```

All three reviewer surfaces share the same UX shell (status filter, row list, detail drawer, approve/request-changes/reject actions, DVN receipt emission) — only the rubric and the JSONB notes field differ.

### 21a.5 Approval criteria (review rubrics per stage)

#### Stage 1: iQube Registry

The cartridge active tab is an iQube. It must clear:
1. **Provenance** — the cartridge config and active-tab config have not been tampered with after creation (server-side hash check).
2. **Identity binding** — `owner_persona_id` matches `codex_configs.owner_persona_id` (no impersonation).
3. **No prohibited integrations** — does the cartridge wire any unregistered agent or outside service? If yes, those integrations must each be Registry-listed.
4. **Schema integrity** — ventureQube v0.4 `myCartridge` block validates against the schema.
5. **Spine compliance** — `verify-spine.mjs --cartridge=<slug>` passes.

#### Stage 2: Studio

1. **Template fidelity** — picked `templateId`s exist in the approved `TAB_TEMPLATES` registry; no custom-code overrides.
2. **Agent integration audit** — if the cartridge declares `cartridge.copilot.source = 'cartridge-copilot'` OR `availableSpecialists` extends beyond the free tier (>3), Studio reviews the integration model.
3. **Outside service integration** — if the cartridge wires external services (webhooks, partner APIs), each integration is reviewed for security + data-handling posture.
4. **Experience matrix alignment** — if the cartridge uses a customized Experience Matrix template (per §22 Members template), Studio reviews the customization against the canonical metaMe template.

#### Stage 3: metaMe admin (editorial / distribution)

1. **Identity completeness** — name, description, purpose, category all present and non-trivial.
2. **Purpose alignment** — the active tab actually does something a visiting persona could engage with.
3. **Audience honesty** — declared audience matches actual content posture.
4. **No prohibited content** — same content policy as system cartridges.
5. **Catalogue fit** — does this entry add distinct value vs. existing catalogue entries, or is it duplicative? (Filter scales with system scale — see §35 R5.)
6. **Distribution tier appropriateness** — is the requested `visibility_proposed` (public / member / invite-only) appropriate for the content? metaMe admin can approve at a lower tier than requested.

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

### 21a.6 Automated pre-checks (run at each stage gate)

Before a submission reaches a human reviewer at any stage, run automated checks via `/api/cartridge-activations/precheck?stage=registry|studio|metame`:

**Registry stage pre-check:**
- Verifies `owner_persona_id` matches `codex_configs.owner_persona_id` (no impersonation).
- Verifies all referenced `tab_slug`s exist in `codex_tabs`.
- Verifies ventureQube v0.4 `myCartridge` block validates against schema (Zod).
- Verifies provenance hash matches stored hash at creation time.
- Runs `verify-spine.mjs --cartridge=<slug>`.

**Studio stage pre-check:**
- Verifies `templateId` is in the approved `TAB_TEMPLATES` registry.
- Verifies `availableSpecialists[]` ⊆ free tier (≤3) OR payment record exists for extended specialist tier (see §35 R7).
- Verifies any declared external service integration has a Registry-listed entry.

**metaMe stage pre-check:**
- Verifies `metrics[]` / `actions[]` shapes match `ActivationCatalogEntry`.
- Runs catalogue-duplication heuristic (string similarity to existing entries).
- Verifies `visibility_proposed` is appropriate for the declared category (e.g., `private` cartridges cannot submit `public`).

Pre-check failures auto-mark the submission `needs_*_changes` at the current stage with a machine-generated reason; no human time spent on broken submissions.

### 21a.7 Notification surface

When status changes at any stage, the cartridge owner sees:
- An aigentMe in-runtime card on next welcome surface load: "Your cartridge X active tab — Registry: approved / Studio: needs changes — [open Activation Requests]".
- A row in their myLedger (`actionType: 'cartridge_activation_reviewed'`, `stage` in metadata).
- A status row in their `MyCartridgeTab → Activation Requests` sub-tab (the owner-side primary surface — see §21a.4.1).
- Optional email if `notify_on_review` flag set on the persona (not MVP).

### 21a.8 Super-admin tier passthrough

Super-admins (platform tier) have a meta-view at `/admin/codex` (rebranded "myCartridge and Codex Manager") under a new "Catalogue Submissions" section. They see the same queue with cross-stage visibility — useful for ops triage when one stage stalls.

### 21a.9 Why this is NOT just an admin queue (operator framing)

The non-admin cartridge owner submitting their own active tab IS the primary user of this surface. The three admin tiers (Registry / Studio / metaMe) are review surfaces, but volume-wise the owner-side surface (`MyCartridgeTab → Activation Requests`) gets the most traffic. Naming and visual posture of the feature lead with the owner's experience, not the admin's queue.

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
- **`MembersTabTemplate`** — mirrors the KNYT cartridge members surface AND wires to the cartridge's Experience Matrix per the canonical metaMe Experience Matrix template in Studio. Cartridge owner can either:
  - Use the **standard metaMe Experience Matrix template** as-is (default), OR
  - Configure a **customized version** derived from their ventureQube (Studio stage of approval chain reviews customizations — see §21a.5).
  - This means the Members template gives the cartridge owner a ladder + maturity dashboard for their members from day one, mirroring how KNYT operators see their patronage / PCS ladder.
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
- Venture → `['aigent-c', 'moneypenny', 'marketa']`   ◄── v0.2: aigent-c (not aigent-z)
- Knowledge Estate → `['quill', 'kn0w1']`
- Creative Universe → `['quill', 'metaye', 'kn0w1']`  ◄── v0.2: kn0w1 added

**Free tier cap:** ≤3 specialists per cartridge in MVP (see §35 R7). Adding a 4th or more triggers a payment-gated upgrade — typed in MVP, payment wiring deferred.

Cartridge copilot surfaces only the available specialists. `SpecialistContext.activeCartridge` (existing) carries the slug. Specialist responses with `requiresApproval: true` route through myWorkspace pending-approval flow (existing). All specialist invocations emit DVN receipts to myLedger (existing).

---

## 25. myCanvas / myWorkspace / myLedger Relationship

myCartridge does not absorb the rails — it joins them.

- **myCanvas** publishes into a cartridge's **Codex tab OR Community tab** via the `publish-to-cartridge` action. The publish modal lets the owner pick the target tab; defaults to Codex.
- **myWorkspace** publishes into a cartridge's **Codex tab OR Community tab** via the same `publish-to-cartridge` action. Private workspace drafts can be promoted directly; the workspace entry retains a "published" badge.
- **myLedger** receives DVN receipts for every cartridge state change (cartridge created, member invited, tab visibility changed, crypto-send executed, payment requested, Codex entry published, catalogue submission stage transitions).
- **myCluster** is the rebranded TabGroup holding myCanvas / myWorkspace / myCartridge / myLedger as sub-tabs in that order (§12).

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

Extend `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` → v0.4 with a **`myCartridge` block nested under `ventures[]`** (per Q5 resolution v0.2). For MVP, each persona has at most 1 venture entry (sys admins exceed); the venture entry carries the `myCartridge` configuration:

```jsonc
{
  "schemaVersion": "venture-iqube/v0.4",
  "operator": "string",
  "strategy": "string",
  "ventures": [
    {
      /* unchanged v0.3 fields: cartridgeBindings, objectives, plan, horizon, specialistId */

      /* NEW in v0.4 — nested per-venture myCartridge config (MVP: 1 venture per persona) */
      "myCartridge": {
        "configured": true,
        "slug": "string (URL-safe, auto-derived from title, editable)",
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
          "receiptKinds": ["created", "tab_visibility", "member_invited", "crypto_send", "payment_request", "reward_payout", "codex_published", "activation_submitted", "activation_reviewed"]
        },
        "triadNomenclature": "v0.2"  // pins the {Cartridge, Copilot, Wallet} Triad shape; legacy "smartTriad" key not allowed
      }
    }
  ]
}
```

**Schema fix note:** the v0.4 block shown in v0.1 of this PRD as a top-level sibling to `ventures` is **superseded** by the v0.2 reading above — the block lives nested under each `ventures[]` entry. Each persona has 1 venture in MVP; sys admins may have more, each with its own `myCartridge`.

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
5. **Triad + Active Tab + Catalogue opt-in** — three sub-sections:
   - **Cartridge** sub-classes confirmation — Codex on (always for MVP), Content sources (myCanvas+myWorkspace), Menu primary tab (from §4), SmartActions specialists (≤3 from recommended `availableSpecialists`; 4th+ shows payment-gated upgrade lock).
   - **Copilot** — radio: aigentMe (default, MVP), specialist (opt-in), or cartridge-copilot (typed stub, disabled in MVP). KB sources: myCanvas published + myWorkspace tagged + uploaded docs + **JSON blob upload (drag-drop or paste-path)**.
   - **Wallet** — toggle on/off. If on: token whitelist (Q¢ + USDC default; KNYT opt-in checkbox); enable crypto-send/receive/payment-request/reward primitives.
   - **Active Tab** — pick `activeTab` from enabled tabs (defaults to `primaryTabSlug`).
   - **Catalogue opt-in** — checkbox "Submit my active tab to the metaMe Activation Catalogue for review" — visible only if `visibility = public` was picked in Step 4. Enters the approval chain at `pending_metame` (MVP) or `pending_registry` (post-pilot).
   - Confirm + Save.

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
| 2 — myCluster rail (TabGroup rename + myCartridge sub-tab; order: Canvas/Workspace/Cartridge/Ledger) | 0.5d | — |
| 3 — ventureQube v0.4 (nested under ventures[]) + types + Zod | 1d | — |
| 4 — DB + roles + cartridgeAdminGrants mappings (Q10) + system cartridge isolation gates | 2.5d | 3 |
| 5 — tab templates (Pulse + Codex + Active + Overview first; Members mirrors KNYT + experience-matrix wiring) | 3d | 4 |
| 6 — wizard (5 steps incl. JSON blob upload + catalogue opt-in + specialist free-tier lock) | 2.5d | 3, 5 |
| 7 — operator manager (inside metaMe Admin, owner-scoped only) | 2d | 4, 5 |
| 8 — Triad scoping (`cartridgeSlug` on chat route; aigentMe-as-cartridge-copilot resolution) | 2d | 4 |
| 9 — wallet integration (send + receive + payment-request + reward; TransactionModal `mode: 'request'`) | 1.5d | 5 |
| 10 — receipts + catalogue (pending entries; opt-in flow) | 1d | 4, 7 |
| 11 — Active Surface Access / Requests (§21a — MVP metaMe-only stage; Registry+Studio typed but auto-approved) | 2d | 4, 10 |
| 12 — system cartridge isolation hardening (RLS + tokenQube test cases, R3 resolution) | 1d | 4 |

**Total MVP:** ~19.5 engineering days (one engineer, conservative).

**Post-MVP pilot (separate scope):**
- Light up Registry stage reviewer cohort + sub-tab + rubric.
- Light up Studio stage reviewer cohort + sub-tab + rubric.
- Flip `CARTRIDGE_APPROVAL_STAGES` to `'registry+studio+metame'`.
- Wire payment flow for specialist >3 cap.
- Wire per-cartridge KB embedding pipeline.
- Wire cartridge-level copilot persona (separate from owner aigentMe).

---

## 34. Acceptance Criteria

1. ✓ The myArtifacts TabGroup at `data/codex-configs.ts:2290` is renamed to myCluster and contains four sub-tabs in this order: **myCanvas, myWorkspace, myCartridge, myLedger**.
2. ✓ A user with no cartridge sees the CartridgeSetupWizard CTA in their `MyCartridgeTab` AND in the aigentMe welcome surface.
3. ✓ The 5-step wizard completes and produces a `codex_configs` row with `owner_persona_id` set, plus rows in `cartridge_memberships`, `cartridge_activations`, `codex_tabs`, and a ventureQube v0.4 update nested under `ventures[0].myCartridge`.
4. ✓ The new cartridge is reachable at `/triad/embed/codex/{slug}` and renders its primary tab (declared `primaryTabSlug`, auto-derived from category but editable).
5. ✓ The cartridge copilot loads with cartridge-scoped prompt context AND `source: 'aigentMe'` resolves to the cartridge owner's regent (not the visitor).
6. ✓ The cartridge Wallet tab opens `SmartWalletDrawer` with `cartridgeSlug` prop and exposes **send, receive, payment-request, and reward** primitives. Token whitelist defaults to {Q¢, USDC} with KNYT opt-in.
7. ✓ Tab visibility gates (`memberOnly`, `inviteOnly`, `roleRequired`) are enforced server-side through `evaluateAccess` — no parallel resolvers.
8. ✓ DVN receipts for every state change (creation, member invite, tab visibility, crypto-send, payment-request, reward, codex-publish, activation-submitted, activation-reviewed) appear in myLedger filtered by `activeCartridge`.
9. ✓ The active tab enters the Activation Catalogue ONLY after the owner opts in at Step 5 of the wizard AND the metaMe admin approves at §21a Stage 3.
10. ✓ `/admin/codex` label reads "myCartridge and Codex Manager" and **only super-admins (`persona.cartridgeFlags.isAdmin`) can open it**; non-admin myCartridge owners cannot reach it.
11. ✓ ventureQube v0.4 schema doc lands; ingest accepts both v0.3 and v0.4; types file exists at `types/ventureQube.ts`; `myCartridge` block lives nested under `ventures[]`.
12. ✓ All access decisions flow through `evaluateAccess` — no parallel resolvers (CLAUDE.md spine PARAMOUNT).
13. ✓ All client-side spine fetches use `personaFetch` — no raw `fetch` on spine routes (CLAUDE.md PARAMOUNT).
14. ✓ MyCartridgeManagerTab (operator-tier) lives inside the metaMe Admin group, queries `WHERE owner_persona_id = $personaId`, and does NOT list system cartridges under any circumstances.
15. ✓ The owner-side **Activation Requests** sub-tab inside MyCartridgeTab shows current stage + status; reviewer-side sub-tabs (Registry / Studio / metaMe) ship per §21a.4.2 with Registry + Studio hidden via `pilotOnly: true` for MVP.
16. ✓ `CARTRIDGE_APPROVAL_STAGES = 'metame-only'` in MVP; Registry + Studio stages auto-approve at submission time but their lifecycle states and table columns are wired for the pilot flip.
17. ✓ Triad nomenclature: every cartridge config carries `triadNomenclature: 'v0.2'`; the legacy `smartTriad` JSON key is rejected at ingest with a clear migration error.
18. ✓ Specialist whitelist enforces ≤3 free tier in MVP; the 4th+ slot in the wizard renders a payment-gated upgrade lock UI (payment flow itself stubbed).
19. ✓ myCanvas AND myWorkspace can both publish into a cartridge's **Codex OR Community** tab via the unified `publish-to-cartridge` action.
20. ✓ Members template mirrors KNYT cartridge Members + wires to the cartridge's Experience Matrix (standard metaMe template, with customization path stubbed for Studio approval in pilot).

---

## 35. Risks and Open Questions

**Risks:**

- **R1: Cartridge proliferation cost.** Every metaMe user spinning up a cartridge means N×(codex_configs row, codex_tabs rows, cartridge_kb_sources, embeddings). Embedding cost balloons unless we gate cartridge KB enablement (MVP: KB is off by default, opt-in per cartridge).
- **R2: Permission surface area.** Adding `memberOnly`/`inviteOnly`/`roleRequired` doubles the gate matrix. Spine tests in `tests/access-spine.test.ts` must extend canary cases. Without that, regressions silently leak content.
- **R3: System cartridge isolation (resolved v0.2).** Non-admin operators do NOT have access to system cartridges and cannot even open them in an editable state. System-admin gating remains in place for all system cartridge access rights. The ability to create a myCartridge does NOT confer admin rights on the persona beyond their own cartridge. RLS and tokenQube gating both apply — system cartridges are admin-gated AND tokenQube-gated. The operator-tier `MyCartridgeManagerTab` (inside metaMe Admin) scopes its query to `codex_configs WHERE owner_persona_id = $personaId`; it cannot list system cartridges even visually. The super-admin `/admin/codex` surface remains gated by `persona.cartridgeFlags.isAdmin` (global tier) — no UI path from myCartridge owner-tier to system cartridge editing.
- **R4: ventureQube v0.3 / v0.4 dual ingest.** Until every consumer is on v0.4, both shapes must round-trip. Risk of subtle field-name collisions.
- **R5: Activation Catalogue spam (resolved v0.2).** metaMe approval (and post-pilot Registry + Studio approval — §21a) serves as the filter for system-wide distribution. As the system scales, approval standards and criteria rise. MVP: cartridges marked `visibility: public` AND opt-in to "Submit for catalogue inclusion" enter the pending queue; nothing surfaces to the public catalogue until metaMe admin approves. Private / member / invite-only never enter the queue.
- **R6: Wallet exposure.** Cartridge crypto-send uses the persona's own funds. Per-cartridge personas (already supported by `SmartWalletDrawer.setCartridgeDefault`) must be set explicitly by the user; do not infer.
- **R7: Specialist invocation cost (gated v0.2).** Anything beyond the basic cartridge setup config is payment-access-gated. Adding more than 3 specialists incurs costs. MVP: per-cartridge `availableSpecialists` defaults to ≤3 from the free tier; the wizard's specialist picker locks the 4th+ slot behind a "Upgrade for additional specialists" CTA. The payment wiring itself is stubbed in MVP (typed entitlement check in the precheck route); the gating UI ships in MVP so users see the boundary from day one. v0.5 lights up the payment flow.
- **R8: Inter-cartridge nav identity leakage.** Per CLAUDE.md, never serialize `personaId` (T0) in browser links. `buildCodexUrl` already handles this. Audit every new myCluster → cartridge link.
- **R9: Three-stage chain reviewer cohort cost (post-MVP pilot).** Standing up Registry + Studio reviewer cohorts in addition to metaMe admin is a coordination cost. MVP runs metaMe-only per §21a.0; the cohort decision is deferred to pilot kickoff. Avoid wiring reviewer-cohort-specific UX assumptions into MVP code.

**Operator answers folded (2026-06-01 v0.2 — all questions resolved):**

- **Q1:** ✓ myArtifacts is the TabGroup at `data/codex-configs.ts:2290`; rebrand = rename + add myCartridge sub-tab. PRD §6 updated.
- **Q2:** ✓ **1 cartridge per persona for MVP.** PRD assumes 1 — confirmed.
- **Q3:** ✓ **Yes — aigentMe is the default cartridge copilot.** Specialist + cartridge-level copilot are opt-in / future stub.
- **Q4:** ✓ **Opt-in checkbox in wizard + Registry + metaMe admin approval** (post-MVP also Studio). Public cartridges are NOT auto-submitted; the user must opt in.
- **Q5:** ✓ **Nested under `ventures[]`, restricted to 1 venture per persona for MVP.** Platform sys admins can have more than 1 nested venture per persona. Schema in §27 updated.
- **Q6:** ✓ **Auto-derived from title, editable by user** in the wizard Identity step.
- **Q7:** ✓ **KNYT is opt-in.** Default token whitelist = `{Q¢, USDC}`. KNYT only included when the user opts in.
- **Q8:** ✓ **Pulse + Codex + Active + Overview first** — confirmed extraction order.
- **Q9:** ✓ **Fine for MVP with iQube Registry approval stubbed in place.** Post-MVP pilot lights up Registry + Studio stages. The cartridge active tab IS an iQube and must clear Registry + Studio threshold to qualify for the metaMe Activations Catalogue — typed in v0.4 schema, gated by `CARTRIDGE_APPROVAL_STAGES` flag (§21a.0).
- **Q10:** **Probably needs a new mapping** in `services/access/cartridgeAdminGrants.ts:43` (`TENANT_SLUG_TO_CARTRIDGE_SLUG`). Specifically:
  - `metame` tenant → `metame-cartridge` admin (probably already exists; verify in Phase 4).
  - `iqube-registry` tenant → `iqube-registry-cartridge` admin (NEW — needed for Registry reviewer cohort in pilot).
  - `metame-studio` tenant → `metame-studio-cartridge` admin (NEW — needed for Studio reviewer cohort in pilot).
  Phase 4 task: audit existing mappings, add missing ones.

---

## 36. Files Touched (forecast)

**New:**
- `components/metame/setup/CartridgeSetupWizard.tsx`
- `app/triad/components/codex/tabs/MyCartridgeTab.tsx` (external-facing owner summary; sits in myCluster group)
- `app/triad/components/codex/tabs/MyCartridgeActivationRequestsTab.tsx` (sub-tab inside MyCartridgeTab — owner-side primary surface)
- `app/triad/components/codex/tabs/MyCartridgeManagerTab.tsx` (operator-tier control room inside metaMe Admin group)
- `app/triad/components/codex/tabs/AdminActiveSurfaceAccessRequestsTab.tsx` (metaMe stage reviewer surface)
- `app/triad/components/codex/tabs/AdminRegistryActivationReviewTab.tsx` (Registry stage reviewer surface; `pilotOnly: true` in MVP)
- `app/triad/components/codex/tabs/AdminStudioActivationReviewTab.tsx` (Studio stage reviewer surface; `pilotOnly: true` in MVP)
- `app/triad/components/codex/templates/{Pulse,Codex,Active,Overview,Wallet,Ledger,Community,Members,Venture,Settings,Admin,Experience}TabTemplate.tsx`
- `app/api/assistant/cartridge-config/route.ts`
- `app/api/assistant/cartridge-recommend/route.ts`
- `app/api/mycartridge/owner-summary/route.ts`
- `app/api/mycartridge/admin-detail/route.ts`
- `app/api/activations/register/route.ts`
- `app/api/cartridge-activations/submit/route.ts`
- `app/api/cartridge-activations/precheck/route.ts` (stage-aware)
- `app/api/admin/cartridge-activations/route.ts` (list, filterable by status + stage)
- `app/api/admin/cartridge-activations/[catalogId]/approve/route.ts` (stage-aware)
- `app/api/admin/cartridge-activations/[catalogId]/request-changes/route.ts` (stage-aware)
- `app/api/admin/cartridge-activations/[catalogId]/reject/route.ts` (stage-aware)
- `app/api/mycanvas/publish-to-cartridge/route.ts` (handles canvas+workspace+codex+community combos)
- `app/api/myworkspace/publish-to-cartridge/route.ts` (thin alias of above; same handler)
- `app/api/cartridge-kb/upload-json-blob/route.ts` (NEW — JSON blob KB source upload)
- `types/ventureQube.ts` (v0.4 types with myCartridge nested under ventures[])
- `services/iqube/ventureQubeSchema.ts` (Zod validator)
- `services/iqube/cartridgeKb.ts` (KB source resolution + JSON blob handling)
- `supabase/migrations/2026XXXX_cartridge_memberships.sql`
- `supabase/migrations/2026XXXX_cartridge_activation_approvals.sql` (with stage columns)
- `supabase/migrations/2026XXXX_cartridge_kb_sources.sql`

**Modified:**
- `types/codex.ts` (CodexConfig + CodexTab extensions; `pilotOnly: true` flag on CodexTab for Registry/Studio reviewer tabs)
- `types/access.ts` (cartridgeMemberships on cartridgeFlags; new tokenQube cartridge-isolation descriptor)
- `app/(shell)/admin/codex/page.tsx` (label rebrand; hardened `isAdmin` gate per R3)
- `app/(shell)/admin/codex/[codexId]/page.tsx` (label rebrand)
- `app/triad/components/codex/TabRenderer.tsx` (template registry + new tab components)
- `app/triad/components/CodexPanelDynamic.tsx` (primaryTabSlug resolution + `pilotOnly` gate)
- `app/hooks/useCodexConfig.ts` (primaryTabSlug + role-gated tabs + pilotOnly filter)
- `services/identity/getActivePersona.ts` (return cartridgeMemberships)
- `services/access/evaluateAccess.ts` (cartridgeRole descriptor + tokenQube + system-cartridge isolation)
- `services/access/cartridgeAdminGrants.ts` (auto-grant owner_persona_id; new tenant→cartridge mappings per Q10: `iqube-registry`, `metame-studio`)
- `app/api/codex/chat/route.ts` (cartridgeSlug param; aigentMe-as-cartridge-copilot owner resolution)
- `app/api/persona/venture-iqube/ingest/route.ts` (v0.4 acceptance; rejects legacy `smartTriad` key with migration error)
- `services/agents/specialistRouter.ts` (per-cartridge whitelist resolution + ≤3 free-tier enforcement)
- `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (wizard CTA wiring + approval-status notification card)
- `app/triad/components/codex/tabs/MyCanvasTab.tsx` (publish-to-cartridge action; codex OR community target)
- `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` (publish-to-cartridge action mirrors MyCanvas; same handler)
- `app/components/wallet/TransactionModal.tsx` (new `mode: 'request'` for payment-request primitive)
- `services/activations/ActivationsContext.tsx` (read `approved` entries only; merge static + DB sources)
- `app/triad/components/codex/tabs/ActivationsTab.tsx` (status-filtered render)
- `data/codex-configs.ts`:
  - Line 2290: `id: 'myartifacts'` → `'mycluster'`, `label: 'myArtifacts'` → `'myCluster'`
  - Lines 2465 / 2481 / 2497: `group: 'myartifacts'` → `'mycluster'`
  - Add `myCartridge` sub-tab in the same group at order: 2 (between myWorkspace and myLedger)
  - Adjust myLedger order to 3
  - Add `admin-active-surface-access-requests` sub-tab in metaMe Admin group
  - Add `admin-mycartridge-manager` sub-tab in metaMe Admin group (operator-tier)
  - Add `admin-registry-activation-review` (pilotOnly) and `admin-studio-activation-review` (pilotOnly) entries in their respective cartridge configs
  - Promote KNYT/Qripto/Venture Lab as `CartridgeTemplate` exports
- `codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md` (cross-link to v0.4)
- `data/activation-catalog.ts` (status-aware reads; only `status === 'approved'` rows surface to non-owners)

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
