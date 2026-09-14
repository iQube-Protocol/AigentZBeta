-- 20261001001100_vela_underwriting_party_bindings.sql
--
-- Vela underwriting party binding — Use Case Zero build-order item 10b, the
-- direct sequel to item 10a
-- (services/vela/velaUnderwritingChainProjection.ts, merged 2026-09-13 as
-- dev@26a3cb321).
--
-- THE GAP THIS CLOSES: today there is no binding anywhere in this codebase
-- between a `party` label used inside a VelaMultiPartyDisclosureScope grant
-- (services/vela/velaMultiPartyProjection.ts — `grants[].party`/`.to` are
-- free strings) and any real, authenticated persona. A party's "view" of a
-- Constitutional Risk Flow could not be authorized non-spoofably. Operator
-- ruling this item implements (verbatim, 2026-09-14): "Party identity in a
-- transaction is not a client-supplied label. It is a recorded
-- constitutional binding between the transaction namespace and the
-- authenticated principal/persona that contributed or was authorized to
-- control that namespace."
--
-- WHY THIS IS NOT `activity_receipts`, NEVER DVN-ANCHORED, NEVER RECEIPTED:
-- per CLAUDE.md's HMS Identifier Isolation / Identity & Access Spine T0
-- rule, a real personaId must NEVER appear in a DVN-anchorable/chain-bound
-- record. This table is server-internal access-control metadata — exactly
-- the escape valve `factor_case_events.actor_persona_id` already establishes
-- in this codebase for storing a real personaId in a NON-chain-bound
-- internal table (see 20260930190000_factor_aegis_constitution_reconciled.sql,
-- `factor_cases`/`factor_case_events`): service-role-only RLS (mirrors
-- `factor_cases_service_only` verbatim), app-mediated, never client-exposed,
-- never anchored. Never call createActivityReceipt for these rows; never add
-- a new ActivityActionType for this table; never touch
-- services/dvn/activityReceiptDvnPipeline.ts.
--
-- UNIQUENESS, DELIBERATELY NARROW: UNIQUE is on (request_ref, party_label)
-- ONLY — never on (request_ref, authority_persona_id). The same persona MAY
-- legitimately hold more than one party role in the same transaction, each
-- as its own separate row (tested: tests/vela-underwriting-party-binding.test.ts).
--
-- `flow_owner_persona_id` — mechanical addition beyond the operator's own
-- field list: the persona whose OWN activity_receipts rows actually carry
-- this requestRef's chain evidence (the persona actorPersonaId/personaId was
-- set to on every factor_selection_proposed / admission / disclosure /
-- freeze receipt for this request). A viewing party's own personaId is NOT
-- the persona whose receipts must be read — without this column there is no
-- way to resolve which persona's activity_receipts to query for a party who
-- isn't the flow's own recording persona.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vela_underwriting_party_bindings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ref             TEXT NOT NULL,
  application_id          TEXT NOT NULL,
  party_label             TEXT NOT NULL,
  party_namespace_ref     TEXT NOT NULL,
  authority_principal_id  TEXT NOT NULL,
  authority_persona_id    UUID NOT NULL,
  -- See this file's header — the persona whose activity_receipts rows carry
  -- this requestRef's chain evidence, resolved BY THE SERVER at binding time,
  -- never client-supplied.
  flow_owner_persona_id   UUID NOT NULL,
  binding_type            TEXT NOT NULL DEFAULT 'CONTRIBUTOR' CHECK (binding_type IN ('CONTRIBUTOR')),
  binding_evidence_ref    TEXT,
  bound_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_ref, party_label)
);

CREATE INDEX IF NOT EXISTS idx_vela_underwriting_party_bindings_request
  ON public.vela_underwriting_party_bindings (request_ref);

COMMENT ON TABLE public.vela_underwriting_party_bindings IS
  'Vela underwriting party binding (Use Case Zero build-order item 10b) — a recorded constitutional binding between a VelaMultiPartyDisclosureScope party_label and the authenticated persona that contributed/controls that namespace, for one requestRef. Server-internal access-control metadata: never DVN-anchored, never an activity_receipts row, never client-exposed. UNIQUE(request_ref, party_label) only — the same persona may legitimately hold more than one party role on the same request, each as its own row.';
COMMENT ON COLUMN public.vela_underwriting_party_bindings.flow_owner_persona_id IS
  'The persona whose OWN activity_receipts rows carry this requestRef''s chain evidence — the persona a viewing party''s Constitutional Risk Flow read is actually resolved against, distinct from authority_persona_id (the viewing party''s own persona).';

ALTER TABLE public.vela_underwriting_party_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vela_underwriting_party_bindings_service_only ON public.vela_underwriting_party_bindings;
CREATE POLICY vela_underwriting_party_bindings_service_only ON public.vela_underwriting_party_bindings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
