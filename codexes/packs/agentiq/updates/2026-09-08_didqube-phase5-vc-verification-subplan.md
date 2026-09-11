# DiDQube Phase 5 Item 1 — Public Asymmetric VC Verification: Scoping Sub-Plan

**Status: SCOPING ONLY. No cryptographic subsystem work is implemented by this document.** Per the
execution plan (`2026-09-07_didqube-canonical-resolver-execution-plan.md`, Phase 5 item 1): *"this is
a real cryptographic subsystem, not a schema change; treat it as its own sub-plan with its own
review, not a checklist line."* This document is that sub-plan — a concrete, phased execution plan
grounded in what already exists in this repo, so a future session can execute without re-deriving
the design. It does not implement any of the phases below.

## 0. What already exists (do not re-derive; extend)

Phase 3 item 5 (2026-09-07, `RES-2026-09-07-DIDQUBE-PHASE-3-ASYMMETRIC-VC-SIGNING-001`) already
shipped a real, working asymmetric signing/verification split, built to mirror the swappable-provider
seam in `services/constitutional/agreementProviders.ts`:

| Concern | File | State |
|---|---|---|
| Credential envelope (what gets signed) | `services/passport/passportCredential.ts` | Implemented — `buildPassportCredential`, class-sensitive subject (`resolveCredentialSubjectId`) |
| Canonical serialization | `services/passport/passportCredentialSigningProviders.ts::canonicalizeCredentialPayload` | Implemented — recursive key-sort, deterministic, arrays keep position |
| Signing | `services/passport/passportCredentialSigningProviders.ts::signCredentialPayload` | Implemented — Ed25519 via Node's native `crypto`, suite `PolityBureauEd25519Signature2026`, env-configured active key (`PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID` + `PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64`) |
| Verification | `services/passport/passportCredentialVerification.ts::verifyPassportCredential` | Implemented — dispatches on `proof.type`; handles the new Ed25519 suite, the legacy `PolityBureauHmacStub/v0` (verified with the ORIGINAL non-canonical serialization, never "fixed"), and `PolityBureauUnsignedStub/v0` (never valid) |
| Known-keys registry | `services/passport/passportCredentialSigningProviders.ts::loadKnownSigningKeys` | Implemented — `PASSPORT_BUREAU_SIGNING_KEYS_JSON` env var, `{keyId, publicKeyB64}[]`; a rotated-out key stays in the registry (verifiable) even after a new active key is configured |
| Successor/renewal | `services/passport/issuanceService.ts::issueSuccessorPassport` | Implemented — `renewal_of_passport_id` column, never mutates the prior row |
| Tamper-evidence tests | `tests/passport-credential-signing.test.ts` (23 tests) | Implemented — subject/claim/time/predecessor-ref/proof-metadata tamper detection, fail-closed reasons, canonicalization determinism |

**What this sub-plan is therefore NOT starting from zero on.** The remaining gap is narrower than
"build asymmetric VC verification" — it is specifically the five items the execution plan named as
still missing: a stable Bureau issuer DID, a versioned verification method, a PUBLIC verification
endpoint, revocation/supersession resolution wired into verification, and a documented key-rotation
procedure. Each is scoped below as its own phase.

## 1. The five gaps, verified against the current code (2026-09-08)

1. **No stable Bureau issuer DID.** `passportCredential.ts` sets `credentialSubject`'s issuer via
   `record.issuer_id`, and `passportCredentialVerification.ts`'s own check
   (`EXPECTED_ISSUER_ID_SUFFIX = '/.well-known/polity-passport'`) only requires `issuer.id` to be a
   URL-shaped string ENDING in that path — it is host-dependent (`https://<current-host>/.well-known/
   polity-passport`), not a `did:...` URI. A domain change (dev-beta → production, or a future
   multi-region Bureau) would change every future credential's issuer id, and there is no
   currently-defined DID method or identifier that is stable across hosts.
2. **No versioned verification method.** The known-keys registry (`loadKnownSigningKeys`) is a flat
   `{keyId, publicKeyB64}[]` list with no `verificationMethod` shape (no `id`/`type`/`controller`
   triple, no explicit suite-to-key-type binding beyond the one hardcoded `ED25519_SUITE` constant).
   Adding a second suite (e.g. a future KMS-backed provider using a different curve) has no place to
   declare which verification-method version it uses.
3. **No public verification endpoint.** Confirmed by grep: `verifyPassportCredential` has zero
   callers anywhere in `app/api/` — no route exposes it. `app/api/polity-passport/verify/[type]/route.ts`
   is a DIFFERENT subsystem entirely (ProveKit ZK proof verification for attestation types), not VC
   signature verification. External counsel/partners/relying parties have no way to independently
   verify an issued Passport credential today.
4. **Revocation/supersession is not consulted by verification.** Confirmed by grep: `revoked` and
   `renewal_of_passport_id` do not appear anywhere in `passportCredentialVerification.ts`.
   `verifyPassportCredential` answers ONLY "is this signature cryptographically valid over this
   payload" — it has no DB access and cannot know whether the passport row backing the credential has
   since been revoked or superseded by `issueSuccessorPassport`. A verifier calling only the crypto
   check today would report a revoked or superseded credential as "valid."
