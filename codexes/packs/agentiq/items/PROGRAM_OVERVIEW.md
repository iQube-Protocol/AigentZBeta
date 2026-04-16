# AgentiQ Program Overview
*Last updated: 2026-04-16 — canonical high-level program plan*

---

## Program Architecture: Two Phases

The program is divided into two sequential phases. Phase 1 is active and time-critical (Kickstarter campaign is live). Phase 2 begins once Phase 1 is stabilised and can be handed to a single maintenance agent.

```
Phase 1 (Active — KS live, every day counts)
  ├── AgentiQ Alpha — Foundational Capabilities + KNYT Golden Path
  └── KNYT Wheel — Campaign Operations

Phase 2 (Queued — starts after Phase 1 stabilised)
  ├── Agentic OS Alpha
  └── Venture Lab Alpha (AgentiQ KNYT)
```

---

## Phase 1

### 1.1 AgentiQ Alpha — Foundational Capabilities + KNYT Golden Path

**Mission:** Prove the complete AgentiQ flywheel — Build → Ingest → Organise → Compose → Deliver → Generate signal → Progress through PCS → Reward → Feed insight back into future supply.

**Four-Cartridge Model:**

| Cartridge | Role | Lead Aigent |
|-----------|------|-------------|
| AgentiQ OS | Public upstream build zone | Aigent C |
| AgentiQ | Proprietary platform operations | Aigent Z |
| metaMe | Personal sovereignty, Runtime, Studio | metaMe |
| KNYT | First live world, signal economy, PCS proving ground | Kn0w1 |

---

#### Build Status

**Operational (production-grade):**

| Component | Status | Notes |
|-----------|--------|-------|
| Registry pipeline | ✅ Complete | Full chain: intake → classify → validate → trust score → publish → receipt (10 services in `services/registry/`) |
| KNYT signal routes | ✅ Complete | like, spark, vote, curate, remix, react — live under `app/api/codex/knyt/living-canon/` |
| x402 / QriptoCent | ✅ Complete | 12 settlement, custody, claim, verify, finalize routes |
| Experience model | ✅ Complete | Migration deployed — `journey_states`, `nbe_plans`, `experience_strategies`, `experience_matrices` tables live |
| AgentiQ SDK | ✅ Complete | `packages/agentiq-sdk/` with A2AClient, AgentIQClient, typed messages, default personas |
| Studio Composer | ✅ Complete | Plan → Experience, Design, Workflows, Surfaces, Pipeline, Receipts tabs operational |
| Experience Matrix | ✅ Complete | Built in Studio Composer (Plan → Experience tab). Cohort AND individual views. 3,592 live. Matrix cells map directly to capsule prescriptions (e.g. Remixer × Keta → "capsule: Remix template"). Individual investors searchable and position-mapped. |
| Agent personas | ✅ Complete | aigent-z, aigent-c, aigent-kn0w1, aigent-marketa, aigent-moneypenny, aigent-nakamoto, metaMe defined with correct system prompts |
| Agent inference routing | ✅ Complete | Correct KB domains per agent — KNYT context only injected for kn0w1/marketa; platform agents (aigent-z, aigent-c) receive only their system prompt |
| SmartTriad copilot | ✅ Complete | Inference wired to `/api/codex/chat`, rendering fixed (newline preservation), sidebar navigation fixed, provider dropdown functional |
| Published card refresh | ✅ Complete | Factory listing cards update without page refresh via CustomEvent after publish |
| KNYT Runtime Surface | ⚠️ Exists, needs upgrade | Lives in KNYT Cartridge → Runtime tab. 6-block structure present: Live Runtime Surface header, Patronage Axis, PCS Axis, Featured Moment, Signal Action Tray, Reward+Progress Card, NBE Pathway Card. UI is functional but not runtime-grade — needs CSS alignment with Runtime/Studio design language and chips upgraded to platform-consistent components. |
| Experience capsule delivery | 🔴 Not built | The matrix prescription mechanism exists in Studio but is not wired to the metaMe Runtime. The path — matrix cell prescription → NBE plan → runtime chip → personalized experience surface — does not yet exist as a live delivery pipeline. This is the primary remaining engineering gap. |
| AgentQube / AigentQube | ✅ Structural | Factory intake, classification, agent card in AssetDetailPanel, copilot wiring all in place. |

---

