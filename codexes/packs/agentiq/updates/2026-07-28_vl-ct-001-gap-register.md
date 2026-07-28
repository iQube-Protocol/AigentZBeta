# VL-CT-001 — Gap Register

**Companion to:** `2026-07-28_vl-ct-001-constitutional-trading-venture-charter.md`
**Status:** draft — pending operator/Aletheon ratification
**Date:** 2026-07-28
**Method:** every "what exists today" claim below was verified against the working tree at
`e70618bd5` on `claude/constitutional-ground-review-7yg8nb`. Claims that could not be verified from
this repository are marked **UNVERIFIABLE HERE** rather than guessed.

---

## How to read this

Structured by the charter's three layers — **pilot**, **venture experiment**, **scientific
observatory** — because a gap's layer determines who must close it and whether it blocks anything
downstream. Within each layer, gaps are dependency-ordered.

Each gap carries:

- **Exists today** — what is actually built, verified.
- **Missing** — the specific delta.
- **Blocks** — what cannot proceed until it closes.
- **Irreversible?** — whether closing it wrongly cannot be undone.

The headline: **the pilot layer is the most complete, the venture layer is the least — and the third
leg (H3, constitutional preparation neutrality) roughly doubles the venture-layer gap rather than
closing it.** The single irreversible item (G-1) is not on the critical path but has the shortest
fuse.

---

## Layer 1 — Pilot (execution and deployment)

### P-1 — Horizen identity, correlation and evidence — **CLOSED**

**Exists today.** `services/horizen/` carries seven modules: `identity.ts` (network-qualified
identity, BigInt normalisation, hex-vs-decimal alias discipline, `SERVICE_ONBOARDED_ID_FLOOR`),
`agentCard.ts` (untrusted-JSON parser, 256 KiB decode cap, unresolved-vs-invalid distinction),
`client.ts` (registry/Pulse/PnL reads, per-surface selector vocabulary, `ready:false` refused),
`correlate.ts`, `evidence.ts` (partnership record, `partner_agent_evidence_recorded` action type,
sha256 card commitment, three separate chain fields, four temporal fields), `agentBinding.ts`
(Slice A) and `evidenceChain.ts` (Slice B, in flight).

**Missing.** Nothing blocking. Read-and-correlate and the evidence record are both landed.

---

### P-2 — ERC-8004 ↔ `agent_root_did` binding — **CLOSED (Slice A)**

