-- 20260724000000_x409_invitations.sql
--
-- x409 agreement invitations — the special-link seam of the Locker-based
-- agreement exchange (CFS-042/CFS-044, 2026-07-18 operator direction).
--
-- An admin issues an invitation bound to a formed x409 Constitutional
-- Agreement. The external party (e.g. Austin + his agent) signs up, opens
-- their Passport Locker with the invite code, and CLAIMS it: the agreement
-- lands in their locker as an encrypted contract item to be executed
-- (project-initiation contract). QubeTalk channels + locker grants then
-- carry the private research exchange.
--
-- The code is an unguessable capability string (same trust model as the
-- public agreement route's agreementId). One claim per invitation.
-- Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.x409_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  agreement_id text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_item_id text
);

CREATE INDEX IF NOT EXISTS x409_invitations_code_idx ON public.x409_invitations (code);

ALTER TABLE public.x409_invitations ENABLE ROW LEVEL SECURITY;
