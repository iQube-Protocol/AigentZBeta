# DIDQube & Passport (Citizen / Agent) — Architecture vs Code Report

**Date:** 2026-09-07
**Scope:** How "DIDQube" identity and "Passport" (Citizen vs Agent/Delegate) are documented as
architecture/intent, versus what actually exists in the codebase today. Read-only investigation —
no code changed as part of this report.

**Sources read:**
- `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` (policy/architecture note)
- `codexes/packs/agentiq/items/IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` (engineering reference)
- CLAUDE.md's "Identity & Access Spine" section (T0/T1/T2 tiers)
- Direct code inspection: `services/identity/`, `services/passport/`, `app/api/passport/`,
  `app/api/polity-passport/`, `app/api/identity/`, relevant Supabase migrations, and
  `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx`

---

## 1. Executive summary

- **"DIDQube" is not a real data type, table, or qube-service module.** It is a naming/branding
  umbrella over three ordinary Postgres tables (`kybe_identity`, `root_identity`, `did_persona`) plus
  one UI label component. It does **not** follow the pattern the other qube types use (e.g.
  `services/iqube/financialProfileQube.ts`) — there is no `didQube.ts`.
- **A second, entirely separate "DIDQube" schema exists and is dead code.** A migration
  (`services/agentiq-wallet/db/migrations/001_didqube_core.sql`) creates a literal `didqube` Postgres
  schema with its own `person`/`root_did_bindings`/`persona` tables. Nothing under `app/api` or the
  main `services/passport`/`services/identity` trees reads it — it is used only by an isolated
  sub-package (`services/agentiq-wallet`), with RLS policies still at `USING (true) WITH CHECK (true)`
  (explicitly flagged in its own trailing comment as not yet real).
- **The architecture doc's own "Key files" table is partly stale.** It names
  `services/identity/didRegistrationService.ts` and `services/identity/blakQubeService.ts` as the
  canonical implementation files for FIO/Root-DID registration and blakQube encryption. **Neither
  file exists.** The real logic lives elsewhere (`fioService.ts`, `personaFioService.ts`,
  `bureauIdentityService.ts`; blakQube encryption is implemented per-qube-type, not centrally).
- **Citizen vs Agent/Delegate Passport is real and enforced, but as one shared table discriminated by
  a column — not as two distinct data models.** `passport_class` (`'citizen' | 'agent_participant' |
  'robot_participant' | 'organization_participant'`) is the only structural difference. The code
  itself is explicit that this is a deliberate operator decision, not an oversight (see §3).
- **True bounded-delegation grants (an agent acting *for* a citizen) are a genuinely separate model**
  from Passport issuance, living in `agent_persona`/`agent_root_identity`, and the Passport UI
  component's own header comment states in caps that issuing a Passport must never be confused with
  granting delegation. This separation is intentional and code-enforced, not just documented.
- **The kybe_DiD layer (Layer 0, human-only proof-of-personhood) is further along than its own doc
  claims.** `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` §15.8 says it is "schema-ready,
  application-stub." In fact `services/identity/passportPrincipal.ts` — the module that resolves who
  is allowed to act on a session — walks through `kybe_id` as its primary binding key in every entry
  point. The kybe layer is load-bearing in the live Passport-native access path, not merely scaffolded.
