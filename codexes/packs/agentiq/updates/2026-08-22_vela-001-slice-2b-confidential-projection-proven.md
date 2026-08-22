# VELA-001 Slice 2B — Confidential Consequence Projection proven live

**Date:** 2026-08-22
**Workstream:** VELA-001 — MoneyPenny × Vela: Confidential Constitutional Execution
**Status:** Slice 2A closed at `VELA_LOCAL_READY`. Slice 2B closed — all three dispositions proven against a real enclave-executed WASM module.

## The four standing rulings (operator-ratified 2026-08-22)

These now hold in code, with canaries, not just in prose:

1. **No new MoneyPenny custody surface.** MoneyPenny participates in Vela with its existing wallet key. But the same underlying key participating *technically* is not the same *constitutional role* — so `ConfidentialProjectionIdentitySet` carries five distinct fields (`authorityPrincipal`, `mandateSigner`, `confidentialRequester`, `confidentialPrivacyIdentity`, `executionSigner`) even though three resolve to one address today.
2. **Vela confidentiality is bounded, not total transaction privacy.** *"Vela protects confidential application state and computation; it does not make every surrounding transaction primitive private."* Recorded as the standing claim boundary at the top of `VELA-PRIVACY-BOUNDARY-001`.
3. **Local execution is not production TEE attestation.** `LOCAL_PROTOCOL_PROVEN`, `LOCAL_EXECUTION_PROVEN` and `PRODUCTION_TEE_ATTESTATION_PROVEN` are permanently distinct. No amount of successful local execution promotes the third.
4. **CFS-006a composes with, is not replaced by, `ConsequenceProjection`.** CFS-006a keeps contributing `projection.public`; the Vela provider contributes `projection.confidential`; the constitutional runtime composes them and derives the disposition.

## What was built

| Layer | File | Role |
|---|---|---|
| Domain seam | `types/confidentialProjection.ts` | The domain's *entire* vocabulary for confidential projection. Provider-neutral: no Vela opcodes, subgraph internals, ProcessorEndpoint details, P-521 mechanics or WASM concepts. |
| Commerce ontology | `types/constitutionalCommerce.ts` | PRD §8 types. `ActionAuthorisation.status` gained `UNRESOLVED` (§8's snippet omitted it; §20/§31 require it — a fail-closed architecture needs an honest representation of "cannot safely decide"). |
| Wire types | `services/vela/velaTypes.ts` | Vela-only shapes + the narrow `VelaTransport` contract. |
| Provider | `services/vela/velaProjectionProvider.ts` | The constitutional boundary. The only module consuming both layers. |
| Live transport | `services/vela/velaClientAdapter.ts` | Real `submitRequest`, log observation, `stateUpdate` calldata decode, and crypto matching `cipher.go` exactly. |
| Confidential workload | `services/vela/wasm/projector/` | The MoneyPenny Confidential Consequence Projector (TinyGo 0.39.0). |
| CI canaries | `tests/vela-confidential-projection-provider.test.ts` | 28 tests, no Docker needed. |
| Projector canaries | `services/vela/wasm/projector/app/app_test.go` | Verdict-surface and fail-closed guards. |
| Live proof | `scripts/vela-slice2b-live-projection.ts` | The real end-to-end run. |

## The live proof

Local stack, `applicationId 2089125378143059424`, projector WASM sha256 `b287b7e838d172d2acb196f248dc1d6a35ee70d4450ef88ca3dd11c83bd81c1c`:

```
prepare → encrypt → submit → observe → retrieve → verify

ACCEPTABLE               spend 500 ≤ limit 1000, exposure 2000+500 ≤ risk 5000   ✓
UNACCEPTABLE (spend)     spend 4000 > private spend limit 1000                   ✓
UNACCEPTABLE (risk)      within spend limit, but 4800+500 > risk limit 5000      ✓
UNRESOLVED               privateSpendLimit absent — fails closed                  ✓

4/4 — protocolExecutionVerified=true, teeAttestationVerified=false throughout
```

## Three findings that changed the design

**The reference payment app could not have proven this.** It signals "insufficient balance" via an app *Error*, which the platform marks as a failed request. That is indistinguishable from "the enclave broke". So the projector was built to return **UNACCEPTABLE as a successful result carrying a verdict** — an unacceptable projection is a valid constitutional outcome, not a system failure. This is why a purpose-built workload was necessary rather than reusing the sample.

**The verdict event is the leak surface.** Because the conclusion leaves the confidential environment through an observable event, the projector emits exactly one field (`{"verdict":...}`) as an *encrypted `PlainEvent`*, never a plaintext `AppEvent`. `app_test.go` fails the build if the verdict event ever carries more than one field or names an operand.

**An absent limit must never read as "no limit".** Missing inputs project `UNRESOLVED`, never `ACCEPTABLE`. Zero is a *real* limit (it forbids all spending) and is kept distinct from absent via pointer fields. Overflow-scale inputs fail closed rather than wrapping into a small number that would read as acceptable.

Two incidental confirmations from the run: an "insufficient fuel" failure correctly surfaced as `UNRESOLVED`/`FAILED` rather than `UNACCEPTABLE` (the fail-closed path, validated by accident before it was validated on purpose); and the ECDH/HKDF/AES-GCM implementation interoperates with the Go enclave on the first correct attempt once `hkdf.New(sha256.New, secret, nil, nil)` was read from source rather than assumed.

## Still not proven

`PRODUCTION_TEE_ATTESTATION_PROVEN`. The local stack runs `NoAttestationTeeAuthenticator` with `TEE_NO_ATTESTATION=true`; the registered TEE signer is set by admin fiat with no attestation proof. Real Nitro attestation requires Horizen-provisioned infrastructure and is tracked for `VELA_EARLY_ACCESS_HANDOFF.md`.

## Links

- `docs/vela/VELA-SIGNER-TOPOLOGY-001.md`
- `docs/vela/VELA-PRIVACY-BOUNDARY-001.md` (standing claim boundary at the top)
- `docs/vela/VELA-ATTESTATION-BOUNDARY-001.md`
- `docs/vela/CONSEQUENCE-ONTOLOGY-001.md`
- Prior session doc: `2026-08-22_vela-001-signer-privacy-attestation-findings.md`

## Next

Slice 2E (Unified Consequence Projection — compose `projection.public` from CFS-006a's `forecastConsequences()` with `projection.confidential` from the provider), then Slice 2F (MoneyPenny's `CONFIDENTIAL_CONSEQUENCE_PROJECTION` capability, attached to the existing `invocationGateway.ts` Gate 2 refusal point rather than a parallel invocation system).
