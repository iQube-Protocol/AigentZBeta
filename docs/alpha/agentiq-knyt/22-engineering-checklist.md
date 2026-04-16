# Venture Lab α — Engineering Checklist
*Doc 22 of 23 — Sprint board and acceptance gate for AgentiQ KNYT Alpha build*

---

## Sprint Board

### Sprint 0 — Foundations (Week 1)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P0-01 | DB migration — all 11 tables with RLS | CC | Migration runs clean; all tables exist; RLS enabled on every table |
| P0-02 | Agent registry seed | CC | 5 agents in `agents` table (Z, Marketa, Know1, metaMe, MoneyPenny); KB domains correct |
| P0-03 | KNYT cartridge shell + iframe bridge | CX | KNYT cartridge loads in <2 s; `cartridge:ready` fires; bridge roundtrip measurable |
| P0-10 | RLS audit — all new tables | CC | Service role bypasses; anon role blocked; user role reads own rows only |

### Sprint 1 — Core Inference Loop (Week 2)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P0-04 | Know1 inference + treasury context injection | CC | Know1 answers in character; balance + stage present in context object |
| P0-05 | `POST /api/experience/capsule` + Runtime wiring | CC | Capsule returned for any valid patronage × PCS pair; Featured Moment block renders it |
| P0-08 | Q¢ metering middleware on inference routes | CC | Every `/api/codex/chat` call writes a `qc_events` debit row; no route escapes metering |
| P0-09 | metaMe guardian policy hook | CC | BLOCK policy returned from evaluator short-circuits inference; response is `403 Policy Block` |

### Sprint 2 — Rewards + Receipts (Week 3)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P0-06 | Signal action → reward event | CC | `POST /api/knyt/rewards/issue` writes `knyt_reward_events`; balance endpoint reflects update in <5 s |
| P0-07 | DVN receipt issuance | CC | Every reward, transaction, policy decision has a `dvn_receipts` row; hash = sha256 of canonical payload |
| P1-17 | Q¢ balance + history endpoint | CC | `GET /api/qc/balance` returns correct total; `GET /api/qc/history` paginates |
| P1-18 | $KNYT balance + history endpoint | CC | `GET /api/knyt/rewards/balance` returns sum of events; history correct |

### Sprint 3 — Experience Surface (Week 4)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P0-05b | Axis step chains in Runtime | CX | Full 7-stage patronage + 8-stage PCS axis renders as step pills; active = amber; past = dimmed |
| P0-05c | Action chips in Signal Action Tray | CX | Each action renders as icon-chip; primary chip amber; secondary transparent; all dispatch to correct route |
| P0-05d | Privilege block in NBE card | CX | Tier badge, discount %, offer name, KS CTA visible when not backed; replaced by green badge when backed |
| P1-16 | DVN receipt verification UI + list | CX | Receipt list paginated in KNYT cartridge; hash visible; `verified: true` badge present |

### Sprint 4 — Skill Layer (Week 5)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P1-11 | SkillQube registry + bootstrap skills | CC | Know1: lore-lookup + reward-check; Z: routing-decision + policy-eval; Marketa: campaign-status + investor-lookup; all invocable |
| P1-13 | AgentQube intake pipeline | CC | Agent submitted via factory → classified → validated → trust-scored → appears in discovery in <30 s |
| P1-19 | Cartridge overlay persistence | CC | User overlay saved to `cartridge_overlays`; reloads correctly across sessions |
| P2-21 | Agent capability scoring | CC | Trust score computed from skill count + usage telemetry; updates on each invocation |

### Sprint 5 — Policy + metaMe (Week 6)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P1-12 | OrgQube policy packs + evaluator | CC | ALLOW/BLOCK/FLAG evaluated from rules jsonb; evaluation logged to dvn_receipts |
| P1-15 | metaMe sovereignty settings UI | CX | Data sharing toggle + guardian policy toggle persist; off-state respected by inference |
| P2-23 | Policy enforcement UI | CX | Active policy packs visible in AgentiQ cartridge admin tab |

### Sprint 6 — Qriptopian + Handoffs (Week 7)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P1-14 | Qriptopian handoff chip + route | BOTH | MoneyPenny chip in KNYT Runtime triggers handoff; `HandoffPayload` arrives at Qriptopian; MoneyPenny context loads |
| P2-22 | Campaign signal → $KNYT automation | CC | Signal events from KNYT Wheel CRM flow trigger reward issuance without manual intervention |
| P2-24 | Know1 lore knowledge graph stub | CC | Stub `lore_graph` table seeded with 10 canonical KNYT lore nodes; Know1 can query |

