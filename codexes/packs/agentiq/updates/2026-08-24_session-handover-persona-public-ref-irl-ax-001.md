# Session Handover — 2026-08-24 (Horizen/MoneyPenny closeout → PERSONA-PUBLIC-REF-001 → IRL-AX-001)

**Status:** Active handover. Give this doc's path to the new agent as its first message.
**Branch:** `claude/resume-consumer-session-qm3v7c` — merged clean into `dev` through commit `188e248e6`.
**Repo:** `iQube-Protocol/AigentZBeta`

---

## 0. FIRST THING THE NEW SESSION MUST DO

Before touching any Supabase-dependent or Threshold-dependent task in this handover, **verify tool
access rather than assume it** — see the new CLAUDE.md section **"Session Start — Verify
Connector/MCP Access, Don't Assume It"** (added this session, right after "MCP Servers — Threshold
/ metaMe Tool Access"). Read it in full before doing anything DB-related. Short version:

1. Call `ListConnectors` for Supabase and metaMe Threshold, AND search for their actual tools
   (e.g. `ToolSearch` with `select:mcp__Supabase__execute_sql`). Both must succeed before treating
   either as usable.
2. **Known failure mode**: the operator's client can show a connector as connected with a nonzero
   tool count while the session itself has zero access (`enabledInChat: false`, `ToolSearch` empty).
   This happened live this session — a working Supabase connection silently dropped mid-session and
   would not reattach from the operator's side. Don't spend multiple turns re-diagnosing this from
   scratch; if it recurs, say so plainly and fall back to giving the operator exact SQL to run
   themselves (mandatory house style — see CLAUDE.md "Operator Instructions").
3. This session ended WITHOUT confirmed live Supabase access. The migration below was applied by
   the operator manually via the SQL editor, not verified live from this session.

---

## 1. What shipped this session (all pushed, all on `dev`)

### A. Horizen/MoneyPenny Phase 3 — final UI closeout (CLOSED)

`HORIZEN-FS-PILOT-CLOSURE-001` — pure UI/copy work separating Runtime-system readiness from
selected-agent qualification in `ServiceOrchestrationPanel.tsx` and `ParticipationStandingTab.tsx`.
No threshold/accrual/gate/DVN logic touched. Closure record:
`codexes/packs/agentiq/updates/2026-08-24_horizen-fs-pilot-closure-001.md`. **Do not reopen this
pilot path** unless new live evidence reveals a defect.

### B. Provider-Standing-attribution reconciliation (admin-persona auth path)

`POST /api/ops/journey/reconcile-provider-standing-attribution` now accepts an authenticated
admin-persona caller (`requireAdminPersona` + `getActivePersona`) as an equal alternative to the
`CRON_TRIGGER_TOKEN` path, per an explicit operator security directive this session (never expose
or ask for `CRON_TRIGGER_TOKEN`/`ADMIN_OPS_TOKEN`/Bearer tokens). Live corrections already applied
and verified this session — MoneyPenny's Standing is genuine: `personal: 3, overall: 2.1`.

### C. PRD-IRL-AX-001 — Reciprocal Artifact Exchange (RATIFIED, primitive built)

- PRD status: **RATIFIED (2026-08-24)** —
  `codexes/packs/irl/foundation/PRD-IRL-AX-001_reciprocal-artifact-exchange.md`.
- Generic primitive built and tested: `services/research/reciprocalExchange.ts`, migration
  `supabase/migrations/20260930020000_reciprocal_artifact_exchange.sql`, API routes under
  `app/api/research/exchanges/`, `app/triad/components/codex/tabs/IRLExchangeTab.tsx`,
  `scripts/seed-irl-ax-001.mjs`, `tests/reciprocal-exchange.test.ts`.
- **The IRL-AX-001 dogfood instance is live and partially progressed**:
  - Exchange id `0b4134a6-6246-48a8-98f6-e3a22fcd18b3` — *"CI/IRL × OCSGA Independent Architecture
    Exchange"* — status **A_DEPOSITED**.
  - Party A (Dele/MetaProof/IRL) artifact deposited: id `4179ac57-5562-434b-91ed-80896665e5fb`, v1,
    sha256 `41fb47c6cd7c3022a0fc17046166f6b9a988d6d07a569c1fb2106ef6f5a60f35`, pinned at commit
    `bd84582d9ad48a3b257c9f651a8cbf7f1ac9eeb6`.
  - Initiator persona: `dbaf6fac-62f8-4603-9888-bd4f3395c2ca` (Aigent Z, `fio_handle: aigentz@aigent`,
    public ref `42492981a27fc918` — verified against the live `personas` table before use).
  - **Next constitutional acts, none performed yet** — each is deliberate, not automatic:
    1. Declare the freeze — `POST /api/research/exchanges/0b4134a6-6246-48a8-98f6-e3a22fcd18b3/actions {action:"freeze"}` as Dele.
    2. Invite Ian (OCSGA) — `POST .../actions {action:"invite"}`; share the returned code privately.
    3. Ian claims via `POST /api/research/exchanges/join {code}` once his own Passport/persona resolves.
    4. Ian deposits + freeze-declares his own OCSGA artifact — never fabricated by any script.
    5. Both sign the Exchange Instrument; the exchange crosses automatically once both signatures land.

### D. PERSONA-PUBLIC-REF-001 — implemented, merged to `dev` (commit `188e248e6`)

