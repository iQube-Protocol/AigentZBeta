-- Wallet atomic asset conversion (2026-09-01, CTP Slice C prerequisite —
-- Part B of the USDC->Q¢ conversion repair).
--
-- Canonicalises the conversion mechanics `/api/wallet/qct/convert/usdc-to-qc`
-- already performs into ONE atomic operation. Before this migration,
-- services/wallet/qctLedgerService.ts's debitWalletAsset/creditWalletAsset
-- each read-modify-wrote the balance row separately, never checked the write
-- errors before returning success, and the route "rolled back" a failed
-- credit with a COMPENSATING credit rather than a real transaction abort —
-- a genuine read-modify-write race under concurrency, and a window where a
-- committed debit could outlive a failed credit.
--
-- This function performs the entire debit+credit+both-ledger-inserts inside
-- ONE Postgres function invocation, which is itself one atomic transaction:
-- any exception anywhere in the body aborts the WHOLE thing automatically,
-- with no compensating-transaction logic needed. Row locks
-- (`SELECT ... FOR UPDATE`) are taken on BOTH asset balance rows before any
-- read is trusted, in a FIXED lock order (ascending asset_code) regardless
-- of which asset is being debited vs credited, so two concurrent
-- conversions between the same two assets in opposite directions cannot
-- deadlock each other.
--
-- Deliberately generic over (source_asset, destination_asset, source_amount,
-- destination_amount) rather than USDC/QCT-specific: the rate/fee formula
-- itself stays where it already lived (services/wallet/qctLedgerService.ts,
-- preserved unmodified) — this function's job is ONLY the atomic ledger
-- mechanics, which is exactly where the real race/partial-failure risk
-- lives. It is reusable for any future two-asset wallet conversion without
-- a second copy of this locking logic.
--
-- Insufficient funds is raised with a distinguishable SQLSTATE ('P0001'
-- with a recognisable message prefix) so the calling service can translate
-- it to the same `{success:false, error:'Insufficient ...'}` shape the
-- route's callers already expect — never a generic 500 for an ordinary,
-- expected refusal.

CREATE OR REPLACE FUNCTION public.convert_wallet_asset(
  p_persona_id TEXT,
  p_source_asset TEXT,
  p_destination_asset TEXT,
  p_source_amount NUMERIC,
  p_destination_amount NUMERIC,
  p_source TEXT,
  p_metadata JSONB,
  p_debit_tx_id TEXT,
  p_credit_tx_id TEXT
)
RETURNS TABLE (
  debit_tx_id TEXT,
  credit_tx_id TEXT,
  prior_source_balance NUMERIC,
  resulting_source_balance NUMERIC,
  prior_destination_balance NUMERIC,
  resulting_destination_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_asset TEXT;
  v_second_asset TEXT;
  v_source_balance NUMERIC;
  v_destination_balance NUMERIC;
BEGIN
  IF p_source_asset = p_destination_asset THEN
    RAISE EXCEPTION 'INVALID_CONVERSION: source and destination asset must differ (%)', p_source_asset;
  END IF;
  IF p_source_amount <= 0 OR p_destination_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_CONVERSION: amounts must be positive (source=%, destination=%)', p_source_amount, p_destination_amount;
  END IF;

  -- Ensure both balance rows exist (first-time asset holders start at 0) —
  -- idempotent, never overwrites an existing balance.
  INSERT INTO wallet_balances (persona_id, asset_code, balance)
  VALUES (p_persona_id, p_source_asset, 0), (p_persona_id, p_destination_asset, 0)
  ON CONFLICT (persona_id, asset_code) DO NOTHING;

  -- FIXED lock order (ascending asset_code) regardless of debit/credit
  -- direction — the deadlock-avoidance property this repair requires.
  IF p_source_asset < p_destination_asset THEN
    v_first_asset := p_source_asset;
    v_second_asset := p_destination_asset;
  ELSE
    v_first_asset := p_destination_asset;
    v_second_asset := p_source_asset;
  END IF;

  PERFORM 1 FROM wallet_balances
    WHERE persona_id = p_persona_id AND asset_code = v_first_asset
    FOR UPDATE;
  PERFORM 1 FROM wallet_balances
    WHERE persona_id = p_persona_id AND asset_code = v_second_asset
    FOR UPDATE;

  SELECT balance INTO v_source_balance
    FROM wallet_balances WHERE persona_id = p_persona_id AND asset_code = p_source_asset;
  SELECT balance INTO v_destination_balance
    FROM wallet_balances WHERE persona_id = p_persona_id AND asset_code = p_destination_asset;

  -- The final, race-safe guard — re-checked here under lock, never trusted
  -- from any pre-flight read the caller may have done before invoking this
  -- function.
  IF v_source_balance < p_source_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS: need % have % of %', p_source_amount, v_source_balance, p_source_asset;
  END IF;

  UPDATE wallet_balances
    SET balance = balance - p_source_amount, updated_at = now()
    WHERE persona_id = p_persona_id AND asset_code = p_source_asset;

  UPDATE wallet_balances
    SET balance = balance + p_destination_amount, updated_at = now()
    WHERE persona_id = p_persona_id AND asset_code = p_destination_asset;

  INSERT INTO wallet_transactions (id, persona_id, asset_code, amount, direction, source, metadata)
    VALUES (p_debit_tx_id, p_persona_id, p_source_asset, p_source_amount, 'debit', p_source, p_metadata);

  INSERT INTO wallet_transactions (id, persona_id, asset_code, amount, direction, source, metadata)
    VALUES (p_credit_tx_id, p_persona_id, p_destination_asset, p_destination_amount, 'credit', p_source, p_metadata);

  RETURN QUERY
  SELECT
    p_debit_tx_id,
    p_credit_tx_id,
    v_source_balance,
    v_source_balance - p_source_amount,
    v_destination_balance,
    v_destination_balance + p_destination_amount;
END;
$$;

-- Callable only by the service role — this function moves real wallet
-- balances and must never be reachable from an anon/authenticated client
-- session directly (the API route, running under the service-role key, is
-- the only intended caller).
REVOKE ALL ON FUNCTION public.convert_wallet_asset(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_wallet_asset(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, TEXT, TEXT) TO service_role;
