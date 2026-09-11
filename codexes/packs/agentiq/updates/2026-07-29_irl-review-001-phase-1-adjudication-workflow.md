# IRL-REVIEW-001 Phase 1 — the independence-review adjudication workflow and two-reviewer runner

**Date:** 2026-07-29
**Capability:** `IRL-REVIEW-001` — Independent Review
**Spec:** `codexes/packs/irl/foundation/SPEC-IRL-REVIEW-001_independent-review-capability.md`
**Phase 1 instantiation:** `codexes/packs/agentiq/updates/2026-07-29_external-review-rulings.md`
**Status:** built, canary-covered, **not run**. The operator triggers the live review.

---

## 1. What shipped

The general capability, plus its first template instance, plus a runner that refuses to
dispatch until every precondition holds.

| Concern | Where |
|---|---|
| Core objects (`ReviewRequest`, `ReviewPackage`, `ReviewerAssignment`, `ReviewDecision`, `ReviewResolution`), role authority | `services/research/review/types.ts` |
| Blinding — key scan + prose scan | `services/research/review/blinding.ts` |
| Determinism (canonical JSON, commitments, seeded sampling) | `services/research/review/deterministic.ts` |
| Independence rubric + reviewer prompt | `services/research/review/rubric.ts` |
| R1/R2 isolation gate | `services/research/review/isolation.ts` |
| Block-decision machinery + exception-rule constructors | `services/research/review/blockDecision.ts` |
| Asymmetric second-review coverage | `services/research/review/coverage.ts` |
| Private evidence — two-tier rule | `services/research/review/privateEvidence.ts` |
| Parsing, signing, resolution, contested queue | `services/research/review/adjudication.ts` |
| Frozen/hashed package + redacted preview | `services/research/review/reviewPackage.ts` |
| Model-lineage independence + catalogue verification | `services/research/review/reviewerIndependence.ts` |
| Provider seam (Venice / scripted / human) | `services/research/review/providers.ts` |
| DVN-anchorable review receipt | `services/research/review/receipt.ts` |
| The nine-step run | `services/research/review/runner.ts` |
| **EXP-P1 template instance** | `services/research/review/templates/expP1Admissibility.ts` |
| CLI | `scripts/run-independence-review.ts` |
| Canaries (82) | `tests/independent-review-capability.test.ts` |

**The generic layer names no instance.** A canary greps `services/research/review/*` (excluding
`templates/`) for `EXP-P1`, MoneyPenny, CryptoSent, QriptoCENT, Marketa, VL-CT-001 and "crystal",
and fails the build if one appears. EXP-P1 is the first *template instance*, not the capability's
hardcoded subject.

---

## 2. The provider interface, and the two models

```ts
interface ReviewProvider {
  readonly providerName: string;
  readonly supportsCatalogue: boolean;
  listModels(): Promise<ModelCatalogueEntry[]>;
  adjudicate(request: AdjudicationRequest): Promise<AdjudicationResponse>;
}
```

Three implementations, and the second and third are not decoration:

- **`createVeniceProvider()`** — the default external-model reviewer. Refuses at *construction*
  when `VENICE_API_KEY` is absent, with an explicit message. It does not skip the reviewer, fall
  back to another provider, or return an empty decision set that could be misread as "the reviewer
  found nothing".
- **`createScriptedProvider()`** — a deterministic stub. Every canary drives the *real* runner
  through it, with no network and no credential; that is what makes the seam demonstrably real
  rather than aspirational.
- **`createFileBackedProvider()`** — the human slot. The Independent Review Steward reviews the
  same frozen package with the same rubric and returns the same decision schema; the runner cannot
  tell the difference. `listModels()` refuses, so a human slot can never satisfy a distinct-family
  check by accident.

### The reviewer pair (operator ruling, fixed ids — not my selection)