**Exists today.** `services/horizen/agentBinding.ts` — the binding as a first-class constitutional
record rather than a token id; four evidence binding states; four independent facets (with registry
presence, operator claim, delegation and **runtime admission** deliberately not derivable from one
another — `agentBinding.ts:942` records that "runtime admission belongs to the Financial Services
Runtime; deriving either" from the other is the error the separation prevents);
`evaluateNewActionAuthority`. Schema in `supabase/migrations/20260905000000_agent_identity_bindings`.

**Missing.** `OWNERSHIP_FRESHNESS_WINDOW_MS = 24h` is **unratified** — it is a placeholder awaiting
an operator ruling on how stale an ownership proof may be before a new consequential action must
re-verify. Not blocking Slice B; blocking before live value.

**Blocks.** Live-value execution (Phase 4).

---

### P-3 — Partner Workspace attributable evidence display — **CLOSED (Slice B, `54cea2d60`)**

**Exists today.** `services/horizen/evidenceChain.ts` (`projectEvidenceChain()` → `EvidenceChainView`,
seven links in ruling order, Standing as verdict rather than eighth link),
`app/api/venture/workspace/[workspaceId]/evidence-chain/route.ts`, `EvidenceChainPanel` in
`PartnerProgrammesTab.tsx`, `readReceiptAnchorStatus()` in `activityReceiptService.ts` (three-valued:
status / `null` no receipt / `undefined` unreadable), and `tests/horizen-evidence-chain.test.ts` —
31 canaries, 22 mutations all caught.

The chain is now demonstrable end to end: *Horizen identity → operator claim → passport-backed
delegation → DVN receipt → external proof → attribution → Standing eligibility.*

**Carried forward, not closed.** Four items the slice flagged rather than decided:
`statusReason` T2-safety is assumed rather than enforced at the write path (becomes real when Slice
D/E adds operator-supplied revoke reasons, which are both screen- and DVN-bound);
`temporal.receiptCreatedAt` reads "not yet wired" even when DVN says `recorded`; the reference agents'
network (`base-sepolia` vs mainnet) is sourced from the brief and still open with Horizen; and there
is no cache on the partner reads (4 upstream reads per agent, capped at 5).

---

### P-4 — Operator-claim path (Slice D) — **OPEN**

**Exists today.** The binding model anticipates the claim (P-2 facets). The claim message domain
separation was ruled on.

**Missing.** The whole operator-facing claim UX and the two-proof requirement it must enforce. An
operator cannot today claim a Horizen agent through any surface.

**Blocks.** Every facet downstream of `operator claim` in the chain. Without it, bindings for the
pilot cohort stay `unbound` and the Partner Workspace correctly shows an incomplete chain.

---

### P-5 — Registration and Pulse write paths (Slice C/E) — **OPEN**

**Exists today.** Read paths only. `services/horizen/client.ts` reads registry, Pulse and PnL.

**Missing.** Any write to the Horizen registry or Pulse from metaMe.

**Blocks.** Standing attribution flowing back to Horizen; the reciprocal half of the partnership.

---

### P-6 — Marketa vetting workflow (Slice F) — **OPEN**

**Exists today.** `services/marketa/` contains `activation/`, `cohortExpansion.ts` and
`marketaConnector.ts`. Verified: **there is no vetting workflow.** The only "vetted" string in
`services/` is `services/policy/skillQubePolicyGate.ts:5` referring to pre-vetted alpha skills — a
different concern.

**Missing.** The admission-decision workflow itself: what Marketa evaluates, what evidence it
consumes, what a decision record looks like, and how a decision becomes a runtime-admission facet on
the binding.

**Blocks.** Charter step 4 → 5 (establish vetting → admit agents into the Financial Services
Runtime). This is the gate between "an agent exists and is claimed" and "an agent may act."

---

### P-7 — Financial Services Runtime admission (Slice G) — **PARTIALLY OPEN**

**Exists today, and more than expected.** PRD-MPY-001 is a real programme with landed phases:

| Component | Location |
|---|---|
| MoneyPenny cartridge, 10 tabs incl. HFT Console, Portfolio, Strategies, X402, Architect, Runtime, Identity | `data/codex-configs.ts:4525+` |
| Finance invariant namespace + composition law | `types/invariants.ts:41,118`; `supabase/migrations/20260721000000_finance_invariant_namespace.sql` |
| Financial intelligence executor with grounding + verification | `services/constitutional/financialIntelligenceExecutor.ts` (`runFinancialCapability`, `verifyFinancialCapability`, grounding namespaces incl. `finance`) |
| Specialist routing to MoneyPenny with invariant citation by seed id | `services/agents/specialistRouter.ts:154,575` |
| An authoritative MoneyPenny Runtime run as a DVN-anchorable receipt | `services/dvn/activityReceiptDvnPipeline.ts:171`; `services/receipts/activityReceiptService.ts:155` |

**Missing.** The **admission decision** — the thing that turns "MoneyPenny can reason about finance"
into "this externally sourced agent is admitted to act in the runtime." `agentBinding.ts` correctly
declines to derive it. Nothing grants it.

**Blocks.** Charter step 5 and everything after.

---

### P-8 — Deterministic trading scenarios — **OPEN**

**Exists today.** Nothing scenario-shaped for trading.

**Missing.** The deterministic scenario set that Phase 1 of both the venture measurement and the
micro-stablecoin experiment run against. Both need to run *the same scenario twice*, which requires
scenarios that are reproducible by construction.

**Blocks.** H2 scoring, H3 Phase 1, and all P1/P2/P3 arms. This is the most reused missing artefact
in the whole register.

---

## Layer 2 — Venture experiment (operationalisation and commercialisation)

### V-1 — Preparation-cost model — **OPEN, and the venture hypothesis turns on it**

**Exists today.** Nothing. Verified: none of market-intelligence cost, risk-analysis cost,
orchestration cost, simulation cost, proof-generation cost or verification cost is computed anywhere
in the platform.

**Missing.** The model of charter §6, plus the operator's choice of accounting interval (per
opportunity / per completed trade / per session / per strategy batch / per operator account / per
pilot period).

