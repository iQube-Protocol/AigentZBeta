-- ============================================================================
-- financial_profile_qubes — per-persona MoneyPenny Financial Profile
-- container (SPEC-MPY-002 §5, work package MPY2-2).
--
-- Mirrors the experience_qubes shape exactly
-- (supabase/migrations/20260513000000_experience_qubes.sql) — meta/blak
-- split, one row per persona, service-role-only RLS. See
-- services/iqube/financialProfileQube.ts for the canonical reader/writer;
-- no other module may read blak_qube directly.
--
-- What this table is NOT:
--   - NOT a copy of the raw bank statement. The source document (and its
--     parsed text/rows) stays exactly where every other persona upload
--     lives — persona_uploads / persona_upload_index (use_kind
--     'financial_document', see the paired migration). This table stores
--     only the DERIVED, BOUNDED aggregates a compute pass produces from
--     those uploads (SPEC-MPY-002 §5 hard constraints 2 and 5) — one
--     canonical financial-state model, not a second truth store.
--   - NOT authority to trade. `blak_qube.envelope` is a candidate/
--     recommended envelope a person reviews and may change; enforcing it
--     against a real order requires the canonical authority/delegation/CTP
--     path for the consequential act (constraint 7) — this table records
--     no such authorization.
--
-- Privacy contract (CLAUDE.md identity-spine rules):
--   - persona_id is T0 — server-internal only. Never serialised to JSON.
--   - meta_qube columns are T1-safe (non-sensitive: whether a profile
--     exists, when it was last computed, how many source documents fed
--     it) and may surface to the browser.
--   - blak_qube payload (the actual aggregates/envelope) is T0. It is
--     financial data about a specific person — never exported to an
--     external AEE/rendering provider (constraint 4). The owner
--     self-view route may return it to the authenticated owner only
--     (CLAUDE.md "Owner self-view exception"); it never rides a receipt
--     or chain-bound payload.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_profile_qubes (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id               text NOT NULL UNIQUE,

  -- ── metaQube slice — public-safe (T1) ────────────────────────────────
  has_profile              boolean NOT NULL DEFAULT false,
  last_computed_at         timestamptz,
  source_upload_count      integer NOT NULL DEFAULT 0,
  -- Names which source uploads (persona_uploads.id) were actually
  -- readable at compute time, distinct from which were merely selected —
  -- an unreadable/unparseable upload is reported, never silently skipped.
  unreadable_upload_count  integer NOT NULL DEFAULT 0,

  -- ── blakQube slice — private payload (jsonb; T0) ─────────────────────
  -- Schema (services/iqube/financialProfileQube.ts::FinancialProfileQubeBlak):
  --   {
  --     aggregates?: {
  --       incomeMonthly, expenditureMonthly, availableSurplusMonthly,
  --       cashFlowVolatility, liquidityBufferDays,
  --       concentration: { recurringCommitments: [...], topCategories: [...] }
  --     },
  --     envelope?: {
  --       candidateMaxNotional, candidateLossRiskBudget,
  --       liquidityReserve, concentrationLimits: [...],
  --       strategyConstraints: [...]
  --     },
  --     sourceUploadIds?: string[],
  --     computedFromMonths?: string[]  -- which statement periods contributed
  --   }
  blak_qube                jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_profile_qubes_persona ON public.financial_profile_qubes(persona_id);

ALTER TABLE public.financial_profile_qubes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_profile_qubes_read_service"  ON public.financial_profile_qubes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "financial_profile_qubes_write_service" ON public.financial_profile_qubes FOR ALL    USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.touch_financial_profile_qubes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_profile_qubes_touch ON public.financial_profile_qubes;
CREATE TRIGGER trg_financial_profile_qubes_touch
  BEFORE UPDATE ON public.financial_profile_qubes
  FOR EACH ROW EXECUTE FUNCTION public.touch_financial_profile_qubes_updated_at();

COMMENT ON TABLE  public.financial_profile_qubes IS 'MoneyPenny — per-persona Financial Profile container. SPEC-MPY-002 §5.';
COMMENT ON COLUMN public.financial_profile_qubes.persona_id IS 'T0 — server-internal only.';
COMMENT ON COLUMN public.financial_profile_qubes.blak_qube  IS 'BlakQube payload — derived aggregates + candidate envelope only, never the raw statement (that stays in persona_uploads).';
