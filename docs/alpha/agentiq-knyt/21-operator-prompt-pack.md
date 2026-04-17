# Venture Lab α — Dev Implementation PRD
*Doc 21 of 23 — canonical implementation spec for Venture Lab α / AgentiQ KNYT Alpha build*

---

## Product Goal

Build the live **metaMe / AgentiQ / AgentiQ OS engine** on top of the AgentiQ Alpha foundation. Deliver the reference agent trio (Aigent Z, Marketa, Know1), the first cartridge pair (KNYT + Qriptopian), and the KNYT Alpha experience as a coherent, operable platform.

---

## Alpha Scope

### Must Ship
- Kn0w1-first KNYT Alpha cartridge shell in metaMe Runtime (iframe-hosted, JS bridge)
- Agent persona system: Aigent Z, Marketa, Know1, metaMe — wired to correct KB domains
- Curated internal skill layer (2–4 bootstrap skills per agent)
- KNYT treasury/rewards MVP: $KNYT issuance, contribution rewards, local treasury ledger
- Q¢ accounting: event-based Qc debit/credit per interaction type
- DVN receipt layer: tamper-evident receipts for transactions, rewards, cartridge events
- metaMe alpha controls: user sovereignty settings, data visibility toggles, guardian policy
- Qriptopian support route: MoneyPenny CTA to Qriptopian cartridge for multi-chain ops
- AgentQube / SkillQube backend: registry, discovery, intake pipeline
- OrgQube policy evaluation abstraction: policy packs evaluatable per org/cartridge context

### Should Ship
- Agent capability scoring (trust score, usage telemetry)
- Basic campaign signal → $KNYT reward loop
- Simple org-level policy pack enforcement

### Must Not Ship (Alpha)
- Public AgentiQ OS agent marketplace
- Full multi-chain wallet integration
- Production DVN notarisation with external validators
- Revenue-grade Q¢ billing

---

## User Stories

| As a… | I want to… | So that… |
|-------|-----------|---------|
| KNYT investor | Enter the KNYT Runtime and see my personalised experience capsule | I know exactly what action to take next |
| KNYT investor | Complete a signal action (like, spark, vote, contribute) | I earn $KNYT rewards and advance my PCS stage |
| Campaign backer | See my patronage progress and privilege tier | I feel recognised as an early supporter |
| Know1 | Answer world lore questions with treasury context injected | I deliver in-character responses grounded in the KNYT economy |
| Aigent Z | Route interactions to the correct agent or cartridge | The system responds coherently without user confusion |
| Operator | See DVN receipts for all material events | Every transaction has an audit trail |
| Operator | Evaluate OrgQube policy packs per cartridge | Platform rules are enforced without hardcoding |

---

## System Boundaries

| Layer | Owner | Boundary |
|-------|-------|---------|
| metaMe Runtime iframe | Lovable / runtime surface | Hosts cartridge surface, renders experience chips |
| KNYT cartridge (client) | Lovable | React components: AxisSteps, ActionChip, capsule wrappers |
| KNYT API routes | Claude Code / Codex | `/api/experience/capsule`, `/api/codex/knyt/*`, `/api/qc/*` |
| Agent inference | Claude Code / Codex | `/api/codex/chat` with persona routing |
| Supabase | CC / Codex | All DB tables, RLS, migrations |
| JS bridge | CC | `postMessage` protocol between iframe and host |

**Split rule:** UI component decisions → Lovable. API contracts and DB schema → CC/Codex. Shared types → packages/agentiq-sdk.

---

## Core Epics

### Epic 1 — Cartridge Shell
**Deliverables:** metaMe Runtime iframe host, JS bridge protocol (`cartridge:ready`, `cartridge:action`, `cartridge:receipt`), cartridge manifest schema, KNYT cartridge registered and loadable.
**AC:** User can navigate to KNYT cartridge; cartridge surface mounts in under 2 s; bridge messages round-trip without error.