**Blocks.** H2 entirely — "preparation-cost recovery" is currently unmeasurable, so the secondary
venture hypothesis cannot be scored at all. Also blocks H3, which extends this equation.

**Note.** This is the single largest venture-layer gap. It is not analysis work performed on results;
it is an **instrument that must exist before scenarios can be scored**.

---

### V-2 — Service-economy ledger — **OPEN**

**Exists today.** Nothing. No schema, no writer, no reader.

**Missing.** The fourteen-field ledger of charter §7.10: service type; provider agent; requesting
agent; principal commitment; delegation reference; quoted price; settled price; payment denomination;
payment timestamp; settlement cost; DVN receipt; proof reference; trade/opportunity reference;
accepted/rejected/expired outcome.

**H3 widens this.** The ledger must additionally carry, per entry: the **compensation regime** in
force (execution-contingent vs service-complete) and the **pricing structure** (bundled vs
per-service) — without them, no entry can be attributed to a factorial cell and the whole H3
comparison is unrecoverable after the fact. It must also record **compensation earned on a
non-executed outcome**, which is the single measurement H3 turns on and which an execution-keyed
schema cannot express at all.

**Constraint on closing it.** `principal commitment`, never `personaId`. Where the ledger becomes
network- or chain-bound, `personaPublicRef()` is the only permitted persona identifier. The
service-economy ledger is a **new evidence category** — distinct from the DVN receipt stream and the
Horizen evidence chain — and if it is anchored, T0 identifier isolation applies without exception.

**Blocks.** H3 measurement of every one of the six mechanisms. Also the "constitutional compensation
of agents" claim in §7.9.

---

### V-3 — Micro-settlement payment layer — **PARTIALLY OPEN, with a real head start**

**Exists today, and this is the register's best news.** `services/x402/` already carries the shape H3
needs: `router.ts` (`handleX402`, `handleCustody`, `handleClaim`, `handleCanonical`; delivery modes
`custody | claim | canonical`), `policy.ts` (`shouldEscrow`), `config.ts` (`loadExecConfig`,
chain config), `signing.ts`. There is a live MoneyPenny **X402 tab** labelled "Payment settlements"
(`data/codex-configs.ts:4619`), and x402 is already wired into `services/aa-api/src/routes/payments.ts`
and the content/rewards paths.

x402 is agent-to-service HTTP micropayment. That is precisely the transport H3's per-service arms
(B and D) require. It is to H3 what `services/representation/interpretations/` is to P3: existing
machinery whose shape transfers, built for a neighbouring purpose.

**Missing.**
- Agent-to-**agent** service pricing and settlement (today's x402 paths are content/rewards/payments
  shaped, not specialist-agent shaped).
- A **denomination switch** — the arms need the same pathway settled in QriptoCENT or in a standard
  stablecoin, with everything else held constant. Nothing today parameterises denomination.
- A **bundling switch** — arms H2-A/H2-C bundle, H2-B/H2-D price per service.
- A **contingency switch** (H3) — whether a service payment is owed on completion of the service or
  only on execution of the trade. This is orthogonal to the bundling switch and is the harder of the
  two: it means the payment obligation must be created at *service completion* and settled
  independently of the trade's outcome.
- Batching policy, and the settlement-cost accounting that mechanism 6 measures.

**Blocks.** All four H2 arms, all four H3 arms, and the eight-cell Phase 1 factorial.

**Watch item.** Charter §7.8 — the experiment must separate unit denomination, token transfer cost,
network fee, service price, settlement architecture and batching policy. An implementation that
couples denomination to settlement architecture cannot answer the question it is built to answer.

