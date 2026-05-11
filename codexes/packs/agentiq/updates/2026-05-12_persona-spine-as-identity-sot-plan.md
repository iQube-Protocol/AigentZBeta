# PersonaSpine as Identity SoT — Backfill + Smart Link + Auto-Persona Plan

**Date filed:** 2026-05-12
**Workstream:** Identity SoT consolidation (PersonaSpine + DIDQube + CRM)
**Severity:** High — current state has thousands of CRM users who can't see correct tier/status in the HUD because their identity is split across two systems
**Triggered by:** Operator review 2026-05-12 after the smart-link migration debate

---

## Naming clarification

The combined client-protocol family — **PersonaSpine + CartridgePresenceRegistry + the future reserved protocols (NotificationsBus, ReceiptsStream, ApprovalsQueue, CapsuleEvents)** — is called **"metaMe Client Protocols"**, per the parent contract `docs/architecture/metame-client-protocols.md`.

- Window namespace: `window.__metame.*`
- Event prefix: `metame:*`
- Type-augmentation root: `MetameNamespace` (in `types/metameWindow.ts`)
- Origin allowlist util: `utils/metameOriginAllowlist.ts`

Each protocol underneath shares the same three shared primitives (namespace, event prefix, cross-frame rules with origin allowlist). The PersonaSpine portion is the **identity slice** of that family; CartridgePresenceRegistry is the **navigation slice**.

---

## The three operator asks

1. **Persona-creation → CRM mapping (instantaneous).** When someone creates a persona anywhere in the estate AND they have a pre-existing CRM profile, those two identities are instantly mapped via DIDQube. From then on PersonaSpine manages their identity using Root DID + Kybe DID as the cross-system anchor.

2. **Backfill: CRM users without personas.** Existing CRM-only users (thousands) are brought into line with PersonaSpine so when they DO sign in and create a persona, the mapping happens correctly (no duplicate identity row).

3. **Backfill: signups without personas.** New users who sign up (auth.users row) without creating a persona at signup are also brought into line so PersonaSpine can be the true SoT across the entire estate.

---

## What shipped this session (#1 + #2)

**Migration:** `20260512040000_crm_personas_smart_link.sql`

Replaces the v1 naive auto-mirror with a smart-link trigger that handles operator asks #1 + #2 in one place:

### Matching order (most reliable to least)

1. **DIDQube root_did match** — `crm_personas.root_did = NEW.root_did`. This is the canonical DIDQube anchor; both tables store it (`personas.root_did NOT NULL`, `crm_personas.root_did` from `crm_persona_linking.sql`).
2. **Email match (direct)** — `crm_personas.email = auth.users.email[NEW.auth_profile_id]`. Catches legacy + Marketa imports where email is on the persona row.
3. **Email match (via crm_auth_profiles join)** — `crm_auth_profiles.email = auth.users.email` → `crm_personas.auth_profile_id`. Catches CRM users onboarded with an auth profile but no email on the persona row.

### What the trigger does

- If a match is found → **UPDATE** that row's `identity_persona_id = NEW.id` + backfill `root_did` / `display_name` if absent. No duplicate identity rows.
- If no match → **INSERT** a fresh `crm_personas` row (same as v1, but now also populates `root_did` + `email` so future matches succeed).
- `SECURITY DEFINER` so the function can read `auth.users` (needs email lookup); `search_path = public, auth` locked.

### Backfills run on migration apply

- Every active `personas` row without a matching `crm_personas` row gets one (re-runs v1 logic for safety).
- Every legacy `crm_personas` row without `identity_persona_id` but with a `root_did` matching an existing persona gets linked retroactively. **Note:** if v1 already created a duplicate fresh row (between the v1 ship + this v2 ship), this step links the legacy row but the duplicate remains. We don't delete duplicates automatically — operator review required.

### Privacy

The trigger function reads `auth.users.email` server-side via `SECURITY DEFINER`. The email is used only to RESOLVE the CRM persona, then written into `crm_personas.email` (server-side only — never surfaced to browser; `/api/wallet/tasks` and `/api/wallet/knyt/rewards/redeem` strip T0 fields before serialising). No T0 leakage.

---

## What's deferred to a follow-up workstream (#3 — auto-persona on signup)

The third ask — auto-create a `personas` row when a user signs up (i.e. `auth.users` INSERT) but doesn't create a persona — requires operator-level design decisions before it can land safely. Filing as a structured backlog so the next session can pick it up cleanly.

### Why it's not trivial

The `personas` table has hard NOT NULL constraints that don't have sensible defaults for a "shell" persona:

- `fio_handle VARCHAR(128) NOT NULL UNIQUE` — every persona requires a registered FIO handle. Auto-generating one ("user-1234@aigentz") works but burns FIO domain quota and may not match the user's actual identity. Letting it be nullable + lazy-registered is a schema change.
- `evm_key JSONB NOT NULL` — every persona has an encrypted EVM key (server-generated). Auto-creating one on signup means generating + encrypting + storing without user input. This is fine technically but raises the question: who controls the key? The user has no way to back it up if they never explicitly created the persona.
- `display_name VARCHAR(255) NOT NULL` — typically user-chosen. Default to email-derived name? "Anonymous"? Operator decision.
- `tenant_id VARCHAR(128) NOT NULL` — which tenant? Default to `'knyt'`? Resolve from signup source (referrer / utm)?

### Three implementation paths (operator decision needed)

**Path A — Auto-create shell persona on `auth.users` INSERT (most invasive)**