#### Remaining Phase 1 Engineering Work (priority order)

**1. KNYT Runtime Surface CSS upgrade**
- Align all 6 surface blocks with Runtime/Studio CSS tokens (backgrounds, text hierarchy, borders, interactive states)
- Upgrade Patronage Axis and PCS Axis progress indicators to platform chip style
- Signal Action Tray buttons to match runtime chip component spec
- Reward+Progress Card and NBE Pathway Card to runtime-grade card components
- Goal: a user arriving in the KNYT cartridge Runtime tab sees a polished, brand-consistent surface

**2. Experience capsule delivery pipeline**
- API endpoint: given a `userId` and their current `journey_state` (patronage_stage × pcs_stage), query the experience matrix and return the prescribed capsule with content, actions, and next-best-step
- Runtime chip component: renders the prescribed experience as an interactive chip/capsule in the metaMe Runtime
- Wire to KNYT Runtime Surface: Featured Moment block and NBE Pathway Card pull from the live prescription for the authenticated user
- Goal: each investor/user sees a personalized experience surface driven by their actual matrix position, not generic placeholder content

**3. Marketa runtime verification**
- Confirm Marketa is accessing KNYT Wheel KB content correctly via her copilot
- Test her responses against live campaign scenarios (investor tier queries, KS path, offer comparison)