---

### V-4 — The standard-stablecoin comparator — **OPEN, and unspecified**

**Exists today.** Nothing selected.

**Missing.** *Which* standard stablecoin, on *which* network, at *what* fee profile. H3's entire
result is a comparison against this choice, so the choice is an experimental parameter, not an
implementation detail. Picking a comparator with atypical fees would make the result
non-transferable.

**Blocks.** Arms H2-A/H2-B and H3-A/H3-B — i.e. half of each design, and four of the eight
factorial cells.

**Requires.** An operator decision, recorded in the charter before Phase 1 runs.

---

### V-5 — Base QriptoCENT deployment status — **OPEN, and genuinely ambiguous in this repository**

**Exists today.** `contracts/QCT.sol`, `contracts/QCTReserve.sol`, `contracts/QCTToken.sol`.
`docs/alpha/agentiq-knyt/35-mainnet-deployment-registry.md:4` reads *"in progress — QCT deploy
pending"*, and §3 is headed *"QCT (QriptoCENT) — Base Mainnet Deployment (PENDING)"*, with
`NEXT_PUBLIC_QCT_BASE_MAINNET` and `NEXT_PUBLIC_QCT_RESERVE_BASE_MAINNET` unset placeholders.
`docs/MINTING_ACTIVATION_PLAN.md:66` records Base Q¢ mainnet as **"Not deployed"**.

**UNVERIFIABLE HERE.** CLAUDE.md records that the operator's `Kn0w-1` clone holds a commit *"Record
Base mainnet deploy addresses (QCT, iQubeNFT, QCTReserve)"* that is **not present in canonical**, and
flags it as money-critical and requiring deliberate reconciliation with operator sign-off — never
auto-merge. So this repository cannot answer whether Base QCT is deployed.

**Blocks.** The QriptoCENT arms (H2-C/H2-D, H3-C/H3-D) at Phase 3 (testnet settlement) and Phase 4.
Not Phase 1 or 2, which need no
live value.

**Action.** Reconcile the Kn0w-1 deploy-address commit into canonical with operator sign-off before
any settlement phase. This is a pre-existing flagged item, not a new one — but VL-CT-001 is the first
workstream whose economics depend on the answer.

---

### V-6 — Pricing, revenue model and adoption instrumentation — **OPEN**

**Exists today.** Nothing trading-specific. `services/venture/` has portfolio, customer-matrix,
outcome-accrual and Standing machinery, but none of it prices a trading service.

**Missing.** The venture-success measurements of charter §10: operator comprehension of the
delegation model, integration-burden reduction, deployment intent, repeatability, and at least one
viable pricing or revenue model. These are the *centre of gravity* of the charter and currently have
no instrument at all.

**Blocks.** The venture verdict. Note that pilot success is fully measurable without any of this —
which is exactly the separation the charter's three-layer structure exists to preserve, and exactly
why this gap must not be allowed to hide behind pilot progress.

---

### V-7 — Compensation-regime switch — **OPEN (new with H3)**

**Exists today.** Nothing. No code anywhere expresses the idea that a service payment might be owed
independently of a trade's outcome.

**Missing.** The regime itself, as a configurable experimental variable: **Regime E**
(execution-contingent) and **Regime S** (service-complete). Concretely — a payment obligation created
at service completion, carrying the delegation and authority context, settled whether the trade
executes, is refused, expires or is deferred.

**Blocks.** All four H3 arms. This is the H3 analogue of V-1: not analysis, but the instrument
without which the hypothesis cannot be posed.

**Note on difficulty.** This is harder than the denomination switch. Denomination is a parameter;
contingency is a change to *when a liability comes into existence*. An implementation that creates
the obligation at execution and back-fills refusals will look correct and measure nothing, because
the refusal path never generates the obligation the hypothesis is about.

---

### V-8 — Constitutional-completeness scoring — **OPEN (new with H3)**

