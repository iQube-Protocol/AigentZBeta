# Polity Passport Bureau — Implementation Plan (reuse / extend / new)

**Date:** 2026-06-10
**PRD:** `2026-06-10_polity-passport-bureau-prd-v1.md` (operator-authored, authoritative)
**Status:** Plan reviewed in-session with operator. **Stage 0 delivered 2026-06-10:** the operator's v0.1 JSON Schema bundle is landed at `polity-passport-bureau/schemas/` (11 schemas + manifest + examples + README) with the vault, irrevocability, and reputation amendments applied cumulatively; per-class status enforcement is encoded in the credential schema and verified. T0 projection rules and v0.2 open items are documented in `polity-passport-bureau/README.md`. **Stage 1 delivered 2026-06-10:** operator approved all three §3 decisions as recommended; migration SQL (`20260610000000_polity_passport_bureau.sql`) landed with 6 tables, citizen irrevocability CHECK constraints, self-custody vault enforcement (no PII columns), per-class status machine enums, RLS policies; `ANCHORABLE_ACTION_TYPES` extended with 6 passport receipt types; status machine amended with `renewal_proof_of_aliveness` evidence type, `automatable` flag on participant transitions, and death-threshold/proof-of-aliveness/automation stubs; canary test suite (`tests/passport-bureau.test.ts`, 11 tests) + status machine suite (16 tests) all passing. **Stage 2 delivered 2026-06-10:** Bureau identity service (`services/passport/bureauIdentityService.ts`) — synthetic-email Supabase auth user creation (`<username>@passport.metame.internal`), username validation, KybeDID minting (`did:kybe:ppb:*`), persona + KybeDID bind flow with duplicate-check (one Bureau persona per account, idempotent re-bind) and existing-RootDID mapping (callers with a platform root identity keep it; existing KybeDID reused — one per human); routes `/api/passport/auth/signup`, `/api/passport/auth/check-username`, `/api/passport/identity/bind` (spine caller resolution via `getCallerIdentityContext`; T0-safe responses carry commitment refs only — no raw personaId/kybe_did/root did_uri in browser JSON); Addendum B recovery-policy stub on signup + bind responses; 7 new canary tests (helpers + T0-leak source assertions), 34 total passing. **Stage 3 server-side delivered 2026-06-10:** self-custody vault module (`services/passport/selfCustodyVault.ts` — client-side WebCrypto AES-256-GCM, PBKDF2-SHA256 310k iterations, versioned `PPBVAULT1` envelope, `buildSelfCustodyRef` pinning the Addendum A custody consts); ciphertext-only relay route `/api/passport/vault/upload` (refuses non-envelope bytes with 422 — no plaintext path; uploads to Auto Drive via `uploadFileFromBuffer`); CAPTCHA weak-proof interface (`services/passport/personhoodProof.ts` — Turnstile behind `TURNSTILE_SECRET_KEY`, fail-closed dev stub); citizen application submit route `/api/passport/applications/submit` (mandatory consent + 4 self-custody acknowledgements validation, weak proof, one-open-application guard, `passport_application_submitted` receipt through the canonical pipeline) + own-status route; `ActivityActionType` union + `activity_receipts` CHECK constraint extended with the 6 passport types (`20260610100000_passport_receipt_action_types.sql`); 8 new canary tests (vault round-trip, plaintext refusal, custody consts, route source canaries), 42 total passing. **Stage 3 remaining:** citizen application flow UI (tab components). **Stage 4 delivered 2026-06-10 (HTTP-first):** schema bundle served at `/api/polity-passport/schemas/[name]` (strict allowlist, manifest at `/schemas/index`); shared structural validator (`services/passport/participantApplicationValidator.ts` — ajv predates draft 2020-12, validator becomes a thin wrapper when upgraded); `/api/polity-passport/validate` (dry-run) + `/api/polity-passport/submit` (one-open-application-per-agent-card guard, `application_payload` jsonb for registry-listing-public participant material — citizen private data never lands there, signature recorded as `recorded_unverified` pending the v0.2 signed-JSON spec) + `/api/polity-passport/status/[id]` (public-safe projection, no identity refs); machine-submission receipts ride the Bureau system persona (`PASSPORT_BUREAU_SYSTEM_PERSONA_ID` env — escalation-logged skip when unset); migration `20260610200000_passport_application_payload.sql`; 4 new test groups, 46 total passing.
**Golden Rule compliance:** every layer below is classified as REUSED, EXTENDED, or NEW.

