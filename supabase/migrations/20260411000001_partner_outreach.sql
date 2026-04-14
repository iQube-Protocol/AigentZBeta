-- Migration: Partner outreach tracker for KNYT Wheel campaign
-- Tracks outreach status for the 16+ partner contacts in the KNYT Wheel launch plan.

CREATE TABLE IF NOT EXISTS public.partner_outreach (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name      TEXT         NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  outreach_status   TEXT         NOT NULL DEFAULT 'pending',
  -- pending | contacted | responded | committed | declined | deferred
  outreach_channel  TEXT,
  -- email | phone | dm | linkedin | telegram | in_person
  partner_type      TEXT,
  -- media | platform | community | investor | brand
  notes             TEXT,
  first_contact_at  TIMESTAMPTZ,
  last_contact_at   TIMESTAMPTZ,
  follow_up_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.partner_outreach
  IS 'KNYT Wheel campaign partner outreach tracker. Covers the 16-partner blitz from the partner/investor activation addendum.';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_partner_outreach_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_outreach_updated_at ON public.partner_outreach;
CREATE TRIGGER trg_partner_outreach_updated_at
  BEFORE UPDATE ON public.partner_outreach
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_outreach_updated_at();

-- RLS: only admins can access partner outreach data
ALTER TABLE public.partner_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_partner_outreach"
  ON public.partner_outreach
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.personas p
      WHERE p.auth_profile_id = auth.uid()
        AND p.is_admin = true
    )
  );

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_partner_outreach_status
  ON public.partner_outreach (outreach_status);
