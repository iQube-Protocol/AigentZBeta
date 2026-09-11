# PAS-001 — Passport-First Constitutional Access: Estate-wide Authentication & Access Architecture

**Version 2.0 — Supersedes PRD-PAG-001**

**metaMe IRL / iQube Protocol · Product/security architecture specification · Status: DRAFT — PENDING OPERATOR RATIFICATION**
**Owner:** Identity & Access Spine stewards + Polity Passport Bureau · **Origin:** operator draft, reconciled by Claude Code against the shipped codebase, 2026-07-29
**Governs:** the estate-wide authentication and access architecture — every wallet, every application, every sign-in surface across the metaMe estate. It specifies an architecture for the operator to ratify. **It builds nothing.**

> **This document supersedes `PRD-PAG-001_polity-access-gateway.md` in full**, including its Amendments A, B, and C. PRD-PAG-001 is annotated (not deleted or rewritten) with a pointer to this document — see that file's own top-of-file note. Every finding, ruling, and shipped increment recorded in PRD-PAG-001 and its amendments is carried forward here by reference; this document does not re-litigate settled rulings, it **extends their reach to the whole estate's UI**, which is the gap this document exists to close (§0.3).

> **Governance note (binding, this spec):** This is a **docs-only** deliverable. The Identity & Access Spine is PARAMOUNT-protected in `CLAUDE.md` ("Security — Access Gates", "Identity & Access Spine — CANONICAL SoT"), and the spine files (`services/identity/getActivePersona.ts`, `services/identity/personaSessionToken.ts`, `services/access/evaluateAccess.ts`, `services/access/policyResolvers.ts`, `services/content/getContentDescriptor.ts`, `services/content/encryption.ts`, `services/content/stateCDelivery.ts`, `types/access.ts`) — and the DVN pipeline files (`services/dvn/activityReceiptDvnPipeline.ts`, `services/ops/icAgent.ts`, `services/ops/idl/cross_chain_service.ts`) MUST NOT be modified without explicit operator approval. Nothing here authorizes a code change. Every mechanism below is specified as **extension by composition** over the existing spine — never a fork, never a parallel resolver, never a weakened gate. Any implementation happens only after ratification, by a separate, authorized pass, spine-touching work gated on `scripts/verify-spine.mjs`.

---

## §0 — Read this first: reconciliation against what's already built

**This is the single most important section of the document.** The operator's draft (§§1–19 below) describes a target architecture. Read against the actual codebase, roughly 70% of the session-minting and passport-native access mechanics this draft calls for **already exist and are already ratified** — under `PRD-PAG-001` and its Amendments A, A.11, B, and C. What is genuinely new is narrower, and concentrated in exactly one place: **the estate's shared UI surfaces have not yet been wired to the passport-native mechanics that already work at the API layer.** Sections §0.1–§0.6 below establish this; §§1–19 then reconcile each operator section individually.

### 0.1 What PRD-PAG-001 + Amendments already shipped (do not rebuild any of this)