- **One concrete T0/T1 tension found**, not a clear-cut bug: `polity_passport_records.passport_id`
  (a human-readable business identifier like `ppc-<hex>`, distinct from the row's UUID primary key)
  is documented inline in `passportPrincipal.ts` as something that "stays server-internal," yet it is
  serialized to the browser by `GET /api/polity-passport/wallet` and consumed client-side by
  `PassportBureauApplyTab.tsx`. This may be intentional owner-self-view exposure (a citizen seeing
  their own Passport ID, the same class of exception CLAUDE.md documents for `personaId` in wallet
  self-view routes) rather than a defect — but the code's own comment and the code's own behavior
  disagree, and nothing resolves that tension explicitly. Flagged for operator judgment, not asserted
  as broken.
- **A significant, explicitly-acknowledged gap**: agent/delegate identifiability clamping (an agent's
  effective identifiability must be the floor of its own declared level and its sponsoring human's
  current level — Upgrade Note §6/§7) has an extension point in code
  (`services/identity/getActivePersona.ts`) but is **not implemented**, with an inline comment stating
  it was deliberately deferred as "delegation paths are not yet routine in production traffic."

---

## 2. DIDQube — architecture vs code

### 2.1 What the architecture says

`IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md` describes DIDQube as **Layer 1** of four cooperating
sovereignty layers: a FIO-blockchain-anchored Root DID (`did:fio:<handle>`), with a secondary
*anonymous* representation on ICP for privacy-preserving verification, implemented via a
`did_registration_service` that performs FIO + ICP registration "atomically," with the DIDQube
"link[ing] the persona's identity to its reputation record and anchor[ing] all DVN receipts."

`AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` describes a **five-layer human identity stack** —
`kybe_DiD → Root DiD → Persona → FIO Handle → FIO PK` — with the kybe_DiD as the deepest, immutable,
human-only "birth certificate" layer beneath the (mutable, reissuable) Root DiD, and states this
layer is "schema-ready, application-stub" (§15.8): tables exist, but "the application has just not
yet enforced or surfaced this binding."

### 2.2 What's actually in code

**No unified `DIDQube` object exists.** The real, live model is three tables plus a bridge table,
matching a *different* three-class breakdown documented inline in
`services/identity/personhoodResolver.ts`:

```
1. KYBE DID    (kybe_identity)              — anonymized proof-of-life
2. ROOT DID    (root_identity, kybe_id→kybe) — proof of identity
3. PERSONA     (did_persona, root_id→root)   — interaction/integration face
```

This is consistent with the Upgrade Note's five-layer model in spirit (kybe beneath root beneath
persona) but is not implemented as anything resembling a "DIDQube" data type — no code path
constructs an object literally named or shaped like a DIDQube. "DIDQube" appears only as a doc
comment or UI label in ~19 files (types, drawer components, a health-check route), never as an
exported `interface`/`type`/`class`.

**Creation/minting** is real and centralized in `services/passport/bureauIdentityService.ts`:
- `mintKybeDid()` → `` `did:kybe:ppb:<hex>` ``
- `bindBureauIdentity()` — find-or-create `root_identity` (mints `did:root:ppb:<hex>` if absent),
  mint-or-reuse `kybe_identity` (one kybe per human is enforced by reusing the root's existing
  `kybe_id`), inserts a `personas` row, inserts a `did_persona` bridge row.
- T0 discipline is explicit in the file: raw `kybe_did`/`did_uri` never leave the server; only
  SHA-256-truncated public refs (`kybePublicRef`/`rootDidPublicRef`) do.

**Resolution (the reverse walk)** lives in `services/identity/passportPrincipal.ts`, which the kybe
layer is genuinely load-bearing in — every entry point (`resolvePassportPrincipal` from a proven
wallet, `resolvePassportPrincipalByWorldId`, `resolvePassportPrincipalForAuthUser` from a passkey
unlock) walks `wallet/auth-user → root_identity → kybe_id → polity_passport_records`. The module's
own header states it supersedes an older resolver
(`resolveClusterPrincipalForPersona`, removed 2026-08-15) that matched on `personas.root_did` — an
audit found that column is written correctly only by the Bureau path, and is a "disposable,
persona-level identifier" everywhere else (`services/identity/personaService.ts`,
`app/api/persona/create`, `app/api/identity/persona/create-with-fio`, `app/api/wallet/persona`, batch
imports). **This is the code documenting, in its own words, that most persona-creation paths do not
produce genuinely DIDQube-linked identities** — only the Bureau (Passport-issuing) path does.

**Agents get a parallel, deliberately kybe-free schema**
(`supabase/migrations/20260427000001_agent_did_schema.sql`): `agent_root_identity`,
`agent_environment`, `agent_persona`, with an explicit comment — "No Kybe DID — proof-of-personhood
is exclusively human." This matches the Upgrade Note §15.7's four-layer Aigent stack (no kybe layer)
exactly.

**The orphaned second implementation**: `services/agentiq-wallet/db/migrations/001_didqube_core.sql`
creates `CREATE SCHEMA didqube` with its own `didqube.person`, `didqube.root_did_bindings`,
`didqube.persona`, `didqube.persona_did_bindings`, `didqube.anon_aliases`,
`didqube.sessions_remote`. The only consumer is `services/agentiq-wallet/src/db/identity.ts`
(`resolveIdentityByDid`) — an isolated sub-package. Nothing in the main application reads
`didqube.*`. Its RLS policies are still the placeholder `USING (true) WITH CHECK (true)`, with a
trailing comment acknowledging this needs real owner-based policies "once JWT contains
person_id/tenant." **This is a second, competing "DIDQube" concept that never converged with the one
actually in use** — worth operator attention as dead weight or an unfinished migration, not
necessarily a live risk since nothing routes to it.

