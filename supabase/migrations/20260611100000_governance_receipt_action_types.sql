-- Governance receipts — extend activity_receipts.action_type CHECK with
-- the four governance receipt types (DVN-anchorable; mirrors the
-- ANCHORABLE_ACTION_TYPES extension in activityReceiptDvnPipeline.ts and the
-- ActivityActionType union in activityReceiptService.ts).
--
-- Additive: re-creates the CHECK with all prior types plus governance.

ALTER TABLE public.activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE public.activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered'
  ));
