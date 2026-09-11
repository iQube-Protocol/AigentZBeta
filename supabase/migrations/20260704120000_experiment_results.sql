-- 20260704120000_experiment_results.sql
--
-- Canonical publication of Foundational Validation Series results
-- (EXP-001/002/003) — the trustless results record behind the Experiment
-- Lab's Results tab.
--
-- Trust model: `results_json` stores the EXACT serialized results string and
-- `content_hash` its sha256 (a T2-safe content commitment — no identifiers).
-- Publication emits an `experiment_result_published` activity receipt whose
-- summary carries the same hash; that receipt is DVN-anchorable, so the
-- commitment lands in tamper-evident constitutional memory. Auditability is
-- then mechanical: recompute sha256(results_json) — in the browser, or by any
-- third party — and compare to the anchored hash. jsonb is deliberately NOT
-- used for the payload (jsonb re-serialization does not preserve key order,
-- which would break hash reproduction); `aggregates` is jsonb for listing
-- convenience only and carries no trust weight.
--
-- Additive-only (CFS-010 §3); idempotent, re-runnable. RLS enabled with no
-- policies: service-role access only (all reads/writes flow through the
-- spine-gated API routes).

CREATE TABLE IF NOT EXISTS public.experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment text NOT NULL CHECK (experiment IN ('EXP-001', 'EXP-002', 'EXP-003')),
  provider text NOT NULL,
  model text NOT NULL,
  aggregates jsonb NOT NULL DEFAULT '{}'::jsonb,
  results_json text NOT NULL,
  content_hash text NOT NULL,
  receipt_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_results_experiment_idx
  ON public.experiment_results (experiment, created_at DESC);

ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.experiment_results IS
  'Canonically published Foundational Validation Series runs. content_hash = sha256(results_json), anchored via experiment_result_published DVN receipts.';
COMMENT ON COLUMN public.experiment_results.results_json IS
  'EXACT serialized results string that was hashed — never re-serialize; verification recomputes sha256 over this text verbatim.';
