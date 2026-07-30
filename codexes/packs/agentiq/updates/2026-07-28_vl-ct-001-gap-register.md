# VL-CT-001 — Gap Register

**Companion to:** `2026-07-28_vl-ct-001-constitutional-trading-venture-charter.md`
**Status:** rulings R-1 through R-9 ratified 2026-07-28 and applied below
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
closing it.** The single irreversible track is off the critical path but has the shortest fuse — and
turned out to hold a second, undecided defect (G-2).

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

**Missing — CLOSED by R-2.** The single 24-hour window was ruled **too coarse** and has been replaced
by a risk-tiered policy in `agentBinding.ts`:

| Tier | Window | Applies to |
|---|---|---|
| `passive` | 24h | catalogue display, research, preliminary Marketa review |
| `admission` | 15m | operator claim, delegation activation, runtime admission |
| `consequential` | 5m | live-value authorisation |

Plus `requiresFreshRead(tier, { irreversible, highValue })` — a high-value or irreversible act must
re-read the chain and **cannot** be authorised from the 5-minute cache, surfaced as the new
`ownership-fresh-read-required` refusal. `OWNERSHIP_FRESHNESS_TIER_FOR` maps each act to its tier as
data, so a route cannot quietly choose a looser window; `isOwnershipFresh` and
`evaluateNewActionAuthority` both **default to `consequential`**, the strictest, so an unspecified
caller fails safe.

The governing invariant: *ownership freshness is determined by the consequence of the proposed
action, not by one universal polling interval.* Transfer-event indexing can later shorten the numbers
without changing the tiering.

Canaries in `tests/horizen-agent-binding.test.ts` (87 green); five mutations — tier collapse, loosened
default, inert fresh-read, `operator-claim` demoted to passive, ignored `freshRead` — all caught.

**Blocks.** Nothing further.

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

**Missing.** The model of charter §6. **The accounting interval is now ruled (R-3):** the canonical
unit is the **opportunity** — including refused and never-executed opportunities — aggregated *per
opportunity → per experimental run → reporting period*. Eleven fields per record (creation time,
participating agents, discovery/analysis/verification/compliance/execution-preparation effort,
outcome, compute and token use, elapsed time, associated receipts and payments).

The ruling removes the design question but not the work: nothing computes any of it.

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

**Anchoring ruled (R-6).** The ledger **is** DVN-anchored, at two levels: an **individual receipt**
for each consequential event (obligation creation, correct refusal, compensation entitlement,
settlement, reversal, dispute, reconciliation adjustment), and **batched checkpoint/Merkle
commitments** for ordinary entries. Amounts may be **committed rather than publicly disclosed**.

**Constraint on closing it.** `principal commitment`, never `personaId`; `personaPublicRef()` is the
only permitted persona identifier on any network- or chain-bound field, and T0 isolation applies
without exception.

> **The ledger must not become a second receipt system.** It is an accounting *view composed from
> receipted events*. A ledger that can assert what the receipt stream cannot corroborate has forked
> the record — and the fork would be discovered during audit, not before.

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

### V-4 — The standard-stablecoin comparator — **CLOSED (R-4)**

**Ruled.** **USDC on Base**, described as: *standard USDC settlement on Base using the same x402 and
receipt pathway as the Base Q¢ arm.*

Held constant: network; transaction path; custody model; wallet framework; service scenario; receipt
requirements; settlement-finality assumptions. Only denomination and the experimental mechanism vary.

**Fee profile.** Phase 1 uses a **frozen, documented Base fee profile** from a defined observation
window — explicitly not an unusually cheap or congested block. Live phases record the **actual fee
paid per transaction alongside the frozen benchmark**.

**Prohibited.** Comparing against a stablecoin on a different network — that confounds denomination
with chain economics.

**Consequence for the instrument.** This is the same reasoning that moved the experiment off BitCent:
see the correction recorded at G-1.

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

**Ruled (R-5).** The canonical record **remains pending and not deployed** until independently
verified and admitted into canon. The Kn0w-1 deploy-address commitment is **evidence to investigate,
not sufficient canonical proof.**

