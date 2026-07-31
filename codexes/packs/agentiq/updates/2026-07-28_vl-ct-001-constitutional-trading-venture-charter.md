# VL-CT-001 — Constitutional Trading Venture Experiment

**Working title:** VL-CT-001 — Constitutional Trading with Base Q¢
**Status:** rulings R-1 through R-9 ratified 2026-07-28; charter otherwise draft
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

## 2. The three venture hypotheses

VL-CT-001 rests on three connected hypotheses. They are ordered by dependency, not by importance —
the third is arguably the most consequential, and it is the one that turns QriptoCENT from a cheaper
payment unit into a constitutional market mechanism.

### H1 — Constitutional operability

> Passport-backed, bounded and proof-producing agents can conduct trading activity in a
> constitutionally attributable and commercially usable manner — making externally sourced financial
> agents usable in consequential market activity through verifiable authority, bounded execution,
> complete receipts, attributable outcomes and economically accountable preparation.

Stated Horizen-facing: *a constitutionally governed multi-agent trading service can make externally
sourced trading agents usable in a financial runtime without requiring blind trust in the agent, its
operator or its internal reasoning.*

### H2 — Micro-stablecoin efficiency

> QriptoCENT micro-settlement reduces the cost and improves the granularity of intelligence, risk,
> orchestration, verification and reconciliation services relative to standard-stablecoin settlement.

Stronger form:

> Micro-denominated settlement will increase the proportion of trading opportunities for which
> preparation costs can be recovered, **without** reducing proof quality, constitutional compliance
> or service availability.

Specified in full in §7.

### H3 — Constitutional neutrality and access

> Outcome-independent micro-compensation reduces execution bias, increases constitutional
> completeness, and expands access to high-quality trading assessment for small or otherwise
> commercially marginal opportunities.

Stated as a behavioural claim:

> When intelligence, risk, verification and reconciliation agents are compensated for performing
> their authorised roles rather than only for completed trades, they are more likely to assess all
> eligible opportunities faithfully — including small, rejected and non-executed opportunities.

Specified in full in §8.

### The three legs in one line each

| | Question |
|---|---|
| **H1 — Constitutional trading** | Can agents trade **safely** and accountably? |
| **H2 — Micro-stablecoin economics** | Can they **afford** to do so at machine scale? |
| **H3 — Preparation neutrality** | Does the payment model make complete, unbiased assessment available **across trade sizes and outcomes**? |

> VL-CT-001 tests whether constitutional trading can be made operational, economically viable and
> non-discriminatory by using micro-denominated, outcome-independent compensation for every verified
> agent contribution.

### Preparation-cost recovery — the measurement all three depend on

> The cost of market intelligence, risk analysis, orchestration, simulation, proof and verification
> can be recovered at the service, session or transaction-batch level without weakening
> constitutional controls.

This is not a fourth hypothesis; it is the **measurement apparatus** H2 and H3 are both scored
through, and it **cannot yet be computed at all**. None of the constituent quantities exists anywhere
in the platform today. The preparation-cost model (§6) is therefore a required pre-execution
instrument, not an analysis step performed on results.

> **Numbering note.** An earlier draft of this charter numbered these H1 (constitutional-commercial),
> H2 (preparation economics), H3 (micro-stablecoin). The numbering above supersedes it: preparation
> economics is measurement rather than hypothesis, and the neutrality leg takes H3. Any reference to
> "H3" predating 2026-07-28 means the micro-stablecoin hypothesis, now H2.

---

## 3. Initial use case and the denomination canon (R-1 + correction)

### The class and its implementations

| Level | Name | Symbol | Role |
|---|---|---|---|
| **Class** | QriptoCENT | **Q¢** | the micro-denominated unit as a class |
| **Base implementation** | **Base Q¢** | Q¢ | **the instrument used in this experiment** |
| **Bitcoin implementation** | **BitCent** | **B¢** | Bitcoin-native; **not** used in this experiment |

```text
QriptoCENT / Q¢
        ↓ special version
BitCent / B¢
```

`Bc` is the ASCII fallback for BitCent, acceptable only where `¢` cannot be represented reliably.
"Bitcoin Q¢" is the explanatory long form. `Q¢` remains the **class** symbol and must never be used
as BitCent's primary display symbol.

