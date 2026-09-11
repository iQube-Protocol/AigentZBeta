-- Invariant composition & publication — Chrysalis Foundation Phase 2.
-- CFS-001 (Level 2 collections + Level 3 InvariantQube), CFS-004 §3 (staged
-- publication into the registry), CFS-005 (registry as ledger of expertise).
-- Spec: codexes/packs/agentiq/foundation/
--
-- Additive only. Depends on 20260703200000_invariant_substrate.sql (Level 1).
-- InvariantQubes register into the existing iqube_id_map as
-- primitive_type='DataQube', source='triad_meta', metadata.kind='invariant_bundle'
-- (the VentureQube precedent) — no change to the id-map constraints.

-- ────────────────────────────────────────────────────────────────────────
-- 1. Invariant Collections (CFS-001 §1, Level 2) — a coherent, named set of
--    related invariants. Still graph-native; may span namespaces.
--    curator_persona_id is T0 (server-internal only).
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invariant_collections (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text NOT NULL UNIQUE,
  name                      text NOT NULL,
  namespace                 text
    CHECK (namespace IS NULL OR namespace IN
      ('constitutional','reasoning','engineering','experience','capability')),
  description               text,
  status                    text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  curator_persona_id        uuid,          -- T0 — server-internal only
  curator_alias_commitment  text,          -- T2 — safe for receipts/chain
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invariant_collection_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  uuid NOT NULL REFERENCES public.invariant_collections(id) ON DELETE CASCADE,
  invariant_id   uuid NOT NULL REFERENCES public.invariants(id) ON DELETE CASCADE,
  position       int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, invariant_id)
);

CREATE INDEX IF NOT EXISTS idx_invariant_collection_members_collection
  ON public.invariant_collection_members(collection_id);
CREATE INDEX IF NOT EXISTS idx_invariant_collection_members_invariant
  ON public.invariant_collection_members(invariant_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2. InvariantQubes (CFS-001 §1 Level 3, CFS-004 §3) — a published,
--    versioned, provenance-bearing package of compressed expertise. This is
--    what becomes mintable. Mirrors venture_qubes: the manifest lives here
--    under service-role RLS; the public registry entry is a DataQube in
--    iqube_id_map. iqube_id backlinks the canonical registry UUID.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invariant_qubes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iqube_id                  uuid,          -- backlink to iqube_id_map.iqube_id (set on register)
  collection_id             uuid REFERENCES public.invariant_collections(id),
  public_ref                text NOT NULL, -- T2-safe commitment over id
  title                     text NOT NULL,
  version                   int NOT NULL DEFAULT 1,
  manifest                  jsonb NOT NULL DEFAULT '{}'::jsonb,  -- members[], internal_edges[], contexts[]
  aggregate_confidence      numeric(4,3) NOT NULL DEFAULT 0
    CHECK (aggregate_confidence >= 0 AND aggregate_confidence <= 1),
  aggregate_standing        numeric(5,1) NOT NULL DEFAULT 0
    CHECK (aggregate_standing >= 0 AND aggregate_standing <= 100),
  member_count              int NOT NULL DEFAULT 0,
  status                    text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','superseded')),
  supersedes_id             uuid REFERENCES public.invariant_qubes(id),
  creator_persona_id        uuid,          -- T0 — server-internal only
  creator_alias_commitment  text,          -- T2 — safe for receipts/chain
  dvn_receipt_id            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invariant_qubes_iqube ON public.invariant_qubes(iqube_id);
CREATE INDEX IF NOT EXISTS idx_invariant_qubes_collection ON public.invariant_qubes(collection_id);
CREATE INDEX IF NOT EXISTS idx_invariant_qubes_status ON public.invariant_qubes(status);

-- ────────────────────────────────────────────────────────────────────────
-- 3. RLS — service-role only (registry canonical plane pattern).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invariant_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariant_collection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariant_qubes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invariant_collections_read_service"
  ON public.invariant_collections FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariant_collections_write_service"
  ON public.invariant_collections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invariant_collection_members_read_service"
  ON public.invariant_collection_members FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariant_collection_members_write_service"
  ON public.invariant_collection_members FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invariant_qubes_read_service"
  ON public.invariant_qubes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariant_qubes_write_service"
  ON public.invariant_qubes FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER invariant_collections_updated_at
  BEFORE UPDATE ON public.invariant_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER invariant_qubes_updated_at
  BEFORE UPDATE ON public.invariant_qubes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────────────
-- 4. Receipt action type — invariant_qube_published (DVN-anchorable:
--    publication of compressed expertise into constitutional memory).
--    Recreate the CHECK with the complete union (as of migration
--    20260703200000) plus the new type.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated',
    'agent_delegation_revoked',
    'operator_action_logged',
    'standing_document_added',
    'plan_purchased',
    'plan_renewed',
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded',
    -- Chrysalis Foundation Phase 2 (CFS-004 §3)
    'invariant_qube_published'
  ));
