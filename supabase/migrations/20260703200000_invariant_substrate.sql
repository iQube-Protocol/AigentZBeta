-- Invariant Intelligence substrate — Chrysalis Foundation Phase 1.
-- CFS-001 (invariant primitive + contexts), CFS-002 (ontology classes),
-- CFS-003 (invariant graph edges).
-- Spec: codexes/packs/agentiq/foundation/
-- Constitutional anchor: codexes/packs/polity-core/constitutional-records/invariant-intelligence.md
--
-- Additive only (CFS-010 Stage 2): no existing table is altered except the
-- activity_receipts action_type CHECK, which is recreated with the complete
-- TypeScript union (see note at the bottom).

-- ────────────────────────────────────────────────────────────────────────
-- 1. Ontology classes (CFS-002) — self-referential hierarchy per namespace.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ontology_classes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace       text NOT NULL
    CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability')),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  parent_id       uuid REFERENCES public.ontology_classes(id),
  semantic_type   text
    CHECK (semantic_type IN ('principle','constraint','definition','heuristic','law')),
  description     text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ontology_classes_namespace ON public.ontology_classes(namespace);
CREATE INDEX IF NOT EXISTS idx_ontology_classes_parent ON public.ontology_classes(parent_id);

-- ────────────────────────────────────────────────────────────────────────
-- 2. Invariants (CFS-001, Level 1) — atomic rows, graph-native.
--    creator_persona_id is T0: server-internal only, NEVER serialised to
--    browser-bound JSON or chain-bound payloads. The T2 surface is
--    creator_alias_commitment.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invariants (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id                   text UNIQUE,   -- idempotent ingest key (inv.<namespace>.<nnn>)
  statement                 text NOT NULL,
  namespace                 text NOT NULL
    CHECK (namespace IN ('constitutional','reasoning','engineering','experience','capability')),
  ontology_class_id         uuid REFERENCES public.ontology_classes(id),
  semantic_type             text
    CHECK (semantic_type IN ('principle','constraint','definition','heuristic','law')),
  status                    text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','proposed','validated','canonical','rejected','deprecated','superseded')),
  confidence                numeric(4,3) NOT NULL DEFAULT 0.300
    CHECK (confidence >= 0 AND confidence <= 1),
  confidence_basis          text NOT NULL DEFAULT 'unknown'
    CHECK (confidence_basis IN ('document_verified','principal_verified','agent_verified','unknown')),
  standing_ref              jsonb,
  -- Invariant Standing (CFS-001 §6): the invariant itself accrues Standing —
  -- constitutional capital from reuse, validation, and foundational weight.
  -- Not merely confidence. High-standing invariants migrate toward the
  -- constitutional core; low-standing invariants remain experimental.
  -- standing is recomputed by services/invariants/evolution.ts from the
  -- accumulators below; the accumulators are the ledger, standing the view.
  standing                  numeric(5,1) NOT NULL DEFAULT 0 CHECK (standing >= 0 AND standing <= 100),
  times_validated           int NOT NULL DEFAULT 0,
  times_contradicted        int NOT NULL DEFAULT 0,
  times_referenced          int NOT NULL DEFAULT 0,  -- inbound graph edges
  times_used                int NOT NULL DEFAULT 0,  -- runtime citations (grounding, forecasts)
  version                   int NOT NULL DEFAULT 1,
  supersedes_id             uuid REFERENCES public.invariants(id),
  ratified_source           text,          -- set when drawn verbatim from a ratified Polity document
  provenance                jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning_provenance      jsonb NOT NULL DEFAULT '{}'::jsonb,
  creator_persona_id        uuid,          -- T0 — server-internal only
  creator_alias_commitment  text,          -- T2 — safe for receipts/chain
  dvn_receipt_id            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invariants_namespace_status ON public.invariants(namespace, status);
CREATE INDEX IF NOT EXISTS idx_invariants_ontology_class ON public.invariants(ontology_class_id);
CREATE INDEX IF NOT EXISTS idx_invariants_supersedes ON public.invariants(supersedes_id);

-- ────────────────────────────────────────────────────────────────────────
-- 3. Invariant contexts (CFS-001 §3) — the fourth foundational object.
--    The invariant doesn't change; its context does. Primary retrieval
--    surface.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invariant_contexts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invariant_id              uuid NOT NULL REFERENCES public.invariants(id) ON DELETE CASCADE,
  domain                    text NOT NULL,
  interpretation            text,
  applicability_conditions  jsonb,
  retrieval_tags            text[] NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invariant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_invariant_contexts_domain ON public.invariant_contexts(domain);
CREATE INDEX IF NOT EXISTS idx_invariant_contexts_tags ON public.invariant_contexts USING gin(retrieval_tags);

-- ────────────────────────────────────────────────────────────────────────
-- 4. Invariant edges (CFS-003) — typed, weighted, directional,
--    provenance-bearing. Context-scoped edges hold only in that domain.
--    Cycle prevention for depends_on / derives_from / supersedes is
--    enforced by the Invariant Service (services/invariants/graph.ts),
--    not by the database.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invariant_edges (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_invariant_id     uuid NOT NULL REFERENCES public.invariants(id) ON DELETE CASCADE,
  to_invariant_id       uuid NOT NULL REFERENCES public.invariants(id) ON DELETE CASCADE,
  edge_type             text NOT NULL
    CHECK (edge_type IN ('derives_from','enables','constrains','contradicts','supersedes',
                         'generalizes','specializes','depends_on','supports','validates',
                         'explains','composes')),
  weight                numeric(4,3) NOT NULL DEFAULT 1.000 CHECK (weight >= 0 AND weight <= 1),
  context_id            uuid REFERENCES public.invariant_contexts(id) ON DELETE SET NULL,
  rationale             text,
  provenance            jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning_provenance  jsonb NOT NULL DEFAULT '{}'::jsonb,
  dvn_receipt_id        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (from_invariant_id <> to_invariant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invariant_edges_unique_global
  ON public.invariant_edges(from_invariant_id, to_invariant_id, edge_type)
  WHERE context_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invariant_edges_unique_ctx
  ON public.invariant_edges(from_invariant_id, to_invariant_id, edge_type, context_id)
  WHERE context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invariant_edges_from ON public.invariant_edges(from_invariant_id);
CREATE INDEX IF NOT EXISTS idx_invariant_edges_to ON public.invariant_edges(to_invariant_id);
CREATE INDEX IF NOT EXISTS idx_invariant_edges_type ON public.invariant_edges(edge_type);

-- ────────────────────────────────────────────────────────────────────────
-- 5. RLS — service-role only, matching the registry canonical plane.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ontology_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariant_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invariant_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ontology_classes_read_service"
  ON public.ontology_classes FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "ontology_classes_write_service"
  ON public.ontology_classes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invariants_read_service"
  ON public.invariants FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariants_write_service"
  ON public.invariants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invariant_contexts_read_service"
  ON public.invariant_contexts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariant_contexts_write_service"
  ON public.invariant_contexts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invariant_edges_read_service"
  ON public.invariant_edges FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "invariant_edges_write_service"
  ON public.invariant_edges FOR ALL USING (auth.role() = 'service_role');

-- update_updated_at_column() is the shared touch-trigger created by an
-- earlier registry migration.
CREATE TRIGGER ontology_classes_updated_at
  BEFORE UPDATE ON public.ontology_classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER invariants_updated_at
  BEFORE UPDATE ON public.invariants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────────────
-- 6. Receipt action types — add the invariant lifecycle receipts.
--
-- NOTE: this recreation also restores four action types that are present
-- in the TypeScript union (services/receipts/activityReceiptService.ts)
-- but were dropped from the CHECK by 20260624200000 (which rebuilt the
-- list without operator_action_logged, standing_document_added,
-- plan_purchased, plan_renewed — inserts of those types have been failing
-- the constraint since). This list is the complete union as of this
-- migration.
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
    -- Invariant lifecycle (Chrysalis Foundation Phase 1; CFS-001 §7)
    'invariant_discovered',
    'invariant_validated',
    'invariant_canonized',
    'invariant_superseded'
  ));