Canonical presentation: `BitCent` · `B¢` · `10 B¢` · `BitCent (a Bitcoin QriptoCENT)`.

### The instrument for VL-CT-001 is Base Q¢, not BitCent

> **Base Q¢ is the Base-network experimental implementation of the QriptoCENT class. BitCent/B¢ is
> the Bitcoin-specific implementation and is not the instrument used in the Base comparison.**

This is the controlled-comparison requirement, not a preference. Both sides of the experiment must
run on **one network, through one x402 pathway, one wallet framework, one custody model and one
receipt path**, so that denomination is the only thing that varies. Comparing BitCent against USDC
on Base would confound denomination with **network and settlement architecture** — the experiment
would measure Bitcoin-versus-Base and report it as micro-versus-standard.

BitCent belongs to a later cross-network or Bitcoin-native experiment, where the network difference
is the subject rather than a confound.

### Rune etching (separate track, irreversible)

The BitCent Rune etch is **parallel work, not part of VL-CT-001's critical path**. Its name is
immutable once broadcast and must be:

```text
BITCENT
```

subject to final deployment validation. **Never `QRIPTOCENT`** — that names the class rather than
the Bitcoin-specific version.

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

### Accounting interval — RULED (R-3)

> **The canonical accounting unit is the OPPORTUNITY** — not the trade, and not merely a daily
> aggregate. Every evaluated opportunity receives its own preparation-cost record, **including
> opportunities that are refused or never execute.**

Each record carries: opportunity creation time; participating agents; discovery effort; analysis
effort; verification effort; compliance or risk work; execution preparation; refusal or completion
outcome; compute and token use; elapsed human and agent time; associated receipts and payments.

Aggregation runs at three levels, each with a different consumer:

```text
per opportunity  →  per experimental run  →  reporting period
```

| Level | Used for |
|---|---|
| per opportunity | scientific comparison |
| per deterministic run or batch | experimental reconciliation |
| daily and weekly | venture operations |

**Why the unit is the opportunity.** Any trade-keyed or day-aggregated unit **hides the cost of
rejected opportunities inside executed-trade totals** — which is exactly the population H3 exists to
measure. A cost model that cannot see refusals cannot score the neutrality hypothesis, and the
failure is silent: every figure computes, on the wrong denominator.

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

**The comparator (R-4).** The standard-stablecoin side is **USDC on Base**, described precisely as:
*standard USDC settlement on Base using the same x402 and receipt pathway as the Base Q¢ arm.* The
comparison holds constant the **network, transaction path, custody model, wallet framework, service
scenario, receipt requirements and settlement-finality assumptions** — only the denomination and the
experimental mechanism vary. Comparing against a stablecoin on a different network is prohibited: it
would confound denomination with chain economics.

### 7.2 Four arms

| Cell | Denomination | Pricing structure |
|---|---|---|
| `USDC-BUNDLED-*` | USDC on Base | bundled |
| `USDC-SERVICE-*` | USDC on Base | per-service |
| `BASEQC-BUNDLED-*` | Base Q¢ | bundled |
| `BASEQC-SERVICE-*` | Base Q¢ | per-service micro-pricing |

Two levels rather than one, because a single-axis design would attribute to *denomination* effects
that actually come from *pricing structure*.

**Bare arm letters are prohibited (R-7).** `A`, `B`, `C`, `D` must not appear in records, reports or
filenames — the H2 and H3 designs are different axes and the letters collided. Cell identifiers are
**derived from configuration**, and the third segment (`-EXEC` / `-COMPLETE`) comes from §8.6. The
eight canonical identifiers are listed in §8.6; H2 is an analytical **view** over that dataset, not a
separate run.

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

