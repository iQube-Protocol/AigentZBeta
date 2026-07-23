# PRD-MMC-001 — metaMe Companion ("The Constitutional Internet Everywhere")

**metaMe IRL / iQube Protocol / AgentiQ · Product/runtime architecture specification · Status: DESIGN (docs-first, ratify-before-build)**
**Initiative name:** *metaMe Companion — the constitutional layer that overlays the existing web. Formerly "Operation Passport"; reframed by operator direction, 2026-07-22: "Operation Passport should become metaMe Companion."*
**Owner:** AgentiQ Runtime stewards + Identity & Access Spine stewards + Polity Passport Bureau · **Origin:** operator + Aletheon design session, consolidated against the already-built identity spine, Threshold gateway, SmartTriad, embedded wallet, IRE, and observer-awareness pattern, 2026-07-22
**Governs:** the product umbrella under which the Polity Access Gateway (PRD-PAG-001) is the authentication + session layer — a first-class AgentiQ **runtime** whose Passport, Wallet, Personas, Agents, and Constitutional Intelligence follow the user onto any web surface, so "metaMe comes with me" rather than "how do I get into metaMe." **It specifies an architecture for the operator to ratify. It builds nothing.**

> **Governance note (binding, this PRD):** This is a **docs-only** deliverable. It touches two PARAMOUNT-protected substrates — the **Identity & Access Spine** (CLAUDE.md "Security — Access Gates", "Identity & Access Spine — CANONICAL SoT") and the **DVN pipeline** (CLAUDE.md "DVN Pipeline Protection") — and the **Observer** it proposes is the single most privacy-sensitive surface the platform has ever contemplated. Nothing here authorizes a code change. Every mechanism below is specified as **extension by composition** over existing systems — never a fork, never a parallel resolver, never a weakened gate, never a new session store, never a change to the DVN submission mechanism. The Observer is specified as **consent-gated and revocable by construction** (§4). Any implementation happens only after ratification, by a separate authorized pass, spine-touching work gated on `scripts/verify-spine.mjs` and the spine canaries.

> **Companion documents (read alongside):** `PRD-PAG-001_polity-access-gateway.md` — **THIS PRD IS ITS UMBRELLA**; PAG-001 is the Companion's authentication + session layer, not restated here. `PRD-THR-001_metame-threshold.md` — the agent-side MCP surface, one presentation surface over the same runtime. `CFS-024_constitutional-identity-hierarchy.md` (the Session level SessionQube promotes). `CFS-037_invariant-resolution-engine.md` / `services/invariants/resolution.ts` (the IRE the Context Engine feeds — "exactly like your IRE, browser-wide"). `CFS-022_constitutional-operating-environment.md` (the "AgentiQ Runtime" workstream row this Companion instantiates). The Identity & Access Spine, "Wallet-Over-Cartridge Overlay", "Artifact Production — AR/CPS + Observer Awareness", "metaMe Client Protocol Primitive", and "Inter-Cartridge Navigation" sections of `CLAUDE.md`.

---

## 0. Read this first — reconciliation against what's already built

Aletheon's "metaMe Companion" vision is the right product reframe, and its runtime-first architectural instinct is correct. But it was authored **without visibility into how much of it this platform has already built.** Most of the 15 components it proposes are extensions or new *presentation surfaces* over primitives that already ship — the embedded wallet, the embedded copilot, SmartTriad, the IRE, the observer-awareness pattern, the Threshold MCP gateway, the persona-reference model, the Qube object model, `buildCodexUrl`, and — critically — PRD-PAG-001, authored earlier in this same session, which **already owns** the authentication, persona-switching, and SessionQube scope this draft re-proposes. Taken verbatim the draft would stand up a second copilot, a second SmartTriad, a second session object, and a second grounding engine beside ones that exist. **This section is the correction; §§1–8 are the reconciled spec. It is the most important section of the document — it is what prevents the operator from ratifying a plan that forks the runtime, the spine, and PAG-001.**

### 0.1 The umbrella relationship to PRD-PAG-001 — the Companion is the product; PAG-001 is its auth+session layer.

The operator's decision is definitive: **"Operation Passport should become metaMe Companion."** PAG-001 is **not discarded** — it is subsumed. PAG-001 (Polity Access Gateway) specifies "Continue with Polity Passport", passkey/WebAuthn, the pairwise per-RP subject, the graded personhood ladder, and the SessionQube. The Companion is the **larger product** in which that gateway is the door and the session substrate. Three of Aletheon's 15 components are **wholly PAG-001's scope and are NOT redefined here**:

- **Component 5 (Universal Authentication)** = PAG-001's "Continue with Polity Passport" (PAG-001 §1, §2). The Companion is a **third presentation surface** over the Access Gateway — after the human-OIDC web channel and the agent-MCP channel, the Companion adds the **browser-extension / sidebar / overlay** surface. PAG-001 §2.1 already recommends generalizing the Threshold gateway into the Access Gateway with human-OIDC + agent-MCP adapters over **one Constitutional Handshake and one session substrate**; the Companion is a further adapter/surface over that same substrate, not a new auth system.
- **Component 6 (Persona switching always available)** = PAG-001's persona selection in the Smart Wallet (PAG-001 §1 table, §3) + the existing `aa-persona-change-v1` postMessage switch (CLAUDE.md). Existing capability, surfaced in the Companion; not rebuilt.
- **Component 13 (Constitutional Session = SessionQube)** = **PAG-001's SessionQube, EXTENDED, not a second SessionQube.** PAG-001 §4 already formalizes SessionQube as the promotion of CFS-024's already-named **Session** level (`CONSTITUTIONAL_IDENTITY_HIERARCHY` = Citizen → Passport → Personhood → Person → Personas → Delegated Agents → **Sessions** → Tasks) into a receipted object that *composes* `personaSessionToken` + `agent_gateway_sessions` + `resolveConstitutionalContext().session`. The Companion's contribution is to **add browser-context fields** to that same SessionQube — *applications visited, captured evidence, generated work* — as an additive projection. It **does not define a second SessionQube**, and the receipt hash it composes uses the unified receipt writer / DVN pipeline as a **receipt type only** (never a change to the DVN mechanism — CLAUDE.md PARAMOUNT).

**Rule:** anywhere this PRD touches auth, persona selection, or session, it **defers to PAG-001** and states the delta. PAG-001 is not restated; it is cited.

### 0.2 SmartTriad already exists — components 2, 3, 4 EXTEND it, they do not invent it.

`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` + `SmartTriadInferenceRenderer.tsx` + `services/smarttriad/primitiveRegistry.ts` already implement the constitutional copilot with inference rendering, R/T scoring dots, and the busy-pulse primitive (CLAUDE.md "metaMe Client Protocol Primitive — R/T scoring dots + busy pulse", canonical impl `SmartTriadCopilotLayer.tsx:renderDots`). So:

- **Component 2 (Constitutional Copilot sidebar "Ask metaMe")** = the existing SmartTriad copilot, mounted as a browser sidebar. Aletheon's differentiator ("Passport/persona/standing/venture/agent-aware, unlike ChatGPT") is exactly what the existing copilot already is when it runs inside a cartridge with the spine resolving the persona. **EXTENDS** — the new part is the *global sidebar surface*, not the copilot.
- **Component 4 (Universal SmartTriad)** = the existing SmartTriad **projected over browser context instead of only in-app**. Aletheon's own words: "SmartTriad no longer only inside metaMe, becomes Global SmartTriad over current browser context." That is a surface projection of a shipped component. **EXTENDS.** Do not fork the colour ramp, the dot geometry, the pulse condition, or the inference renderer — CLAUDE.md forbids diverging on the R/T primitive line-for-line, and a "Global SmartTriad" that re-implements `renderDots` is an infraction.

### 0.3 The embedded Wallet + embedded Copilot are the existing portable primitives (components 1, 2) — the Companion EXTRACTS them, it does not build them.

CLAUDE.md's "Wallet-Over-Cartridge Overlay — CANONICAL PATTERN" documents `SmartWalletDrawer` (`app/components/content/SmartWalletDrawer.tsx`) mounted `variant="embedded"` inside `CodexCopilotLayer` (`app/components/codex/CodexCopilotLayer.tsx`), showing PersonaQube + PassportQube + AgentQubes alongside (never on top of) the copilot. The operator **explicitly named the embedded wallet and the embedded copilot as "the most portable primitives that can follow a user anywhere."** So:

- **Component 1 (Embedded Smart Wallet always-available)** = the existing `SmartWalletDrawer variant="embedded"`. **EXISTS** — PAG-001 §3 already scopes this as "wallet form 1". The Companion's contribution is to lift that embedded pattern **out of metaMe's own cartridges and onto arbitrary web surfaces**. The primitive is done; the surface is new.
- The Companion is, architecturally, the **extraction of the embedded wallet + copilot flex pattern from `CodexCopilotLayer` onto a browser overlay**. Cite the canonical pattern; do not re-derive the mounting recipe (the CLAUDE.md section is explicit that the embedded-inside-copilot mount is the *only* path without z-index conflicts).

### 0.4 The Constitutional Observer + Context Engine (components 3, 15) = the existing observer-awareness pattern + the IRE, browser-scoped. Aletheon says so himself.

Aletheon: the Context Engine works "exactly like your IRE, except browser-wide" and the Observer offers help "exactly like SmartTriad today, except globally." Both statements are literally true and are the correct framing:

- **The IRE already exists.** `services/invariants/resolution.ts` (CFS-037 / PRD-IRE-001, RATIFIED 2026-07-17) is the Invariant Resolution Engine: *"RESOLUTION PRECEDES REASONING… construct the minimal Resolved Constitutional Field an intent requires BEFORE any iQube selection, agent assembly, or LLM call."* Its five phases (Qualify → Resolve → Expand → Calibrate → Assemble) are exactly the "Observer Context → Current Intent → Activity → Relevant Capabilities → Relevant Invariants → ground truth" pipeline Aletheon describes. **Component 15 (Context Engine) EXTENDS the IRE** — it feeds the SAME resolution/grounding path a new *input source* (browser context), it does not build a second grounding engine.
- **The observer-awareness pattern already exists.** CLAUDE.md "Artifact Production — AR/CPS + Observer Awareness" mandates that surfaces **consume the current state of their space through the observer pattern — "observed, never asserted."** The reference implementation is `/api/research/overview` + `components/composer/IRLResearchCopilotTab.tsx` (2026-07-13), whose header states its "PRIMARY mandate is to observe and narrate the live lab state" and whose observation-initiated turns are prefixed `[observed]`. **Component 3 (Constitutional Observer) EXTENDS this pattern** to a browser-context observation source.
- **The genuinely-new, highest-risk part (name it plainly):** the **browser-context OBSERVATION source itself** — reading the current page / domain / selection / document / workflow with consent — is net-new and is the single biggest risk in the whole concept. The resolution/grounding it feeds is not new. §4 treats the Observer with the seriousness CLAUDE.md's security sections demand: observation is consent-gated, revocable, T0 never leaves the wallet, and no browsing data is transmitted without an explicit per-capability grant.

### 0.5 MCP/Threshold is the agentic-host surface; the extension/overlay is the browser surface — complementary surfaces over ONE runtime, not alternatives.

`services/threshold/gateway.ts` (PRD-THR-001) is already the MCP surface "the Threshold Companion (the user's agent) speaks to." metaMe is **already inside Claude / ChatGPT / Claude Code via MCP**. The operator explicitly contrasts "the proper integration via MCP or the A2A API" with "this plugin" surface that observes regular-browser activity. **These are not alternatives to reconcile away — they are two presentation surfaces over the same Companion runtime:**

- **Agentic hosts (Claude/ChatGPT/VS Code/Claude Code)** → reached via **MCP/Threshold** (PRD-THR-001), already built (Increment 1 read-only slice live).
- **The regular, non-agentic web (Chrome/Safari/arbitrary sites)** → reached via the **Companion extension + sidebar + overlay**, this PRD's net-new surface.

Both carry the same Passport / personas / agents / context because both sit over the same runtime and the same Access Gateway session substrate. State this as the unifying architecture — it is Aletheon's runtime-first point (§0.6).

### 0.6 The runtime-first philosophy is already chartered — the Companion instantiates it, it is not a new runtime concept.

Aletheon's most important instruction is architecturally correct and already has a home: **make this a first-class AgentiQ runtime, NOT "just another browser extension"; the extension, mobile app, desktop app, embedded widget, and MCP-in-agentic-hosts are all different PRESENTATION SURFACES over the SAME Companion runtime.** This is consistent with existing doctrine:

- `CFS-022_constitutional-operating-environment.md` (the program of record) already names the **"AgentiQ Runtime"** workstream — *"Reasons, plans, delegates, loads invariants, maintains constitutional state"* — bound to `modelRouter`, `ontologyResolver`, `types/orchestration.ts` (Aigent Z/C/metaMe, NBEPlan, HandoffPayload), the DCIR `stateEngine`, the ICE `stageOrchestrator`, and bounded delegation.
- `CFS-025_...` (**The Artifact Runtime**) and `CFS-006_adaptive-runtime.md` charter the runtime doctrine (how invariant intelligence becomes runtime intelligence) that the Companion runtime is an instance of.

**Consequence:** frame the Companion runtime as an **instance of the already-chartered AgentiQ Runtime doctrine**, projected across surfaces — not a new runtime concept. This matches the Chrysalis runtime philosophy Aletheon invokes.

### 0.7 Capture → Qubes (component 9) uses the existing Qube object model + the AR/CPS artifact-production seams — never a parallel creator.

The Qube object model ships: `services/iqube/experienceQube.ts` (per-persona governed container, T1 meta / T0 blak slices), `services/iqube/intentQube.ts` (bounded task scope), plus CapabilityQube in `types/constitutional.ts`. ResearchQube ties to the research object model built this session — `research_objects`, `services/research/*`, `/api/research/*` (CFS-019). CLAUDE.md's "Artifact Production — AR/CPS + Observer Awareness" rule is emphatic: **produce through the Artifact Runtime / CPS seams, never a parallel production path** (the CS-001 duplicate-capability / stale-handoff defect class). **Component 9 (Universal Capture)** therefore routes every capture (page / selection / screenshot / PDF / conversation / email / GitHub issue → ExperienceQube / ResearchQube / CapabilityQube / Contact / Intent / Task / Venture Item) **through those existing creators and seams** — the capture *triggers* (from a browser surface) are new; the Qube constructors are not. **EXTENDS.**

### 0.8 Deep links (component 11) already have the canonical helper — `buildCodexUrl`.

CLAUDE.md "Inter-Cartridge Navigation — Identity Propagation" makes `buildCodexUrl()` (`utils/codex-nav.ts`) the canonical helper that carries `personaId` + access flags across cartridge boundaries. **Component 11 (Universal Deep Links — "Open in Founder Office / Registry / Studio / IRL / Wallet / Passport / DevOn / Composer")** = `buildCodexUrl` invoked from the browser overlay to open a metaMe object with identity propagated. **EXTENDS** — do not invent a second link builder; cite the helper and the identity-propagation rule.

