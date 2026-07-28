# VL-CT-001 — Constitutional Trading Venture Experiment

**Working title:** VL-CT-001 — Constitutional Trading with BitCent and Base QriptoCENT
**Status:** draft — pending operator/Aletheon ratification
**Date:** 2026-07-28
**Institutional home:** Primary — **Venture Lab**. Secondary observatory — **Invariant Research Lab (IRL)**.
**Deployment context:** Horizen Pilot and the Financial Services Runtime.
**Experiment class:** constitutional-commercial venture experiment.
**Companion document:** `2026-07-28_vl-ct-001-gap-register.md` (dependency-ordered gaps, and what is
actually built today).

---

## 0. Altitude — read this before anything else

VL-CT-001 is **not a research experiment looking for a market application**. It is a venture
experiment building a constitutional market capability that is instrumented deeply enough to become
a reusable scientific testbed.

The governing question is not *"can we establish a scientifically generalisable result about
invariant performance?"* It is:

> **Can constitutional trading be operationalised, adopted and commercialised as a viable agentic
> financial service?**

Scientific research is **enabled by** the experiment. It does not govern the experiment's pace, its
acceptance criteria, or its commercial validity.

The consequence that matters in practice: the pilot must be able to succeed on constitutional
grounds — authority control, complete receipts, attribution, bounded execution, safe refusal — **even
if P1, P2 and P3 return null**. Nothing built for the venture question is contingent on the
scientific result.

---

## 1. Purpose and institutional position

> VL-CT-001 exists to determine whether passport-backed, bounded and proof-producing agentic trading
> can be operationalised as a commercially viable financial service. The experiment will deploy
> constitutional controls around agent identity, authority, execution, receipts, attribution and
> economic accountability. It will also establish a reusable observatory through which IRL may
> conduct structural-invariant experiments without making the venture outcome dependent on
> scientific confirmation.

### The three layers

The charter deliberately separates three things that are routinely conflated.

| Layer | Question it answers | Owner |
|---|---|---|
| **1. Pilot** — execution and deployment | Can this capability be made to work across metaMe, Horizen and the Financial Services Runtime? | Horizen pilot delivery |
| **2. Venture experiment** — operationalisation and commercialisation | Can this capability become a viable product, service or market category? | **Venture Lab (centre of gravity)** |
| **3. Scientific observatory** — research enablement | What can this operating environment teach us about structural invariants? | IRL |

The dependency direction is one-way:

```
Pilot makes it operational
        ↓
Venture experiment tests adoption and commercial viability
        ↓
Scientific observatory studies structural-invariant effects
```

Not the reverse. The Venture Lab builds and proves the constitutional market system; the IRL uses
that system to study structural invariants.

**1. Pilot scope** — integration; Agent Registry discovery; operator claim; delegation; Marketa
vetting; runtime admission; MoneyPenny orchestration; DVN receipt generation; Horizen proof
correlation; Standing attribution; testnet and eventual live execution. The pilot proves technical
and operational feasibility.

**2. Venture experiment scope** — customer value; operator willingness to delegate; partner
acceptance; service composition; cost recovery; pricing; risk appetite; workflow usability; time to
value; repeat usage; commercial readiness; adoption barriers.

**3. Scientific observatory scope** — controlled access to scenarios, decisions, traces, receipts,
representations and outcomes. **It does not dictate whether the venture continues.**

---

## 2. Venture hypotheses

### H1 — Primary (constitutional-commercial)

> A constitutionally governed trading service can make externally sourced financial agents usable in
> consequential market activity by providing verifiable authority, bounded execution, complete
> receipts, attributable outcomes and economically accountable preparation.

Stated Horizen-facing: *a constitutionally governed multi-agent trading service can make externally
sourced trading agents usable in a financial runtime without requiring blind trust in the agent, its
operator or its internal reasoning.*

### H2 — Preparation economics

> The cost of market intelligence, risk analysis, orchestration, simulation, proof and verification
> can be recovered at the service, session or transaction-batch level without weakening
> constitutional controls.

**H2 cannot yet be scored.** None of the constituent quantities is computed anywhere in the platform
today. The preparation-cost model (§6) is a required pre-execution instrument, not an analysis step.

### H3 — Micro-stablecoin operating economics *(added 2026-07-28)*

> Using QriptoCENT for agent-to-agent preparation, intelligence, verification and orchestration will
> reduce the total operating cost of constitutional trading relative to using a standard stablecoin
> for the same workflow.

Stronger form:

> Micro-denominated settlement will increase the proportion of trading opportunities for which
> preparation costs can be recovered, **without** reducing proof quality, constitutional compliance
> or service availability.

