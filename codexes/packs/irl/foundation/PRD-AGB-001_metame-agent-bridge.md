# PRD-AGB-001 — metaMe Agent Bridge

**Universal Third-Party Agent Onboarding, Constitutional Persona and Service Access**

> *Bring your agent. Establish your personhood. Enter the constitutional internet.*
> *Your agent already works with you. metaMe gives it a constitutional place to operate.*

- **Status:** Proposed — docs-first, ratify-before-build.
- **Class:** Platform-level charter/PRD (metaMe-wide). IRL is the **first flagship acceptance journey**, not the architectural root.
- **Constitutional parents:** CFS-042 (external result submission), CFS-043 / CFS-043a (agent-guided passport & delegation onboarding), CFS-044 (open-lab reviewer engagement). Identity/Access Spine (CLAUDE.md). Polity Passport Bureau (Stage 7).
- **Authors:** operator + Aletheon (design), Claude Code (codebase reconciliation).

---

## 1. Problem — the missing bridge

A user can already create an Agent Card and apply for a Polity Passport, but there is **no way to connect the agent they use every day** — Claude chat, Claude Code, ChatGPT, an OpenAI/enterprise/custom agent, or any other MCP/A2A-compatible system — to metaMe.

Onboarding today is *narrated by the agent but executed by the human in a browser*. The invite page's primary CTA copies a text prompt the user must paste into their agent (`app/invite/[code]/page.tsx`); the machine-readable twin (`GET /api/public/irl/accession` → `irl-accession/v1`) hands the agent a prose workflow, not a live connection. Every mutating step is persona-authenticated, so the external agent cannot drive its own side — a human must be signed in in a browser and perform each step. **There is no live, authenticated, bounded connection between the user's own agent and metaMe.**

## 2. What this is — a constitutional ingress layer (not an IRL connector)

The metaMe Agent Bridge is **not** an IRL connector with a passport step attached. It is a **constitutional ingress layer for any third-party agent**. The invariant first rung is always:

> **Bring the agent you already use → establish personhood → bind the agent constitutionally → enter metaMe.**

Everything else — IRL, DevOn, Founder Office, metaMe Studio, AgentiQ Builder, Polity services, QubeTalk, future programmes — is a **service reached after that**. **Polity Passport is the constitutional front door, not one onboarding component.**

The bridge does **not** replace the user's agent. It provides what the external host cannot inherently provide: a **personhood-bound principal**, **continuity without mandatory identity exposure**, an **Agent Card**, an **Agent Passport**, **bounded delegation**, **standing and authority**, a **sovereign locker**, **QubeTalk exchange**, and **constitutional service access**.

### Strategic significance

Most AI platforms ask users to create a *new* agent inside their ecosystem. metaMe instead says: *keep the agent you already trust; connect it to a constitutional runtime.* This removes a major adoption barrier and positions metaMe as a **substrate**, above individual model/agent vendors:

```
Claude · ChatGPT · Gemini · custom / enterprise agents
                    ↓
             metaMe Agent Bridge
                    ↓
Personhood · Delegation · Standing · Locker · QubeTalk · Constitutional services
```

The model provider becomes substitutable; the personhood relationship, constitutional persona, standing, content, and service continuity remain with the user. This is a concrete realization of **platform sovereignty**: the user's constitutional relationship survives the agent and provider through which they access it.

## 3. Constitutional framing

### 3.1 Constitutional *operating* persona (careful language)

The bridge gives the agent a **constitutional operating persona derived from the personhood-bound principal**. It does **not** grant the agent independent personhood.

```
Constitutional Agent Persona =
    principal continuity
  + Agent Card
  + Agent Passport
  + delegation scope
  + service capabilities
  + standing-attribution rules
  + receipts
```

Core law: **personhood establishes continuity; delegation establishes agent authority.** The agent may accrue polity-bound standing for its actions but **cannot become an independent delegating principal.**

### 3.2 Guardrails (bind every layer)