### Epic 2 — Know1 Mode
**Deliverables:** Know1 persona wired to KNYT KB domain (metaKnyts), in-character system prompt, lore Q&A path, treasury context injector (current $KNYT balance + user stage injected into system context).
**AC:** Know1 answers lore questions in character; balance/stage context appears in responses; no cross-contamination with platform agent context.

### Epic 3 — Skill Layer
**Deliverables:** SkillQube schema, skill registry API, bootstrap skills per agent (Know1: lore-lookup, reward-check; Z: routing-decision, policy-eval; Marketa: campaign-status, investor-lookup).
**AC:** Each agent can invoke ≥2 skills; skill invocations logged to `qc_events`; skill registry browseable in AgentQube tab.

### Epic 4 — Treasury / Rewards MVP
**Deliverables:** `knyt_reward_events` table, reward issuance route (`POST /api/knyt/rewards/issue`), PCS signal → reward mapping, $KNYT balance endpoint, reward history surface in Runtime.
**AC:** Signal action (like/spark/vote/contribute) triggers reward event; user balance updates within 5 s; history correct on refresh.

### Epic 5 — Q¢ Accounting
**Deliverables:** `qc_events` table, debit/credit on interaction type, Q¢ balance endpoint, metering middleware for inference routes.
**AC:** Every inference call debits Q¢; every reward credits Q¢; balance never goes negative (floor at 0); reconciliation query returns correct totals.

### Epic 6 — DVN Receipts
**Deliverables:** `dvn_receipts` table, receipt generation service (hash: sha256 of payload + timestamp), receipt endpoint (`GET /api/receipts/:id`), receipt badge in Runtime surface.
**AC:** Every material event (reward, transaction, policy decision) has a DVN receipt; receipt verifiable by hash; receipt list paginated correctly.

### Epic 7 — metaMe Alpha Controls
**Deliverables:** User sovereignty settings UI (data visibility toggles, guardian policy enable/disable), `user_runtime_profiles` table, metaMe guardian policy evaluation hook in inference routing.
**AC:** User can toggle data sharing off; guardian policy BLOCK response short-circuits inference; settings persist across sessions.

### Epic 8 — Qriptopian Support Route
**Deliverables:** MoneyPenny CTA chip in KNYT Runtime (multi-chain ops prompt), Qriptopian cartridge entry point, handoff payload schema (`HandoffPayload` with `targetCartridge: "qriptopian"`).
**AC:** User can navigate from KNYT to Qriptopian in one tap; handoff payload arrives correctly; MoneyPenny context is loaded (not blank).

### Epic 9 — AgentQube / SkillQube Backend
**Deliverables:** `agents` + `agent_qube_cards` + `skill_qubes` tables, factory intake pipeline (intake → classify → validate → trust score → publish), agent discovery API, AgentQube card in AssetDetailPanel.
**AC:** Agent submitted via factory surfaces in discovery within 30 s; trust score computed from capability metadata; card renders correct persona name, KB domain, skill count.

### Epic 10 — OrgQube Policy Evaluation
**Deliverables:** `org_qube_policy_packs` table, policy evaluator service (input: org_id + action → output: ALLOW/BLOCK/FLAG), policy pack admin UI, policy evaluation log.
**AC:** BLOCK policy prevents action execution; FLAG policy routes to guardian review; ALLOW passes through; evaluation logged to DVN receipt.

---

## Data Model