| Slot | Fixed model id | Declared lineage |
|---|---|---|
| R1 | `llama-3.3-70b` | Meta Llama family |
| R2 | `qwen3-235b-a22b-instruct-2507` | Alibaba Qwen family |

Pinned in `EXP_P1_REVIEWER_PAIR` (`pairVersion: exp-p1-reviewer-pair-v1`). Before **each frozen
run** the runner calls `GET {VENICE_BASE_URL}/models?type=text` and verifies both ids: present, not
offline, no applicable deprecation date, resolving to **distinct family metadata**.

**Lineage evidence is read, never guessed.** `parseCatalogueEntry` looks for
`modelFamily`/`model_family`/`family`/`lineage`/`modelSource`/`model_source`, then falls back to
`owned_by`/`organization`; a hosting-URL value is normalised to its organisation segment. If none
of those fields is present, `family` is `null` and the run is **refused** (`unknown-model-lineage`).
The assignment records which field the family came from (`modelFamilyEvidence`) so a reader can
check the derivation rather than trust it. **I did not assert Venice's payload schema** — CLAUDE.md
forbids inventing values, so the parser fails closed on a shape it does not recognise instead of
guessing a plausible family name.

If either pinned id is unavailable: **the run is refused** and a versioned reviewer-pair amendment
is required. There is no substitution path, because a fallback is how both slots end up on the
provider's default model without anyone deciding to.

Enforced on every pair (`assertReviewerIndependence`): requested ids differ · resolved ids differ
(alias collision refused) · **families differ** · unresolved id fails closed · unknown lineage fails
closed · requested **and** resolved ids both recorded in the manifest and the receipt.

---

## 3. The Class C block decision

The ratified ruling is recorded **verbatim** in `CLASS_C_BLOCK_RULING` — a paraphrase of a ratified
ruling is not the ratified ruling, and the reviewer is being asked to review *that text*.

The output artifact carries: the **exact query** defining the population; namespace and creation-date
distributions; earliest and latest creation dates; the recorded fact that **task construction had
not begun**; a **per-namespace representative sample**; the **automatic recent-edit flag**
(`created-or-revised-after-cutoff`, cutoff `2026-07-27`); the **automatic target-vocabulary flag**
(`mentions-experiment-or-target`); an **unresolved-chronology-or-provenance** flag; and the
**extracted exception list** with the rule ids that fired.

Reported as:

```
402 assessed under the Class C rule
  → N admitted through the class decision
  → M flagged for individual review
```

Three properties make this stronger than "approved because they're in constitutional namespaces":

1. **A block with no exception rules is refused outright.** A ruling that cannot extract anything
   admits its population unconditionally, which is an assertion rather than a decision.
2. **`admitted` is computed** as `assessed − extracted.length`, is arithmetically checkable by any
   reader, and the package builder *refuses* a block whose admitted count is not the computed
   remainder. A zero-exception result is therefore an outcome, never a default — canaried by making
   a rule fire and asserting the count moves.
3. **The sample is per-namespace, not proportional.** A substantial part of the `engineering`
   doctrine in this corpus was derived from observed defects in our own pipeline — which *is* the
   target — so those rows are the likeliest exceptions in the whole population and are unremarkable
   to look at. A proportional sample of 402 rows would have returned mostly the innocuous majority.
   Per-namespace sampling guarantees a human sees engineering rows regardless of how small that
   namespace is relative to the whole.

**Note on the concentration risk:** the 43 commercialisation rows created in one IDE run on
2026-07-28 are *not* Class C (commercialisation is a domain namespace), so they are enumerated
individually in the package rather than entering under any block. Every one of them also trips
`created-or-revised-after-cutoff` as a mechanical flag, which makes them mandatory second-review
rows. The concentration is made visible, not averaged away.

---

## 4. How R1/R2 isolation is enforced