- **Principal–Delegate Separation (CFS-043 §2):** the agent may inspect, prepare, explain, `form`, and `accept` *its own side*; only the **human** applies for the passport, claims, and **authorizes** delegation — in the browser, via an authorize URL. Enforced today in `services/constitutional/constitutionalAgreement.ts` (owner-commitment match, lines ~457-460) and `services/constitutional/guidedOnboarding.ts` (never emits an agent-authorize step). **No agent-authorize tool path will exist.**
- **Identifier tiers:** the external agent never sees KybeDID root, personhood nullifier, or T0 locker data — only a scoped session and **T2** aliases (`personaPublicRef`, agent public ref).
- **Graded proof-of-humanity:** captcha for read/write scopes, World ID for money-moving (`services/passport/personhoodProof.ts`, `guidedOnboarding.ts:requiredProofGrade`).
- **No re-delegation:** the default scope forbids the agent delegating another agent, publishing, committing funds, or disclosing identity credentials unless separately and explicitly authorized.

### 3.3 The constitutional order

```
Existing user–agent relationship
        ↓
metaMe Agent Link
        ↓
Polity Passport onboarding
        ↓
Personhood-bound principal established
        ↓
External agent linked to that principal
        ↓
Agent Card  →  Agent Passport  →  Bounded delegation
        ↓
Constitutional persona active
        ↓
metaMe service access  (IRL · DevOn · Founder Office · Studio · AgentiQ Builder · Polity · QubeTalk · …)
```

## 4. Architecture — 3 primitives over 4 layers

**Public primitives:** **Agent Link** (bootstrap/invitation) · **Agent Gateway** (MCP now, A2A later) · **Constitutional Persona** (Passport + delegation + authority binding).

**Coordinated layers:**

1. **Agent Link** — the signed bootstrap object. Tells the external agent: where the gateway is, what onboarding is available, which service *initiated* the invitation (downstream context), what permissions may *eventually* be requested, and what must remain subject to principal approval. Works whether the destination is Passport enrolment, IRL, DevOn, or Founder Office. *Constitutional onboarding is upstream and invariant; the service invitation is downstream context.*
2. **MCP bridge** — the primary interface for agents inside conversational hosts. Answers **"what can this external agent see or do inside metaMe?"** Exposes onboarding resources, Passport/Agent-Card/Agent-Passport tools, delegation requests, locker + QubeTalk access, service discovery, capability invocation.
3. **A2A bridge (later)** — for persistent/autonomous agents. Answers **"how does this agent participate operationally with other agents?"** Discovery, task handoff, capability negotiation, asynchronous results.
4. **Constitutional Runtime** — the differentiated legitimacy layer beneath both. Answers: *Whose agent is this? Personhood continuity? Delegated authority + boundary? May the agent perform this act? Does it need approval? Where does standing accrue? What receipt is issued? Can delegation be revoked?* **MCP/A2A provide connectivity; the Constitutional Runtime provides legitimacy** — and it already largely exists in this repo (see §9).

```
Claude / ChatGPT / Claude Code / custom agent
        ↓                     ↑
       MCP                   A2A            (connectivity)
        ↓                     ↑
            metaMe Agent Gateway
        ↓
   Passport + Delegation (Constitutional Runtime — legitimacy)
        ↓
       QubeTalk exchange
```

## 5. Agent Link — signed bootstrap manifest

An Agent Link resolves to **both** a human-readable page (explains what is happening) and a machine-readable manifest (tells the agent what to do). Schema `metame-agent-link/v1` (extends `irl-accession/v1`):

```json
{
  "schema": "metame-agent-link/v1",
  "invitationId": "inv_abc123",
  "initiatingService": "irl",
  "institution": "Invariant Research Lab",
  "mcpServer": { "url": "<gateway>/mcp", "transport": "streamable-http" },
  "requestedRole": "external_reviewer",
  "requestedCapabilities": ["research.read", "research.submit", "qubetalk.send"],
  "onboardingPrompt": "Connect to the metaMe MCP server, inspect this invitation, explain each requested permission to your operator, and proceed only after explicit approval.",
  "expiresAt": "2026-08-21T00:00:00Z",
  "signature": "...",
  "exchangeToken": "<optional one-time>"
}
```

The manifest carries **no permanent secrets and no T0 identifiers** — only invitation identity, MCP endpoint, requested role, requested capability scope, expiry, signature, and an optional one-time exchange token. Two origins: **self-serve** ("join metaMe with your agent" → Passport first rung) and **service-initiated** (a steward `pinv-`/`x409-` link that pre-scopes `initiatingService` + role — the Austin/IRL case). A generic link works for any destination; the service invitation is downstream context, the constitutional onboarding upstream and invariant.

