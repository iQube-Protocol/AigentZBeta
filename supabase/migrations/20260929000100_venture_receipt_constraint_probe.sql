-- 20260929000100_venture_receipt_constraint_probe.sql
--
-- VL-CT-001, operator ruling 2026-07-29 (RULING 5):
--
--   > Relying on an insert failure is too quiet for a consequential pipeline.
--
-- WHAT WAS TOO QUIET. Before this, the only thing standing between "the
-- action-type migration was never applied" and "venture receipts silently stop
-- existing" was the CHECK constraint rejecting the insert. That failure lands
-- deep inside a receipt write, several call sites in this repo wrap receipt
-- writes in an empty catch, and the DVN anchor is lost along with the row. The
-- deployment is broken and nothing says so.
--
-- WHAT THIS ADDS. A probe function whose PRESENCE is the constraint version
-- marker and whose RETURN VALUE is the constraint definition. The application
-- calls it before emitting any live venture receipt
-- (`services/venture/trading/receiptCompatibility.ts`) and REFUSES to emit when
-- it is missing, when the constraint is absent, or when the definition does not
-- contain all nine venture action types. Every one of those is a loud, immediate
-- error naming the exact SQL to run -- not a swallowed insert failure discovered
-- weeks later as missing provenance.
--
-- Run this AFTER 20260929000000_venture_substrate_receipt_types.sql. Running it
-- before is harmless: the probe simply reports the constraint as incompatible,
-- which is the true answer.
--
-- SECURITY DEFINER + a stable search_path: reading a constraint definition is a
-- catalogue read with no data exposure, and the fixed search_path stops the
-- usual definer-function hijack.

CREATE OR REPLACE FUNCTION public.venture_receipt_action_type_constraint()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
   WHERE c.conname = 'activity_receipts_action_type_check'
     AND c.conrelid = 'public.activity_receipts'::regclass
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.venture_receipt_action_type_constraint() IS
  'VL-CT-001 deployment compatibility probe. Returns the activity_receipts action_type CHECK definition so the application can refuse live venture receipt emission when the action-type migration is absent, instead of discovering it as a failed insert. See services/venture/trading/receiptCompatibility.ts.';

GRANT EXECUTE ON FUNCTION public.venture_receipt_action_type_constraint() TO anon, authenticated, service_role;