H3 is specified in full in §7. It is a second commercial axis, not a supporting detail:

1. Can constitutional trading be made operational and commercially usable? *(H1)*
2. Does a micro stablecoin improve the economics of doing it? *(H3)*

> Constitutional trading tests whether agents can act safely. The micro-stablecoin experiment tests
> whether they can **afford** to do so at machine scale.

---

## 3. Initial use case — BitCent and Base QriptoCENT

The first instrument pair is **BitCent (Bc)** — QriptoCENT on the Bitcoin Runes network — and
**QriptoCENT (QCT) on Base**.

Naming is settled: *BitCent (Bc) is the name for QCT-on-Bitcoin.* A Rune name is **immutable once
etched**, so the naming must be carried into the etching parameters before any etch transaction is
broadcast. This is tracked as a blocking gap in the register (G-1).

---

## 4. Agent-service roles

The constitutional pathway for a single opportunity:

```
Market Intelligence Agent   — spread observation
        ↓
Risk Agent                  — eligibility and slippage analysis
        ↓
Verification Agent          — proof validation
        ↓
MoneyPenny                  — orchestration
        ↓
Execution Agent             — acts only if execution is authorised
        ↓
Reconciliation Agent        — final verification
```

Each arrow is an authority intersection, not a handoff of trust. MoneyPenny composes agents; it does
not widen anyone's authority. Authority is the **intersection** of what the operator delegated, what
the agent is admitted for, and what the invariant set permits.

---

## 5. Trading-invariant discovery programme

**The trading invariants are undiscovered.** The commercialisation invariants classified on
2026-07-28 concern commercialisation broadly — not authority, risk, execution or receipt constraints
for trading. This charter must **not** present any example below as a ratified invariant. They are
**candidate domains for an IDE run**, and they enter the register as `proposed` until evidence
supports them (per the hypothesis-vs-canon discipline).

**Authority** — valid operator claim; active passport; active delegation; permitted instrument;
permitted venue; permitted notional; non-redelegation; ownership freshness.

**Risk** — maximum position; maximum loss; liquidity threshold; slippage threshold; stale-price
refusal; inventory limits; no leverage or borrowing in the first phase.

**Execution** — quote validity; route eligibility; execution expiry; deterministic refusal;
order-state reconciliation; partial-fill treatment; retry and cancellation rules.

**Evidence and receipts** — DVN receipt coverage; external-proof correlation; action-time versus
ingestion-time separation; network-qualified identity; complete authority-chain resolution; Standing
eligibility.

Sequence: **discover → classify → convert into executable policy.** Not the reverse.

---

## 6. Preparation-cost model *(required pre-execution instrument)*

```
Preparation Cost
  = market intelligence cost
  + risk-analysis cost
  + orchestration cost
  + simulation cost
  + proof-generation cost
  + verification cost

Execution Cost
  = network fees + venue fees + settlement fees + realised slippage

Net Constitutional Trade Value
  = realised gross benefit − preparation cost − execution cost − risk reserve
```

The **accounting interval is an operator decision** made during cost-model design. It may be more
commercially meaningful to evaluate per opportunity, per completed trade, per trading session, per
strategy batch, per operator account, or over a fixed pilot period than per trade.

§7 extends this equation with the settlement instrument.

---

## 7. Micro-Stablecoin Operating-Economics Experiment

> VL-CT-001 will compare QriptoCENT and standard-stablecoin settlement for the preparation,
> coordination and verification services required by constitutional trading. The comparison will
> measure pricing granularity, service participation, settlement overhead, reconciliation burden,
> failed-opportunity cost and preparation-cost recovery. A micro-stablecoin outcome will be
> considered favourable **only where lower cost is achieved without weakening authority controls,
> proof completeness, DVN receipt coverage or operational reliability.**

### 7.1 What is actually being compared

Not `1 QriptoCENT transaction versus 1 standard stablecoin transaction`. The comparison is between
**two complete service economies** running the same constitutional pathway.

For agentic trading the economic burden is not only the final trade. It includes market-data
requests, quote requests, simulations, risk checks, agent consultations, proof generation,
validation, orchestration, settlement preparation, reconciliation, retries and refusals. Many of
these have individually tiny economic value. If each requires settlement in a unit designed for
larger transactions, the cost of coordination becomes disproportionate to the value of the action.

Held constant across arms: same opportunity, same market data, same agents, same delegation, same
invariant set, same execution constraints, same proof requirements, same receipt coverage.

### 7.2 Four arms