Required reconciliation, in order:

1. identify the claimed contract address;
2. verify chain and bytecode;
3. verify deployer and deployment transaction;
4. verify token metadata and authority controls;
5. determine whether it is canonical, experimental or abandoned;
6. produce a **reconciliation receipt**;
7. amend the canonical deployment record **only after** verification.

Until then: Phases 1–2 may use an abstract or simulated Base Q¢ instrument; Phase 3 may use an
explicitly labelled **non-canonical** test deployment; Phase 4 **must not** represent the instrument
as canonical without ratification.

> **No existing clone address may silently become the production contract.**

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

**Funding ruled (R-9).** The pilot funds compensation from an ***ex ante* operator-funded service
budget** — prepaid balance, subscription, retainer or opportunity budget. A levy on executed trades
is **prohibited in the confirmatory arm**: it recreates execution contingency at the pool level after
removing it at the agent level. A levy-funded model may be tested later as a **separate commercial
arm**, but cannot count as evidence of neutrality. Phase 1 must state that it tests the **incentive
structure**, not the sustainability of the funding source.

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

**Ruled (R-8).** Approved as a **versioned partner-service compensation extension** to the receipt
payload — not generic financial fields sprayed across every DVN receipt. Eleven supported fields
including amount **or amount commitment**, payer/funder and beneficiary commitments, settlement
state, refusal/completion classification and the experimental cell identifier. Restricted disclosure
stores an **amount commitment plus a private ledger reference** rather than the raw amount.

A correct refusal must be representable as *service completed constitutionally / execution declined /
compensation earned* — **never** as a failed trade.

**Process note.** This is a payload-shape change, which is **not** among the unilateral DVN changes
(only adding an `ANCHORABLE_ACTION_TYPES` member is). It proceeds under this ruling, versioned so
older receipts stay readable.

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

**Ruled — immediate constitutional requirement, not deferred implementation detail.** Before any
trading signal enters Standing, these are **prohibited as direct inputs**: transaction volume;
revenue generated; executed-trade count; realised profit **alone** as evidence of constitutional
quality.

Standing **may** recognise: veracity; correct analysis; valid proof; constitutional completeness;
correct refusal; adherence to delegated authority; risk detection; service reliability; evidential
reproducibility.

> The unit is the **verified contribution**, not the executed transaction. A correct refusal must be
> capable of earning **equal or greater** Standing than an execution where it better satisfies the
> mandate.

**Blocks.** Must exist **before** any trading outcome feeds Standing — otherwise the rule is doctrine
without machinery, which is the CB-1 shape.

**Closure.** A parity canary in the `tests/source-of-truth-parity.test.ts` family asserting that no
Standing input derives from executed-trade count, notional or fee revenue.

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

## The irreversible gap — named, decided, and larger than it looked

### G-1 — BitCent naming — **NAME RULED (R-1) AND APPLIED; a second defect surfaced**

**Ruled (R-1).** The class is QriptoCENT / Q¢. The Bitcoin-specific version is **BitCent / B¢**, ASCII
fallback `Bc`, long form "Bitcoin Q¢". The immutable Rune name is **`BITCENT`**, subject to final
deployment validation — **never `QRIPTOCENT`**, which names the class rather than this version.

**Applied.** `scripts/QCT_RUNES_DEPLOYMENT.md` (title, overview, spec table, and a naming-canon
section stating the immutability), `scripts/deploy-qct-runes.ts` and `scripts/deploy-qct-runes.js`
(`name: 'BITCENT'`, `symbol: 'B¢'`, canon in the header).

**Correction recorded.** BitCent is **not** the VL-CT-001 instrument. The experiment uses **Base Q¢**
so both arms share one network, one x402 pathway, one custody model and one receipt path. Using
BitCent would confound denomination with network and settlement architecture — the experiment would
measure Bitcoin-versus-Base and report it as micro-versus-standard. BitCent's etch is now a genuinely
parallel track, and a later cross-network experiment is where the network difference becomes the
subject rather than a confound.