5. **No documented key-rotation procedure.** The mechanism (leave a rotated-out key in
   `PASSPORT_BUREAU_SIGNING_KEYS_JSON`, point `PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID` at a new one) is
   real and already correct in code, but there is no runbook for HOW an operator actually rotates a
   key in production (generation, where the private key material is stored/injected, the order of
   env-var updates across Amplify environments, and how a compromise is handled — full removal from
   the registry vs. a "revoked-key" marker that still names the key for historical audit).

## 2. Phased execution (each phase independently shippable, mirrors the main plan's own gating style)

### Phase 5.1a — Stable Bureau issuer DID + versioned verification method (schema/config only)

- Mint one `did:web:<bureau-host>` (or an equivalent stable scheme — **do not guess the method
  without operator input**; `did:web` is the natural fit given the existing `/.well-known/`
  convention already in `EXPECTED_ISSUER_ID_SUFFIX`, but the exact DID method is an operator decision,
  not an implementation detail to invent silently) as the Bureau's canonical issuer identifier,
  independent of which host happens to serve a request.
- Extend `SigningKeyRecord` with a `verificationMethodId` (e.g. `${issuerDid}#key-<n>`) and a
  `suite` field (already implicit via `ED25519_SUITE`, made explicit per-key so a second suite can
  coexist).
- `passportCredential.ts`'s `issuer.id` becomes the stable DID, never the live request host.
- `passportCredentialVerification.ts`'s `EXPECTED_ISSUER_ID_SUFFIX` check is replaced by an exact
  match against the configured issuer DID (fail closed on mismatch, exactly as today).
- **This phase does NOT touch already-issued credentials** — Phase 3's own discipline (never mutate
  an issued credential) applies here too; a credential issued under the old host-shaped issuer id
  verifies under the LEGACY check path (kept, never deleted, exactly like the HMAC-stub legacy path),
  while new issuance uses the new stable DID.

### Phase 5.1b — Revocation/supersession resolution wired into verification

- New `verifyPassportCredentialWithLifecycle(credential, passportRow)` (or an equivalent composed
  function — naming TBD at implementation time) that calls the existing, unchanged
  `verifyPassportCredential` FIRST (signature validity is orthogonal to lifecycle state and must
  remain a separately callable, independently testable check — never merge the two into one function
  that can't answer "is the signature itself valid" alone), then separately reports:
  - `revoked: boolean` (from the passport row's own `revoked` column),
  - `supersededBy: string | null` (the passport that named THIS one via `renewal_of_passport_id`, if
    any — the reverse direction of the successor link),
  - the combined `presentable: boolean` a relying party should actually act on (valid signature AND
    not revoked; a superseded-but-not-revoked credential is a policy question for the caller, not a
    hardcoded verifier opinion, so surface it as a fact rather than folding it into `presentable`
    silently).
- No schema change needed — `revoked` and `renewal_of_passport_id` already exist on
  `polity_passport_records`.

### Phase 5.1c — Public verification endpoint

- New `POST /api/polity-passport/verify-credential` (or `GET` with the credential as a query param if
  size permits — implementation-time decision), unauthenticated (mirrors `verify/[type]`'s own
  "external counsel/partners verify without spine auth" precedent), calling
  `verifyPassportCredentialWithLifecycle` from 5.1b.
- Response is T1/T2-safe by construction: it echoes back only the verification OUTCOME (valid/invalid/
  revoked/superseded + suite + keyId) — never re-serializes the full credential body, and per the
  existing Gated Content / HMS Identifier Isolation discipline, never includes any T0 identifier the
  credential itself might carry.
- Rate-limiting/abuse-prevention for a public, unauthenticated endpoint is an implementation-time
  concern to size against this repo's existing public-route patterns (e.g. `verify/[type]`'s own
  CORS/no-store headers) — not invented fresh here.

### Phase 5.1d — Key-rotation runbook (operator-facing, not code)

- A short operator runbook (in `codexes/packs/agentiq/updates/`, cross-referenced from this doc)
  covering: generating a new Ed25519 keypair, the exact env-var update sequence across Amplify
  branches (add the new key to `PASSPORT_BUREAU_SIGNING_KEYS_JSON` BEFORE flipping
  `PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID`, never the reverse, so there is never a window where the
  active key is not yet in the verification registry), and the two distinct end-states for an old key
  (rotated-out-but-still-verifiable vs. fully removed/revoked, and what "revoked" means for
  credentials it already signed — they become permanently unverifiable, which is a real, disclosed
  consequence, not a silent one).
- No code required beyond what 5.1a already adds (multiple keys in the registry already works
  today) — this phase is documentation + an operator decision on the revocation policy.

## 3. What this sub-plan deliberately does not decide

- The exact DID method for the Bureau issuer (`did:web` is the natural fit but is an operator
  decision — CLAUDE.md's No-Guessing rule).
- Whether a compromised key is fully removed from the registry (making its historical credentials
  permanently unverifiable) or flagged `revoked` while remaining resolvable for audit — an operator
  policy choice, not an implementation detail.
- Whether a future KMS/HSM-backed signing provider is ever built — Phase 3's own text already
  deferred this ("not built here; no real KMS credentials exist to wire"), unchanged by this sub-plan.

## 4. Relationship to the rest of Phase 5

Per the execution plan, Phase 5 item 2 (verify zero remaining authoritative `personas.root_did`
reads) and item 3 (retire legacy fields) are independent of this sub-plan and are not blocked by it,
nor does this sub-plan block on them. This document covers Phase 5 item 1 only.
