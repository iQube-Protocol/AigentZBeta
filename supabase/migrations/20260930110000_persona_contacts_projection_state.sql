-- ============================================================================
-- persona_contacts — projection_state (distinct from promotion_state)
--
-- Hardens the ContactGraph reconciliation projector
-- (services/contactGraph/reconciliation.ts) for scale: at 1,200+ rows per
-- persona, the pre-existing lazy-backfill query
-- (`promotion_state='confirmed' AND promoted_contact_person_id IS NULL`)
-- re-scans every not-yet-projected row on every GET, including rows that
-- can NEVER be projected because they carry no email/phone field at all
-- (778 such rows observed live) and rows already flagged for manual review
-- because their candidate endpoints resolve to more than one existing
-- ContactPerson (the "ambiguous" case — 1 observed live).
--
-- promotion_state answers "has the OWNER confirmed this row is a real,
-- saved contact" (candidate vs confirmed — C8/NC3/NC4, unchanged by this
-- migration). projection_state answers a DIFFERENT question: "has THIS row
-- actually been projected into ContactGraph" — with two additional states
-- (ineligible, ambiguous) that let the reconciliation query skip rows that
-- would only fail or need human review, instead of re-attempting them on
-- every call.
--
-- Split of responsibility (never overlapping):
--   - 'pending'   — default; structurally eligible (has an endpoint field),
--                   not yet projected. Set by ADD COLUMN default and by the
--                   trigger below when a previously endpoint-less row gains
--                   one (e.g. edited to add an email/phone).
--   - 'ineligible'— structurally endpoint-less (no email/email_2/email_3/
--                   phone/phone_2). Set ONLY by the trigger below — a purely
--                   deterministic, column-driven classification.
--   - 'projected' — set ONLY by projectPersonaContact
--                   (services/contactGraph/reconciliation.ts), in the SAME
--                   update as promoted_contact_person_id, after it has
--                   actually resolved (created or matched) exactly one
--                   ContactPerson. The trigger never sets this state — it
--                   requires cross-table resolution the trigger cannot do.
--   - 'ambiguous' — set ONLY by projectPersonaContact when a row's
--                   candidate endpoints resolve to MORE THAN ONE distinct
--                   existing ContactPerson. Never auto-retried by the batch
--                   reconciler; waits for explicit human/aigentMe-assisted
--                   review (matches this module's existing NC2/NC3
--                   discipline: no silent merge on ambiguous evidence).
--
-- The trigger below is purely structural and NEVER sets 'projected' or
-- 'ambiguous' — those require the cross-table lookups only the application
-- layer performs. It also NEVER regresses a row already carrying
-- promoted_contact_person_id — an unrelated column update (e.g. `notes`
-- changing) on an already-projected row must not touch projection_state.
--
-- This migration is classification/schema-only. It does NOT re-run
-- projection, does NOT call any ContactGraph service function, and does NOT
-- touch promoted_contact_person_id for any row — the live data repair
-- already performed against the live Supabase project stands untouched; this
-- migration only makes the EXISTING promoted_contact_person_id values (and
-- the existing email/phone columns) visible as a first-class, indexed
-- projection_state so the reconciliation query can filter on it directly
-- instead of re-deriving eligibility from raw columns on every call.
--
-- Idempotent throughout (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER) — matches this repo's migration-safety convention
-- (20260602100000_intent_chains.sql's set_updated_at trigger pair is the
-- idiom followed here).
-- ============================================================================

ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS projection_state text NOT NULL DEFAULT 'pending'
    CONSTRAINT persona_contacts_projection_state_check
    CHECK (projection_state IN ('pending', 'projected', 'ineligible', 'ambiguous'));

CREATE INDEX IF NOT EXISTS idx_persona_contacts_projection_state
  ON public.persona_contacts (persona_id, projection_state);

-- ── Trigger: keep the two purely-structural states honest ──────────────────

CREATE OR REPLACE FUNCTION public.persona_contacts_set_projection_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- A row the application layer has already projected owns its own
  -- projection_state from here on ('projected', or 'ambiguous' pending
  -- review) — an unrelated column changing (e.g. notes) must never regress
  -- it back to 'pending'/'ineligible'.
  IF NEW.promoted_contact_person_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL AND NEW.email_2 IS NULL AND NEW.email_3 IS NULL
     AND NEW.phone IS NULL AND NEW.phone_2 IS NULL THEN
    -- Endpoint-less: can never be projected as-is. Deterministic, purely
    -- structural — never 'ambiguous' (that requires cross-table resolution
    -- only the application layer can do).
    NEW.projection_state := 'ineligible';
  ELSIF NEW.projection_state = 'ineligible' THEN
    -- Was endpoint-less, just gained an endpoint field (e.g. edited to add
    -- an email/phone) — re-eligible for reconciliation. Never touches
    -- 'ambiguous' (application-only) or 'projected' (set only alongside
    -- promoted_contact_person_id, already handled by the early return above).
    NEW.projection_state := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS persona_contacts_set_projection_state_trigger ON public.persona_contacts;
CREATE TRIGGER persona_contacts_set_projection_state_trigger
  BEFORE INSERT OR UPDATE ON public.persona_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.persona_contacts_set_projection_state();

-- ── One-time backfill classification for EXISTING rows ─────────────────────
-- Classification only, based on data that already exists — never calls
-- projectPersonaContact, never touches promoted_contact_person_id. Passes
-- through the trigger above like any other UPDATE; both statements are
-- consistent with what the trigger would independently compute (see header),
-- so this is belt-and-braces, not a race with it.

UPDATE public.persona_contacts SET projection_state = 'ineligible'
  WHERE projection_state = 'pending'
    AND promoted_contact_person_id IS NULL
    AND email IS NULL AND email_2 IS NULL AND email_3 IS NULL
    AND phone IS NULL AND phone_2 IS NULL;

UPDATE public.persona_contacts SET projection_state = 'projected'
  WHERE promoted_contact_person_id IS NOT NULL
    AND projection_state != 'projected';