| Arm | Denomination | Pricing structure |
|---|---|---|
| **A** | standard stablecoin | bundled |
| **B** | standard stablecoin | per-service |
| **C** | QriptoCENT | bundled |
| **D** | QriptoCENT | per-service micro-pricing |

Four arms rather than two, because a two-arm design would attribute to *denomination* effects that
actually come from *pricing structure*. The 2×2 separates the denomination effect, the bundling
effect, and their interaction.

### 7.3 Six mechanisms — measured separately, never collapsed into one headline number

| # | Mechanism | Measures |
|---|---|---|
| 1 | **Pricing granularity** — can an agent charge a very small amount for a very small service without a commercially distorted price? | quoted price per service; rounding error; minimum viable charge; overpayment caused by denomination granularity |
| 2 | **Payment aggregation** — can many micro-services settle individually or in fine batches without coarse bundling? | services per settlement; batching delay; unpaid service balance; reconciliation overhead; settlement frequency |
| 3 | **Agent participation** — can lower-value specialist agents participate economically? *(directly material to the Horizen ecosystem)* | economically viable specialist calls; diversity of agents used; % of agent outputs actually compensated; minimum viable service value |
| 4 | **Failed-opportunity cost** — most opportunities are correctly rejected, and preparation is still incurred | cost per rejected opportunity; per expired opportunity; **per constitutional refusal** |
| 5 | **Cost proportionality** — does preparation cost stay proportional to opportunity size? | `preparation cost / expected gross benefit`, across trade sizes |
| 6 | **Settlement and reconciliation overhead** — the counterweight | settlement count; gas/network cost; ledger entries; receipt count; reconciliation time; failed payments; dust accumulation; accounting overhead |

Mechanism 4 may be the strongest single benefit. Mechanism 6 is the one that can invalidate the
hypothesis: **a micro stablecoin is only better if lower service cost is not offset by greater
operational complexity.**

### 7.4 Extended cost equation

```
Total Preparation Cost (TPC)
  = intelligence cost
  + risk-analysis cost
  + orchestration cost
  + simulation cost
  + proof-generation cost
  + verification cost
  + service-payment cost        ← added by this experiment
  + reconciliation cost         ← added by this experiment

Micro-Stablecoin Cost Reduction = TPC_standard − TPC_micro
Cost Reduction Rate             = (TPC_standard − TPC_micro) / TPC_standard
```

The **more venture-relevant** metric is not the cost delta but the recovery rate:

```
Preparation-Cost Recovery Rate
  = opportunities or sessions where realised value ≥ total preparation cost
  ÷ all evaluated opportunities or sessions
```

compared under both settlement models.

### 7.5 Primary experimental question

> Does QriptoCENT-based micro-settlement reduce total preparation and coordination costs for
> constitutional trading compared with a standard-stablecoin settlement model, and does that
> reduction increase the proportion of opportunities that remain economically viable **after
> constitutional controls are applied**?

### 7.6 Non-inferiority condition

The micro-stablecoin arm must **not** be judged successful merely because it is cheaper. It must be
no worse on: proof completeness; DVN receipt coverage; authority-chain integrity; refusal accuracy;
settlement reliability; reconciliation accuracy; latency; operator comprehension; audit
reconstruction.

The bar is: **lower cost with no material degradation in constitutional or operational integrity.**

### 7.7 Phased design

| Phase | What runs | Live value |
|---|---|---|
| **1 — simulated service economy** | Deterministic scenarios run twice: once priced in QriptoCENT, once in a standard stablecoin. Measure service calls, quoted/paid/rounded cost, settlement count, TPC, decision outcome, proof and receipt completeness. | none |
| **2 — live observation, shadow settlement** | Live market data; hypothetical service payments recorded. Reveals whether the cost difference survives real opportunity frequency and timing. | none |
| **3 — testnet settlement** | Real test transactions between agents. Measure latency, payment failure, reconciliation, transaction count, receipt generation, operational burden. | testnet |
| **4 — capped live-value pilot** | Only after the service economy is stable. | capped |

### 7.8 Critical caution — denomination is not the same as network cost

The charter separates, and the experiment must measure separately: **unit denomination**, **token
transfer cost**, **network fee**, **service price**, **settlement architecture**, **batching
policy**.

A micro denomination by itself does not automatically produce lower total cost. It may let a service
charge a £0.001-equivalent economically, and still be inefficient if each payment requires a
high-cost on-chain transaction. The experiment tests **the whole payment architecture, not the
nominal unit**.

The proposition under test is therefore:

> **QriptoCENT plus low-cost settlement, batching and receipt integration reduces cost.**

Not:

> ~~A smaller token unit alone reduces cost.~~

### 7.9 The payment layer stays constitutional