---

### G-2 — A third etching script, with irreconcilable tokenomics — **OPEN, IRREVERSIBLE, NEW**

Found while applying R-1. `scripts/deploy-qct-bitcoin.js` also etches this concept, and its
parameters **disagree with the canonical script**:

| | `deploy-qct-runes.*` | `deploy-qct-bitcoin.js` |
|---|---|---|
| premine | 400,000,000 (40%) | 100,000,000 |
| amount per mint | 47,619 | 1,000 |
| mint cap | 21,000 mints | 900,000,000 |

Rune etching parameters are immutable once broadcast, so **whichever script runs first fixes the
tokenomics forever**. This is the source-of-truth-parity defect class (`inv.engineering.037`) in its
most expensive form: the stale duplicate cannot be corrected after the fact.

**Done.** The naming canon was applied to **both**, so no path can etch the wrong *name* while the
*tokenomics* question is open. The divergent script now refuses to run without
`ACKNOWLEDGE_DIVERGENT_TOKENOMICS=yes`, with the divergence table in its header.

**Missing.** An operator ruling on which parameter set is authoritative, and deletion or
reconciliation of the loser. Guarding is a stopgap; two scripts for one irreversible act is the
defect.

**Irreversible?** **Yes** — once either is broadcast.

---

### G-3 — Hardcoded Bitcoin private key in the repository — **OPEN, SECURITY**

`scripts/deploy-qct-bitcoin.js` contains a literal WIF private key
(`const persistentWIF = 'cMnrk...'`). It is testnet, but CLAUDE.md's rule is unqualified: *never
hardcode secrets, keys, or credentials.* Anyone with repository access controls that wallet and can
spend anything funding it — including the UTXO reserved for an etch.

**Not remediated unilaterally.** The wallet may be funded and in use; rotating or deleting the key
without the operator is destructive. Flagged for a decision: move to an env var and rotate, or
confirm the wallet is disposable.

## Dependency order