The most important grounding fact: the **iQube Registry operating plane** (PRD v1.0/v1.1, Stages 0–9 closed 2026-05-31) already provides most of the Bureau's chassis — intake pipeline, lifecycle state machine, mint saga, agent-legibility cards, `.well-known` discovery, DVN receipt blocks, trust scoring, and the standalone `iqube-registry` cartridge.

---

## 1. Reuse / Extend / New inventory

### REUSED as-is (no modification)

| Existing asset | Role in the Bureau |
|---|---|
| `services/registry/intakeService.ts`, `mintSaga.ts`, `persistence.ts`, `receiptEmitter.ts` | Registry write-through: application → pending registry record rides the existing intake → mint pipeline |
| `services/registry/lifecycle.ts` | State-machine *pattern* (validate/describe, side-effects in caller) — the passport status machine mirrors this design; it does not overload the 9-state iQube lifecycle |
| Identity spine: `getActivePersona`, `evaluateAccess`, `userOwnsAsset`, `personaFetch` | All Bureau auth/gating decisions; zero parallel resolvers |
| `app/api/persona/create` + `services/identity/personaService.ts` | Persona creation in the citizen flow (PRD §9 step 2) |
| `kybe_identity` table + `20260427000000_root_did_persona_binding.sql` | Schema anchor for KybeDID creation/binding — already joined into the persona view |
| DVN pipeline (`services/dvn/activityReceiptDvnPipeline.ts`) | Receipts for submission, registry writes, review decisions, status transitions — only the permitted `ANCHORABLE_ACTION_TYPES` extension |
| `app/.well-known/iqube-catalog/route.ts` pattern | Template for `/.well-known/polity-passport.json` and `/.well-known/agent-card.json` |
| `types/iqube/legibility.ts` + `services/iqube/legibility/` + `docs/iqube-agent-legibility-profile.md` | The agent-facing card/discovery layer the Bureau's Agent Card surfaces extend |
| RQH canister + `services/ops/idl/rqh.ts` + `services/identity/reputationService.ts` | Reputation reads for standing checks |
| Registry cartridge admin-tab queue pattern (canonization approval queue, registry PRD v1.1 §A.7) | The steward review dashboard is the same workflow shape |
| `buildCodexUrl()` + subTabs mirror pattern (cf. `knytOrderTabs()`) | Registry-tab-in-Bureau and Bureau-tab-in-AgentiQ-OS cross-surfacing |
| Storage adapters (`services/content/storageAdapter.ts`) — AutoDrive/Autonomys adapter | Transport for encrypted vault blobs (bytes only; encryption happens client-side before it ever sees them) |

### EXTENDED (existing file, new capability)

| Existing asset | Extension |
|---|---|
| `ANCHORABLE_ACTION_TYPES` | Add `passport_application_submitted`, `passport_issued`, `passport_status_changed`, `passport_revoked` (participant class only, per Addendum D), `passport_privilege_changed`, `passport_infraction_recorded` (the one permitted unilateral DVN change) |
| `ReputationService.checkTokenQubePolicy` | The stub says "World ID not integrated yet / Agent declaration not integrated yet" — this is the designed extension point for strong proof + agent declaration |
| Registry record types / projections (`services/registry/projections/public.ts`) | New `polity_passport` registry record type + public projection (public metadata only) |
| `data/codex-configs.ts` | New `polity-passport-bureau` cartridge definition (hand-curated, `-cartridge` pattern); new "Passports" tab on `iqube-registry`; deep-link tab in AgentiQ OS (V1) |
| `evaluateAccess` policy resolvers | New credential classes by **composition** (`polity-passport:<grade>`, `passport-steward`) — protected spine files untouched, extension-point pattern per CLAUDE.md |
| Persona/kybe flow | KybeDID issuance + duplicate-check + RootDID→KybeDID mapping flow on top of the existing dev-stub schema (PRD §9 step 3 note — first real `kybe_identity` application logic) |
| Test canaries (`tests/access-spine.test.ts` pattern) | New `tests/passport-bureau.test.ts` mirroring the T0-leak canary |