### 0.9 Progressive consent = minimum-disclosure + the T0/T1/T2 tier law. This is not new policy — it is existing constitutional law applied to the most sensitive surface yet.

CLAUDE.md's "Identifier exposure tiers" table (T0 server-internal / T1 browser-safe / T2 public-network), its "Five fields that MUST NEVER appear in browser-bound JSON or chain-bound receipts" rule, the minimum-disclosure / zero-knowledge iQube discipline, and the "observed, never asserted" pattern are the exact constitutional mechanism behind Aletheon's progressive/consent-based permissions. The Observer's browser data is the MOST sensitive surface in this design; §4 makes it emphatic — per-capability grants (identity-only / current-tab / selection / downloads / clipboard / notifications / optional history), each enabled explicitly and revocable, NOT blanket install permissions; T0 never leaves the wallet; no browsing data transmitted without an explicit grant.

### 0.10 Numbering + governance — no collision, no new charter.

`find codexes/packs -iname "PRD-*"` returns `PRD-THR-001`, `PRD-MPY-001`, `PRD-EPI-001`, `PRD-ICA-001`, `PRD-PAG-001` in the IRL foundation; repo-wide the tracker also references `PRD-CCR/CFO/IPE/IRE/KRE-001` (bound to `CFS-037`–`041`). **`PRD-MMC-001` (metaMe Companion) is unused** — assigned here. No new IRL governance charter is required: `IRL-016` governs *experiment* lifecycle/freeze and does not apply — this is product/runtime architecture, not an experiment. Constitutional parents: PRD-PAG-001, the Identity & Access Spine, PRD-THR-001, CFS-022/CFS-024/CFS-025/CFS-037. Ratification is by operator direction under the same regime as those. Registered in `codexes/packs/irl/collections.json` `col_foundation`, mirroring how PAG-001 was added.

---

## 1. Objective & thesis

**The real product is a Constitutional Companion.** The Passport is the trust anchor; the Wallet is the secure execution environment; the Companion is the constitutional layer that **overlays the existing web** so a person's Passport, Wallet, Personas, Agents, and Constitutional Intelligence are always available wherever they are online. It is **not a replacement browser** (not Arc, not Brave) — it does not ask the user to leave the web they already use. It lets the user **"enter the constitutional internet in parallel to the regular internet"** — a split-screen / sidebar experience, an "Ask metaMe" that is Passport-, persona-, standing-, venture-, and agent-aware, unlike "Ask Claude / Ask ChatGPT".

Operator framing (verbatim, retained): the operator was thinking of a browser plugin because *"you should be able to access your Polity Passport and the metaMe ecosystem from within any application, within any browser"*; the proper integration is *"via MCP or the A2A API"* but they also want a surface that can *"pick up on what you're doing in a browser, observe your browser activity through your Passport/plugin."* They name **the embedded wallet and the embedded copilot as "the most portable primitives that can follow a user anywhere."**

**The thesis: "metaMe comes with me."** Not "how do I get into metaMe" — metaMe is wherever the user already is.

---

## 2. The runtime-first architecture — one Companion runtime, many presentation surfaces

