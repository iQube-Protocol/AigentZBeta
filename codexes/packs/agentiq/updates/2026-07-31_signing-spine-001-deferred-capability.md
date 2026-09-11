# SIGNING-SPINE-001 — Unified Constitutional Signing Boundary (Deferred)

**Status: recorded, deferred. Not a prerequisite for GJR-VFY-001 Phase 1 (operator ruling 2026-07-31).**

## Why this doc exists

GJR-VFY-001's Phase 1 audit (`2026-07-31_gjr-vfy-001-gjr-mkt-001-specifications.md`'s
source-grounded audit) found wallet signing fragmented across four disparate paths with no
unified custody/signing boundary:

1. `services/identity/agentKeyService.ts` / `.v2.ts` — custodies agent keys (`agent_keys` table)
   but has **no signing method** of its own; it hands the decrypted private key back to its
   caller as plaintext.
2. `services/wallet/keyService.ts` + `services/wallet/personaPaymentService.ts` +
   `services/wallet/sessionService.ts` — password/session-derived persona wallet signing.
3. `services/identity/polityIssuer.ts` — env-keyed Passport Bureau issuer signer.
4. `scripts/register-moneypenny-horizen.ts` — env var → in-process `ethers.Wallet` → sign →
   discard, a one-off CLI pattern.

The operator's explicit ruling: **fixing this is probably necessary later, but it is not a
prerequisite for the first real Horizen authorization** — unifying all four would turn
GJR-VFY-001 into a wallet-architecture rewrite and delay the pilot substantially. Phase 1 instead
built a narrow, bounded exception: `services/signing/partnerAuthorizationSigner.ts` is the one new
caller of `agentKeyService.getAgentKeys()` that stops the plaintext leak at its own boundary — the
resolved key lives only inside its local `ethers.Wallet` instance and never crosses back out. It
does **not** touch or refactor any of the four existing paths above.

## What SIGNING-SPINE-001 would consolidate, later

- `agentKeyService.ts` / `.v2.ts` — give the custody store its own bounded signing method instead
  of returning plaintext to every caller.
- Persona payment signing (`keyService.ts`, `personaPaymentService.ts`, `sessionService.ts`).
- Passport Bureau issuer signing (`polityIssuer.ts`).
- CLI/env-key signing (`register-moneypenny-horizen.ts` and its siblings).
- Key rotation across all four paths under one policy.
- Hardware / external wallet support.
- Audit and receipt uniformity for every signing act, regardless of which path produced it.

## What is NOT deferred

`services/signing/partnerAuthorizationSigner.ts` (GJR-VFY-001 Phase 1, shipped this pass) is real,
narrowly-scoped, purpose-bound partner-authorization signing — not a stand-in for
SIGNING-SPINE-001. It exposes exactly one operation,
`signPartnerAuthorization({ keyRef, payload, purpose, expectedSigner, network, expiresAt })`,
returning `{ signature, signerAddress, payloadHash, signedAt }` and never the private key. It is
the only caller of `agentKeyService` this phase adds; every other existing signing caller is
unchanged.

## When to pick this up

When a second partner-authorization flow, a second signing consumer of `agentKeyService`, or an
operator-flagged incident (plaintext key exposure, inconsistent audit trail across signing paths)
makes the fragmentation itself the blocking problem — not before. Until then, this doc is the
record that the fragmentation was found, understood, and deliberately left alone in favor of
shipping the Horizen transparency authorization capability first.
