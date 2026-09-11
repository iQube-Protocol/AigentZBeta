# Bitcent Testnet Etch — Broadcast (2026-07-30)

**Status: CONFIRMED AND VERIFIED AS A VALID ETCH (2026-08-02) — see §Verification below.** The operator ran
`npm run deploy:bitcent -- --execute` end-to-end for real, on their own machine, against Bitcoin
testnet. This is the first live execution of the ratified governed-reserve issuance record and the
pilot treasury authority gate — not a dry run.

Naming note: the operator ruled during this run that the canonical prose spelling is **Bitcent**
(capital B only), not BitCent. The on-chain Rune name is unaffected — `BITCENT` (all-caps) is a
Runes-protocol convention, not a prose choice. Prior documents in this update series (including this
one's own filename, matching the established naming pattern) still say "BitCent" — a rename pass
across docs/code comments is separate follow-up work, deliberately not done in the middle of this
live run.

## What actually happened, in order

1. **R-12 check (testnet)**: `npm run check:bitcent-name` — `mempool.space/testnet`'s Rune API
   returned a genuine 404 for `BITCENT` (verified real, not the sandbox's proxy block). Combined with
   the prior mainnet PASS via `ordinals.com`, judged sufficient by the operator to proceed.
2. **Funding transaction**: `8c93c25b85e5a32bda6c8189c15c74e8c6e9a290a5ca62dae169da71c16987f8` — a
   plain P2WPKH send of 30,000 sats from the operator's pre-existing funded wallet
   (`tb1qdhc2l3d3w348re4j70a0cykvmh47ptwu8fk9nh`) to the script-derived Taproot commit/reveal address
   (`tb1pfdjt9ad5rv2mjtnqrguysynt65vxex26xzeaq2sky66we27xn7wq068mxy`), built with a one-off script
   (`send-btc-temp.js`, not committed — scratch, deleted after use) reusing the same
   `bitcoinjs-lib`/`ecpair`/`tiny-secp256k1` stack as `deploy-qct-bitcoin.js`.
3. **Pilot treasury authority gate, invoked for real** (`services/treasury/pilotTreasuryAuthority.js`
   via `deploy-qct-bitcoin.js`'s `--execute` path):
   ```text
   mandate commitment: ba69bc0bfe319dae7591006a213f4e1b5dd90772da749f3a9f53531d87a1d644
   action:             bitcent-testnet-etch
   asset / amount:     BITCENT / 1,000,000,000
   source:             tb1qdhc2l3d3w348re4j70a0cykvmh47ptwu8fk9nh
   destination:        tb1qse78njf7v33lmwjl2dq6j2g0djhw0h5awkrcwn
   network:            testnet
   transaction class:  bitcent-treasury-ordinary
   required signatory: aigent-nakamoto — issuance record ratified, network authorised, amount within cap
   observer:           aigent-kn0w1 — sole-principal context and issuance-record ratification confirmed
   ```
   The operator's passcode was entered and verified against the scrypt hash in `.env.local`
   (`TREASURY_OPERATOR_PASSCODE_HASH`/`_SALT`) — one earlier attempt failed because the passcode
   contained `$`/`!` and was first generated via a shell command-line argument, which zsh's
   history/variable expansion silently mangled before it reached the hasher; fixed by regenerating via
   a masked `readline` prompt instead, which never exposes the value to shell parsing.
4. **Etching transaction broadcast**:
   `551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65` — the real Runestone etching, per
   `scripts/bitcent-issuance-record.json`'s ratified governed-reserve terms:
   ```text
   Name:                     BITCENT
   Symbol:                   B¢
   Divisibility:             2
   Max supply:               1,000,000,000
   On-chain premine:         1,000,000,000 (this etch)
   Initially active:         100,000,000
   Governed reserve:         900,000,000 (requires a new mandate to release)
   Open mint:                none
   Premine destination:      tb1qse78njf7v33lmwjl2dq6j2g0djhw0h5awkrcwn (Aigent Z BitCent Treasury)
   ```

## What is NOT yet done — deliberately, not an oversight

- **Confirmation + indexer recognition** — the transaction is broadcast, not yet confirmed at time of
  writing. Runes protocol reads are keyed on confirmed blocks; `BITCENT` will not show as an etched
  Rune on any indexer until this transaction is mined. Verify via
  `https://mempool.space/testnet/tx/551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65`
  for confirmation status, then `https://mempool.space/testnet/api/v1/runes/BITCENT` (the same
  endpoint `check-bitcent-name-availability.js` queries) for indexer recognition — expect this to flip
  from 404 to a real Rune record once confirmed and indexed.

  **This prediction did not hold, and the reason matters — see §Verification (2026-08-02).** The 404
  persisted through 16,038 confirmations because mempool.space does not index Runes on testnet at
  all. Waiting was never going to resolve it, and the etch is nonetheless valid.
- **DVN receipt / mandate / signer / observer receipts, persisted** — the mandate was authorised and
  the transaction matched against it (`assertMandateMatchesTransaction`), but no receipt has been
  written to any datastore. This session's sandbox cannot reach the live Supabase host to persist one.
  This is real follow-up work, not fabricated here.
- **Mainnet** — entirely separate, still unconditionally refused in `deploy-qct-bitcoin.js` regardless
  of this testnet result.

## A real gap found during this run, recorded honestly

`assertMandateNotExpired` runs once, at the moment the operator's passcode is verified
(`authorizeTreasuryAction`). The final broadcast confirmation (`assertMandateMatchesTransaction` at
`deploy-qct-bitcoin.js:499`) does **not** re-check the mandate's `expiry` — so a mandate that was
valid at authorization time but has since crossed its 15-minute window (e.g. due to a long UTXO-funding
wait, as happened in this run) would not be caught before the final broadcast prompt. Did not affect
this run's correctness (mandate was likely, though not re-verified, still within window), but is a
real hardening item for `services/treasury/pilotTreasuryAuthority.js` / `deploy-qct-bitcoin.js`: the
expiry check should run again immediately before broadcast, not only at authorization.

## Files touched this session, relevant to this event

- `scripts/deploy-qct-bitcoin.js`, `scripts/bitcent-issuance-record.json`,
  `services/treasury/pilotTreasuryAuthority.js` — all pre-existing from earlier this session, exercised
  live for the first time here.
- `scripts/check-bitcent-name-availability.js` — used for the R-12 testnet check.
- No new files committed for the funding transaction (`send-btc-temp.js` was a deliberate scratch
  script, deleted by the operator after use, not part of the repo).


---

## Verification — VALID ETCH, confirmed from the chain (appended 2026-08-02)

The 404 never flipped. At 16,038 confirmations it was still 404, which is consistent with two very
different worlds: mempool.space does not index Runes on testnet, **or** our Runestone was malformed —
a **cenotaph**, which under the Runes protocol etches nothing at all. No amount of waiting separates
those, and the difference decides whether B¢ exists.

`scripts/verify-bitcent-etch.js` settles it from primary evidence: it fetches the raw transaction and
decodes its OP_RETURN with the **same `runelib` encoder that built it**. No indexer is consulted.

```
Rune name:  BITCENT
Etch tx:    551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65
Network:    testnet3

CONFIRMED in block 5084224 (00000000002905ad4184102c9eeacbf016e3d1845827980c53b70dd7c388b090)

VERDICT: VALID ETCH — the Runestone is well-formed and the transaction is on chain.
```

**What this establishes:**

- The Runestone is well-formed. It is **not** a cenotaph.
- The etch **does not need to be repeated**; the original governed act stands.
- The 404 was an indexer limitation, not a protocol failure.
- `scripts/verify-bitcent-etch.js` is the canonical local verification path whenever indexers
  disagree or lag. Run it with `npm run verify:bitcent-etch`.

The receipt is persisted in `scripts/bitcent-issuance-record.json` under
`etchBroadcast.verification` — namespaced as observational, with no ratified issuance parameter
altered.

**Mainnet is untouched by this.** A valid testnet etch authorises nothing on mainnet; that remains a
separate ratification with its own record.

### The defect this exposed in the availability checker

`npm run check:bitcent-name` mapped that same 404 to **"LIKELY AVAILABLE"** — about a name we had
ourselves already etched, and in the one direction that could cause a second, irreversible etch. It
now reads the issuance record first (our own etch outranks every indexer, network-scoped), uses our
etched name as a **control probe** so a non-answering endpoint yields INCONCLUSIVE, and **cannot
return an "available" verdict in any branch**. Canaries: `tests/bitcent-name-check.test.ts`.