```sql
-- Core agent registry
agents (id, persona_id, name, kb_domain, system_prompt, skills jsonb, trust_score, created_at)
agent_qube_cards (id, agent_id, display_name, avatar_url, capability_tags, metadata jsonb)
skill_qubes (id, name, description, agent_id, invocation_schema jsonb, trust_score, usage_count)

-- Cartridge layer
cartridges (id, slug, name, owner_agent_id, manifest jsonb, iframe_url, active)
cartridge_overlays (id, cartridge_id, user_id, overlay_data jsonb, updated_at)

-- User runtime state
user_runtime_profiles (id, user_id, data_sharing_enabled, guardian_policy_enabled, settings jsonb)
knyt_user_state (id, user_id, patronage_stage, pcs_stage, knyt_balance, last_action_at, metadata jsonb)

-- Economics
qc_events (id, user_id, event_type, amount_qc, reference_id, reference_type, created_at)
dvn_receipts (id, event_type, payload_hash, payload jsonb, issued_at, verified bool)
knyt_reward_events (id, user_id, action_type, amount_knyt, pcs_stage, dvn_receipt_id, created_at)

-- Policy
org_qube_policy_packs (id, org_id, pack_name, rules jsonb, active, created_at)
```

---

## API Surface

### Agent routes
- `GET /api/agents` — list agents with trust scores
- `GET /api/agents/:personaId` — agent card + skills
- `POST /api/codex/chat` — inference with persona routing

### Skill routes
- `GET /api/skills` — skill registry browse
- `POST /api/skills/invoke` — invoke skill by id with payload

### Cartridge routes
- `GET /api/cartridges/:slug` — cartridge manifest
- `POST /api/cartridges/:slug/action` — dispatch cartridge action (bridge relay)

### Know1 routes
- `POST /api/knyt/know1/ask` — lore Q&A with treasury context
- `GET /api/knyt/know1/context` — current treasury + user stage context

### metaMe routes
- `GET /api/metame/profile` — user sovereignty settings
- `PATCH /api/metame/profile` — update settings
- `POST /api/metame/guardian/evaluate` — run policy evaluation on payload

### Q¢ routes
- `GET /api/qc/balance` — user Q¢ balance
- `POST /api/qc/events` — record debit/credit event
- `GET /api/qc/history` — paginated event log

### Receipt routes
- `POST /api/receipts` — issue DVN receipt for event
- `GET /api/receipts/:id` — fetch receipt by id
- `GET /api/receipts` — list receipts for user

### Policy routes
- `POST /api/policy/evaluate` — evaluate action against org policy pack
- `GET /api/policy/packs` — list policy packs for org

### Experience (existing)
- `POST /api/experience/capsule` — matrix prescription for user stage

### Rewards
- `POST /api/knyt/rewards/issue` — issue $KNYT for signal action
- `GET /api/knyt/rewards/balance` — user $KNYT balance
- `GET /api/knyt/rewards/history` — reward event log

---

## Runtime UX Spec

**Cartridge shell:** iframe fills Runtime content area; JS bridge wraps postMessage; loading state shows KNYT spinner until `cartridge:ready`.

**Experience capsule:** `rounded-xl border border-white/5 bg-slate-950/80 p-4` wrapper. Section labels `text-[10px] uppercase tracking-widest text-slate-500`. Active stage amber, past stages dimmed, future muted.

**Axis step chains:** Full patronage axis (7 stages) and PCS axis (8 stages) rendered as step-chain pills. Active = filled amber/indigo. Replaces flat progress bars.

**Action chips:** `rounded-full px-3 py-1.5 text-xs font-semibold` buttons with lucide icon prefix. Primary = amber bg. Secondary = transparent with border.

**Privilege block (NBE card):** Tier badge (Zero/First/Keji/Keta), discount %, offer name, KS CTA — visible only when `!investorStatus.backed`.

**Backed confirmation:** Green header badge once `investorStatus.backed = true`. Replaces KS CTA.

---

## Acceptance Criteria by Epic

| Epic | Must-pass gate |
|------|---------------|
| 1. Cartridge Shell | KNYT cartridge loads in <2 s, bridge roundtrip <200 ms |
| 2. Know1 Mode | Lore Q&A in character, treasury context in response |
| 3. Skill Layer | ≥2 skills per agent invocable, all logged |
| 4. Treasury/Rewards | Signal → reward event → balance update in <5 s |
| 5. Q¢ Accounting | Every inference debited, balance consistent |
| 6. DVN Receipts | Every material event has receipt, hash verifiable |
| 7. metaMe Controls | Guardian BLOCK short-circuits inference |
| 8. Qriptopian Route | One-tap handoff to Qriptopian with context |
| 9. AgentQube/SkillQube | Agent in discovery in <30 s after intake |
| 10. OrgQube Policy | BLOCK/FLAG/ALLOW enforced, logged |

