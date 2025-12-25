-- Base Q¢ balances table
CREATE TABLE IF NOT EXISTS qc_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
  balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(50) NOT NULL DEFAULT 'base_qc',
  source VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_balances_persona_id ON qc_balances(persona_id);

ALTER TABLE qc_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage qc_balances"
  ON qc_balances FOR ALL USING (true) WITH CHECK (true);
