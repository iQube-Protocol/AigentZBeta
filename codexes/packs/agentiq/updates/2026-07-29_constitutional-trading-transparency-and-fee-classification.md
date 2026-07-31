# Constitutional Trading Transparency — the fee / market-fact ruling, implemented in settlement

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Scope:** simulation-first. No live LayerZero call, no Bitcoin transaction, no Base transaction, no
external venue call, no wallet integration.
**Resolves:** the two classes flagged-not-decided in
`codexes/packs/agentiq/updates/2026-07-29_qriptocent-cross-denomination-settlement.md` §*Fee classes*
**Amends:** `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md` §*Cent-for-cent parity*

---

## 1. The ratified principle

### Constitutional Trading Transparency Principle

> A financial transaction must distinguish observable market movement from provider compensation.
> Market movement is recorded as a market fact. Any spread, markup, premium, or differential
> deliberately retained by a provider is compensation and must be disclosed as a fee. No provider may
> attribute retained compensation to market conditions without separately proving the underlying
> market movement.

### Operational corollary

> Every consequential financial-services receipt must separate principal, market deviation, network
> cost, service fee, liquidity or finality premium, and provider-retained spread.

### The framing

> Market conditions may explain a price difference, but they must never be used to conceal
> compensation.

### The transparency standard

```text
reference value
+ observable market movement
+ explicit service fee
+ explicit liquidity/finality premium
= authorised total cost
```

No hidden spread. No unexplained slippage. No provider margin disguised as "the market."

**This is not a promise that markets will never move. It is a guarantee that the system will not lie
about why the customer paid more.**

---

## 2. The settlement ruling this slice implements

> **Parity governs the protocol principal. Fees pay for services and risk. Market deviations describe
> external conditions.**

Three different kinds of thing. Collapsing any two is the defect — and the two collapses fail in
opposite directions:

| Collapse | What it produces |
|---|---|
| **fee → market fact** | A charge laundered as "market pricing". The payer is charged, nobody is named as charging, and the amount is explained by a condition that did not cause it. |
| **market fact → fee** | An external observation admitted into the fee breakdown, which reimports an **exchange rate** into a layer that is deliberately cent-for-cent. Once a rate-shaped field exists among the fees, any spread can live in it. |

The resolution is explicitly **not** "add two more fee fields."

### 2.1 Principal stays cent-for-cent

`1 B¢ = 1 Base Q¢` at the protocol settlement layer, unchanged. `protocolRate` remains the **literal
type** `'1:1'` — not a number, not configurable — so there is no rate arithmetic anywhere that could
carry a spread. The amount transferred is never reduced through an undisclosed exchange rate or
hidden margin.

### 2.2 The timing/finality premium IS a fee — conditionally

It is a fee **when a participant, liquidity provider or service undertakes additional risk or
advances destination liquidity before ordinary source finality.** Three explicit classes:

- `finality-fee`
- `liquidity-advance-fee`
- `expedited-settlement-fee`

Each must be **quoted before authorisation**, **separately itemised from the principal**,
**attributed to the charging service**, **carried on the DVN receipt**, and **absent when no
accelerated service or liquidity advance was used**. That last one is the load-bearing condition: *a
fee that always appears is not a fee for a service.*

### 2.3 Two presentation forms — and the preferred one is the default

```text
Fee deducted from principal        Fee borne separately (PREFERRED, and the default)
Principal:           100 B¢        Principal delivered:  100 Base Q¢
Protocol conversion: 100 Base Q¢   Fee paid separately:    1 Base Q¢
Finality fee:          1 Base Q¢   Total payer cost:     101 B¢ equiv
Recipient receives:   99 Base Q¢
```

Both are modelled because both occur. `borne-separately` is preferred and is what an unstated
`bearing` means, for one reason: **the recipient receives the full authorised principal.**

Note the protocol conversion is cent-for-cent in **both** forms. What the deducted form reduces is
the *delivered* figure, and it may be reduced only by a fee that is itemised, attributed and
pre-quoted. Every other reduction is the undisclosed spread the layer exists to prevent.

