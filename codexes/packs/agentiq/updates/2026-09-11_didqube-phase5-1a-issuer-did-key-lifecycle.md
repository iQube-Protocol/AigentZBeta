# DiDQube Phase 5 item 1 — Stable Issuer DID, Key-Authorization-at-Issuance-Time, Public Verification Endpoint

**Status: IMPLEMENTED (Phase 5.1a–5.1c code, 5.1d runbook), this session (2026-09-11), under
explicit operator ruling.** Executes the sub-plan scoped in
`2026-09-08_didqube-phase5-vc-verification-subplan.md` against the operator's two rulings on the
sub-plan's open decisions (issuer DID method; key lifecycle vs. credential lifecycle). Implementation
work — code, tests, and this runbook — was produced in an agent session under those rulings, not
authored by a human engineer by hand.

## 0. Preflight (Resolution → Invariant Loop)

Reviewed before writing any code:
- `RES-2026-09-07-DIDQUBE-PHASE-3-ASYMMETRIC-VC-SIGNING-001` — the signing/verification split this
  work extends. Its `unresolvedRisks` named exactly the gaps this session closes (stable issuer
  identity, key-rotation story).
- `2026-09-08_didqube-phase5-vc-verification-subplan.md` — the full scoping doc for this item; its
  five gaps and four phases are what this session implements.
- `CI-2026-09-07-PASSPORT-ID-PRIVACY-SENSITIVE-NOT-PUBLIC-001` — constrained the new public
  endpoint's response shape (see §4 below: `superseded` is a boolean, never the raw successor
  `passport_id`).
- `types/confidentialProjection.ts`'s `UNRESOLVED` precedent — the model for the new
  key-compromise-window outcome (§2 below): "not an error state — the honest representation of
  'cannot safely decide'."
- No prior resolution record or invariant conflicts with or is invalidated by this work; this is a
  direct, planned extension of RES-2026-09-07-DIDQUBE-PHASE-3-ASYMMETRIC-VC-SIGNING-001, not a
  parallel implementation.

## 1. Stable Bureau issuer DID (Phase 5.1a)

**Operator ruling (verbatim, condensed):** the Bureau issuer is `did:web`, on a canonical
Bureau-controlled domain, independent of dev/prod/region/host. Never derived from the request
hostname. Configured explicitly per environment via `PASSPORT_BUREAU_ISSUER_DID`. No default, no
host-derived fallback — an unconfigured environment fails closed.

