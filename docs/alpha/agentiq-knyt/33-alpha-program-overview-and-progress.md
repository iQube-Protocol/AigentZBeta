# α Program — Overview & Progress Report
*Canonical program status — last updated 2026-04-16*

---

## Four Workstreams. One Programme.

The AgentiQ build programme runs across four parallel workstreams. They are not separate projects — they are layers of the same system, each feeding the next.

```
AgentiQ Alpha ──────────────────────────────────────────────► COMPLETE
  The platform foundation. Registry, Runtime, Studio, signal routes,
  agent layer, SDK, experience model, capsule delivery. Ships everything
  the other three workstreams depend on.

KNYT Wheel ─────────────────────────────────────────────────► ACTIVE
  Live campaign operations. KS launch, investor email sequences,
  cohort management, Marketa activation. Runs on top of AgentiQ Alpha.
  The first real-world proof of the platform flywheel.

Relationship Builder α ──────────────────────────────────────► MVP IN PROGRESS
  Partner + customer activation surface. Manages the 18-partner
  outreach pipeline and the 3,748-person investor + backer CRM from
  a single operator surface. Runs on top of KNYT Wheel data and
  AgentiQ Alpha infrastructure (Mailjet, Marketa, Experience Matrix).

Venture Lab α ───────────────────────────────────────────────► QUEUED
  Next-phase build: live metaMe / AgentiQ / AgentiQ OS engine.
  Reference agent trio, KNYT + Qriptopian cartridge pair, Kn0w1-first
  KNYT Alpha launch, treasury/rewards MVP. Starts once Relationship
  Builder α is stable and the campaign has ignition signal.
```

---

## How They Correlate

```
                    ┌─────────────────────────────┐
                    │       AgentiQ Alpha          │
                    │  Registry · Runtime · Studio │
                    │  SDK · Signal Routes · CRM   │
                    │  Experience Matrix · Capsule │
                    └──────────────┬──────────────┘
                                   │ Platform foundation
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐
   │   KNYT Wheel     │  │ Relationship     │  │   Venture Lab α    │
   │                  │  │ Builder α        │  │                    │
   │ KS campaign live │  │ Partner BD +     │  │ Engine build —     │
   │ Investor cohorts │  │ Customer CRM +   │  │ metaMe / AgentiQ   │
   │ Email sequences  │  │ Email Composer   │  │ OS / KNYT cartridge│
   │ Marketa KB       │  │ Marketa-led      │  │ treasury / rewards │
   └──────────────────┘  └──────────────────┘  └────────────────────┘
          │                       │                       ▲
          │  Campaign data         │  Activation signals   │
          └───────────────────────┴───────────────────────┘
                    Feeds Venture Lab pipeline
```

**Key dependency chain:**
- KNYT Wheel runs on AgentiQ Alpha's Mailjet adapter, Marketa inference, and Experience Matrix
- Relationship Builder α reads KNYT Wheel's CRM data and cohort signals, routes communications via Marketa and the same Mailjet adapter
- Venture Lab α build starts when the campaign has ignition signal — Relationship Builder α is the surface that surfaces those signals (First/Zero patronage stage holders, recruiters, pipeline candidates)

---

## Workstream 1 — AgentiQ Alpha
*Foundational platform build*

**Status: ✅ COMPLETE — 2026-04-16**

| Component | Status |
|-----------|--------|
| Registry pipeline | ✅ Complete — full chain: intake → classify → validate → trust score → publish → receipt |
| KNYT signal routes | ✅ Complete — like, spark, vote, curate, remix, react live |
| x402 / QriptoCent | ✅ Complete — 12 settlement, custody, claim, verify, finalize routes |
| Experience model | ✅ Complete — `journey_states`, `nbe_plans`, `experience_matrices` deployed |
| AgentiQ SDK | ✅ Complete — A2AClient, AgentIQClient, typed messages, default personas |
| Studio Composer | ✅ Complete — Plan → Experience, Design, Workflows, Surfaces, Pipeline, Receipts |
| Experience Matrix | ✅ Complete — 3,592 live entries, cohort + individual views, matrix cell prescriptions |
| Agent personas | ✅ Complete — aigent-z, aigent-c, kn0w1, marketa, moneypenny, nakamoto, metaMe |
| Agent inference routing | ✅ Complete — correct KB domains per agent |
| SmartTriad copilot | ✅ Complete — inference wired, rendering fixed, navigation fixed |
| KNYT Runtime Surface | ✅ Complete — 21 Sats design language, axis step chains, icon chips, capsule wrappers |
| Experience capsule delivery | ✅ Complete — POST /api/experience/capsule live, Featured Moment + NBE wired |
| In-product campaign entry points | ✅ Complete — investor tier chips, KS path CTAs, backed confirmation |
| CRM DataQube canonization | ✅ Complete — dataqube-knyt-crm registered L4_PRODUCTION_APPROVED, on Autonomys mainnet |

**Nothing remains on the AgentiQ Alpha engineering list.** The platform foundation is shipped.

---

## Workstream 2 — KNYT Wheel
*Live campaign operations*

**Status: 🟡 ACTIVE — KS campaign live**