Micro-Stablecoin Cost Reduction = TPC_USDC − TPC_BaseQ¢
Cost Reduction Rate             = (TPC_USDC − TPC_BaseQ¢) / TPC_USDC
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
| **1 — simulated service economy** | Deterministic scenarios replayed across the eight cells (§8.6). Measure service calls, quoted/paid/rounded cost, settlement count, TPC, decision outcome, proof and receipt completeness. Uses a **frozen, documented Base fee profile** derived from a defined observation window — never an unusually cheap or congested block (R-4). | none |
| **2 — live observation, shadow settlement** | Live market data; hypothetical service payments recorded. Reveals whether the cost difference survives real opportunity frequency and timing. | none |
| **3 — testnet settlement** | Real test transactions between agents. Measure latency, payment failure, reconciliation, transaction count, receipt generation, operational burden. Records the **actual Base fee paid per transaction alongside the frozen benchmark** (R-4). Instrument may be an explicitly-labelled **non-canonical** test deployment (R-5). | testnet |
| **4 — capped live-value pilot** | Only after the service economy is stable. **Requires canonical ratification of the instrument** — Phase 4 must not represent a non-canonical deployment as canonical (R-5). | capped |

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

**Anchoring — two levels (R-6).** The ledger **is** DVN-anchored, but an expensive chain anchor is
not required for every internal accounting line.

| Level | What | How |
|---|---|---|
| **Consequential event receipts** | service-obligation creation; correct refusal; compensation entitlement; settlement; reversal; dispute; reconciliation adjustment | an **individual DVN receipt** each |
| **Ledger checkpoint anchoring** | ordinary accounting entries | batched into a deterministic **checkpoint or Merkle commitment**, anchored through the DVN pipeline |

T0/T2 separation applies in full: raw commercial and personal data stay T2; externally visible
receipts carry commitments and safe references; **amounts may be committed rather than publicly
disclosed**; and the underlying ledger stays independently reconcilable.

> **The ledger must not become a second receipt system.** It is an accounting *view composed from
> receipted events* — not a parallel source of truth. A ledger that can assert something the receipt
> stream cannot corroborate has forked the record.

The ledger is the basis for both the commercial analysis and any later scientific work.

### 7.11 Venture success criteria for H2

The QriptoCENT arm is commercially promising if it produces: lower median preparation cost; lower
cost per rejected opportunity; lower minimum viable service price; more economically viable
specialist-agent calls; higher preparation-cost recovery; **no** degradation in constitutional
compliance; **no** unacceptable increase in latency or reconciliation burden.

---

## 8. Constitutional Preparation Neutrality (H3)

> VL-CT-001 will test whether micro-denominated, service-level compensation reduces the dependence of
> agent remuneration on trade execution. The experiment will compare whether market-intelligence,
> risk, orchestration, execution and verification agents perform constitutionally complete
> assessments more consistently when they are compensated for verified role completion rather than
> only for settled transactions.
>
> The experiment will measure whether this model reduces exclusion of small, uncertain or ultimately
> rejected trades; improves refusal quality; increases constitutional coverage across trade sizes;
> and expands access to agentic trading services without weakening authority, evidence or settlement
> integrity.
>
> **A constitutionally justified refusal will be treated as a completed and compensable service.**

### 8.1 The problem this addresses

In a conventional commission-led model, participants are paid only when a transaction executes. That
creates a structural bias towards executable trades over non-executable ones; larger trades over
smaller; high-value clients over low-value; fast conclusions over thorough assessment; **positive
recommendations over refusals**; and settlement activity over constitutional completeness.

A market-intelligence, risk, verification or reconciliation agent may expend real effort on a trade
that is ultimately rejected. Where compensation depends on execution, those agents are economically
exposed **precisely when they perform their roles properly** and conclude *do not trade*.

The perverse incentive is exact: the most constitutionally valuable outcome may be a well-evidenced
refusal, while the prevailing economic model rewards only execution.

### 8.2 Constitutional completeness — a stronger standard than compliance

"Compliance" can mean the system obeyed minimum rules. The standard here is stronger:

> **Constitutional completeness** means every required role, check, proof, receipt and refusal
> condition is fulfilled **regardless of whether the trade executes**.

A constitutionally complete assessment may end in execution, refusal, expiry, deferral, a request for
more evidence, or route substitution. It is complete because the **process was correctly performed**,
not because a trade happened.

### 8.3 The neutrality mechanism

```
Each required agent service
        ↓
is separately recognised
        ↓
is compensated at micro-value
        ↓
whether or not execution follows
        ↓
therefore agents are not economically dependent on trade completion
```

This targets what the charter names **execution-contingent bias**. Under it:

| Agent | Compensated for |
|---|---|
| Market Intelligence Agent | valid observation and analysis |
| Risk Agent | a correct eligibility decision, **including refusal** |
| Execution Agent | valid execution work — but only where execution is authorised |
| Verification / Reconciliation Agent | proving and reconciling the outcome, **including non-execution** |
| MoneyPenny | orchestration, independently of the outcome |

**The constitutional economic principle:**

> Agents are compensated for **faithful performance of their delegated role**, not for producing a
> preferred commercial outcome.

A risk agent must not be paid more for approving a trade. A market-intelligence agent must not be
paid only when its signal leads to execution. A verification agent must not depend on the economic
success of the trade it verifies. This is the trading analogue of constitutional commerce.

### 8.4 Trading discrimination — defined

> **Trading discrimination** is systematic exclusion from assessment because an opportunity is
> perceived as too small, too uncertain or too unlikely to execute to justify the preparation cost.

Potentially excluded: small-notional trades; low-income or low-balance users; infrequent traders;
less liquid pairs; emerging markets; high-refusal-probability scenarios; complex trades requiring
several checks; users whose transactions generate little commission; constitutionally cautious
operators.

The hypothesis is that micro-compensation reduces this exclusion because **the preparatory service is
itself economically viable** — the agent need not assume that execution will subsidise its analysis.

### 8.5 The democratic-access claim

> Micro-settlement may **democratise** constitutional trading by making high-quality preparation,
> risk assessment and verification economically available for opportunities too small to support
> conventional commission-based service models.

The access mechanism is not simply smaller trade size. It is: smaller minimum service charges;
compensation for rejected opportunities; lower dependence on commission; economic viability for
specialist agents; less pressure to bundle services into expensive packages; reduced exclusion of
low-value trades; and more consistent application of constitutional checks.

### 8.6 Compensation regimes and the ratified factorial (R-7)

Two compensation regimes:

- **Execution-contingent.** Agents are compensated primarily or entirely when a trade executes.
- **Constitutional-completion-contingent.** Agents are compensated for completing their authorised
  service, whether the result is execution, refusal, expiry or deferral. (The ruled name; earlier
  drafts said "service-complete", which understated that the trigger is *constitutional* completion
  of the delegated role, not merely delivery of an output.)

**The complete 2×2×2 factorial is approved for Phase 1.** Run all eight cells.

```text
Denomination                    Pricing structure    Compensation contingency
- USDC                          - bundled            - execution-contingent
- Base Q¢                       - per-service        - constitutional-completion-contingent
```

**Bare `A`/`B`/`C`/`D` are prohibited** in records, reports and filenames. Cell identifiers are
derived from configuration:

```text
USDC-BUNDLED-EXEC
USDC-BUNDLED-COMPLETE
USDC-SERVICE-EXEC
USDC-SERVICE-COMPLETE
BASEQC-BUNDLED-EXEC
BASEQC-BUNDLED-COMPLETE
BASEQC-SERVICE-EXEC
BASEQC-SERVICE-COMPLETE
```

H2 and H3 remain **named analytical views** over this one dataset — H2 reads the denomination ×
pricing plane, H3 reads the denomination × contingency plane. There is one experiment and one set of
runs; there are not two experiments.

Held constant across cells: opportunities, agents, market conditions, constitutional invariants,
authority limits, proof requirements — and, per R-4, network, transaction path, custody model, wallet
framework and receipt requirements.

#### Why three axes rather than two

H2's axis is **pricing structure**: *how work is priced.* H3's axis is **compensation contingency**:
*whether payment survives a refusal.* These are orthogonal — one can price per service and still bill
only on execution. Two 2×2s sharing the denomination axis are two slices of one cube, and the slices
cannot see the cell where the axes interact.

**The key interaction to test:**

> Whether per-service pricing **without** outcome-independent compensation reproduces execution bias
> at a finer level of granularity.

That is `*-SERVICE-EXEC` against `*-SERVICE-COMPLETE`. If per-service pricing alone reproduces the
`COMPLETE` advantage, the finding is a **pricing** result and must be reported as one — not as
evidence for neutrality. Neither four-cell slice can distinguish those two stories.

