# QriptoCENT Cross-Denomination Settlement — constitution correction + the settlement primitive

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Scope:** simulation-first. No live LayerZero call, no Bitcoin transaction, no Base transaction, no
wallet integration, no reserve account, no mint execution.
**Amends:** `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md`

---

## 1. The correction

The supply constitution described additional-chain reach as *"lock on Base, issue wrapped Base Q¢
elsewhere"* and as *"bridged supply"*. That framing was **too narrow for this architecture and has
been replaced, not softened.**

QriptoCENT interoperability is a **cross-chain ledger settlement network**. Base Q¢ and B¢ each keep
their own native ledger, balances, issuance and settlement on their own network; LayerZero/DVN
carries **authenticated settlement instructions** between them. **The token does not move.** What
moves is an instruction, a proof of source-debit finality, an amount and denomination, sender and
beneficiary commitments, settlement and replay identifiers, and a destination credit instruction.
Economically value moves between denomination ledgers; technically each network settles natively.
**This is correspondent/inter-ledger settlement, not token bridging.**

### Before / after

| | Before | After |
|---|---|---|
| **The rule** | "Deployments on additional execution chains must either represent **bridged supply** from that issuance domain, or be separately named and governed denominations." | "A deployment on an additional execution chain is either a **DVN-settled representation** of that issuance domain or a **separately named and governed** denomination. It is never an unqualified second issuance of the same name." |
| **How to extend** | "**Interoperable representation** — lock on Base, issue wrapped Base Q¢ elsewhere." | Replaced by §*Interoperability is inter-ledger settlement, not token bridging*: source debit → DVN-verified message → destination credit from **native** liquidity. **No wrapped B¢ is created on Base.** |
| **Backing model** | Lock pool backing wrapped assets 1:1. | **Liquidity replaces lockups.** Sufficient native liquidity on each settlement network. Lockups disappear; liquidity and reconciliation do not — CryptoSent rebalances inventories, issues/redeems under policy, or routes offsetting flows. |
| **Rate** | Unstated. | **Cent-for-cent.** `1 B¢ = 1 Base Q¢ = one cent of reference value`. No speculative exchange rate, no intended slippage. Any difference must be explicitly classified and **never hidden inside a variable exchange rate**. |
| **The questions** | "How much is bridged? / Where is backing locked? / Is any representation double-counted?" | Native issued supply · circulating wallet balances · settlement-liquidity balances · pending inter-ledger obligations · completed cross-network flows · unresolved reconciliation exposure. |
| **Arbitrage** | Presented as *the* stabilising conversion pathway, adjacent to interoperability. | Explicitly separated: `DVN settlement = deterministic transactional interoperability` vs `arbitrage = market-based liquidity and price convergence`. Arbitrage replenishes scarce liquidity, exploits secondary-market discounts and balances inventories. **It is not the core payment mechanism.** |
| **DVN receipt list** | "issuance, redemption, **bridging** and settlement" | "issuance, redemption, settlement and **reconciliation**" |

### The constitutional rule, as recorded

> QriptoCENT interoperability shall operate through authenticated inter-ledger settlement rather than
> conventional wrapped-token bridging. Each canonical denomination maintains its own native ledger and
> supply. A cross-network payment consists of a source-side debit, a DVN-verified settlement message,
> and a destination-side credit from available native liquidity. The protocol settlement rate between
> QriptoCENT denominations is cent-for-cent; any fee must be separately disclosed. No cross-network
> payment may create duplicate spendable value, and every debit, message, credit, exception, and
> reconciliation must produce attributable DVN receipts.

**The corrected distinction:** canonical denominations are native ledgers and native supply;
cross-denomination transactions are DVN-mediated debit-and-credit settlement; wrapped
representations are **optional, not required**; and new issuance is a separate governed act, **never
implied by settlement messaging**.

---

## 2. Three constitutionally separate mechanisms

The liquidity problem does not justify returning to lock-and-mint. It justifies a control layer —
and a control layer that can mint is an issuer wearing a controller's name.

