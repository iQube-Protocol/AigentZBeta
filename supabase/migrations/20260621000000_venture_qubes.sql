-- VentureQube v1.0 — sovereign per-venture formation primitive.
--
-- Source of truth: Founder Office PRD v3 + VentureQube Spec v1.
-- One row per venture. Registered into the iQube registry SoT (iqube_id_map)
-- as primitive_type='ClusterQube' by services/venture/registerVentureIqube.ts.
--
-- T0 discipline: owner_persona_id is server-internal only (service-role RLS);
-- the layered JSON carries T2-safe public refs only (never raw personaId /
-- passportId / standingId). See CLAUDE.md "Identity & Access Spine".

BEGIN;

CREATE TABLE IF NOT EXISTS public.venture_qubes (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Registry-canonical UUID once the VentureQube is registered as a
  -- ClusterQube in iqube_id_map. Nullable until registration completes.
  iqube_id         uuid,
  -- T0 — server-internal only. Never serialised to the browser or a receipt.
  owner_persona_id text        NOT NULL,
  venture_name     text        NOT NULL,
  venture_slug     text        NOT NULL,
  venture_stage    text        NOT NULL DEFAULT 'concept'
    CHECK (venture_stage IN ('concept','validation','formation','launch','growth','scale','institution')),
  -- The Founder Office path that produced or last advanced the venture.
  last_path        text
    CHECK (last_path IN ('discover','validate','architect')),
  schema_version   text        NOT NULL DEFAULT 'venture-iqube/v1.0',
  -- The full VentureQubeV1 layered object (13 layers). T2-safe payload only.
  layers           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Denormalised roll-up for board/sorting; mirror of governance.ventureConfidence.
  venture_confidence numeric(5,2),
  status           text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- One slug per operator (MVP: an operator owns one or many ventures).
  UNIQUE (owner_persona_id, venture_slug)
);

CREATE INDEX IF NOT EXISTS idx_venture_qubes_owner
  ON public.venture_qubes (owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_venture_qubes_stage
  ON public.venture_qubes (venture_stage);
CREATE INDEX IF NOT EXISTS idx_venture_qubes_iqube
  ON public.venture_qubes (iqube_id) WHERE iqube_id IS NOT NULL;

ALTER TABLE public.venture_qubes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venture_qubes_read_service"
  ON public.venture_qubes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "venture_qubes_write_service"
  ON public.venture_qubes FOR ALL USING (auth.role() = 'service_role');

-- update_updated_at_column() is created by an earlier migration and is the
-- shared touch-trigger used across the registry tables.
CREATE TRIGGER venture_qubes_updated_at
  BEFORE UPDATE ON public.venture_qubes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.venture_qubes IS
  'VentureQube v1.0 — sovereign per-venture formation primitive (ClusterQube specialization). One row per venture.';
COMMENT ON COLUMN public.venture_qubes.owner_persona_id IS
  'T0 — server-internal only. Never serialised to the browser or a chain-bound receipt.';
COMMENT ON COLUMN public.venture_qubes.layers IS
  'Full VentureQubeV1 layered object (13 layers). T2-safe public refs only.';

COMMIT;
