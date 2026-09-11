-- Intent Chain Orchestrator — Phase 1 schema
--
-- Spec: codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md
-- Date: 2026-06-02
--
-- Adds one new table: intent_chains.
-- Per-step state is reconstructable from orchestration_events filtered by
-- metadata.chain_id — single source of truth + no dual-write amplification.
--
-- Also extends iqube_id_map.source CHECK constraint to accept the new
-- 'code:chainTemplate' enum value per §6.6 Factory Ingestion stub. Chain
-- templates register as synthetic primitives so they appear in the registry
-- plane (Browse, Score Coverage) without yet being full iQubes.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. intent_chains — one row per chain instance
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intent_chains (
  chain_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identity (snapshot at dispatch — chain runs against the
  -- version it started with, per locked decision §11 #5)
  template_id text NOT NULL,
  template_version text NOT NULL,                 -- e.g. 'v1' or a commit ref

  -- Origin
  initiating_nbe_id text,                         -- nbeId that dispatched the chain (e.g. 'marketa.ask-partner-proposal')
  initiated_by_persona_id uuid NOT NULL,          -- T0; NEVER in JSON or receipts
  initiated_by_alias_commitment text,             -- T2; safe in receipts
  cartridge text,                                 -- scope for filtering /workspace views

  -- State machine
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active',         -- chain is in flight (current step is rpc or in-progress user step)
      'waiting',        -- current step is kind=scheduled or kind=wait (passive)
      'completed',      -- terminated normally
      'failed',         -- step failed AND on_failure='halt'
      'cancelled'       -- operator-cancelled
    )),

  current_step_id text,                           -- null when terminated
  current_step_kind text                          -- denormalised for cron filtering (scheduled/wait)
    CHECK (current_step_kind IS NULL OR current_step_kind IN (
      'compose', 'rpc', 'approve', 'scheduled', 'wait'
    )),
  current_step_started_at timestamptz,
  scheduled_advance_at timestamptz,               -- for kind='scheduled' — when cron should advance
  wait_timeout_at timestamptz,                    -- for kind='wait' — when cron should mark timeout

  -- Chain context map — accumulating jsonb of values written by prior steps
  -- Resolved via $chain.X or $prev.X references in step definitions.
  context jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Q¢ payment (§6.5)
  cost_qc integer NOT NULL DEFAULT 0 CHECK (cost_qc >= 0),
  charge_status text NOT NULL DEFAULT 'none'
    CHECK (charge_status IN ('none', 'committed', 'refunded')),
  charge_committed_at timestamptz,
  charge_refunded_at timestamptz,

  -- Audit correlation
  last_event_id uuid,                             -- most recent orchestration_events row

  started_at timestamptz NOT NULL DEFAULT now(),
  terminated_at timestamptz,
  termination_outcome text,                       -- 'completed' | 'failed' | 'cancelled' | 'timeout'

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the queries we'll run:
--   - Cron tick: SELECT WHERE status IN ('active','waiting') AND scheduled_advance_at <= now()
--   - Per-user listing: SELECT WHERE initiated_by_persona_id = ? ORDER BY started_at DESC
--   - Template stats: SELECT COUNT(*) GROUP BY template_id, status
--   - Cartridge views: SELECT WHERE cartridge = ? AND status IN ('active','waiting')

CREATE INDEX IF NOT EXISTS intent_chains_cron_scheduled_idx
  ON public.intent_chains (scheduled_advance_at)
  WHERE status IN ('active', 'waiting') AND scheduled_advance_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS intent_chains_cron_timeout_idx
  ON public.intent_chains (wait_timeout_at)
  WHERE status = 'waiting' AND wait_timeout_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS intent_chains_persona_idx
  ON public.intent_chains (initiated_by_persona_id, started_at DESC);

CREATE INDEX IF NOT EXISTS intent_chains_template_idx
  ON public.intent_chains (template_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS intent_chains_cartridge_idx
  ON public.intent_chains (cartridge, status)
  WHERE cartridge IS NOT NULL;

ALTER TABLE public.intent_chains ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- 2. iqube_id_map.source — extend CHECK to accept 'code:chainTemplate'
-- ─────────────────────────────────────────────────────────────────────
--
-- Per §6.6 Factory Ingestion stub. Chain templates register as synthetic
-- primitives so they appear in the registry plane. The TS-side
-- IQubeIdMapSource union is extended in the same commit.

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing source CHECK constraint dynamically (its name may
  -- vary across environments seeded at different times).
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   WHERE ns.nspname = 'public'
     AND rel.relname = 'iqube_id_map'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) LIKE '%source%triad_meta%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.iqube_id_map DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.iqube_id_map
    ADD CONSTRAINT iqube_id_map_source_check CHECK (source IN (
      'triad_meta',
      'triad_blak',
      'triad_token',
      'content_qube',
      'registry_asset',
      'master_content_qube',
      'codex_media_asset',
      'identity_iqube',
      'memory_iqube',
      'code:aigentQubeSource',
      'code:toolQubeSource',
      'code:liquidui-template',
      'code:chainTemplate'
    ));
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Helper: trigger updated_at on intent_chains writes
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.intent_chains_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intent_chains_set_updated_at_trigger ON public.intent_chains;
CREATE TRIGGER intent_chains_set_updated_at_trigger
  BEFORE UPDATE ON public.intent_chains
  FOR EACH ROW
  EXECUTE FUNCTION public.intent_chains_set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 4. intent_chain_feedback — efficacy learning loop
-- ─────────────────────────────────────────────────────────────────────
-- Per §6.7 of the spec. One row per (chain_id, persona) — PUT semantics
-- on the write endpoint. Like = single click; dislike expands a comment
-- textarea so we can capture "what didn't work" for the training corpus.
-- Comment is T1 — stored here for the operator + Aigent Z, never emitted
-- to DVN receipts (only `comment_present` bool surfaces). 2000-char cap
-- enforced at insert time by the API; CHECK as a safety net.

CREATE TABLE IF NOT EXISTS public.intent_chain_feedback (
  feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.intent_chains(chain_id) ON DELETE CASCADE,

  rated_by_persona_id uuid NOT NULL,            -- T0; NEVER in JSON or receipts
  rated_by_alias_commitment text,               -- T2; safe in receipts

  rating text NOT NULL CHECK (rating IN ('like', 'dislike')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),

  rated_at timestamptz NOT NULL DEFAULT now(),

  -- Pointer to the orchestration_events row emitted on feedback submission.
  -- Lets the chain detail drawer surface the receipt + anchor txid for the
  -- feedback event alongside the rating.
  receipt_event_id uuid,

  UNIQUE (chain_id, rated_by_persona_id)
);

CREATE INDEX IF NOT EXISTS intent_chain_feedback_chain_idx
  ON public.intent_chain_feedback (chain_id);

CREATE INDEX IF NOT EXISTS intent_chain_feedback_rating_idx
  ON public.intent_chain_feedback (rating, rated_at DESC);

-- Per-template aggregate index — supports the admin-only
-- /api/intent-chains/feedback/aggregate?template_id=X query without a
-- sequential scan once feedback corpus is non-trivial. Join through
-- intent_chains; the rating index above already handles ORDER BY.

ALTER TABLE public.intent_chain_feedback ENABLE ROW LEVEL SECURITY;

COMMIT;
