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
-- P0.5 WIDENING (2026-08-26, operator code review — this migration edited in
-- place, never applied live, no rows to preserve in the new table): the
-- first pass above shipped the anchor but left several structural gaps.
-- Closed in this same file (never layered as a second migration, per the
-- operator's explicit instruction that a clean single migration beats a
-- patch-on-patch history while nothing has gone live yet):
--   0. contact_persons gets an additive owner-scoped unique index so
--      qubetalk_offplatform_relationships.contact_person_id can be bound by
--      a COMPOSITE FK to (owner_auth_profile_id, id) — DB-level proof of
--      ownership, not just an application-level check.
--   1. qubetalk_offplatform_relationships.promoted_to_channel_id gets an
--      owner-scoped (never global) partial unique index.
--   4. passport_peer_messages — the MessageQube anchor gap — gets the SAME
--      channel_id XOR offplatform_relationship_id treatment as
--      qubetalk_relationship_state below.
--
-- All statements additive/idempotent (CREATE TABLE IF NOT EXISTS, ADD
-- COLUMN IF NOT EXISTS) per this repo's migration-safety convention.

-- ═══════════════════════════════════════════════════════════════════════
-- 0. contact_persons — additive owner-scoped unique index (P0.5 widening,
--    2026-08-26), the unique constraint a composite FK needs to reference.
--    Does NOT touch contact_persons' existing single-column PK — a table
--    may carry any number of unique constraints alongside its PK, and
--    Postgres composite FKs need a unique/PK constraint covering EXACTLY
--    the referenced columns (owner_auth_profile_id, id). Purely additive,
--    zero data risk: contact_persons.id is already globally unique (it is
--    the PK), so (owner_auth_profile_id, id) is trivially unique too — this
--    index can never fail to build regardless of existing rows.
-- ═══════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS contact_persons_owner_id_uidx
  ON public.contact_persons (owner_auth_profile_id, id);

-- ═══════════════════════════════════════════════════════════════════════
-- 1. qubetalk_offplatform_relationships — the sibling anchor.
--
--    Owner integrity (P0.5 widening): contact_person_id is bound by a
--    COMPOSITE FK to (owner_auth_profile_id, id) on contact_persons, not a
--    plain single-column FK to contact_persons.id. A plain FK only proves
--    the contact_person_id ROW EXISTS somewhere — it does NOT prove the
--    contact belongs to owner_auth_profile_id. Under this table's deny-all,
--    service-role-only RLS (enforced entirely at the application layer), a
--    caller with a bug or a forged owner_auth_profile_id could otherwise
--    insert a row claiming ownership of someone ELSE's ContactGraph
--    contact. The composite FK makes that structurally impossible: Postgres
--    itself refuses an insert/update where (owner_auth_profile_id,
--    contact_person_id) is not a real row in contact_persons — DB-level
--    proof, not just an application-level check.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.qubetalk_offplatform_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- T0 — matches contact_persons.owner_auth_profile_id's own scoping
  -- exactly (a ContactPerson is auth-profile-scoped, not persona-scoped;
  -- this anchor must be scoped the same way its counterparty is).
  owner_auth_profile_id uuid NOT NULL,
  contact_person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  -- Set once this off-platform relationship is later linked to a real
  -- passport_peer_channels row (the ContactPerson gained a linked
  -- persona and the two sides opened a real peer channel). Existing
  -- qubetalk_relationship_state / qubetalk_conversations rows keep
  -- pointing at THIS anchor id unchanged — promotion never rewrites
  -- conversation/message history, it only records that a richer,
  -- personhood-bound anchor now also exists for the same relationship.
  promoted_to_channel_id uuid REFERENCES public.passport_peer_channels (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qubetalk_offplatform_relationships_owner_contact_fkey
    FOREIGN KEY (owner_auth_profile_id, contact_person_id)
    REFERENCES public.contact_persons (owner_auth_profile_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_offplatform_relationships_owner_contact_uidx
  ON public.qubetalk_offplatform_relationships (owner_auth_profile_id, contact_person_id);
CREATE INDEX IF NOT EXISTS qubetalk_offplatform_relationships_owner_idx
  ON public.qubetalk_offplatform_relationships (owner_auth_profile_id);
-- Promotion uniqueness (P0.5 widening) — a passport_peer_channels row is
-- SHARED between two principals, but each participant's own ContactGraph
-- relationship to it is owner-scoped, so uniqueness on promoted_to_channel_id
-- must be scoped per owner (never a bare global unique index on the column
-- alone — that would wrongly forbid BOTH sides of a real channel each
-- promoting their own off-platform relationship onto it). Partial: only
-- constrains rows that have actually been promoted.
CREATE UNIQUE INDEX IF NOT EXISTS qubetalk_offplatform_relationships_owner_promoted_uidx
  ON public.qubetalk_offplatform_relationships (owner_auth_profile_id, promoted_to_channel_id)
  WHERE promoted_to_channel_id IS NOT NULL;

ALTER TABLE public.qubetalk_offplatform_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_qubetalk_offplatform_relationships" ON public.qubetalk_offplatform_relationships;
CREATE POLICY "service_role_qubetalk_offplatform_relationships"
  ON public.qubetalk_offplatform_relationships FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.qubetalk_offplatform_relationships IS
  'QubeTalk sibling relationship anchor for a ContactGraph ContactPerson with NO linked platform persona (linked_personhood_ref IS NULL). NEVER a substitute for passport_peer_channels once a real persona link exists — see promoted_to_channel_id. Deny-all RLS, service-role-only.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. qubetalk_relationship_state — widen to accept EITHER anchor kind.
-- ═══════════════════════════════════════════════════════════════════════

-- Ordering hazard fixed (operator code review, 2026-08-26): a PRIMARY KEY
-- constraint enforces an implicit NOT NULL on its column at the catalog
-- level, and Postgres refuses `ALTER COLUMN ... DROP NOT NULL` on a column
-- that is STILL part of a PRIMARY KEY ("column is in a primary key"). At
-- this point in the migration channel_id IS still the PK (it is only
-- dropped further down), so `DROP NOT NULL` on it must never run before
-- that drop. The statements below are therefore split into the strict
-- dependency order real Postgres requires — add id (nullable) → backfill →
-- constrain id NOT NULL → DROP the OLD PK (channel_id) → ONLY THEN drop
-- channel_id's NOT NULL (now legal, nothing references it as a key
-- anymore) → ADD the NEW PK (id) — never the single combined ALTER TABLE
-- statement the first pass used, which interleaved the DROP NOT NULL with
-- the OLD PK still in place.

ALTER TABLE public.qubetalk_relationship_state
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS offplatform_relationship_id uuid REFERENCES public.qubetalk_offplatform_relationships (id) ON DELETE CASCADE;

-- Backfill `id` for every existing row (channel_id was already unique via
-- being the PK, so this is a pure 1:1 assignment, no collision risk).
UPDATE public.qubetalk_relationship_state SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.qubetalk_relationship_state ALTER COLUMN id SET NOT NULL;

-- Drop the old channel_id-as-PK FIRST — channel_id's implicit NOT NULL (from
-- being the PK) is still in force until this line runs.
ALTER TABLE public.qubetalk_relationship_state DROP CONSTRAINT IF EXISTS qubetalk_relationship_state_pkey;