Phase 1 is deterministic simulation with no live value: the eight cells are one scenario set replayed
under configuration, so the marginal cost over four cells is close to zero. Later phases may collapse
to whichever cells Phase 1 shows to be informative.

### 8.7 What is measured

**Assessment coverage** — % of eligible opportunities receiving full review; % of small trades
receiving the same checks as larger trades; % of rejected opportunities receiving complete evidence;
% abandoned before risk review; % excluded because preparation cost exceeds expected value.

**Constitutional completeness** — for each opportunity, score whether it received: market assessment;
authority verification; risk review; execution-eligibility decision; proof or evidence record; DVN
receipt; reconciliation or closure status.

```
Constitutional Completeness Rate
  = fully completed constitutional assessments
  ÷ all eligible opportunities presented        ← including non-executed opportunities
```

**Execution bias** — approval rate; recommendation-to-execute rate; review depth; refusal rate;
false-positive rate; omission of costly checks; time spent on rejected opportunities; prioritisation
by trade notional. The question: *does execution-contingent compensation make agents more likely to
favour trades that produce fees?*

**Trade exclusion** — minimum trade size receiving full assessment; review coverage by notional band;
review coverage by expected profitability; exclusion rate for low-value, high-complexity and
low-probability opportunities.

**Agent-role fidelity** — each agent scored on whether it fulfilled its delegated role independently
of execution outcome. Did the risk agent perform the full assessment and refuse where required? Did
the market agent report uncertainty honestly? Did the verifier reconcile a failed or expired trade?
Did MoneyPenny preserve all required steps despite low expected revenue?

**New headline metrics:**

```
Neutral Assessment Rate
  = opportunities receiving complete assessment without execution-contingent compensation
  ÷ all eligible opportunities

Trade Exclusion Reduction
  = exclusion rate under conventional settlement
  − exclusion rate under micro-service settlement

Constitutional Coverage by Trade Size
  = completeness rate plotted against notional
```

The strongest possible outcome is a **flatter coverage curve**: as trade size falls, constitutional
completeness stays stable. Under a commission-led system completeness is expected to rise with trade
size; under neutral micro-compensation it should become **less dependent on notional value**. That
curve — not any single number — is the clearest expression of whether H3 holds.

### 8.8 Refusal as a paid constitutional service

> **A justified refusal is a completed service, not a failed transaction.**

The risk agent that correctly blocks an unsafe trade has created value. The verifier that confirms
insufficient evidence has created value. MoneyPenny that stops an incomplete workflow has created
value.

DVN receipts must therefore record: the service performed; the basis for refusal; the agent
responsible; the compensation earned; the authority and delegation context; the evidence considered;
and the resulting state.

**How this reaches the receipt (R-8).** Via a **versioned partner-service compensation extension** to
the receipt payload — *not* by adding generic financial fields indiscriminately to every DVN receipt.
The extension supports: service or opportunity reference; liability-creation event; compensation
basis; denomination; **amount or amount commitment**; payer/funder commitment; beneficiary
commitment; settlement state; settlement reference; refusal/completion classification; and the
**experimental cell identifier** (§8.6).

Where disclosure is restricted, store an **amount commitment plus a private ledger reference** rather
than the raw amount in the publicly or broadly visible receipt.

A correct refusal must be representable as:

```text
service completed constitutionally
execution declined
compensation earned
```

> It must **not** be encoded as a failed trade. An encoding that can only express "the trade did not
> happen" cannot express the thing H3 is about.

**Process note.** This is a **payload-shape change** to the DVN pipeline. Adding a member to
`ANCHORABLE_ACTION_TYPES` is the only permitted unilateral change; a payload extension is not, so it
ships only under this ruling and is versioned so older receipts stay readable.

### 8.9 Standing implications — an immediate constitutional requirement

Compensation and Standing remain **distinct but aligned**. An agent may receive Base Q¢ compensation
for performing the service, Capability Standing for demonstrated competence, Stewardship Standing for
preserving constitutional integrity, and Delegated Standing effects where appropriate.

**This is not deferred implementation detail.** Before *any* trading signal is admitted into
Standing, the following inputs are prohibited:

| Prohibited as a Standing input | Why |
|---|---|
| transaction volume | volume is activity, not veracity |
| revenue generated | revenue rewards the outcome the constitution is indifferent to |
| executed-trade count | counts executions, so it prices refusal at zero |
| realised profit **alone** | profit is not evidence of constitutional quality |

Standing **may** recognise: veracity; correct analysis; valid proof; constitutional completeness;
correct refusal; adherence to delegated authority; risk detection; service reliability; evidential
reproducibility.

> **The unit is the verified contribution, not the executed transaction.**
>
> **A correct refusal must be capable of earning equal or greater Standing than an execution, where
> it better satisfies the mandate.**

Without this, the market reintroduces execution bias through the reputation system even after the
payment system has removed it — and the experiment's own result would mask the reintroduction.

### 8.10 Terminology — "constitutional preparation neutrality", not "net neutrality"

The working phrase "net neutrality" is retired here to avoid collision with internet-network
neutrality, which is a different concept with different connotations. The charter term is:

> **Constitutional preparation neutrality** — the condition in which agents can be compensated for
> required assessment work without their remuneration depending on trade execution, trade size or
> trade profitability.

It holds when: all eligible opportunities can be reviewed; required agents are compensated; refusal
is economically valid; small trades are not automatically excluded; constitutional checks are not
selectively omitted; and compensation does not favour approval over refusal.

### 8.11 Commercial significance

H3 makes the venture proposition much broader than cheaper trades:

> Constitutional trading can support an **open economy of specialised agents** in which every
> contributor is paid for verified work, constitutional checks remain economically viable at small
> values, and users are not excluded merely because their trades cannot support conventional
> commission structures.

Markets this could affect: retail access; small treasury operations; machine-to-machine commerce;
autonomous portfolio management; low-notional experimentation; emerging-market participation; and
specialist-agent markets.

---

### 8.12 Funding the compensation — RULED (R-9)

> **For the pilot, compensation comes from an *ex ante* operator-funded service budget — never a levy
> dependent on executed trades.**

Preferred mechanisms: prepaid service balance; subscription; fixed retainer; operator-funded
opportunity budget.

The liability arises **when the constitutionally defined service is completed**, regardless of
whether execution follows:

```text
operator funds service budget
        ↓
opportunity is evaluated
        ↓
agent completes required constitutional work
        ↓
execution or correct refusal
        ↓
compensation becomes payable
```

**Why a levy is prohibited in the confirmatory arm.** Funding refusals from a percentage of executed
transactions recreates execution contingency **at the pool level** even after removing it at the
agent level: the pool only fills when trades execute, so the system regains a systemic interest in
executing. The bias would return in a form the per-agent measurements are blind to.

A pooled or levy-funded model **may later be tested as a separate commercial arm** — it is a
legitimate commercial design — but it cannot be treated as evidence of compensation neutrality.

**Phase 1 honesty condition.** The simulation uses a fixed *ex ante* budget, and must state plainly
that it tests the **incentive structure**, not yet the commercial sustainability of the funding
source. Those are different claims and the charter must not let the first stand in for the second.

## 9. Scientific observatory interface — P1, P2, P3

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

## 10. Governance principles

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

A fourth rule follows from H3, and closes the channel through which the bias H3 removes from the
payment system could re-enter through reputation:

> **Standing follows verified constitutional contribution — not transaction volume or commission
> generation.** A profitable execution must not automatically generate greater Standing than a
> correct refusal. Any Standing computation that touches trading outcomes is checked against this
> rule before it ships. (§8.9)

A fifth rule governs how the compensation model itself may be changed:

> The compensation regime is an **experimental variable, not an operational convenience**. Moving an
> agent between execution-contingent and service-complete compensation outside a declared arm
> invalidates the H3 comparison for every opportunity in flight. Regime changes are recorded, dated
> and scoped — never applied silently.

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

## 11. Success criteria

**Pilot success** — the end-to-end integration works; agents can be discovered, claimed, delegated
and admitted; MoneyPenny can compose them; consequential actions produce DVN receipts; Horizen proofs
are correlated; the Partner Workspace shows the attributable chain.

**Venture success** — operators understand and accept the delegation model; the service reduces trust
and integration burden; preparation economics are measurable; a credible path to cost recovery
exists; partners or customers express deployment intent; the service is repeatable; at least one
viable pricing or revenue model emerges.

