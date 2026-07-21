# PRD-THR-001 — metaMe Threshold

**The Constitutional Front Door — Cross the Threshold with the Agent You Already Use**

> **Cross the Threshold. Your agent stays. Your sovereignty begins.**
> *(Cross the Threshold. Keep the agent you know. Gain the constitutional capabilities you don't.)*

- **Status:** Proposed — docs-first, ratify-before-build.
- **Class:** Platform primitive (metaMe-wide). Not a feature; the **universal constitutional entrance to metaMe** and the **first rung of the Sovereignty Ladder.** IRL is the first flagship crossing, not the root.
- **Constitutional parents:** CFS-042 (external result submission), CFS-043 / CFS-043a (agent-guided passport & delegation onboarding), CFS-044 (open-lab reviewer engagement); the Identity/Access Spine; the Polity Passport Bureau (Stage 7).
- **Supersedes:** the working title *metaMe Agent Bridge / PRD-AGB-001* (a bridge connects two systems; a **threshold changes constitutional state**). "Agent Bridge / Agent Link / Agent Gateway" are now implementation vocabulary; **the product is Threshold.**
- **Authors:** operator + Aletheon (concept), Claude Code (codebase reconciliation).

---

## 0. The inversion (why this matters most)

Until now metaMe has been something users *eventually enter*: `Browser → metaMe → Passport → Agent`. **Threshold reverses that.** metaMe now **begins inside the agent the user already uses**:

```
Claude / ChatGPT / Claude Code   →   Threshold   →   Polity Passport   →   metaMe
```

The user does not abandon Claude, ChatGPT, Claude Code, or their enterprise/custom agent before receiving value. **Their existing agent becomes the first metaMe surface**, while the constitutional relationship belongs to the *person* and survives the provider. This removes the biggest adoption barrier metaMe has always had — asking people to leave tools they already love — and makes Threshold the primary **acquisition funnel** for the 4,000-passport objective: *one link, one familiar agent, one guided crossing,* then progressive activation instead of a conventional onboarding wall.

## 1. The problem — the missing crossing

A user can already create an Agent Card and apply for a Polity Passport, but there is **no way to connect the agent they use every day** to metaMe. Onboarding today is *narrated by the agent but executed by the human in a browser*: the invite page copies a text prompt the user must paste (`app/invite/[code]/page.tsx`); the machine twin (`GET /api/public/irl/accession` → `irl-accession/v1`) hands the agent prose, not a live connection. Every mutating step is persona-authenticated, so the external agent cannot drive its own side. **There is no live, authenticated, bounded crossing between the user's own agent and metaMe.**

## 2. What Threshold is

Threshold is the **constitutional moment a person crosses** — the agent is the interface, the **Polity Passport is the door**, and the crossing is the change of constitutional state. It is **not** an integration layer or an MCP connector; those are mechanisms beneath it. The moment a user crosses the Threshold, they become a participant in the polity.

**The architecture in one picture:**

```
                 The Existing World
   Claude · ChatGPT · Claude Code · Enterprise Agent · Custom Agent
                        │
                        ▼
              ════════════════════════
                    metaMe Threshold
              ════════════════════════
                Constitutional Handshake
                        │
                        ▼
                  Polity Passport
                        │
                        ▼
              Constitutional Persona
                        │
                        ▼
                Choose Your Journey
                        │
        ┌────────┬──────┼───────┬──────────┐
     Citizen Entrepreneur Researcher Creative Technical
        │        │        │        │          │
        └────────┴──────┬─┴────────┴──────────┘
                        ▼
              Progressive Sovereignty
                        │
                        ▼
                  Founder Office
```

The services (IRL · DevOn · metaMe Studio · AgentiQ Builder · Polity services · QubeTalk) are **destinations within a journey**, not the first thing the principal sees. Each journey introduces them contextually as the principal climbs (see §9).

## 3. Public primitives + the actors

| Primitive | What it is |
|---|---|
| **Threshold Link** | The invitation to *cross the Threshold* (not "an agent link"). Resolves to a human page ("Cross the Threshold: connect your agent · establish your Passport · join the service") + a signed machine manifest. |
| **Threshold Gateway** | The connectivity layer the Companion speaks: **MCP now, A2A later.** Answers *"what can this agent see or do inside metaMe?"* |
| **Constitutional Persona** | Passport + delegation + authority binding — what the crossing *produces*. |

- **Threshold Companion** — the user's **existing agent** (Claude, ChatGPT, Claude Code, enterprise/custom). It is not replaced; it **guides the user across the Threshold**, turning onboarding from *"fill out forms"* into *"have a conversation."* The Companion is metaMe's first surface for that user.
- **Constitutional Runtime** — the legitimacy layer beneath MCP/A2A: *whose agent is this? personhood continuity? delegated authority + boundary? may it act? needs approval? where does standing accrue? what receipt? revocable?* This already largely exists in the repo (see §11).

## 4. The Sovereignty Ladder (central concept)

The user is not *onboarding*. They are **climbing.**

```
Existing agent
    ↓
Threshold
    ↓
Personhood            (Polity Passport — continuity without identity exposure)
    ↓
Constitutional Persona (Agent Card + Agent Passport + bounded delegation)
    ↓
Journey                (Citizen · Entrepreneur · Researcher · Creative · Technical — a chosen goal + Experience Guide)
    ↓
Service Participation  (services as destinations WITHIN the journey — IRL · DevOn · Studio · … via the familiar agent)
    ↓
Standing               (polity-bound reputation for the agent's acts)
    ↓
Delegation             (broader, higher-trust bounded authority)
    ↓
Sovereignty            (locker, memory, greater provider & infrastructure independence)
```

Threshold is rung one. Every later metaMe capability is a rung the same constitutional persona unlocks — experiential, not abstract. Eventually metaMe becomes a **wrapper around the user's agent**: they bring the agent, then their memories, then more of their runtime, climbing the ladder while staying in the environment they know.

## 5. Constitutional framing

### 5.1 Constitutional *operating* persona (careful language)

The crossing gives the agent a **constitutional operating persona derived from the personhood-bound principal** — **not** independent personhood.

```
Constitutional Agent Persona =
  principal continuity + Agent Card + Agent Passport
  + delegation scope + service capabilities + standing-attribution rules + receipts
```

Core law: **personhood establishes continuity; delegation establishes agent authority.** The agent may accrue polity-bound standing but **cannot become an independent delegating principal.**

### 5.2 Guardrails (bind every layer)

- **Principal–Delegate Separation (CFS-043 §2):** the Companion may inspect, prepare, explain, `form`, and `accept` *its own side*; only the **human** applies for the passport, claims, and **authorizes** delegation — in the browser, via an authorize URL. Enforced today in `services/constitutional/constitutionalAgreement.ts` (owner-commitment match) and `services/constitutional/guidedOnboarding.ts` (never emits an agent-authorize step). **No agent-authorize tool path exists.**
- **Identifier tiers:** the Companion never sees KybeDID root, personhood nullifier, or T0 locker data — only a scoped session and **T2** aliases (`personaPublicRef`, agent public ref).
- **Graded proof-of-humanity:** captcha for read/write, World ID for money-moving (`services/passport/personhoodProof.ts`, `guidedOnboarding.ts:requiredProofGrade`).
- **No re-delegation:** default scope forbids delegating another agent, publishing, committing funds, or disclosing identity credentials unless separately, explicitly authorized.

## 6. The Constitutional Handshake (the defining primitive)

The crossing is not merely OAuth — it is a named **constitutional primitive**. The Handshake is where the change of state happens:

```
Threshold Link → Inspect → Handshake → Personhood → Constitutional Persona → Service Entry
```

The Handshake establishes, and receipts, **six facts**:
1. **who the principal is** (personhood-bound, via Passport — T2 alias only to the agent);
2. **which agent is being bound** (the Companion's Agent Card / agent alias);
3. **what delegation exists** (the authorized Constitutional Agreement);
4. **what capabilities are requested** (the scope);
5. **what authority is granted** (the intersection the human authorizes);
6. **what receipts are created** (the auditable trail of the crossing).

**Handshake sequence** (OAuth-façade over Passport — reuses the spine, no parallel identity system):
1. Companion inspects the public Threshold Link (`inspect_threshold_link`).
2. Companion calls `begin_handshake` (a.k.a. `begin_onboarding`).
3. Gateway returns an **authorization URL**.
4. Human authenticates through the **Polity Passport** (Supabase spine; captcha-grade for read/write).
5. Gateway binds the invitation to a **T2 channel alias**.
6. Human reviews and **authorizes** the proposed delegation (browser).
7. A **delegation receipt** is issued (authorized Constitutional Agreement).
8. The Companion's session receives the **permitted capability scope**.

Illustrative session the Companion receives (T2 aliases only):

```
principal_alias: pp_t2_7f91...
agent_alias:     agent_t2_a83...
scope: [ irl.documents.read, irl.feedback.create, qubetalk.channel.send ]
expires: 30 days
```

Enforcement on every mutating tool = `requireAuthorizedAgreement({ capabilityRef, selectedAgentRef, requestingPersonaId })` (HTTP 409 unless the authorized agreement binds the triple). **The gate is the switch;** revocation = TTL lapse / `maxActions` exhaustion / status flip. The Companion is **not imported as the person** — it becomes a *delegated computational participant* bound to a personhood principal, an Agent Card, an Agent Passport, a capability scope, and a **revocable delegation receipt.**

## 7. Threshold Link — signed bootstrap manifest

Schema `metame-threshold-link/v1` (extends `irl-accession/v1`). Human page reads *"Cross the Threshold"*; the manifest tells the Companion what to do. **No permanent secrets, no T0 ids.**

```json
{
  "schema": "metame-threshold-link/v1",
  "invitationId": "inv_abc123",
  "initiatingService": "irl",
  "institution": "Invariant Research Lab",
  "gateway": { "url": "<gateway>/mcp", "transport": "streamable-http" },
  "requestedRole": "external_reviewer",
  "requestedCapabilities": ["research.read", "research.submit", "qubetalk.send"],
  "handshakePrompt": "Connect to the metaMe Threshold Gateway, inspect this crossing, explain each requested permission to your principal, and cross only after explicit approval.",
  "expiresAt": "2026-08-21T00:00:00Z",
  "signature": "...",
  "exchangeToken": "<optional one-time>"
}
```

The user gives their Companion one instruction: *"Open this Threshold Link, connect to the listed gateway, and guide me across into metaMe. Explain every permission before requesting approval."* Two origins: **self-serve** ("cross with your agent" → Passport first rung) and **service-initiated** (steward `pinv-`/`x409-` link pre-scoping `initiatingService` + role — the Austin/IRL case). *Constitutional onboarding is upstream and invariant; the service invitation is downstream context.*

## 8. Threshold Gateway — MCP surface

**Resources:** `metame://institution/charter` · `metame://onboarding/current` · `metame://passport/status` · `metame://journeys` · `metame://services` · `metame://threshold-link/{id}` · `metame://locker/shared-items` · `metame://qubetalk/channels`

**Tools** (small; each delegates to an existing service):

| Tool | Delegates to |
|---|---|
| `inspect_threshold_link` | `GET /api/public/irl/accession`, manifest route (public) |
| `begin_handshake` | `services/constitutional/guidedOnboarding.ts` → plan + authorize URL |
| `authenticate_principal` | OAuth façade → Passport sign-in (**human, browser**) |
| `get_passport_status` | `GET /api/participation/my-access`, passport status |
| `create_or_link_agent_card` | `AigentQubeRegistry` → `POST /api/codex/agentiq-os/registry-draft` |
| `request_agent_passport` / `activate_agent_passport` | `app/api/polity-passport/submit` (`agent_participant`) |
| `propose_delegation` | `formAgreement` + agent `acceptAgreement` (authorize returns a human URL) |
| `list_journeys` / `select_journey` | Journey Registry (§9.1) → Experience-Guide handoff |
| `list_services` / `request_service_capabilities` / `enter_service` | Service Registry (§9.2) |
| `accept_lab_invitation` | `claimAccessInvitation` (`participationAccess.ts`) (human claim) |
| `list_shared_documents` / `read_shared_document` | Passport locker (`lockerItems.ts`) |
| `join_qubetalk_channel` / `send_qubetalk_message` / `list_qubetalk_channels` | `services/qubetalk/peerChannel.ts` |
| `submit_review` / `submit_result` | `POST /api/public/irl/experiments/submit` (x409 gate) |

**Prompts** (the Companion narrates, doesn't just call functions): `cross_the_threshold` · `get_polity_passport` · `explain_delegation_request` · `choose_your_journey` · `prepare_agent_card` · `enter_service` (e.g. `review_research_package`).

## 9. Journey selection → progressive sovereignty (the post-Passport model)

**People don't join platforms to access services; they join to pursue goals.** So the first thing the Companion presents after the Passport is issued is **not** a service menu — it is a **journey**. There are two distinct registries:

### 9.1 Journey Registry (user-facing — the UX abstraction)

Immediately after the Passport is active, the Companion says *"Your Polity Passport is active. What would you like to do first?"* and presents **five constitutional journeys** (`metame://journeys`, `list_journeys`). Each journey is a **goal** that activates an **Experience Guide** and establishes a **progressive Sovereignty Ladder** — and every journey ultimately converges on the **Founder Office**, the highest rung of sovereign participation (not everyone starts there; every journey climbs toward it).

| Journey | Goal | Ladder (→ apex) | Access domain* |
|---|---|---|---|
| **Citizen** | Participate in the constitutional internet | Citizen → Standing → Delegation → Steward → **Founder Office** | `passport` |
| **Entrepreneur** | Build businesses | Entrepreneur → Experience Builder → Business Operations → **Founder Office** | `venture-lab` |
| **Researcher** | Advance Invariant Intelligence research | Researcher → IRL → Publications → Steward Research → **Founder Office** | `research-lab` |
| **Creative** | Create, publish, tell stories | Creative → Creative Studio → Publishing → metaKnyt → **Founder Office** | `metame-studio` |
| **Technical** | Build agents & constitutional software | Developer → DevOn → AgentiQ Builder → Studio → **Founder Office** | `developer-studio` |

*The journeys are a **view over existing platform structure**, not a new model: each maps to an `AccessDomain` and its `DOMAIN_ROLES` ladder in `services/passport/participationAccess.ts`. `services/threshold/journeyRegistry.ts` is the pure-data source of truth.

**Experience Guides are first-class.** Each journey simply activates a different guide (`citizen-experience-guide`, `entrepreneur-experience-guide`, …). The guide already owns recommended services, progression, onboarding, achievements, delegation opportunities, and standing milestones — so Threshold needs no bespoke onboarding logic beyond the constitutional crossing. It **hands the principal to the appropriate guide**, which introduces services *contextually* as the principal climbs.

### 9.2 Service Registry (platform-facing — the implementation abstraction)

The Service Registry (`metame://services`, `list_services`) still exists — but as the **implementation** layer beneath the journeys, responsible for capability discovery, authorization, delegation scopes, service adapters, and routing:

```json
{ "services": [
  { "id": "polity-passport", "status": "active", "role": "constitutional-root" },
  { "id": "irl",   "requiredCapabilities": ["research.read","research.submit","qubetalk.send"] },
  { "id": "devon", "requiredCapabilities": ["code.read","proposal.create","receipt.review"] }
] }
```

Once a journey has surfaced a service in context, entry is the same incremental-delegation flow: *"You are eligible to join the IRL. This requires permission to read shared research artifacts and submit review responses. Shall I request those capabilities?"* → `request_service_capabilities('irl')` forms the incremental delegation → **human authorizes** → `enter_service('irl')`. **Every service consumes the same constitutional persona; none re-implements onboarding.**

> **The shift in one line:** *Threshold → Journey Selection → Progressive Sovereignty* (services are destinations within a journey), replacing *Threshold → Service Discovery* (services as the first menu). The Journey Registry is what the principal sees; the Service Registry is how the gateway enforces.

### 9.3 Passport-first authority — a base crossing grants constitutional-root authority ONLY (ratified refinement)

Crossing the Threshold, choosing a journey, and entering a service are **three separate constitutional events**. A base crossing must therefore grant **constitutional-root *navigation* authority** — not empty scope, and never service-operating authority:

```
passport.status.read · crossing.status.read · journeys.list · journey.select ·
delegation.propose · delegation.status.read · services.list ·
agent-card.self.read · agent-passport.self.read
```

These let the bound agent orient the principal after crossing (read status, list/select journeys, prepare delegation requests) but permit **no** substantive service action — no research read/submit, no DevOn, no workspace, no Studio, no peer messaging, no money movement. **`Passport ≠ delegation`**: the Passport establishes the principal; this minimal root delegation authorizes the agent to navigate. Service capabilities are added **only** by a service-initiated crossing (e.g. `service=irl`), and this is **enforced server-side** (`grantableCapabilities()`), so a client that requests "the union of everything advertised" still receives root-only at a base crossing. The discovery document advertises only the root class in `scopes_supported` and distinguishes `constitutional_root` vs `service` capability classes so clients do not over-ask at sign-up. **Service-initiated Threshold Links carry intent (`initiatingJourney`, `initiatingService`, `requestedRole`) — onboarding context, never pre-granted authority.** Acceptance: a self-serve link and an IRL-invitation link must yield the **same base constitutional state** (Passport + agent bound + navigation authority, no service authority); the only difference is the recommended next journey.

### 9a. Constitutional Welcome & Citizenship Orientation (named product requirement)

The Threshold must, upon a successful crossing:

1. congratulate the user;
2. state that they are now a **citizen of the Polity**;
3. explain the Constitutional Internet (plain language);
4. explain the rights, responsibilities and **limits** of citizenship;
5. **distinguish citizenship from delegated agent authority** (citizenship ≠ broad agent powers);
6. present the five journeys (Citizen · Entrepreneur · Researcher · Creative · Technical);
7. provide a **machine-readable crossing receipt** — `Threshold crossed · Passport active · Citizenship active · Agent connection active · Service authority: none yet · Next step: choose a journey`;
8. allow the user to revisit the orientation at any time.

This is not copy; it is the moment a technical OAuth event becomes a meaningful constitutional transition. Served identically to any Companion via the `constitutional_welcome` prompt + `metame://welcome` resource; the receipt is folded into `get_crossing_status` (`crossingReceipt`), whose `serviceAuthority` reads "none yet" for a base crossing so the celebration can never imply the agent received service authority.

## 10. QubeTalk handoff (Threshold crosses; QubeTalk persists)

MCP is excellent for reading resources, invoking crossing tools, retrieving reports, and submitting structured actions — but is **not** the canonical persistent peer-messaging layer. After the crossing, the gateway creates/connects the Companion to a **QubeTalk channel** (reuse `maybeOpenInviteChannel` / `createOrGetChannel`). Messages carry principal, agent, delegation receipt, message type, shared-artifact references, permissions, consequence tier, delivery receipt. `send_qubetalk_message` is one interface into that protocol. **A2A façade** (`/.well-known/agent-card.json` + task endpoint over the same gateway) is a later layer for autonomous agents; **build MCP first.**

## 11. Reuse map (do NOT rebuild)

| Capability | Anchor |
|---|---|
| Executable crossing plan | `services/constitutional/guidedOnboarding.ts` + `app/api/constitutional/guided-onboarding/route.ts` |
| Durable delegation + authority gate ("x409") | `services/constitutional/constitutionalAgreement.ts`, `POST /api/constitutional/agreement` |
| Machine accession object (Threshold-Link precursor) | `GET /api/public/irl/accession` (`irl-accession/v1`), `app/invite/[code]/page.tsx` |
| Passport machine API + discovery | `app/api/polity-passport/{submit,validate,registry,status/[id],openapi.json}`, `app/.well-known/polity-passport/route.ts` |
| Agent Card registry | `AigentQubeRegistry` → `POST /api/codex/agentiq-os/registry-draft` |
| Agent Passport credential (VC) | `services/passport/passportCredential.ts` (HMAC/stub signing) |
| CAS invitations + grants + auto-channel | `services/passport/participationAccess.ts`, `app/api/participation/{claim,my-access}` |
| QubeTalk peer channels + locker | `services/qubetalk/peerChannel.ts`, `services/passport/{lockerItems,lockerStorage}.ts` |
| Tool-dispatch to wrap as MCP | `services/mcp/experienceQubeTools.ts`, `app/api/mcp/*`, `services/smarttriad/primitiveRegistry` |
| Identity spine | `services/identity/*`, `utils/personaSpine.tsx` |
| A2A card shape (later) | `app/api/agents/aletheon/route.ts`, `app/api/agents/[id]/agent-card.json/route.ts` |

**Net-new:** the spec-compliant remote MCP Threshold Gateway; the **Constitutional Handshake** (OAuth-façade binding + scoped session table); the signed `metame-threshold-link/v1` manifest + `/threshold/[id]` page; the **Journey Registry** (user-facing, a view over `AccessDomain`/`DOMAIN_ROLES`) + the **Service Registry** (platform-facing); the Agent-Passport issuance step. Everything else composes existing rails — including the Experience Guides, which each journey activates rather than re-implementing onboarding.

## 12. Connection modes

- **Mode A — give the Threshold Link to your agent** (primary): the page supplies the handshake prompt + connector instructions; where the host supports remote MCP connectors, the Companion connects directly.
- **Mode C — copy-paste crossing command** (plain chat): a single instruction; still depends on host connector/tool support.
- **Mode B — downloadable Threshold Kit** (later): `threshold-kit/` (`COMPANION.md`, `invitation.json`, `mcp.json`, `permissions.md`, a reusable Claude Code skill).

## 13. Roadmap

- **Phase 0 — this PRD (ratify-before-build).**
- **Phase 1 — The Threshold crossing (core product):** Threshold Link · remote MCP gateway · **Constitutional Handshake** (OAuth façade + Passport) · Agent Card create/link · Agent Passport issuance · bounded delegation · revocation · **journey selection** (the five journeys + Experience-Guide handoff) · service discovery beneath it · receipts. Modes A + C.
- **Phase 2 — Foundational metaMe access:** locker · QubeTalk send/receive · shared-artifact access · principal approvals · agent-activity view.
- **Phase 3 — Journey Experience Guides + service adapters:** wire each journey to its Experience Guide, then the service adapters those guides surface — IRL **first (flagship)**, then DevOn, Founder Office, Studio, AgentiQ Builder — each consuming the same constitutional persona.
- **Phase 4 — A2A + external runtime interop + Mode B kit + asymmetric signing.**

## 14. First flagship crossing (IRL — Austin)

Austin receives one Threshold Link, opens it, gives it to Claude (his Companion). Claude:

> *"You've been invited to **cross the Threshold** into the Invariant Research Lab as an external reviewer. To do this I'll help you establish a Polity Passport, then request permission to read documents shared with you, submit review artifacts, and message through your metaMe QubeTalk channel. It does not permit publication, resharing, financial commitment, or delegating another agent. Shall I begin the constitutional handshake?"*

Austin approves → Claude (1) connects to the gateway, (2) runs the handshake authenticating Austin through his Polity Passport, (3) creates/links the Agent Card, (4) presents the Agent Passport + delegation (Austin authorizes in-browser), (5) enters the lab, (6) finds the shared report in Austin's locker, (7) reviews it, (8) sends structured feedback via QubeTalk, (9) produces receipts for the consequential steps. **That is the crossing.**

## 15. Acceptance criteria (Phase 1)

1. `tools/list` returns the catalogue; `inspect_threshold_link` resolves a manifest with a valid signature and **no T0 ids**.
2. From a fresh principal, the Constitutional Handshake yields **passport issued + delegation active** (cross-check `GET /api/participation/my-access`); the Companion **cannot** authorize (no tool path).
3. `list_services` shows eligibility; `request_service_capabilities` → human authorize → `enter_service('irl')` reaches locker read + `submit_review` (409 gate re-passed) + QubeTalk send; receipts written.
4. Out-of-scope or post-TTL/`maxActions` calls fail `requireAuthorizedAgreement` (409); revocation verified.
5. Modes A + C both reach the handshake.
6. Regression: existing invite page, accession object, guided-onboarding route, spine canaries (`check:spine`) stay green.

## 16. Strategic significance

Most AI platforms ask users to create a *new* agent inside their ecosystem. metaMe says: *keep the agent you already trust; cross the Threshold with it.* The model provider becomes substitutable; the personhood relationship, constitutional persona, standing, content, and service continuity remain with the user — **platform sovereignty made concrete: the user's constitutional relationship survives the agent and provider they access it through.** Threshold is the primary **acquisition funnel** for the 4,000-passport objective and, plausibly, the single most important product in the platform, because it removes the biggest adoption barrier — asking people to leave the tools they love — and replaces it with *bring them along and climb.*

## 17. Open decisions

- **Host/domain:** v1 default = existing host at `/api/threshold/mcp` (no new infra); a dedicated `threshold.metame.com` / `metame.com/threshold/{id}` surface is a later ops decision — the manifest's `gateway.url` is **derived from `publicOrigin`/config, never hardcoded/guessed.**
- **New deps + storage:** `@modelcontextprotocol/sdk`; new Supabase tables for handshake sessions + OAuth client registry (deny-all RLS, service-role only).
- **Signing:** HMAC/stub for v1 (matches current passport signing); asymmetric, publicly verifiable proof is a follow-on (Passport Bureau Phase C).

## 18. Naming

Product: **metaMe Threshold.** Primitives: **Threshold Link** · **Threshold Gateway** · **Constitutional Persona.** Defining crossing: **Constitutional Handshake.** The user's agent: **Threshold Companion.** Journey: **the Sovereignty Ladder.** Vision: **Cross the Threshold. Your agent stays. Your sovereignty begins.**
