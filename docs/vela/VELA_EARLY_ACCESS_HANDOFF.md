# VELA-001 Early Access Handoff — MoneyPenny × Vela: Confidential Constitutional Execution

**Date:** 2026-08-22
**Status:** Local architecture proven end to end, live, against the real Vela v0.2.0 stack. Code-complete through Slice 2G. **The remaining external milestone is real Vela TEE attestation (production Nitro hardware) — not another local architecture pass.**

This is the single entry point for anyone picking up VELA-001 next: what exists, what has been proven live, where the seams are, and exactly what remains.

**Frozen local state, operator-ratified 2026-08-22:**

```
VELA-001
LOCAL_PROTOCOL:              LIVE-PROVEN
CONSEQUENCE ONTOLOGY:        FROZEN
AUTHORISATION INTEGRATION:   LIVE-PROVEN
BOUNDED EXECUTION BINDING:   LIVE-PROVEN
OBSERVED CONSEQUENCE:        LIVE-PROVEN
PROJECTION VALIDATION:       LIVE-PROVEN
PRODUCTION TEE ATTESTATION:  NOT YET PROVEN
```

No further local architecture work is authorized against this state — extend downstream (VELA-002, §9) or against a real attested deployment, not by reopening the ontology or the local proof.

---

## 1. What VELA-001 is

MoneyPenny's Financial Services Runtime gains a confidential-compute component: certain financial actions can condition their constitutional authorisation on evidence computed **inside a TEE (Trusted Execution Environment)**, so private inputs (balances, exposure, spend limits) never leave the enclave in the clear, while the constitutional decision they inform stays fully auditable.

**Two invariants govern everything below, and neither is negotiable:**

1. **Authority is constitutional. Authorisation is conditional.** `Consequential Authority ∩ Acceptable Consequence Projection = Action Authorised`.
2. **Vela informs authorisation. It never establishes it.** A confidential verdict is one input to a composed projection; the projection's disposition — not the raw Vela verdict — is what authorisation reads.

## 2. The canonical sequence (built, tested, proven live)

```
Personhood → Authority → Mandate → Proposed Action
    → Consequence Projection (public + confidential, composed)
    → Action Authorisation
    → Bounded Execution (intent only — never signs/broadcasts)
    → Observed Consequence
    → Consequence Validation
    → Receipt / DVN evidence
```

Every arrow above is a real, tested, and (where marked) live-proven module — not a design sketch.

## 3. Module map