| # | Mechanism | Module | May it mint? |
|---|---|---|---|
| 1 | **Settlement** — moves value between native ledgers | `services/qriptocent/settlement/settlement.ts` | **Never** |
| 2 | **Liquidity assurance** — proves sufficiency, controls size, can slow or refuse | `services/qriptocent/settlement/liquidity.ts` | **Never** |
| 3 | **Issuance / replenishment** — creates native supply against proven reserves | `services/qriptocent/settlement/issuance.ts` | Yes — a governed act **even when automated** |

Separation is structural, not stylistic: mechanisms 1 and 2 do not import 3; 3 does not import 1;
only `issuance.ts` assigns `issuedMinorUnits`; only `referenceValue.ts` may write the reference
value. Four canaries in `AC-9` enforce each of those.

### Two invariants, side by side

> A destination credit exists only against a **finalised source debit** or an **explicitly
> authorised liquidity advance**. *(mechanism 1)*

> New issuance exists only against **separately proven and governed backing**. *(mechanism 3)*

Neither is a special case of the other, and neither may be satisfied by the other's evidence.

---

## 3. The state machine

`services/qriptocent/settlement/settlement.ts` — 990 lines.

```
initiated
  → source-debit-pending → source-debit-final
  → message-verified
  → destination-credit-pending → settled

failure / exception: expired · source-failed · destination-failed
                     reconciliation-required · reversed · failed
```

| Step | Function | file:line |
|---|---|---|
| Instruction accepted | `initiateSettlement` | `services/qriptocent/settlement/settlement.ts:269` |
| Authority + balance | `verifyAuthorityAndBalance` | `settlement.ts:~430` |
| Source debit | `initiateSourceDebit` | `settlement.ts:~455` |
| Finality | `finaliseSourceDebit` | `settlement.ts:500` |
| DVN message | `verifySettlementMessage` | `settlement.ts:587` |
| Liquidity reserve (mechanism 2 gate) | `reserveDestinationLiquidity` | `settlement.ts:645` |
| **The credit gate** | `completeDestinationCredit` | `settlement.ts:741` |
| Destination failure | `failDestinationCredit` | `settlement.ts:833` |
| Timeout | `expireSettlement` | `settlement.ts:868` |
| The one question every failure asks | `valueHasLeftThePayer` | `settlement.ts:214` |
| Band controller | `liquidityBand` / `maximumSettlementSize` / `assessLiquidity` | `liquidity.ts:97` / `:110` / `:157` |
| Governed replenishment | `authoriseReplenishment` | `issuance.ts:133` |
| Reference-value derivation | `mintUnitsForProvenBacking` | `referenceValue.ts:75` |
| Presentation | `presentSettlement` | `reconciliation.ts:114` |
| Fee/parity identities | `feeAndParityViolations` | `reconciliation.ts:162` |
| Settlement-never-mints proof | `settlementMintsNothing` | `reconciliation.ts:254` |
| Bilateral reconciliation | `reconcileBook` | `reconciliation.ts:284` |

### How the exactly-once invariant is enforced

Six independent mechanisms, because each one alone is defeatable:

1. **Unique settlement ids** — a second `initiateSettlement` with the same id is refused outright.
2. **Instruction consumption** (`consumedInstructionRefs`) — consumed **on acceptance only**. A
   refusal consumes nothing, so a transient refusal never becomes permanent, while an accepted
   instruction can never be presented again.
3. **Nonce binding** — a nonce is bound to exactly one settlement at acceptance; a message carrying
   another settlement's nonce is refused.
4. **Message consumption** (`consumedMessageRefs`) — **the replay defence**. A replayed DVN message
   is refused at verification and can never reach a credit.
5. **Credit consumption + the state gate** — `consumedCreditRefs` *and* `state === 'settled'`, two
   independent checks, because a replay that defeats one must still defeat the other.