**File-path drift in the architecture doc itself**: `IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md`'s
"Engineering Implementation Notes" table cites `services/identity/didRegistrationService.ts` and
`services/identity/blakQubeService.ts` as canonical. Neither file exists in the repo today. FIO/Root-DID
logic instead lives across `services/identity/fioService.ts`, `services/identity/fioCache.ts`,
`services/wallet/personaFioService.ts`, and `services/passport/bureauIdentityService.ts`; blakQube
encryption is implemented per-qube-type (e.g. `services/iqube/financialProfileQube.ts`,
`services/iqube/experienceQube.ts`) rather than through one central service. The doc's conceptual
model (four layers, DVN-independent-of-minting, ICP anonymity) still matches the code's behavior —
only its specific file pointers are stale.

### 2.3 The kybe_DiD gap claim is out of date

The Upgrade Note's own §15.8 status ("schema-ready, application-stub... the application has just not
yet enforced or surfaced this binding") predates or was never reconciled with the current state:
`kybe_id` is the **primary binding key** for the entire Passport-native access system as of
`passportPrincipal.ts`. It is enforced in code (every principal-resolution entry point requires a
usable `kybe_id`), not merely present in schema. The doc should be updated — this is good news (the
gap it describes has substantially closed), but the doc itself doesn't reflect that yet.

---

## 3. Passport — Citizen vs Agent/Delegate

### 3.1 What the architecture/intent says

Neither architecture doc spells out a Citizen-vs-Agent Passport data model directly, but
CLAUDE.md's Identity & Access Spine section establishes the general principle this domain inherits:
strict T0/T1/T2 identifier tiering, and "your own admin/partner role checker" style warnings against
parallel implementations. The Upgrade Note's delegation model (§9) implies an agent Passport/credential
should be able to "mirror its owner's or client's identifiability policy" while remaining
root-accountable — i.e., a *bounded* credential, distinct from full citizen personhood.

### 3.2 What's actually in code

**One shared table pair, one discriminator column.** Both Citizen and Agent/Robot/Organization
Passports are rows in the same two tables:
- `polity_passport_applications` — the application/intake record
- `polity_passport_records` — the issued credential record

Both carry a `CHECK` constraint on `passport_class IN ('citizen', 'agent_participant',
'robot_participant', 'organization_participant')`. The migration
(`20260610000000_polity_passport_bureau.sql`) header states this as a deliberate choice: *"No new
IQubeType — passport records use `registry_record_type = 'polity_passport'` as metadata on existing
`registry_assets` rows."* There is no distinct `AgentQube` or `CitizenQube` type file.

**Structural role separation is real, just column-level, not table-level:**
- Citizen rows populate `citizen_status`; Agent/Robot/Organization rows populate `participant_status`
  (mutually exclusive per class).
- Only Citizen Passports carry a `kybe_identity_id` — agents are "root-id anchored and correctly
  carry no kybe" (`passportPrincipal.ts` comment, consistent with the "no Kybe DID for agents"
  design). This means `passport_class = 'citizen'` filtering in a query is a structural, not
  conventional, way to exclude agent credentials from principal (human) resolution — verified in
  `loadUsableCitizenPassportForAuthProfile()`, which filters `.eq('passport_class', 'citizen')`
  specifically so an agent's Passport can never satisfy a "does this human hold a sponsoring
  Passport" check.

**The routing UI** (`PassportBureauApplyTab.tsx`) maps `routeTo="citizen"` → `passportClass =
'citizen'` (steps: account → identity → private vault → consents → submit) and `routeTo="delegate"`
→ `passportClass = 'participant'` (steps: agent → consents → submit, skipping account/identity
entirely — an agent Passport application does not create a new human account). Despite the prop being
named `delegate`, the resulting `passport_class` is `agent_participant`, not a literal "delegate"
type — "delegate" here is UI/routing vocabulary, not a Passport class.

