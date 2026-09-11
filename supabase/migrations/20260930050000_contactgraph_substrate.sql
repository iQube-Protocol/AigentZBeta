-- ============================================================================
-- ContactGraph — a contained, platform-wide contact-resolution capability
-- (QubeTalk Fast-Follow, ContactGraph + aigentMe First Deployment, priority
-- steps 2-3). NOT a QubeTalk-owned address book — QubeTalk references
-- ContactGraph identity resolution; it does not maintain a competing one
-- (C9/NC10, both directives of the fast-follow brief).
--
-- Reuse audit (see the ContactGraph reuse-audit matrix returned to the
-- operator before this migration was written):
--   - persona_contacts (20260622000000_persona_contacts.sql +
--     20260622100000_persona_contacts_sources.sql) is preserved UNTOUCHED
--     structurally. It remains the operational address-book path for every
--     existing caller (resolveRecipient.ts, draftEmail.ts, searchContacts.ts).
--     This migration only ADDS the already-authorized 'gmail_correspondence'
--     source value (per the 2026-08-17 Homecoming Closeout WP-C6 deferred
--     follow-on) plus nullable/DEFAULTed candidate-lifecycle columns
--     (NC1: no second contact database).
--   - qubetalk_participants / qubetalk_participant_endpoints (Slice 1,
--     20260930040000) are preserved UNTOUCHED structurally. This migration
--     adds one nullable bridge FK on each (contact_person_id /
--     contact_persona_id) so QubeTalk can reference ContactGraph resolution
--     without forking it (refinement 1 of the operator's approval).
--
-- Canonical hierarchy (locked, per the fast-follow brief §3):
--   ContactPerson -> ContactPersona -> CommunicationEndpoint
--   "Communication identifiers belong to personas; personas belong to
--   people." (C2)
--
-- Ownership key (refinement 4, resolved by spine audit — no new personhood
-- root required): ContactPerson is owned by owner_auth_profile_id, NOT
-- owner_persona_id. personas.auth_profile_id is the existing, canonicalized
-- (20260220110000_personas_auth_profile_canonicalization.sql), multi-email-
-- merged real-owner anchor. Scoping ContactPerson per active persona instead
-- would duplicate "John Doe" every time the operator switches their own
-- active persona — exactly what refinement 4 forbids. This is a T0 field,
-- same exposure class as qubetalk_participants.owner_persona_id: never
-- serialised to a client, service-role RLS only.
--
-- All statements additive/idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS) per this repo's migration-safety convention. No destructive
-- change to any existing table.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- 1. ContactPerson — the enduring human/contact, independent of context.
--    NOT a new identity/personhood authority (mirrors QubeTalk's own P6/N3):
--    linked_personhood_ref is nullable and, when set, is a real FK to
--    personas.public_ref — set only when this contact is independently
--    confirmed to be a real platform persona (C3/NC6).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- T0 — the real owner across all of the owner's own personas. See header.
  owner_auth_profile_id uuid NOT NULL,
  display_name text NOT NULL,
  -- Set only once independently confirmed to be a real platform persona —
  -- never inferred from a display-name or handle match (NC2/NC6).
  linked_personhood_ref text REFERENCES public.personas (public_ref),
  state text NOT NULL DEFAULT 'active'
    CONSTRAINT contact_persons_state_check CHECK (state IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_persons_owner_idx ON public.contact_persons (owner_auth_profile_id);
-- At most one contact-person row per (owner, resolved platform persona) —
-- prevents a duplicate directory entry once identity is confirmed. Mirrors
-- qubetalk_participants_owner_principal_uidx exactly.
CREATE UNIQUE INDEX IF NOT EXISTS contact_persons_owner_personhood_uidx
  ON public.contact_persons (owner_auth_profile_id, linked_personhood_ref)
  WHERE linked_personhood_ref IS NOT NULL;

ALTER TABLE public.contact_persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_contact_persons" ON public.contact_persons;
CREATE POLICY "service_role_contact_persons"
  ON public.contact_persons FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. ContactPersona — a role/context through which the owner knows/reaches
--    a ContactPerson ("Professional", "Personal", "Horizon"). Does NOT
--    assume every persona needs a formal Polity persona record — that link
--    is opt-in via linked_platform_persona_ref (nullable), set only when
--    the context genuinely IS an established platform persona.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_person_id uuid NOT NULL REFERENCES public.contact_persons (id) ON DELETE CASCADE,
  -- Denormalized from contact_persons.owner_auth_profile_id at creation time
  -- (set once, immutable) so every ownership check on contact_endpoints —
  -- the hot path, hit on every inbound-endpoint resolution — is a single
  -- one-hop embed rather than a two-hop join through contact_persons. Kept
  -- consistent by construction: only contactPersonas.ts's own
  -- createContactPersona ever inserts a row here, and it always copies this
  -- value from the already-ownership-checked parent contact_person.
  owner_auth_profile_id uuid NOT NULL,
  label text NOT NULL,
  -- Opt-in only — a ContactGraph contextual persona is NOT constitutionally
  -- established identity merely because the owner labelled it (C3/NC6).
  linked_platform_persona_ref text REFERENCES public.personas (public_ref),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contact_personas_person_label_uidx
  ON public.contact_personas (contact_person_id, label);
CREATE INDEX IF NOT EXISTS contact_personas_person_idx ON public.contact_personas (contact_person_id);
CREATE INDEX IF NOT EXISTS contact_personas_owner_idx ON public.contact_personas (owner_auth_profile_id);

ALTER TABLE public.contact_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_contact_personas" ON public.contact_personas;
CREATE POLICY "service_role_contact_personas"
  ON public.contact_personas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. CommunicationEndpoint — a reachable handle under a ContactPersona.
--    Reuses QubeTalk's own confidence vocabulary verbatim (never a second
--    scale) and persona_contacts' source vocabulary, extended with
--    'gmail_correspondence' and 'qubetalk_observed' (endpoints first seen
--    through a live QubeTalk conversation rather than any import/address
--    book). link_history is an append-only audit trail of propose/confirm/
--    reject/reassign actions (P5/N15-style traceability — mirrors
--    qubetalk_relationship_state.memory_source_message_ids rather than a
--    separate provenance table, per the "don't add a table for what an
--    array column can express" discipline).
--
--    Reassignment (moving a handle between two of the SAME person's
--    personas) is an UPDATE of contact_persona_id on the SAME row — the
--    endpoint id, first_observed_at and link_history are preserved, never
--    delete+recreate (C7: linking/reassigning re-indexes, never rewrites
--    source history).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contact_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_persona_id uuid NOT NULL REFERENCES public.contact_personas (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN (
    'metame', 'email', 'whatsapp', 'telegram', 'signal', 'linkedin', 'discord', 'x', 'sms'
  )),
  identifier text NOT NULL,
  -- Lowercased/canonicalized form (e.g. E.164 for phone, lowercased email) —
  -- computed by the service layer at write time; used for exact-match
  -- resolution only (N4/NC2: never a fuzzy/name-based match).
  normalized_identifier text NOT NULL,
  external_account_ref text,
  confidence text NOT NULL DEFAULT 'unresolved' CHECK (confidence IN (
    'verified', 'user_confirmed', 'high_confidence', 'tentative', 'unresolved'
  )),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'google_contacts', 'vcard', 'icloud', 'linkedin', 'outlook', 'csv',
    'gmail_correspondence', 'qubetalk_observed'
  )),
  inbound_capable boolean NOT NULL DEFAULT true,
  outbound_capable boolean NOT NULL DEFAULT true,
  is_preferred boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'reassigned', 'rejected')),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by_persona_id uuid,
  confirmed_at timestamptz,
  -- Append-only: [{action, fromContactPersonaId, toContactPersonaId, actorPersonaId, at, reason}, ...]
  link_history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Exact-match dedup within one persona/context — cross-persona (same
-- person, different context) dedup is a service-layer decision (a handle
-- CAN legitimately appear under two different contexts for the same
-- person), never a DB-level merge.
CREATE UNIQUE INDEX IF NOT EXISTS contact_endpoints_persona_platform_identifier_uidx
  ON public.contact_endpoints (contact_persona_id, platform, normalized_identifier);
