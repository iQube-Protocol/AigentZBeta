-- =============================================================================
-- Investor Dashboard tables (Sprint 3 of tasks/rewards/reputation plan)
--
-- Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.4
--
-- Two new tables:
--
--   investor_capital_events  — append-only ledger of investments, share grants,
--                              token grants, vesting milestones, distributions.
--                              Read by both investor (own rows) and admin (all rows).
--
--   investor_documents       — investor-private docs (subscription agreements,
--                              side letters, K-1s, quarterly letters).
--                              `storage_master_id` references master_content_qubes
--                              so PDFs flow through the gated PDFPageViewer
--                              proxy (CLAUDE.md § Gated Content).
--                              `visible_to_investor` is FALSE by default — admin
--                              must explicitly publish each doc.
--
-- RLS rules:
--   • investor_capital_events: investor sees only rows where persona_id matches
--     a persona they own (auth.uid() → personas.user_id → persona.id chain).
--     Admin access via service-role bypass at API layer.
--
--   • investor_documents: same investor-self-view chain, AND visible_to_investor
--     must be TRUE. So docs default-private until admin publishes.
--
-- Phase 1 keeps both tables read-only from the investor side; all writes go
-- through admin-only API routes (created in Sprint 4).
-- =============================================================================

-- ── investor_capital_events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('investment','share_grant','token_grant','vesting_milestone','distribution')),
  amount_usd NUMERIC,
  amount_shares NUMERIC,
  amount_knyt NUMERIC,
  vehicle TEXT,                    -- e.g. 'SAFE', 'Series Seed', 'Convertible Note', 'Direct'
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES personas(id),  -- admin persona who recorded the event
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_capital_events_persona
  ON investor_capital_events(persona_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_investor_capital_events_type
  ON investor_capital_events(event_type);

ALTER TABLE investor_capital_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_events_self_view ON investor_capital_events;
CREATE POLICY investor_events_self_view ON investor_capital_events
  FOR SELECT
  USING (
    persona_id IN (
      SELECT id FROM personas WHERE auth_profile_id = auth.uid()::text
    )
  );

-- Admin write/read goes through service-role bypass at the API layer.

COMMENT ON TABLE investor_capital_events IS
  'Append-only ledger of investor capital events (investments, grants, distributions). Investor sees own rows; admin via service-role.';


-- ── investor_documents ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'subscription_agreement',
    'side_letter',
    'k1',
    '1099_b',
    'quarterly_letter',
    'annual_report',
    'capitalization_table',
    'other'
  )),
  title TEXT NOT NULL,
  storage_master_id TEXT,          -- master_content_qubes.id for PDF viewer (PDFPageViewer)
  visible_to_investor BOOLEAN NOT NULL DEFAULT FALSE,  -- admin explicitly publishes
  effective_date DATE,
  uploaded_by UUID REFERENCES personas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_documents_persona
  ON investor_documents(persona_id, effective_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_investor_documents_visible
  ON investor_documents(persona_id, visible_to_investor)
  WHERE visible_to_investor = TRUE;

ALTER TABLE investor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_docs_self_view ON investor_documents;
CREATE POLICY investor_docs_self_view ON investor_documents
  FOR SELECT
  USING (
    visible_to_investor = TRUE
    AND persona_id IN (
      SELECT id FROM personas WHERE auth_profile_id = auth.uid()::text
    )
  );

COMMENT ON TABLE investor_documents IS
  'Investor private documents. visible_to_investor defaults to FALSE — admin must publish. PDFs render via PDFPageViewer using storage_master_id.';