6. **The finality gate reads `sourceDebitFinalisedAt`, never the state label.** Labels advance
   (`source-debit-final` → `message-verified` → `destination-credit-pending`), so a gate reading the
   label would silently open the moment the label moved on. The timestamp is the fact; the label is
   a summary of where the process is. Mutation **M6** exists specifically to prove this.

### The partial-state canary

`AC-6` in `tests/qriptocent-settlement-substrate.test.ts`. Constitutional atomicity is impossible
between Bitcoin and Base, so it is expressed as states plus one presentation rule:

> A partial state may never be presented as final settlement. If a source debit is final but the
> destination credit fails, the transaction becomes a **reconciliation obligation, not a silent
> loss.**

- A destination failure after a final debit → `reconciliation-required`, **not** `destination-failed`
  — with the disclosure reporting `finalSettlement: false`, `disposition:
  'obligation-outstanding'`, and the obligation naming the payer and the amount.
- A timeout after the payer was debited → `reconciliation-required`, **not** `expired`. `expired`
  means "nothing happened" and is available only when nothing happened.
- Exhaustively over all **twelve** states: `finalSettlement` is true for `settled` and for nothing
  else, and no other state's disposition reads as `settled`.
- `reconcileBook` catches a value-committed settlement parked in any terminal state, so a defect
  that bypasses the state machine still fails reconciliation.

### Supply consequence

`cross-chain payment ≠ new issuance`. Settlement **reallocates capacity between ledgers**; it never
mints. Every scenario's `nativeIssuedSupply` is byte-identical before and after
(`settlementMintsNothing`), and the six figures are reported **separately** — collapsing them into
one "supply" number is how a settlement network starts looking like an issuer.

Ledger conservation identity, checked in every run:

```
Σ wallet balances + settlement liquidity + fees collected  ===  issued supply
```

---

## 4. Liquidity bands and transaction-size control

`services/qriptocent/settlement/liquidity.ts:97` (`liquidityBand`), `:110`
(`maximumSettlementSize`), `:157` (`assessLiquidity`). Consulted by `reserveDestinationLiquidity`
**before** any reservation, and able to return only permit / queue-or-split /
requires-explicit-override / refuse.

| Band | Condition | Behaviour |
|---|---|---|
| **Green** | `available > target operating buffer` | ordinary settlement, normal limits, no replenishment |
| **Amber** | `minimum < available ≤ target buffer` | reduced limits, larger transactions queued or split, replenishment triggered, proof frequency increased |
| **Red** | `available ≤ minimum` | no ordinary destination credits; only explicitly authorised emergency/priority settlements; otherwise **fail closed** |

```
maximum settlement = available liquidity × permitted exposure ratio
```

> No individual settlement may consume a constitutionally unsafe proportion of destination liquidity.

Ratios are held in **basis points** (integers), so the calculation is exact and truncation is always
downward — a limit that rounds up admits the one transaction it exists to exclude.

**When the destination is short, the settlement path refuses. It does not reach for the issuance
module.** That is the prohibited collapse of mechanisms 1, 2 and 3, and `AC-9` asserts that the
shortfall scenario mints nothing.

---

## 5. Proof interfaces (modelled, not called)

`services/qriptocent/settlement/proofs.ts`. Each takes a **private attestation** (server-internal,
never serialised) and returns a **minimal public result**.

1. **Destination liquidity** — attests over spendable liquidity, reserved-but-unsettled obligations,
   the minimum operating threshold, pending settlement exposure, reserve backing available for
   replenishment, and whether the request is within policy. Public result is exactly:
   `liquidity sufficient: true · threshold state: healthy · proof valid: true`. `AC-12` asserts that
   **no attestation figure appears anywhere in the emitted proof object**, and that
   `liquiditySufficient: false` with `proofValid: true` is a coherent outcome — collapsing the two
   would report a real shortfall as a technical fault.
2. **Reserve-backed replenishment** — `backingUsdCentsProven` is the **settled** reserve and nothing
   else. Unfinalised transfers and projected inflows are excluded *and listed* on the proof, so a
   reader sees what was left out rather than having to know what should have been.