**Delegation is explicitly and forcefully kept separate from Passport issuance**, in the component's
own header comment:

> DELEGATION IS NOT PART OF THIS CEREMONY (semantic repair, 2026-08-25). Passport
> issuance/sponsorship and bounded-delegation grant issuance are constitutionally distinct acts
> with distinct receipts (`passport_issued` vs `agent_delegated`) — this component MUST NOT create a
> delegation grant.

The *actual* bounded-delegation grant model — an agent acting with authority *from* a specific human
— lives in `agent_persona` (`20260427000001_agent_did_schema.sql`): `delegation_user_root_id`,
`delegation_persona_id`, `max_identifiability`, `delegation_scopes` (jsonb). This is issued through a
different UI surface (`BoundedDelegationTab.tsx`) against a different endpoint
(`/api/codex/chat/agentiq-os/delegation`), named explicitly in `PassportBureauApplyTab.tsx`'s own
header as the constitutionally-separate path. **This confirms the architecture's Passport/delegation
distinction is not just documented policy — it is structurally enforced by using different tables,
different endpoints, and an explicit code comment forbidding conflation.**

**An automated exception exists**: `services/homecoming/issueDelegatePassport.ts` (the "Agent
Homecoming" / CFS-023 flow) programmatically builds and auto-approves an `agent_participant_passport`
application with the admin acting as the reviewing steward — bypassing the manual Bureau UI, but
still going through the same `polity_passport_records` table and the same `applyReviewDecision`
issuance path. Its header notes the W3C-VC credential download step remains a separate, manual step
not yet automated.

### 3.3 Credential signing is a documented stub

`services/passport/passportCredential.ts` builds a W3C-VC-shaped credential object, but the header
explicitly labels signing a "Phase A stub": HMAC-SHA256 only, and if the Bureau's HMAC secret env var
is unset, the code falls back to issuing a fully **unsigned** envelope with a runtime
`console.warn`. A "Phase C" asymmetric, publicly-verifiable signature scheme is named as future work,
not yet built. This matters for anyone treating an issued Passport credential as independently
verifiable outside the platform today — per the code's own admission, it currently is not, unless the
HMAC path is configured and a verifier trusts that shared secret.

---

## 4. T0/T1/T2 tier enforcement — spot checks

Per CLAUDE.md's Identity & Access Spine, `personaId`/`kybe_identity_id`/`root_identity_id`/raw
`did_uri` values are T0 (server-internal only); public refs/business identifiers are the T1/T2
surface.

**Clean examples found:**
- `POST /api/passport/identity/bind` — response contains only `alreadyBound`,
  `existingRootDidMapped`, `kybePublicRef`, `rootDidPublicRef`, `recoveryPolicy`. Inline comment:
  `// T0: personaId is intentionally NOT serialized`.
- `GET /api/passport/usable-status` — response is `{ ok: true, usable: boolean }` only. File header:
  "T1-safe: only a boolean leaves the server."
- No route inspected serializes the raw `kybe_identity_id`/`root_identity_id`/`did_persona_id`/
  `persona_id` FK columns — every route touching `polity_passport_records`/
  `polity_passport_applications` explicitly selects only public-ref columns.

**One tension found, not resolved either way in code:**
- `GET /api/polity-passport/wallet` serializes `passportId: record.passport_id` directly to the
  browser. This is the human-readable business key (e.g. `ppc-<hex>`, minted in
  `issuanceService.ts`), **not** the row's internal UUID primary key — so it is not the rawest
  possible identifier. However, `passportPrincipal.ts`'s own inline documentation names this exact
  column as something that "NEVER" leaves the server. `PassportBureauApplyTab.tsx` then consumes this
  client-visible value as `sponsorPassportId` and even renders it directly in an error message.
  CLAUDE.md documents an "Owner self-view exception" for exactly this shape of case (a self-view
  route returning the caller's *own* record's identifiers is a different exposure class than a
  cross-user leak) — this may be exactly that, since `/api/polity-passport/wallet` appears scoped to
  the caller's own Passports. But nothing in the code explicitly reconciles the "never" in
  `passportPrincipal.ts`'s comment with this route's actual behavior, so it reads as an
  unacknowledged inconsistency between two pieces of the codebase's own stated intent, worth an
  explicit operator ruling one way or the other rather than either fixing or leaving silently.

---

## 5. Explicitly-acknowledged gaps (found via TODO/stub/backlog markers)

These are gaps the code itself names, not inferred from absence:

| Area | File | What's missing |
|---|---|---|
| Agent identifiability clamping (Upgrade Note §6/§7) | `services/identity/getActivePersona.ts` | Extension point present, not implemented; comment: "delegation paths are not yet routine in production traffic; landing now would add regression risk against an untested path." |
| Passport credential signing | `services/passport/passportCredential.ts` | HMAC-only "Phase A stub"; falls back to unsigned if secret unset; asymmetric "Phase C" not built. |
| Cohort memberships on persona context | `services/identity/getActivePersona.ts` | "table not yet built (cohort backlog Phase 3 wire-up)." |
| Partner role flag | `services/identity/getActivePersona.ts` | "not yet a first-class platform concept; default false until the partner-roles table lands." |
| T1→T0 zero-knowledge session-token hardening | `services/identity/personaSessionToken.ts` | Documented as "Phase-2+ backlog item." |
| World ID / agent declaration checks in reputation | `services/identity/reputationService.ts` | `// Stub for World ID / agent declaration checks (Phase 2)`. |
| FIO handle caching | `services/identity/fioCache.ts` | "Stop-gap by design. Phase 2 hardening (Redis cache...)." |
| Passport locker Sui/Walrus storage | `services/passport/lockerStorage.ts` | Live `'sui-walrus'` mode's Move call explicitly throws "not yet implemented"; a `'stub'` mode exists alongside it. |
| External-agent admission evidence/standing | `services/passport/externalAgentAdmission.ts` | Marked extension point, not implemented. |
| `didqube.*` schema RLS | `services/agentiq-wallet/db/migrations/001_didqube_core.sql` | Placeholder `USING (true)` policies, pending real JWT-based ownership. |

---

## 6. Summary — intent vs implementation

| Architecture claim | Code reality |
|---|---|
| DIDQube is "the iQube representation of [the] Root DID" | No such object type exists; it's a label over `kybe_identity`/`root_identity`/`did_persona` tables |
| `did_registration_service` performs FIO+ICP registration | No such file; logic is split across `fioService.ts`, `bureauIdentityService.ts`, etc. |
| `blakQubeService.ts` centrally encrypts persona data | No such file; each qube type (financial profile, experience, etc.) implements its own blak encryption |
| kybe_DiD is "schema-ready, application-stub" | It's load-bearing in the live Passport-native access resolver — further along than documented |
| Citizen and Agent get distinct identity treatment | True, but via one shared table + a `passport_class` discriminator, not distinct data models |
| Delegation ("Aigent as delegate") mirrors owner identifiability policy | The *separation* between Passport and delegation is real and enforced; the identifiability-clamping mechanics themselves are an unimplemented extension point |
| T0 identifiers never cross to the browser | Mostly true and actively enforced by inline comments and route-level `.select()` discipline; one column (`passport_id` business key) is a documented-vs-observed exception worth an explicit ruling |
| Passport credentials are W3C-VC verifiable | Structurally yes; cryptographically, signing is an explicit HMAC "Phase A stub" today, not the intended asymmetric scheme |

---

## 7. Suggested next actions (not performed as part of this report)

1. Update `IQUBE_IDENTITY_SOVEREIGNTY_ARCHITECTURE.md`'s "Key files" table to point at the actual
   files (`fioService.ts`, `bureauIdentityService.ts`, per-qube blak encryption) instead of the
   nonexistent `didRegistrationService.ts`/`blakQubeService.ts`.
2. Update `AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` §15.8's kybe_DiD status — it undersells how far
   along the layer actually is.
3. Get an explicit operator ruling on the `polity_passport_records.passport_id` T0/T1 tension in §4 —
   either update `passportPrincipal.ts`'s comment to reflect an intentional owner-self-view exception,
   or tighten `/api/polity-passport/wallet`'s response shape to match the comment's stated intent.
4. Decide the fate of the orphaned `didqube` Postgres schema in `services/agentiq-wallet` — either
   converge it with the live `kybe_identity`/`root_identity` model, finish its RLS policies if it's
   meant to stay independent, or remove it if superseded.
5. When agent delegation traffic becomes routine (per `getActivePersona.ts`'s own stated
   precondition), revisit the identifiability-clamping extension point named in §5.