**Exists today.** Nothing that scores an opportunity's assessment. `evidenceChain.ts` (Slice B)
projects a seven-link chain for an *agent*, which is adjacent in shape but a different subject: it
answers "is this agent's evidence attributable", not "did this opportunity receive its full
constitutional process".

**Missing.** Per-opportunity scoring of whether it received market assessment, authority
verification, risk review, execution-eligibility decision, proof/evidence record, DVN receipt and
reconciliation/closure — **including opportunities that never executed**, which is the entire point.
Plus the three headline metrics: Constitutional Completeness Rate, Neutral Assessment Rate, Trade
Exclusion Reduction, and the Constitutional Coverage by Trade Size curve.

**Blocks.** Every H3 measurement.

**Watch item.** The scoring subject must be the **opportunity**, not the trade. A schema keyed on
executed trades cannot represent the population H3 is about, and the mistake is invisible until the
analysis stage — every number will compute, on the wrong denominator.

---

### V-9 — Refusal as a compensable, receipted service — **OPEN (new with H3)**

**Exists today.** Refusal exists as a decision. It does not exist as a **compensable service with a
receipt**.

**Missing.** Charter §8.8: DVN receipts recording the service performed, the basis for refusal, the
agent responsible, **the compensation earned**, the authority and delegation context, the evidence
considered, and the resulting state.

**Blocks.** H3's central claim — that a justified refusal is a completed service rather than a failed
transaction — is unfalsifiable without a receipt that says so.

**Constraint on closing it.** If this needs a new anchorable action type, note that adding a member to
`ANCHORABLE_ACTION_TYPES` in `services/dvn/activityReceiptDvnPipeline.ts` is **the only permitted
unilateral change** to the DVN pipeline. Anything touching the payload shape, the state machine, or
`hashPersonaRef` requires operator approval before coding. Adding a compensation amount to a receipt
payload is a payload-shape change — **it is not unilateral**.

---

### V-10 — Standing neutrality guard — **OPEN (new with H3)**

**Exists today, and the current position is favourable.** `services/standing/standingScore.ts`
computes Standing as veracity-led: `veracityScore` from verified facts (average confidence 0.55 +
coverage 0.30 + fact-count volume 0.15, plus a compiled-VSP lift), composed
`veracity × 0.7 + contribution × 0.3`. The `volume` term is **verified-fact count, not transaction
volume**. `contributionScore` comes from `crm_persona_reputation`. So Standing does **not** today
weight trading execution above refusal.

**Missing.** Anything that *prevents* it from doing so. Charter §10 rule four states that Standing
follows verified constitutional contribution rather than transaction volume or commission generation;
nothing enforces it. The moment a trading-outcome signal is fed into `crm_persona_reputation`, the
execution bias H3 removes from the payment system re-enters through the reputation system, and the
experiment's own result would mask it.

**Blocks.** Nothing today. Must exist **before** any trading outcome feeds Standing — otherwise the
rule is doctrine without machinery, which is the CB-1 shape.

**Suggested closure.** A parity canary in the `tests/source-of-truth-parity.test.ts` family asserting
that no Standing input derives from executed-trade count, notional or fee revenue.

---

## Layer 3 — Scientific observatory

### S-1 — Trading invariants are undiscovered — **OPEN (by design, and to be treated as such)**

**Exists today.** The `finance` namespace is **declared but empty**. Verified by enumerating
`codexes/packs/irl/foundation/canonical-invariants.seed.json`: 373 invariants across fourteen
namespaces — polity 143, reasoning 89, constitutional 38, engineering 24, epistemology 13, experience
9, capability 8, commercialisation 8, sovereignty 8, style 8, interaction 7, representation 7,
narrative 6, cybernetics 5 — and **zero `inv.finance.*`**. The single `inv.finance.001` string in the
codebase is a citation-format example in a prompt
(`services/constitutional/moneyPennyArchitect.ts:33`), not a member.

The namespace, its composition law and its CHECK constraints were widened **ahead of** the derivation
run — the correct order under CFS-013 §3 (a class's algebra must be declared before it can enter
canonical status). Discovery-pipeline candidates may exist in the database; that is not readable from
this repository and is not the canonical crystal.

