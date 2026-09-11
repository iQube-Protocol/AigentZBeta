-- 20260930060000_qubetalk_contact_endpoint_exact_bridge.sql
--
-- ContactGraph <-> QubeTalk bridge — exact-endpoint refinement (previously
-- approved follow-on to 20260930050000's refinement 1). The original bridge
-- links a qubetalk_participant_endpoint to the ContactGraph CONTAINER it
-- resolved into (contact_persona_id -> contact_personas.id) — coarse-grained,
-- correct for "which context/persona is this observed handle under" but not
-- precise enough to say WHICH of that persona's endpoints it actually is.
--
-- This migration adds the exact-endpoint FK alongside it:
--   qubetalk_participant_endpoints.contact_endpoint_id -> contact_endpoints.id
--
-- Both columns are kept (per the operator's explicit "keep the existing
-- contact_persona_id if useful"): contact_persona_id still answers "which
-- persona/context" cheaply without a join even before a specific endpoint is
-- resolved (e.g. an observed-but-not-yet-endpoint-matched participant
-- endpoint); contact_endpoint_id is set once resolution narrows to the exact
-- ContactGraph endpoint row, giving:
--   - precise cross-reference from a QubeTalk-observed endpoint to the exact
--     CommunicationEndpoint it corresponds to (not just its container),
--   - the ability to update contact_endpoints.last_observed_at /
--     link_history directly from a resolved QubeTalk observation without a
--     platform+identifier re-lookup,
--   - no loss of the coarser contact_persona_id signal for callers that only
--     need context-level resolution.
--
-- Additive/idempotent (ADD COLUMN IF NOT EXISTS), matching this repo's
-- migration-safety convention. No destructive change to any existing table
-- or column; qubetalk_participant_endpoints.contact_persona_id is untouched.

ALTER TABLE public.qubetalk_participant_endpoints
  ADD COLUMN IF NOT EXISTS contact_endpoint_id uuid REFERENCES public.contact_endpoints (id);

CREATE INDEX IF NOT EXISTS qubetalk_participant_endpoints_contact_endpoint_idx
  ON public.qubetalk_participant_endpoints (contact_endpoint_id) WHERE contact_endpoint_id IS NOT NULL;

COMMENT ON COLUMN public.qubetalk_participant_endpoints.contact_endpoint_id IS
  'Exact ContactGraph CommunicationEndpoint this observed QubeTalk endpoint resolves to (refinement follow-on to 20260930050000''s coarser contact_persona_id bridge). Nullable — set only once resolution narrows past the persona/context level.';