**Structurally, then at dispatch.** SPEC §14.5 is the requirement most easily lost to convenience:
handing R2 the first pass "so it can focus on the disagreements" is small, plausible and efficient
looking, and it silently converts dual review into confirmation — nothing errors and the contested
count *drops*, so the run looks better.

1. `ReviewerPromptInput` has **no field** capable of carrying another reviewer's decisions.
2. `assertPromptCarriesNoPriorAdjudication` re-reads the **final composed text** about to leave the
   process and refuses it if any prior adjudication is detectably present — matching on the output
   commitment, the raw-output ref, the rationale prose (≥12 chars), and the `subject: label`
   pairing a hand-built summary produces. Working on the final text is the only representation that
   cannot be bypassed by restructuring inputs.
3. The distinction the design turns on is stated executably in `isolation.ts`:
   `coverageMayDependOnPriorPass() === true`, `labelsMayCrossReviewers() === false`. **Which** rows
   R2 sees is derived from R1's pass; **what** R1 said about them is not.
4. R2's package view omits the block decisions entirely — less surface, and R2's job is rows.

---

## 5. Everything else the rulings required

- **Coverage** — R1 gets the complete package. R2 gets every exclusion, every `domain-adjacent`,
  every `unknown`, **every private-source row** (mandatory, never sampled — they reach the external
  reviewer through an intermediary summary, so the second pass is the only place the intermediation
  gets tested), every mechanically-flagged row, and a **seeded stratified sample** (rate 0.15, seed
  committed in the repo) of ordinary `independent` decisions. `assertCoverageComplete` refuses a
  dispatch with a gap.
- **Contested** — disagreement produces one `contested` row carrying **both labels verbatim**.
  `ReviewResolution` has no confidence field and no synthesised-label field, so there is nowhere for
  an average to live. A missing second pass on an assigned row is `contested`, not agreement.
  `unknown` from either side fails closed. Only `agreed` rows carry a relation into the exporter.
- **Private evidence** — `PrivateEvidenceSummary` exactly per rulings §2. `assessPrivateEvidence`
  returns `sufficient` or forces `unknown`; it **never returns an admissible label**, and no
  function in the module maps a summary to one — because the moment such a function exists someone
  calls it and the local reviewer has quietly become the decider. Insufficient / unverifiable /
  contradictory / unavailable → `unknown`. Over-disclosure (blinded keys, a raw UUID) is refused.
- **Blinding** — key scan **and** prose scan. The prose rule is the load-bearing one: "we need at
  least 200 rows" is not a field, and it is the single most damaging sentence a package could carry.
  Refused, with every violation reported rather than the first.
- **Target statement** — required. `buildReviewPackage` refuses without one, and refuses a target
  with no stated non-targets.
- **Reproducibility** — the pre-run manifest (both model ids, prompt version, rubric version,
  package hash, determinism settings, coverage seed) is built and returned **before the first model
  call**; canaried by observing call ordering. Raw outputs, parsed decisions, output hashes and
  timestamps are written after. No clock and no random source anywhere in the review modules —
  canaried by source scan.
- **Receipt** — `independent_review_completed`, with `ratifiesAsset: false`, `grantsStanding: false`,
  `changesLifecycle: false`, `freezesAsset: false` as **literal-typed data**, plus an
  `authorityNote`. A consumer that treats a review receipt as approval is behaving reasonably unless
  the record itself says otherwise, so the disclaimer lives in the data it is already parsing.
- **No reviewer writes** — canaried by source scan: no `@supabase` import, no `createClient`, no
  `.from('…')`, no lifecycle/Standing/canonize/freeze call shape anywhere in
  `services/research/review/`. Every role in `REVIEW_ROLE_AUTHORITY` has literal-`false`
  `mayEditSourceAssets`, `mayGrantStanding`, `mayCanonize`, `mayChangeLifecycle`.
- **Steward role** — `independent-review-steward` resolves contested cases; the operator resolves
  scope disputes and approves the freeze; the reviewer does neither. An **interim** steward must
  record *why*, or the run is refused — an interim arrangement that is never written down becomes
  the permanent one.

