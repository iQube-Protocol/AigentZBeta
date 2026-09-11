# Pilot Treasury Authority — Thin Implementation (2026-07-30)

**Status: `PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE`.** Not the final constitutional
treasury security model — a deliberately thin, bounded gate to permit controlled testnet (and,
once its own separate ratification path exists, mainnet) pilot operation, subject to post-pilot
hardening. See the operator's ruling of 2026-07-30 (below) for the full reasoning.

**Review triggers** (record explicitly so this provisional profile is never silently treated as
permanent): pilot completion; public launch; material treasury-value increase; custody
architecture redesign; new compromise evidence.

---

## What this implements

The full authority chain the operator specified:

```text
valid passport/operator authority
∩ fresh operator mandate
∩ passcode confirmation
∩ Aigent Z execution signature       (the caller signs; the gate itself doesn't)
∩ required agentic co-signatory approval
∩ independent observer receipt
∩ policy and replay checks
```

### Pilot authority topology (BitCent specifically)

```text
sole human principal: Platform Operator
execution agent:      Aigent Z
required signatory:   Aigent Nakamoto        (ordinary treasury actions)
observer:              Aigent Kn0w1           (has provisioned wallet/agent-key infra; Aletheon does not yet)

constitutional-exception class:
required signatory:   Aletheon               (policy review, not wallet-adjacent)
observer:              Aigent Nakamoto
```

`aigent-z`, `aigent-nakamoto`, `aigent-kn0w1` are real, already-used agent identifiers
(`scripts/register-agent-keys.ts` et al.). `aletheon` is a NEW signatory identifier as of this
slice — Aletheon has an existing Agent Card (`app/api/agents/aletheon/route.ts`) but no prior
treasury role.

The transaction-class → signatory mapping is a FIXED policy table
(`TRANSACTION_CLASS_POLICY` in `services/treasury/pilotTreasuryAuthority.js`), not chosen by the
execution agent at call time — a mandate declares its `transactionClass` up front, and a
required-signatory refusal is never retried against the observer as a substitute (the
"no permissive-signer-shopping" invariant, structurally enforced: there is no code path that does
this, and `tests/pilot-treasury-authority.test.ts` proves it with a scenario where the observer
would itself have approved).

### The mandate

Bound fields (per operator instruction): action, asset, amount, source, destination, network,
agent, nonce, expiry, executionMode, expectedTxSummary, transactionClass. Auto-constructed by
`scripts/deploy-qct-bitcoin.js` from the run's own known values (issuance record tokenomics,
computed premine destination) — the operator is not asked to hand-author a mandate file for this
specific, well-known action. The full mandate is printed to the console before the passcode prompt,
so the operator reviews exactly what they are about to approve.

### Operator passcode

`TREASURY_OPERATOR_PASSCODE_HASH` / `TREASURY_OPERATOR_PASSCODE_SALT` (server-side only, see
`.env.example`) store a scrypt hash — never the plaintext. The CLI prompts for the passcode with
input masked (never echoed to the terminal), verifies via constant-time comparison
(`crypto.timingSafeEqual`), and never logs or persists the entered value. Binding to the specific
mandate is procedural for this single-process CLI (the mandate summary prints immediately before
the prompt, and the nonce is single-use) rather than a cryptographic HMAC-over-the-mandate-
commitment — a networked/API version (extension point, not built in this slice) should use a
proper server-issued challenge instead.

A failed passcode attempt does NOT consume the mandate's nonce (proven in
`tests/pilot-treasury-authority.test.ts`) — the operator can retry with the correct passcode. A
file-backed attempt ledger (`scripts/_lib/treasuryMandateLedger.js`,
`scripts/.treasury-mandate-ledger.json`, gitignored) locks out after 5 failed attempts within a
15-minute window, checked BEFORE the passcode prompt even runs.

### Replay and mandate-transaction match