**4. In-product campaign entry points**
- Runtime tasks, signal prompts, and KS path prompts referenced in the KNYT Wheel launch runbook
- Depend on the runtime surface upgrade (#1) being complete

---

### 1.2 KNYT Wheel — Campaign Operations

**Mission:** Reactivate Metaiye Media investor base, convert into Kickstarter momentum, prove the KNYT loop (email → SMS → Runtime → KNYT → Tasks → Rewards → Social → PCS) in live conditions.

**Status:**

| Item | Status | Notes |
|------|--------|-------|
| KS campaign | ✅ Live | Campaign launched and running |
| Investor emails | ✅ Sent | Emails sent to top_knyt_shelf and zero_knyt cohorts from the system |
| CRM | ✅ Ready to canonize | Cleaned, deduped, extensively tested. Ready to be canonized as a first-grade DataQube for the KNYT cartridge |
| Experience model + matrix | ✅ Complete | Cohort and individual mapping done. Journey states defined for each investor and prospect. Individual experience journeys plotted. |
| Nakamoto CRM integration | ✅ Complete | CRM database extended with state-change signals — signals fire as users carry out activities that advance their journey state |
| Investor segmentation | ✅ Complete | 6 cohorts (A–F) + priority overlay `cohort_zero_knyt_legacy_1000_plus` (190+ investors with $1,000+ historical investment) |
| Offer architecture | ✅ Defined | Top KNYT Shelf ($288, 21 available), Zero KNYT tier (21 available). Investor privilege tiers: Keta 10%, Keji 15%, First 20%, Zero 25%. |
| Campaign copy | ✅ Complete | 19 operator docs in KNYT Wheel collection (indexed in Marketa KB) |
| Partner activation | 🔴 Not started | **18 partners total.** **Wave 1 / Cohort 1 (16):** Autonomys → Fio Protocol → ChainGPT → Lamina1 → LayerZero → Project Liberty → CryptoMondays/DAIA → PAL Capital → Distro → NEAR → Polygon → Secret Network → Decentralized Media → Horizen → Bitcoin Harlem → PubKey. **Wave 2 / Cohort 2 (2):** Comic Republic → World Class Scholars |
| In-product runtime prompts | ✅ Complete | Campaign entry points live in Runtime Surface (investor tier chips, KS path CTAs, backed confirmation) |
| Marketa full activation | ✅ Complete | Persona wired, inference correct, 19 KNYT Wheel KB docs indexed and searchable |

**The KNYT Loop (campaign activation path):**
```
Email/SMS → Qriptopian Cartridge → KNYT Cartridge → Tasks & Rewards → Runtime → Social → PCS/Order of Metaiye Ladder
```

---

## Phase 2 (Queued)

### 2.1 Agentic OS Alpha

**Status: Documented and packaged, build not started.**

Documentation layer complete (`docs/agentiq-os/` — README, quickstart, contribution categories, packaging standards, submission guide). OS tab in AgentiQ cartridge. SDK (`packages/agentiq-sdk/`) shipped.

**What needs to be built:** Public-facing agent discovery interface, capability/trust/pricing browse surface, agent submission flow. Currently a documentation-only experience.

**Prerequisite for starting:** Phase 1 stable and handed to maintenance mode.

---

### 2.2 Venture Lab Alpha (AgentiQ KNYT)

**Status: Fully specified (20 docs, 01–20 in `docs/alpha/agentiq-knyt/`), build not started.**

Specifications complete for: platform thesis, reference agent trio (Aigent Z, Marketa, Kn0w1), stack architecture (metaMe → AgentiQ OS → AgentiQ → Qc+iQubes → DVN), first cartridge pair (KNYT + Qriptopian), Kn0w1-first KNYT Alpha MVP workback, dev PRD.

**Build epics (when started):**
- Kn0w1-first KNYT Alpha cartridge shell in metaMe Runtime
- Curated internal skill layer
- Treasury/rewards MVP
- Qc event layer
- DVN receipt layer
- metaMe alpha controls
- Qriptopian support route
- AgentQube/SkillQube backend
- Policy evaluation abstraction

**Prerequisite for starting:** Phase 1 stable, KNYT Runtime Surface runtime-grade (Phase 1 engineering #1), experience capsule delivery pipeline live (Phase 1 engineering #2).

---

## Phase 1 Critical Path

The sequencing that unlocks everything:

```
1. KNYT Runtime Surface CSS upgrade ✅ DONE
   → 21 Sats design language, axis step chains, icon chips, capsule wrappers

2. Experience capsule delivery pipeline ✅ DONE
   → POST /api/experience/capsule live
   → Featured Moment + Next Best Step wired to live matrix prescription

3. In-product campaign entry points ✅ DONE
   → Investor tier chips in Signal Action Tray
   → KS path CTAs and privilege block in NBE card
   → Backed confirmation badge in header

4. Marketa full activation ✅ DONE
   → Inference correct, 19 KNYT Wheel KB docs indexed

5. Partner activation sequence — ACTIVE
   → Wave 1 / Cohort 1: 16 partners (Autonomys first)
   → Wave 2 / Cohort 2: Comic Republic, World Class Scholars

6. CRM DataQube canonization ✅ DONE
   → dataqube-knyt-crm registered in registry_assets (L4_PRODUCTION_APPROVED)
   → DataQube manifest: codexes/packs/knyt/dataqube.json
   → DataQube type added to RegistryAssetClass + RegistryAsset union
   → Autodrive push: node scripts/sync-codex-to-autodrive.js --pack knyt
```

---

## Key Economic Distinctions (must not be conflated)

| Token | Purpose |
|-------|---------|
| **Q¢ (QriptoCent)** | Base platform rail for pricing, settlement, metering, and operational logic across the entire ecosystem |
| **$KNYT** | KNYT cartridge-contained economy — participation rewards, contribution rewards, local treasury, PCS economics experimentation |

Q¢ helps KNYT operate. $KNYT helps KNYT express and reward native value.

---

## Agent Role Map

| Agent | Primary Role | KB / Cartridge |
|-------|-------------|----------------|
| **Aigent Z** | System orchestrator, engineering intelligence | AgentiQ cartridge (engineering codex) |
| **Aigent C** | Customer guide, NBE execution, user orientation | AgentiQ cartridge (customer PoV) |
| **Aigent Kn0w1** | KNYT world guide, treasury/rewards, mythos-to-action | KNYT cartridge |
| **Aigent Marketa** | Campaign, marketing, investor activation | KNYT Wheel (KNYT cartridge) + Marketa cartridge |
| **metaMe** | Personal sovereignty, data identity, guardian | metaMe cartridge |
| **Aigent MoneyPenny** | Financial ops, multi-chain, DeFi | Qriptopian cartridge |
| **Aigent Nakamoto** | Bitcoin, COYN ecosystem, risk | Qriptopian cartridge |

---

*This document is the canonical high-level program plan. For detailed specs see:*
- *Alpha program: `ALPHA_PROGRAM_OVERVIEW.md`, `ALPHA_BUILD_PLAN.md`*
- *KNYT campaign: KNYT Wheel collection in KNYT cartridge (15 operator docs)*
- *Venture Lab: `docs/alpha/agentiq-knyt/` docs 01–20*
- *AgentiQ KNYT bridge: `AGENTIQ_KNYT.md`*