### Sprint 7 — Hardening (Week 8)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| P1-20 | Alpha acceptance gate integration test | CC | All P0 acceptance criteria pass in a single automated run |
| SEC-01 | iframe CSP allowlist | CC | `Content-Security-Policy` header restricts frame-src to known cartridge origins |
| SEC-02 | Bridge message origin validation | CC | `postMessage` handler rejects messages from non-allowlisted origins |
| PERF-01 | Inference route load test | CC | `/api/codex/chat` handles 50 concurrent requests with p95 <3 s |

### Sprint 8 — Alpha Acceptance (Week 9)
| Ticket | Title | Owner | Done When |
|--------|-------|-------|----------|
| GATE-01 | Full alpha acceptance gate pass | BOTH | All must-pass criteria in gate below confirmed green |
| DOCS-01 | Operator runbook update | CC | `PROGRAM_OVERVIEW.md` Phase 1 critical path all items ✅ |
| HAND-01 | Handoff to maintenance mode | CC | Session complete QubeTalk packet sent; no open P0 blockers |

---

## Owner Key
- **CC** — Claude Code / backend (API routes, DB, migrations, services)
- **CX** — Codex / Lovable (UI components, Runtime surface, client-side)
- **BOTH** — shared coordination required

---

## Parked — Post-Alpha Backlog

| Ticket | Title | Why Parked |
|--------|-------|-----------|
| P2-25 | Reward event webhook | No external consumer in Alpha |
| PA-01 | Public AgentiQ OS agent marketplace | Requires Phase 2 Agentic OS Alpha |
| PA-02 | Full multi-chain wallet integration | Requires MoneyPenny full activation |
| PA-03 | Production DVN external notarisation | External validator network not live |
| PA-04 | Revenue-grade Q¢ billing | Requires pricing strategy decision |
| PA-05 | OrgQube governance voting | Post-alpha governance model |

---

## Must-Pass Alpha Acceptance Gate

All items must be green before alpha is declared stable:

### Functional
- [ ] KNYT cartridge loads in <2 s and bridge fires `cartridge:ready`
- [ ] Know1 answers in character with treasury context in response
- [ ] Signal action triggers reward event; balance updates in <5 s
- [ ] Every material event has a DVN receipt with valid hash
- [ ] Q¢ metering active on all inference routes (no escapes)
- [ ] metaMe guardian BLOCK response confirmed (test policy → rejected inference)
- [ ] Experience capsule returns prescription for any valid stage pair
- [ ] Featured Moment + NBE card wired to live capsule prescription
- [ ] Axis step chains + action chips render correctly for all stages
- [ ] Privilege block shows correct tier/discount for each cohort

### Security
- [ ] RLS confirmed: anon and user roles cannot read other users' rows
- [ ] iframe CSP restricts frame-src to allowlist
- [ ] Bridge message origin validated on both sides
- [ ] No secrets in client-side bundle (NEXT_PUBLIC_ audit clean)
- [ ] Service role key never exposed to browser

### Performance
- [ ] `/api/codex/chat` p95 <3 s at 50 concurrent
- [ ] Capsule endpoint p95 <500 ms
- [ ] Runtime surface initial render <2 s on 4G throttle

### Data
- [ ] All 11 tables exist with RLS enabled
- [ ] Agent registry seeded (5 agents, correct KB domains)
- [ ] Bootstrap skills per agent invocable and logged
- [ ] `dvn_receipts` non-empty after any 10-event sequence

---

## Recommended First 10 Tickets to Open

1. **P0-01** — DB migration (all 11 tables) — unblocks everything
2. **P0-02** — Agent registry seed — unblocks inference routing
3. **P0-03** — Cartridge shell + bridge — unblocks all CX work
4. **P0-04** — Know1 inference + treasury context — first live agent value
5. **P0-05** — Experience capsule delivery — primary user-facing value
6. **P0-06** — Signal → reward event — closes the incentive loop
7. **P0-07** — DVN receipt issuance — required for alpha trustworthiness
8. **P0-08** — Q¢ metering — required for economic correctness
9. **P0-09** — metaMe guardian hook — required for sovereignty contract
10. **P0-10** — RLS audit — security baseline
