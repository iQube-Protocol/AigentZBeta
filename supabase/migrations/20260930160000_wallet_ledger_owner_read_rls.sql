-- Wallet ledger ownership-scoped read RLS (2026-09-01, Part D of the
-- USDC->Q¢ conversion repair — operator-approved, applied live to dev
-- ahead of this migration file per the session's migration-before-deploy
-- discipline; this file persists the exact approved policies in the repo).
--
-- Replaces both wallet SELECT policies in
-- supabase/migrations/20251205_knyt_ledger.sql, which read
-- `USING (true)` — not ownership-scoped at all, despite being named
-- "Users can read own ...". Mirrors the SAME auth.uid()::text =
-- auth_profile_id::text convention already established in
-- supabase/migrations/20241202_create_personas_table.sql and
-- supabase/migrations/20260622500000_delegation_grants.sql — no new RLS
-- idiom introduced. Service-role policies are UNCHANGED (service role keeps
-- full access for the API routes that perform every actual write).
--
-- Deliberately scoped to ONLY these two tables — see CLAUDE.md and the
-- session's own record: the estate-wide advisory that ~102 other public
-- tables currently have RLS disabled is a SEPARATE, dedicated table-by-
-- table audit, not folded into this migration.

DROP POLICY IF EXISTS "Users can read own balances" ON public.wallet_balances;
CREATE POLICY "Users can read own balances" ON public.wallet_balances
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR persona_id IN (
      SELECT id::text
      FROM public.personas
      WHERE auth.uid()::text = auth_profile_id::text
    )
  );

DROP POLICY IF EXISTS "Users can read own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can read own transactions" ON public.wallet_transactions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR persona_id IN (
      SELECT id::text
      FROM public.personas
      WHERE auth.uid()::text = auth_profile_id::text
    )
  );
