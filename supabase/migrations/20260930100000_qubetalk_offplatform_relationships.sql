-- 20260930100000_qubetalk_offplatform_relationships.sql
--
-- QubeTalk P0.5 — off-platform relationship sibling anchor.
--
-- Gap: POST /api/qubetalk/people/[personId]/channel 409s for any
-- ContactGraph ContactPerson with no linked platform persona
-- (linked_personhood_ref IS NULL). passport_peer_channels is
-- personhood-bound BY CONSTRUCTION — both principals are identified by a
-- real Polity Public Reference (personaPublicRef) — so it structurally
-- cannot represent a relationship with someone who has no platform
-- identity at all.
--
-- Operator ruling (verbatim): "Choose the sibling relationship object, NOT
-- a discriminator that weakens passport_peer_channels. Create the smallest
-- sibling relationship anchor required for that case and expose both
-- through one QubeTalk Relationship service/interface."
--
-- This migration:
--   1. Adds qubetalk_offplatform_relationships — the sibling anchor. Owned
--      by owner_auth_profile_id (matches contact_persons' own scoping
--      exactly — a ContactPerson is auth-profile-scoped, not
--      persona-scoped; this anchor is scoped the same way its
--      counterparty is). Carries promoted_to_channel_id so a LATER real
--      passport_peer_channels row (once the contact links a real persona)
--      can be recorded WITHOUT rewriting any existing
--      qubetalk_relationship_state / qubetalk_conversations row that
--      already anchors on this id — promotion only ADDS a pointer, it
--      never migrates history.
--   2. Widens qubetalk_relationship_state to accept EITHER anchor kind
--      (channel_id XOR offplatform_relationship_id, enforced by a CHECK —
--      the structural-distinctness requirement: a caller can always tell
--      which kind a given row is by which column is populated). channel_id
--      stops being the primary key (it must become nullable); a new `id`
--      column takes over as the real PK. This is a REAL schema change to an
--      existing table's key, but it is additive/idempotent per-column and
--      preserves every existing row (one one-time backfill of `id`).
--   3. Widens qubetalk_conversations with a third, purely additive nullable
--      FK column (offplatform_relationship_id) — no PK change needed, it
--      already has its own `id` PK. No CHECK added here: the table already
--      permits relationship_channel_id AND group_id to both be null
--      (broadcast/fan_in/public_thread/federated topologies), so a third
--      always-nullable, uncoupled column does not need an XOR guard; the
--      offplatform path is disciplined at the SERVICE layer (a conversation
--      created via the offplatform path never also sets
--      relationship_channel_id) and is asserted so in the test suite.
--
-- passport_peer_channels itself is UNTOUCHED — zero schema/semantic change.
--
-- All statements additive/idempotent (CREATE TABLE IF NOT EXISTS, ADD
-- COLUMN IF NOT EXISTS) per this repo's migration-safety convention.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. qubetalk_offplatform_relationships — the sibling anchor.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_offplatform_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- T0 — matches contact_persons.owner_auth_profile_id's own scoping
  -- exactly (a ContactPerson is auth-profile-scoped, not persona-scoped;
  -- this anchor must be scoped the same way its counterparty is).
  owner_auth_profile_id uuid NOT NULL,
  contact_person_id uuid NOT NULL REFERENCES public.contact_persons (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  -- Set once this off-platform relationship is later linked to a real
  -- passport_peer_channels row (the ContactPerson gained a linked
  -- persona and the two sides opened a real peer channel). Existing
  -- qubetalk_relationship_state / qubetalk_conversations rows keep
  -- pointing at THIS anchor id unchanged — promotion never rewrites
  -- conversation/message history, it only records that a richer,
  -- personhood-bound anchor now also exists for the same relationship.
  promoted_to_channel_id uuid REFERENCES public.passport_peer_channels (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_offplatform_relationships_owner_contact_uidx
  ON public.qubetalk_offplatform_relationships (owner_auth_profile_id, contact_person_id);
CREATE INDEX IF NOT EXISTS qubetalk_offplatform_relationships_owner_idx
  ON public.qubetalk_offplatform_relationships (owner_auth_profile_id);

ALTER TABLE public.qubetalk_offplatform_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_qubetalk_offplatform_relationships" ON public.qubetalk_offplatform_relationships;
CREATE POLICY "service_role_qubetalk_offplatform_relationships"
  ON public.qubetalk_offplatform_relationships FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.qubetalk_offplatform_relationships IS
  'QubeTalk sibling relationship anchor for a ContactGraph ContactPerson with NO linked platform persona (linked_personhood_ref IS NULL). NEVER a substitute for passport_peer_channels once a real persona link exists — see promoted_to_channel_id. Deny-all RLS, service-role-only.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. qubetalk_relationship_state — widen to accept EITHER anchor kind.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_relationship_state
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS offplatform_relationship_id uuid REFERENCES public.qubetalk_offplatform_relationships (id) ON DELETE CASCADE,
  ALTER COLUMN channel_id DROP NOT NULL;

-- Backfill `id` for every existing row (channel_id was already unique via
-- being the PK, so this is a pure 1:1 assignment, no collision risk).
UPDATE public.qubetalk_relationship_state SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.qubetalk_relationship_state ALTER COLUMN id SET NOT NULL;

-- Drop the old channel_id-as-PK, make `id` the real PK instead. Wrapped in
-- a DO block per this repo's established idempotent-DDL idiom (see
-- 20260419000001_launch_ops_schema.sql's `duplicate_object`-guarded blocks)
-- so a re-run after the constraint already exists is a no-op rather than an
-- error — Postgres has no `DROP CONSTRAINT IF EXISTS` gap here since we DO
-- use IF EXISTS on the drop, but the subsequent ADD PRIMARY KEY has no
-- "IF NOT EXISTS" form at all, so it needs the same guard as any other
-- ADD CONSTRAINT in this migration set.
ALTER TABLE public.qubetalk_relationship_state DROP CONSTRAINT IF EXISTS qubetalk_relationship_state_pkey;
DO $$ BEGIN
  ALTER TABLE public.qubetalk_relationship_state ADD PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Exactly one relationship kind per row — the structural-distinctness
-- requirement (a caller must always be able to tell which anchor kind a
-- row is by which column is populated, never both/neither).
DO $$ BEGIN
  ALTER TABLE public.qubetalk_relationship_state
    ADD CONSTRAINT qubetalk_relationship_state_exactly_one_anchor
    CHECK (num_nonnulls(channel_id, offplatform_relationship_id) = 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1:1 per anchor, either kind (mirrors the old PRIMARY KEY(channel_id)
-- guarantee, now expressed as two partial unique indexes since the anchor
-- is polymorphic).
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_relationship_state_channel_uidx
  ON public.qubetalk_relationship_state (channel_id) WHERE channel_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_relationship_state_offplatform_uidx
  ON public.qubetalk_relationship_state (offplatform_relationship_id) WHERE offplatform_relationship_id IS NOT NULL;

COMMENT ON COLUMN public.qubetalk_relationship_state.offplatform_relationship_id IS
  'The OTHER valid anchor kind — a qubetalk_offplatform_relationships row, for a relationship with a ContactGraph contact who has no linked platform persona yet. Exactly one of channel_id/offplatform_relationship_id is set per row (qubetalk_relationship_state_exactly_one_anchor).';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. qubetalk_conversations — additive-only third anchor column.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.qubetalk_conversations
  ADD COLUMN IF NOT EXISTS offplatform_relationship_id uuid REFERENCES public.qubetalk_offplatform_relationships (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS qubetalk_conversations_offplatform_idx
  ON public.qubetalk_conversations (offplatform_relationship_id);

COMMENT ON COLUMN public.qubetalk_conversations.offplatform_relationship_id IS
  'Set only for a conversation anchored on a qubetalk_offplatform_relationships row (a ContactGraph contact with no linked platform persona). No CHECK constraint here — the table already allows relationship_channel_id and group_id to both be null for broadcast/fan_in/public_thread/federated topologies; discipline that a conversation never sets BOTH relationship_channel_id and offplatform_relationship_id is enforced at the service layer and asserted in tests/qubetalk-offplatform-relationships.test.ts.';