### NEW (no existing home)

| New build | Notes |
|---|---|
| **Self-custody blakQube vault client module** | Client-side WebCrypto (AES-256-GCM) encrypt-before-upload; holder-derived key; AutoDrive-only payload. `services/content/encryption.ts` is server-side envelope encryption and a protected file — explicitly NOT reused, by design. New module, e.g. `services/passport/selfCustodyVault.ts` + client util |
| **Bureau localized auth** | Username/password without mandatory email, isolated from metaMe sign-on (decision 1, §3) |
| **Passport status machines (two, per class)** | Per PRD Addendum D: a **citizen lifecycle machine** (`draft`→`active`→`renewal_due`→`expired_non_renewal`/`dormant`/`inactive_presumed`→`ceased_death_confirmed`/`superseded_by_reissue`; NO `revoked` state) and a separate **participant standing machine** (`draft`→…→`revoked`/`delisted`). Both as validate/describe modules mirroring `lifecycle.ts` |
| **Citizen privilege standing model** | Per Addendum D: `polity.passport.citizen-privilege-standing.v0.1` — privileges are restrictable/revocable while `passport_remains_valid: true`. Enforcement composes with `evaluateAccess` (privilege restriction = access-policy input, never passport-state change). Per Addendum E: privilege standing consults **RootDID-level** reputation through the persona (persona → RootDID → ReputationQube) — the Citizen Passport credential carries no reputation binding, and passport tables carry no citizen reputation columns. KybeDID-bound reputational classes (sanctions/AML flags) are a future separate primitive outside Bureau scope |
| **Citizen application flow UI** (tab components) | Guided steps 1–9; reuses `ConfirmDialog`, form primitives, design tokens |
| **Agent application machine surfaces** | `/polity-passport/submit\|validate\|status/{id}` API routes, JSON schemas, doctrine bundle endpoint, signed-JSON verification |
| **Steward review dashboard tab** | New tab; queue UI pattern copied from registry admin tab |
| **CAPTCHA weak-proof integration** | Nothing exists; smallest viable provider (e.g. Turnstile) behind an interface so strong-proof slots in later |
| **Doctrine layer content** | New pack `codexes/packs/polity-passport/` (markdown + JSON bundles); Bureau tabs render via existing markdown-tab machinery |
| **Reputation binding + infraction event records** | New tables + standing-status mapping; writes flow through receipt pipeline; RQH integration read-side first |
| **MCP server + A2A skills** (MVP-should) | No MCP server exists in this repo — net-new surface, sequenced after the plain HTTP API works |

---

## 2. Hard constraints (CLAUDE.md PARAMOUNT rules threading the PRD)

1. **T0 tier vs the PRD's draft schemas.** The application iQube drafts include `kybe_did_anchor` and `root_did_reference`. `rootDid` is T0 (server-only, never in browser JSON or receipts), and kybe is *more* confidential than Root DiD (DiDQube note §15.4). Amendment to propose against the guidance schemas: browser-bound and registry-bound objects carry **commitment hashes / opaque references** (the `hashPersonaRef` pattern); raw DIDs live only server-side. The registry record's `persona_reference` must be a T1/T2 derivative.
2. **Self-custody vault enforcement.** Supabase columns for passport tables only ever hold `content_id`, `content_hash`, flags, and refs; a CI/test gate (canary-style) asserts no PII-shaped fields exist in passport-table inserts.
3. **Spine-only gating.** Passport grade and steward role resolve via `cartridgeFlags`/credential classes through `evaluateAccess`; protected spine files extended by composition only.
4. **DVN receipts.** Every acceptance-criteria receipt rides the existing pipeline; no parallel receipt writer (registry PRD v1.1 §A.4 just deprecated parallel writers — none added back).

---

## 3. Operator decisions (all resolved 2026-06-10)