---

## Build Order — 5 Waves

**Wave 1 — Foundation (Sprints 0–1)**
DB migrations (all 11 tables), agent registry seeded (Z, Marketa, Know1, metaMe, MoneyPenny), KNYT cartridge manifest, iframe shell with JS bridge.

**Wave 2 — Core Loop (Sprints 2–3)**
Know1 inference + treasury context, signal routes → reward events, Q¢ metering on inference, DVN receipt issuance.

**Wave 3 — Experience Surface (Sprints 3–4)**
Experience capsule delivery wired to Runtime Featured Moment + NBE card, axis step chains, action chips, privilege block.

**Wave 4 — Skill + Policy Layer (Sprints 5–6)**
Bootstrap skills per agent, SkillQube registry, OrgQube policy packs, metaMe guardian hook, AgentQube intake pipeline.

**Wave 5 — Hardening (Sprints 7–8)**
Qriptopian handoff, DVN receipt verification UI, RLS audit, load testing, alpha acceptance gate pass.

---

## Engineering Notes

- **JS bridge protocol:** use `postMessage` with typed `{ type, payload }` structure. Validate origin on both sides. Never trust unvalidated bridge messages.
- **$KNYT is cartridge-local:** it is not an EVM token in Alpha. Ledger is the `knyt_reward_events` table. Do not conflate with Q¢.
- **DVN receipts in Alpha:** hash is sha256 of `JSON.stringify({ event_type, payload, issued_at })`. External notarisation is post-alpha.
- **RLS:** all new tables must have RLS enabled. Users read only their own rows. Service role key only in server-side routes.
- **Supabase migrations:** place in `supabase/migrations/` with timestamp prefix. Never run raw SQL outside migrations in production.
- **Iframe CSP:** cartridge iframe src must be on allowlist. Do not allow arbitrary URLs.
- **Trust scores:** seeded manually for bootstrap agents; algorithmic scoring is Wave 4.

---

## Dev Tickets (P0 / P1 / P2)

**P0 — Must ship before alpha opens**
- P0-01: DB migration — all 11 tables with RLS
- P0-02: Agent registry seed (5 agents)
- P0-03: KNYT cartridge shell + iframe bridge
- P0-04: Know1 inference + treasury context injection
- P0-05: `POST /api/experience/capsule` + Runtime wiring
- P0-06: Signal action → reward event (`POST /api/knyt/rewards/issue`)
- P0-07: DVN receipt issuance on all material events
- P0-08: Q¢ metering middleware on inference routes
- P0-09: metaMe guardian policy hook in routing
- P0-10: RLS audit — all new tables

**P1 — Must ship before alpha closes**
- P1-11: SkillQube registry + bootstrap skills per agent
- P1-12: OrgQube policy packs + evaluator service
- P1-13: AgentQube intake pipeline (factory → discovery)
- P1-14: Qriptopian handoff chip + route
- P1-15: metaMe sovereignty settings UI
- P1-16: DVN receipt verification UI + receipt list
- P1-17: Q¢ balance + history endpoint
- P1-18: $KNYT balance + history endpoint
- P1-19: Cartridge overlay persistence
- P1-20: Alpha acceptance gate integration test

**P2 — Nice to have for alpha**
- P2-21: Agent capability scoring (algorithmic trust score)
- P2-22: Campaign signal → $KNYT reward loop automation
- P2-23: Basic org-level policy enforcement UI
- P2-24: Know1 lore knowledge graph stub
- P2-25: Reward event webhook (future external integration point)
