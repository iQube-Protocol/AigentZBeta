-- 20260930002300_moneypenny_runtime_endpoint.sql
--
-- Agent Runtime Endpoint (operator ruling, 2026-08-04; closed generically for
-- MoneyPenny in the Horizen Pilot Closure pass, 2026-08-09): populates
-- registry_assets.metadata.runtime for Aigent MoneyPenny's canonical
-- AigentQube (aigentqube-moneypenny) so services/registry/runtimeDescriptor.ts's
-- getAssetRuntimeDescriptor has something real to project, and
-- services/horizen/pulseEndpoint.ts's resolvePulseEndpoint has a real health
-- URL to resolve for Horizen Pulse — mirroring
-- 20260810000000_nakamoto_runtime_endpoint.sql exactly. Both the read path
-- (runtimeDescriptor.ts) and the Pulse consumer (pulseEndpoint.ts) were
-- already fully generic before this migration; MoneyPenny was simply the
-- one registrable agent with no row populated.
--
-- `endpoint` points at MoneyPenny's OWN real, live runtime surface —
-- app/api/moneypenny/chat/route.ts, her financial-services chat agent
-- (callSovereign('reasoning', ...)) — never a generic invoke route she does
-- not have. `health` points at the paired, real GET route added alongside
-- this migration: app/api/agents/moneypenny/health/route.ts. Pulse resolves
-- `health` in preference to `endpoint` whenever both are present
-- (resolveRuntimeHealthUrl), so the POST-only /chat surface is never itself
-- polled.
--
-- Host is dev-beta.aigentz.me — the same confirmed, already-documented dev
-- deployment host the Nakamoto migration uses — never invented per
-- CLAUDE.md's No-Guessing rule.
--
-- `metadata || jsonb_build_object('runtime', ...)` is a shallow top-level
-- merge — adds/overwrites ONLY the 'runtime' key, leaving every other key
-- already on this row untouched.

UPDATE registry_assets
SET metadata = metadata || jsonb_build_object(
  'runtime', jsonb_build_object(
    'endpoint', 'https://dev-beta.aigentz.me/api/moneypenny/chat',
    'health', 'https://dev-beta.aigentz.me/api/agents/moneypenny/health',
    'protocol', 'https',
    'version', '1'
  )
),
updated_at = now()
WHERE asset_id = 'aigentqube-moneypenny';