CREATE INDEX IF NOT EXISTS contact_endpoints_persona_idx ON public.contact_endpoints (contact_persona_id);
CREATE INDEX IF NOT EXISTS contact_endpoints_platform_identifier_idx
  ON public.contact_endpoints (platform, normalized_identifier);

ALTER TABLE public.contact_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_contact_endpoints" ON public.contact_endpoints;
CREATE POLICY "service_role_contact_endpoints"
  ON public.contact_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. QubeTalk bridge — QubeTalk REFERENCES ContactGraph resolution; it does
--    not maintain a competing one (C9/NC10). Both nullable: a participant
--    may exist in QubeTalk's own directory before (or without ever being)
--    resolved against ContactGraph, matching Slice 1's existing "unresolved
--    participant" discipline. qubetalk_participants/_participant_endpoints
--    are otherwise UNTOUCHED — they remain the communications membrane's own
--    operational transport-observation record (refinement 1).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_participants
  ADD COLUMN IF NOT EXISTS contact_person_id uuid REFERENCES public.contact_persons (id);
CREATE INDEX IF NOT EXISTS qubetalk_participants_contact_person_idx
  ON public.qubetalk_participants (contact_person_id) WHERE contact_person_id IS NOT NULL;

ALTER TABLE public.qubetalk_participant_endpoints
  ADD COLUMN IF NOT EXISTS contact_persona_id uuid REFERENCES public.contact_personas (id);