| Item | Status |
|------|--------|
| KS campaign | ✅ Live |
| Investor emails | ✅ Sent — top_knyt_shelf and zero_knyt cohorts reached |
| Investor segmentation | ✅ Complete — 7 cohorts (A–F + Zero KNYT legacy 1000+) |
| Experience model + matrix | ✅ Complete — 3,592 entries, individual + cohort views |
| Nakamoto CRM integration | ✅ Complete — state-change signals live |
| Offer architecture | ✅ Defined — Top KNYT Shelf ($288, 21 available), Zero KNYT (21 available) |
| Campaign copy | ✅ Complete — 19 operator docs indexed in Marketa KB |
| In-product runtime prompts | ✅ Complete — entry points live in Runtime Surface |
| Marketa full activation | ✅ Complete — inference correct, 19 KNYT Wheel KB docs indexed |
| Partner activation | 🔴 Not started — 18 partners (Wave 1: 16, Wave 2: 2); managed via Relationship Builder α |

**Active gap:** Partner outreach. All investor-facing work is done; partner activation is the remaining campaign operations task and is the primary Relationship Builder α execution item.

---

## Workstream 3 — Relationship Builder α
*Partner + customer activation surface*

**Status: 🔵 MVP IN PROGRESS**

The Relationship Builder is the operator surface for executing partner outreach and managing the investor/backer CRM across the live campaign and beyond.

| Layer | Status |
|-------|--------|
| Docs (24–32) | ✅ Complete — 9 docs wired into Venture Lab α cartridge |
| Cartridge tab | ✅ Wired — Relationship Builder α tab live in Venture Lab α |
| Phase 0: DB tables + seed data | ⏳ Pending — `avl_partner_contacts`, `avl_comms_packs` migration + 18 partner seed |
| Phase 0: KS backer import | ⏳ Pending — ~2,000 backer records → `ks_backers` cohort |
| Phase 1: Partners + Customers UI | ⏳ Pending — list views, detail views, status updates |
| Phase 2: Composer + Marketa send | ⏳ Pending — email authoring and dispatch |
| Phase 3: Reports | ⏳ Pending — Mailjet signal by cohort, partner response, ladder movement |

**Immediate next actions:**
1. Supabase migration — `avl_partner_contacts` + `avl_comms_packs` + seed data
2. KS backer list import + hygiene gate
3. Email sequence copy for KS Backers funnel (5 emails, metaKnyt / Agentic Graphic Novel terminology)
4. Lovable build — Partners + Customers panels (Phase 1)

**Styling contract:** Registry dark-mode treatment (slate-950 base, white/5 borders) for operator panels; Runtime light-mode for customer-facing read views.

---

## Workstream 4 — Venture Lab α
*Next-phase engine build*

**Status: ⚪ QUEUED — full spec complete, build not started**

23-doc planning corpus complete. Build starts when:
- KNYT campaign has ignition signal (partner activation fired, backers converting)
- Relationship Builder α Phase 1 stable (operator can manage pipeline)

| Epic | Status |
|------|--------|
| Kn0w1-first KNYT Alpha cartridge shell | ⏳ Queued |
| Curated internal skill layer | ⏳ Queued |
| Treasury / rewards MVP | ⏳ Queued |
| Qc event layer | ⏳ Queued |
| DVN receipt layer | ⏳ Queued |
| metaMe alpha controls | ⏳ Queued |
| Qriptopian support route | ⏳ Queued |
| AgentQube / SkillQube backend | ⏳ Queued |
| Policy evaluation abstraction | ⏳ Queued |

**Full spec:** docs 01–23 in this cartridge (Venture Lab α tab).

---

## Programme Critical Path

```
✅  AgentiQ Alpha complete
✅  KNYT Wheel operational (all except partner activation)
✅  Relationship Builder α docs + cartridge tab wired
⏳  Phase 0: DB migration + partner seed + KS backer import
⏳  KS Backer email funnel copy written
⏳  Partner Wave 1 outreach launched (16 partners)
⏳  Relationship Builder α Phase 1 UI live
⏳  KS Backer cohort activated via email funnel
⏳  Partner Wave 1 ignition signal (≥3 partners at responded+)
⏳  Partner Wave 2 activated (Comic Republic + World Class Scholars)
⏳  Campaign has momentum signal → Venture Lab α build starts
```

---

## Key Economic Distinctions

| Token | Purpose |
|-------|---------|
| **Q¢ (QriptoCent)** | Base platform rail — pricing, settlement, metering across the ecosystem |
| **$KNYT** | KNYT cartridge-contained economy — participation rewards, contribution rewards, local treasury, PCS economics |

Q¢ helps KNYT operate. $KNYT helps KNYT express and reward native value.

---

## Agent Role Map

| Agent | Primary Role | Active In |
|-------|-------------|-----------|
| **Aigent Z** | System orchestrator, engineering intelligence | AgentiQ Alpha · Venture Lab α |
| **Aigent C** | Customer guide, NBE execution, user orientation | All cartridges |
| **Aigent Kn0w1** | KNYT world guide, treasury/rewards, mythos-to-action | KNYT cartridge |
| **Aigent Marketa** | Campaign, marketing, investor + partner activation | KNYT Wheel · Relationship Builder α |
| **metaMe** | Personal sovereignty, data identity, guardian | metaMe cartridge |
| **Aigent MoneyPenny** | Financial ops, multi-chain, DeFi | Qriptopian cartridge |
| **Aigent Nakamoto** | Bitcoin, COYN ecosystem, risk | Qriptopian cartridge |
