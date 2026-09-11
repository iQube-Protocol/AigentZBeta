-- Anchor cycle history + tunable anchor policy config
--
-- Phase: post-trinity-rename, post-/registry-Phase-C
-- Date: 2026-05-31
--
-- Adds two tables for the sync cron + K/T policy ship:
--
--   1. ops_anchor_config — single-row tunable policy config
--      - batch_size_k        : receipt count threshold (default 50)
--      - max_age_minutes_t   : age threshold (default 15 min)
--      - cron_cadence_seconds: how often the cron tick is expected to
--                              fire externally (informational; the
--                              actual schedule lives in the trigger
--                              configuration). Default 60.
--      - is_paused           : kill-switch — when true, cron-tick
--                              returns a no-op even if K or T are met.
--      - updated_by_persona_id (T0 — server-internal only)
--      - updated_at
--
--   2. anchor_history — append-only ledger of every successful (and
--      failed) anchor cycle for audit + UI telemetry.
--      - id (uuid)
--      - batch_id            : pos.batch_now() return value
--      - anchor_txid         : pos.anchor() return value (nullable on
--                              skip-batch ticks)
--      - receipt_count       : how many receipts entered the batch
--      - cycle_action        : 'anchored' | 'deferred' | 'skipped' | 'failed'
--      - decision_reason     : which trigger fired: 'size_k' | 'time_t' | 'manual' | 'idle' | 'paused'
--      - drift_before        : drift snapshot at tick start
--      - drift_after         : drift snapshot post-action
--      - duration_ms         : end-to-end tick latency
--      - error               : nullable error message if action='failed'
--      - created_at          : tick start time
--
-- RLS: service-role only on both. Read access for admin via API route.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ops_anchor_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  batch_size_k integer NOT NULL DEFAULT 50 CHECK (batch_size_k >= 1 AND batch_size_k <= 10000),
  max_age_minutes_t integer NOT NULL DEFAULT 15 CHECK (max_age_minutes_t >= 1 AND max_age_minutes_t <= 1440),
  cron_cadence_seconds integer NOT NULL DEFAULT 60 CHECK (cron_cadence_seconds >= 10 AND cron_cadence_seconds <= 3600),
  is_paused boolean NOT NULL DEFAULT false,
  updated_by_persona_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ops_anchor_config (id, batch_size_k, max_age_minutes_t, cron_cadence_seconds, is_paused)
VALUES (1, 50, 15, 60, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ops_anchor_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.anchor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text,
  anchor_txid text,
  receipt_count integer NOT NULL DEFAULT 0,
  cycle_action text NOT NULL CHECK (cycle_action IN ('anchored', 'deferred', 'skipped', 'failed')),
  decision_reason text NOT NULL CHECK (decision_reason IN ('size_k', 'time_t', 'manual', 'idle', 'paused', 'error')),
  drift_before integer,
  drift_after integer,
  duration_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anchor_history_created_at_idx
  ON public.anchor_history (created_at DESC);
CREATE INDEX IF NOT EXISTS anchor_history_action_idx
  ON public.anchor_history (cycle_action, created_at DESC);

ALTER TABLE public.anchor_history ENABLE ROW LEVEL SECURITY;

COMMIT;
