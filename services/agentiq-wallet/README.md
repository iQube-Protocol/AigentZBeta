# AgentiQ Wallet Service

Service backing the Aigent Z Wallet Drawer for humans and agents. Integrates DIDQube personas, FIO handles, x402 A2A payments, DVN attestations, iQube/Q¢ entitlements, Smart Menu, SSE, and multichain support.

## Run

From repo root with root env:

- Install: `npm run wallet:install`
- Dev: `npm run wallet:dev`
- Build: `npm run wallet:build`
- Start: `npm run wallet:start`

Node: v20+ (see .nvmrc)

## Env (examples)

- CORS_ORIGIN
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- X402_FACILITATOR_ENDPOINT
- DVN_BASE_URL
- DID_SIGNER_SEED
- FIO_API_ENDPOINT, FIO_SYSTEM_PRIVATE_KEY

## Endpoints (MVP)

- POST /wallet/init
- POST /wallet/link-fio
- GET /wallet/balances
- GET /wallet/transactions
- POST /wallet/request-payment
- POST /wallet/nl/plan
- POST /wallet/nl/execute
- POST /x402/quote
- POST /x402/sign
- POST /x402/send
- POST /x402/request
- GET  /x402/status/:txId
- POST /iqube/send
- POST /iqube/authorize
- GET  /iqube/entitlements
- POST /entitlements/:txId
- GET  /sse

## Notes

- Persona-aware RLS via DIDQube context and RQH (ReputationQube Hub) policies.
- Deferred minting & canonical sales via DVN.
- Smart Menu manifests published from this service.