---

## 6. The vP1 namespace boundary now does work

`style` and `narrative` are **out** of the confirmatory population, with reasons recorded in
`EXP_P1_BOUNDARY_EXCLUSIONS` and mirrored into the crystal exporter's manifest as
`boundary_exclusions`. Excluded for **construct clarity, not lack of value** — both stay in the Live
Invariant Corpus for a later representation-quality or narrative-coherence experiment.

Worth noting explicitly: before this ruling the declared boundary excluded **nothing**. Every
namespace in the corpus was inside it, so the manifest's "outside the boundary" count was
structurally zero and the boundary was an inert declaration that looked like a control.

`EXP_P1_NAMESPACE_BOUNDARY` is **derived** from `INVARIANT_NAMESPACES` minus the ruled exclusions,
so a newly added namespace cannot silently miss every experiment. `scripts/export-crystal-snapshot.mjs`
is `.mjs` and cannot import TypeScript, so its copy is **canaried for parity** (registered in
`tests/source-of-truth-parity.test.ts`) rather than trusted.

---

## 7. Mutation table

25 mutations, each **verified applied on disk** before the run and **verified reverted** after, each
run with the full 82-test file collected (so a module-collection throw cannot masquerade as a pass).
Harness records `ANCHOR-NOT-FOUND` / `NO-OP` / `NOT-APPLIED` as distinct outcomes from `SURVIVED`.

| # | Mutation | Result | Canary that caught it |
|---|---|---|---|
| M1 | R2's prompt carries R1's decisions | **CAUGHT** (7) | dispatched R2 prompt contains no trace of the first pass |
| M1b | isolation gate neutered (`foreign = []`) | **CAUGHT** (1) | the isolation gate catches a leak wherever introduced |
| M2 | same model family accepted | **CAUGHT** (1) | refuses the same family even with different ids |
| M3 | aliases resolving to one model accepted | **CAUGHT** (1) | refuses two aliases that RESOLVE to the same model |
| M4 | package built without a target statement | **CAUGHT** (1) | refuses a package with no target statement |
| M5 | `standing` dropped from the key scan | **CAUGHT** (4) | refuses a package carrying Standing |
| M5b | prose scan removed | **CAUGHT** (2) | refuses a desired count written as PROSE |
| M6 | disagreement resolved by preferring R1 | **CAUGHT** (3) | two labels produce ONE contested row, both verbatim |
| M7 | a review module imports a DB client | **CAUGHT** (1) | imports no database client, issues no table query |
| M8 | `decisionIsSigned` always true | **CAUGHT** (5) | refuses a decision with no attribution |
| M9 | block `admitted` defaulted to `assessed` | **CAUGHT** (1) | the admitted count is COMPUTED, not a default |
| M9b | block with zero exception rules permitted | **CAUGHT** (1) | refuses a ruling that cannot fail |
| M10 | private-source rows sampled not mandatory | **CAUGHT** (1) | private-source reviewed twice even at sampleRate 0 |
| M11 | receipt claims ratification | **CAUGHT** (1) | four explicit negative facts on a fully agreed run |
| M12 | `style` re-enters the boundary | **CAUGHT** (3) | style and narrative are OUT |
| M12b | exporter boundary diverges from the template | **CAUGHT** (1) | the exporter agrees with the template |
| M13 | generic layer names EXP-P1 | **CAUGHT** (1) | no instance identifier outside `templates/` |
| M14 | missing credential degrades silently | **CAUGHT** (1) | provider refuses to construct without its credential |
| M15 | unavailable pinned model substitutes | **CAUGHT** (1) | REFUSES when a pinned id is absent |
| M15b | unknown lineage accepted | **CAUGHT** (1) | refuses offline / deprecated / undeterminable lineage |
| M16 | preview is a re-hashed separate projection | **CAUGHT** (2) | preview hash equals the dispatched package hash |
| M17 | pre-run manifest committed after the first call | **CAUGHT** (1) | manifest precedes both reviewer calls |
| M18 | a review module reads the clock | **CAUGHT** (1) | no `Date.now` / `Math.random` / `new Date` |
| M19 | package hash stops covering the body | **CAUGHT** (10) | target statement carried into the hash |
| M20 | a missing second pass reads as agreement | **CAUGHT** (1) | missing second pass is contested, not agreement |