Every service payment must be attributable to: the requesting principal; the acting agent; the
delegated purpose; the priced service; the payment amount; the payment instrument; the resulting
evidence; the DVN receipt.

The system must be able to prove: *who requested the service, why it was permitted, what was
delivered, what was paid, and whether it contributed to an authorised trade.*

This yields a benefit beyond cheaper preparation: it tests **constitutional compensation of agents**.

### 7.10 New evidence category — the service-economy ledger

A new ledger, distinct from the DVN receipt stream and the Horizen evidence chain, recording per
service call: service type; provider agent; requesting agent; principal commitment; delegation
reference; quoted price; settled price; payment denomination; payment timestamp; settlement cost;
DVN receipt; proof reference; trade or opportunity reference; accepted/rejected/expired outcome.

Identifier discipline applies without exception: **principal commitment**, not `personaId` —
`personaPublicRef()` is the only persona identifier permitted in this ledger where it becomes
network- or chain-bound.

The ledger is the basis for both the commercial analysis and any later scientific work.

### 7.11 Venture success criteria for H3

The QriptoCENT arm is commercially promising if it produces: lower median preparation cost; lower
cost per rejected opportunity; lower minimum viable service price; more economically viable
specialist-agent calls; higher preparation-cost recovery; **no** degradation in constitutional
compliance; **no** unacceptable increase in latency or reconciliation burden.

---

## 8. Scientific observatory interface — P1, P2, P3

The venture experiment can host IRL experiments without becoming subordinate to them. These are
**secondary**, and described here as a research capability unlocked by the venture experiment — not
as a requirement for initial launch.

**P1 — reasoning.** Do structural invariants improve reasoning about trade eligibility?
Arms: market data only; prose guidance; structural invariant set; structural invariant set plus
verification. Measures: missed costs; invented assumptions; false opportunities; reasoning effort;
decision stability.

**P2 — consequences.** Do structural invariants reduce effort and error in producing acceptable
trading actions? Measures: expert effort to acceptance; critical policy violations; revision count;
invalid execution instructions; unsupported certainty; out-of-scope actions.

**P3 — representation.** Which representations of invariants, authority, market state and risk
produce the most reliable reasoning and execution?

The same constraint can be expressed many ways:

| Form | Example |
|---|---|
| Textual | *Execute only where expected spread exceeds total preparation cost, execution cost and slippage reserve.* |
| Numeric | `expectedSpreadBps > preparationCostBps + executionCostBps + slippageReserveBps` |
| Executable | `eligible = expectedSpreadBps > preparationCostBps + executionCostBps + slippageReserveBps;` |
| Constitutional | `tradeEligible = marketOpportunity ∩ activeDelegation ∩ permittedInstrument ∩ capitalLimit ∩ riskPolicy ∩ evidenceFreshness` |

Representation arms: prose only; numeric thresholds only; prose plus numeric; typed schema;
executable predicates; causal graph; compressed invariant packet; dual human-readable and
machine-executable. Measures: semantic fidelity; execution fidelity; ambiguity; latency; token
consumption; transferability between agents; audit reconstruction; refusal accuracy; representation
stability.

**P3 already has a substrate in the platform.** `services/representation/interpretations/` — the
Constitutional Representation System — carries exactly the shape P3 needs: *one concept → multiple
interpretations → selected interpretation → adopted surface → measured consequence*. It was built
for surface styling; the abstraction transfers directly. Three interpretations exist today
(`agentiqLiquidGlass`, `constitutionalCivicFuturism`, `highContrastAccessible`), which is a real head
start on machinery P3 would otherwise have to build from scratch.

H3 also generates its own P-arm questions: whether agents reason differently when costs are
represented at micro-unit granularity (P1); whether fine-grained pricing changes the quality or
acceptability of agent actions (P2); and which cost representation — whole stablecoin amounts,
decimal amounts, integer QriptoCENT units, basis points, human-readable summaries, machine-native
fixed-point — supports the most reliable judgement (P3).

---

## 9. Governance principles

Two rules, in both directions.

**Protecting the venture from the research timeline:**

> The Venture Lab may deploy, commercialise or iterate the constitutional trading capability where
> its constitutional safety, operational integrity and commercial value are established,
> **irrespective of whether nested structural-invariant experiments produce positive, null or
> inconclusive results.**

**Protecting the constitution from the research:**

> Scientific arms must **not** weaken, bypass or suspend constitutional controls in order to preserve
> experimental purity or improve apparent trading performance.

A third rule follows from the platform's epistemic-honesty discipline:

> No hypothesis in this charter — H1, H2 or H3 — enters the invariant canon as `canonical`. They are
> claims about the world that this experiment exists to test, and they remain `proposed` until the
> evidence exists. Reports must never state a `proposed` hypothesis as established fact.

### The four questions that must stay separate

| Body | Question |
|---|---|
| Venture Lab | Is constitutional trading useful, safe and commercially deployable? |
| IRL | Do structural invariants materially improve reasoning and action within that environment? |
| Horizen pilot | Can third-party registered agents be discovered, claimed, delegated, admitted, orchestrated and verified across the two systems? |
| Financial Services Runtime | Can MoneyPenny operate the service continuously under constitutional controls? |

A negative P1 result would not invalidate the constitutional trading product — the Venture Lab could
still demonstrate better authority control, complete receipts, stronger attribution, safer refusal,
lower governance risk, more reliable agent admission and clearer accountability. Conversely, a
positive structural result would not by itself prove commercial viability.

---

## 10. Success criteria

**Pilot success** — the end-to-end integration works; agents can be discovered, claimed, delegated
and admitted; MoneyPenny can compose them; consequential actions produce DVN receipts; Horizen proofs
are correlated; the Partner Workspace shows the attributable chain.

**Venture success** — operators understand and accept the delegation model; the service reduces trust
and integration burden; preparation economics are measurable; a credible path to cost recovery
exists; partners or customers express deployment intent; the service is repeatable; at least one
viable pricing or revenue model emerges.

**Scientific success** — the environment produces usable comparative data; P1/P2/P3 arms can run
without disrupting the pilot; representations, decisions and outcomes are reproducible; **null
findings remain publishable**; structural results can be separated from venture outcomes.

The north star remains sustained adoption and commercial uptake: operators claiming and delegating to
agents; agents vetted and admitted; consequential actions fully receipted; safe refusal working under
real conditions; partners accepting the evidence model; users choosing the service; recurring use;
preparation costs economically recoverable; and the service progressing toward revenue or paid
deployment.

---

## 11. Experiment sequence

1. Define the constitutional trading service
2. Define BitCent and Base QriptoCENT
3. Specify authority, risk, execution and receipt invariants *(via IDE discovery — §5)*
4. Establish Marketa vetting and operator delegation
5. Admit agents into the Financial Services Runtime
6. Have MoneyPenny orchestrate bounded test scenarios
7. Measure constitutional and commercial performance
8. Stabilise the operating environment
9. Embed P1 structural reasoning experiments
10. Embed P2 consequence experiments
11. Embed P3 representation experiments
12. Compare scientific findings **without making product validity dependent on them**

The micro-stablecoin arms (§7) run alongside steps 6–8 in their own four phases, since Phase 1 needs
only deterministic scenarios and no live value.

**Immediate delivery order** (ratified 2026-07-28): complete Slice B → draft and ratify this charter
→ attach the gap register → run trading-invariant discovery through the IDE → define the
preparation-cost model → build deterministic scenarios → begin shadow execution → embed optional
P1/P2/P3 arms. QCT-on-Runes etching proceeds in parallel where genuinely independent.

---

## 12. Risks and stop conditions

| Risk | Stop condition |
|---|---|
| Preparation economics never close | H2/H3 return no viable recovery interval at any accounting granularity after Phase 2 |
| Micro-settlement overhead dominates | Mechanism 6 measures show reconciliation/network burden exceeding the mechanism 1–5 savings across all four arms |
| Authority chain cannot be completed for real partner agents | Binding remains `unresolvable` for the pilot cohort after the operator-claim path ships |
| Receipt coverage incomplete on consequential actions | Any consequential trading action reaches execution without a DVN receipt — halt live value immediately |
| Scientific arm pressure on controls | Any proposal to relax a constitutional control for experimental purity — refuse under §9 |
| Rune naming error | An etch broadcast with a name other than the ratified BitCent naming — **irreversible**; see gap G-1 |

---

## 13. Gap register and dependency order

Maintained separately in `2026-07-28_vl-ct-001-gap-register.md`, structured by the three layers, and
kept current as slices land. The register is part of the charter pack — not a substitute for the
demonstrable object.

---

## 14. Reusable outputs

Whatever the commercial outcome, VL-CT-001 is expected to leave behind: a constitutional trading
invariant set (discovered, classified, executable); a preparation-cost model with a defined
accounting interval; a service-economy ledger schema; a four-arm settlement-economics comparison
method; an agent-binding and attribution chain reusable by any partner integration; and a research
observatory interface that IRL can drive without touching the venture's controls.

That last item is the point of the whole design: **a venture experiment instrumented deeply enough to
become a reusable scientific testbed.**
