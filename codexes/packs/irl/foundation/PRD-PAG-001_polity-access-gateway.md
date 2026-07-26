# PRD-PAG-001 — Polity Access Gateway ("Sign in with Polity Passport")

**metaMe IRL / iQube Protocol · Product/security architecture specification · Status: RATIFIED (operator, 2026-07-22 — Phase 1 implementation authorized)**
**Initiative name:** *Operation Passport — Polity Access Gateway & Smart Wallet Authentication (Passwordless Constitutional Identity).*
**Owner:** Identity & Access Spine stewards + Polity Passport Bureau · **Origin:** operator + Aletheon design session, consolidated against the already-built metaMe Threshold gateway + the identity spine, 2026-07-22
**Governs:** the human-side authentication/authorization gateway that makes the Polity Passport the root login credential for the iQube-compliant ecosystem — the complement to the already-built agent-side Threshold gateway (PRD-THR-001). It specifies an architecture for the operator to ratify. **It builds nothing.**

> **Companion note (added 2026-07-22):** Per operator direction — *"Operation Passport should become metaMe Companion"* — PAG-001 is the **authentication + session layer within the metaMe Companion umbrella (`PRD-MMC-001_metame-companion.md`)**, which reframes "Operation Passport" as the Companion (the constitutional layer overlaying the existing web). The Companion is a **third presentation surface** (browser extension / sidebar / overlay) over this same Access Gateway session substrate — alongside the human-OIDC web channel and the agent-MCP channel (§2.1). The SessionQube (§4) stays single: the Companion adds browser-context fields to it, not a second SessionQube. This PRD is unchanged; MMC-001 cites it, it does not restate it.

> **Governance note (binding, this PRD):** This is a **docs-only** deliverable. The Identity & Access Spine is PARAMOUNT-protected in CLAUDE.md ("Security — Access Gates", "Identity & Access Spine — CANONICAL SoT"), and the spine files (`services/identity/getActivePersona.ts`, `services/identity/personaSessionToken.ts`, `services/access/evaluateAccess.ts`, `services/access/policyResolvers.ts`, `services/content/*`, `types/access.ts`) MUST NOT be modified without explicit operator approval. Nothing here authorizes a code change. Every mechanism below is specified as **extension by composition** over the existing spine — never a fork, never a parallel resolver, never a weakened gate. Any implementation happens only after ratification, by a separate, authorized pass, spine-touching work gated on `scripts/verify-spine.mjs`.