**25 / 25 caught. 0 survived, 0 not-applied, 0 vacuous runs.**

Suite: **182 files / 3219 tests green**. `npx tsc --noEmit`: only the two pre-existing config
errors (`TS2688 iqube`, `TS5103 ignoreDeprecations`). `scripts/` is excluded from the root tsconfig,
so the CLI was typechecked separately against an including config — clean.

---

## 8. SQL to run — paste this into the Supabase SQL editor

`independent_review_completed` is added to `ActivityActionType` and to the DVN
`ANCHORABLE_ACTION_TYPES` set (the one change that file permits unilaterally — no state-machine,
hashing, payload-shape or principal-resolution change). The CHECK constraint is **rebuilt wholesale
from the current canonical union**, generated mechanically from
`services/receipts/activityReceiptService.ts` rather than hand-copied from an earlier migration.

File: `supabase/migrations/20260930000000_independent_review_receipt_type.sql`

```sql
ALTER TABLE activity_receipts DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check CHECK (action_type IN (
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
    'qriptocent_native_issuance_executed',
    'independent_review_completed'
));
```

---

## 9. Operator commands

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta && git fetch iqp dev && git checkout iqp/dev -- . && \
  npx tsx scripts/run-independence-review.ts --version=vP1 --preview
```

That is **plan mode** — it builds the Class C block decision, seals and hashes the package, verifies
the pinned reviewer pair against Venice's live catalogue, prints the redacted preview, and calls
nobody. To dispatch:

```bash
VENICE_API_KEY=<key> npx tsx scripts/run-independence-review.ts --version=vP1 --execute
```

With a human second reviewer instead of the Qwen slot:

```bash
VENICE_API_KEY=<key> npx tsx scripts/run-independence-review.ts --version=vP1 --execute \
  --steward=<steward-ref> \
  --r2-human=<steward-ref> --r2-decisions=./steward-decisions.json
```

---

## 10. Flagged rather than decided

1. **Venice's `/models` payload shape is unverified.** I could not reach the live catalogue from
   the build sandbox, and CLAUDE.md forbids guessing. The parser reads a list of *candidate* lineage
   fields and **fails closed** when none is present, so an unrecognised shape refuses the run rather
   than inventing a family. First live `--preview` will confirm the field names; if `family` comes
   back `null`, the fix is to add the real field name to `FAMILY_FIELDS`, not to relax the check.
2. **Both pinned model ids are operator-supplied and unverified against the live catalogue.** The
   runner verifies them at run time; nothing here asserts they exist today.
3. **Interim steward.** The first run records `interim: true` with a stated reason. It is a role
   assignment, not a code path, and the next run can see that the routine reviewer and the final
   governed authority were the same party.
4. **The 43 commercialisation rows from the single 2026-07-28 IDE run** all trip the recent-edit
   flag and become mandatory second-review rows. That is the intended visibility, but it means the
   honest eligible count for that namespace may be small. Per rulings §7: do not reprompt until a
   preferred population appears.
5. **`GENERAL_CONSTITUTIONAL_NAMESPACES` (10 values) is narrower than the vP1 boundary (13).** The
   three domain namespaces — `experience`, `finance`, `commercialisation` — are enumerated
   individually rather than entering under any block. That is deliberate, and it is why the Class C
   population is 402 rather than the whole in-boundary set.