1. **Bureau localized auth mechanism — APPROVED AS RECOMMENDED.** Real Supabase auth user with a **synthetic email** (`<username>@passport.metame.internal`) + password, so Bureau personas flow through `getActivePersona` unchanged and no parallel auth gate exists; optional real email simply replaces the synthetic one for recovery.
2. **Passport primitive typing — APPROVED AS RECOMMENDED.** No new `IQubeType` — applications are DataQubes, agents are AigentQubes, with `registry_record_type: 'polity_passport'` carried as record metadata.
3. **Steward role source — APPROVED AS RECOMMENDED.** `admin-cartridge:polity-passport-bureau` grants via the existing per-cartridge admin credential class, with a distinct `passport-steward` class only if non-admin stewards are needed.

---

## 4. Stage plan (MVP = PRD §16 must-include)

| Stage | Delivers | PRD refs |
|---|---|---|
| **0 — Schema alignment** (gated on guidance schemas) | Reconcile operator schemas with registry-canonical types + T0 amendments; passport status machine spec | §11, §12, addenda |
| **1 — Data layer** | Migrations: `polity_passport_applications`, `polity_passport_records` (registry-linked; per-class status columns), `passport_citizen_privileges` (Addendum D privilege-standing), `passport_reputation_bindings`, `passport_infractions` (schema only for MVP); the two per-class status machine modules; anchorable action types (incl. `passport_privilege_changed`) | §11 + Addendum D, §12, Addendum C (schema only) |
| **2 — Identity & auth** | Bureau sign-on (per decision 1); persona + KybeDID create/bind flow incl. duplicate-check + existing-RootDID mapping; recovery-scope warnings | §5.1, §7.1, §8.1, §9 steps 2–3 |
| **3 — Citizen flow** | Application tab UI (steps 1–9), CAPTCHA weak proof, self-custody vault module (client-side encrypt → AutoDrive), application iQube + pending registry record + receipts; self-custody acknowledgements; recovery-policy metadata stub | §6.1, §9, §16, Addenda A–B |
| **4 — Agent flow (HTTP-first)** | JSON schemas served, `/polity-passport/submit\|validate\|status`, signed-JSON verification, agent iQube + application iQube + pending record, automated review checks | §6.3–6.5, §10 steps 1–6, §12.2 |
| **5 — Registry integration** | "Passports" tab on `iqube-registry` cartridge + mirrored into Bureau cartridge (subTabs pattern); public status page; public projection with zero private fields | §4.4, §11, §12.3 |
| **6 — Review & issuance** | Steward dashboard (queue pattern), status transitions with receipts, mandatory-steward-review categories, decision outcomes | §4.5, §10 steps 7–9, §14 |
| **7 — MVP-should** | `/llms.txt`, OpenAPI spec, `/.well-known/agent-card.json` + `polity-passport.json`, doctrine bundle download, World ID stub behind the `ReputationService` extension point, MCP read-only + submit tools | §13, §16 should |
| **Deferred** | Per PRD §16 can-defer + §17 V1 list; recovery V1–V4 path preserved by storing recovery-policy metadata from Stage 3 | §17, Addendum B |

"Being" services get a stubbed tab (own component, own route namespace) so extraction to a separate cartridge later is a config move, not a refactor (§15).

---

## 5. PRD review notes (flagged to operator)

- **Citizen irrevocability vs status model: RESOLVED by PRD Addendum D (2026-06-10).** Citizen passports have NO `revoked` state — they are irrevocable personhood recognition with lifecycle/continuity states only (`expired_non_renewal`, `dormant`, `inactive_presumed`, `ceased_death_confirmed`, `superseded_by_reissue`). Reputation consequences for citizens act exclusively on the separate privilege-standing object (`passport_citizen_privileges`), never on passport existence. Agent participant passports remain revocable (+ `delisted`). Two separate status enums, two separate state machines.
- **Email as passport data vs account data:** optional recovery email belongs to the *account* (Supabase auth), not the passport payload — so it never violates the "no personal email in Supabase as passport data" rule. UI copy makes that boundary explicit, matching the acknowledgement block.
- **Agent endpoint reachability checks** (§14.1) run server-side from Lambda; outbound network from the dev sandbox is blocked, so these get integration-tested on dev, not locally.