**Missing.** The IDE run itself, over the four candidate domains of charter §5 — authority, risk,
execution, evidence/receipts.

**Blocks.** Charter step 3, and therefore the conversion of invariants into executable policy that
steps 5–7 depend on.

**Discipline.** These enter as `proposed`, never `canonical` — they are claims the experiment exists
to test. The charter must not present any §5 example as ratified. This is the same discipline that
kept `inv.reasoning.323/329/333` at `proposed`.

---

### S-2 — P1/P2/P3 arm harness — **OPEN**

**Exists today.** Nothing trading-specific.

**Missing.** The ability to vary invariant presence, selection, compression, representation format,
verification treatment, ordering, abstraction level, agent exposure and retrieval method **against a
fixed scenario set**, without touching the constitutional controls.

**Blocks.** All three P-arms. Depends entirely on P-8 (deterministic scenarios).

---

### S-3 — P3 representation substrate — **PARTIALLY CLOSED**

**Exists today.** `services/representation/interpretations/` with three interpretations
(`agentiqLiquidGlass.ts`, `constitutionalCivicFuturism.ts`, `highContrastAccessible.ts`) and an
`index.ts`. The abstraction — *one concept → multiple interpretations → selected interpretation →
adopted surface → measured consequence* — is exactly P3's shape.

**Missing.** Interpretations of a *trading invariant* rather than a *surface style*: prose, numeric
threshold, typed schema, executable predicate, causal graph, compact packet, human-facing
explanation, agent-facing policy object. The machinery transfers; the content does not exist.

**Blocks.** P3 only. Not on the venture critical path.

---

### S-4 — Observatory access boundary — **OPEN**

**Exists today.** Nothing.

**Missing.** The controlled interface through which IRL reads scenarios, decisions, traces, receipts,
representations and outcomes — *without* the ability to alter constitutional controls. Charter §9
states the rule ("scientific arms must not weaken, bypass or suspend constitutional controls");
nothing enforces it.

**Blocks.** Nothing today, because no arm is running. Must exist before the first arm runs, or the
rule is doctrine without machinery — the CB-1 failure shape.

---

## The one irreversible gap

### G-1 — BitCent naming must reach the Runes etching parameters before any etch — **OPEN, IRREVERSIBLE**

**Exists today.** `scripts/QCT_RUNES_DEPLOYMENT.md` specifies the token as:

| Property | Value in the doc today |
|---|---|
| Name | **QRIPTOCENT** |
| Symbol | Q¢ |
| Decimals | 8 |
| Total supply | 1,000,000,000 |
| Premine | 400,000,000 (40%) |
| Public mints | 21,000 × 47,619 |
| Turbo | enabled |

Deployment scripts: `scripts/deploy-qct-runes.ts` / `.js`.

**Missing.** The operator-confirmed naming — **BitCent (Bc)** for QCT-on-Bitcoin — is not carried into
the deployment doc or the etch parameters.

**Irreversible?** **Yes.** A Rune name is fixed at etch. An etch broadcast with the wrong name cannot
be corrected; it can only be abandoned and re-etched under a different name, losing the intended one.

**Blocks.** Nothing else — QCT-on-Runes is genuinely parallel work. But it has the shortest fuse in
the register, because the cost of proceeding without closing it is permanent and the cost of closing
it is a text edit.

**Action.** Reconcile the name (and confirm whether the symbol should remain `Q¢` or become `Bc`)
into `scripts/QCT_RUNES_DEPLOYMENT.md` and the etch parameters **before** any etch transaction is
broadcast, testnet or otherwise.

---

## Dependency order

