-- ============================================================================
-- iQube Score Data Backfill — schema
--
-- Per the 2026-05-31 backlog item, every iQube must carry the 4 trust/
-- validation axes (sensitivity / accuracy / verifiability / risk) + 2
-- derived scores (reliability / trust). Storage as a separate table keyed
-- by canonical iqube_id so we can populate scores for code-only iQubes
-- (AigentQubes, ToolQubes, LiquidUI seeds) that have no iq_meta_qubes row.
--
-- Per-axis _source column lets operators override individual axes without
-- losing the derived defaults; the per-primitive derivers only write to
-- rows where the corresponding _source is 'derived' (operator overrides
-- are sacred).
--
-- Privacy contract: no T0 fields here. Scores are aggregate signals about
-- the iQube itself, not about its creator/owner. Service-role RLS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.iqube_scores (
  iqube_id              uuid        PRIMARY KEY REFERENCES public.iqube_id_map(iqube_id) ON DELETE CASCADE,

  -- The 4 raw axes (0..10 scale; NULL when not yet populated)
  sensitivity           smallint    CHECK (sensitivity IS NULL OR sensitivity BETWEEN 0 AND 10),
  accuracy              smallint    CHECK (accuracy IS NULL OR accuracy BETWEEN 0 AND 10),
  verifiability         smallint    CHECK (verifiability IS NULL OR verifiability BETWEEN 0 AND 10),
  risk                  smallint    CHECK (risk IS NULL OR risk BETWEEN 0 AND 10),

  -- Derived scores (0..10, computed from the 4 raw axes per scoreUtils
  -- formulas: reliability = accuracy * 0.6 + verifiability * 0.4;
  -- trust = 10 - (sensitivity * 0.4 + risk * 0.6))
  derived_reliability   numeric(3,1) CHECK (derived_reliability IS NULL OR derived_reliability BETWEEN 0 AND 10),
  derived_trust         numeric(3,1) CHECK (derived_trust IS NULL OR derived_trust BETWEEN 0 AND 10),

  -- Per-axis source flag: 'derived' (auto-computed by a strategy) or
  -- 'operator_override' (sacred — derivers refuse to overwrite).
  sensitivity_source    text        NOT NULL DEFAULT 'derived'
    CHECK (sensitivity_source IN ('derived', 'operator_override')),
  accuracy_source       text        NOT NULL DEFAULT 'derived'
    CHECK (accuracy_source IN ('derived', 'operator_override')),
  verifiability_source  text        NOT NULL DEFAULT 'derived'
    CHECK (verifiability_source IN ('derived', 'operator_override')),
  risk_source           text        NOT NULL DEFAULT 'derived'
    CHECK (risk_source IN ('derived', 'operator_override')),

  -- Strategy that produced the row (e.g. 'content_qube_v1', 'aigent_qube_v1'
  -- — names match the per-primitive deriver file names).
  derivation_strategy   text,

  populated_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iqube_scores_strategy ON public.iqube_scores(derivation_strategy);
CREATE INDEX IF NOT EXISTS idx_iqube_scores_overrides
  ON public.iqube_scores(iqube_id)
  WHERE sensitivity_source = 'operator_override'
     OR accuracy_source = 'operator_override'
     OR verifiability_source = 'operator_override'
     OR risk_source = 'operator_override';

COMMENT ON TABLE  public.iqube_scores IS 'Trust/Validation scores per iQube (sensitivity/accuracy/verifiability/risk + derived reliability/trust). One row per canonical iqube_id. Operator-overridable per-axis. See codexes/packs/agentiq/updates/2026-05-31_iqube-score-data-backfill-backlog.md';
COMMENT ON COLUMN public.iqube_scores.derived_reliability IS 'accuracy * 0.6 + verifiability * 0.4';
COMMENT ON COLUMN public.iqube_scores.derived_trust IS '10 - (sensitivity * 0.4 + risk * 0.6)';

ALTER TABLE public.iqube_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iqube_scores_read_service"  ON public.iqube_scores FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "iqube_scores_write_service" ON public.iqube_scores FOR ALL    USING (auth.role() = 'service_role');

COMMIT;