### 2.4 Market deviation is a MARKET FACT, not a fee

`market-price-deviation`, `observed-spread`, `market-impact`, `external-execution-rate` are
**observations**. Nobody is charged, nobody receives them, and no ledger moves because of one. They
are structurally incapable of being amounts: an observation carries a **deviation in basis points**
and a venue, and has no `amountMinorUnits`, no `chargedByRef`, no `bearing`. They live in
`marketObservations` on the settlement — a structure the fee breakdown cannot reach.

### 2.5 Provider-retained spread IS a fee — the sharp line

> **A market movement is a market fact. A deliberately retained spread is a fee.**

Where a market maker or service intentionally quotes worse than the observed market or the protocol
reference and **retains the difference**, that retained amount is compensation — **even when
presented through an exchange rate** — and is disclosed as `provider-retained-spread-fee`.

Without this, any charge could be laundered as "market pricing." It is the loophole that matters, and
it is canaried directly.

**And the principle's last clause has a mechanism.** A provider may not attribute retained
compensation to market conditions without separately proving the underlying movement. So an
off-parity external execution is refused unless a `MarketObservation` naming **that same venue**
exists. *The execution record is the claim; the observation is the evidence, and a claim is not its
own evidence.* Without this, a provider asserts "the market moved", retains against the assertion,
and nobody ever has to evidence it — the same laundering one step further back, and *harder* to see
because the fee genuinely is disclosed.

### 2.6 Insufficient destination liquidity — four legitimate responses

`queue` · `route-to-approved-alternate-source` ·
`request-explicit-acceptance-of-external-execution` · `refuse`

> **It must never silently introduce slippage into the canonical settlement rate.**

There is deliberately no fifth member and none of the four is a rate adjustment. The responses are
**named on the exception** for the operator to choose; the amber/red liquidity bands already built
reach these four and never a rate change.

### 2.7 The canonical classification table — implemented as data

`SETTLEMENT_CLASSIFICATION_TABLE` in `services/qriptocent/settlement/classification.ts:126`:

| Situation | Classification | Recorded in | Needs payer acceptance |
|---|---|---|---|
| Principal conversion at 1:1 | settlement amount | principal | no |
| Network execution cost | network fee | fee breakdown | no |
| Liquidity advanced before finality | liquidity/finality fee | fee breakdown | no |
| Expedited service | expedited-settlement fee | fee breakdown | no |
| Secondary-market premium or discount | **market fact** | market-observation record | no |
| Provider-retained spread or markup | **fee** | fee breakdown | no |
| External venue execution away from parity | market execution result | market-observation record | **yes** |

The table is **load-bearing, not decoration**: the external-execution gate reads
`requiresExplicitAuthorisation('market-execution-result')` from it, and the refusal messages read
`recordedIn(...)`. Mutation **M5** flips that row and the canary fails — which is the proof it is data
and not a comment beside hard-coded logic.

---

## 3. The type split — fee vs market fact

| | Fee | Market fact |
|---|---|---|
| **Type** | `AttributedFee` — `types.ts:285` | `MarketObservation` — `types.ts:349` |
| **Classes** | `SETTLEMENT_FEE_CLASSES` — `types.ts:251` | `MARKET_OBSERVATION_CLASSES` — `types.ts:342` |
| **Carries** | `amountMinorUnits`, `chargedByRef`, `quoteRef`, `quotedAt`, `serviceRef`, `bearing`, `basis` | `observationClass`, `venueRef`, `deviationBps`, `observedAt`, `note` |
| **Lives on** | `feeBreakdown.attributedFees` — `types.ts:320` | `settlement.marketObservations` — `types.ts:488` |
| **Effect** | moves a ledger | moves nothing, ever |

The two class lists are **disjoint sets**, asserted directly. No market-deviation field is reachable
from the fee-breakdown type, asserted three ways: the disjointness of the constants; a structural
canary over the `SettlementFeeBreakdown` interface body itself (so a *future* field named
`marketDeviation` fails before any instruction carries one); and a runtime refusal that scans the
serialised breakdown — because the failure being guarded is *a new field appearing*, and a check that
only looks at fields it already knows about cannot see a new one.