A Postgres trigger on `auth.users` AFTER INSERT that calls a Next.js Edge Function to:
1. Generate a placeholder FIO handle (`signup-<short-uuid>@aigentz` or similar).
2. Generate + encrypt an EVM key server-side using `PERSONA_KEY_ENCRYPTION_SECRET`.
3. INSERT a `personas` row with `display_name = email.split('@')[0]`, `tenant_id = 'knyt'` (or resolved).
4. The existing smart-link trigger then auto-maps to any CRM row.

Pros: PersonaSpine is truly SoT — every auth user has a persona.
Cons: Burns FIO handles + EVM keys for users who never engage past signup. User has no key custody story for the auto-generated key.

**Path B — Lazy-create on first authenticated request (recommended for alpha)**

A middleware (`middleware.ts` or per-route helper) that, on every authenticated request, checks if the user has a persona. If not:
1. Trigger the same persona-creation flow as the explicit user-driven path (with auto-resolved defaults: email-derived display_name, tenant from referrer / cartridge).
2. Smart-link trigger picks up the new persona + maps to existing CRM.
3. Surface a one-time "Personalize your identity" prompt to let the user override FIO handle + display name later.

Pros: same SoT outcome as Path A but only burns FIO handles on engagement. User gets a real prompt to claim + customize.
Cons: First request has a small extra latency (~200ms for persona creation). Need to handle race condition if two simultaneous requests arrive before the first creates the persona.

**Path C — Pre-warm on signup, finalize on engagement (hybrid)**

On `auth.users` INSERT, write a row to a new `pending_personas` table with the auth_profile_id + email. On first authenticated request, the middleware "finalizes" the pending row into a real `personas` row.

Pros: keeps auth.users INSERT lightweight; persona materialization is deferred.
Cons: most schema work; adds a new table to reason about; doesn't change the user-facing outcome vs Path B.

**Recommendation for alpha: Path B.** Smallest schema change; reuses the existing persona-creation code path; minimal extra latency; gives the user a real "claim your identity" moment instead of silent auto-provisioning.

### Open decisions for the operator

- [ ] Which path (A / B / C)? Lock before implementation.
- [ ] Auto-generated FIO handle format: `signup-<uuid>@aigentz` / `<email-local>-<short>@aigentz` / something else?
- [ ] Auto-generated EVM key custody: stored encrypted at rest with the platform's master key, surfaced to the user via "export wallet" later? Or generate but lock until user explicitly claims?
- [ ] Default tenant_id resolution: `'knyt'`? Read from `auth.users.raw_app_meta_data.signup_source` if populated? Per-host resolution?
- [ ] Default `default_identity_state`: `'pseudonymous'` (with `display_name` shown) or `'anonymous'` (handle-only)?
- [ ] Should auto-created personas be `world_id_status = 'unverified'` and gated from any verified-only flows until the user verifies?
- [ ] First-request prompt copy: what does the "Personalize your identity" prompt say? When does it surface (right after first action, or on first navigation)?

---

## Auditability + monitoring

The smart-link trigger does not emit orchestration_events on every persona-CRM link (those happen continuously and would flood the receipt batcher). For audit:

- Operator can run `SELECT COUNT(*) FROM crm_personas WHERE identity_persona_id IS NOT NULL` to see how many CRM users are now spine-bound.
- A CloudWatch query on the trigger function's runtime can show false-negative match rates (users who got a fresh CRM row when a match should have been found).
- Daily SQL job: `SELECT COUNT(*) FROM crm_personas WHERE identity_persona_id IS NULL AND email IS NOT NULL` — should trend DOWN as more users create personas; spikes indicate the matching logic is missing a case.

---

## Acceptance criteria for ask #1 + #2 (this commit)

- [x] `20260512040000_crm_personas_smart_link.sql` migration drops v1 trigger + replaces with smart-link trigger.
- [x] Matching order: root_did → direct email → crm_auth_profiles email → insert new.
- [x] On match: UPDATE existing row (no duplicate). On miss: INSERT new row with email + root_did populated.
- [x] Backfill: every active persona has a matching crm_personas row; every legacy crm_persona with matching root_did gets linked.
- [x] `SECURITY DEFINER` set so the function can read `auth.users`.
- [ ] **Operator action:** run the migration in Supabase SQL editor.
- [ ] **Operator action:** verify post-migration via:
  ```sql
  SELECT
    (SELECT COUNT(*) FROM personas WHERE status = 'active') AS active_personas,
    (SELECT COUNT(*) FROM crm_personas WHERE identity_persona_id IS NOT NULL) AS linked_crm_personas,
    (SELECT COUNT(*) FROM crm_personas WHERE identity_persona_id IS NULL AND email IS NOT NULL) AS unlinked_crm_with_email;
  ```

## Acceptance criteria for ask #3 (deferred — needs operator decision)

- [ ] Operator chooses Path A / B / C.
- [ ] Operator answers the 6 open decisions above.
- [ ] Implementation lands as a separate workstream with its own backlog doc.

---

## References

- v1 migration (superseded by this): `20260512030000_crm_personas_auto_mirror.sql`
- v2 migration (this commit): `20260512040000_crm_personas_smart_link.sql`
- crm_persona_linking foundation: `20251129030000_crm_persona_linking.sql`
- crm_auth_profiles schema: `20251128173200_agentiq_crm_enhanced.sql`
- personas schema: `20241202_create_personas_table.sql`
- PersonaSpine spec: `docs/architecture/persona-spine-client-protocol.md`
- Parent contract (metaMe Client Protocols): `docs/architecture/metame-client-protocols.md`
- CartridgePresenceRegistry spec: `docs/architecture/cartridge-presence-registry.md`
- DIDQube identity tables: `root_identity`, `kybe_identity` (per `crm_persona_linking.sql`)