> **Companion documents (read alongside):** `PRD-THR-001_metame-threshold.md` (the agent-side gateway this generalizes — the single most important reconciliation anchor); `CFS-024_constitutional-identity-hierarchy.md` (the identity hierarchy in which "Session" is already a named level); `CFS-043_agent-guided-passport-delegation.md` (Principal–Delegate Separation, the guardrail); the Identity & Access Spine section of `CLAUDE.md` (the T0/T1/T2 tier law this PRD's session-claims table enforces).

---

## 0. Read this first — reconciliation against what's already built

Aletheon's "Operation Passport" vision is strong, standards-literate design thinking (WebAuthn/passkeys, OpenID4VP, the W3C Digital Credentials API staging, pairwise subject identifiers, minimum-claims sessions). But it was authored **without visibility into how much of it this platform has already built or ratified.** Taken verbatim it would silently fork the identity spine, re-derive the three-level persona reference model under new names, stand up a second OAuth gateway beside the one shipped earlier in this very session, and re-invent a "Session" primitive the constitutional hierarchy already names. This section is the correction; §§1–11 are the reconciled spec. **This is the most important section of the document — it is what prevents the operator from ratifying a plan that forks the spine.**

### 0.1 An OAuth façade over the Passport ALREADY EXISTS — for agents. "Sign in with Polity Passport" for humans is its complement, not a greenfield build.

`app/api/threshold/oauth/{authorize-init,complete,register,token}/route.ts`, backed by `services/threshold/gatewaySession.ts` + `services/threshold/gateway.ts` and the `agent_gateway_sessions` table (`supabase/migrations/20260806000000_agent_gateway_sessions.sql`, `…000000_agent_gateway_session_upgrade.sql`, plus two heal/text migrations), is the **metaMe Threshold gateway** — a working **OAuth 2.1 / PKCE-S256 / Dynamic Client Registration** gateway over the Polity Passport, chartered by `PRD-THR-001`. Verified in the code read for this PRD:

- `authorize-init/route.ts` validates `client_id` + `redirect_uri` against a registered allowlist, **enforces PKCE S256**, and creates a `pending` handshake bound to exactly those parameters. It deliberately grants only `CONSTITUTIONAL_ROOT_CAPABILITIES` at the base crossing (Finding 4 of the THR security review) — service capabilities are only added via an incremental, human-authorized service crossing.
- `token/route.ts` is a spec-shaped OAuth **authorization-code + PKCE** token endpoint: single-use code, PKCE `code_verifier` required, `redirect_uri` must match the one bound at `/authorize`.
- `gatewaySession.ts` stores **only sha256 hashes of bearers** (never raw), **only T2 references** (`principalPublicRef`, `agentAlias` — no T0 ids), degrades to `null` (unauthenticated) on any error, and is service-role-only with deny-all RLS. The `ScopedSession` shape already carries `{ principalPublicRef, agentAlias, agreementId, scope[], initiatingService, expiresAt, serviceAgreements }`.

Critically, `PRD-THR-001 §6` states the Handshake sequence already includes **step 4: "Human authenticates through the Polity Passport (Supabase spine)."** The human authentication is *already the pivot of every agent crossing* — the agent delegation is bolted onto a human Passport sign-in that the gateway performs today. **Therefore the PRD's central architectural question is NOT "build an OAuth gateway from scratch"** — that gateway exists. The question is: **is the Polity Access Gateway the SAME gateway generalized to serve both humans (web / OIDC / OIDC4VP) and agents (MCP), or a sibling service sharing the session substrate?** This PRD answers that question explicitly (§2.1) and recommends a direction grounded in what the Threshold code already does.

There is **no `PRD-AGB-001` file** in the repo — confirmed by `find codexes/packs -iname "PRD-*"`. The working-title "metaMe Agent Bridge / PRD-AGB-001" was **superseded by and folded into `PRD-THR-001`** (see PRD-THR-001's header: *"Supersedes: the working title metaMe Agent Bridge / PRD-AGB-001… the product is Threshold"*). So the "related Agent Bridge plan" this initiative gestures at **is** PRD-THR-001; there is no separate AGB doc to reconcile against, and this PRD treats THR as the agent-side canon.

### 0.2 The three-level persona reference model ALREADY EXISTS — cite it, do not re-derive it.

`services/identity/personaReferences.ts` (2026-07-18 operator direction, documented in CLAUDE.md's "three-level persona reference model" subsection) already implements exactly the identifier tri-partition Aletheon's "Private UUID / Public Reference / pairwise references supported later" section re-derives:

1. **Private Persona UUID** — T0; owner-authenticated wallet self-view only, masked by default. Never in receipts/broadcasts/locker/third-party calls.
2. **Polity Public Reference** — `personaPublicRef(personaId)` = `sha256(personaId).hex().slice(0,16)`; one-way, deterministic, T2-safe; the SAME derivation as the DVN pipeline's `hashPersonaRef`; **the only persona identifier that appears in receipts today.** Correlatable inside the governed Polity, which is acceptable there only.
3. **Pairwise External Service Reference** — `derivePairwiseRef(personaId, audience, generation)` = keyed **HMAC-SHA256** over `persona:audience:generation` using `PERSONA_PAIRWISE_REF_SECRET`, prefixed `prf_`; persisted in `persona_external_refs`; **revocable + regenerable** via generation bump; issued/listed through `issueExternalRef`/`listExternalRefs` (the `/api/wallet/identity/references` surface).

**Consequence for this PRD:** "pairwise per-application subject identifiers so a person isn't correlatable across apps" is **an already-implemented capability**, not future work. The Access Gateway does not build pairwise subjects — it **consumes `derivePairwiseRef(persona, rpAudience, generation)` as the `sub` claim** it hands each relying party. The only genuinely new surface is wiring that existing primitive as the OIDC/OIDC4VP `sub` per registered RP (audience = the RP's registered client id/domain). The naming is fixed: use `personaPublicRef` and the pairwise ref by their real names, never a new `subjectId`/`sourceClass`-style coinage.

### 0.3 The T0/T1/T2 tiers ARE the enforcement of Aletheon's "apps never receive raw Passport / private identifiers".

CLAUDE.md's "Identifier exposure tiers" table and its "**Five fields that MUST NEVER appear in browser-bound JSON or chain-bound receipts**" rule (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) are the exact constitutional mechanism behind Aletheon's minimum-claims principle. The session an application receives MUST carry **T1/T2 claims only** — `personaPublicRef` / a per-RP pairwise `sub`, `displayLabel`, `cartridgeFlags`, passport-status, standing/access claims, delegation claims, expiry — and **NEVER** a T0 identifier or the raw Passport record. §5 gives the precise claims table and cites the five-forbidden-fields rule as its enforcement. Note the **owner self-view exception** (operator-ratified 2026-07-18, in CLAUDE.md): a Bearer-scoped self-view route MAY return the caller's *own* persona UUID **to the sovereign wallet surface** — this matters because wallet form 1 (§3) is exactly that surface, so the embedded wallet showing the owner their own private UUID is permitted, while every RP-bound session claim is not.

### 0.4 CFS-024 already makes "Session" a level of the constitutional identity hierarchy — SessionQube formalizes it, it is not wholly new.

`CFS-024_constitutional-identity-hierarchy.md` (ratified 2026-07-10) pins `CONSTITUTIONAL_IDENTITY_HIERARCHY` as **Citizen → Passport → Personhood → Person → Personas → Delegated Agents → Sessions → Tasks.** "Session" is already a named level; `resolveConstitutionalContext(sessionId)` already returns a `session` field alongside `citizen/passport/standing/persona/boundAgents/assignedAgent`; `services/identity/personaSessionToken.ts` already exists; and `agent_gateway_sessions` already persists a scoped session (`ScopedSession`) bound to an agreement, with scope + expiry + per-service agreements. **Therefore Aletheon's "Constitutional Session (SessionQube)" is NOT wholly new.** The PRD positions it (§4) as *promoting the already-named Session level into a first-class, receipted constitutional object that COMPOSES* `personaSessionToken` + `agent_gateway_sessions` + `resolveConstitutionalContext().session` — explicitly **not** a parallel session system. §4 gives an honest new-vs-existing split.

### 0.5 The Passport machine API, credential builder, and graded personhood proof already exist — the Gateway extends them.

- `app/api/polity-passport/{submit,validate,status,credential,verify,verify-worldid,wallet,attest,issuer,registry,openapi.json}` + `app/.well-known/polity-passport/route.ts` — the Passport machine API + discovery surface, verified present.
- `services/passport/passportCredential.ts` — builds a **W3C-VC-shaped** credential envelope from a `polity_passport_records` row, containing **only public-safe fields** (commitment refs, status, validity — never `persona_id`/`kybe_identity_id`/`root_identity_id`). **Signing is HMAC-SHA256 stub today** (`PASSPORT_BUREAU_CREDENTIAL_SECRET`) — the file's own header says asymmetric, publicly-verifiable signing is **Phase C** (custody decision Bureau-KMS vs IC-canister pending). The PRD must be honest: OIDC4VP presentation of the Passport VC to *external* verifiers is **blocked on that Phase-C asymmetric signing** — a stub HMAC VC is not externally verifiable.
- `services/passport/personhoodProof.ts` — the **graded** proof-of-humanity ladder: `PersonhoodProofType = 'captcha' | 'world_id' | 'agent_declaration' | 'operator_attestation'`, `verifyWeakProof` (Cloudflare Turnstile) for read/write, `verifyWorldIdProof` (World ID) for money-moving. CLAUDE.md's whole "Worldcoin keys" section governs which key goes where. So "register a passkey during Passport issuance", "present the Passport credential", and "graded proof of humanity" all have existing substrate the Gateway extends. **WebAuthn/passkey itself is genuinely unbuilt** (grep confirms only a *comment mention* of "passkey" in `guidedOnboarding.ts`, no implementation) — so passkey enrolment is net-new, but it slots onto the existing passport-issuance seam.

### 0.6 The embedded Smart Wallet + wallet-over-cartridge overlay already exist — that IS Aletheon's "wallet form 1".

CLAUDE.md's "Wallet-Over-Cartridge Overlay — CANONICAL PATTERN" section documents `SmartWalletDrawer` (`app/components/content/SmartWalletDrawer.tsx`) mounted `variant="embedded"` inside `CodexCopilotLayer`, showing PersonaQube + PassportQube + AgentQubes. **Aletheon's "embedded Smart Wallet (form 1)" is this existing component.** The PRD references it as form 1 (reuse), and scopes forms 2 (lightweight Passport Wallet PWA) and 3 (browser extension) as the genuinely-new surfaces (§3).

### 0.7 The current auth substrate is Supabase — "Sign in with Polity Passport" wraps it, it does not replace it overnight.

`getActivePersona(request)` resolves the caller from a **Supabase Bearer token** (`personaFetch` / `getSupabaseAccessToken`, per CLAUDE.md's client-spine-fetch section). Every spine endpoint expects `Authorization: Bearer <supabase-token>`. The Access Gateway therefore **federates and sits ON TOP OF the existing Supabase auth** — it adds the Passport-presentation crossing, the pairwise per-RP subject, the short-lived constitutional session, and the OIDC/OIDC4VP RP surface, while the underlying persona resolution stays Supabase-backed. Username/password remains as **transitional recovery only**, exactly as Aletheon proposes — not ripped out. Claiming a same-day replacement of Supabase would be an overclaim.

### 0.8 Numbering + governance-charter check — no collision, no new charter.

`find codexes/packs -iname "PRD-*"` returns exactly `PRD-THR-001`, `PRD-MPY-001`, `PRD-EPI-001`, `PRD-ICA-001` in the IRL foundation; repo-wide the tracker also references `PRD-CCR/CFO/IPE/IRE/KRE-001` (bound to `CFS-037`–`041`/`CHRYSALIS_WORKSTREAM_TRACKER.md`). `PRD-AGB-001` does **not** exist (superseded into THR, §0.1). **`PRD-PAG-001` (Polity Access Gateway) is unused** — assigned here. No new IRL governance charter is required: `IRL-016` governs *experiment* lifecycle/freeze and does not apply — this is product/security architecture, not an experiment. Its constitutional parents are the Identity & Access Spine, `CFS-024`, `CFS-043`, and `PRD-THR-001`; ratification is by operator direction under the same regime as those.

---

## 1. Objective & thesis

Make the **Polity Passport the root authentication/authorization credential** for the whole iQube-compliant ecosystem, with the **Smart Wallet as holder/selector**, so a person who claims a Passport inside their agent (Claude/ChatGPT/Claude Code — via the already-built Threshold crossing) can later **"Continue with Polity Passport"** on `metame.live`, IRL OS, Founder Office, Studio, and any external relying party — **no username/password.**

Operator framing (verbatim, retained): the Passport should *become the login credential* rather than integrating into various sign-on systems; the operator weighs "a browser plugin vs a smart-wallet plugin" and notes the smart wallet is *"ultimately where the passport-verified credential is housed."* Aletheon's decisive correction (retained): *"the right answer is not simply 'build a browser plugin' — the deeper requirement is to make the Polity Passport the root credential, with the Smart Wallet as holder/selector; a browser extension is one access surface, but should not become the only way the system works."* This PRD encodes that: the **wallet is the canonical holder** (three forms, §3); the browser extension is the **preferred access connector for the metaMe journey** — it is never the identity store, and it must not become the exclusive technical means of Passport-native authentication (Amendment A §A.7, ruled 2026-07-26).

**The clean separation the whole design rests on** (Aletheon's, retained and sharpened against the code):

| Concern | What proves it | Existing substrate |
|---|---|---|
| **Authentication** — "does this human control this wallet/passport?" | **passkey (WebAuthn)** proves wallet control; graded personhood proof proves human-present | `personhoodProof.ts` (graded) exists; **WebAuthn net-new** |
| **Presentation** — "what constitutional status/claims does this human hold?" | **Passport credential presentation** (OIDC4VP for external verifiers; direct for first-party) | `passportCredential.ts` VC builder exists (HMAC stub → Phase-C asymmetric) |
| **Operating context** — "as which persona are they acting?" | **persona selection** in the Smart Wallet | persona selection + `personaPublicRef` + pairwise refs all exist |
| **Authorization** — "what may this session do?" | **access grant** → session scope | `evaluateAccess` + `serviceRegistry` scope model exist |
| **Delegated authority** — "what may an agent do for them?" | **bounded delegation grant** (human-authorized) | `constitutionalAgreement.ts` + `agent_gateway_sessions` exist |

Authentication and presentation are **different acts** and must never collapse into one — that separation is what lets a person authenticate weakly for a read and present a strongly-graded Passport only when a money-moving RP demands it (the graded ladder, §0.5).

---

## 2. The reconciled architecture

### 2.1 The central question, answered: the Access Gateway is the Threshold gateway GENERALIZED — one Constitutional Handshake, two presentation channels — not a sibling.

**Recommendation: generalize the existing Threshold gateway into the Polity Access Gateway.** The human OIDC / OIDC4VP web channel and the agent MCP channel are **two presentation adapters over ONE Constitutional Handshake and ONE session substrate** (`agent_gateway_sessions` + the `serviceRegistry` scope model). This is a **sibling of neither**: it is the same core with an added human/OIDC adapter.

**Why (grounded in the code, not asserted):**

1. **The gateway already authenticates the human.** `PRD-THR-001 §6` step 4 is "Human authenticates through the Polity Passport (Supabase spine)." A plain "Sign in with Polity Passport" for a web RP **is that same step 4, terminating in a human session instead of continuing into an agent delegation.** The human-login path is the *more fundamental half of what already ships* — it is cheaper to expose it than to duplicate it.
2. **The OAuth machinery is shared verbatim.** `authorize-init` + `token` + PKCE-S256 + DCR + the hashed-bearer/T2-only session store already exist and are RP-agnostic. A second gateway would re-implement PKCE, DCR, the bearer-hash discipline, and the deny-all-RLS session table — a textbook **CS-001 "duplicate capability as constitutional drift"** infraction (`CS-001_duplicate-capability-as-constitutional-drift.md`), the exact failure mode CLAUDE.md's "Extend, Don't Duplicate" core principle forbids.
3. **The scope/authorization model is shared.** `CONSTITUTIONAL_ROOT_CAPABILITIES` + incremental service crossings + `serviceRegistry.grantableCapabilities` already model "what may this session do" for agents; a human session is the same scope model with the human as the direct subject.

**The honest caveat (this is where "generalize" ≠ "identical routes"):** the human/OIDC channel needs **net-new RP-facing surface the agent MCP channel never needed** — an OIDC/OIDC4VP authorization+token+`/present`+`/session`+`/introspect`+`/revoke`+`/logout` endpoint set with OIDC discovery metadata, and the **pairwise `sub` per RP** binding (§0.2). And the session **row shape differs**: `agent_gateway_sessions` today binds an `agreementId` + `agentAlias` (a delegation); a *human* web session binds a *persona* directly with **no** agent alias and **no** delegation (the human acts as themselves). So "generalize" means: **one core (handshake, PKCE/DCR, hashed-bearer T2 session store, scope model), two adapters (agent-MCP, human-OIDC), one session table extended to carry both row shapes** — not literally reusing the agent routes for humans. Sibling-vs-same is therefore resolved as *same core, added adapter*, and the table gains a nullable-agent-alias human row rather than a second parallel session store.

```
              The Existing World
   Web app (metame.live · IRL OS · Founder Office · Studio · external RP)
                        │  "Continue with Polity Passport"
                        ▼
   ┌───────────────────────────────────────────────────────────────┐
   │              POLITY ACCESS GATEWAY  (= Threshold gateway,       │
   │                       generalized)                             │
   │  ┌─────────────────────┐        ┌──────────────────────────┐   │
   │  │ HUMAN adapter        │       │ AGENT adapter (SHIPPED)  │   │
   │  │ OIDC / OIDC4VP        │       │ MCP + OAuth2.1/PKCE/DCR  │   │
   │  │ /authorize /token     │      │ authorize-init/token/... │   │
   │  │ /present /session     │      │ (PRD-THR-001)            │   │
   │  │ /introspect /revoke   │      └──────────────────────────┘   │
   │  │ /logout               │                                     │
   │  └─────────────────────┘                                       │
   │        ONE Constitutional Handshake · ONE session substrate     │
   │        (agent_gateway_sessions, T2-only, hashed bearers)        │
   └───────────────────────────────────────────────────────────────┘
                        │
                        ▼   passkey (auth) + Passport VC (presentation)
                  Smart Wallet  (holder / persona-selector / consent / delegation)
                        │
                        ▼
             Supabase-backed persona resolution (getActivePersona) — unchanged
```

### 2.2 The standards staging (kept as Aletheon has it — the citations are sound)

Aletheon's standards choices are correct and their **staging is honest about maturity** — retained without change:

- **WebAuthn / passkeys** — passwordless proof of wallet control. **Net-new**, enrolled on the existing passport-issuance seam (§0.5). Production-ready standard.
- **OpenID for Verifiable Presentations (OIDC4VP)** — the credential-presentation protocol for **external** relying parties. Production-viable standard, but **blocked for external verifiers until Passport VC signing is asymmetric (Phase C, §0.5)** — a first-party RP can consume the VC directly before then; an external verifier cannot verify an HMAC-stub VC.
- **W3C Digital Credentials API (`navigator.credentials` for VCs)** — the emerging browser-native presentation path. **Kept explicitly as emerging / not-yet-production**, exactly as Aletheon frames it — a Phase-4 target, not a Phase-1 dependency.

Confirmed by grep: **none of WebAuthn / OIDC4VP / the Digital Credentials API exists in the codebase today** (the only hit is a prose comment). So all three are honestly net-new standards work — but the identity, persona-reference, credential-envelope, graded-proof, scope, and session substrates they plug into all already exist.

---

## 3. The three wallet forms

The Smart Wallet is the canonical **holder** of the Passport-verified credential (operator: *"ultimately where the passport-verified credential is housed"*). Three forms, with honest build-state:

| Form | What it is | Build state | Anchor / scope |
|---|---|---|---|
| **1 — Embedded Smart Wallet** | The full wallet inside metaMe (PersonaQube / PassportQube / AgentQubes), persona selection + consent + delegation | **EXISTS** — `SmartWalletDrawer` (`variant="embedded"` in `CodexCopilotLayer`, the wallet-over-cartridge canonical pattern, CLAUDE.md) | Reuse. Add: passkey enrol/unlock + "present Passport" + OIDC4VP consent screen. Owner self-view of own UUID permitted here (§0.3). |
| **2 — Lightweight Passport Wallet PWA** | Standalone installable app: unlock / status / present / persona-select / delegate / consent / QR (cross-device) | **NET-NEW** | Genuinely new surface. Consumes the same Gateway + the same VC + the same pairwise `sub`. Not the identity store — a *view* over the persona/passport substrate. |
| **3 — Browser extension** | Convenience connector for "Continue with Polity Passport" on external sites | **NET-NEW, explicitly optional** | **NOT the canonical identity store; NOT required for metaMe login.** One access surface among several (Aletheon's correction, §1). A same-device convenience over what the PWA/embedded wallet already do. |

**Same-device (redirect) + cross-device (QR) flows** both terminate at the same Gateway handshake; the QR path is how form 2/3 present from a phone to a desktop RP. Passkey proves wallet control; Passport presentation proves constitutional status; persona selection sets operating context; access grant sets permissions; bounded delegation sets agent authority — five distinct acts (§1 table), never collapsed.

---

## 4. The SessionQube primitive — formalizing CFS-024's already-named Session level

Aletheon proposes making the web session a **first-class constitutional object ("Constitutional Session / SessionQube")** — receiptable, inspectable, delegable, revocable, transferable between apps, eventually synced across decentralized infra, aligned with the IntentQube/ExperienceQube/CapabilityQube object model. **This is positioned honestly as formalization, not invention:** "Session" is already level 7 of `CONSTITUTIONAL_IDENTITY_HIERARCHY` in `CFS-024`, and a scoped session object already ships in `agent_gateway_sessions`. SessionQube **promotes** that level to a first-class Qube that **composes** the existing pieces — it must **not** become a parallel session system.

### 4.1 Honest new-vs-existing breakdown

| SessionQube field / capability | Status | Where it lives today |
|---|---|---|
| Active persona reference | **EXISTS** | `ScopedSession.principalPublicRef` (`personaPublicRef`); `resolveConstitutionalContext().persona` |
| Delegation context | **EXISTS** | `ScopedSession.agreementId` + `serviceAgreements`; `constitutionalAgreement.ts` |
| Granted capabilities / application scope | **EXISTS** | `ScopedSession.scope[]` + `initiatingService`; `serviceRegistry` |
| Expiry | **EXISTS** | `ScopedSession.expiresAt`; hashed single-use codes |
| Session as a named hierarchy level | **EXISTS** | `CFS-024` `CONSTITUTIONAL_IDENTITY_HIERARCHY` (…→ Sessions → Tasks); `resolveConstitutionalContext().session` |
| Passport reference on the session | **PARTIAL** | Passport resolvable via `resolveConstitutionalContext().passport`; not yet stamped onto the session row |
| **Human (non-agent) session row shape** | **NEW** | `agent_gateway_sessions` is agent-scoped (binds `agentAlias`); a human web session binds a persona with **no** agent alias / delegation |
| **Constitutional receipt hash / consent receipt** | **NEW** | No session-issuance receipt today; would compose the unified receipt writer / DVN pipeline (do NOT modify the DVN pipeline files — CLAUDE.md PARAMOUNT; add a receipt *type* only) |
| **Standing snapshot embedded** | **NEW** | `resolveConstitutionalContext().standing` is null in Phase 1 (CFS-024 honest-limits); threading it is downstream |
| **Cross-app session transfer** | **NEW** | Not implemented; a genuinely new capability |
| **Inspect / revoke as a Qube in the wallet** | **NEW (surface)** | Revocation exists (TTL / status flip / `maxActions`); surfacing the session as an inspectable wallet Qube is new |
| **Decentralized sync** | **NEW / future** | Aspirational; not scoped for early phases |

**Rule:** SessionQube is a **projection/promotion** of the existing session substrate into a receipted, wallet-inspectable object — implemented by *extending* `agent_gateway_sessions` (nullable agent alias for human rows) and *composing* `personaSessionToken` + `resolveConstitutionalContext`, never by standing up a second session store. `personaSessionToken.ts` is a protected spine file — any change to it requires operator approval; SessionQube composes it, does not fork it.

---

## 5. Tier-exposure table — exactly what claims an application session may carry

The session an RP receives is **T1/T2 only.** Enforcement: CLAUDE.md's "**Five fields that MUST NEVER appear in browser-bound JSON or chain-bound receipts**" (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) + the "Identifier exposure tiers" table. A session claim set that includes any T0 field is a **critical identity infraction**, not a bug to be waved through.

| Claim in the RP session | Tier | Source primitive | Allowed? |
|---|---|---|---|
| Pairwise subject `sub` (per RP) | **T2** | `derivePairwiseRef(persona, rpAudience, generation)` | ✅ the RP's subject id |
| `personaPublicRef` (governed-Polity handle) | **T2** | `personaPublicRef(personaId)` | ✅ for first-party / in-Polity RPs; prefer pairwise for external |
| `displayLabel` | **T1** | active-persona surface | ✅ |
| `cartridgeFlags` (isAdmin/isPartner/adminCartridges) | **T1** | server-resolved via spine | ✅ (optimistic UI only; server re-validates every gate) |
| Passport status / grade (verified personhood, class, validity) | **T2** | `passportCredential.ts` public-safe fields | ✅ |
| Standing / access claims | **T1/T2** | `evaluateAccess` decision, standing snapshot | ✅ (as commitments, not raw records) |
| Delegation claims (scope, TTL, agreement ref) | **T2** | `ScopedSession.scope` + agreement ref | ✅ |
| Expiry / consent-receipt ref | **T2** | session row + receipt hash | ✅ |
| **`personaId` (raw UUID)** | **T0** | — | ❌ NEVER (owner self-view to own wallet only, §0.3) |
| **`authProfileId`** | **T0** | — | ❌ NEVER |
| **`rootDid` / KybeDID root** | **T0** | — | ❌ NEVER |
| **`kybeAttestation`** | KYC | — | ❌ only via explicit `discloseCredential()` |
| **Raw Passport record** | — | — | ❌ NEVER — only the public-safe VC envelope |
| **Wallet contents / locker items** | T0/gated | — | ❌ NEVER on an RP session |

---

## 6. Constitutional guardrails

### 6.1 Principal–Delegate Separation (CFS-043 §2) — binds every layer

**Only the human authenticates, authorizes, selects the persona, and approves delegation. The agent never authenticates and never approves.** This is not policy bolted on — it falls out of the agreement lifecycle: `authorizeAgreement` refuses unless the authorizer's owner-commitment matches the agreement owner; acceptance (`acceptorType:'agent'`) never opens the gate; the delegate (`selectedAgentRef`) and the owner/authorizer (human persona commitment) are structurally different fields. **No agent-authenticate / agent-authorize path exists in the code, and none will be created by this initiative.** (Mirrors how PRD-THR-001 §5.2 and CFS-043 §2 state it for the agent gateway.)

The `authorize` / login-approval step is a **human-present action** gated by the **graded** proof-of-humanity ladder (§0.5): weak captcha by default (read/write), strong World ID / passkey for money-moving RPs. Strength scales with RP/contract risk; the boundary holds at every grade.

### 6.2 The spine is the one resolver — no parallel gate

Every access decision on a Gateway-issued session still flows through `getActivePersona` / `evaluateAccess` (CLAUDE.md "Don't rebuild these — the spine already provides them"). The Gateway federates *authentication*; it does **not** introduce a parallel authorization resolver. RP `isAdmin`/`isPartner` claims are **optimistic UI only** — server-side gates re-resolve from the persona every time (CLAUDE.md "Security — Access Gates" PARAMOUNT).

### 6.3 Protected files — untouched

`getActivePersona.ts`, `personaSessionToken.ts`, `evaluateAccess.ts`, `policyResolvers.ts`, `getContentDescriptor.ts`, `encryption.ts`, `stateCDelivery.ts`, `types/access.ts` (identity/access spine) and the DVN pipeline files (`activityReceiptDvnPipeline.ts`, `icAgent.ts`, `cross_chain_service.ts`) are **extend-by-composition only.** SessionQube receipting adds a *receipt type*, never a change to the DVN submission mechanism. Any spine-touching implementation is gated on `scripts/verify-spine.mjs` and the `tests/persona-spine-fetch.test.ts` / `tests/access-spine.test.ts` canaries.

---

## 7. Phased rollout (Aletheon's Phase 1–4, reconciled against what already exists)

Phase names retained; each reconciled so the operator sees what is genuinely new vs. already-shipped.

- **Phase 1 — Passport login across first-party surfaces** (metaMe / IRL OS / Founder Office / Studio / Aigent Z). "Continue with Polity Passport": passkey enrol/unlock (**new**) + Passport presentation (**VC builder exists**; first-party can consume the HMAC-stub envelope directly) + **persona selector (EXISTS)** + **pairwise per-RP subject (EXISTS — `derivePairwiseRef`)** + short-lived session (**extend `agent_gateway_sessions` with a human row shape**) + recovery. **Keep username/password as transitional recovery only** (§0.7). *Net-new in Phase 1 is narrower than Aletheon's draft implies — persona selection and pairwise ids are already built; the new work is passkey + the human-OIDC adapter + the human session row.*
- **Phase 2 — Lightweight Passport Wallet PWA** (wallet form 2). Genuinely new surface (§3).
- **Phase 3 — Browser extension / metaMe Companion** (wallet form 3). **The preferred Threshold Crossing connector** for the metaMe journey, and part of the intended Agent Me sequence — but never the identity store, and never the exclusive technical route to Passport-native access: the same protocol must remain reachable through another compatible wallet or web connector (Amendment A §A.7, ruled 2026-07-26).
- **Phase 4 — External relying-party integration kit.** Verifier SDK, **OIDC4VP** metadata, credential-request schemas, pairwise refs, access-grant + delegation verification, certification. **Gated on Passport VC Phase-C asymmetric signing (§0.5)** — external verification of an HMAC-stub VC is not possible; this dependency must be called out to the operator, not glossed. The W3C Digital Credentials API path is a Phase-4 *emerging* target, not a hard dependency.

**Sequencing dependency to flag:** Phase 4 (external RPs) cannot ship credential presentation to third parties until the Passport credential is asymmetrically signed. Phase 1 (first-party) can proceed on the existing stub because first-party surfaces trust the Bureau secret. This dependency should be scheduled explicitly.

---

## 8. Out of scope / non-goals

- **Does NOT modify the identity/access spine or DVN pipeline files** (§6.3). Extension by composition only.
- **Does NOT replace Supabase auth** — federates on top of it; username/password stays as transitional recovery (§0.7).
- **Does NOT build the three-level persona reference model** — it exists (§0.2); the Gateway consumes it.
- **Does NOT build pairwise subject identifiers** — `derivePairwiseRef` exists; the Gateway wires it as the OIDC `sub` per RP.
- **Does NOT create a second OAuth gateway** — it generalizes the Threshold gateway (§2.1); a parallel gateway would be a CS-001 infraction.
- **Does NOT create a parallel session store** — SessionQube extends `agent_gateway_sessions` + composes existing session primitives (§4).
- **Does NOT make the browser extension canonical or required** — it is one optional access surface (§3, §1).
- **Does NOT ship external credential presentation before Passport VC asymmetric signing (Phase C)** — flagged as a hard dependency (§7).
- **Does NOT create any agent-authenticate / agent-authorize path** — Principal–Delegate Separation is absolute (§6.1).
- **Does NOT emit any T0 identifier in an RP session** (§5).
- **No new IRL governance charter** — this is product/security architecture, not an experiment (§0.8).

---

## 9. What already exists (reuse — do NOT rebuild)

| Capability | Anchor | Reuse implication |
|---|---|---|
| OAuth2.1 / PKCE-S256 / DCR gateway over Passport | `app/api/threshold/oauth/{authorize-init,complete,register,token}`, `services/threshold/gateway.ts` | Generalize — add human/OIDC adapter; do not duplicate |
| Scoped-session store (hashed bearers, T2-only, deny-all RLS) | `services/threshold/gatewaySession.ts`, `agent_gateway_sessions` migrations | Extend row shape for human sessions; do not fork |
| Constitutional Handshake sequence (incl. human Passport auth step) | `PRD-THR-001 §6`, `services/constitutional/guidedOnboarding.ts` | The human login IS handshake step 4 |
| Three-level persona reference model | `services/identity/personaReferences.ts` (`personaPublicRef`, `derivePairwiseRef`) | Consume as `sub` / receipts; do not re-derive |
| Constitutional identity hierarchy incl. Session level + resolver | `CFS-024`, `services/identity/constitutionalContext.ts` (`resolveConstitutionalContext`) | SessionQube promotes the Session level; compose the resolver |
| Session token primitive | `services/identity/personaSessionToken.ts` (PROTECTED) | Compose, do not fork; operator approval to touch |
| Passport VC builder (public-safe envelope) | `services/passport/passportCredential.ts` (HMAC stub → Phase-C asymmetric) | Present via OIDC4VP once asymmetric |
| Graded proof-of-humanity ladder | `services/passport/personhoodProof.ts` (`verifyWeakProof`/`verifyWorldIdProof`) | Gate the human-authorize step by RP risk |
| Passport machine API + discovery | `app/api/polity-passport/*`, `app/.well-known/polity-passport` | Passkey enrol on the issuance seam |
| Embedded Smart Wallet (wallet form 1) | `app/components/content/SmartWalletDrawer.tsx` (wallet-over-cartridge pattern) | Add passkey/present/consent screens |
| Delegation authority + gate | `services/constitutional/constitutionalAgreement.ts`, `requireAuthorizedAgreement` | Bounded agent delegation; unchanged |
| Access decision gate | `services/access/evaluateAccess.ts` (PROTECTED) | One resolver; no parallel gate |
| Persona resolution | `services/identity/getActivePersona.ts` (PROTECTED) | Supabase-backed; federated, not replaced |

**Net-new:** the human OIDC / OIDC4VP adapter (`/authorize /token /present /session /logout /revoke /introspect` + discovery metadata) over the generalized gateway; **WebAuthn/passkey** enrolment + unlock; the **human session row shape**; the **Passport Wallet PWA** (form 2); the optional **browser extension** (form 3); **SessionQube's** receipt hash + wallet-inspectable projection + cross-app transfer; the **Phase-4 verifier SDK / RP integration kit**; and the **Phase-C asymmetric Passport-VC signing** dependency (custody decision Bureau-KMS vs IC-canister — already flagged in `passportCredential.ts`).

---

## 10. Ratification record

**RATIFIED by operator direction, 2026-07-22.** Phase 1 implementation chartered the same day (services/accessGateway/* human adapter over the shared Threshold substrate, migration 20260813000000, /api/access-gateway/* routes, consent page, SessionQube projection + canaries — no protected spine/DVN file modified).

- [x] Operator ratifies **PRD-PAG-001** — the Access Gateway is the **generalized Threshold gateway** (one handshake, human-OIDC + agent-MCP adapters, one session substrate), **not** a sibling service (§2.1).
- [x] Operator confirms the **central architectural direction** (§2.1) — generalize vs. sibling — with the honest caveat that "generalize" = same core + added human adapter + human session row, not identical routes.
- [x] Operator confirms **SessionQube** is a promotion of CFS-024's Session level composing existing session infra, not a parallel session store (§4).
- [x] Operator confirms the **tier-exposure claims table** (§5) — T1/T2 only, five-forbidden-fields enforced.
- [x] Operator confirms **Principal–Delegate Separation** carries to the human login path — no agent-authenticate path ever (§6.1).
- [x] Operator acknowledges the **Phase-C asymmetric-signing dependency** blocking external OIDC4VP presentation (Phase 4) and the custody decision (Bureau-KMS vs IC-canister) (§0.5, §7).
- [x] Operator confirms **username/password stays as transitional recovery**, Supabase auth is federated not replaced (§0.7).
- [x] Operator confirms **no protected spine / DVN file is modified** and any future implementation is gated on `scripts/verify-spine.mjs` + spine canaries (§6.3).
- [x] On ratification, a separate **authorized implementation pass** is chartered (not this PRD) — spine-touching work under operator approval only. *(Chartered 2026-07-22: Phase 1 only; no spine file touched.)*

---

---

# AMENDMENT A — Passport-native access (operator specification, 2026-07-26)

**Status:** architecture **RULED** 2026-07-26 (§A.3, §A.7); implementation plan drafted
(§A.9); **nothing is built.** Implementation is gated on the operator completing the §A.10
ratification record. The change creates an unauthenticated session-minting path, which is
operator-approval-only (§6.3, CLAUDE.md "Identity & Access Spine") — though under ruling
A.3.2 it now requires **no protected-file modification at all** (§A.9.1).

The operator specified a Passport-native access path with the governing rule:

> Do not require an account session in order to prove the Passport that is intended to
> establish the account session.

This amendment records what that rule finds in the **shipped** Phase 1, what the operator's
specification genuinely adds beyond this PRD, and what must be decided before code.

## A.1 The finding: Phase 1 shipped as authorization, not authentication

Phase 1 shipped on 2026-07-22 (§10) — `services/accessGateway/{humanSession,sessionQube}.ts`,
six `/api/access-gateway/*` routes, migration `20260814000000_access_gateway_human_sessions.sql`,
`tests/access-gateway-human-session.test.ts`. It works. But it implements the **consent** act
for an **already-authenticated** human, not primary authentication:

| Evidence | What it shows |
|---|---|
| `app/api/access-gateway/complete/route.ts:41-44` | The act that mints the authorization code calls `resolvePersonaOrTimeout` and returns **401 `unauthenticated`** without a Supabase session. |
| `app/access-gateway/authorize/page.tsx:121` | The consent page reaches `complete` via `personaFetch` — which attaches the Supabase Bearer. |
| `services/accessGateway/humanSession.ts:343` | The Passport is read from `polity_passport_records` **keyed by `personaId`** — i.e. resolved *from* the session. |

The route's own header states this plainly: *"Called from the browser consent page by the
SIGNED-IN human. Phase 1 federates the existing Supabase auth (PRD §0.7)."* That was a
correct reading of §0.7 at the time. It also means the Passport currently functions as **a
claim attached to a pre-existing account** — precisely the reduction the operator's
specification forbids.

## A.2 The circular dependency, located exactly

```
getActivePersona                    services/identity/getActivePersona.ts:353
  └─ getCallerIdentityContext       services/wallet/personaRepo.ts:219-221
       └─ requires  Authorization: Bearer <supabase-jwt>
            └─ → authProfileId → owned personas → personaId
                 └─ polity_passport_records keyed by persona
```

No account session → no `authProfileId` → no persona → **no Passport read**. The credential
that is meant to establish the session is only reachable *from* the session. One direction
of one dependency is backwards; everything else in the chain is sound.

## A.3 Architecture rulings (Aletheon via operator, 2026-07-26) — RULED

Both open decisions are now ruled. The governing invariant:

> **Multiple proofs may enter the identity spine; only one constitutional principal model
> exits it.**

### A.3.1 Principal resolution — a second credential entry, not a second spine

Passport proof becomes a **second credential kind** entering the existing identity boundary.
It must not create a second interpretation of KybeDID, canonical Passport, persona, standing,
delegation or authority.

```ts
type CallerCredential =
  | { kind: 'supabase-session'; bearerToken: string }
  | { kind: 'passport-proof'; proofId: string };
```

Both paths terminate in the **same canonical `CallerIdentityContext`**. A bounded pre-session
resolver (`resolveCallerFromPassportProof()`) may verify the proof, but it must resolve into
that same structure and must never become a durable sibling authority system.

### A.3.2 Session minting — Passport-primary, Supabase-compatible

```
Passport / KybeDID   = identity and authority root
Supabase user        = internal application principal record
Supabase session     = application session transport
```

Supabase remains the **application-session compatibility envelope for this phase**; it is no
longer the constitutional source of identity. After successful Passport verification the
platform resolves — or silently provisions — an internal Supabase principal and issues the
session. **The citizen never creates, names, password-protects or signs into that record.**

Binding key: the **canonical personhood lineage (KybeDID)**, never email, wallet address,
persona id, or a provisional Passport record — so wallets, personas and superseded Passport
credentials can change without minting duplicate users.

**The binding edge already exists in schema and is indexed** (verified 2026-07-26):

```
kybe_identity                                   ← canonical personhood
  ↑ root_identity.kybe_id
    root_identity.auth_user_id → auth.users     ← the Supabase principal
```

`supabase/migrations/20260427000000_root_did_persona_binding.sql:17` comments
`root_identity.auth_user_id` as *"Supabase auth.users id — canonical link between auth
session and root DID"*, with `idx_root_identity_auth_user_id` on it.
`services/identity/personhoodResolver.ts:89-100` already walks it in the session→kybe
direction. **Passport-native access is the same edge walked in reverse.** No new binding
table is required; provisioning is needed only when no `root_identity` row exists for the
resolved kybe.

### A.3.3 SessionQube — constitutional record, not yet the runtime session

```
Passport proof → SessionQube (authorization receipt) → Supabase-compatible app session
```

SessionQube records what was proven, which Passport lineage resolved, the assurance level,
consent, audience, expiry and authorization constraints. It does **not** replace the
operational web session in this amendment — doing so would convert a new authentication path
into a runtime-wide authentication migration. Direct SessionQube spine support is a
**separately chartered phase**.

### A.3.4 The pre-session constraint

**No pre-session flow may require `personaId`, `authProfileId` or `didPersonaId`.** Personhood
and persona are resolved only *after* holder proof succeeds:

```
connection request → challenge → holder proof → Passport resolution
→ personhood resolution → persona / default operating context → session
```

## A.4 Security finding — the existing challenge primitive is NOT replay-safe for sessions

`services/identity/walletAliasService.ts` already provides `buildOwnershipChallenge(...nonce, domain)`
and `verifyEvmOwnership()` (ethers `verifyMessage`) — a SIWE-shaped challenge, reusable.
**But `app/api/identity/wallet-alias/challenge/route.ts` states: "Nonces are stateless —
they're embedded in the message."** Nothing consumes them.

That is acceptable for its current job (wallet-alias binding re-validates persona ownership
at register time). It is **not** acceptable for session establishment: a replayed signed
challenge would mint a session. The operator's own requirements — *single-use, short-lived,
audience-bound, resistant to replay* — therefore require a **server-side single-use nonce
store**, which does not exist. This must be built before the challenge primitive is reused
for authentication, not after.

The challenge message is also keyed to `didPersonaId`, which a pre-session caller does not
have. Passport-native access needs an audience/origin-bound form keyed on the wallet address.

## A.5 Passport multiplicity and consolidation — genuinely new, mostly expressible in existing primitives

Not covered anywhere in §§1–10. The operator's model:

```
Provisional Passports (low-assurance, e.g. captcha)
        ↓ high-assurance uniqueness proof (World ID)
Canonical Passport lineage established
        ↓
predecessors retained for provenance; one active canonical Passport
```

Two existing primitives carry most of this and must be reused rather than re-invented:

1. **The graded personhood ladder already exists** — `services/passport/personhoodProof.ts`:
   `PersonhoodProofType = 'captcha' | 'world_id' | 'agent_declaration' | 'operator_attestation'`,
   with `verifyWeakProof` / `verifyWorldIdProof`. "Provisional" vs "canonical" is the
   *existing* grade distinction, not a new axis.
2. **The consolidation transition already exists** — `services/passport/passportStatusMachine.ts`
   ratifies `active → superseded_by_reissue`, evidence `reissue_continuity_binding`,
   reversibility `one_way`. That is the operator's "predecessor" state, already ratified.

Net-new is therefore narrower than the specification implies: the **lineage resolution**
(which provisional Passports belong to one verified personhood), the **deterministic origin
rule** (earliest valid Passport unless the citizen selects another), and the **reconciliation
of standing and delegation** so consolidation cannot duplicate standing or silently
resurrect revoked delegation. The operator's rule — *never merge on matching email or
display name* — aligns with the existing spine rule against email-based binding and should
be canaried.

## A.6 Holder-control tiers

The operator's three levels map onto existing substrate as follows:

| Level | Status |
|---|---|
| 1 — presence + local wallet approval | Challenge/verify primitives exist (§A.4); the single-use nonce store does not. |
| 2 — passkey-protected | **WebAuthn/passkey remains genuinely unbuilt** — §0.5 and §9 already record this; grep still finds only a comment mention in `guidedOnboarding.ts`. |
| 3 — step-up for consequential acts | `requireAuthorizedAgreement` + the graded ladder exist; the *risk→grade* binding is unstated. |

The operator's framing is endorsed and should be recorded as the rule: **additional passkey
enrolment is optional for ordinary access; cryptographic holder-control proof is not
optional; step-up is mandatory where consequence requires it.**

## A.7 The Companion's status — RULED

**Ruling:** *The Companion is the preferred access connector for the metaMe journey. It is
never the identity store and must not become the exclusive technical means of Passport-native
authentication.*

Applied to this PRD's body: §1's framing sentence and §7 Phase 3 have been revised
accordingly (2026-07-26). Consequences:

- the Passport remains in the wallet; the Companion facilitates presentation and holder approval;
- Passport-native access must remain reachable through another compatible wallet or web connector;
- installing the Companion is part of the intended Agent Me journey, but the **access protocol
  must not technically depend on that single client**. Any route, service or canary that would
  only work with the extension present is an infraction of this ruling.

## A.8 Delegation stays separate — already correct

The operator's `Passport valid ≠ delegation valid` rule is already the shipped posture:
`complete/route.ts` forms no delegation (`agent_alias` / `agreement_id` stay NULL on the human
row) and CFS-043 Principal–Delegate Separation is absolute. The one behavioural addition is
that **missing delegation must route to a delegation-activation flow, never to a sign-in
wall** — which becomes possible only once §A.3 lands.

## A.9 Implementation plan (chartered on ratification — NOT YET BUILT)

### A.9.1 Protected-file impact — **zero**

The headline consequence of ruling A.3.2. Because the Passport path terminates in a canonical
`authProfileId`, everything downstream of `getCallerIdentityContext` is unchanged.

| File | Protected? | Change |
|---|---|---|
| `services/identity/getActivePersona.ts` | **YES** (CLAUDE.md) | **NONE.** It calls `getCallerIdentityContext(request)` and consumes the result; a second credential kind resolving to the same context is invisible to it. |
| `services/access/evaluateAccess.ts` | **YES** | **NONE.** One decision gate, unchanged. |
| `services/identity/personaSessionToken.ts` | **YES** | **NONE.** |
| `services/wallet/personaRepo.ts` | no | Extend `getCallerIdentityContext` to accept the passport-proof credential; reuse the existing private `getOrCreateCanonicalAuthProfileId` (line 130) rather than forking it. |
| `services/identity/personhoodResolver.ts` | no | Add the reverse walk (kybe → root → `auth_user_id`). Composition only. |
| `services/identity/walletAliasService.ts` | no | Reuse `verifyEvmOwnership`; add an audience/origin-bound challenge builder that takes no persona id. |

**If an implementation pass finds it needs to modify a protected file, that is a signal the
design has drifted from this ruling — stop and re-ratify rather than requesting an exception.**

### A.9.2 Migration boundaries

One new table, additive, no backfill, no change to any existing row:

- `passport_connection_challenges` — the atomic single-use nonce store (§A.4):
  `{ id, nonce_hash, audience, origin, expires_at, consumed_at, requested_action,
     wallet_address (nullable), provisional_connection_id }`.
  Single-use is enforced by a **conditional update** (`UPDATE … SET consumed_at = now()
  WHERE id = $1 AND consumed_at IS NULL RETURNING *`) — consumption and check in one atomic
  statement, never read-then-write. Deny-all RLS, service-role only, mirroring
  `agent_gateway_sessions`.

Lineage/consolidation (§A.5) may need predecessor links on the passport record. It is
**deliberately not scoped here** — consolidation is a personhood-layer operation and should
be its own chartered increment so it cannot ride in on an authentication change.

Existing `access_gateway_human_sessions` (migration `20260814000000`) is extended for the
SessionQube authorization receipt if required — extended, never forked.

### A.9.3 Rollback strategy

Every step is reversible without data loss because nothing existing is modified:

1. **Feature-flagged entry.** The passport-proof credential kind is accepted only when the
   flag is on. Flag off ⇒ `getCallerIdentityContext` behaves byte-identically to today.
2. **Additive-only schema.** Dropping `passport_connection_challenges` removes the feature and
   nothing else; no existing table is altered.
3. **No session-format change.** Sessions minted through the Passport path are ordinary
   Supabase sessions (ruling A.3.2), so a rollback strands no live session in an
   unrecognisable format — the single strongest argument for keeping Supabase as the envelope
   this phase.
4. **Provisioned principals persist harmlessly.** A `root_identity`/auth user provisioned
   behind the flow remains valid under the existing sign-in path; rollback does not orphan a
   citizen who already crossed.
5. **Sign-in untouched throughout.** Phase 1's existing consent flow keeps working, so
   rollback is never the only way out of a failure.

### A.9.4 Canaries (the amendment is not done until these exist)

Load-bearing, negative first:

1. **No pre-session flow requires an identity the caller cannot have** — the challenge and
   proof routes must never reference `personaId`, `authProfileId` or `didPersonaId` in their
   request contract (§A.3.4). This is the canary that would have caught the original defect.
2. **A consumed challenge cannot mint a second session** — behavioural, driving the real
   conditional-update path with a replayed nonce.
3. **Both credential kinds resolve one context shape** — the passport path and the Supabase
   path produce the same `CallerIdentityContext` fields; no branch returns a variant.
4. **No protected file is modified** — structural, asserting the §A.9.1 table.
5. **Binding is never by email, wallet address, persona id or provisional passport** — only
   the canonical personhood lineage (mirrors the existing spine rule against email binding).
6. **T0 discipline holds on the new path** — no `personaId` / `authProfileId` / `rootDid` /
   `kybeAttestation` in any pre-session response, extending the existing spine canaries.
7. **Passport-native access does not depend on the Companion** (§A.7) — the protocol must be
   exercisable without the extension present.
8. `scripts/verify-spine.mjs` passes unchanged.

### A.9.5 Explicitly out of scope for this amendment

Passport consolidation/lineage (§A.5), passkey enrolment (§A.6 level 2), SessionQube as the
runtime session (§A.3.3), and external RP presentation (Phase 4, still gated on Phase-C
asymmetric signing). Each is separately chartered.

## A.10 Amendment ratification record

Architecture rulings issued by Aletheon via the operator, 2026-07-26, and folded into §§A.3
and A.7. Implementation remains **gated on this record being completed by the operator.**

- [x] §A.1 finding recorded — Phase 1 is authorization over an existing session; the Passport currently functions as an attribute of an account.
- [x] **Ruling 1** — Passport proof is a second credential entry into the existing spine; no independent Passport identity system (§A.3.1).
- [x] **Ruling 2** — both login methods resolve one canonical `CallerIdentityContext` (§A.3.1).
- [x] **Ruling 3** — Passport / KybeDID is the identity root (§A.3.2).
- [x] **Ruling 4** — Supabase remains the application-session compatibility envelope for this phase (§A.3.2).
- [x] **Ruling 5** — SessionQube records the constitutional session proof but does not replace the web session (§A.3.3).
- [x] **Ruling 6** — the Companion is the preferred connector, never the identity store, never exclusive (§A.7; PRD body revised).
- [x] **Ruling 7** — server-side single-use nonce consumption is a prerequisite (§A.4, §A.9.2).
- [x] **Ruling 8** — no pre-session flow may require `personaId`, `authProfileId` or `didPersonaId` (§A.3.4).
- [x] **Operator signs off the implementation plan** (§A.9) — protected-file impact, migration boundaries, rollback, canaries. *(Ratified 2026-07-26.)*
- [x] **Operator charters the implementation pass** *(2026-07-26: "PAG plan authorised pls execute").*

### A.10.1 Implementation progress

| Increment | State |
|---|---|
| **1. Single-use challenge store** (§A.4 prerequisite, ruling 7) | **SHIPPED** — migration `20260819000000` (operator-run 2026-07-26) + `services/passport/connectionChallenge.ts` + canaries. |
| **2. Reverse personhood walk** (kybe → root → `auth_user_id`) | **SHIPPED** — `services/identity/passportPrincipal.ts`. |
| **3. Principal + session resolution** | **SHIPPED** — `passportPrincipal.ts` + `services/identity/passportSession.ts`. |
| **4. Second credential kind in `getCallerIdentityContext`** | **NOT REQUIRED — deliberately not built.** See §A.10.2. |
| **5. `/api/passport-connect/{challenge,proof}`** | **SHIPPED** — both unauthenticated by design; neither calls the spine. |
| **6. Companion Connect states A–E** | **SHIPPED** — `components/companion/PassportConnectPanel.tsx`, mounted as the Companion's `connectGate` in place of every "Sign in to …" wall. |

**No protected file was modified** (§A.9.1) — canaried. 28 challenge/access canaries; full suite 137 files / 1786 tests green.

### A.10.2 Two findings from building it

**(a) Increment 4 is unnecessary, and building it would have been a defect.** Ruling 4 keeps
Supabase as the application-session envelope, so the passport path terminates in an
**ordinary Supabase session** (minted via `auth.admin.generateLink`, exchanged by the browser
with `verifyOtp`). `getCallerIdentityContext` therefore sees the Bearer it always saw and
needs no second credential kind. Adding one would have created a second path resolving the
same context — the parallel-implementation defect the spine rules exist to prevent. It also
keeps rollback safe: a session minted here is indistinguishable from any other, so disabling
the feature strands nothing.

**(b) The "no prior account" citizen is blocked UPSTREAM, in issuance — not in access.**
`services/passport/bureauIdentityService.ts` anchors every Passport to a Supabase auth user
("find-or-create `root_identity` by `auth_user_id`"). So every Passport that exists today
resolves an `authUserId` and the shipped flow works end-to-end with **no sign-in step**. But
the success criterion *"a new citizen can receive a Passport without first signing into
metaMe"* cannot be met by this amendment: it requires ISSUANCE to mint an account-less
lineage, which §8 puts explicitly out of scope. `resolvePassportPrincipal` returns
`principal_unprovisioned` for that case rather than inventing a synthetic principal —
**a separate charter is needed.**

### A.10.3 Still open

- **SessionQube recording (ruling 5)** — the Passport-backed session is not yet written to the
  SessionQube substrate. The existing human-session machinery is OAuth-handshake shaped
  (client_id, authorization code) and this is a first-party direct mint; forcing it in would
  be a parallel implementation. Needs either a row shape for direct mints or a receipt-side
  record. **Not silently skipped — named here.**
- **Account ↔ Passport binding** for existing account holders (§A.5 neighbourhood).
- **Passport consolidation / lineage** (§A.5), **passkey enrolment** (§A.6 level 2), external
  RP presentation — each separately chartered.



*Amendment authored docs-only, 2026-07-26. Builds nothing. Reconciled against the shipped
Phase 1 (`services/accessGateway/*`, `app/api/access-gateway/*`, `app/access-gateway/authorize/page.tsx`),
`services/identity/{getActivePersona,personhoodResolver,walletAliasService}.ts`,
`services/wallet/personaRepo.ts`, `services/passport/{personhoodProof,passportStatusMachine}.ts`.*


*Authored docs-only, 2026-07-22. Reconciled against `PRD-THR-001`, `CFS-024`, `CFS-043`, `services/identity/personaReferences.ts`, `services/threshold/{gateway,gatewaySession}.ts`, `app/api/threshold/oauth/*`, `services/passport/{passportCredential,personhoodProof}.ts`, and the Identity & Access Spine section of `CLAUDE.md`. Builds nothing; proposes an architecture for operator ratification.*
