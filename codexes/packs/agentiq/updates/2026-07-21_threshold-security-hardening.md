# metaMe Threshold — security hardening (adversarial review + fixes)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** security fix
**Origin:** operator-requested adversarial review of the Threshold auth surface (live OAuth 2.1 + MCP gateway) before external users lean on it.

## Headline

**No critical findings.** The hard parts are solid: human-only authorization (no agent-authorize path anywhere), bearer/code integrity (256-bit, sha256-at-rest, single-use, replay-guarded), PKCE S256 correctness, **zero T0 identifier leakage**, deny-all RLS, scope-vocabulary intersection, path-traversal guard, no SQLi. The delegation model holds. Eight hardening findings (1 HIGH + mediums/lows) were surfaced; **seven are fixed here**, one (a DB-atomicity race) is scoped for a dedicated pass.

## Fixed

- **F1 (HIGH) — host-header injection / SSRF.** `publicOrigin` trusted the client-settable `x-forwarded-host`, which fed the OAuth `.well-known` metadata (cached `public, max-age=300`) and the Threshold canon self-fetch — an attacker could poison the advertised authorize/token endpoints or serve fake "ratified" definitions.
  - `utils/publicOrigin.ts` — `x-forwarded-host` is now honoured only when it matches a configured allowlist (`THRESHOLD_TRUSTED_HOSTS`); `NEXT_PUBLIC_APP_URL` (the configured host) always wins first.
  - Both `.well-known` routes → `Cache-Control: private, no-store` + `Vary: X-Forwarded-Host, Origin` (no cross-client cache poisoning).
  - `scripts/create-env-production.js` — allowlisted `NEXT_PUBLIC_APP_URL` + `THRESHOLD_TRUSTED_HOSTS`.
- **F3 (MED) — capability-URL leakage.** The service-entry handshake code rode in a query param (`?code=`) → Referer/history/log leak. Now delivered in the URL **fragment** (`#code=`, never sent to servers or in Referer); `enter-service` reads it client-side (query-param fallback kept).
- **F4 (MED-LOW) — service-cap folding.** `authorize-init` could grant a client-supplied service's caps at the base crossing. Now the initial crossing grants **constitutional-root only**; service capabilities come exclusively via the incremental, human-authorized service crossing.
- **F5 (LOW-MED) — open redirect on Deny.** The authorize page's Deny navigated to an unvalidated `redirect_uri`. Now gated on `handshakeCode` (set only after `authorize-init` validated the redirect against the registered client) + scheme check.
- **F6 (LOW) — unbounded DCR writes.** `register` now caps `redirect_uris` (≤8, ≤2048 chars, must be absolute http(s)) and `client_name` (≤256).
- **F7 (LOW) — upgrade scope trust.** `applyUpgrade` now re-validates `grantedScope ⊆ grantableCapabilities(service)` inside the function (never trusts the caller) and closes the upgrade handshake to a **terminal** status (`revoked`, not `active`).
- **F8 (LOW) — timing.** PKCE challenge compare is now constant-time (`timingSafeEqual`, length-guarded).

## Deferred (scoped, needs a dedicated pass)

- **F2 (MED) — CFS-042 `maxActions` TOCTOU.** The delegated-submission budget is a read-then-insert count, so concurrent POSTs can over-submit past the cap. A safe fix requires **DB-level atomicity** — an advisory-lock (`pg_advisory_xact_lock(hashtext(agreement_id))`) + count-in-transaction inside a plpgsql `submit_result_atomic(...)` function, or a per-agreement monotonic sequence with a unique constraint. An app-level compensating patch would race worse, so it is intentionally NOT shipped racy. Touches the CFS-042 submit path (operator-gated); tracked for a focused migration.

## Operator action (completes F1)

Set the public-origin pin so `publicOrigin` never depends on a spoofable header:
- Amplify → AigentZBeta → **dev** → Environment variables → `NEXT_PUBLIC_APP_URL` = `https://dev-beta.aigentz.me` (optionally `THRESHOLD_TRUSTED_HOSTS` = `dev-beta.aigentz.me`). Redeploy.

Until set, behaviour is unchanged (no breakage); once set, F1 is fully closed.

## Files

`utils/publicOrigin.ts`, `app/.well-known/oauth-authorization-server/route.ts`, `app/.well-known/oauth-protected-resource/route.ts`, `scripts/create-env-production.js`, `app/api/threshold/oauth/authorize-init/route.ts`, `app/api/threshold/oauth/register/route.ts`, `app/threshold/authorize/page.tsx`, `app/api/threshold/mcp/route.ts`, `app/threshold/enter-service/page.tsx`, `services/threshold/gatewaySession.ts`.

No migration in this change; no gate weakened; no T0 exposure introduced.
