-- 20260712000000 — Produced artifact records (CFS-025 AR / CFS-023 Phase 4)
--
-- Operational-tier (and promoted constitutional) artifacts produced by delegates
-- previously lived only in the HTTP response — a refresh lost them. This table is
-- their home: every non-disposable production persists as a record, giving the
-- artifact durability, a stable id, and a promotion path (operational → later
-- constitutional publish references the same record lineage).
--
-- Consequence discipline: DISPOSABLE productions are NEVER persisted (that is
-- their definition). content_hash + receipt_id are the T2 verification pair.
-- No T0 identifier is stored (delegate is a public delegate id; the producing
-- operator is attributable via the receipt, not a raw persona column).

BEGIN;

CREATE TABLE IF NOT EXISTS public.artifact_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Artifact Runtime's artifact id (idempotent content-derived id).
  artifact_id        TEXT NOT NULL,
  profile            TEXT NOT NULL,
  consequence_class  TEXT NOT NULL CHECK (consequence_class IN ('operational', 'constitutional')),
  -- Who produced it natively (a Homecoming delegate id or 'operator').
  delegate           TEXT NOT NULL DEFAULT 'operator',
  title              TEXT NOT NULL,
  -- The operator's brief (what was asked).
  brief              TEXT NOT NULL DEFAULT '',
  -- The produced artifact body (markdown/text — the working document).
  body               TEXT NOT NULL,
  -- sha256 over body — the verifiable content commitment.
  content_hash       TEXT NOT NULL,
  -- The artifact_published receipt id (constitutional tier only; null while operational).
  receipt_id         TEXT,
  sovereignty        JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifact_records_created
  ON public.artifact_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_records_artifact
  ON public.artifact_records (artifact_id);

COMMENT ON TABLE public.artifact_records IS
  'Produced artifacts (CFS-025 Artifact Runtime): the durable home for operational + constitutional productions. Disposable productions are never persisted. content_hash + receipt_id are the verification pair.';

ALTER TABLE public.artifact_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artifact_records_read ON public.artifact_records;
CREATE POLICY artifact_records_read ON public.artifact_records
  FOR SELECT USING (true); -- produced work products are T2-safe shareable artifacts

DROP POLICY IF EXISTS artifact_records_service_write ON public.artifact_records;
CREATE POLICY artifact_records_service_write ON public.artifact_records
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
