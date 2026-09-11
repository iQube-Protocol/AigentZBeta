# Bankr live-activation runbook

**Date:** 2026-09-06
**Status:** Prep complete (code side); execution gated on real Bankr credentials the operator must supply.

## What this closes

Per the operator's decision to bring Bankr out of simulation now (Vela stays simulated pending
Horizen's live TEE early access — separate, unrelated blocker). This runbook is the exact sequence
to go from "simulated-only" to "operational", plus what's needed from Bankr directly for the one
gap credentials alone don't close (fee-claim inspection).

## Done in this pass (code/config — no live credentials touched)

- `scripts/create-env-production.js` — added `BANKR_READ_ONLY_API_KEY`, `BANKR_WRITE_API_KEY`,
  `BANKR_WALLET_API_KEY`, and the optional overrides (`BANKR_API_BASE_URL`, `BANKR_TIMEOUT_MS`,
  `BANKR_MAX_RETRIES`, `BANKR_RETRY_BACKOFF_MS`, `BANKR_IP_ALLOWLIST`) to the Amplify env allowlist —
  this is the ONE code change required. `createBankrProviderAdapter()`
  (`services/financialServices/providers/bankr/bankrProviderAdapter.ts`) already auto-selects the
  real `BankrLiveTransport` the instant any key is present in `process.env`; nothing else needs to
  change.

Nothing else was touched. No live call was made, no credential was fabricated, no status was
flipped — per CLAUDE.md's "no guessing / never invent successful provider verification" rule, the
remaining steps genuinely require real Bankr credentials this environment does not have.

## Step 0 — operator-only, outside this repo

1. Obtain real Bankr Partner API credentials. Minimum for a meaningful go-live: a **read-only key**
   (quotes/capabilities/status). To actually submit a launch: also a **write key**. A **wallet key**
   is only needed if Factor should read an agent's linked Bankr wallet balance.
2. Confirm the current Partner API base URL with Bankr (code defaults to `https://api.bankr.bot` —
   worth a direct confirmation before relying on it).
3. Set the real values in Amplify's environment configuration for the target branch — **dev first**,
   never production first. Use exactly the variable names added to the allowlist above.

## Step 1 — read-only key rehearsal (dev)

Once `BANKR_READ_ONLY_API_KEY` is set in dev and a build has picked it up, run the existing rehearsal
script (`scripts/bankr-live-rehearsal.mjs`, already built — Phase 9) against dev with a **real
Supabase JWT** for an authenticated operator persona:

```bash
JWT=<supabase-jwt-for-a-real-operator-persona> node scripts/bankr-live-rehearsal.mjs \
  --host dev-beta.aigentz.me \
  --beneficiaryAgentRuntimeId aigent-factor \
  --preparingAgentRuntimeId aigent-factor \
  --requestedByAgentRef aigent-factor \
  --chain base \
  --tokenName "Rehearsal Token" \
  --tokenSymbol RHRSL \
  --feeRecipient <a-real-wallet-address-you-control> \
  --tenantId default \
  --provision-binding
```

This drives readiness → prepare → preflight → Aegis referral/ratify → request-approval, then STOPS
and prints the human-approval package — it never submits, signs, or broadcasts (there is no flag for
that; the script structurally cannot reach it). Confirm the printed readiness block shows
`bankrConfigured: true` and the preflight's `bankrTerms.raw.simulated` is `false` — that's the proof
the quote came back from the real Bankr API, not the fake transport.

## Step 2 — write key rehearsal (dev)

Set `BANKR_WRITE_API_KEY` in dev, re-run the SAME command above. This proves the write key resolves
and is accepted for the calls that need it (still never reaches submit — the script has no path
there).

## Step 3 — one deliberate, human-supervised real submission

Only after steps 1-2 both look correct. After the rehearsal reaches `approval_pending`, a real
accountable operator (not this session, not automated) calls, in order:

```bash
curl -X POST "https://dev-beta.aigentz.me/api/moneypenny/factor/bankr/launches/<launchId>/approve" \
  -H "authorization: Bearer <same JWT>" -H "content-type: application/json" \
  -d '{"tenantId":"default"}'

curl -X POST "https://dev-beta.aigentz.me/api/moneypenny/factor/bankr/launches/<launchId>/action" \
  -H "authorization: Bearer <same JWT>" -H "content-type: application/json" \
  -d '{"action":"submit","tenantId":"default"}'
```

Approval freezes `spec_hash`/`approval_hash` from the launch's current state — any change before this
point re-requires approval (drift protection, already built). Submission is the ONE call that
reaches Bankr's write API and genuinely creates a real token — do this once, deliberately, for a
real launch you actually intend, not as a smoke test with throwaway values.

## Step 4 — manifest status flip (only after Step 3 actually succeeds)

Once a real submission has actually gone through, update
`services/factor/factorCapabilityManifest.ts`'s `bankr_tokenization` capability: change
`status: "partial"` to `status: "operational"` and update its `description`/`boundaries` text to
drop the "no live BANKR_*_API_KEY is configured" language. This is a one-line, honest change made
AFTER the fact — never flipped in anticipation of credentials that haven't been verified live yet.

## What going live does NOT fix

Fee-claim inspection (`inspectFeeClaims`,
`services/factor/bankrCapabilityHandlers.ts`) will still report `claimableAmountKnown: false`
regardless of credentials — Bankr has no publicly documented fee-claim endpoint (a Phase 0 finding).
See the note below to send to Bankr.

---

## Note to send to Bankr — fee-claim endpoint

> Subject: Partner API — fee-claim/withdrawal endpoint for token launches
>
> Hi team,
>
> We've integrated Bankr's Partner API for token-launch quoting and submission
> (`/token-launches/quote`, `/token-launches`, `/token-launches/{jobId}`) and are ready to bring it
> fully live. One gap we haven't been able to close from your public docs: is there a documented
> endpoint for querying and claiming accrued creator/partner fees for a launched token?
>
> Specifically we need:
> 1. A read endpoint to query the claimable fee balance for a given token/launch (and, if relevant,
>    per supported chain) — ideally scoped to our read-only Partner API key.
> 2. A write endpoint (or the expected flow) to actually claim/withdraw those fees to a specified
>    recipient address, scoped to our write key, with the same idempotency-key semantics we use for
>    `/token-launches` (`idempotency-key` header) if you support it there.
> 3. Response shape for both — the fields we'd expect are something like `claimableAmount`,
>    `asset`/`denomination`, `chain`, and (for the claim call) a `transactionHash`/`explorerUrl` once
>    settled — happy to match whatever shape you actually return.
>
> If this isn't public yet, could you point us at partner-only docs or confirm it's on your roadmap?
> Until then we report fee-claim status honestly as "not yet available" to our own users rather than
> guess at numbers.
>
> Thanks —
> [your name]
