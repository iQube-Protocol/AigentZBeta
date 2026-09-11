-- 20260810000000_nakamoto_runtime_endpoint.sql
--
-- Agent Runtime Endpoint (operator ruling, 2026-08-04): populates
-- registry_assets.metadata.runtime for Aigent Nakamoto's canonical AigentQube
-- (aigentqube-nakamoto) so services/registry/runtimeDescriptor.ts's
-- getAssetRuntimeDescriptor has something real to project (via
-- app/api/agents/nakamoto/agent-card.json/route.ts's resolveRuntime) and
-- services/horizen/pulseEndpoint.ts's resolvePulseEndpoint has a real health
-- URL to resolve for Horizen Pulse — instead of both honestly returning null,
-- which is the current state for every agent in this repo.
--
-- Endpoint/health point at THIS session's own new routes:
--   app/api/agents/nakamoto/invoke/route.ts  (governed; delegates to the
--     existing ask-agent/specialistRouter execution path — not a second
--     implementation of "ask Nakamoto")
--   app/api/agents/nakamoto/health/route.ts  (public, deterministic,
--     non-sensitive — the only URL Pulse itself calls)
--
-- Host is dev-beta.aigentz.me — the confirmed, already-documented dev
-- deployment host this repo references throughout (utils/publicOrigin.ts's
-- THRESHOLD_TRUSTED_HOSTS example, tests/*, docs) — never invented per
-- CLAUDE.md's No-Guessing rule. Update this migration (or call
-- setAssetRuntimeDescriptor directly) if the canonical public host changes.
--
-- `metadata || jsonb_build_object('runtime', ...)` is a shallow top-level
-- merge — it adds/overwrites ONLY the 'runtime' key and leaves every other
-- key already on this row (agentiq_native, external_registry_bindings,
-- policyBindings, etc.) untouched, mirroring setAssetRuntimeDescriptor's own
-- read-then-merge-then-write discipline at the SQL level.

UPDATE registry_assets
SET metadata = metadata || jsonb_build_object(
  'runtime', jsonb_build_object(
    'endpoint', 'https://dev-beta.aigentz.me/api/agents/nakamoto/invoke',
    'health', 'https://dev-beta.aigentz.me/api/agents/nakamoto/health',
    'protocol', 'https',
    'version', '1'
  )
),
updated_at = now()
WHERE asset_id = 'aigentqube-nakamoto';
