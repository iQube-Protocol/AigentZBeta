-- ============================================================================
-- persona_contacts — personal address book per persona
--
-- Stores contacts imported from Google Contacts or iPhone vCard exports.
-- Scoped per persona (T0: persona_id never serialised to clients).
-- Deduplication: unique (persona_id, source, source_id) so re-importing
-- the same Google contact is idempotent. Manual/vCard contacts deduplicate
-- on (persona_id, normalized_email) via a partial unique index.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        UUID NOT NULL,

  -- Display
  display_name      TEXT,
  first_name        TEXT,
  last_name         TEXT,
  organization      TEXT,
  job_title         TEXT,

  -- Contact details
  email             TEXT,
  email_2           TEXT,
  email_3           TEXT,
  phone             TEXT,
  phone_2           TEXT,
  address           TEXT,
  notes             TEXT,

  -- Import provenance
  source            TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT persona_contacts_source_check
      CHECK (source IN ('google_contacts', 'vcard', 'manual')),
  source_id         TEXT,   -- Google resourceName or vCard UID

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast lookup for a persona's full contact list
CREATE INDEX IF NOT EXISTS idx_persona_contacts_persona
  ON public.persona_contacts (persona_id, updated_at DESC);

-- Dedup Google contacts on re-import (same source_id per persona)
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_contacts_source_dedup
  ON public.persona_contacts (persona_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- Dedup manual/vCard contacts on email per persona
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_contacts_email_dedup
  ON public.persona_contacts (persona_id, lower(email))
  WHERE email IS NOT NULL;

-- Full-text search on name + email
CREATE INDEX IF NOT EXISTS idx_persona_contacts_search
  ON public.persona_contacts
  USING gin(to_tsvector('english',
    coalesce(display_name, '') || ' ' ||
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(organization, '')
  ));

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.persona_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_persona_contacts" ON public.persona_contacts;
CREATE POLICY "service_role_persona_contacts"
  ON public.persona_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