- `services/passport/passportCredentialSigningProviders.ts::requireBureauIssuerDid()` — throws a
  named, explicit error when `PASSPORT_BUREAU_ISSUER_DID` is unset. Used by
  `passportCredential.ts::buildPassportCredential` for `issuer.id` on every NEW credential (signed or
  unsigned-stub — the issuer's identity is independent of whether a real signature exists).
- `tryResolveBureauIssuerDid()` — the non-throwing counterpart used by verification, which must never
  crash on missing config; it fails closed via its returned result instead.
- `host` (the live request host) remains in use ONLY for `credentialStatus.statusListUrl` — a
  legitimately environment-specific SERVICE endpoint, never the issuer's identity.
- Verification (`isRecognisedIssuerId` in `passportCredentialVerification.ts`) accepts EITHER the
  configured DID (exact match, new credentials) OR the legacy host-shaped suffix
  (`/.well-known/polity-passport`, old credentials) — an already-issued credential is never mutated or
  invalidated by this change.

**Example (placeholder) values only — never hardcoded as a fallback, never a real production
hostname:**

```
# dev
PASSPORT_BUREAU_ISSUER_DID=did:web:passport-dev.example.org

# prod (illustrative — the operator provisions the real value)
PASSPORT_BUREAU_ISSUER_DID=did:web:passport.example.org
```

## 2. Key lifecycle ≠ credential lifecycle (Phase 5.1a schema + verification wiring)

**Operator ruling (verbatim, condensed):** rotation retires a key from future issuance; it does not
erase the historical verification material for what it legitimately signed. A compromised key is
marked `compromisedAt` (a window start), not necessarily deleted. Credentials before the compromise
window remain verifiable; credentials during/after are `UNRESOLVED`, adjudicated by Bureau policy —
never auto-decided as valid or invalid by the verifier itself.

`SigningKeyRecord` (`passportCredentialSigningProviders.ts`) gained:

| Field | Meaning | Absent on a legacy entry means |
|---|---|---|
| `verificationMethodId` | `${issuerDid}#key-n` | informational only today (no second suite exists yet) |
| `suite` | explicit per-key suite (was only the one hardcoded `ED25519_SUITE` constant) | defaults to Ed25519 by construction |
| `validFrom` / `validUntil` | the key's own authorized signing window | **unrestricted** — see below |
| `revokedAt` | the key was formally taken out of service at this instant | never revoked |
| `compromisedAt` | start of a suspected-compromise window | never suspected compromised |

**Legacy-safe default, stated explicitly:** an entry carrying NONE of the four lifecycle fields
predates this scheme entirely and is treated as unrestricted (always authorized) — retroactively
imposing a validity window on a pre-existing key would break verification of credentials it already,
legitimately signed. This mirrors the existing legacy HMAC-stub verification branch's own
"never break an old code path" discipline. `revokedAt`/`compromisedAt` ARE effective the instant an
operator sets them, even on an otherwise-legacy entry — those two fields represent a deliberate
operator act, not a retroactive default.

`evaluateKeyAuthorizationAtTime(key, atIso)` decides ONLY whether `key` was authorized to sign at
`atIso` (the credential's own `proof.created` — the instant the signing act occurred, not the
underlying Passport row's original `issued_at`, which may predate a lazily-claimed credential
envelope by an arbitrary amount). Check order (mirrors the ruling's own stated model — "signing key
authorized at T" precedes "signature valid"):

1. **`revokedAt`** — `at >= revokedAt` → hard invalid (`key_revoked_before_issuance`). A key revoked
   AFTER `at` never retroactively invalidates an earlier, legitimate signing.
2. **`compromisedAt`** — `at >= compromisedAt` → `'UNRESOLVED'`
   (`key_signed_during_suspected_compromise_window`). Never auto-decided.
3. **`validFrom`/`validUntil`** — closed interval, BOTH bounds inclusive (`at === validFrom` and
   `at === validUntil` are both authorized). Legacy entries are unrestricted.

`passportCredentialVerification.ts`'s Ed25519 branch calls this BEFORE the cryptographic signature
check — exactly the ruling's own ordering (issuer DID valid at T → signing key authorized at T →
signature valid → credential status evaluated separately). `CredentialVerificationResult` gained a
third branch, `{ valid: 'UNRESOLVED', suite, keyId, reason }`, alongside the existing
`{valid:true}`/`{valid:false, reason}` — mirroring `types/confidentialProjection.ts`'s `UNRESOLVED`
precedent rather than overloading the boolean.

## 3. The three-layer model, in code

| Layer | Question | Function | DB access |
|---|---|---|---|
| Signature + key-authorization-at-issuance-time | Is this signature cryptographically valid, AND was the signing key authorized to sign at the moment it did? | `verifyPassportCredential` (`passportCredentialVerification.ts`) | None — deliberately DB-free, as before |
| Credential lifecycle (DB-backed) | Is the Passport this credential names currently revoked or superseded? | `verifyPassportCredentialWithLifecycle` (same file) | Facts supplied by the caller — this function itself stays DB-free too |
| Presentation decision | Should a relying party act on this credential right now? | `presentable` field on the lifecycle result (`signature.valid === true && !revoked`) | n/a — a derived boolean, not a separate query |

`supersededBy` is surfaced as a fact (the successor's `passport_id`, or `null`), never folded into
`presentable` — supersession is a policy question for the caller, never a hardcoded verifier opinion
(sub-plan Phase 5.1b, unchanged from the original scoping).

## 4. Public verification endpoint (Phase 5.1c)

`POST /api/polity-passport/verify-credential` — unauthenticated, mirrors
`verify/[type]`'s "external counsel/partners verify without spine auth" precedent. Rate-limited via
the existing `services/rateLimit/rateLimitService.ts` (`checkAndConsumeRateLimit`, key
`polity-passport:verify-credential`, scope `ip`) — the same reusable limiter `referral/resolve-code`
uses; fails open when unconfigured, exactly like every other caller.

**Request:**
```json
{ "credential": { /* the full W3C-VC-shaped envelope, as issued */ } }
```

**Response — outcome only, never the credential body:**
```json
{
  "ok": true,
  "valid": true,
  "suite": "PolityBureauEd25519Signature2026",
  "keyId": "bureau-key-2026-09",
  "revoked": false,
  "superseded": false,
  "presentable": true,
  "recordFound": true
}
```

`valid` is `true | false | "UNRESOLVED"`. On `false`, `reason` names the failure
(`unknown_issuer`, `unknown_key`, `key_not_yet_valid`, `key_expired`,
`key_revoked_before_issuance`, `signature_mismatch`, `unsigned_stub`, `legacy_secret_unavailable`,
`unknown_algorithm`, `malformed_proof`). On `'UNRESOLVED'`, `reason` is
`key_signed_during_suspected_compromise_window`.

**Deliberately, permanently never returned:** the full credential body; any T0 identifier
(`personaId`/`authProfileId`/`rootDid`/`kybeAttestation`); the raw successor `passport_id` — per
`CI-2026-09-07-PASSPORT-ID-PRIVACY-SENSITIVE-NOT-PUBLIC-001` (passport_id is holder-visible but
circulation-minimized, and must not enter an unauthenticated public projection), this endpoint
returns `superseded` as a **boolean** rather than the raw successor id, even though the more general
`verifyPassportCredentialWithLifecycle` composition function itself carries the raw `supersededBy`
string for callers that are themselves authenticated. This is a deliberate divergence from the
sub-plan's literal outcome-summary wording, made to respect a previously-established privacy
invariant — flagged here explicitly rather than silently decided.

## 5. Key-rotation runbook (Phase 5.1d)

**Routine rotation (no suspected compromise):**

1. Generate a new Ed25519 keypair (e.g. `openssl genpkey -algorithm ed25519`), extract the SPKI
   public key (base64, DER) and PKCS8 private key (base64, DER) — the same shapes
   `passportCredentialSigningProviders.ts` already expects.
2. Add the new key to `PASSPORT_BUREAU_SIGNING_KEYS_JSON` **before** touching
   `PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID` — never the reverse. This is unchanged from the original
   sub-plan and remains the load-bearing ordering: there must never be a window where the active key
   is not yet in the verification registry. Include `validFrom` (now, or the intended cutover instant)
   on the new entry.
3. Set `validUntil` on the OUTGOING key's registry entry to the same cutover instant (do not delete
   the entry — it must remain fully verifiable for everything it already signed).
4. Flip `PASSPORT_BUREAU_ACTIVE_SIGNING_KEY_ID` to the new key's `keyId`, and set
   `PASSPORT_BUREAU_ED25519_PRIVATE_KEY_B64` to the new private key.
5. Confirm: a credential issued just before cutover still verifies (signed by the old key, which
   remains in the registry with `validUntil` at the cutover instant — inclusive); a credential issued
   just after cutover verifies against the new key.

**Suspected compromise:**

1. **Do not delete the key's registry entry.** Set `compromisedAt` to the earliest instant the
   compromise could plausibly have started (err early — this is a window start, not a precise
   forensic timestamp).
2. Immediately rotate to a new key via the routine steps above, using the compromise instant (or
   sooner) as the outgoing key's `validUntil`.
3. Every credential whose `proof.created` falls at or after `compromisedAt` now verifies as
   `'UNRESOLVED'` (`key_signed_during_suspected_compromise_window`) — NOT automatically revoked and
   NOT automatically treated as still valid. This is the ruling's explicit, deliberate choice: the
   Bureau adjudicates each such credential (e.g. by cross-referencing other evidence of legitimate
   issuance during the window) rather than a verifier auto-deciding.
4. Credentials demonstrably issued before `compromisedAt` are unaffected and remain verifiable exactly
   as before.
5. Only set `revokedAt` (a HARD, not-adjudicated invalid for anything signed at-or-after it) once the
   Bureau has concluded a credential's provenance is definitively false — e.g. confirmed the key
   material itself was exfiltrated and used by an attacker at a known instant. `revokedAt` and
   `compromisedAt` can coexist on the same entry; `revokedAt` takes precedence when both apply at the
   same instant (see `evaluateKeyAuthorizationAtTime`'s check order).
6. Full removal of a registry entry (rather than `revokedAt`) remains available but is a harsher,
   rarely-needed end state — it makes every credential that key ever signed permanently unverifiable,
   including any the Bureau might otherwise have adjudicated as legitimate. Prefer `revokedAt`/
   `compromisedAt` unless there is a specific reason to erase the entry outright.

## 6. What Phase 5.1a deliberately does NOT change

- The `suite` field is schema-only in this pass — no second signing suite exists, so nothing yet
  dispatches on it. A future KMS/HSM-backed provider (still explicitly deferred, per
  `RES-2026-09-07-DIDQUBE-PHASE-3-ASYMMETRIC-VC-SIGNING-001`'s own rejected-approaches) is the point
  at which per-key suite dispatch becomes load-bearing.
- No already-issued credential is touched, mutated, or re-signed. The legacy host-shaped issuer-id
  check and the legacy HMAC-stub/unsigned-stub proof branches are unchanged.
- `verifyPassportCredential` remains DB-free; `verifyPassportCredentialWithLifecycle` remains DB-free
  too (it composes already-resolved facts, never queries the database itself) — the new public
  endpoint is what performs the DB reads and passes the results in.

## 7. Tracked test-fixture changes (per task instructions — not silent)

`buildPassportCredential`'s `issuer.id` now requires `PASSPORT_BUREAU_ISSUER_DID` unconditionally
(signed or unsigned-stub). Three pre-existing test files that call it without setting that env var
were updated to set a placeholder `did:web:passport.example.test` value for every test (a top-level
`beforeEach`/`afterEach`, or — where one already existed — folded into it):

- `tests/passport-credential.test.ts`
- `tests/passport-credential-signing.test.ts`
- `tests/passport-claim-ownership-boundary.test.ts` (the claim route calls `buildPassportCredential`
  internally)

No existing assertion's expected value changed in any of the three files — only test-environment
setup was added.

## 8. Governance

Resolution record: `RES-2026-09-11-DIDQUBE-PHASE5-1A-ISSUER-DID-KEY-LIFECYCLE-001`.
Candidate invariant: `CI-2026-09-11-KEY-LIFECYCLE-NOT-CREDENTIAL-LIFECYCLE-001` — status `candidate`,
not self-promoted, per the Resolution → Invariant Loop's ladder discipline.
Canary: `tests/passport-credential-signing.test.ts` (extended) +
`tests/polity-passport-verify-credential-endpoint.test.ts` (new).