3. **Settlement correctness + exactly-once consumption** — five clauses (source debit finalised;
   destination credit matches the same instruction; consumed once; amounts reconcile cent-for-cent;
   disclosed fees explain any difference), with `proofValid` their **conjunction**, never an
   independently-set flag.

---

## 6. Governed auto-replenishment — conditional issuance

```
liquidity approaches threshold → proof confirms amber/red → reserve proof confirms backing
→ replenishment policy authorises → mint against reserves → issuance receipt + reserve proof
→ liquidity restored
```

**Reserve proof precedes minting**, checked in order at `issuance.ts:133`. Minting first and proving
after produces the same final state on a good day and unbacked supply on a bad one, and the balances
look identical either way.

### How the mint amount derives from the reference value

`referenceValue.ts:46` holds a **frozen** table: `1 Q¢ = $0.01 = 1 USD cent`, expressed as
`usdCentsPerMinorUnit: '1'` so the arithmetic stays integral.

```
mintMinorUnits = backingUsdCents ÷ usdCentsPerMinorUnit

$10,000 proven  →  1,000,000 USD cents ÷ 1  =  1,000,000 Q¢
```

The figure **falls out of** `1 Q¢ = $0.01`; it is nowhere a constant in the controller. Division is
exact-integer only — backing that does not divide evenly is **refused, never rounded**, because
rounding down strands backing and rounding up mints against value that was never proven. The
derivation string travels onto the issuance receipt, so the receipt shows the arithmetic rather than
asserting the figure.

`Object.freeze` plus the `AC-9` source canary make **the liquidity controller altering the reference
value** structurally impossible: a controller that can move the peg can mint any quantity while
every arithmetic check still passes.

Policy has explicit caps and rate limits; the denomination's governed maximum binds **absolutely** —
no emergency override reaches it; emergency overrides must be attributable.

---

## 7. Fees — no hidden spread

Four categories: **network · service · liquidity · reconciliation/exception**.

The identities that keep it honest compare two **independently recorded** ledger movements against
the declared intent:

```
sourceDebited        === amount + Σ disclosed fees
destinationCredited  === amount                      (exact STRING equality)
```

If `10.00` is debited and `9.98` credited, the `0.02` must be an explicit fee with a payer, a
beneficiary, a basis and a receipt. `protocolRate` is the **literal type** `'1:1'` — not a number,
not configurable — so there is no rate anywhere for a spread to hide in, and `AC-7` greps
`settlement.ts` for `exchangeRate`, `conversionRate`, `spread` and `slippage`.

---

## 8. Receipts

Twelve DVN-anchorable action types. **Nine settlement, one liquidity assurance, two issuance** — the
issuance pair carries distinct types on purpose, because a mint recorded under a settlement type
would let new supply be read as a payment.

Evidence chain (asserted in emission order by `AC-13`):

```
passport-backed authority → payment instruction → source ledger debit → DVN message
→ destination ledger credit → bilateral reconciliation → settlement receipts
```

In a lock-and-mint bridge the lock contract is the evidence. **This architecture has no lock pool,
so the receipt chain IS the evidence** that a credit was backed. A credit whose source debit
produced no receipt is indistinguishable, after the fact, from value created out of nothing.

**Fixture mode.** Four distinct states, and conflating any two is the defect: receipt object
generated — YES; hash computed — YES; persisted — **NO**; DVN-anchored — **NO**. The last two are
held by a runtime guard shared with the venture substrate
(`services/simulation/journal.ts`), which **throws** rather than warning.

### DVN pipeline

Action-type additions only — the one change CLAUDE.md permits unilaterally. Payload shape, state
machine, `hashPersonaRef` and principal resolution untouched.

---

## 9. Reuse, not fork

The venture substrate's receipt, determinism and commitment-ref patterns are **reused**, not copied:

- **Ref derivation** — `personaPublicRef` / `constitutionalRef` from
  `services/identity/personaReferences.ts`, the same canonical derivations the DVN pipeline uses.
