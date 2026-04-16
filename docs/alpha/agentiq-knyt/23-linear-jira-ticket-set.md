# Venture Lab α — Linear / Jira Ticket Set
*Doc 23 of 23 — Full ticket definitions for AgentiQ KNYT Alpha build (T1–T38)*

---

## Epic A — Foundations

**A1 / T1 — DB Migration: All 11 Tables**
Priority: P0 | Owner: CC
Create all 11 tables with correct schema and RLS enabled: `agents`, `agent_qube_cards`, `skill_qubes`, `cartridges`, `cartridge_overlays`, `user_runtime_profiles`, `knyt_user_state`, `qc_events`, `dvn_receipts`, `knyt_reward_events`, `org_qube_policy_packs`.
*AC:* Migration runs clean on fresh Supabase project. All tables present. RLS enabled on every table. Anon role blocked. User role reads own rows only.

**A2 / T2 — Agent Registry Seed**
Priority: P0 | Owner: CC
Insert 5 bootstrap agent rows: Aigent Z (KB: platform), Marketa (KB: metaKnyts, campaign), Know1 (KB: metaKnyts, lore), metaMe (KB: sovereign), MoneyPenny (KB: qriptopian). Include system_prompt stubs and correct kb_domain values.
*AC:* `SELECT * FROM agents` returns 5 rows. `/api/agents` returns all 5 with correct KB domains. Persona routing in `/api/codex/chat` resolves each correctly.

**A3 / T3 — KNYT Cartridge Shell + JS Bridge**
Priority: P0 | Owner: CX + CC
Build iframe cartridge host in metaMe Runtime. Implement JS bridge protocol: `cartridge:ready`, `cartridge:action`, `cartridge:receipt`, `cartridge:error`. Register KNYT cartridge manifest in `cartridges` table.
*AC:* KNYT cartridge mounts in <2 s. `cartridge:ready` event fires. Bridge roundtrip measured <200 ms. Unknown message types ignored gracefully.

**A4 / T4 — RLS Audit**
Priority: P0 | Owner: CC
Verify every new table has RLS. Write test queries for anon, authenticated-other-user, authenticated-own-user, service role. Document results.
*AC:* Anon: blocked on all tables. Authenticated-other: blocked on personal tables. Authenticated-own: reads own rows. Service role: full access. No table unchecked.

---

## Epic B — KNYT Core

**B1 / T5 — Know1 Inference + Treasury Context**
Priority: P0 | Owner: CC
Wire Know1 persona to KNYT KB domain (metaKnyts). Inject current `knyt_user_state` (balance, patronage_stage, pcs_stage) into Know1 system context on every inference call.
*AC:* Know1 responds in character. Treasury context object present in first message context. No bleed from platform agents' KB. Responds correctly to lore Q&A.

**B2 / T6 — Experience Capsule Delivery**
Priority: P0 | Owner: CC + CX
`POST /api/experience/capsule` returns `{depth, label, cta_label, next_depth, fallback}` for any valid `patronage_stage × pcs_stage` pair. Wire Featured Moment block and NBE Pathway Card in KNYT Runtime to live prescription.
*AC:* All 56 matrix cells return a prescription. Featured Moment renders label + CTA. NBE card renders next-best-step. Fallback rendered when stage unknown.

**B3 / T7 — Axis Step Chains (Patronage + PCS)**
Priority: P0 | Owner: CX
Replace flat progress indicators with full step-chain pill rows. Patronage: 7 stages (OutsideOrder → Zero). PCS: 8 stages (Lurker → Champion). Active = filled amber/indigo. Past = dimmed slate. Future = muted.
*AC:* All 7 patronage pills render. All 8 PCS pills render. Active stage highlighted. Past stages dimmed. Responsive wrap at mobile width.

