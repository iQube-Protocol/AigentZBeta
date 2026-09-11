-- 20260905040000_factor_runtime_endpoint.sql
--
-- Agent Runtime Endpoint (operator ruling, 2026-08-04; closed for Factor per
-- operator directive 2026-09-05, "next Factor step is narrow"): populates
-- registry_assets.metadata.runtime for Factor's canonical AigentQube
-- (aigentqube-factor) so services/registry/runtimeDescriptor.ts's
-- getAssetRuntimeDescriptor has something real to project (via
-- app/api/agents/factor/agent-card.json/route.ts's resolveRuntime, already
-- wired) and the Horizen preflight's "Runtime endpoint descriptor" check
-- (services/horizen/agentPreflight.ts) moves from BLOCKED to
-- ALREADY_COMPLETE — mirroring 20260810000000_nakamoto_runtime_endpoint.sql
-- and 20260930002300_moneypenny_runtime_endpoint.sql exactly.
--
-- `endpoint` points at Factor's OWN real, live invoke surface —
-- app/api/agents/factor/invoke/route.ts, added alongside this migration,
-- which delegates to the existing ask-agent/specialistRouter execution path
-- (specialistId: 'factor', already registered in services/agents/
-- specialistRouter.ts) — never a second implementation of "ask Factor".
-- `health` points at the already-live app/api/agents/factor/health/route.ts.
--
-- Host is dev-beta.aigentz.me — the same confirmed, already-documented dev
-- deployment host every other runtime-endpoint migration in this repo uses.
--
-- Aegis is deliberately NOT seeded here or anywhere in registry_assets —
-- it is not a Horizen pilot-journey participant (operator ruling,
-- 2026-09-05); its own invoke route (app/api/agents/aegis/invoke/route.ts)
-- exists purely for specialist consultation, outside this descriptor.
--
-- `metadata || jsonb_build_object('runtime', ...)` is a shallow top-level
-- merge — adds/overwrites ONLY the 'runtime' key, leaving every other key
-- already on this row (external_registry_bindings, etc.) untouched.

UPDATE registry_assets
SET metadata = metadata || jsonb_build_object(
  'runtime', jsonb_build_object(
    'endpoint', 'https://dev-beta.aigentz.me/api/agents/factor/invoke',
    'health', 'https://dev-beta.aigentz.me/api/agents/factor/health',
    'protocol', 'https',
    'version', '1'
  )
),
updated_at = now()
WHERE asset_id = 'aigentqube-factor';