```
G-1  (parallel, irreversible, close first — it costs a text edit)
  │
P-3  Slice B — Partner Workspace display        [CLOSED 54cea2d60]
  ↓
S-1  IDE run: trading invariants                 ─┐
V-1  Preparation-cost model                       │
V-4  Standard-stablecoin comparator decision      ├─ can run concurrently
V-8  Constitutional-completeness scoring         ─┘
  ↓
P-8  Deterministic scenarios      ← consumed by H2, H3, and all P-arms
  ↓                                  (must span notional bands and refusal-heavy cases)
V-2  Service-economy ledger  +  V-3  Micro-settlement layer  +  V-7  Compensation-regime switch
  ↓
V-9  Refusal as a receipted, compensable service
  ↓
Phase 1 — the EIGHT-CELL factorial, simulated   [no live value; no V-5 dependency]
  ↓
Phase 2 — live observation, shadow settlement
  ↓
P-4  Operator claim  →  P-6  Marketa vetting  →  P-7  Runtime admission
  ↓
P-2  ownership-freshness ruling  +  V-5  Base QCT reconciliation
  ↓
V-10 Standing neutrality guard    ← MUST precede any trading signal reaching Standing
  ↓
Phase 3 (testnet)  →  Phase 4 (capped live value)
  ↓
S-4  Observatory boundary  →  S-2 / S-3  P1/P2/P3 arms
```

Four observations on this ordering.

**Phases 1 and 2 are cheap, early, and now carry both economic hypotheses.** They need scenarios, a
ledger, a regime switch and a completeness scorer — no live value, no deployed Base contract, no
runtime admission. Both H2 and H3 can return a real answer well before the trading pathway is live,
which matters because H3 is the hypothesis most likely to change the product's shape.

**H3 roughly doubles the venture-layer gap.** V-7 through V-10 are all new, all open, and none has a
line of code. The venture layer was already the least built; the third leg widens that gap rather
than closing it. That is not an argument against the leg — it is the reason to sequence Phase 1
deliberately rather than after the pilot.

**V-10 has an ordering constraint, not just a dependency.** It must land *before* any trading outcome
feeds Standing, not merely before Phase 4. A Standing signal contaminated once is contaminated
retroactively across every agent it scored.

**P-8's scenario set now carries more requirements.** It must span notional bands (to produce the
Constitutional Coverage by Trade Size curve), include a realistic proportion of correctly-refused and
expired opportunities (the population H3 is about), and be replayable under eight configurations.
Specifying it after V-8 rather than before avoids a scenario set that cannot express the metric.

## Open rulings required

| # | Ruling needed | Blocks |
|---|---|---|
| R-1 | BitCent name **and symbol** (`Q¢` or `Bc`?) into the Runes etch parameters | G-1 (irreversible) |
| R-2 | Ownership freshness window — 24h is a placeholder | live-value execution |
| R-3 | Preparation-cost **accounting interval** (opportunity / trade / session / batch / account / period) | V-1, and therefore H2 and H3 |
| R-4 | Which standard stablecoin, network and fee profile is the H2/H3 comparator | arms H2-A/H2-B and H3-A/H3-B |
| R-5 | Base QCT mainnet reconciliation between canonical and the Kn0w-1 clone | Phases 3–4 |
| R-6 | Whether the service-economy ledger is DVN-anchored (and therefore bound by T0/T2 identifier isolation in full) | V-2 schema |
| R-7 | **Confirm the eight-cell Phase 1 factorial** — or accept two four-cell slices and forgo the pricing × contingency interaction | Phase 1 scope |
| R-8 | Whether refusal compensation requires a **new anchorable action type** or a payload change to an existing one — the latter is **not** a unilateral DVN change and needs approval before coding | V-9 |
| R-9 | Who funds service-complete compensation for opportunities that never execute — the operator, a service subscription, or a levy on executed trades (the last risks reintroducing the very coupling H3 removes) | V-7 economics |

R-9 is the one worth sustained thought. H3 says agents must be paid for correct refusals; the money
still has to come from somewhere. Funding refusals from a levy on executed trades restores
execution-contingency at the level of the *pool* even after removing it at the level of the *agent* —
the bias returns as a systemic pressure to keep the pool full. An operator-funded or subscription
model avoids that but changes the commercial proposition materially. This is a venture-design
decision, not an implementation detail, and Phase 1 cannot settle it because simulated payments have
no funder.