**B4 / T8 — Action Chips (Signal Action Tray)**
Priority: P0 | Owner: CX
Replace flat buttons with icon + label `rounded-full` chips. Use lucide icon per action (Heart=like, Zap=spark, CheckCircle2=vote, Layers=curate, Shuffle=remix, Upload=contribute, Star=patronize, ThumbsUp=endorse, MessageCircle=respond). Primary chip amber. Secondary transparent with border.
*AC:* All 9 actions render as chips. Primary action distinct. Icons correct per action. Disabled state applies when `!canPerformAction`. Loading state on submit.

**B5 / T9 — Investor Privilege Block**
Priority: P0 | Owner: CX
Show privilege block in NBE card for non-backed investors: tier badge, discount %, offer name (Top KNYT Shelf / Zero KNYT / KNYT Codex path), KS CTA chip. Replace with green "Patron backed ✓" badge when `investorStatus.backed = true`.
*AC:* Privilege block visible for cohort_zero_knyt (25%), top_shelf (20%), band 5000+ (20%), 2000-4999 (15%), default (10%). Backed state replaces block. KS URL correct.

**B6 / T10 — Signal Action Routes**
Priority: P0 | Owner: CC
Ensure all 6 KNYT signal action API routes live under `app/api/codex/knyt/living-canon/`: like, spark, vote, curate, remix, react. Each must write a `qc_events` debit and optionally issue a `knyt_reward_events` row.
*AC:* All 6 routes 200 on valid payload. `qc_events` row written per call. Reward event written for qualifying actions. DVN receipt issued.

---

## Epic C — Skill Layer

**C1 / T11 — SkillQube Schema + Bootstrap Skills**
Priority: P1 | Owner: CC
Create `skill_qubes` table. Seed bootstrap skills: Know1 (lore-lookup, reward-check), Aigent Z (routing-decision, policy-eval), Marketa (campaign-status, investor-lookup). Wire `POST /api/skills/invoke`.
*AC:* 6 bootstrap skills in `skill_qubes`. Each invocable via API. Invocation logged to `qc_events`. Skill usage_count increments.

**C2 / T12 — AgentQube Intake Pipeline**
Priority: P1 | Owner: CC
Build factory intake for agent registration: intake → classify → validate → trust-score → publish. Expose `POST /api/agents/submit`. Wire to existing factory pipeline in `services/registry/`.
*AC:* Agent submitted via API surfaces in `GET /api/agents` within 30 s. Trust score present. Invalid submissions rejected with clear error.

**C3 / T13 — Skill Registry Browse UI**
Priority: P1 | Owner: CX
Show skill list in AgentQube tab of AgentiQ cartridge. Display: skill name, agent owner, invocation count, trust score. Filter by agent.
*AC:* Skills list renders. Filter works. Each skill row links to agent card.

---

## Epic D — Treasury / Rewards

**D1 / T14 — Reward Issuance Route**
Priority: P0 | Owner: CC
`POST /api/knyt/rewards/issue` — validate action type and user auth; compute $KNYT amount from PCS stage + action type lookup; insert `knyt_reward_events`; issue DVN receipt; return updated balance.
*AC:* Reward issued in <500 ms. Balance updates correctly. DVN receipt present. Double-issuance for same event_id rejected (idempotency key).

**D2 / T15 — $KNYT Balance + History**
Priority: P1 | Owner: CC
`GET /api/knyt/rewards/balance` returns sum of `knyt_reward_events.amount_knyt` for authed user. `GET /api/knyt/rewards/history` returns paginated list (20/page).
*AC:* Balance correct after reward issuance. History includes all events. Pagination cursor works.

**D3 / T16 — Reward Surface in Runtime**
Priority: P1 | Owner: CX
Reward+Progress Card in KNYT Runtime shows: current $KNYT balance, last reward earned, total rewards this campaign, animated +N on new reward.
*AC:* Balance displays. Animation fires on new reward event. History accessible via expand.

---

## Epic E — Q¢ Accounting + DVN Receipts