The user gives their agent a single instruction:

> *"Open this Agent Link, connect to the listed MCP server, and guide me through joining metaMe. Explain every permission before requesting approval."*

## 6. MCP surface

**Resources** (read-only context so the agent can explain before acting):
`metame://institution/charter` · `metame://onboarding/current` · `metame://passport/status` · `metame://services` · `metame://agent-link/{id}` · `metame://locker/shared-items` · `metame://qubetalk/channels`

**Tools** — deliberately small; each delegates to an existing service:

| Tool | Delegates to | Notes |
|---|---|---|
| `inspect_agent_link` / `inspect_invitation` | `GET /api/public/irl/accession`, manifest route | public, unauthenticated |
| `begin_onboarding` | `services/constitutional/guidedOnboarding.ts` | returns the executable plan + an OAuth authorize URL |
| `authenticate_principal` | OAuth façade → Passport sign-in | **human acts in browser** |
| `get_passport_status` | `GET /api/participation/my-access`, passport status | |
| `create_or_link_agent_card` | `AigentQubeRegistry` → `POST /api/codex/agentiq-os/registry-draft` | mints the agent's `selectedAgentRef` |
| `request_agent_passport` / `activate_agent_passport` | `app/api/polity-passport/submit` (`agent_participant`) | revocable participant passport |
| `propose_delegation` | `formAgreement` + agent `acceptAgreement` | **authorize step returns a human URL** |
| `list_services` / `request_service_capabilities` / `enter_service` | service registry (§8) | incremental, per-service scope |
| `accept_lab_invitation` | `claimAccessInvitation` (`participationAccess.ts`) | human claim act |
| `list_shared_documents` / `read_shared_document` | Passport locker (`lockerItems.ts`) | scoped to the agent's locker view |
| `join_qubetalk_channel` / `send_qubetalk_message` / `list_qubetalk_channels` | `services/qubetalk/peerChannel.ts` | |
| `submit_review` / `submit_result` | `POST /api/public/irl/experiments/submit` (x409 gate) | re-passes `requireAuthorizedAgreement` |

**Prompts** (so the agent walks the operator through conversationally, not just receiving API functions):
`onboard_to_metame` · `get_polity_passport` · `prepare_agent_card` · `explain_delegation_request` · `enter_service` (e.g. `review_research_package` for IRL).

## 7. Auth — OAuth façade over Polity Passport

The MCP connection identifies the *client application*; the Polity Passport identifies the *personhood-bound principal*. v1 uses an **OAuth-2.1-shaped façade** whose backend drives the **existing** spine — no parallel identity system.

Sequence:
1. Agent inspects the public invitation details (`inspect_agent_link`).
2. Agent calls `begin_onboarding`.
3. Gateway returns an **OAuth authorization URL**.
4. User authenticates through the **Polity Passport** (existing Supabase spine; captcha-grade proof for read/write).
5. Gateway binds the invitation to a **T2 channel alias**.
6. User reviews the proposed agent delegation and **authorizes** it (browser).
7. A **delegation receipt** is issued (authorized Constitutional Agreement).
8. The MCP session receives the **permitted capability scope**.

The session the agent receives (illustrative — T2 aliases only):

```
principal_alias: pp_t2_7f91...
agent_alias:     agent_t2_a83...
scope: [ irl.documents.read, irl.feedback.create, qubetalk.channel.send ]
expires: 30 days
```