```
G-1  naming  [RULED R-1, APPLIED]   ·   G-2  duplicate etching script  [OPEN, irreversible]
  │
P-3  Slice B — Partner Workspace display        [CLOSED 54cea2d60]
  ↓
S-1  IDE run: trading invariants                 ─┐
V-1  Preparation-cost model                       │
V-4  Comparator  [CLOSED R-4: USDC on Base]      ├─ can run concurrently
V-8  Constitutional-completeness scoring         ─┘
  ↓
P-8  Deterministic scenarios      ← consumed by H2, H3, and all P-arms
  ↓                                  (must span notional bands and refusal-heavy cases)
V-2  Service-economy ledger  +  V-3  Micro-settlement layer  +  V-7  Compensation-regime switch
  ↓
V-9  Refusal as a receipted, compensable service
  ↓
Phase 1 — the EIGHT-CELL factorial, simulated   [ratified R-7; no live value, no V-5 dependency]
  ↓
Phase 2 — live observation, shadow settlement
  ↓
P-4  Operator claim  →  P-6  Marketa vetting  →  P-7  Runtime admission
  ↓
P-2  freshness  [CLOSED R-2]  +  V-5  Base QCT reconciliation (7-step, R-5)
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

## Rulings — status after 2026-07-28

| # | Ruling | Status |
|---|---|---|
| R-1 | BitCent naming and representations | **RATIFIED + APPLIED** — `BITCENT` / `B¢`; class stays QriptoCENT / Q¢. Correction: the experiment uses **Base Q¢**, not BitCent |
| R-2 | Ownership freshness | **RATIFIED + IMPLEMENTED** — three tiers (24h / 15m / 5m) + fresh-read requirement for irreversible or high-value acts |
| R-3 | Preparation-cost accounting interval | **RATIFIED** — per **opportunity**, incl. refused and unexecuted; aggregated per run and per reporting period |
| R-4 | H3 comparator | **RATIFIED** — USDC on Base, same x402/custody/receipt path; frozen fee profile in Phase 1, actual fees live |
| R-5 | Base QCT reconciliation | **RATIFIED** — canonical stays pending; seven-step verification; phase-by-phase instrument permissions |
| R-6 | Service-economy ledger anchoring | **RATIFIED** — DVN-anchored at two levels; consequential events receipted individually, ordinary entries checkpointed |
| R-7 | Full factorial | **RATIFIED** — complete 2×2×2, eight configuration-derived cell ids, bare arm letters prohibited |
| R-8 | Compensation in DVN receipts | **RATIFIED** — versioned partner-service extension; amount commitment + private ledger reference where restricted |
| R-9 | Funding correct refusals | **RATIFIED** — *ex ante* operator-funded budget; executed-trade levy prohibited in the confirmatory arm |
| V-10 | Standing contamination guard | **RATIFIED** — volume, revenue, execution count and profit-alone prohibited as Standing inputs |
| R-11 | The hardcoded testnet WIF in `deploy-qct-bitcoin.js` | **FIXED, 2026-07-30** — moved to `BITCENT_TESTNET_DEPLOYER_WIF` env var (dotenv, `.env.local`/`.env.local.temp`), old key treated as compromised and rotated. Script refuses to run without it. Not a ruling — a code fix; no decision was needed once "rotate it" was the answer. G-3 closed. |
| R-10 | Which etching script is authoritative | **RESOLVED, 2026-07-30** — consolidated to the sole `scripts/deploy-qct-bitcoin.js`, rebuilt on the real `runelib` Runestone/Etching/Terms encoder (ported from `deploy-qct-runes.*`, which used correct encoding but superseded 400M tokenomics; the pre-consolidation `deploy-qct-bitcoin.js` had non-functional placeholder OP_RETURN encoding). All five other candidate scripts deleted, not merely guarded. Tokenomics are never hardcoded — the script loads `scripts/bitcent-issuance-record.json` and refuses `--execute` unless all ten freeze-list fields are `ratified: true` (**10/10 as of 2026-07-30 — see R-14/R-15/R-16 below and `2026-07-30_bitcent-governed-reserve-ratification.md`**). Mainnet refused unconditionally pending its own separate ratification path. G-2 closed for the "which script" question. |
| R-14 | The B¢ **allocation schedule** — how the initially-active tranche splits across purposes (item 7 of the freeze list) | **RATIFIED, 2026-07-30** — 35% settlement liquidity/market-making, 25% service-economy reserve, 15% ecosystem incentives, 10% operational settlement reserve, 10% treasury/contingency, 5% future governed distribution — sums to the 100,000,000 initially-active issuance (see R-16 for why this is no longer the same number as the on-chain premine). Recorded in `scripts/bitcent-issuance-record.json` as `allocationSchedule.value`, `ratified: true`. These are treasury earmarks — they do not independently authorise any transfer. |
| R-15 | **Issuer/holder of the B¢ premine** (item 8 of the freeze list) | **RATIFIED FOR PILOT, 2026-07-30 — `PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE`.** Aigent Z BitCent Treasury, a dedicated testnet wallet (fresh keypair, never previously exposed). This is a SINGLE-KEY wallet, not the multisig/threshold control originally required — the operator explicitly accepted this trade-off for pilot speed, substituting the pilot treasury authority gate (`services/treasury/pilotTreasuryAuthority.js`: operator mandate + passcode + Aigent Z execution + Aigent Nakamoto required-signatory approval + Aigent Kn0w1 observation) for on-chain multisig. Post-pilot review trigger recorded in `2026-07-30_bitcent-governed-reserve-ratification.md` covers signer topology, Platform Aletheon participation, passkey replacement, key rotation, custody separation. |
| R-16 | **Mint terms / open-mint policy** — the exact shape of item 6 of the freeze list, previously an unratified `amountPerMint`/`cap` placeholder implying a permissionless public mint | **RATIFIED, 2026-07-30 — governed-reserve model.** No permissionless public mint (`openMint: none`); the FULL `maxSupply` (1,000,000,000 B¢) is premined in one custodial output at etch time (superseding the 2026-07-29 ratification of a 100,000,000 on-chain premine, which conflated the on-chain amount with the initially-active amount); of that, 100,000,000 is designated `initiallyActiveIssuance` (what R-14's allocation schedule distributes) and 900,000,000 is a `governedReserve` that cannot be released without a new operator mandate. This is a spend-authorisation policy, not a protocol-level split — Bitcoin Runes has no mechanism to partition a premine into tranches at the UTXO level. `scripts/deploy-qct-bitcoin.js`'s `Etching` construction no longer builds a `Terms` structure at all. |

## Rulings still needed

| # | Ruling needed | Blocks |
|---|---|---|
| **R-12** | Final deployment validation of `BITCENT` as the Rune name (R-1 was explicitly "subject to" this) — **MAINNET PASS, TESTNET PASS (non-conclusive, one indexer)** (see below) | the testnet etch |
| **R-13** | The Base fee **observation window** for R-4's frozen profile — which dates, and by what rule are unusual blocks excluded? | Phase 1 reproducibility |

R-10 and R-12 travel together: validating the name means nothing if two scripts can etch different
tokenomics under it. R-13 is small but load-bearing — an undocumented observation window makes Phase 1
unreproducible, and reproducibility is the one thing a deterministic phase is supposed to guarantee.
R-14, R-15 and R-16 (the three remaining items of the constitution's ten-item freeze list) were
ratified 2026-07-30 — see the resolved-rulings table above and
`2026-07-30_bitcent-governed-reserve-ratification.md`.

**R-12 mainnet check — PASS (operator-run, 2026-07-30 08:51–08:53 UTC).** Against the official
`ord` mainnet index (`https://ordinals.com/rune/BITCENT`):