The load-bearing architectural decision (Aletheon's, retained and made the spine of this PRD): the browser extension, mobile app, desktop app, embedded application widget, VS-Code surface, and MCP-in-agentic-hosts are **all different presentation surfaces over the SAME Companion runtime**, which is itself an instance of the already-chartered **AgentiQ Runtime** (§0.6). Whether the user is in Chrome, Safari, VS Code, Claude, ChatGPT, or a native app, they interact with the same constitutional companion carrying the same Passport / personas / agents / context.

```
      Chrome · Safari · VS Code · Claude · ChatGPT · native app · embedded widget
   (regular-web surfaces reach the runtime via the Companion extension/sidebar/overlay;
    agentic hosts reach the SAME runtime via MCP/Threshold — §0.5)
                                   │
                                   ▼
        ┌──────────────────────────────────────────────────────────────┐
        │                    metaMe COMPANION RUNTIME                    │
        │            (an instance of the AgentiQ Runtime — CFS-022)      │
        │                                                                │
        │   Embedded Wallet · Passport · SmartTriad copilot · Observer   │
        │   Persona selector · Agent surface · Context Engine · Capture  │
        │   SessionQube (PAG-001, + browser-context fields) · Timeline   │
        │   Universal Search · Deep Links · Notifications · Overlay      │
        └──────────────────────────────────────────────────────────────┘
                                   │
              authentication + session substrate (NOT rebuilt here)
                                   ▼
        ┌──────────────────────────────────────────────────────────────┐
        │   POLITY ACCESS GATEWAY (PRD-PAG-001) — one Constitutional     │
        │   Handshake, human-OIDC + agent-MCP + Companion surfaces,      │
        │   one session substrate (agent_gateway_sessions, T2-only)      │
        └──────────────────────────────────────────────────────────────┘
                                   │  getActivePersona / evaluateAccess (spine — unchanged)
                                   ▼
          Registry · Founder Office · IRL · Studio · AutoDrive · Wallet · Passport
```

**Presentation surfaces are thin; the runtime is the product.** A surface renders and captures input; it never re-implements identity resolution, grounding, the copilot, the wallet, the R/T primitive, or the session. If two surfaces resolve two different personas or run two different copilots, that is the exact inconsistency the spine and this runtime exist to abolish (CLAUDE.md identity-spine "one transport, one resolved persona" discipline).

---

## 3. The 15 components — reconciled and tagged

Legend: **EXISTS** (cite the file — reuse, do not rebuild) · **EXTENDS** (an existing system gains a new surface/input) · **NEW** (genuinely net-new; flagged for scrutiny).

| # | Component | Status | Anchor / what it composes | The delta the Companion adds |
|---|---|---|---|---|
| 1 | Embedded Smart Wallet always-available | **EXISTS** | `SmartWalletDrawer variant="embedded"` in `CodexCopilotLayer` (CLAUDE.md wallet-over-cartridge pattern); PAG-001 §3 "wallet form 1" | Extract the embedded pattern onto arbitrary web surfaces (§0.3) |
| 2 | Constitutional Copilot sidebar ("Ask metaMe") | **EXTENDS** | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` + `CodexCopilotLayer` | A global sidebar surface; copilot + R/T primitive reused line-for-line (§0.2) |
| 3 | **Constitutional Observer** (browser context, with consent) | **EXTENDS pattern; observation SOURCE is NEW** | Observer-awareness pattern (`/api/research/overview` + `IRLResearchCopilotTab`, "observed, never asserted"); SmartTriad in-app suggestion behaviour | The browser-context observation source — **highest risk; §4** |
| 4 | Universal SmartTriad (over browser context) | **EXTENDS** | SmartTriad (`SmartTriadInferenceRenderer`, `primitiveRegistry`) | Project existing SmartTriad over current browser context (§0.2) |
| 5 | Universal Authentication ("Continue with Polity Passport") | **EXISTS / PAG-001** | PRD-PAG-001 §1–§2 (Access Gateway) | Companion is a third surface over the Access Gateway (§0.1); not redefined here |
| 6 | Persona switching always available | **EXISTS / PAG-001** | Persona selection in Smart Wallet (PAG-001 §3); `aa-persona-change-v1` postMessage | Surfaced globally; not rebuilt (§0.1) |
| 7 | Agent surface (agents / delegations / tasks / notifications) | **EXTENDS** | `services/constitutional/constitutionalAgreement.ts` (bounded delegation), Threshold agent model, `types/orchestration.ts` | A browser surface to view/launch/approve/review; delegation engine unchanged |
| 8 | Universal Search (Passport / Founder Office / Registry / IRL / Workspace / AutoDrive / Capabilities / Research / Projects / Agents) | **EXTENDS + NEW index** | Existing per-surface reads (research overview, registry, capability graph) | A federated cross-surface search façade — the unifying index is new; the reads it federates exist |
| 9 | Universal Capture (page/selection/screenshot/PDF/conversation/email/issue → Qube/Contact/Intent/Task/Venture Item) | **EXTENDS** | `services/iqube/{experienceQube,intentQube}.ts`, CapabilityQube, `services/research/*` (ResearchQube), AR/CPS seams (CLAUDE.md) | Capture triggers from a browser surface; routes through existing Qube creators, never a parallel path (§0.7) |
| 10 | **Constitutional Overlay** (apps become constitutional overlays — GitHub → repo Standing/capabilities/contributors/research/IRL refs; Banking → QriptoCENT/Wallet/Passport/Risk/Delegations) | **NEW (composes existing reads)** | Composes registry / standing / capability-graph / IRL reads over an observed app context | Genuinely new surface behaviour; composes existing reads — never re-derives standing/capability |
| 11 | Universal Deep Links ("Open in Founder Office / Registry / Studio / IRL / Wallet / Passport / DevOn / Composer") | **EXTENDS** | `buildCodexUrl()` in `utils/codex-nav.ts` (CLAUDE.md Inter-Cartridge Navigation) | Invoke the canonical helper from the browser overlay with identity propagated (§0.8) |
| 12 | Universal Notifications (constitutional, not browser — passport expiring / agent awaiting approval / standing increased) | **EXTENDS + NEW delivery** | Constitutional events (delegation approvals, standing, passport status) already modelled | Constitutional-notification delivery on a browser surface is new; the events exist |
| 13 | **Constitutional Session = SessionQube** | **EXTENDS PAG-001** | PAG-001 §4 SessionQube (promotes CFS-024 Session level; composes `personaSessionToken` + `agent_gateway_sessions` + `resolveConstitutionalContext().session`) | Adds browser-context fields (applications visited, captured evidence, generated work); NOT a second SessionQube (§0.1) |
| 14 | Constitutional Timeline (every action receipted / replayable / auditable / searchable) | **EXTENDS** | Unified receipt writer + DVN pipeline (PARAMOUNT — receipt *type* only, never a mechanism change) | A timeline surface over existing receipts; **do NOT modify the DVN pipeline** (CLAUDE.md) |
| 15 | **Constitutional Context Engine** (Observer Context → Intent → Activity → Capabilities → Invariants → ground truth) | **EXTENDS the IRE** | `services/invariants/resolution.ts` (CFS-037/PRD-IRE-001) — "resolution precedes reasoning"; observer-awareness pattern | Browser context is a new *input source* feeding the SAME resolution/grounding path — "exactly like your IRE, browser-wide" (§0.4) |

**Genuinely new in this PRD (the honest short list):** the browser-context **observation source** (component 3, highest risk); the **cross-surface search index** (8); the **Constitutional Overlay** behaviour (10); browser-surface **notification delivery** (12); SessionQube's **browser-context fields** (13, additive to PAG-001); the **timeline surface** (14, receipts unchanged); and the **Companion runtime shell + its presentation surfaces** (the extension / sidebar / overlay / PWA / desktop / widget). Everything else is a surface projection of a shipped primitive.

---

## 4. Constitutional guardrails — the Observer is the crux

The Observer (components 3, 15) reads the user's live browser context. It is the most privacy-sensitive surface metaMe has ever contemplated, and the PRD is emphatic about it. **Observation is consent-gated and revocable by construction, never surveillance.**

### 4.1 Progressive, per-capability consent — never blanket install permissions

Permissions are granted **per capability, explicitly, and revocably** — mirroring the T0/T1/T2 tier law and minimum-disclosure discipline (§0.9). The install grants **nothing** beyond identity-only; every observation capability is a separate opt-in with a visible, one-click revocation in the wallet:

| Capability grant | Default | What it permits | Revocable |
|---|---|---|---|
| identity-only | ON at install | "Continue with Polity Passport", persona display — no page reading | n/a (baseline) |
| current-tab | OFF | Observe the active tab's domain/URL/title only | ✅ per-site + global |
| selection | OFF | Read the user's explicit text selection | ✅ |
| page-document | OFF | Read the current page/document body for capture/help | ✅ per-site |
| downloads | OFF | Access a file the user is downloading (e.g. a PDF to capture) | ✅ |
| clipboard | OFF | Read/write clipboard on explicit action | ✅ |
| notifications | OFF | Deliver constitutional notifications | ✅ |
| history (optional) | OFF | Observe navigation history for continuity | ✅ — most sensitive; strongest warning |

### 4.2 The observation itself — "observed, never asserted", and the data stays in the wallet

- **Observed, never asserted** (CLAUDE.md AR/CPS rule): the Observer folds browser context into the runtime's ground/observation context; it never *asserts* state it hasn't observed, and it never acts without the human. Its suggestions ("Import this FATF guidance into IRL? Extract invariants? Compare against Basel? Generate a ResearchQube?") are **offers**, gated on an explicit human click — exactly like SmartTriad in-app today, projected globally.
- **T0 never leaves the wallet.** The five-forbidden-fields rule (`personaId`, `authProfileId`, `rootDid`, `kybeAttestation`, cross-persona `fioHandle`) is absolute on every Companion surface. Observed browsing data is **processed against the Context Engine locally / within the sovereign wallet surface**; **no browsing data is transmitted off-device without an explicit per-capability grant**, and even then only the minimum-disclosure projection needed for the offered action.
- **Minimum-disclosure to observed sites.** Any claim the Companion presents *to* an observed third-party site is a T1/T2 claim only (a pairwise `sub` per PAG-001 §0.2, `displayLabel`, a passport-status commitment) — never the raw Passport record, never a T0 id. The Observer reading a site and the Companion presenting to a site are **different acts** and neither leaks T0.

### 4.3 Principal–Delegate Separation carries to every Companion surface (CFS-043 §2)

**Only the human authenticates, authorizes, selects the persona, and approves delegation. No agent-authenticate / agent-authorize path exists or will be created.** The Companion surfaces an agent's tasks/delegations for the human to launch/approve/review (component 7) — the agent never approves its own delegation, never authenticates, never switches persona. This mirrors PAG-001 §6.1 and PRD-THR-001 §5.2; the Companion adds surfaces, never a new authority path.

### 4.4 The spine is the one resolver; protected files untouched

Every access decision on any Companion surface flows through `getActivePersona` / `evaluateAccess` (CLAUDE.md "Don't rebuild these"). No parallel resolver, no parallel gate. The protected spine files (`getActivePersona.ts`, `personaSessionToken.ts`, `evaluateAccess.ts`, `policyResolvers.ts`, `getContentDescriptor.ts`, `encryption.ts`, `stateCDelivery.ts`, `types/access.ts`) and the DVN pipeline files (`activityReceiptDvnPipeline.ts`, `icAgent.ts`, `cross_chain_service.ts`) are **extend-by-composition only**. The Timeline (14) and SessionQube receipt (13) add a *receipt type*, never a change to the DVN submission mechanism. Any spine-touching implementation is gated on `scripts/verify-spine.mjs` + `tests/persona-spine-fetch.test.ts` / `tests/access-spine.test.ts`.

---

## 5. What already exists (reuse — do NOT rebuild)

| Capability | Anchor | Reuse implication |
|---|---|---|
| Authentication + session substrate ("Continue with Polity Passport", SessionQube) | **PRD-PAG-001** (Access Gateway) over `services/threshold/*`, `agent_gateway_sessions` | Defer to PAG-001; the Companion is a surface over it — do not build auth |
| Agent-side MCP surface (agentic-host presentation) | `services/threshold/gateway.ts`, PRD-THR-001 | The Claude/ChatGPT/VS-Code surface already exists; the Companion adds the regular-web surface |
| Embedded Smart Wallet (form 1) | `app/components/content/SmartWalletDrawer.tsx` (`variant="embedded"` in `CodexCopilotLayer`) | Extract onto web surfaces; do not re-derive the mount recipe |
| Constitutional copilot + inference rendering + R/T primitive | `components/smarttriad/copilot/{SmartTriadCopilotLayer,SmartTriadInferenceRenderer}.tsx`, `services/smarttriad/primitiveRegistry.ts` | Reuse line-for-line; global sidebar is a surface, not a fork |
| Observer-awareness pattern ("observed, never asserted") | `/api/research/overview`, `components/composer/IRLResearchCopilotTab.tsx` (CLAUDE.md AR/CPS) | The Observer extends this pattern to a browser source |
| Invariant Resolution Engine (grounding) | `services/invariants/resolution.ts` (CFS-037/PRD-IRE-001) | Context Engine feeds the SAME resolution path; do not build a second grounding engine |
| Qube object model + artifact-production seams | `services/iqube/{experienceQube,intentQube}.ts`, CapabilityQube, `services/research/*`, AR/CPS seams | Universal Capture routes through these; never a parallel creator |
| Persona reference model + pairwise `sub` | `services/identity/personaReferences.ts` (`personaPublicRef`, `derivePairwiseRef`) (via PAG-001) | Claims to observed sites use these; do not re-derive |
| Inter-cartridge deep-link helper | `utils/codex-nav.ts` `buildCodexUrl()` (CLAUDE.md Inter-Cartridge Navigation) | Universal Deep Links invoke this with identity propagated |
| Bounded delegation authority + gate | `services/constitutional/constitutionalAgreement.ts` | Agent surface views/launches/approves; delegation engine unchanged |
| AgentiQ Runtime doctrine | `CFS-022` (workstream row), `CFS-025` (Artifact Runtime), `CFS-006` (Adaptive Runtime), `types/orchestration.ts` | The Companion runtime is an instance of this; not a new runtime concept |
| Identity hierarchy incl. Session level | `CFS-024`, `services/identity/constitutionalContext.ts` (`resolveConstitutionalContext`) | SessionQube (via PAG-001) promotes the Session level; compose, do not fork |
| Access decision gate / persona resolution (PROTECTED) | `services/access/evaluateAccess.ts`, `services/identity/getActivePersona.ts` | One resolver; every Companion surface flows through it |
| Unified receipts + DVN pipeline (PROTECTED) | receipt writer + `services/dvn/activityReceiptDvnPipeline.ts` | Timeline/SessionQube add a receipt *type* only; never a mechanism change |

---

## 6. Phased rollout

Docs-first; each phase is chartered separately after ratification. Net-new is narrower than the draft implies because most primitives ship.

- **Phase 0 — Companion runtime shell + auth surface.** Stand up the Companion runtime as a thin presentation shell over the **PAG-001 Access Gateway session substrate** and the existing spine. First surface: the **embedded wallet + copilot sidebar** (components 1, 2) extracted from `CodexCopilotLayer`. "Continue with Polity Passport" (5) and persona switching (6) are PAG-001 deliverables surfaced here. **No observation yet** — identity-only.
- **Phase 1 — Universal SmartTriad + Deep Links + Capture, WITHOUT browser observation.** Project SmartTriad (4) into the sidebar; wire Universal Deep Links (11) via `buildCodexUrl`; wire Universal Capture (9) from an explicit user action (paste / upload / "capture this selection" — user-initiated, no passive observation) through existing Qube creators. Timeline (14) as a read over existing receipts.
- **Phase 2 — The Constitutional Observer + Context Engine (consent-gated).** The highest-risk phase — do not start before §4 is ratified. Introduce the per-capability consent model (§4.1), the browser-context observation source feeding the IRE (15), and the Observer's offers (3). Ships with revocation UI, local/wallet-side processing, and the T0-never-leaves guarantee as *acceptance criteria*, not aspirations.
- **Phase 3 — Constitutional Overlay + Universal Search + Notifications.** App-specific overlays (10) composing existing standing/capability/registry reads; the federated cross-surface search index (8); browser-surface constitutional notifications (12).
- **Phase 4 — Additional presentation surfaces.** Mobile app, desktop app, VS-Code surface, embedded application widget — each a thin surface over the same runtime, no runtime duplication.

---

## 7. Out of scope / non-goals

- **Does NOT replace the browser.** The Companion overlays the existing web; it is not Arc/Brave and never asks the user to switch browsers (§1).
- **Does NOT rebuild authentication, persona selection, or the SessionQube** — those are PRD-PAG-001; the Companion is a surface over them and adds only browser-context session fields (§0.1).
- **Does NOT build a second copilot, a second SmartTriad, or a second R/T primitive** — it reuses the shipped ones line-for-line (§0.2).
- **Does NOT build a second grounding engine** — the Context Engine feeds the existing IRE (§0.4).
- **Does NOT build a parallel capture/creator path** — capture routes through the existing Qube constructors + AR/CPS seams (§0.7).
- **Does NOT modify the identity/access spine or the DVN pipeline** — extension by composition only; Timeline/SessionQube add a receipt *type* (§4.4).
- **Does NOT observe anything without an explicit per-capability grant** — install is identity-only; every observation capability is a separate, revocable opt-in (§4.1).
- **Does NOT transmit browsing data off-device without an explicit grant**, and never emits a T0 identifier to any observed site or receipt (§4.2).
- **Does NOT create any agent-authenticate / agent-authorize path** — Principal–Delegate Separation is absolute on every surface (§4.3).
- **Does NOT make the browser extension the canonical identity store or required for metaMe login** — it is one surface among several over the runtime (§2; PAG-001 §3 form 3).
- **No new IRL governance charter** — product/runtime architecture, not an experiment (§0.10).

---

## 8. Ratification record

- [x] Operator ratifies **PRD-MMC-001** as DESIGN (docs-first) — the metaMe Companion is the product umbrella; **"Operation Passport" is reframed as the Companion**, with **PRD-PAG-001 as its authentication + session layer** (§0.1). — **RATIFIED 2026-07-22 (operator)**
- [x] Operator confirms the **runtime-first architecture** — one Companion runtime (an instance of the AgentiQ Runtime, CFS-022), many thin presentation surfaces (extension / sidebar / overlay / PWA / desktop / VS Code / MCP-in-agentic-hosts / widget) (§2, §0.5, §0.6). — **RATIFIED 2026-07-23 (operator)**.
- [x] Operator confirms the **exists/extends/new tagging** of all 15 components (§3) — most are surface projections of shipped primitives; the honest new list is short (the observation source, the search index, the Constitutional Overlay behavior, notification delivery, SessionQube's browser-context fields, the Timeline surface, and the runtime shell + surfaces themselves). — **RATIFIED 2026-07-23 (operator)**. Confirmed in this review: no second wallet or copilot — Component 1 reuses `SmartWalletDrawer variant="embedded"` verbatim; Component 2 reuses `SmartTriadCopilotLayer.tsx` (including `renderDots` line-for-line) verbatim, with only the host surface and a new browser-context grounding input as the delta.
- [x] Operator confirms **SessionQube stays single** — the Companion adds browser-context fields to PAG-001's SessionQube; it does NOT define a second one (§0.1, component 13). — **RATIFIED 2026-07-23 (operator)**.
- [x] Operator ratifies the **Observer guardrails** (§4) — progressive per-capability consent (§4.1's capability-grant table), revocation, "observed never asserted" (§4.2), T0-never-leaves-the-wallet and no off-device browsing data without an explicit per-capability grant (§4.2), Principal–Delegate Separation on every Companion surface (§4.3), and the spine-as-sole-resolver / protected-files-untouched constraint (§4.4) — **RATIFIED 2026-07-22 (operator, explicit review of §4 in full)**. This is the gate §6's phased rollout names as the precondition for Phase 2 (real browser observation) — that gate is now clear.
- [x] Operator confirms **Principal–Delegate Separation** carries to every Companion surface — no agent-authenticate path ever (§4.3). — covered by the §4 ratification above (explicit subsection of §4).
- [x] Operator confirms **no protected spine / DVN file is modified** and any future implementation is gated on `scripts/verify-spine.mjs` + spine canaries (§4.4). — covered by the §4 ratification above (explicit subsection of §4).
- [x] Operator confirms the **phased rollout** defers all browser observation to Phase 2, gated on §4 ratification (§6). — the named gate condition (§4 ratified) is now met.
- [ ] On ratification, a separate **authorized implementation pass** is chartered (not this PRD) — spine-touching and Observer work under operator approval only.

---

*Authored docs-only, 2026-07-22. Reconciled against `PRD-PAG-001`, `PRD-THR-001`, `CFS-022`, `CFS-024`, `CFS-025`, `CFS-037`/`services/invariants/resolution.ts`, `components/smarttriad/copilot/*`, `services/smarttriad/primitiveRegistry.ts`, `app/components/content/SmartWalletDrawer.tsx`, `app/components/codex/CodexCopilotLayer.tsx`, `services/threshold/gateway.ts`, `services/iqube/{experienceQube,intentQube}.ts`, `services/research/*` + `/api/research/overview` + `components/composer/IRLResearchCopilotTab.tsx`, `utils/codex-nav.ts`, `services/constitutional/constitutionalAgreement.ts`, and the Identity & Access Spine / Wallet-Over-Cartridge / Artifact-Production-Observer-Awareness / metaMe-Client-Protocol-Primitive / Inter-Cartridge-Navigation sections of `CLAUDE.md`. Builds nothing; proposes an architecture for operator ratification.*
