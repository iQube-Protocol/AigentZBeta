# Aigent Me Phase 6.b — Part 1: Google Workspace Foundation + Factory Alignment

**Date:** 2026-05-12
**Workstream:** Aigent Me Phase 6.b — Google Workspace OAuth + connectors + workflowQube alignment
**Status:** Landed (commit on `claude/register-agent-briefing-vK4kO`). Part 1 of 4.
**Predecessor:** `2026-05-12_aigent-me-phase-6b-google-workspace-alignment-backlog.md`

---

## What this PR delivers (Part 1)

Foundation for Phase 6.b. Compiles and degrades gracefully without operator OAuth credentials yet — same pattern as Phase 5's specialistRouter (template fallback when no `OPENAI_API_KEY`).

| Pass | Status |
|---|---|
| **P1 — OAuth + token storage** | ✅ this PR |
| **P2 — 9 connector services** | ✅ this PR |
| **P3 — ConnectorQube catalog (Factory alignment)** | ✅ this PR |
| **P4 — Marketa Mailjet compose** | deferred → Phase 6.b Part 3 |
| **P5 — Second-tier ApprovalCard** | deferred → Phase 6.b Part 2 |
| **P6 — DVN anchoring** | deferred → Phase 6.b Part 4 |

The deferred parts each have a clear seam: the second-tier ApprovalCard is a new state on the existing component (Part 2); Marketa Mailjet wiring composes against the existing `services/campaign/channelRegistry.ts` (Part 3); DVN anchoring extends the existing `services/dvn/receiptFinalizationService.ts` to consume `activity_receipts` rows where `receipt_status='dvn_pending'` (Part 4).

---

## Files

### Server foundation

| File | Purpose |
|---|---|
| `supabase/migrations/20260515000000_persona_google_tokens.sql` (new) | `persona_google_tokens` table. One row per `(persona, source)` — opt-in per source per the locked decision Q3. Service-role RLS. `access_token` and `refresh_token` stored as plain text in alpha; Phase 6.b.2 wraps via `services/content/encryption.ts` (no schema change). |
| `services/google/oauth.ts` (new) | Per-source OAuth2 flow. `getOAuthConfig` reports `not-configured` without throwing when env vars missing. `buildConsentUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getValidAccessToken` (auto-refreshes with 60s buffer), `disconnectSource` (Google revoke + row delete), `getConnectionStatuses` (welcome surface). Best-effort `userinfo` call captures the connected account email for display. |
| `services/google/connectors.ts` (new) | Nine uniform `GoogleConnector<I, O>` instances: `gmail.draft`, `gmail.send`, `calendar.create-event`, `calendar.invite-external`, `drive.create-doc`, `drive.share-doc`, `drive.search`, `docs.append`, `slides.create`. Each declares `requiresApproval`, `requiredScopes`, `inputSchema`, `outputSchema`, plus an `execute(input, ctx)` that calls the relevant Google API. No-token path returns `{ ok: false, code: 'not-connected' }`. |

### Routes

| File | Method | Purpose |
|---|---|---|
| `app/api/assistant/connect-google/route.ts` | POST | Body `{ source }` → returns `{ consentUrl }`. State token is HMAC-signed (`GOOGLE_OAUTH_STATE_HMAC_KEY` → `PERSONA_SESSION_TOKEN_HMAC_KEY` → `NEXTAUTH_SECRET` fallback chain) carrying `(personaId, source, nonce)`. |
| `app/api/assistant/google-callback/route.ts` | GET | Verifies signed state, calls `exchangeCodeForTokens`, emits `approval_granted` activity receipt, redirects to `GOOGLE_OAUTH_RETURN_URL` (or `/metame`). |
| `app/api/assistant/disconnect-google/route.ts` | POST | Body `{ source }` → revoke + delete row. |
| `app/api/assistant/google-status/route.ts` | GET | Returns `{ configured, missing[], statuses[] }` — drives the welcome surface's "Connect Google" panel (Part 2 wires the UI). |
| `app/api/connectors/execute/route.ts` | POST | Body `{ connectorId, input, sourceIntentId?, cartridge?, approvalToken? }`. Validates connector, refuses approval-required executions without a token, dispatches to the connector, emits `artifact_sent` (approval-required) or `artifact_created` (no-approval) activity receipt. |

### Factory alignment

| File | Purpose |
|---|---|
| `services/registry/googleConnectorCatalog.ts` (new) | Seeds Google connectors as `ConnectorQube` instances per `types/registryIngestion.ts:345`. Maps `requiresApproval` → policy class `human_approval_required`; everything else → `secret_bound`. `wrapperStrategy: 'http'`, `authScheme: 'oauth2'`, `endpointUrl: '/api/connectors/execute'`. Operators publish each entry to the live registry via the existing `/api/registry/intake` flow when ready. |

---

## Operator-facing degrade strategy

Phase 6.b cannot run end-to-end until the operator provides:

1. **Google Cloud Console project** with OAuth client credentials
2. **`GOOGLE_OAUTH_CLIENT_ID`**, **`GOOGLE_OAUTH_CLIENT_SECRET`**, **`GOOGLE_OAUTH_REDIRECT_URI`** in the Amplify env
3. **Authorized redirect URI in the GCP project** matching `GOOGLE_OAUTH_REDIRECT_URI` (typically `https://dev-beta.aigentz.me/api/assistant/google-callback`)
4. **`GOOGLE_OAUTH_STATE_HMAC_KEY`** (or rely on `PERSONA_SESSION_TOKEN_HMAC_KEY` / `NEXTAUTH_SECRET` fallback)

**Until those are set**, every route returns a clean diagnostic instead of crashing:

- `/api/assistant/connect-google` → 503 `{ error: 'oauth-not-configured', missing: [...] }`
- `/api/assistant/google-status` → 200 `{ configured: false, missing: [...], statuses: [] }`
- `/api/connectors/execute` → 503 with the same diagnostic + the operator hint
- `/api/assistant/google-callback` → 302 redirect to `?google_oauth=state-invalid` (or similar)

The welcome surface in Part 2 will use `google-status.configured` to render either:
- "Operator action: Google Workspace not yet configured" (when `configured=false`) — for admins
- The per-source "Connect …" cards (when `configured=true`) — for users

---

## Privacy contract held

- `persona_id` is T0 on the table; never serialised to a JSON response.
- Access tokens + refresh tokens live server-side only. The browser receives `GoogleConnectionStatus` per source (connected boolean + scopes + expires + account email).
- The `account_email` IS surfaced to the browser — it's the email **of the connected Google account**, the user's own information they explicitly granted via consent. Cross-persona disclosure rules unchanged.
- The OAuth state token is HMAC-signed; can't be forged client-side.
- Token refresh happens silently; the connector layer never returns tokens to callers.
- Every consent / disconnect / execution emits an `activity_receipt`.

---

## Reuse-first audit

| Existing primitive | Used? |
|---|---|
| `types/registryIngestion.ts::ConnectorQube` | ✓ — sole shape for Factory registration |
| `types/registryIngestion.ts::TrustBand, PolicyClass, WrapperStrategy, CapabilityDescriptor` | ✓ — all four mapped to canonical enum values (`L3_PRODUCTION_CANDIDATE`, `human_approval_required` / `secret_bound`, `http`, etc.) |
| `services/identity/getActivePersona.ts` | ✓ — sole personaId source at every route |
| `services/receipts/activityReceiptService.ts` (Phase 6) | ✓ — every consent / disconnect / execute emits a receipt |
| `services/orchestration/nbeCatalog.ts` (Phase 3) | unchanged |
| `services/agents/specialistRouter.ts` (Phase 5) | unchanged — Phase 6.b Part 2 will wire chip-click → connector |
| `app/api/_lib/supabaseServer` | ✓ |

No new server resolver. No protected files (CLAUDE.md identity-spine list) modified. No new dependencies — uses native `fetch` against Google's REST APIs.

---

## Operator action required to validate

Run the migration:

```sql
-- /home/user/AigentZBeta/supabase/migrations/20260515000000_persona_google_tokens.sql
```

Verify:

```sql
SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='persona_google_tokens';
SELECT policyname, cmd FROM pg_policies WHERE tablename='persona_google_tokens';
```

Expect `1` and two policies.

Then `GET /api/assistant/google-status` will return `{ configured: false, missing: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'], statuses: [...] }`. That's the expected pre-OAuth state — confirms the foundation is live.

---

## What's queued

| Workstream | Status |
|---|---|
| **Phase 6.b Part 2** — second-tier ApprovalCard state + welcome-surface "Connect Google" cards + status panel | next |
| **Phase 6.b Part 3** — Marketa Mailjet compose: a campaign send-step can chain `marketa.propose-campaign → gmail.draft → mailjet.send` via the existing ChannelRegistry pattern | follow-up |
| **Phase 6.b Part 4** — DVN anchoring: extend `services/dvn/receiptFinalizationService.ts` to consume `activity_receipts` rows where `receipt_status='dvn_pending'` and the action_type implies external visibility (`artifact_sent`, `approval_granted`) | follow-up |
| **Phase 5.b** — Anthropic + Venice LLM fallbacks; register Quill persona | queued |
| **PersonaSpine sweep** — 4 deferred files | queued |

---

## Files

- `supabase/migrations/20260515000000_persona_google_tokens.sql` (new)
- `services/google/oauth.ts` (new)
- `services/google/connectors.ts` (new)
- `services/registry/googleConnectorCatalog.ts` (new)
- `app/api/assistant/connect-google/route.ts` (new)
- `app/api/assistant/google-callback/route.ts` (new)
- `app/api/assistant/disconnect-google/route.ts` (new)
- `app/api/assistant/google-status/route.ts` (new)
- `app/api/connectors/execute/route.ts` (new)
