-- Experience task completions — durable record for consumer-task-runner
-- completions (Workstream C-b). One row per (persona, experience): the
-- UNIQUE constraint is the idempotency gate that prevents double-granting.
--
-- A row is written only on FULL completion (all nextActions checked). The
-- grant (KNYT via reward_grants / Q¢ via qc_transactions) and the DVN
-- activity receipt are linked from this row for provenance.
--
-- Also extends activity_receipts.action_type CHECK with the new
-- 'experience_task_completed' type (DVN-anchorable; mirrors the
-- ANCHORABLE_ACTION_TYPES extension in activityReceiptDvnPipeline.ts and the
-- ActivityActionType union in activityReceiptService.ts).

CREATE TABLE IF NOT EXISTS public.experience_task_completions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID NOT NULL,
  experience_id    UUID NOT NULL,
  tenant_id        TEXT NOT NULL,
  task_template_id UUID REFERENCES public.crm_task_templates(id),
  tasks_completed  TEXT[] NOT NULL DEFAULT '{}',
  total_tasks      INTEGER NOT NULL DEFAULT 0,
  reward_asset     TEXT,                       -- 'KNYT' | 'QCT' (Q¢) | null
  reward_amount    NUMERIC(36,12) NOT NULL DEFAULT 0,
  reward_grant_id  UUID,                        -- reward_grants.id (KNYT) or null (Q¢)
  grant_failed     BOOLEAN NOT NULL DEFAULT false,
  source_event_id  UUID,                        -- activity_receipts.id (DVN receipt)
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_persona_experience UNIQUE (persona_id, experience_id)
);

CREATE INDEX IF NOT EXISTS idx_etc_persona ON public.experience_task_completions(persona_id);
CREATE INDEX IF NOT EXISTS idx_etc_experience ON public.experience_task_completions(experience_id);
CREATE INDEX IF NOT EXISTS idx_etc_tenant ON public.experience_task_completions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etc_template ON public.experience_task_completions(task_template_id);

-- Additive: re-create the CHECK with all prior types plus experience completion.
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
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed'
  ));
