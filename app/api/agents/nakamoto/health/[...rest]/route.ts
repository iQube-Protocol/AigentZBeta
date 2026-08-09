/**
 * GET /api/agents/nakamoto/health/* — catches whatever Horizen ACTUALLY
 * probes, not only the bare /health route.
 *
 * ── WHY THIS EXISTS (operator report, 2026-08-07) ───────────────────────────
 *
 * Horizen's own correlated trace for this agent names two separate fields:
 *
 *   endpoint   = https://dev-beta.aigentz.me/api/agents/nakamoto/health
 *   healthPath = /health
 *
 * `endpoint` matches EXACTLY what this repo's own runtime descriptor already
 * resolves and submits (`services/registry/runtimeDescriptor.ts`'s
 * `resolveRuntimeHealthUrl` — Nakamoto's `runtime.health` is the absolute URL
 * above, seeded in migration `20260810000000_nakamoto_runtime_endpoint.sql`,
 * and wins outright over `runtime.endpoint` once absolute).
 *
 * `healthPath` is NOT a value this client has ever sent —
 * `submitHorizenTransparencyAuthorization` (services/horizen/
 * authorizationClient.ts) offers no `healthPath` candidate at all, even
 * though the LIVE `enable_pulse_monitoring` schema declares it as an OPTIONAL
 * property (see `REAL_ENABLE_PULSE_SCHEMA` in
 * tests/horizen-authorization-client.test.ts). A field we never populate but
 * Horizen nonetheless RECORDS with a concrete value can only be a
 * Horizen-side DEFAULT ("/health" when the client supplies none) — which
 * confirms Horizen COMPOSES the actual probe target as `endpoint +
 * healthPath`, never treating `endpoint` alone as the final URL. Composed:
 *
 *   https://dev-beta.aigentz.me/api/agents/nakamoto/health + /health
 *   = https://dev-beta.aigentz.me/api/agents/nakamoto/health/health
 *
 * — a route that never existed, hence the health/SLA failure.
 *
 * `enable_pulse_monitoring` is a state-changing, wallet-signed call
 * (services/horizen/authorizationClient.ts) — re-submitting it to register a
 * corrected `endpoint`/`healthPath` pair would be a NEW enrollment ceremony,
 * explicitly out of scope (operator, 2026-08-07: "Do not touch signing or
 * enrollment again"). The fix is therefore entirely on THIS side: answer
 * 2xx at whatever Horizen actually composes, without touching the already-
 * confirmed enrollment at all.
 *
 * A REQUIRED catch-all (`[...rest]`, not `[[...rest]]`) so this file matches
 * only `/health/<something>` and never shadows the sibling bare `/health`
 * route (`../route.ts`) — no ambiguity between the two. The exact same
 * handlers are re-exported, never duplicated (inv.engineering.036/037): this
 * surface must answer identically to `/health` itself, whatever sub-path
 * Horizen (or any future default it picks) appends.
 */
export { GET, OPTIONS } from '../route';