**E1 / T17 — Q¢ Metering Middleware**
Priority: P0 | Owner: CC
Wrap `/api/codex/chat` and all inference routes with metering middleware. On each call: debit Q¢ (amount from route config), write `qc_events` row, return updated balance in response headers.
*AC:* Every inference call has a corresponding `qc_events` row. No route escapes metering (verified by query after 10 test calls). Balance never negative.

**E2 / T18 — Q¢ Balance + History**
Priority: P1 | Owner: CC
`GET /api/qc/balance` returns net balance (credits minus debits). `GET /api/qc/history` returns paginated `qc_events`.
*AC:* Balance consistent with history sum. Pagination works. Credits and debits distinguished by `event_type`.

**E3 / T19 — DVN Receipt Issuance Service**
Priority: P0 | Owner: CC
Build `receiptService.issue(eventType, payload)` — sha256 hash of canonical payload, insert `dvn_receipts`, return receipt id. Call from reward issuance, policy evaluation, material transaction routes.
*AC:* Receipt has valid sha256 hash. Hash verifiable by re-hashing payload. `verified: true` on insert. Receipt id returned to caller.

**E4 / T20 — DVN Receipt Verification UI**
Priority: P1 | Owner: CX
DVN receipt list in KNYT cartridge: receipt id, event type, issued_at, hash (truncated), verified badge. Expand to see full payload.
*AC:* List paginates. Hash visible. Verified badge green. Payload JSON readable.

---

## Epic F — metaMe Controls

**F1 / T21 — User Sovereignty Settings**
Priority: P1 | Owner: CX + CC
Settings panel in metaMe section: data sharing toggle, guardian policy toggle. Persist to `user_runtime_profiles`. Respected by inference routing.
*AC:* Toggles persist across sessions. Data sharing off: no personal data in inference context. Guardian policy on: evaluator runs before each inference call.

**F2 / T22 — Guardian Policy Hook**
Priority: P0 | Owner: CC
`POST /api/metame/guardian/evaluate` — evaluate action payload against active policy rules. BLOCK → 403. FLAG → 200 with flag in response. ALLOW → pass through. Log evaluation to `dvn_receipts`.
*AC:* BLOCK confirmed: test policy blocks inference. FLAG confirmed: test policy flags and passes. ALLOW confirmed. Every evaluation has a receipt.

**F3 / T23 — metaMe Profile API**
Priority: P1 | Owner: CC
`GET /api/metame/profile` returns current sovereignty settings. `PATCH /api/metame/profile` updates settings atomically.
*AC:* PATCH idempotent. Concurrent patches don't corrupt state. Settings in response match DB.

---

## Epic G — Qriptopian Path

**G1 / T24 — MoneyPenny Handoff Chip**
Priority: P1 | Owner: CX
Add MoneyPenny CTA chip to KNYT Runtime Signal Action Tray (secondary chip, multi-chain ops prompt). On click: emit `cartridge:handoff` bridge event with `HandoffPayload { targetCartridge: "qriptopian", fromAgent: "moneyPenny", context: {...} }`.
*AC:* Chip renders in tray. Click emits bridge event. Host receives event and navigates to Qriptopian.

**G2 / T25 — Qriptopian Entry Point**
Priority: P1 | Owner: CC + CX
Qriptopian cartridge receives `HandoffPayload` and loads MoneyPenny context (balance, pending ops). MoneyPenny persona active on first message.
*AC:* HandoffPayload decoded. MoneyPenny context injected. First response is MoneyPenny in-character. No blank state on arrival.

---

## Epic H — Policy + OrgQube

**H1 / T26 — OrgQube Policy Packs Schema**
Priority: P1 | Owner: CC
Create `org_qube_policy_packs` table. Seed default pack for KNYT org: BLOCK anonymous signal actions, FLAG unverified contributor submissions, ALLOW all standard interactions.
*AC:* Default pack in table. Evaluator reads rules from jsonb. Correct decision for each seeded rule.

