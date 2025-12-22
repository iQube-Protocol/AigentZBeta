-- KNYT Ledger Tables
-- Supabase mirror for DVN KNYT (x402 ledger) balances and transactions

-- Wallet balances table (multi-asset support)
CREATE TABLE IF NOT EXISTS wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL,
  asset_code TEXT NOT NULL DEFAULT 'KNYT',
  balance NUMERIC(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, asset_code)
);

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  asset_code TEXT NOT NULL DEFAULT 'KNYT',
  amount NUMERIC(20, 8) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  source TEXT NOT NULL,
  fiat_amount NUMERIC(10, 2),
  fiat_currency TEXT,
  paypal_tx_id TEXT,
  metadata JSONB,
  dvn_batch_id TEXT,
  dvn_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_balances_persona ON wallet_balances(persona_id);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_asset ON wallet_balances(asset_code);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_persona ON wallet_transactions(persona_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_asset ON wallet_transactions(asset_code);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_source ON wallet_transactions(source);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);

-- RLS Policies
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on wallet_balances"
  ON wallet_balances FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on wallet_transactions"
  ON wallet_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own balances (via persona_id matching)
CREATE POLICY "Users can read own balances"
  ON wallet_balances FOR SELECT
  USING (true); -- TODO: Link to auth.uid() via persona table

CREATE POLICY "Users can read own transactions"
  ON wallet_transactions FOR SELECT
  USING (true); -- TODO: Link to auth.uid() via persona table