**Neutrality success (H3)** — constitutional completeness rate stays stable as trade notional falls
(a **flatter coverage curve**); exclusion of low-value, high-complexity and low-probability
opportunities falls under service-complete compensation; refusal quality improves or holds; agent-role
fidelity is independent of execution outcome; and none of this is achieved by weakening authority,
evidence or settlement integrity.

**Scientific success** — the environment produces usable comparative data; P1/P2/P3 arms can run
without disrupting the pilot; representations, decisions and outcomes are reproducible; **null
findings remain publishable**; structural results can be separated from venture outcomes.

The north star remains sustained adoption and commercial uptake: operators claiming and delegating to
agents; agents vetted and admitted; consequential actions fully receipted; safe refusal working under
real conditions; partners accepting the evidence model; users choosing the service; recurring use;
preparation costs economically recoverable; and the service progressing toward revenue or paid
deployment.

---

## 12. Experiment sequence

1. Define the constitutional trading service
2. Define Base Q¢ and the USDC-on-Base comparator (§3, §7.2)
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

The micro-stablecoin arms (§7) and the neutrality arms (§8) run alongside steps 6–8 in their own four
phases, since Phase 1 needs only deterministic scenarios and no live value. Phase 1 runs the **full
eight-cell factorial** (§8.6) — the marginal cost over four cells is near zero and it is the only
design that exposes the pricing × contingency interaction.

**Immediate delivery order** (ratified 2026-07-28): complete Slice B → draft and ratify this charter
→ attach the gap register → run trading-invariant discovery through the IDE → define the
preparation-cost model → build deterministic scenarios → begin shadow execution → embed optional
P1/P2/P3 arms. QCT-on-Runes etching proceeds in parallel where genuinely independent.

---

## 13. Risks and stop conditions

| Risk | Stop condition |
|---|---|
| Preparation economics never close | H2/H3 return no viable recovery interval at any accounting granularity after Phase 2 |
| Micro-settlement overhead dominates | Mechanism 6 measures show reconciliation/network burden exceeding the mechanism 1–5 savings across all four H2 arms |
| Authority chain cannot be completed for real partner agents | Binding remains `unresolvable` for the pilot cohort after the operator-claim path ships |
| Receipt coverage incomplete on consequential actions | Any consequential trading action reaches execution without a DVN receipt — halt live value immediately |
| Scientific arm pressure on controls | Any proposal to relax a constitutional control for experimental purity — refuse under §10 |
| Neutrality effect is an artefact of pricing, not contingency | The eight-cell factorial shows the H3-D advantage reproduced by per-service pricing alone under execution-contingent compensation — report it as a pricing result, not a neutrality result |
| Compensation model reintroduces bias via Standing | Any Standing computation weighting execution above correct refusal — halt under §10 rule four |
| Neutrality bought at the cost of integrity | Coverage rises while refusal accuracy, receipt coverage or authority-chain integrity falls — the non-inferiority condition (§7.6) governs H3 identically |
| Rune naming error | An etch broadcast with a name other than `BITCENT` — **irreversible**; see gap G-1 |
| Denomination confounded with network | Any arm substituting BitCent for Base Q¢ — the result would measure Bitcoin-versus-Base and report it as micro-versus-standard |

---

## 14. Gap register and dependency order

Maintained separately in `2026-07-28_vl-ct-001-gap-register.md`, structured by the three layers, and
kept current as slices land. The register is part of the charter pack — not a substitute for the
demonstrable object.

---

## 15. Reusable outputs

Whatever the commercial outcome, VL-CT-001 is expected to leave behind: a constitutional trading
invariant set (discovered, classified, executable); a preparation-cost model with a defined
accounting interval; a service-economy ledger schema; an eight-cell settlement-and-compensation
comparison method (denomination × pricing structure × contingency); a constitutional-completeness
scoring instrument that works on non-executed opportunities; a compensation model in which a
justified refusal is a paid service; an agent-binding and attribution chain reusable by any partner
integration; and a research observatory interface that IRL can drive without touching the venture's
controls.

That last item is the point of the whole design: **a venture experiment instrumented deeply enough to
become a reusable scientific testbed.**