- **Raw-identifier detection** — `RAW_UUID_PATTERN` / `containsRawIdentifier` **moved** into
  `services/identity/personaReferences.ts` and re-exported from `services/venture/trading/refs.ts`.
  One definition, three consumers.
- **Canonical JSON, the record hash, and the fixture-mode egress guard** — **moved** into
  `services/simulation/journal.ts`. The venture substrate delegates and keeps
  `VentureFixtureModeViolation` as a subclass, so its `instanceof` contract and message are
  unchanged; the settlement substrate supplies `SettlementFixtureModeViolation` the same way. The
  decision itself exists once.

---

## 10. Verification

| Check | Result |
|---|---|
| Full suite | **181 files / 3106 tests, green** (baseline 180 / 2978; +1 file, +92 settlement canaries, +36 from concurrent venture work on this branch) |
| `npx tsc --noEmit` | no new errors — the two pre-existing config errors only (`TS2688 iqube`, `TS5103 ignoreDeprecations`) |
| Mutation testing | 24 mutations, **24 applied, 24 caught, 0 survivors** |

### Mutation table

Every row was verified as **actually applied** (exact single-occurrence match, plus the mutated text
re-read from disk) and every run **collected all 92 tests** — a module-collection throw emits no
per-test marker and would otherwise read as a survivor.

| # | Mutation | Applied | Collected | Caught by |
|---|---|:---:|:---:|---|
| M1 | replayed DVN message accepted (double-credit) | ✅ | 92 | AC-4 *a replayed DVN message is refused and never reaches a credit* |
| M2 | settled settlement credited a second time | ✅ | 92 | AC-4 *a second credit against a settled settlement is refused* |
| M3 | destination credit reference reused | ✅ | 92 | AC-4 *a credit REFERENCE cannot be reused, independently of the state gate* |
| M4 | accepted instruction replayed | ✅ | 92 | AC-4 *a replayed INSTRUCTION is refused* |
| M5 | credit without a finalised source debit | ✅ | 92 | AC-5 *a credit before source finality is refused* |
| M6 | finality gate reads the STATE LABEL, not the timestamp | ✅ | 92 | AC-3 / AC-5 (18 failures) |
| M7 | post-debit timeout filed as `expired` | ✅ | 92 | AC-6 *a timeout AFTER the payer was debited is an obligation, never `expired`* |
| M8 | post-debit destination failure filed as `destination-failed` | ✅ | 92 | AC-6 *a destination failure AFTER a final debit becomes a reconciliation obligation* |
| M9 | a partial state reads as final settlement | ✅ | 92 | AC-3 *`settled` is the ONLY state that reads as final settlement* |
| M10 | settlement mints to cover a destination shortfall | ✅ | 92 | AC-8 *the settlement module never writes issuedMinorUnits* |
| M11 | fee absorbed into the credit (10.00 in, 9.98 out) | ✅ | 92 | AC-3 / AC-7 (5 failures) |
| M12 | undisclosed charge taken from the payer | ✅ | 92 | AC-3 / AC-7 / AC-15 (8 failures) |
| M13 | RED band does not fail closed | ✅ | 92 | AC-9 *a low destination ledger REFUSES instead of minting* |
| M14 | per-transaction exposure limit removed | ✅ | 92 | AC-10 *the exposure ratio TIGHTENS as liquidity falls* |
| M15 | minting with no reserve proof | ✅ | 92 | AC-11 *REFUSES minting before reserve proof* |
| M16 | minting on an unfinalised reserve transfer | ✅ | 92 | AC-11 *REFUSES minting on an unfinalised reserve transfer* |
| M17 | projected inflows counted as reserves | ✅ | 92 | AC-11 *PROJECTED INFLOWS are not reserves* |
| M18 | auto-mint policy cap removed | ✅ | 92 | AC-11 *REFUSES a mint that exceeds the policy cap or the rate limit* |
| M19 | liquidity controller alters the reference value | ✅ | 92 | AC-9 *no module but referenceValue.ts may write the reference value* |
| M20 | fixture journal persisted to the live trail | ✅ | 92 | AC-13 *a fixture journal cannot persist, and never reaches the writer* |
| M21 | raw T0 identifier accepted into a settlement record | ✅ | 92 | AC-2 *an instruction carrying a raw payer id is REFUSED, not sanitised* |
| M22 | substrate reads a clock | ✅ | 92 | AC-14 *no module reads a clock or a random source* |
| M23 | a nonce bound to more than one settlement | ✅ | 92 | AC-4 *a nonce belongs to exactly one settlement, forever* |
| M24 | issuance recorded under a settlement action type | ✅ | 92 | AC-11 *records the mint as ISSUANCE with the arithmetic on the receipt* |

