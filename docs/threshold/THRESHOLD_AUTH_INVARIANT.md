# Threshold Authentication Invariant

## Rule

**One bearer, one resolver, one authorization path.**

Any endpoint reached with a Threshold Constitutional Handshake bearer (`ths_…`) MUST resolve authority through the canonical Threshold session adapter:

```ts
requireThresholdSession(request, requiredCapability?)
```

That adapter resolves the bearer through `gatewaySession.resolveBearer()` and, when requested, enforces the capability with `hasScope()`.

A Threshold action endpoint MUST NOT pass a `ths_…` bearer to `getActivePersona()` or reconstruct authority from a browser/Supabase session.

## Deliberate exception

`app/api/threshold/oauth/complete/route.ts` is the HUMAN browser authorization act. It may resolve the signed-in active persona in order to project canonical authority into the newly minted Threshold bearer. Once the bearer exists, downstream Threshold actions consume the bearer rather than re-resolving persona authority.

## Failure semantics

The canonical adapter returns safe diagnostic classes without logging bearer material:

- `missing_bearer` → HTTP 401
- `invalid_expired_or_revoked_bearer` → HTTP 401
- `missing_capability` → HTTP 403

The raw bearer MUST NEVER be logged.

## Scope canonicalization

Before authorization-code / bearer minting, capability scope MUST be normalized with `normalizeThresholdScope()` so duplicate capabilities cannot enter session state. Ordering is preserved.

## Regression gate

`tests/threshold-auth-invariant.test.ts` scans `app/api/threshold/**` and fails if a Threshold action route imports `getActivePersona()` outside the explicit HUMAN browser-authorization allowlist. It also canaries bearer extraction, capability-scope normalization, and the native upload route's use of `requireThresholdSession(req, 'content.asset.upload')`.

## Upload E2E invariant

For `upload_content_asset` the expected authorization chain is:

`OAuth crossing → active ths_ bearer → resolveBearer → content.asset.upload scope → upload action/MCP dispatch → canonical Autonomys/Codex upload → asset receipt`

A browser-auth failure at the action endpoint is a regression.
