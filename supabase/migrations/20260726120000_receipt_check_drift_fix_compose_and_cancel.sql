-- activity_receipts action_type CHECK drift fix, round 2 (2026-07-26).
--
-- ── Bug found in this pass ─────────────────────────────────────────────────
-- Two action types are written by live `createActivityReceipt` call sites but
-- appear in NEITHER the TypeScript `ActivityActionType` union NOR this CHECK
-- constraint:
--
--   'canonical_plate_composed'  app/api/constitutional/canonical-plates/route.ts
--   'plan_cancelled'            services/billing/planRenewal.ts
--
-- This is the "2026-07-15 constraint-drift incident" class again, but reached
-- from the direction the existing canary did not cover. The 2026-07-24 fix
-- (20260724120000) closed the gap for action types that WERE in the TS union
-- but missing from the CHECK. `tests/activity-receipts-action-type-parity.ts`
-- enforces exactly that direction: TS union ⊆ CHECK. These two were never in
-- the union at all, so the canary had nothing to compare and the drift was
-- invisible to it.
--
-- Why it stayed silent: `next.config` sets `typescript.ignoreBuildErrors:
-- true`, so the type error at each call site never failed a build; and BOTH
-- call sites wrap the receipt in `try { … } catch { /* best-effort */ }` with
-- an EMPTY catch, so the check-violation is swallowed with no log at all
-- (`isMissingTable`/`isMissingColumn` do not match a check violation, so the
-- service's soft-fail paths do not apply — it throws at
-- activityReceiptService.ts:374 and the caller discards it).
--
-- Observed impact: every Canonical Plate composition and every post-grace plan
-- cancellation since those call sites shipped has written NO activity receipt.
-- `plan_cancelled` is the more consequential of the two — it records a billing
-- state change that reverts the citizen to the free tier and revokes live
-- delegation, and that act has been going unreceipted.
--
-- Neither type is in `ANCHORABLE_ACTION_TYPES`, so no DVN anchor and no
-- chain-of-provenance gap is involved — the loss is the internal audit
-- receipt only. No DVN pipeline logic, state machine, or canister interaction
-- is touched here; this is the SQL whitelist only, rebuilt wholesale as every
-- migration in this chain is required to do.
--
-- Both types are added to the TypeScript union in the same commit, so the
-- existing parity canary now covers them going forward, and a NEW canary
-- (same test file) closes the reverse direction: every actionType literal at a
-- `createActivityReceipt` call site must be a declared `ActivityActionType`.

ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_published','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated','agent_delegation_revoked',
    'operator_action_logged','standing_document_added',
    'plan_purchased','plan_renewed',
    'invariant_discovered','invariant_validated','invariant_canonized','invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated','consequence_forecast_recorded','knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'research_lifecycle_transition',
    'experiment_result_published',
    'venture_blueprint_handoff',
    'standing_accrued',
    'capability_registered',
    'capability_operationally_validated',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'capability_deprecated',
    -- Drift fix, round 2 (see file header) — written by live call sites, never
    -- declared anywhere until now.
    'canonical_plate_composed',
    'plan_cancelled'
  ));