### The required catches, all present

| Required refusal | Mutation | Canary |
|---|---|---|
| a replayed message crediting twice | M1 | AC-4 |
| destination credit without final source debit | M5, M6 | AC-5 |
| a partial state reported as settled | M7, M8, M9 | AC-6 |
| settlement minting supply | M10 | AC-8 / AC-9 |
| a fee absorbed into an implied rate | M11, M12 | AC-7 |
| consuming one settlement instruction twice | M2, M3, M4, M23 | AC-4 |
| low liquidity → silent credit called settlement | M10, M13 | AC-9 |
| minting before reserve proof | M15 | AC-11 |
| minting on an unfinalised reserve transfer | M16 | AC-11 |
| projected inflows treated as current reserves | M17 | AC-11 |
| auto-mint exceeding policy limits | M18 | AC-11 |
| the liquidity controller altering the reference value | M19 | AC-9 |

---

## 11. FLAGGED — not decided

These are recorded rather than resolved. None is a default someone chose quietly.

1. **Finality policy** (`settlement.ts` `DECLARED_FINALITY_POLICY`: bitcoin 3, base 30). The
   substrate's **declared simulation policy**, not a claim about either network's real finality.
   Injectable per book. **Operator ruling required** before any live phase.
2. **Exposure ratios** (`liquidity.ts` `ILLUSTRATIVE_EXPOSURE_BPS`: green 500 bps, amber 100 bps, red
   0). Encoded from the extension's illustrative figures and **explicitly named illustrative**.
   **Calibration required**; they are not ratified.
3. **Liquidity thresholds** (`ILLUSTRATIVE_LIQUIDITY_POLICY`: target 5,000,000, minimum 1,000,000
   minor units) and **replenishment caps** (`ILLUSTRATIVE_REPLENISHMENT_POLICY`: 5,000,000 per
   authorisation, 20,000,000 cumulative, 4 authorisations per window). Same status.
4. **Two fee classes have no field.** The constitution names *timing/finality premium* and *market
   deviation outside the protocol rate*; the extension names four fee **categories** (network,
   service, liquidity, reconciliation/exception), which are the four implemented. The remaining two
   are **not** silently mapped onto `serviceFee` — that would be the exact misclassification the
   constitution prohibits. **Operator ruling required**: are they fees (belonging in the breakdown)
   or market facts outside the protocol rate (belonging nowhere near it)?
5. **No live-emission compatibility gate for the settlement action types.** The venture substrate has
   one (`receiptCompatibility.ts` + its probe migration). Settlement is fixture-only and its journal
   guard refuses every write, so nothing can reach the constraint today. **Before Phase 2 opens live
   emission, that gate must be extended to cover the twelve settlement types** — building a second
   copy of it now would be the parallel implementation `inv.engineering.036/037` prohibits.
6. **DVN pipeline** — action-type additions only. Anything touching payload shape, the state machine,
   `hashPersonaRef` or principal resolution was **not** attempted and requires operator approval.
7. **Concurrent work on this branch.** Another session committed venture-substrate changes
   (`3da93dfc1`, `03c6f32aa`, `a7dd4a4ec`, `b003de4c0`) between this session's commits. Their work is
   included in the 3106-test figure. Nothing in this build touches their files beyond the two
   action-type registries.