| Plane | Module | What it does |
|---|---|---|
| Ontology | `types/constitutionalCommerce.ts` | The six frozen types: `ConstitutionalAuthority`, `ProposedAction`, `ConsequenceProjection`, `ActionAuthorisation`, `CommerceExecution`, `ObservedConsequence`. **Frozen as of Slice 2G** — extend by composition, never fork. |
| Domain seam | `types/confidentialProjection.ts` | Provider-neutral confidential-projection contract. No Vela concepts leak through this boundary. |
| Vela wire layer | `services/vela/velaTypes.ts`, `velaConfig.ts`, `velaClientAdapter.ts`, `velaTestTransport.ts` | ECDH(P-521)→HKDF-SHA256→AES-256-GCM crypto (byte-verified against `vela/pkg/crypto/cipher.go`), the real on-chain transport, and a deterministic test transport for CI. |
| Provider | `services/vela/velaProjectionProvider.ts` | `VelaConfidentialProjectionProvider` — the ONLY module that sees both Vela wire concepts and the domain seam. Cannot return an authorisation; cannot claim an attestation it didn't verify. |
| Confidential app | `services/vela/wasm/projector/` (TinyGo/WASM) | The MoneyPenny Confidential Consequence Projector — deterministic pure comparison, verdict-only output. sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`. |
| Composition | `services/constitutionalCommerce/unifiedConsequenceProjection.ts` | Composes CFS-006a's public forecast with confidential evidence into one `ConsequenceProjection`. Owned by neither side. Precedence `UNACCEPTABLE > UNRESOLVED > ACCEPTABLE`; `completeness`/`unresolvedComponents` tracked independently so a refusal is never hidden behind unresolved evidence. |
| Governance gate | `services/registry/capabilityInvocationGates.ts` (Gate 2) | ONE narrow, capability-id-scoped exception inside the existing authoritative-mode block. **FROZEN as of Slice 2F/2G — do not touch, do not add a second path.** |
| Authorisation | `services/constitutionalCommerce/actionAuthorisation.ts` | `deriveActionAuthorisation()` — the actual `Consequential Authority ∩ Acceptable Consequence Projection` derivation. Independent of, and downstream of, Gate 2's `allow`. |
| Execution | `services/constitutionalCommerce/boundedExecution.ts` | `bindExecution()` — binds an intent to a current `AUTHORISED` authorisation. **Never signs or broadcasts** (mirrors `settlementExecutor.ts`). |
| Observation/Validation | `services/constitutionalCommerce/observedConsequence.ts` | `compareProjectionToObservation()` / `recordObservedConsequence()` — `MATCHED_PROJECTION \| DIVERGED_FROM_PROJECTION \| UNRESOLVED`. |
| Causal chain | `services/constitutionalCommerce/causalChain.ts` | Read-only projection over the above records — every ref, from existing objects only, no duplication. |
| Receipts | `services/constitutionalCommerce/commerceReceipts.ts` | Six `ActivityActionType`s, DVN-anchorable, real call sites. |

## 4. What is proven, and how

| Claim | Proof |
|---|---|
| The crypto layer matches Vela exactly | Byte-for-byte verified against `vela/pkg/crypto/cipher.go` (pinned v0.2.0 source) |
| Confidential projection is genuinely confidential, bounded (never total) | `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` |
| Local ≠ production attestation, structurally | `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`; `protocolExecutionVerified`/`teeAttestationVerified` are independent booleans everywhere, never one inferred from the other |
| CFS-006a and VELA-001 compose, never duplicate | `docs/vela/CONSEQUENCE-ONTOLOGY-001.md` |
| Full traversal, ACCEPTABLE/UNACCEPTABLE/UNRESOLVED, real enclave | `2026-08-22_vela-001-slice-2f-gate2-authorisation.md` — 20/20, `applicationId 2089125378143059424` (now redeployed as `7738404303895312998`, see §6) |
| Execution/observation/validation/receipts, all three cases, real enclave | `2026-08-22_vela-001-slice-2g-execution-observation-validation.md` — 20/20 deterministic+live, plus a standalone narrated proof with the full reference chain persisted at `2026-08-22_vela-001-slice-2g-live-proof-evidence.json` |
| The CHECK-constraint migration rejects no legacy row | Static superset proof across all 41 historical constraint-rebuild migrations (see the Slice 2G doc's "Pre-deployment CHECK-constraint legacy verification" — no live Supabase in this sandbox, so this is the honest substitute, and it is exhaustive rather than sampled) — **qualified below: this is branch-level evidence, not a substitute for the live pre-deployment gate.** |

### 4a. Required pre-deployment gate — run this against dev before the migration touches a live DB

The static superset proof is sufficient evidence for the branch. It is **not** a substitute for checking the actual live table. Before `supabase/migrations/20260930010100_commerce_authorisation_execution_consequence_receipt_types.sql` (or any later migration that further rebuilds `activity_receipts_action_type_check`) is applied to a live database, run this against that database — it must return **zero rows**:

```sql
SELECT DISTINCT action_type
FROM public.activity_receipts
WHERE action_type NOT IN (
  'intent_queued','specialist_consulted','artifact_created','artifact_published','artifact_sent',
  'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
  'passport_application_submitted','passport_issued','passport_status_changed','passport_revoked',
  'passport_privilege_changed','passport_infraction_recorded','governance_decision_ratified',
  'governance_decision_amended','governance_authority_exercised','governance_escalation_triggered',
  'experience_task_completed','agent_revocation_state_changed','operator_action_logged',
  'standing_document_added','partner_agent_evidence_recorded','agent_delegated','agent_delegation_revoked',
  'plan_purchased','plan_renewed','invariant_discovered','invariant_validated','invariant_canonized',
  'invariant_superseded','invariant_qube_published','knowledge_curated','consequence_forecast_recorded',
  'knowledge_evolved','experience_render_validated','implementation_pack_generated','implementation_dispatched',
  'deployment_proposed','constitutional_validation_recorded','remediation_recorded','deployment_authorized',
  'validation_override_granted','capability_registered','capability_operationally_validated',
  'capability_deprecated','research_lifecycle_transition','experiment_result_published','invariant_node_flipped',
  'agreement_formed','agreement_authorized','qubetalk_artifact_shared','qubetalk_artifact_opened',
  'qubetalk_artifact_copied','finance_authoritative_execution','canonical_plate_composed','plan_cancelled',
  'venture_blueprint_handoff','standing_accrued','standing_corrected','workspace_report_published',
  'venture_opportunity_opened','venture_service_completed','venture_completion_assessed',
  'venture_refusal_recorded','venture_obligation_earned','venture_obligation_approved',
  'venture_settlement_simulated','venture_obligation_reversed','venture_opportunity_closed',
  'qriptocent_payment_instruction_accepted','qriptocent_settlement_authority_verified',
  'qriptocent_source_debit_initiated','qriptocent_source_debit_finalised',
  'qriptocent_settlement_message_verified','qriptocent_destination_liquidity_reserved',
  'qriptocent_destination_credit_completed','qriptocent_settlement_reconciled',
  'qriptocent_settlement_exception_recorded','qriptocent_liquidity_proof_verified',
  'qriptocent_replenishment_authorised','qriptocent_native_issuance_executed','independent_review_completed',
  'bitcent_treasury_etch_executed','agent_card_discovered','horizen_agent_registered',
  'horizen_pnl_transparency_enabled','agent_card_enriched','agent_control_proven',
  'marketa_eligibility_recommended','operator_passport_validated','agent_sponsorship_recorded',
  'agent_delegate_passport_issued','aigentme_activated','experienceqube_focus_disposition_recorded',
  'journey_completed','horizen_pulse_authorized','marketa_eligibility_assessed','marketa_eligibility_refused',
  'marketa_eligibility_quarantined','principal_registration_mandate_signed','agent_registry_transaction_signed',
  'horizen_registration_submitted','horizen_registration_confirmed','agent_registry_binding_recorded',
  'address_only_placeholder_superseded','external_wallet_binding_migrated','principal_wallet_provisioned',
  'principal_wallet_control_proven','external_wallet_control_proven','trust_dimension_incremented',
  'population_record_repaired','population_record_excluded','capability_invocation_requested',
  'capability_invocation_authorized','capability_invocation_refused','capability_invocation_completed',
  'pulse_enrollment_verified','pulse_commitment_verified','reconciliation_discrepancy_recorded',
  'pnl_service_verified','orientation_ritual_completed','pnl_service_registered','agent_registry_activated',
  'agent_delegate_stood_up','agent_delegation_anchor_repaired','legacy_passport_linkage_reconciled',
  'implementation_execution_observed','implementation_execution_returned','commerce_action_authorised',
  'commerce_action_refused','commerce_action_unresolved','commerce_execution_bound',
  'commerce_execution_refused','commerce_consequence_recorded'
);
```

If this returns any rows, **do not apply the migration** — each returned value is a live `action_type` the new constraint would reject; add it to both the TypeScript union (`services/receipts/activityReceiptService.ts`) and a corrected wholesale rebuild before proceeding. This is a deployment gate, not implementation work — no code changes are expected if the query returns zero rows, which the static proof above predicts it will.

## 5. Signal vocabulary (memorise this table — every module in §3 speaks it)

| Term | Meaning | Never confuse with |
|---|---|---|
| `ACCEPTABLE` | A projection was established; the consequence is acceptable | — |
| `UNACCEPTABLE` | A projection was established; the consequence is NOT acceptable | `UNRESOLVED` (infra/fee/evidence/attestation failures are always `UNRESOLVED`, never this) |
| `UNRESOLVED` | Nothing could be established | `UNACCEPTABLE` |
| `completeness: COMPLETE \| PARTIAL` | Whether every required component reached a definite disposition | `disposition` (a known refusal can be `PARTIAL` if a DIFFERENT component is still unresolved — never hidden) |
| `AttestationRequirement: NOT_REQUIRED \| REQUIRED \| UNSPECIFIED` | Whether a projection may stand on unattested evidence | `UNSPECIFIED` fails closed — treated as `REQUIRED` |
| `MATCHED_PROJECTION \| DIVERGED_FROM_PROJECTION \| UNRESOLVED` | Observed-vs-projected comparison | An observation that could not be MADE is `UNRESOLVED`, never a "diverged" guess |
| Execution **binding** | An intent record, `bindExecution()` | Execution **confirmation** — no module in this codebase confirms on-chain settlement; `transactionRef` is always absent |

## 6. Operational notes for anyone re-running the live proofs

Two of these were promoted to candidate operational invariants (operator ruling, 2026-08-22) — see the resolution records / candidate invariants named below for the full reasoning; the rules themselves are stated plainly here:

- **Rule: a Vela `applicationId` is a deployment record, not a durable application identity.** The local Vela chain does not persist state across a container restart. A previously-recorded `applicationId` will not exist on a freshly-restarted stack even though the ProcessorEndpoint/TeeAuthenticator contract ADDRESSES stay the same (deterministic Anvil-genesis addresses, redeployed by the `deployer` container every start). Verify an applicationId still exists before reusing it; redeploy with `scripts/vela-slice2g-redeploy.ts` if not — the WASM artifact itself survives (it lives in the `vela-skit-shared-data` named volume, keyed by sha256), so this is a fast on-chain-only redeploy, not a rebuild. See `RES-2026-08-22-VELA-APPLICATION-ID-EPHEMERAL-001` / `CI-2026-08-22-VELA-APPLICATION-ID-DEPLOYMENT-RECORD-001`.
- **Rule: ASSOCIATEKEY is a provisioning/bootstrap step, never a transaction-time repair.** Every requester's P-521 key must be `ASSOCIATEKEY`'d (RequestType=3) before any `PROCESS` request from it will decrypt — a real Vela protocol requirement (`docs/3_typescript-client.md` in the vela-starterkit, "Registering Your Key"). This belongs in that requester's onboarding, completed once, before any confidential request is ever attempted — never handled reactively inside execution code after a decryption failure. `scripts/vela-slice2g-associate-key.ts` does this standalone; `scripts/vela-slice2g-live-proof.ts` runs it as an explicit, separately-logged phase before any confidential request. Symptom if skipped: `errorCode 9 "no Secp521r1_PubKey found"` — this reads as a `disposition: 'UNRESOLVED'` at the provider layer (correct fail-closed behaviour), so it can look like a projection problem when it is actually a missing prerequisite step. See `RES-2026-08-22-VELA-ASSOCIATEKEY-PROVISIONING-001` / `CI-2026-08-22-VELA-ASSOCIATEKEY-PROVISIONING-001`.
- **Dev keys**: Anvil Account #0 (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, `DEPLOYER_ADMIN`) holds `DEPLOYER_ROLE` and is funded — used throughout for both deploy and requester roles in local proofs. Documented in the vela-starterkit's own checked-in `dockerfiles/.env.dev` — public, local-dev-only, never a production secret.
- **No live Supabase in this sandbox.** `resolveCapabilityProviders` (Gate 1's registry lookup inside `invokeCapability()`) requires it. Test suites mock this seam (the established convention, `tests/governed-capability-invocation.test.ts`); a standalone live-proof script that needs the REAL gateway either needs live Supabase credentials or must call Gate 2 (`evaluateCapabilityAndRuntimeGate`) directly with a fixture provider, exactly as `scripts/vela-slice2g-live-proof.ts` does. This is a data/deployment gap, not a code gap — registering `CONFIDENTIAL_CONSEQUENCE_PROJECTION` as a live MoneyPenny capability descriptor in the real Agent Bench registry is a deployment step, not a code change.

## 7. What remains — and what does NOT

**Remains (deferred, tracked, non-blocking for the architecture claim):**
- SmartWallet `CONFIDENTIAL_PROJECTION_REQUEST` pending-action UI type.
- Journey Consequence Modal alignment.
- The full PRD §31 security/constitutional canary list.
- Registering the live MoneyPenny capability descriptor in the real Agent Bench/Supabase registry (a data change, needs live credentials).

**Does NOT remain — already closed:**
- No further local architecture passes are needed to validate the confidential-projection → authorisation → execution → observation → validation → receipt chain. It has been proven, live, against the real enclave, for every disposition and every distinguishing case (`ACCEPTABLE`/`UNACCEPTABLE`/`UNRESOLVED`, `MATCHED_PROJECTION`/`DIVERGED_FROM_PROJECTION`, `REQUIRED`-absent vs `NOT_REQUIRED`).

## 8. The one real external milestone: production TEE attestation

Everything above runs under `NoAttestationTeeAuthenticator` — the local/dev deployment mode with `teeAttestationVerified` always `false` by construction (never inferred from a successful execution; verified via `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`'s independent-booleans discipline, enforced by canaries). The type system (`ConfidentialProofState`, `provenStatesFor()` in `velaProjectionProvider.ts`) already names the third, unreached state: `PRODUCTION_TEE_ATTESTATION_PROVEN`, reachable ONLY from a `NITRO_ATTESTED` deployment.

**Getting there is an external dependency, not an engineering task this codebase controls alone**: it requires a real Vela deployment running actual AWS Nitro Enclaves with a genuine remote-attestation chain, which this local Docker Compose stack cannot simulate (that is the entire point of `NoAttestationTeeAuthenticator` — it exists so local development doesn't need real hardware). Everything in this codebase is already structured to consume that state the moment it exists: `AttestationMode`, `provenStatesFor()`, and the `AttestationRequirement` policy all already model `NITRO_ATTESTED` as a first-class value; no ontology change is anticipated when it arrives, only a deployment descriptor change (`services/vela/velaConfig.ts`) and a live proof re-run against that deployment.

**Determination, stated plainly: the next milestone for VELA-001 is obtaining and pointing this stack at a real Nitro-attested Vela deployment. It is not another round of local architecture, composition, or ontology work.**

## 9. Next engineering milestone: VELA-002 — Attested Constitutional Execution

Blocked entirely on external access (a Horizen early-access/testnet Vela instance — see §11's outreach note). Once granted, the milestone is a promotion of one already-proven boundary — local/emulated Vela execution → real Nitro enclave → real attestation → attestation verification → production authorisation policy can require it — not a redesign:

1. Provision the early-access Vela instance.
2. Deploy the SAME projector WASM (sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`, no changes).
3. Associate the MoneyPenny requester key (per the ASSOCIATEKEY-as-provisioning rule in §6 — done once, as onboarding, not inline).
4. Run ACCEPTABLE / UNACCEPTABLE / UNRESOLVED against the attested enclave.
5. Verify genuine TEE attestation (`teeAttestationVerified` reads `true` for the first time anywhere in this codebase's live history — currently `false` everywhere by construction).
6. Set `attestationRequirement = REQUIRED` in the composition policy (`services/constitutionalCommerce/unifiedConsequenceProjection.ts`'s `CompositionPolicy`) — this is now legitimate once real attestation exists to require.
7. Prove `AUTHORISED` is reachable ONLY when attestation verifies — and, symmetrically, that an unattested result under `REQUIRED` still composes to `UNRESOLVED` exactly as the existing canary already proves for the local case.
8. Bind and execute a harmless real consequence (still `bindExecution()` — an intent, never a signed/broadcast transfer, per this codebase's standing no-production-execution discipline unless and until the operator explicitly authorises going further).
9. Observe and validate the consequence against the projection, exactly as Slice 2G's chain already does.
10. Persist the complete attested causal chain — the same `assembleCausalChain()`/receipt machinery, now carrying a REAL `teeAttestationVerified: true`.

No new ontology, no new types, no new Gate 2 exception is anticipated — VELA-002 is a re-run of the existing, already-proven chain against a different (attested) `VelaDeploymentDescriptor`, plus the one policy flip in step 6.

This is also the clean entry into the platform's Phase 3 shape: `Recruit → Admit → Establish Authority → Project Consequence → Authorise Conditionally → Execute Confidentially → Observe Consequence → Generate Evidence & Standing → Discover More Agents → Orchestrate Services`. VELA-001/2 answers the architectural half of that loop (Establish Authority through Generate Evidence & Standing, for one agent, one capability). The operational question after VELA-002 is whether the same loop runs for more agents and more capabilities under a genuinely attested Vela environment.

## 10. Reading order for a new engineer

1. This document.
2. `docs/vela/CONSEQUENCE-ONTOLOGY-001.md` — why VELA-001 composes with CFS-006a instead of forking it.
3. `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` and `VELA-ATTESTATION-BOUNDARY-001.md` — the two boundaries every module respects.
4. `types/constitutionalCommerce.ts` — read the file top to bottom; every field has a comment explaining why it exists.
5. `2026-08-22_vela-001-slice-2f-gate2-authorisation.md` then `2026-08-22_vela-001-slice-2g-execution-observation-validation.md` (in `codexes/packs/agentiq/updates/`) — the two slices that took this from "designed" to "live-proven."
6. `tests/vela-slice2f-capability-invocation.test.ts` and `tests/vela-slice2g-execution-observation-validation.test.ts` — read the tests before writing new code; they encode every constraint above as an executable check.

## 11. Outreach note — draft, not yet sent

The following is a ready-to-send draft for reaching Horizen about early-access/testnet Vela instance access. It has NOT been sent — no recipient address or send channel was provided to this session. An operator with the relevant contact should send it directly, or ask this session to send it once a channel (e.g. an email connector) and recipient are available.

> We've now completed the local Vela integration end to end. MoneyPenny can take an active constitutional authority, combine our public consequence projection with a live confidential Vela projection, derive a transaction-specific authorisation, bind execution, observe the consequence and compare it with what was projected. We have live proofs for matched consequence, divergent consequence, and fail-closed unresolved confidential evidence.
>
> The remaining boundary is now very specific: real Vela TEE/Nitro attestation. We've completed the public starter-kit path and have the early-access handoff ready, including our WASM workload, signer/privacy topology, privacy boundary and attestation boundary.
>
> Could you connect us to the right person/process for a dedicated Vela early-access/testnet instance so we can move the same workload into the attested environment?