**H2 / T27 — Policy Evaluator Service**
Priority: P1 | Owner: CC
`policyEvaluator.evaluate(orgId, action, context)` → `ALLOW | FLAG | BLOCK`. Rules evaluated in order; first match wins. Fallback ALLOW.
*AC:* All three outcomes testable with seed data. Evaluation fast <50 ms. Logged to `dvn_receipts`.

**H3 / T28 — Policy Pack Admin UI**
Priority: P2 | Owner: CX
View active policy packs for org in AgentiQ cartridge admin tab. Show rule count, active status, last updated.
*AC:* Packs list renders. Admin-only gated. No edit in Alpha (read-only).

---

## Epic I — Hardening

**I1 / T29 — iframe CSP**
Priority: P0 | Owner: CC
Add `Content-Security-Policy` header to Next.js config restricting `frame-src` to known cartridge origins. Document allowlist.
*AC:* Unknown origin iframe blocked by browser. Known origin loads. Header present in all responses.

**I2 / T30 — Bridge Message Origin Validation**
Priority: P0 | Owner: CC + CX
Both sides of JS bridge validate `event.origin` against allowlist before processing any message. Unknown origins silently ignored.
*AC:* Test: message from unknown origin → ignored. Test: message from known origin → processed. No console errors in normal flow.

**I3 / T31 — Inference Load Test**
Priority: P1 | Owner: CC
Run k6 or similar: 50 concurrent users, `/api/codex/chat` with 200-token prompt, 60 s duration. Capture p50/p95/p99.
*AC:* p95 <3 s. No 5xx under load. Q¢ metering rows count matches request count.

---

## Post-Alpha Tickets (T32–T38)

| ID | Title | Epic | Why Post-Alpha |
|----|-------|------|---------------|
| T32 | Public agent marketplace (AgentiQ OS) | OS | Requires Phase 2 Agentic OS Alpha |
| T33 | Full multi-chain wallet (MoneyPenny) | Qriptopian | Requires live chain integrations |
| T34 | External DVN notarisation | DVN | Requires external validator network |
| T35 | Revenue-grade Q¢ billing | Q¢ | Requires pricing decision |
| T36 | OrgQube governance voting | Policy | Post-alpha governance model |
| T37 | Know1 lore knowledge graph (full) | KNYT | Requires lore corpus build |
| T38 | Reward event webhook API | Rewards | No external consumer in Alpha |

---

## Recommended First Sprint (10 tickets)

Open these immediately — they are the critical path unblocked from day one:

1. **T1** — DB Migration (all 11 tables) → unblocks all CC work
2. **T2** — Agent Registry Seed → unblocks inference routing
3. **T3** — Cartridge Shell + Bridge → unblocks all CX work
4. **T4** — RLS Audit → security baseline
5. **T5** — Know1 Inference + Treasury Context → first live agent value
6. **T6** — Experience Capsule Delivery → primary user-facing value
7. **T14** — Reward Issuance Route → closes incentive loop
8. **T19** — DVN Receipt Issuance Service → trustworthiness baseline
9. **T17** — Q¢ Metering Middleware → economic correctness
10. **T22** — Guardian Policy Hook → sovereignty contract

---

## Must-Pass Alpha Acceptance Gate

Before declaring alpha open:

- [ ] All P0 tickets merged and deployed
- [ ] Full functional gate pass (see doc 22)
- [ ] Security gate pass (RLS, CSP, bridge validation)
- [ ] Performance gate pass (p95 benchmarks)
- [ ] Know1 manual QA: 10 lore questions + 3 treasury context checks
- [ ] Rewards end-to-end: signal → event → balance update confirmed live
- [ ] DVN receipts: 20-event sequence all have valid hashes
- [ ] metaMe guardian: BLOCK policy confirmed in prod-equivalent environment
- [ ] Qriptopian handoff: full round-trip confirmed
- [ ] No open P0 blockers
