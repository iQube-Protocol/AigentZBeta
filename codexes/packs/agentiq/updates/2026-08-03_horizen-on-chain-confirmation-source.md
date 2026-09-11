# Horizen registration — the chain as an independent confirmation source

**Status:** shipped, 2026-08-03. Follows
`2026-08-03_horizen-agentid-receipt-decode-recovery.md`, which unblocked the check itself.

---

## What the pilot reported, and why it is a *different* failure

```
Horizen has not confirmed this registration after 20 checks. The transaction
(0xedda5f73…) is broadcast on base-sepolia and this is a report about the CHECK,
not a failure of the transaction.
```

This is **not** the earlier failure. The previous message was a `STATUS_UNAVAILABLE` refusal —
"the registration's agent identifier was unavailable" — which is `ok: false`, thrown by the client
as an error. This one comes from the `MAX_POLL_ATTEMPTS` branch, which is only reachable when the
route answers `ok: true, confirmed: false`.

So the receipt-decode fix worked: the identifier is now recovered, `get_onboarding_status` is
actually being called, and it is answering without rejecting the arguments. **The block moved from
"we could not ask" to "we asked, and we do not recognise the answer."**

`confirmed` is a substring match over Horizen's flattened prose:

```ts
statusText.includes('active') || statusText.includes('confirmed') || statusText.includes('complete')
```

An answer phrased any other way reports "not confirmed" forever.

## What was NOT done

**The heuristic is unchanged.** Widening it on a guess is exactly what its own comment forbids, and
the error it would risk is the worse one: declaring a registration confirmed that is not. No fourth
word was added. A canary now asserts the line verbatim and that it contains exactly three
`includes(` calls, so a fourth cannot be slipped in beside it.

## What was done — a second, independent source

The chain. `decodeAgentIdFromReceipt` already reads the registration transaction's own receipt to
recover the `agentId`; it now runs **unconditionally** and its result is also used as evidence that
the registration exists:

> A `Registered`/`Transfer` mint event in this transaction's receipt, whose `ownerOf` resolves to
> this agent's wallet, is direct evidence the identifier was minted to this owner. It does not
> depend on how Horizen words a status string.

This is the **explorer-fallback posture already ratified for Bitcent**: a second source, the source
**named**, and any divergence **surfaced** rather than silently resolved.

```
confirmed = horizenConfirmed || onChain.verified
confirmationSource: 'horizen-status' | 'on-chain-receipt' | 'both' | null
```

### The two are never conflated

They measure different things — on-chain says the identifier was minted; Horizen's onboarding
status may also track indexing or validation. So a disagreement is **stated in both directions**,
never resolved by preferring one:

- chain confirms, Horizen does not → reported as a divergence to note, *"not necessarily a fault"*,
  with both the on-chain detail and Horizen's raw answer;
- Horizen confirms, the receipt did not independently verify → also reported, with the reason the
  chain read did not verify.

### A failed registry reread no longer discards verified chain evidence

`REGISTRY_REREAD_FAILED` previously refused whenever Horizen's registry reread failed. That reread
is how Horizen's *record* is read — it is not what makes the registration true. When the chain has
already verified the mint, the refusal would throw away real evidence because a convenience lookup
failed. It now fires **only** when the chain did not verify. Otherwise the decoded `agentId` (which
*is* the ERC-721 tokenId — nothing invented) is used, with `registryAlias` derived by the existing
`0x${BigInt(tokenId).toString(16)}` rule, and:

- `agentIdentifier` stays **null** — operator ruling 2026-07-31, never defaulted from tokenId;
- `humanReadableUrl` therefore stays null too;
- the response says exactly this, rather than presenting a partial record as a whole one.

### Bounded, because it now runs on every check

`JsonRpcProvider` retries network detection on an unreachable URL and the status route answers
within 25s. An unbounded chain read could spend that whole budget and turn a *working* Horizen
answer into a gateway timeout. The read is raced against an 8s deadline; on expiry it degrades to
**"not read"** — with that stated as the reason — never to "no answer at all".

## What the operator now sees

- **confirmed by:** the transaction receipt on-chain / Horizen's onboarding status / both.
- **What the chain says** — the decoded event, registry, and the `ownerOf` verification, in words.
- A divergence banner whenever the two sources disagree.
- The existing **What Horizen answered** block, unchanged.

## Verification

- `tests/register-ceremony.test.ts` — **91 tests**, 4 new: the heuristic is unchanged (asserted
  verbatim, exactly three `includes`), the chain confirms independently with the source named,
  divergence is stated in both directions, and a failed reread does not discard chain evidence.
- Horizen suites: `register-ceremony`, `horizen-registration-client`, `horizen-register-status-route`,
  `register-ceremony-routes`, `horizen-integration`, `horizen-agent-binding` — all pass.
- `npm run type-check:research` — **10 errors, the same 10 pre-existing ones in the same seven
  files.** Baseline unmoved.

### Finding flagged, deliberately not fixed here

Temporarily widening the scoped gate to `services/horizen/**` +
`app/api/journey/moneypenny-horizen/**` surfaced **7 pre-existing type errors** in files this
change does not touch:

| File | Error |
|---|---|
| `services/horizen/client.ts:82` | `fetchWithRetry` does not exist on `corpusScout/retrieval` |
| `services/horizen/agentBinding.ts:676` | `number \| undefined` passed where `OwnershipFreshnessTier \| undefined` expected |
| `app/api/journey/moneypenny-horizen/state/route.ts:75,93` | `'supabase' is possibly null` (×2) |
| `services/identity/walletAliasService.ts:257,274,298` | unsound `DidPersonaRecord` casts (×3) |

The files changed here (`registrationClient.ts`, `agentIdRecovery.ts`, `register/status/route.ts`)
contribute **zero**. The scope widening was reverted rather than shipped, because folding 7
pre-existing errors into a baseline others read would obscure the next real regression — and fixing
them is unrelated work to do during a live pilot block. `services/horizen/client.ts:82` in
particular looks like a genuine broken call and is worth its own look.

## Files

| File | Change |
|---|---|
| `services/horizen/registrationClient.ts` | unconditional bounded chain read; `confirmationSource` / `onChain` / `divergence`; reread refusal narrowed |
| `components/journey/RegisterAgentPanel.tsx` | renders the confirming source, the chain's own words, and the divergence |
| `tests/register-ceremony.test.ts` | 4 new canaries |

## Still open

- **What Horizen actually answers is still unknown to this code.** The panel shows it under *"What
  Horizen answered"*; that raw string is the one thing that would say whether the heuristic should
  ever be widened — and it must come from an observation, not a guess.
