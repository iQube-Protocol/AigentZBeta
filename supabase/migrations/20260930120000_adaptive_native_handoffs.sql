-- 20260930120000_adaptive_native_handoffs.sql
--
-- AEE native-action handoff store — provider-neutral (operator ruling,
-- 2026-08-27, Differ FS pilot reconciliation: "rename the migration...
-- provider-neutral AEE vocabulary"). Renamed from
-- financial_service_native_handoffs; same discipline, generalized columns
-- (integration_id/application_id/projection_id/capability_id replace the
-- FS-specific action_ref/capability_ref/projection_ref).
--
-- An externally presented `ExperienceProjection` (Differ or any future
-- provider) never executes a capability itself — it requests a handoff,
-- metaMe redeems it exactly once, and the user completes the act natively.
-- This table is what makes "single-use" real (persisted, atomically
-- consumed) rather than a stateless claim.
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
-- (app/api/adaptive/*/handoffs/*, app/handoff/*).
--
-- NOT YET APPLIED. Per the operator's deployment rule: this migration must
-- reach the database BEFORE any route that queries this table reaches dev —
-- additive migration first, verify the table/policies live, THEN merge the
-- code that uses it. Do not apply this speculatively.

CREATE TABLE IF NOT EXISTS public.adaptive_native_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id_hash text NOT NULL UNIQUE,        -- sha256 of the opaque handoffId (never stored raw)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'invalidated')),
  -- Which registered integration issued this (services/adaptive/
  -- externalIntegrationRegistry.ts) — e.g. 'differ-fs-pilot'. Never trusted
  -- alone; the integration's own enabled/allowlist state is re-checked live
  -- at issuance, not read back from this column at redemption.
  integration_id text NOT NULL,
  -- Which ApplicationProjectionManifest.applicationId this handoff's
  -- projection was built from (e.g. 'financial-services-journey-spine').
  application_id text NOT NULL,
  -- Audit-only echo of the ExperienceProjection.projectionId that prompted
  -- this request. NEVER independently authoritative — eligibility is
  -- re-derived fresh (server-side) at both issuance and redemption; this
  -- column is not consulted by any redemption check.
  projection_id text,
  -- T2-safe commitment of the issuing principal (personaPublicRef(personaId))
  -- — re-derived from the CURRENT signed-in persona at redemption time and
  -- compared; never the raw personaId.
  principal_public_ref text NOT NULL,
  journey_id text,
  stage_id text,                                -- informational only (journey.currentStageId at issuance; nullable)
  capability_id text NOT NULL,
  native_surface_ref text NOT NULL,
  return_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS adaptive_native_handoffs_hash_idx
  ON public.adaptive_native_handoffs (handoff_id_hash);
CREATE INDEX IF NOT EXISTS adaptive_native_handoffs_principal_idx
  ON public.adaptive_native_handoffs (principal_public_ref);

ALTER TABLE public.adaptive_native_handoffs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.adaptive_native_handoffs IS
  'AEE native-action handoffs (provider-neutral): single-use, short-lived, principal/projection/capability-bound. sha256(handoffId) only, T2 principal ref only; deny-all RLS; service-role handoff routes only.';
