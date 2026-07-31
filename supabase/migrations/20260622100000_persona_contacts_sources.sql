-- ============================================================================
-- Extend persona_contacts to support additional import sources.
--
-- New sources:
--   linkedin   — CSV export from LinkedIn Connections
--   outlook    — CSV export from Outlook / Exchange (standard format)
--   csv        — Generic CSV (first_name, last_name, email, phone columns)
--   icloud     — vCard export from iCloud Contacts (same parser as vcard)
--
-- Phase 2: WhatsApp, HubSpot, Salesforce, Notion integrations.
-- ============================================================================

ALTER TABLE public.persona_contacts
  DROP CONSTRAINT IF EXISTS persona_contacts_source_check;

ALTER TABLE public.persona_contacts
  ADD CONSTRAINT persona_contacts_source_check
    CHECK (source IN (
      'google_contacts',
      'vcard',
      'icloud',
      'linkedin',
      'outlook',
      'csv',
      'manual'
    ));