CREATE INDEX IF NOT EXISTS qubetalk_participant_endpoints_contact_persona_idx
  ON public.qubetalk_participant_endpoints (contact_persona_id) WHERE contact_persona_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. persona_contacts — additive candidate-lifecycle + truthful Gmail
--    provenance, per the already-authorized 2026-08-17 WP-C6 follow-on and
--    refinement 2 (candidate lifecycle) of the operator's approval.
--
--    promotion_state distinguishes an OBSERVED correspondent from a SAVED
--    contact (C8/NC3/NC4): every row that already exists, and every row
--    from a deliberate import/manual source, defaults to 'confirmed'
--    (backward-compatible — nothing already saved becomes a candidate).
--    Only 'gmail_correspondence' rows are inserted as 'candidate' by the
--    (separately gated — see closeout §D) ingestion path. ONLY 'confirmed'
--    persona_contacts rows are eligible for the ContactGraph reconciliation
--    projector (services/contactGraph/reconciliation.ts) — a candidate must
--    be explicitly promoted first (NC3: never silently promoted).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.persona_contacts
  DROP CONSTRAINT IF EXISTS persona_contacts_source_check;
ALTER TABLE public.persona_contacts
  ADD CONSTRAINT persona_contacts_source_check
    CHECK (source IN (
      'google_contacts', 'vcard', 'icloud', 'linkedin', 'outlook', 'csv', 'manual',
      'gmail_correspondence'
    ));

ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS promotion_state text NOT NULL DEFAULT 'confirmed'
    CONSTRAINT persona_contacts_promotion_state_check CHECK (promotion_state IN ('candidate', 'confirmed'));
ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS interaction_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS reciprocal boolean NOT NULL DEFAULT false;
ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS first_observed_at timestamptz;
ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS last_observed_at timestamptz;
-- Links a promoted candidate to the ContactGraph row it was projected into —
-- nullable; set only by the promotion action, never by the observation
-- ingestion path itself (NC3).
ALTER TABLE public.persona_contacts
  ADD COLUMN IF NOT EXISTS promoted_contact_person_id uuid REFERENCES public.contact_persons (id);

CREATE INDEX IF NOT EXISTS idx_persona_contacts_promotion_state
  ON public.persona_contacts (persona_id, promotion_state);