| Capability the operator's draft asks for | Status | Anchor |
|---|---|---|
| Session established by presenting a Passport, not a password | **SHIPPED** | `services/identity/passportPrincipal.ts`, `services/identity/passportPendingAuth.ts`, `app/api/passport-connect/{challenge,proof,finalize,resolved-persona}/route.ts` (Amendment A + §A.11) |
| First-ever connection with **no prior account anywhere** | **SHIPPED** | Amendment §A.11.1 — wallet-control proof + live World ID proof → session, zero prior Supabase session required |
| Explicit persona choice before session mint (never auto-picked) | **SHIPPED** | §A.11.2 — `PersonaChoice` projection, cross-principal-forgery canary |
| Passkey / WebAuthn enrolment + unlock | **SHIPPED** (2026-07-27, later than PRD-PAG-001's own text claims — see §0.2) | `services/passport/passkeyService.ts`, `app/api/passport/passkey/{enrol-options,enrol-verify,auth-options,auth-verify}/route.ts` |
| Risk→grade step-up policy (weak captcha vs. strong World ID/passkey by consequence) | **SHIPPED** | `services/passport/stepUpPolicy.ts` (Amendment A §A.6 level 3) |
| Three-level persona reference model (private UUID / public ref / pairwise ref) | **SHIPPED, pre-dates PRD-PAG-001** | `services/identity/personaReferences.ts` |
| Session as a receipted constitutional record (not a forced OAuth row) | **SHIPPED** | Amendment §A.11.5 — one `activity_receipts` row via the existing unified writer, `'session_started'` action type, no new DVN action type |
| Human-adapter OAuth session over the shared Threshold gateway (for RPs that want OIDC-shaped consent) | **SHIPPED** | `app/api/access-gateway/{authorize,complete,token,session,revoke,logout}/route.ts`, `app/access-gateway/authorize/page.tsx` (PRD-PAG-001 Phase 1) |
| A "Continue with Passport" button component | **SHIPPED, but unwired** | `components/passport/ContinueWithPassportButton.tsx` — its own header says: *"NOT wired into any existing login page — integrating live login surfaces is a separate, deliberate pass."* **This is exactly the gap §0.3 names.** |
| The Companion's own Connect UI (wallet-native, no Companion dependency in the protocol) | **SHIPPED** | `components/companion/PassportConnectPanel.tsx`, mounted at `app/(embed)/triad/embed/companion/page.tsx` and the standalone `app/passport-connect/page.tsx` |
| Account-holder ↔ Passport binding charter (an existing Supabase account owner registers/claims a Passport) | **CHARTERED FOR EXECUTION** (Amendment B, 2026-07-27) — **execution status could not be fully confirmed in this pass; see §0.2** | Amendment B, `PRD-PAG-001` |
| Passport issuance with **no prior account at all** (a citizen who has never touched metaMe gets a Passport first, an account never) | **CHARTERED, NOT YET RATIFIED** | Amendment C, `PRD-PAG-001` — its own ratification checklist (§C.3) is unchecked; `services/passport/bureauIdentityService.ts` still requires a non-null `auth_user_id` at issuance (verified by reading the file — no nullable-`auth_user_id` path exists in code today) |

**Consequence for this spec:** the operator's §3 ("New Authentication Architecture"), §6 ("Legacy Migration"), and §7 ("Passport Claim") are **not describing new mechanics to build** — for the "existing account holder connects via Passport" case they are describing Amendment A/A.11's *already-shipped* API surface, extended to the whole estate's UI. For the "brand-new citizen, no account, ever" case, they depend on **Amendment C, which is not yet ratified** — this is flagged prominently at §6, §7, and §19 below, and is the one open ratification gate this spec inherits and does not resolve on its own.

### 0.2 Two things this reconciliation could NOT fully verify — stated honestly, not guessed

1. **Passkey's actual ship date is later than PRD-PAG-001's own body claims.** PRD-PAG-001 §0.5 and its Amendment A (2026-07-26 text) both state WebAuthn/passkey is "genuinely unbuilt." The code (`services/passport/passkeyService.ts`) states in its own header comment that it was built under "Amendment A §A.6 (ratified 2026-07-27)" — i.e., the day *after* the amendment text most recently read still called it unbuilt. This is not a contradiction; PRD-PAG-001's §A.10.3 "Still open" table itself records "ALL THREE RATIFIED 2026-07-27 ... build pass launched same day (parallel agent)" for passkey enrolment. The passkey service exists and is real; I did not find (and did not exhaustively search for) an `agentiq/updates/` doc narrating that specific build's completion, so I cannot cite one. Treat passkey as shipped (verified by reading the service + its four API routes) but do not assume a specific completion-narrative doc exists for it.
2. **Amendment B's execution status is genuinely unclear from this pass.** I found `app/api/passport/identity/bind/route.ts`, which performs a persona+KybeDID create/bind flow — but its own header cites *"PRD §9"*, not Amendment B, and reads as part of the Bureau's own issuance-time identity binding (a different concern: binding a **new Passport applicant's** identity at application time) rather than Amendment B's specific charter (an **existing Supabase account holder** retroactively binding their account to a Passport they already hold, so passport-native login becomes their sign-in going forward). I could not find a route or service file explicitly labelled as Amendment B's execution. **I am stating this as an open verification gap, not asserting Amendment B has or has not shipped.** The operator should treat Amendment B's actual build status as unconfirmed until an implementation pass checks it directly, rather than relying on this reconciliation's absence of evidence as evidence of absence.

### 0.3 The actual gap this specification exists to close

Given §0.1, the honest scope of "genuinely new" work in this specification is narrower than the operator's 19-section draft implies on its face, and it is concentrated almost entirely in **one place**: the estate's shared, live-traffic UI surfaces have not been updated to offer passport-native access, even though the backend that would serve it has existed since 2026-07-26–28. Verified directly by reading the code:

- **`app/components/content/SmartWalletDrawer.tsx`** (5,446 lines) — the canonical embedded Smart Wallet, mounted estate-wide via the "Wallet-Over-Cartridge Overlay" pattern (`CLAUDE.md`) — still renders a **raw email + password Sign In / Sign Up toggle** (lines ~2318–2470: `authMode === "signin" | "signup"`, `signInWithEmail`/`signUpWithEmail` from `useSupabaseSessionPersonas`) as its **only** sign-in path. It does **not** import or render `ContinueWithPassportButton`, `PassportConnectPanel`, or any passport-native connect affordance. It already renders `PassportQube` items (PersonaQube/PassportQube/AgentQubes) for an **already-signed-in** wallet, and already has World ID step-up buttons for existing Passports — but the entry door into the wallet itself is unchanged legacy username/password.
- **`ContinueWithPassportButton.tsx`**'s own header states this explicitly: *"NOT wired into any existing login page — integrating live login surfaces is a separate, deliberate pass."*
- **`PassportConnectPanel.tsx`** (the one UI that DOES offer the full passwordless flow) is mounted only inside the Companion embed (`app/(embed)/triad/embed/companion/page.tsx`) and the standalone `app/passport-connect/page.tsx` — **not** inside `SmartWalletDrawer`, not inside any cartridge's inline sign-in surface.
- A repo-wide search for `signInWithEmail`/`signUpWithEmail` usage found exactly **one** call site: `SmartWalletDrawer.tsx`. This is a positive finding for §16 ("Shared Components") — there is no proliferation of duplicate raw-password forms across the estate to consolidate; there is exactly one, and it is the one that needs to become passport-first.

**This reframes the whole specification's real center of gravity:** the backend "Passport becomes the credential that establishes a session" story is largely done. What remains is (a) wiring the existing passport-native mechanics into `SmartWalletDrawer` and any other first-party sign-in surface, (b) the credential-manager UI (§9) that doesn't exist as a wallet section today, (c) the copy/labeling changes (§13), (d) closing Amendment C so a Passport can exist with no account at all (§6/§7's hard dependency), and (e) verifying/completing Amendment B. None of these require touching a protected file, by the same discipline Amendment A/A.11 already demonstrated (§A.9.1, §A.11.6) — see §20's phase-by-phase protected-file table.

### 0.4 Root Principal — reframing needed

The operator's new "Passport as the Estate Root Principal" framing (§1a below) is **consistent with, and a plain-language restatement of, Amendment A's ruling A.3.2**: *"Passport / KybeDID = identity and authority root; Supabase user = internal application principal record; Supabase session = application session transport."* Nothing here contradicts that ruling; §1a's contribution is naming it as the estate-wide architectural sentence rather than a session-mechanics ruling buried in an amendment. It should be read as elevating A.3.2 to top-billing, not adding a new rule.

### 0.5 CFS-024, CFS-043, and the three-level reference model — unchanged foundations

- **CFS-024**'s `CONSTITUTIONAL_IDENTITY_HIERARCHY` (Citizen → Passport → Personhood → Person → Personas → Delegated Agents → Sessions → Tasks) already names "Session" as a hierarchy level and provides `resolveConstitutionalContext()`. This spec's "Constitutional Session" language (implicit throughout the operator's draft) is the same primitive PRD-PAG-001 §4 already reconciled; nothing here re-derives it.
- **CFS-043**'s Principal–Delegate Separation (only the human authorizes; an agent never authenticates or authorizes) governs every session-issuance path this spec touches, with zero exception. Every phase in §20 is checked against this.
- **`services/identity/personaReferences.ts`**'s three-level model (Private UUID / Polity Public Reference / Pairwise External Service Reference) is the reference substrate any "estate-wide session" in this spec's §8–§10 must consume, never re-derive. Confirmed unchanged since PRD-PAG-001 cited it.

### 0.6 SPEC-COS-001 — cross-reference, not supersession

`SPEC-COS-001_constitutional-onboarding-specification.md` governs the **onboarding substrate** (the seven layers every arrival crosses: Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey recommendation) — a different, complementary concern from this spec's **estate-wide sign-in/session architecture**. They do not conflict: SPEC-COS-001 §8.1 already states *"Passport establishes continuity, not authority"* and §8.2 already states delegation is the human-only gate "regardless of which specialist journey eventually consumes it" — both consistent with this spec's Root Principal framing. SPEC-COS-001 cites `PRD-THR-001`, not `PRD-PAG-001`, so its own text requires no correction. **A forward cross-reference has been added to SPEC-COS-001** (see that file's top-of-file note) pointing here for the session-establishment mechanics its own §2.1 table's "MCP"/"Passport" rows and §2.3's direct-arrival path touch, without restating this spec's content there.

---

## §1 — Constitutional Principle

The platform no longer authenticates accounts. It authenticates constitutional participants.

**Hierarchy:** Personhood → Passport → Constitutional Session → Applications. Applications never authenticate users directly; they consume constitutional sessions.

> **Reconciliation.** This is CFS-024's hierarchy (Citizen → Passport → Personhood → Person → …) restated at the application-consumption layer, and it is Amendment A ruling A.3.2 restated as doctrine (*"Passport / KybeDID = identity and authority root"*). **Nothing new to build here** — this is the governing sentence the rest of the spec, and the already-shipped Amendment A/A.11 mechanics, already embody. The gap is adoption (§0.3), not invention.

## §1a — Passport as the Estate Root Principal *(the operator's "architectural sentence")*

> The Polity Passport is the single root principal of the metaMe estate. Every authenticated relationship — including wallets, personas, Agent Me, standing, subscriptions, purchases, memories, cartridges, and future constitutional assets — must ultimately resolve to a Passport holder. Applications no longer own user identities; they recognise constitutional participants through their Passports.

> **Reconciliation.** Restates Amendment A ruling A.3.2 (§0.4). **No protected-file impact** — the ruling was already achieved by making the Passport path resolve into the SAME `CallerIdentityContext` structure Supabase sessions already produce (§A.9.1/§A.11.6: `getActivePersona.ts`, `evaluateAccess.ts`, `personaSessionToken.ts` all show **NONE** in the protected-file-impact tables for every increment shipped so far). This section's job in v2.0 is to make that ruling **estate-wide policy**, not to re-derive the mechanism.

## §2 — Platform Objectives

1. Make Passport the primary authenticated credential across the estate.
2. Preserve completely open public access (reading/browsing/exploring, no Passport required).
3. Convert legacy credentials into wallet-authority credentials — username/password no longer authenticates applications, it unlocks wallet authority.
4. Migrate every existing user without creating duplicate identities — every existing account must seamlessly become a Passport holder.
5. Maintain Companion as an optional runtime — Passport must never depend on Companion installation.

> **Reconciliation.**
> - **Objective 2 (public access unchanged)** — already true today; nothing in the identity spine gates read/browse routes. No work.
> - **Objective 3 (password → wallet-authority-only)** — this is the one objective with a genuine, unbuilt UI consequence: `SmartWalletDrawer`'s email/password form today **is** the application-identity path (it signs into a Supabase session and that session directly becomes the app's notion of "signed in"). Converting it to "unlocks wallet authority, which then presents the Passport" is real, scoped UI/flow work — see §20 Phase 2.
> - **Objective 4 (no duplicate identities)** — Amendment A/A.11 already guarantee this for the passport-native path (binding resolves via `kybe_did_public_ref`/wallet fingerprint, never email — canary-enforced, §A.11.8 #7). Amendment B is the charter for the "existing account, not yet bound" case and its execution status is unconfirmed (§0.2) — this is the one piece of Objective 4 not confirmed closed.
> - **Objective 5 (Companion optional)** — already a **RULED** invariant (Amendment A §A.7) and already true in code: `PassportConnectPanel.tsx`'s own header states it talks to `/api/passport-connect/*` over plain HTTP with no `chrome.*` dependency. No new work; this is an existing guarantee this spec must not regress.

## §3 — New Authentication Architecture

**Guest → (optional) Legacy Credential → Wallet Authority → Passport → Constitutional Session → Application.** Passport is no longer parallel to username/password; Passport replaces it as the estate's authenticating layer.

> **Reconciliation.** This chain is **already implemented, end to end, for the passport-native path** — `Connect → wallet challenge → prove wallet control → present Passport (World ID) → resolve canonical personhood → establish/reconcile wallet binding → choose persona → establish application session` is `PassportConnectPanel.tsx`'s own documented state machine (§A.11.1, verbatim in that file's header comment), and every step already avoids requiring a prior Supabase session. **What is genuinely new:** the "(optional) Legacy Credential" leg — an existing username/password holder using their password specifically to *unlock wallet authority, which then presents a Passport*, rather than the password itself terminating in an application session. Today the password path and the Passport path are two **separate, parallel** doors into `SmartWalletDrawer` (one legacy email/password form; a completely separate Companion-only Connect panel) rather than the operator's single funnel where the password is a *means to reach* wallet authority. Making the password a step *within* the funnel rather than a sibling door to it is real design + build work — flagged in §20 Phase 2.

## §4 — Public Access

The ecosystem remains publicly accessible; no credential required for browsing, articles, publications, discovery, public cartridges, public research.

> **Reconciliation.** Already true; unaffected by this spec. No access gate exists today that requires a Passport for public read routes, and nothing in §§1–19 proposes adding one. No work.

## §5 — Credential Classes

Three levels: **Public** (no credential); **Account** (temporary migration state, used only while migrating legacy users); **Constitutional** (Passport required — remix article, publish, Standing, agent delegation, Founder Office, wallet authority, constitutional receipts, provenance, marketplace participation).

> **Reconciliation.** The **Public**/**Constitutional** poles already exist as a de facto distinction — `evaluateAccess()` and the descriptor/gating pattern already separate "no gate" reads from "requires an authenticated persona" actions. What is genuinely new is naming and **formalizing "Account" as a temporary, migration-only tier** — today there is no code-level concept of "this session is Account-tier, not yet Constitutional-tier"; a Supabase session either resolves a persona or it doesn't. Introducing this tier as a *first-class distinguishable state* (so a route guard can ask "is this session merely Account, and does this action require Constitutional?") is new work, and it is the most consequential design decision in this whole spec for where protected files sit — see the flag in §14 and §20 Phase 4. **The safest implementation path, following the A.9.1/A.11.6 precedent, is a NEW composing module that reads the existing session/receipt shape (e.g., whether the session-issuance receipt's `assurance level` field, per §A.11.5, is `wallet_binding`/`wallet_binding+world_id` vs. absent) rather than adding a branch inside `evaluateAccess.ts` itself.** Whether that composition is sufficient, or whether `policyResolvers.ts` genuinely needs a new resolver type, is a decision that must be brought back to the operator before code is written (§20 Phase 4, flagged PROTECTED-FILE-RISK).

## §6 — Legacy Migration

Every existing account holder should gradually become a Passport holder; existing users are never asked to create a new account, instead they claim their Passport. Journey: Username/password → Wallet ownership proven → Locate wallet → Locate Passport → No Passport? → Claim Passport → Issue Constitutional Session → Continue. No duplicate personas, wallets, or accounts.

> **Reconciliation.** This journey is **almost exactly** Amendment B's charter (`PRD-PAG-001` Amendment B §B.1–B.3): *"An existing account holder … binds their account to a Passport they control, so passport-native access becomes their sign-in."* Amendment B already specifies: both sides proven never inferred (B.2.1), never bind on email/display-name match (B.2.2), conflict is a refusal not a re-bind (B.2.3), binding is a consequential act step-up-gated (B.2.4), reversible (B.2.5) — and states **zero protected-file impact** (§B.3). **The dependency this spec must carry forward, prominently:** Amendment B's execution status could not be confirmed in this pass (§0.2). Before any work proceeds under this section, the operator (or an implementation pass) must first determine whether Amendment B actually shipped, and if not, execute it — this spec does not re-specify Amendment B's mechanics, it inherits them. **The "No Passport?" branch of this journey is Amendment C's territory** (issuance without a prior account) and remains blocked on Amendment C's ratification (§0.1, §C.3 — unchecked).

## §7 — Passport Claim

Should feel almost invisible; the user already has account/wallet/personas/balances/subscriptions/purchases; Passport simply constitutionalises them. Target: two clicks.

> **Reconciliation.** Same dependency as §6 — this is Amendment B's UX target stated in product terms. The "two clicks" target is achievable given Amendment A/A.11's mechanics (challenge → proof → persona choice → session is already a small number of user actions when a wallet provider is already connected), but **only for a user who already has a Passport to claim.** For a legacy account holder with a Supabase account but genuinely no Passport at all, this section's promise depends on Amendment C's account-less-issuance path existing to let them mint one without leaving the flow — and Amendment C is unratified. **This is the second citation of the same open gate; §19 tracks it once as a single named blocker rather than three separate ones.**

## §8 — Wallet

The SmartTriad Wallet becomes the constitutional access manager. Responsibilities: Passport presentation, wallet authority, credential management, recovery, session issuance. Not simply balances.

> **Reconciliation.** `SmartWalletDrawer` already renders PersonaQube/PassportQube/AgentQubes (balances, Passport VC display, World ID step-up) — it is already more than "just balances." What it does **not** yet do is (a) present the passport-native connect flow inline (§0.3), (b) house a credential-manager section (§9, genuinely new), or (c) itself issue a session via the passport-native path rather than via legacy Supabase sign-in. This section is the UI consequence of §0.3 and §9 combined — no new backend mechanism, a real and non-trivial UI consolidation. See §20 Phase 2–3.

## §9 — Credential Management

The wallet gains a new "Credentials" section containing: username/password, passkeys, Google, Apple, recovery methods, trusted devices, future authentication methods. These become wallet-access methods, not application identities. Passwords are never stored — only credential references.

> **Reconciliation.** Genuinely new UI surface — **no "Credentials" section exists in `SmartWalletDrawer` today** (confirmed by reading the file's full sign-in block; the only credential-adjacent UI is the raw email/password form and, separately, World ID step-up buttons per Passport). What already exists to build it FROM: **passkeys** — `services/passport/passkeyService.ts` + 4 routes (enrol-options/enrol-verify/auth-options/auth-verify), shipped 2026-07-27. **Google/Apple OAuth** — not confirmed present; a repo search for Google/Apple OAuth *sign-in* providers (as opposed to `GoogleConnectionsPanel.tsx`, which is a *content-connector*, not an auth provider) did not surface a Supabase social-provider sign-in integration in the time available for this pass — **flag this as unverified, not "doesn't exist."** **Recovery methods / trusted devices** — no dedicated service found; likely net-new. **"Passwords are never stored — only credential references"** is already Supabase's own posture (Supabase Auth never exposes plaintext passwords to application code); this clause requires no new work, only a doc statement of an existing property. **Net-new work:** the Credentials section's UI, the recovery-methods UI/backend (if it doesn't already exist under a name this pass didn't find), and the trusted-devices concept (session/device list + revoke), none of which touch protected files — this composes the existing session/receipt reads.

## §10 — Passport Status

Every wallet shows Passport status: ✓ Active / Not Claimed / Attention Required. More prominent than Persona.

> **Reconciliation.** `SmartWalletDrawer` already reads and renders `passportGrade`/`passportStatus` per `PassportQubeItem` (confirmed: `passportStatus`, `passportGrade` fields render today). What's new is (a) making this the **first, most prominent** element of the wallet chrome rather than one card among several, and (b) the explicit three-state vocabulary (Active/Not Claimed/Attention Required) as a single top-level status chip, which does not exist as a named UI element today. Small, well-scoped UI work; no backend change.

## §11 — Companion

Becomes optional. Provides Agent Me, memory, cross-site continuity, edge runtime, delegation, notifications. Passport access must work perfectly without Companion.

> **Reconciliation.** Already ruled and already true (§0.2, Amendment A §A.7). No work — this section is a restatement of an existing, already-enforced invariant. The only new obligation this spec adds: **any UI work done under §20 must not regress this** — e.g., if a future "Credentials" section (§9) or Passport-status chip (§10) is built inside `SmartWalletDrawer`, it must continue to call `/api/passport-connect/*` directly (as `PassportConnectPanel.tsx` already does) rather than assuming the Companion extension is present.

## §12 — Estate-wide UI

Every application receives the same access components: Passport Badge, Passport Button, Claim Passport, Credential Manager, Wallet Unlock. No application invents its own authentication UI.

> **Reconciliation.** Consistent with the "one auth form found, not many" finding (§0.3) — there is currently **no proliferation problem to fix**, which makes this section easier to execute than it might read: build each named component **once**, as a shared component under (following existing convention) `components/passport/` (where `ContinueWithPassportButton.tsx` already lives) or `components/wallet/`, and the estate has exactly one call site (`SmartWalletDrawer`) to update plus whatever new surfaces this spec's phases touch. This is the "Shared Components" list also named in §16 — treated as one concern, not two, in §20.

## §13 — Required UI Changes

"Create Persona" becomes "Continue with Passport" or "Claim your Passport" depending on state. "Sign In" becomes "Access your Passport" with supporting copy "Use your existing account to unlock your Passport." Persona Menu becomes: Passport / Manage Passport / Credentials / Recovery / Personas / Wallet / Sign Out.

> **Reconciliation.** Pure copy + component-swap work once §12's shared components exist. `ContinueWithPassportButton.tsx` already carries the label `"Continue with Polity Passport"` as its default — this section's "Continue with Passport" wording is **already the shipped default label of an existing, unwired component.** The Persona Menu restructure (Passport / Manage Passport / Credentials / Recovery / Personas / Wallet / Sign Out) does not exist today — `SmartWalletDrawer`'s current menu is persona-centric, not Passport-first — and is genuinely new information architecture, though it composes existing data (PassportQube status, credential list from §9, persona list already rendered). No protected-file impact.

## §14 — Route Guards

Applications stop asking "is the user logged in?" and instead ask "does this action require a constitutional session?" If yes: present Passport. If no Passport: claim Passport, then continue automatically.

> **Reconciliation. This is the section with the highest protected-file risk in the entire specification, and it must be flagged as such rather than assumed safe.** Today, every one of the 347 call sites of `getActivePersona()` found across `app/` and `services/` effectively already asks "is the user logged in" in the sense that a resolved persona implies an authenticated session — Amendment A/A.11 already made that session possibly Passport-native rather than password-native, **transparently**, without touching `getActivePersona.ts` (confirmed NONE in every protected-file-impact table cited, §0.1). **The open question this section raises that Amendment A did not need to answer:** does "does this action require a constitutional session" mean something *stronger* than "does `getActivePersona` resolve a persona" — e.g., does a Constitutional-tier action (§5) need to distinguish a session established via Passport-native proof (`wallet_binding+world_id`, strong) from one established via bare legacy password (weak, or "Account"-tier per §5)? **If yes, this requires either (a) a new composing check read at the API-route level (safe, no protected file touched) or (b) a genuinely new decision input inside `evaluateAccess`/`policyResolvers` (protected-file territory, requires explicit operator approval before any code is written).** This spec does not resolve which; it names the fork and requires the operator to choose before implementation proceeds (§20 Phase 4).

## §15 — Continuation

Any interrupted action must resume (e.g. Guest → Remix → Claim Passport → Return to Remix, never Homepage).

> **Reconciliation.** Genuinely new, cross-cutting UX requirement — no "return to origin action" mechanism was found for the passport-native connect flow in this pass (the flow's `next` redirect-confinement logic in Amendment §A.10.2a's Companion↔application handoff is same-origin-path-only, which is a security property, not a continuation-of-intent mechanism). This is real, scoped work: capturing the in-flight action (e.g. a remix draft) before redirecting to Passport claim, and resuming it after. No protected-file impact — this is application-layer state, not identity-spine state.

## §16 — Shared Components

One access system, one wallet, one Passport presentation, one credential manager, consumed everywhere: Runtime, Runtime iframe, Drawer, Embedded Wallet, metaMe.live, Founder Office, Qriptopian, metaKnyt, future applications.

> **Reconciliation.** As established in §0.3/§12, there is currently **one** raw-password sign-in implementation (`SmartWalletDrawer`), not several — so "consolidate duplicate auth UIs" is not the work; "build the shared components once, then make every surface use the SmartWalletDrawer-hosted forms" (which is already largely true — the wallet-over-cartridge overlay pattern in `CLAUDE.md` already means most surfaces embed `SmartWalletDrawer` rather than reinventing their own) is. **Verification gap (honest, not guessed):** this pass did not exhaustively audit `metaKnyt`, `Qriptopian` (`apps/theqriptopian-web/src/components/wallet/SmartWalletDrawer.tsx` — note this is a **separate file**, not a re-export of the main one, discovered via the initial glob) or every embed route for a second, independent sign-in implementation. **This is flagged explicitly: `apps/theqriptopian-web` has its own `SmartWalletDrawer.tsx` — whether it independently duplicates the email/password form or delegates to a shared package was not verified in this pass and must be checked before Phase 2 (§20) begins**, since a second raw-password implementation there would be exactly the CS-001 duplicate-capability defect class this codebase's "Extend, Don't Duplicate" principle forbids.

## §17 — Migration Rules

Must preserve: personas, balances, purchases, subscriptions, workspace, standing, history, authored content, remixes, agents. Migration creates continuity, not replacement.

> **Reconciliation.** Already the governing discipline of every migration in this codebase (additive-only migrations, canaried non-regression) and already explicitly the design of Amendment A/A.11's rollback strategy (§A.9.3: "nothing existing is modified," "provisioned principals persist harmlessly," "sign-in untouched throughout"). No new mechanism — this section is a restatement of a standing discipline, applied estate-wide rather than to one amendment's scope. Any phase in §20 that touches migration must produce the same additive-only, non-destructive shape Amendment A/A.11 already demonstrated twice.

## §18 — Constitutional Invariants

1. Passport is the primary authenticated credential.
2. Public browsing remains open.
3. Username/password proves wallet authority, not application identity.
4. Every authenticated session resolves to a Passport session.
5. Legacy users claim Passports.
6. No duplicate constitutional participants.
7. Companion remains optional.
8. Applications consume constitutional sessions only.
9. Credentials are wallet properties.
10. Passwords are never stored in Passport data.

> **Reconciliation, invariant by invariant:**
> - **1, 8** — restate §1a/Root Principal; already-shipped by Amendment A ruling A.3.2, adoption pending (§0.3).
> - **2** — already true (§4).
> - **3** — the one invariant requiring the §3 funnel change described above; not yet true today (password and Passport are parallel doors, not sequential steps).
> - **4** — **not yet true today** for the legacy sign-in path in `SmartWalletDrawer` — a plain email/password sign-in resolves a Supabase session that does **not** presently pass through any Passport-establishing step. Making invariant 4 true is exactly §3/§14's work.
> - **5** — depends on Amendment B (execution status unconfirmed, §0.2) and Amendment C (unratified, §0.1).
> - **6** — already canary-enforced for the passport-native path (§A.11.8 #7); unconfirmed for the legacy-account-binding path (Amendment B).
> - **7** — already true and ruled (§11).
> - **9** — net-new (§9).
> - **10** — already true as a property of Supabase Auth; needs no new build, only accurate documentation.

## §19 — Success Criteria

Every first-party application authenticates via Passport; username/password only unlocks wallet authority; existing users seamlessly claim Passports; public access remains unchanged; Passport is visually the primary credential; Companion remains optional; SmartTriad becomes the constitutional access manager; all wallet implementations use the same shared components; every authenticated session is a constitutional session.

> **Reconciliation — the single blocking dependency this spec cannot resolve on its own:** every success criterion above that involves "existing users seamlessly claim Passports" or "every authenticated session is a constitutional session" is **only fully achievable once**:
> 1. **Amendment B's execution is confirmed or completed** (existing-account-holder binding) — §0.2.
> 2. **Amendment C is ratified and built** (Passport issuance with no prior account at all) — §0.1, blocking §6/§7's "no duplicate accounts, ever" promise for a citizen who truly has nothing yet.
> 3. **The `SmartWalletDrawer` wiring gap is closed** (§0.3) — without this, no success criterion above can be true in the live product regardless of backend readiness.
>
> These three items are the actual critical path of this entire specification. Everything else in §§1–18 is either already shipped, already ruled, or scoped UI/copy work with no protected-file risk.

---

## §20 — Phased Implementation Plan

**Choice of location:** this plan is a section within PAS-001 itself, not a companion document. Reasoning: the plan is inseparable from the section-by-section reconciliation above — every phase below cites specific reconciliation findings by section number, and a companion doc would either duplicate that material or force constant cross-referencing. This mirrors PRD-PAG-001's own structure (a single evolving document with amendments appended), which the operator has already used successfully for this exact subject matter.

**Sequencing principle:** UI/adoption work that touches no protected file ships first; the one section with genuine protected-file risk (§14/§5's "Constitutional vs. Account tier" distinction) ships last, and only after an explicit operator decision on where that distinction is decided (route-level composition vs. a change to `evaluateAccess`/`policyResolvers`). Ratification gates (Amendment B verification, Amendment C ratification) are called out as blocking specific phases, not the whole plan.

| Phase | Scope (operator §§) | Real files/components touched | Protected-file touch? | Reuses | New |
|---|---|---|---|---|---|
| **0 — Verification** | §0.2's two gaps | Read-only: confirm Amendment B execution status; audit `apps/theqriptopian-web/src/components/wallet/SmartWalletDrawer.tsx` for independent auth duplication (§16) | **None** | — | — |
| **1 — Shared components** | §12, §13 (component build, not wiring) | New: `components/passport/PassportBadge.tsx`, `PassportStatusChip.tsx` (§10), `ClaimPassportButton.tsx` (variant of existing `ContinueWithPassportButton.tsx` for the claim-not-fresh-login case). Extend, don't fork, the existing button. | **None** | `ContinueWithPassportButton.tsx`, `PassportConnectPanel.tsx`'s state machine (extract reusable pieces, don't duplicate) | Shared component files only |
| **2 — Wire `SmartWalletDrawer`** | §0.3, §3, §7, §8, §13 | `app/components/content/SmartWalletDrawer.tsx` — add the passport-native connect path alongside (then, per §3, sequenced ahead of) the legacy email/password form; mount Phase 1's shared components; relabel per §13 | **None** — calls existing `/api/passport-connect/*` routes exactly as `PassportConnectPanel.tsx` already does | `/api/passport-connect/{challenge,proof,finalize,resolved-persona}`, `personaFetch`, existing PassportQube render logic already in the file | UI wiring only |
| **3 — Credential Manager** | §9 | New: `components/wallet/CredentialManager.tsx` (or similar), mounted inside `SmartWalletDrawer`. Reads: `passkeyService.ts` (passkeys), Supabase auth identity list (Google/Apple — **verify existence first**, §9's flagged gap), a new recovery-methods surface if none is found on closer inspection | **None expected** | `passkeyService.ts`, `stepUpPolicy.ts` | Credential list UI; recovery-methods backend if genuinely absent (verify first) |
| **4 — Continuation** | §15 | New: an intent-capture/resume mechanism at the application layer (e.g. sessionStorage-scoped, mirroring the existing PKCE-verifier pattern in `ContinueWithPassportButton.tsx`) | **None** | The existing same-origin-confined `next` redirect pattern (§A.10.2a) | Intent capture/resume |
| **5 — Amendment B closure** | §6, §17's "no duplicate accounts" guarantee for existing holders | Whatever Phase 0 finds is missing from Amendment B's charter (§B.1–B.3) | **None, per Amendment B's own §B.3 ruling** ("Zero protected-file impact... No new session machinery") — reconfirm this holds once the actual gap is known | `resolvePassportPrincipal`, `connectionChallenge.ts`, `stepUpPolicy.ts` | Whatever Phase 0 finds missing |
| **6 — Amendment C ratification + build** *(operator gate required before this phase starts at all)* | §6, §7's "claim without ever having an account" promise | `services/passport/bureauIdentityService.ts` (nullable `auth_user_id` + kybe-anchored integrity rule), issuance grade-gating, first-access envelope provisioning | **None claimed by Amendment C's own charter (§C.2)** — but this is the least-verified "no protected file" claim in this whole plan, since it changes account **issuance**, not just session **resolution**; the operator should re-confirm the C.2 impact table against the codebase as it stands today, not rely solely on the 2026-07-27 charter text | `resolvePassportPrincipal`'s existing `principal_unprovisioned` branch (per C.2.3) | Nullable-column migration + issuance logic |
| **7 — "Constitutional vs. Account" tier decision + route guards** *(operator decision required first — see §14 flag)* | §5, §14, §18 invariant 4 | **Depends entirely on the operator's answer.** Composition path: a new module (e.g. `services/access/sessionTier.ts`) that reads the session-issuance receipt's assurance level and is consumed by API routes directly. Protected-file path: a new resolver inside `policyResolvers.ts` / a new branch inside `evaluateAccess.ts`. | **Composition path: none. Protected-file path: YES — `services/access/evaluateAccess.ts` and/or `services/access/policyResolvers.ts`, requiring explicit operator approval before a line of code is written, per `CLAUDE.md`'s "Security — Access Gates" and this spec's own governance note.** | Session-issuance receipts (§A.11.5), `evaluateAccess` (read, not forked) | The tier-distinction mechanism itself |

**Explicit statement for the operator:** Phase 7 is the only phase in this plan where a protected file may need to be touched, and only if the composition path (reading assurance level at the route/service layer) proves insufficient. No implementation pass may proceed past that fork without the operator choosing a path in writing, exactly as `CLAUDE.md`'s "Files you MUST NOT modify without operator approval" section requires.

---

## Ratification record

- [ ] Operator ratifies **§1a — Passport as the Estate Root Principal** as the estate-wide restatement of Amendment A ruling A.3.2.
- [ ] Operator confirms this document **supersedes PRD-PAG-001 in full**, including Amendments A, B, and C — their rulings carry forward by reference; they are not re-ratified from scratch.
- [ ] Operator directs **Phase 0 verification** (Amendment B execution status; Qriptopian wallet duplication audit) before any build phase begins.
- [ ] Operator acknowledges **Amendment C remains unratified** and is a hard dependency for §6/§7's "no account, ever" promise — ratify separately, on Amendment C's own §C.3 checklist, before Phase 6.
- [ ] Operator chooses the **Phase 7 fork** (composition vs. protected-file change) before any Phase 7 code is written.
- [ ] Operator confirms no protected identity/access spine file or DVN pipeline file is modified by Phases 0–6, per the protected-file table in §20.

---

*Authored docs-only, 2026-07-29. Reconciled against `PRD-PAG-001_polity-access-gateway.md` (and its Amendments A, B, C), `PRD-THR-001_metame-threshold.md`, `CFS-024_constitutional-identity-hierarchy.md`, `CFS-043_agent-guided-passport-delegation.md`, `SPEC-COS-001_constitutional-onboarding-specification.md`, `services/identity/personaReferences.ts`, `app/components/content/SmartWalletDrawer.tsx`, `components/passport/ContinueWithPassportButton.tsx`, `components/companion/PassportConnectPanel.tsx`, `services/passport/{passkeyService,stepUpPolicy,bureauIdentityService}.ts`, and the Identity & Access Spine + Security sections of `CLAUDE.md`. Builds nothing; proposes an architecture and phased plan for operator ratification.*