```text
rune: BITCENT
HTTP 404 (the Rune-availability page, not a generic failure)
reserved: false
unlockHeight: 944100
indexedHeight: 960232
runeIndex: true
decision: AVAILABLE_AND_UNLOCKED
observedAt: 2026-07-30T08:51:57Z
```

Not etched, not reserved, unlock height already passed, and the index itself is confirmed healthy
and synced. This must be **rechecked immediately before any actual Mainnet commitment** — a name can
be etched by someone else between this check and a real broadcast — and Mainnet remains
unconditionally refused in `deploy-qct-bitcoin.js` regardless of this result, pending its own
separate ratification path.

**R-12 testnet check — PASS, non-conclusive (operator-run, `npm run check:bitcent-name`, 2026-07-30
19:19 UTC).** `scripts/check-bitcent-name-availability.js` against mempool.space's live testnet Rune
API:

```text
GET https://mempool.space/testnet/api/v1/runes/BITCENT
HTTP 404
verdict: LIKELY AVAILABLE (not found on this indexer)
conclusive: false
```

`testnet.ordinals.com` never resolved from the operator's machine (DNS issue, unconfirmed cause), and
`ord`'s own etching path (`ord wallet batch`) was confirmed to require a full synced Bitcoin Core
testnet node (`bitcoin-cli` — confirmed absent on the operator's machine), so mempool.space is the
only testnet indexer actually reachable for this check. One indexer returning "not found" is
evidence, not proof — a name could still be claimed on a block the indexer hasn't caught up to, or by
a transaction not yet confirmed. Combined with the mainnet PASS above (a different indexer, same
name, same non-etched result), both reachable indexers independently show `BITCENT` unclaimed.

**R-12 status: evidence gathered, decision to proceed is the operator's, not asserted here.**
Whether "two indexers, non-conclusive" is sufficient to broadcast — versus first getting a synced
`ord`/Bitcoin Core node running for a fully conclusive local check — is a right-sized-mandate
judgment call (per `2026-07-30_control-authority-mandate-constitutional-security-model.md` §III.1:
required proof strength scales with irreversibility, and an etch is irreversible). This document
records the evidence; it does not rule R-12 closed on the operator's behalf.