-- ONLY NOW is channel_id no longer key-constrained, so this is legal.
ALTER TABLE public.qubetalk_relationship_state ALTER COLUMN channel_id DROP NOT NULL;

-- Add the NEW PK (id). Wrapped in a DO block per this repo's established
-- idempotent-DDL idiom (see 20260419000001_launch_ops_schema.sql's
-- `duplicate_object`-guarded blocks) so a re-run after the constraint
-- already exists is a no-op rather than an error — Postgres has no "ADD
-- PRIMARY KEY IF NOT EXISTS" form.
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

-- ═══════════════════════════════════════════════════════════════════════
-- 4. passport_peer_messages — the MessageQube anchor gap, closed the SAME
--    additive way 20260930040000 extended this table with
--    conversation_id/transport/etc: channel_id becomes nullable, a new
--    offplatform_relationship_id nullable FK is added, and an XOR CHECK
--    keeps the invariant honest (exactly one of the two anchors set — the
--    same discipline qubetalk_relationship_state_exactly_one_anchor
--    enforces above). Zero backfill risk: every EXISTING row already has
--    channel_id set (it was NOT NULL until this migration), so
--    num_nonnulls(channel_id, offplatform_relationship_id) = 1 holds for
--    every row that exists today the instant this constraint is added.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.passport_peer_messages
  ADD COLUMN IF NOT EXISTS offplatform_relationship_id uuid REFERENCES public.qubetalk_offplatform_relationships (id) ON DELETE CASCADE,
  ALTER COLUMN channel_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.passport_peer_messages
    ADD CONSTRAINT passport_peer_messages_exactly_one_anchor
    CHECK (num_nonnulls(channel_id, offplatform_relationship_id) = 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS passport_peer_messages_offplatform_idx
  ON public.passport_peer_messages (offplatform_relationship_id, created_at DESC)
  WHERE offplatform_relationship_id IS NOT NULL;

COMMENT ON COLUMN public.passport_peer_messages.offplatform_relationship_id IS
  'The OTHER valid message anchor — a qubetalk_offplatform_relationships row, for a message sent to/from a ContactGraph contact with no linked platform persona. Exactly one of channel_id/offplatform_relationship_id is set per row (passport_peer_messages_exactly_one_anchor). Written by services/qubetalk/offplatformRelationships.ts postOffplatformMessage — never services/qubetalk/peerChannel.ts postMessage, which remains channel_id-only.';
