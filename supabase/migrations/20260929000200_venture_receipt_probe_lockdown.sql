-- 20260929000200_venture_receipt_probe_lockdown.sql
--
-- VL-CT-001, operator RULING 2 (2026-07-29) — SECURITY.
--
--   > The SECURITY DEFINER probe is currently granted to `anon`. Revoke it.
--   > Service-role-only, pin `search_path`, no caller-controlled dynamic SQL,
--   > return only the minimum compatibility result.
--
-- ─── What was wrong with 20260929000100 ────────────────────────────────────
--
-- 1. GRANTED TO `anon`. The probe is `SECURITY DEFINER`, so it runs as its
--    OWNER and bypasses both table grants and RLS. Handing that to `anon` means
--    any unauthenticated PostgREST caller could invoke it. This is the same
--    defect class as the QubeTalk statistics functions repaired in
--    20260907000000 — a definer function reachable by `anon` is a hole that the
--    table-level lockdown does not constrain at all. The probe exists to be
--    called by ONE caller (the deployment gate + the server-side emission
--    backstop), and both run as the service role.
--
-- 2. RETURNED THE WHOLE CONSTRAINT DEFINITION. `pg_get_constraintdef` on
--    `activity_receipts_action_type_check` yields the platform's ENTIRE action
--    vocabulary — passport, governance, finance, QubeTalk, invariants,
--    research, every feature area's internal event names. The compatibility
--    decision needs to know one thing: which of the NINE venture action types
--    this database accepts. Everything else in that string was disclosure the
--    check never asked for.
--
-- ─── What this migration does ───────────────────────────────────────────────
--
-- Replaces the probe with one that returns ONLY the `venture_*` action types
-- the deployed constraint accepts:
--
--   NULL          — the constraint does not exist on this database
--   text[]        — exactly the venture_* values the constraint accepts
--                   (empty array = constraint present, no venture types)
--
-- The application (`services/venture/trading/receiptCompatibility.ts`) compares
-- that set against its own `VENTURE_RECEIPT_ACTION_TYPES` and refuses emission
-- on any shortfall. The nine names are NOT restated here: the probe filters by
-- the `venture_` prefix, so this migration does not become a third declaration
-- of a vocabulary that already lives in two.
--
-- ─── Verified against the ruling's last two points ──────────────────────────
--
-- NO CALLER-CONTROLLED DYNAMIC SQL. The function takes NO arguments, contains
-- no `EXECUTE`, no `format()`, no string-built SQL, and names its one constraint
-- and its one table as literals. There is nothing a caller can steer. (The
-- superseded version was already clean on this point; it is restated here so a
-- future editor sees the constraint they must preserve.)
--
-- SEARCH_PATH PINNED, and pinned HARDER than before. `pg_catalog, pg_temp` —
-- `public` is deliberately absent, because the body needs nothing from it:
-- `public.activity_receipts` is written schema-qualified, and every function it
-- calls (`pg_get_constraintdef`, `regexp_matches`, `array_agg`, `coalesce`)
-- lives in `pg_catalog`. Trailing `pg_temp` is the standard hardening: without
-- it a caller can create a temp object that shadows a catalogue name and have
-- the definer execute it. A `SECURITY DEFINER` function with an unpinned
-- search_path is a privilege-escalation vector, full stop.
--
-- ─── Quoted-literal matching moved into the probe ───────────────────────────
--
-- The regex matches `'venture_...'` as a QUOTED LITERAL inside the definition,
-- not as a bare substring. A comment or a column name mentioning
-- `venture_settlement_simulated` is not the database accepting it, and this is
-- now the layer that enforces that distinction — the application receives a set
-- of accepted values and tests exact membership, which is strictly stronger
-- than the substring test it used to perform on the raw definition text.
--
-- Run AFTER 20260929000000 and 20260929000100. Idempotent: re-running drops and
-- recreates the function and re-applies the same grants.

-- The return type changes (text -> text[]), so CREATE OR REPLACE cannot be
-- used; the old signature is dropped first. Dropping also removes the old
-- grants, including the `anon` grant this migration exists to revoke.
DROP FUNCTION IF EXISTS public.venture_receipt_action_type_constraint();

CREATE FUNCTION public.venture_receipt_action_type_constraint()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT (
    SELECT coalesce(array_agg(DISTINCT m.captured[1] ORDER BY m.captured[1]), ARRAY[]::text[])
      FROM regexp_matches(
             pg_get_constraintdef(c.oid),
             '''(venture_[a-z_]+)''',
             'g'
           ) AS m(captured)
  )
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.venture_receipt_action_type_constraint() IS
  'VL-CT-001 deployment compatibility probe. Returns ONLY the venture_* action types the activity_receipts CHECK constraint accepts (NULL when the constraint is absent), so the deployment gate and the emission backstop can refuse live venture receipt emission when the action-type migration has not been applied. SECURITY DEFINER, service_role only, search_path pinned, no arguments and no dynamic SQL. See services/venture/trading/receiptCompatibility.ts and scripts/check-venture-receipt-constraint.ts.';

-- A freshly created function is EXECUTE-able by PUBLIC by default, so the
-- revoke MUST follow the create. PUBLIC covers every role including anon and
-- authenticated; the two are named explicitly as well, so a reader (and the
-- canary) can see the specific roles this migration exists to shut out.
REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM anon;
REVOKE EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() FROM authenticated;

-- The only role that may call it. The deployment gate runs with the service
-- role; the server-side emission backstop runs with the service role. There is
-- no browser-reachable caller, and there must never be one.
GRANT EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() TO service_role;
