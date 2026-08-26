-- 20260930120000_financial_services_native_handoffs.sql
--
-- Differ × Financial Services Bridge pilot, part 4: the single-use,
-- short-lived native-action handoff store. Differ (an EXTERNAL, non-
-- authority-bearing presentation layer) never executes a MoneyPenny act
-- itself — it requests a handoff, metaMe redeems it exactly once, and the
-- user completes the act natively. This table is what makes "single-use"
-- real (persisted, atomically consumed) rather than a stateless claim.
--
-- Modeled directly on the `agent_gateway_sessions` handshake discipline
-- (supabase/migrations/20260806000000_agent_gateway_sessions.sql):
--   - the presented token is NEVER stored raw, only its sha256 hash
--   - consumption is an atomic UPDATE guarded by `.eq('status', 'pending')`,
--     the same idempotency-guard shape `issueHumanAuthorizationCode` uses
--   - the principal is referenced by its T2 Polity Public Reference
--     (`personaPublicRef`, services/identity/personaReferences.ts) — no T0
--     persona id is ever stored on this row (CLAUDE.md Identity & Access
--     Spine — T0 identifiers stay server-internal / never network-bound).
--
-- Deny-all RLS: reachable only via the service-role handoff routes
-- (app/api/financial-services/handoffs/*, app/handoff/financial-services/*).

CREATE TABLE IF NOT EXISTS public.financial_service_native_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id_hash text NOT NULL UNIQUE,        -- sha256 of the opaque handoffId (never stored raw)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'invalidated')),
  -- T2-safe commitment of the issuing principal (personaPublicRef(personaId))
  -- — re-derived from the CURRENT signed-in persona at redemption time and
  -- compared; never the raw personaId.
  principal_public_ref text NOT NULL,
  journey_id text NOT NULL,
  stage_id text,                                -- informational only (journey.currentStageId at issuance; nullable)
  action_ref text NOT NULL,
  capability_ref text NOT NULL,
  native_surface_ref text NOT NULL,
  -- Audit-only echo of the client-supplied projectionId that prompted this
  -- request. NEVER independently authoritative — eligibility is re-derived
  -- fresh (server-side) at both issuance and redemption; this column is not
  -- consulted by any redemption check.
  projection_ref text,
  return_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS financial_service_native_handoffs_hash_idx
  ON public.financial_service_native_handoffs (handoff_id_hash);
CREATE INDEX IF NOT EXISTS financial_service_native_handoffs_principal_idx
  ON public.financial_service_native_handoffs (principal_public_ref);

ALTER TABLE public.financial_service_native_handoffs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.financial_service_native_handoffs IS
  'Differ x Financial Services Bridge pilot: single-use, short-lived native-action handoffs. sha256(handoffId) only, T2 principal ref only; deny-all RLS; service-role handoff routes only.';