### Where each rule is enforced

| Rule | Enforcement |
|---|---|
| Market deviation in the fee breakdown | `classification.ts:306` — refusal `market-deviation-in-fee-breakdown` |
| Fee not attributed / not pre-quoted | `classification.ts:327`, `classification.ts:335` |
| Timing fee with no accelerated service | `classification.ts:353` — refusal `timing-fee-without-accelerated-service` |
| Market observation carrying a charge | `classification.ts:377` |
| **Retained spread as a market fact** | `classification.ts:410` — refusal `retained-spread-recorded-as-market-fact` |
| **Market movement not separately proven** | `classification.ts:430` — refusal `market-movement-not-separately-proven` |
| External execution without acceptance | `classification.ts:442` |
| Gate call site | `settlement.ts:360` in `initiateSettlement` — **before any ledger effect** |
| After-the-fact re-check | `classification.ts:471` `classificationViolations`, called from `reconciliation.ts:451` |

**The gate and the reconciler check the same rules from different sides, deliberately.** The gate
reads an *instruction* and cannot know whether a liquidity advance was ever actually made; the
reconciler reads the *settled record* and cannot prevent anything. Neither alone is sufficient — and
mutation **M17** (drop the reconciler's re-check) is caught, so the overlap is real rather than
decorative.

---

## 4. Receipts — every component separately addressable

Two ratified texts each name **six** components, and they are not the same six:

| | The six |
|---|---|
| Settlement ruling §7 | principal · network · service · liquidity/finality · observed market deviation · externally authorised execution rate |
| Transparency corollary | principal · market deviation · network cost · service fee · liquidity or finality premium · **provider-retained spread** |

They share five and differ in one each. Reporting either alone would drop a line the other requires,
so `SettlementValueBreakdown` (`classification.ts:592`) carries their **union — seven lines** — of
which each ratified six is a subset that stays separately checkable
(`TRANSPARENCY_COROLLARY_COMPONENTS`, `SETTLEMENT_RULING_RECEIPT_COMPONENTS`).

```text
principalMinorUnits
observedMarketDeviation                     ← not an amount, by type
networkCostMinorUnits
serviceFeeMinorUnits
liquidityOrFinalityPremiumMinorUnits
providerRetainedSpreadMinorUnits            ← its OWN line
externallyAuthorisedExecutionRate           ← not an amount, by type
```

**The provider-retained spread does not fold into the service fee.** Folding it there would satisfy
"it is disclosed as a fee" while destroying the very distinction the principle exists to make: a
reader could no longer tell compensation retained out of a price difference from an ordinary service
charge. That is exactly what "no provider margin disguised as the market" means, and mutation **M11**
proves the split is enforced.

The two non-amount lines are **typed so they cannot become amounts** — a market fact has no addend to
contribute, which is what stops the seven collapsing back into one blended figure by addition.

`emitSettlementReceipt` refuses a breakdown that has lost a line
(`assertSixCategoriesDistinguished`, `classification.ts:698`). The debit receipt presents a blended
total *only alongside* the lines that take it apart again, and a canary re-derives the total from the
components in every run.

---

## 5. Liquidity shortfall — the four paths, and no fifth

`LIQUIDITY_SHORTFALL_RESPONSES` (`types.ts:439`) has exactly four members and none is a rate lever
(`shortfallResponsesAreExhaustive`). `shortfallResponsesFor(disposition)`
(`classification.ts:519`) maps the existing liquidity bands onto them:

| Band / disposition | Responses reachable |
|---|---|
| `permit` | none — nothing is short |
| `queue-or-split` (transaction too large for the band) | `queue`, `route-to-approved-alternate-source` |
| `requires-explicit-override` (RED) | all four |
| `refuse` | all four |

Its parameter is typed as `LiquidityDisposition` imported from `liquidity.ts`, so a **new** band
disposition is a compile error here rather than a silently unhandled case.

Both shortfall paths in `reserveDestinationLiquidity` (`settlement.ts:778`, `settlement.ts:786`) name
the permitted responses on the exception and state *"the 1:1 settlement rate is not among them"*.
Nothing on either branch touches `s.amountMinorUnits` — asserted behaviourally (S8, S13) **and**
structurally, by a canary that no module in the substrate assigns to a settlement amount at all.

---

## 6. Scenarios added

| ID | What it proves |
|---|---|
| **S9** `expedited-fee-borne-separately` | The PREFERRED form: fee quoted before authorisation, borne separately, **recipient receives the full authorised principal** (10000 in, 10000 delivered, payer pays 10112). |
| **S10** `finality-fee-deducted-from-principal` | The operator's worked example: 100 in, protocol conversion 100 at 1:1, finality fee 1, **recipient receives 99**; the fee is collected on the destination ledger where the principal it came out of was delivered. |
| **S11** `market-deviation-is-a-market-fact` | A 180 bps premium and a 35 bps spread observed; **not one fee anywhere**, both ledgers move by the principal exactly. |
| **S12** `external-execution-with-retained-spread-as-fee` | Payer accepts an off-parity path; the 60 bps movement is separately proven by an observation; the 25 retained is disclosed as a `provider-retained-spread-fee` **on its own receipt line**. |
| **S13** `shortfall-reaches-the-four-responses` | RED band: the four responses are named on the exception, principal and rate untouched. |

Thirteen scenarios total, all replay-stable, all reconciling with zero violations.

---

## 7. Verification

| Check | Result |
|---|---|
| Full suite | **181 files / 3137 tests passed** (baseline 181 / 3106 — 31 new canaries) |
| `npx tsc --noEmit` | Only the two pre-existing config errors (`iqube` type lib, `--ignoreDeprecations`). **No new errors.** |
| Mutation testing | **18 mutations, 18 caught by the named canary**; comment-only control correctly did not fail |

### Mutation table

Each mutation was verified to have actually applied (bytes on disk re-read after write, anchor
required to match exactly once, target test name required to appear in the run output) before any
result was recorded — false survivors have appeared on this codebase twice.

| # | Mutation | Result | Caught by |
|---|---|---|---|
| M1 | Admit a market-observation class into the fee-class list | CAUGHT | *classes are DISJOINT* |
| M2 | Stop refusing a market deviation in the fee breakdown | CAUGHT | *CATCHES a market deviation smuggled…* |
| M3 | Stop requiring a retained spread to be disclosed as a fee | CAUGHT | *CATCHES a retained spread recorded as a market fact* |
| M4 | Drop the separately-proven-market-movement requirement | CAUGHT | *CATCHES retained compensation attributed to a market movement nobody proved* |
| M5 | Flip the table row: off-parity execution needs no acceptance | CAUGHT | *CATCHES an off-parity external execution the payer never accepted* |
| M6 | Allow a timing fee with no accelerated service | CAUGHT | *CATCHES a timing fee charged when no accelerated service was used* |
| M7 | Let a fee be quoted AT the instant of authorisation | CAUGHT | *quoted at or after authorisation is refused* |
| M8 | Stop requiring a charging service to be named | CAUGHT | *no charging service named is refused* |
| M9 | Stop catching a liquidity-advance fee where no advance was made | CAUGHT | *liquidity-advance fee on a settlement that never advanced* |
| M10 | Deduct from principal even in the borne-separately form | CAUGHT | *PREFERRED form* |
| M11 | Fold the provider-retained spread back into the service fee | CAUGHT | *does NOT fold into the service fee* |
| M12 | Make the receipt-line guard a no-op | CAUGHT | *CANNOT present a blended figure* |
| M13 | Adjust the principal in response to a liquidity shortfall | CAUGHT | *the principal is not a lever* |
| M14 | Stop checking that a market observation moved no ledger | CAUGHT | *market observation that moved a ledger* |
| M15 | Accept any delivered figure once a fee is deducted | CAUGHT | *UNDISCLOSED reduction of the delivered principal* |
| M16 | Add a rate lever as a fifth shortfall response | CAUGHT | *four shortfall responses are exhaustive* |
| M17 | Drop the classification re-check from reconciliation | CAUGHT | *the gate and the reconciler check the same rules* |
| M18 | Make the gate refuse everything (guarding the guard) | CAUGHT | *returns null for a clean settlement* |
| M19 | Comment-only edit — **control**, must not fail | CONTROL-OK | — |

M18 is the guard-the-guard: without it, a refusal function that refused *everything* would make every
catch above pass vacuously.

### Required catches, all present

| Required catch | Canary |
|---|---|
| A retained spread recorded as a market fact | M3 |
| A market deviation placed in the fee breakdown | M2 |
| A liquidity shortfall altering the 1:1 principal | M13 |
| A fee appearing when no accelerated service was used | M6, M9 |
| A receipt blending the categories into one figure | M12 |
| External-venue execution without recorded authorisation | M5 |

---

## 8. House rules observed

- **DVN pipeline untouched.** No change to `ANCHORABLE_ACTION_TYPES`, the payload shape, the state
  machine, `hashPersonaRef` or principal resolution. **No new action types were needed** — the ruling
  changes what a receipt *carries*, not what kinds of act exist, so the twelve action types and their
  CHECK constraint are unchanged.
- **No SQL.** Nothing here writes to `activity_receipts`; these are fixture-mode simulation receipts
  and the existing runtime guard still throws on any persistence or anchoring attempt. **There is no
  migration to run.**
- **T0/T2.** Five new commitment derivations added to `refs.ts` — `settlementProviderRef`,
  `settlementServiceRef`, `settlementQuoteRef`, `settlementVenueRef`,
  `settlementExecutionAuthorisationRef` — each with its **own namespace**, because a charging service
  and the venue it quotes against are different kinds of thing and a disclosure that could not tell
  them apart would let a provider name itself as the venue whose movement supposedly justified its
  own retained spread. The existing no-raw-identifier canary covers all thirteen runs.
- **Determinism.** No `Date.now()`, no `Math.random()`; every timestamp is a fixture. Minor-unit
  decimal strings throughout, `BigInt` arithmetic, never a float.
- **Simulation-first.** No LayerZero, Bitcoin, Base or external venue call. An "external venue
  execution" is a recorded fixture, not a call.
- **Extended, not forked.** One new module (`classification.ts`) holding the ruling; the existing
  state machine, reconciler and receipt journal were extended in place. The shared journal /
  canonical-JSON primitives in `services/simulation/journal.ts` are reused unchanged.

---

## 9. The principle's reach — RECORDED, not built

The principle is ratified across the whole Financial Services Runtime. **This slice implements the
settlement layer only.** The following are its reach and are separate workstreams:

| Surface | What the principle requires of it |
|---|---|
| **MoneyPenny** | Disclose the market-fact / compensation distinction in composed transactions. |
| **CryptoSent** | Classify each component of every transaction it routes. |
| **Marketa** | Evaluate external agents on whether they preserve the distinction. |
| **DVN receipts** | Record market facts separately from fees (settlement's receipts now do; other producers do not yet). |
| **Standing** | Reward accurate disclosure; penalise concealed compensation. |
| **The Commons** | Hold reproducible proofs that a transaction was priced constitutionally. |

---

## 10. Flagged, not decided

1. **The principle's reach beyond settlement** (§9) is recorded but unbuilt. Each surface needs its
   own slice; none is implied by this one.
2. **`deviationBps` is a signed decimal string with no validator.** The substrate never does
   arithmetic on it — it is disclosure only — so a malformed value cannot move a ledger. A stricter
   format check belongs with whatever surface first *renders* a deviation.
3. **Basis-point granularity for market observations** is asserted, not calibrated. Whether bps is
   the right unit for every venue class is an operator question.
4. **The declared finality policy** (`bitcoin: 3`, `base: 30`) remains flagged from the previous
   build. Unchanged here, still a simulation policy rather than a ratified figure.
5. **"Route to an approved alternate liquidity source"** is a named response, not an implemented
   route. There is no second liquidity source in the substrate to route to; naming it keeps the
   response set honest and complete. Implementing routing is a separate slice.
