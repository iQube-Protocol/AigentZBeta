-- Identity iQube — DIDQube schema
-- Stores a user's unified identity: name, multiple emails/phones/addresses,
-- linked personas, and an optional state-issued ID (driving licence).

CREATE TABLE IF NOT EXISTS public.identity_iqubes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE,

  -- Core name
  first_name               text NOT NULL DEFAULT '',
  last_name                text NOT NULL DEFAULT '',
  middle_name              text NOT NULL DEFAULT '',
  date_of_birth            text NOT NULL DEFAULT '',

  -- Multiple contact entries (JSONB arrays)
  -- EmailEntry:   { id, address, label, primary }
  -- PhoneEntry:   { id, number, label, primary }
  -- AddressEntry: { id, street, city, state, country, postal, label, primary }
  emails                   jsonb NOT NULL DEFAULT '[]',
  phones                   jsonb NOT NULL DEFAULT '[]',
  addresses                jsonb NOT NULL DEFAULT '[]',

  -- Linked personas: { id, type, label, uuid }
  -- Populated automatically when KNYT/Qripto iQubes are created
  personas                 jsonb NOT NULL DEFAULT '[]',

  -- State-issued ID (optional, stored encrypted in production via blakQube)
  driving_license_number   text NOT NULL DEFAULT '',
  driving_license_state    text NOT NULL DEFAULT '',
  driving_license_expiry   text NOT NULL DEFAULT '',

  -- DIDQube / wallet
  fio_handle               text NOT NULL DEFAULT '',

  -- Mint stub reference (set once staged for on-chain minting)
  mint_stub_id             uuid,
  mint_status              text NOT NULL DEFAULT 'unminted',  -- unminted | staged | minting | minted

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.identity_iqubes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identity_iqubes_user_select"
  ON public.identity_iqubes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "identity_iqubes_user_insert"
  ON public.identity_iqubes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "identity_iqubes_user_update"
  ON public.identity_iqubes FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for admin and background jobs
CREATE POLICY "identity_iqubes_service_role"
  ON public.identity_iqubes
  USING (auth.role() = 'service_role');

-- Index for user lookups
CREATE INDEX IF NOT EXISTS identity_iqubes_user_id_idx ON public.identity_iqubes (user_id);
