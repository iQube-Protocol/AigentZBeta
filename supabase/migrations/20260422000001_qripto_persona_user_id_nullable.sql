-- Make nakamoto_qripto_personas.user_id nullable to match the KNYT table.
-- Qripto CRM records imported via CSV or admin tooling don't yet have a
-- platform account, so user_id must be nullable for CRM-first seeding to work.
-- The platform links user_id at first login via the email-based fallback in
-- GET /api/iqube/persona/qripto.

ALTER TABLE public."nakamoto_qripto_personas"
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public."nakamoto_qripto_personas".user_id
  IS 'Auth user UUID. NULL for CRM-only records (no platform account yet). Linked at first login by GET /api/iqube/persona/qripto.';