Operator ruling: `personas.id` is T0/server-internal and must never be the normal user-supplied or
external persona identifier. Implementation:

- **Migration** `supabase/migrations/20260930030000_persona_public_ref_column.sql` — adds
  `personas.public_ref`, a `GENERATED ALWAYS AS (...) STORED` column computed as
  `sha256(id)` first 16 hex chars (identical to `personaPublicRef()` and the DVN pipeline's
  `hashPersonaRef()` — guaranteed never to drift), uniquely indexed.
  **⚠️ Applied manually by the operator via the Supabase SQL editor — NOT verified live from any
  session.** First task for whoever has live Supabase access: run —
  ```sql
  SELECT id, fio_handle, public_ref FROM personas
  WHERE id = 'dbaf6fac-62f8-4603-9888-bd4f3395c2ca';
  ```
  Expected: `public_ref = '42492981a27fc918'`. If the column doesn't exist yet, apply the migration
  file above verbatim.
- `resolvePersonaIdByPublicRef()` in `services/identity/personaReferences.ts` — the one sanctioned
  reverse path (public_ref → id), a plain indexed lookup, rejects malformed input pre-query.
- New admin-gated `GET /api/admin/persona/resolve-public-ref?ref=<16-hex>` (`requireAdminPersona`).
- Fixed the concrete instances of "ask the user to paste a raw persona UUID": `InviteModal.tsx` +
  `/api/mycanvas/entries/[id]/invite`, `/api/identity/resolve-recipient` (AgentWalletDrawer's "pay a
  recipient" flow), `ContributionForm.tsx`'s manual-entry CRM field. All now ask for/resolve the
  16-hex public reference instead.
- `scripts/seed-irl-ax-001.mjs` now takes `--initiator-public-ref=<16-hex>` as the documented way to
  run it; `--initiator-persona-id=<uuid>` remains only as a debug override.
- Deliberately left with raw UUID (operator's own "tightly-controlled admin/debug" carve-out):
  `scripts/verify-spine.mjs`, `scripts/register-ccb-capabilities.ts`,
  `app/api/admin/persona-graph/{search,route}.ts`, both `investor-dashboard` routes.
- Tests: `tests/persona-public-ref-resolver.test.ts` (9 cases, passing). tsc baseline unchanged
  (1085 errors, identical with/without this session's diff — verified via `git stash`). Full vitest
  regression unchanged (19 pre-existing failing files; one additional flake in
  `vela-confidential-projection-provider.test.ts` reproduced as non-deterministic, unrelated to any
  file this session touched — passed clean on a second full run).

### E. CLAUDE.md addition (this session)

New section **"Session Start — Verify Connector/MCP Access, Don't Assume It"**, inserted after "MCP
Servers — Threshold / metaMe Tool Access". Documents the exact failure mode from §0 above as
foundational, repo-wide guidance. Read it.

---

## 2. Open items for the next session (not yet actioned — flagged, not fixed)

Found incidentally while auditing raw-persona-UUID exposure for PERSONA-PUBLIC-REF-001. None of
these were in scope for that task; none have been touched. Surface to the operator for a decision
before acting on any of them:

1. **`/api/crm/contributions` has no auth gate at all** — no `requireAdmin`/`getActivePersona` call
   found in the route. Anyone who can reach it can POST. Unrelated to identifier format; a real gap.
2. **`did:iq:<32-hex>` format** (accepted alongside the public ref in `resolve-recipient` and the
   mycanvas invite route) is functionally just a re-encoded raw persona UUID (hyphens stripped then
   reinserted) — the same smell PERSONA-PUBLIC-REF-001 fixed, under a different name. Left alone
   because the operator didn't name it and it's used consistently elsewhere; worth a follow-up
   ruling on whether to deprecate it too.
3. **`PersonaReferencesInventory.tsx` / `/api/wallet/identity/references`** still recomputes
   `personaPublicRef()` on the fly instead of reading the new persisted `public_ref` column.
   Harmless today (guaranteed identical value), but a minor duplication now that a single source of
   truth exists on the table itself.

---

## 3. Key files map

| Concern | Files |
|---|---|
| Persona Public Reference | `services/identity/personaReferences.ts`, `supabase/migrations/20260930030000_persona_public_ref_column.sql`, `app/api/admin/persona/resolve-public-ref/route.ts` |
| Reciprocal Artifact Exchange | `services/research/reciprocalExchange.ts`, `app/api/research/exchanges/**`, `app/triad/components/codex/tabs/IRLExchangeTab.tsx`, `scripts/seed-irl-ax-001.mjs` |
| Horizen/MoneyPenny Financial Services UI | `app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx`, `app/triad/components/codex/tabs/ParticipationStandingTab.tsx` |
| Standing reconciliation | `app/api/ops/journey/reconcile-provider-standing-attribution/route.ts` |

---

## 4. Real identifiers referenced above (none are secrets — UUIDs/refs, not credentials)

- Aigent Z persona: `dbaf6fac-62f8-4603-9888-bd4f3395c2ca` / public ref `42492981a27fc918` / handle `aigentz@aigent`
- IRL-AX-001 exchange: `0b4134a6-6246-48a8-98f6-e3a22fcd18b3`
- Party A artifact: `4179ac57-5562-434b-91ed-80896665e5fb`
- Supabase project (Aigent Z, the one this app actually uses): `bsjhfvctmduxhohtllly`