---

## 12. SQL to run

Apply in the Supabase SQL editor. It rebuilds the `activity_receipts` action-type CHECK constraint
in full (the established pattern — the latest rebuild is always the complete vocabulary), adding the
twelve QriptoCENT settlement types.

```sql
ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued',
    'specialist_consulted',
    'artifact_created',
    'artifact_published',
    'artifact_sent',
    'approval_granted',
    'approval_rejected',
    'experience_model_updated',
    'session_started',
    'session_completed',
    'passport_application_submitted',
    'passport_issued',
    'passport_status_changed',
    'passport_revoked',
    'passport_privilege_changed',
    'passport_infraction_recorded',
    'governance_decision_ratified',
    'governance_decision_amended',
    'governance_authority_exercised',
    'governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'operator_action_logged',
    'standing_document_added',
    'partner_agent_evidence_recorded',
    'agent_delegated',
    'agent_delegation_revoked',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated',
    'consequence_forecast_recorded',
    'knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'capability_registered',
    'capability_operationally_validated',
    'capability_deprecated',
    'research_lifecycle_transition',
    'experiment_result_published',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'canonical_plate_composed',
    'plan_cancelled',
    'venture_blueprint_handoff',
    'standing_accrued',
    'standing_corrected',
    'workspace_report_published',
    'venture_opportunity_opened',
    'venture_service_completed',
    'venture_completion_assessed',
    'venture_refusal_recorded',
    'venture_obligation_earned',
    'venture_obligation_approved',
    'venture_settlement_simulated',
    'venture_obligation_reversed',
    'venture_opportunity_closed',
    -- QriptoCENT cross-denomination settlement (2026-07-29).
    'qriptocent_payment_instruction_accepted',
    'qriptocent_settlement_authority_verified',
    'qriptocent_source_debit_initiated',
    'qriptocent_source_debit_finalised',
    'qriptocent_settlement_message_verified',
    'qriptocent_destination_liquidity_reserved',
    'qriptocent_destination_credit_completed',
    'qriptocent_settlement_reconciled',
    'qriptocent_settlement_exception_recorded',
    'qriptocent_liquidity_proof_verified',
    'qriptocent_replenishment_authorised',
    'qriptocent_native_issuance_executed'
));
```

Migration file: `supabase/migrations/20260929000300_qriptocent_settlement_receipt_types.sql`.

---

## 13. Files

| File | Lines | Role |
|---|---:|---|
| `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md` | — | **amended** — the settlement model replaces the bridge framing |
| `services/qriptocent/settlement/types.ts` | 321 | schema, states, fee classes, refusals |
| `services/qriptocent/settlement/refs.ts` | 89 | T0/T2 commitment derivation |
| `services/qriptocent/settlement/receipts.ts` | 305 | twelve action types, fixture guard, journal |
| `services/qriptocent/settlement/settlement.ts` | 990 | the state machine and the accounting invariant |
| `services/qriptocent/settlement/liquidity.ts` | 227 | bands, exposure limits, the assurance gate |
| `services/qriptocent/settlement/proofs.ts` | 285 | three proof interfaces, modelled |
| `services/qriptocent/settlement/issuance.ts` | 283 | governed replenishment |
| `services/qriptocent/settlement/referenceValue.ts` | 99 | frozen reference value + mint derivation |
| `services/qriptocent/settlement/reconciliation.ts` | 413 | presentation, supply report, bilateral reconciliation |
| `services/qriptocent/settlement/scenarios.ts` | 467 | eight deterministic scenarios |
| `services/qriptocent/settlement/replay.ts` | 289 | runner, fingerprint, replay stability |
| `services/simulation/journal.ts` | 118 | **promoted** — canonical JSON, record hash, fixture guard |
| `tests/qriptocent-settlement-substrate.test.ts` | — | 92 canaries, AC-1 … AC-16 |
| `supabase/migrations/20260929000300_qriptocent_settlement_receipt_types.sql` | — | constraint rebuild |