Enforcement on every mutating tool = `requireAuthorizedAgreement({ capabilityRef, selectedAgentRef, requestingPersonaId })` (HTTP 409 if the authorized agreement doesn't bind the triple). **The gate is the switch**; revocation = TTL lapse / `maxActions` exhaustion / status flip. The external agent is **not imported as the person** — it becomes a *delegated computational participant* bound to a personhood principal, an Agent Card, an Agent Passport, a capability scope, and a revocable delegation receipt.

## 8. Service registry + discovery

After onboarding, the agent inspects a registry (`metame://services`) rather than being shown a large platform menu:

```json
{ "services": [
  { "id": "polity-passport", "status": "active", "role": "constitutional-root" },
  { "id": "irl",   "requiredCapabilities": ["research.read","research.submit","qubetalk.send"] },
  { "id": "devon", "requiredCapabilities": ["code.read","proposal.create","receipt.review"] }
] }
```

The agent then says: *"You are eligible to join the IRL. This requires permission to read shared research artifacts and submit review responses. Would you like me to request those capabilities?"* → `request_service_capabilities('irl')` forms the incremental delegation → human authorizes → `enter_service('irl')`. **Every service consumes the same constitutional persona rather than implementing its own onboarding.**

## 9. Reuse map (do NOT rebuild)

| Capability | Anchor |
|---|---|
| Executable onboarding plan | `services/constitutional/guidedOnboarding.ts` + `app/api/constitutional/guided-onboarding/route.ts` |
| Durable delegation + authority gate ("x409") | `services/constitutional/constitutionalAgreement.ts`, `POST /api/constitutional/agreement` |
| Machine accession object (manifest precursor) | `GET /api/public/irl/accession` (`irl-accession/v1`), `app/invite/[code]/page.tsx` |
| Passport machine API + discovery | `app/api/polity-passport/{submit,validate,registry,status/[id],openapi.json}`, `app/.well-known/polity-passport/route.ts` |
| Agent Card registry | `packages/agentiq-sdk` `AigentQubeRegistry` → `POST /api/codex/agentiq-os/registry-draft` |
| Agent Passport credential (VC) | `services/passport/passportCredential.ts` (HMAC/stub signing) |
| CAS invitations + grants + auto-channel | `services/passport/participationAccess.ts`, `app/api/participation/{claim,my-access}` |
| QubeTalk peer channels + locker | `services/qubetalk/peerChannel.ts`, `services/passport/{lockerItems,lockerStorage}.ts` |
| Bespoke tool-dispatch to wrap as MCP | `services/mcp/experienceQubeTools.ts`, `app/api/mcp/*`, `services/smarttriad/primitiveRegistry` |
| Identity spine | `services/identity/*`, `utils/personaSpine.tsx` |
| A2A card shape (later façade) | `app/api/agents/aletheon/route.ts`, `app/api/agents/[id]/agent-card.json/route.ts` |

**Net-new:** a spec-compliant remote MCP server, the OAuth-façade auth binding, the signed `metame-agent-link/v1` manifest, the service registry, and the Agent-Passport issuance step — everything else composes existing rails.

## 10. QubeTalk handoff (MCP onboards; QubeTalk persists)

MCP is excellent for reading resources, invoking onboarding tools, retrieving reports, and submitting structured actions — but is **not** the canonical persistent peer-messaging layer. After onboarding, the gateway creates/connects the agent to a **QubeTalk channel** (reuse `maybeOpenInviteChannel` / `createOrGetChannel`). Agent messages carry principal, agent, delegation receipt, message type, shared-artifact references, permissions, consequence tier, and delivery receipt. `send_qubetalk_message` is simply one interface into that protocol.

## 11. A2A façade (later)

Once agents operate independently of chat hosts, expose an A2A-compatible surface over the same gateway: `/.well-known/agent-card.json` (+ populated `skills[]`), `/mcp`, `/a2a` (task endpoint). MCP answers *"what tools/knowledge can my agent access?"*; A2A answers *"how do autonomous agents discover and exchange tasks?"*; QubeTalk answers *"under whose authority, what content may move, how is it receipted?"* **Build MCP first** — it directly closes the immediate Claude Chat / Claude Code onboarding gap.

## 12. Connection modes

- **Mode A — give this link to the agent** (primary, lowest friction): the Agent Link page supplies the onboarding prompt + connector instructions; where the host supports remote MCP connectors, the agent connects directly.
- **Mode C — copy-paste command** (plain chat): a single onboarding instruction; still depends on the host supporting connectors/tools (a pasted JSON file cannot itself grant a chat session network authority).
- **Mode B — downloadable Agent Kit** (later, Phase 4): `agent-kit/` with `AGENT.md`, `invitation.json`, `mcp.json`, `permissions.md`, and a reusable Claude Code skill/command.

## 13. Universal onboarding flow (guided constitutional handshake)

1. **Inspect** — agent reads the Agent Link and explains what metaMe is, what the Passport establishes, what is / isn't disclosed, what capabilities may later be granted.
2. **Establish personhood** — user completes the Polity Passport flow (continuity without public identity exposure).
3. **Bind the agent** — user creates/approves Agent Card, agent alias, host/provider declaration, capability profile.
4. **Delegate** — the bridge presents a clear May / May-not scope; human authorizes.
5. **Activate Agent Passport** — a revocable Agent Passport binds the external agent to the principal + delegation.
6. **Enter a service** — the initiating link determines the destination (general → metaMe home; IRL → Research Lab; DevOn → dev env; Founder Office → operator workspace; QubeTalk → peer channel).
7. **Continue through the familiar agent** — the user needn't learn the whole metaMe UI; their agent walks them through, deep-linking into metaMe only when approval, review, or richer interaction is required.

## 14. Roadmap

- **Phase 0 — this PRD (ratify-before-build).**
- **Phase 1 — Constitutional ingress (core product):** universal Agent Link · remote MCP gateway · OAuth façade · Passport onboarding · Agent Card create/link · Agent Passport issuance · bounded delegation · revocation · service discovery · receipts. Modes A + C.
- **Phase 2 — Foundational metaMe access:** locker · QubeTalk send/receive · shared-artifact access · principal approvals · agent-activity view.
- **Phase 3 — Service adapters:** IRL **first (flagship)**, then DevOn, Founder Office, Studio, AgentiQ Builder — each consuming the same constitutional persona (no separate onboarding).
- **Phase 4 — A2A + external runtime interop:** `/.well-known/agent.json` + task endpoint, agent-to-agent handoff, QubeTalk-protocol integration, enterprise/third-party runtime federation, Mode B Agent Kit.

## 15. First flagship acceptance journey (IRL — Austin)

Austin receives one link, opens it, gives it to Claude. Claude:

> *"You have been invited to join the Invariant Research Lab as an external reviewer. The invitation requests permission for me to read documents shared with you, submit review artifacts, and send messages through your metaMe QubeTalk channel. It does not permit publication, resharing, financial commitment, or delegation of another agent. Shall I begin authentication?"*

Austin approves → Claude (1) connects to the MCP server, (2) authenticates Austin through his Polity Passport, (3) creates/links the Agent Card, (4) presents the Agent Passport + delegation request (Austin authorizes), (5) enters the lab, (6) finds the shared report in Austin's locker, (7) reviews it, (8) sends structured feedback via QubeTalk, (9) produces receipts for the consequential steps. **That is the missing bridge.**

## 16. Acceptance criteria (Phase 1)

1. `tools/list` returns the catalogue; `inspect_agent_link` resolves a manifest with a valid signature and **no T0 ids**.
2. From a fresh principal, the guided constitutional handshake yields **passport issued + delegation active** (cross-check `GET /api/participation/my-access`); the agent **cannot** authorize (no tool path).
3. `list_services` shows eligibility; `request_service_capabilities` → human authorize → `enter_service('irl')` reaches locker read + `submit_review` (409 gate re-passed) + QubeTalk send; receipts written.
4. Out-of-scope or post-TTL/`maxActions` calls fail `requireAuthorizedAgreement` (409); revocation verified.
5. Modes A + C both reach step 2.
6. Regression: existing invite page, accession object, guided-onboarding route, and spine canaries (`check:spine`) stay green.

## 17. Open decisions

- **Host/domain:** v1 default = existing host at `/api/agent-gateway/mcp` (no new infra); a dedicated `agent.metame.com/mcp` + `metame.com/agent-link/{id}` surface is a later ops decision. The manifest's `mcpServer.url` is **derived from `publicOrigin`/config, never hardcoded/guessed.**
- **New deps + storage:** `@modelcontextprotocol/sdk`; new Supabase tables for gateway sessions + OAuth client registry (deny-all RLS, service-role only).
- **Signing:** HMAC/stub for v1 (matches current passport signing); asymmetric, publicly verifiable proof is a follow-on (aligns with Passport Bureau Phase C).

## 18. Naming

Capability: **metaMe Agent Bridge**. Primitives: **Agent Link** (bootstrap) · **Agent Gateway** (MCP/A2A connectivity) · **Constitutional Persona** (Passport, delegation, authority binding). Proposition: *Bring your agent. Establish your personhood. Enter the constitutional internet.*