The nonce is single-use, checked and (only on full success) consumed by
`services/treasury/pilotTreasuryAuthority.js`'s `authorizeTreasuryAction`. The whole gate runs
TWICE in `deploy-qct-bitcoin.js`: once early (mandate shape, expiry, replay, passcode, signatories)
— before waiting on a funded UTXO or building the real PSBT, so an unauthorised attempt fails fast
without touching key material beyond deriving the source address — and once again right before
broadcast, via `assertMandateMatchesTransaction`, comparing the mandate the operator approved
against the REAL built transaction's asset/amount/destination/network. A mismatch refuses even if
everything else already passed.

### Deterministic policy verifiers, not live agent calls

`verifyNakamotoApproval` / `verifyAletheonObservation` / `verifyKn0w1Observation` are deterministic
policy functions standing in for the named agents' roles — there is no runtime today that lets a
script synchronously invoke a live "Aigent Nakamoto" decision process. These are documented,
auditable stand-ins (a real refusal genuinely blocks execution: unratified issuance record, mainnet
without an explicit mainnet mandate, amount over a configured cap), not simulations that rubber-
stamp. Swapping in a live agent call later is the intended extension point; the module's
input/output contract should not need to change for that swap.

---

## Where this is wired

- `services/treasury/pilotTreasuryAuthority.js` — the canonical gate logic (mandate validation,
  passcode verification, signatory policy, mandate-transaction match). Plain CommonJS so
  `scripts/deploy-qct-bitcoin.js` (a plain `node`-invoked script) can `require()` it directly with
  no toolchain change; a future Next.js API route can `import` the same file.
- `scripts/_lib/treasuryMandateLedger.js` — the file-backed nonce/attempt ledger (atomic
  write-then-rename), named `_lib` not `lib` (a bare `lib/` `.gitignore` pattern matches any
  directory literally named `lib` at any depth — same collision already documented for the review
  capability's checkpoint store).
- `scripts/deploy-qct-bitcoin.js` — wired into the `--execute` path, in addition to (never
  replacing) the existing issuance-ratification gate and the "type yes" broadcast confirmation.
- `tests/pilot-treasury-authority.test.ts` — 27 tests: mandate shape/expiry/replay, mandate-vs-tx
  match, signatory policy (including the no-permissive-fallback proof), passcode verification
  (correct/incorrect/unconfigured, one-way), the full `authorizeTreasuryAction` chain (positive
  path, failed-attempt-doesn't-burn-the-nonce, mismatch-after-signatories-pass), and the file-backed
  lockout ledger.

Full suite: 188 files / 3390 tests, green.

## Explicitly NOT done in this slice (operator-directed scope)

- World ID, passkeys, HSM/threshold custody, full process isolation, final treasury constitution —
  none of these block the pilot; this thin gate is what "ample" looks like for now.
- `app/api/a2a/signer/transfer/route.ts` — the live, currently-unauthenticated EVM transfer
  endpoint — is NOT yet gated by this mechanism. That is separate, larger work (needs a durable,
  cross-invocation nonce store since a serverless route has no local filesystem state across
  requests, unlike this CLI) and is tracked as a follow-up, not silently deferred.
- Mainnet: `deploy-qct-bitcoin.js` still refuses `--mainnet` unconditionally, ahead of every other
  check (unchanged by this slice) — mainnet needs its own separate ratification path before this
  gate is even relevant there.
- No wallet rotation, no fund movement, no live broadcast has occurred as part of this work.

## Operator's ruling (recorded verbatim in substance, 2026-07-30)

> Speed is the key right now... The main thing right now is to just get this stood up to be able
> to progress with these pilots, and to get Bitcoin sent minted... adding an agentic signer for
> [Nakamoto]... and adding an observer is ample... This is a pilot setup... we want to position
> this that this is a service, a space that we will review to establish what the right
> constitutional balance between convenience, security, and operations need to look like going
> forward. And that's not going to be a fixed thing.

> Do not block the pilot on World ID; passkeys; HSM or threshold custody; complete key rotation;
> full process isolation; final treasury constitution. Preserve extension points, but do not expand
> this slice into a full custody programme.

> Do not broadcast Mainnet as part of implementation unless the operator separately authorises the
> final transaction.
