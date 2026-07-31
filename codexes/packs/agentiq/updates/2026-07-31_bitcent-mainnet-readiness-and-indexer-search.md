# Bitcent (B¢) Mainnet-Readiness Pass + Runes-Testnet Indexer Search (2026-07-31)

**Status: no code path changed except a documentation comment.** Follows the real testnet etch
(`2026-07-30_bitcent-testnet-etch-broadcast.md`, tx
`551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65`, now at ~80 confirmations per
the operator's direct explorer check) and the ops-card wiring
(`2026-07-30_bitcent-supabase-wiring-and-ops-surfacing.md`). This session's brief: try harder to find
a working Runes-aware testnet indexer, and produce an evidence-based mainnet-readiness checklist.
No mainnet-facing action was taken — mainnet remains entirely operator-gated, per the existing
unconditional refusal in `scripts/deploy-qct-bitcoin.js`.

## 1. Runes-testnet indexer search — real network calls, all blocked by sandbox policy

Made seven real `curl`/fetch attempts (not documentation-only) against distinct candidate
Runes-aware indexer hosts, immediately before writing this doc:

| Candidate | Endpoint tried | Result |
|---|---|---|
| mempool.space testnet Rune API | `/testnet/api/v1/runes/BITCENT` (the exact path `check-bitcent-name-availability.js` already queries) | CONNECT tunnel 403 |
| blockstream.info testnet Esplora | `/testnet/api/tx/<etch txid>` (reference: this is the platform's own canonical Bitcoin explorer, confirmed NOT Runes-aware even when reachable) | CONNECT tunnel 403 |
| Hiro Runes API | `api.hiro.so/runes/v1/etchings?name=BITCENT` | CONNECT tunnel 403 |
| UniSat open API (mainnet path) | `open-api.unisat.io/v1/indexer/runes/BITCENT/info` | CONNECT tunnel 403 |
| UniSat open API (testnet path) | `open-api-testnet.unisat.io/v1/indexer/runes/BITCENT/info` | CONNECT tunnel 403 |
| ordinals.com | `/rune/BITCENT` | CONNECT tunnel 403 |
| Best in Slot | `api.bestinslot.xyz/v3/testnet/rune?rune=BITCENT` (documents mainnet+testnet+signet coverage) | CONNECT tunnel 403 |

Every attempt failed identically: `curl: (56) CONNECT tunnel failed, response 403`, confirmed via
`http://127.0.0.1:<proxy-port>/__agentproxy/status` to be an **organisation egress-policy denial**
(the proxy's own README: *"403/407 from the proxy — the destination host is not allowed by your
organization's egress policy for this session. Do not retry or route around it — report the blocked
host."*), identical in class to the prior session's confirmed blocks on `mempool.space`,
`agent-registry.horizenlabs.io`, and `sepolia.base.org`.

**This is not evidence that any of these seven indexers fails to work for Bitcent.** It is evidence
that this sandboxed session cannot reach any of them to find out. Per CLAUDE.md's "No Guessing"
rule, none was wired into `app/api/ops/bitcent/testnet/route.ts` or `services/ops/btcExplorer.ts` —
doing so would mean asserting a real financial data source works without ever having seen it return
data. **The only change made to `route.ts` is an expanded doc comment** recording this session's
attempt list, so a future session (or the operator, from an unrestricted machine) does not have to
rediscover from scratch which hosts were already tried, and does not mistake "blocked by this
sandbox" for "doesn't exist."

**Recommended next step (operator's machine, real network):** re-run the same seven checks —
`check-bitcent-name-availability.js` already covers the first one; a short one-off script or manual
`curl`/browser check covers the rest — against the real `BITCENT` Rune (etch tx above) once it has
enough confirmations for indexers to have picked it up (it has ~80 now per the operator's direct
explorer check, which should be more than sufficient for any of these indexers). If one returns a
real, parseable Rune record, wire it into `services/ops/btcExplorer.ts` (extend, do not duplicate)
and surface it additively in `route.ts` alongside the existing honest confirmation data — never
replacing it.

## 2. Mainnet-readiness checklist

Read against the ratified governance docs (`2026-07-29_qriptocent-supply-constitution.md`,
`2026-07-30_bitcent-frozen-issuance-record.md`, `2026-07-30_bitcent-governed-reserve-ratification.md`)
and the actual code in `scripts/deploy-qct-bitcoin.js`, `services/treasury/pilotTreasuryAuthority.js`,
`services/ops/btcExplorer.ts`, `.env.example`.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Mainnet execution path implemented | ❌ **Gap — deliberate** | `deploy-qct-bitcoin.js`'s `main()` refuses unconditionally on `--mainnet`, ahead of every other check (`Refusing: Mainnet execution requires its own separate ratification flag and record, not yet implemented. Testnet only.`). This is a hard stop, not a soft gate — correct posture for a real-money Bitcoin issuance, and per the operator's own 2026-07-30 ruling this must stay refused until a *separate* mainnet ratification record exists. |
| 2 | `btcExplorer.ts` mainnet support | ✅ **Done** | `btcExplorerBase()`, `btcCanonicalApiBaseFor('mainnet')`, and `btcCanonicalApiBase()` (keyed off `BTC_NETWORK=mainnet`) all branch correctly to mainnet hosts; `fetchBtcConfirmationWithFallback` is network-agnostic. No testnet-only hardcoding in this file. |
| 3 | Bitcent-specific mainnet issuance record | ❌ **Gap — requires operator decision** | `scripts/bitcent-issuance-record.json` ratifies only a **testnet** issuance (name/symbol/divisibility carry over, but `premineCustodian` is a testnet address `tb1q...`, and the record has no mainnet/testnet field split). The frozen-issuance doc explicitly states mainnet needs "its own separate ratification flag and record, not yet implemented." No such record exists yet — this is a new governance artifact the operator must ratify, not an engineering gap that can be closed by extending code. |
| 4 | Mainnet deployer/custodian wallet + env vars | ❌ **Gap — requires operator decision** | `.env.example` documents `BITCENT_TESTNET_DEPLOYER_WIF` and `BITCENT_TREASURY_CUSTODIAN_WIF` (the latter is the *testnet* pilot custodian per the governed-reserve doc) but has **no mainnet equivalents**. `deploy-qct-bitcoin.js`'s header comment names `BITCENT_MAINNET_DEPLOYER_WIF` as a future env var, but grepping the whole repo shows it is referenced **only in that comment** — never read by any code, and never declared in `.env.example`. The comment also names `BITCENT_MAINNET_ISSUANCE_RATIFIED=yes` as an intended future gate; that variable likewise does not exist anywhere in code — the actual refusal is unconditional (stronger than the comment implies, which is fail-safe, but the comment should be corrected or the gate implemented so they agree). |
| 5 | Custody model — production-grade | ❌ **Gap — explicit operator decision required** | The testnet custodian is a documented **PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE**: single-key wallet, not threshold/multisig, substituting the pilot treasury authority approval chain (operator mandate + passcode + Aigent Nakamoto approval + Aigent Kn0w1 observation) for on-chain multisig. `2026-07-30_bitcent-governed-reserve-ratification.md`'s own "Post-pilot constitutional review trigger" section lists exactly what must be re-examined before **any non-pilot (higher-value, longer-lived, or non-testnet) use**: signer topology (true threshold signing?), Platform Aletheon participation, passkey replacement for the operator passcode, key rotation procedure, and custody/execution separation. None of this has been decided — it is explicitly flagged as the operator's call, not an engineering default. |
| 6 | Treasury authority gate — mainnet branch | ⚠️ **Partially built, unexercised** | `pilotTreasuryAuthority.js`'s `verifyNakamotoApproval`/`verifyAletheonObservation` both correctly refuse `network === 'mainnet'` unless `context.mainnetMandateExplicit` is set — but nothing in the codebase ever sets that flag to `true` (mainnet is refused before this gate is ever reached). The logic is structurally ready; it has never run against a real mainnet mandate and should not be assumed correct-under-load until it has. |
| 7 | Known hardening gap (recorded 2026-07-30, still open) | ⚠️ **Real gap, not fixed this session** | `assertMandateNotExpired` runs once at passcode-verification time but is **not re-checked immediately before broadcast** (`assertMandateMatchesTransaction` at broadcast time checks asset/amount/destination/network, not expiry). A long UTXO-funding wait between authorization and broadcast could theoretically let an expired mandate execute. Flagged in `2026-07-30_bitcent-testnet-etch-broadcast.md` as a real finding from the live testnet run; not touched this session because it is a change to `services/treasury/pilotTreasuryAuthority.js` / `deploy-qct-bitcoin.js` outside this session's scoped tasks (Runes-indexer search + readiness reporting). Recommend fixing before mainnet: re-run `assertMandateNotExpired` immediately before broadcast, not only at authorization. |
| 8 | DVN receipt / activity-receipt plumbing | ✅ **Done, network-parameterised** | `bitcentTreasuryReceipts.ts`'s `BitcentEtchFacts.network: 'testnet' \| 'mainnet'` and `scripts/record-bitcent-etch-receipt.ts`'s `--network=` flag both already support `mainnet` as a value; the `bitcent_treasury_etch_executed` action type is registered in `ActivityActionType`, `ANCHORABLE_ACTION_TYPES`, and the Supabase CHECK constraint. No mainnet-specific work needed here — this layer is ready to record whichever network actually etches. |
| 9 | Rune name availability check — mainnet variant | ❌ **Gap** | `check-bitcent-name-availability.js` hardcodes the **testnet** Rune-lookup endpoint only. A mainnet pre-etch run (R-12 equivalent) would need a mainnet indexer endpoint — the same unresolved indexer-search problem as item 1 above, and the same "verify for real before trusting" discipline the script already models for testnet. |
| 10 | Testnet-only assumptions elsewhere in Bitcent code | ⚠️ **Present but contained** | `deploy-qct-bitcoin.js`'s `main()` hardcodes the string `'testnet'` in the mandate object (lines ~415, 443, 503) and the API base (`https://blockstream.info/testnet/api`) rather than deriving them from a `--mainnet` flag — but this is moot today because the mainnet path returns before reaching any of that code. If/when a mainnet ratification record and flag are implemented, this function needs to be parameterised on network rather than hardcoded — flagging so it isn't missed as "already generic." |
| 11 | Confirmation reporting (tx-level, not Rune-level) | ✅ **Done, mainnet-ready** | The ops route's `fetchBtcConfirmationWithFallback` call is already network-correct via `btcExplorer.ts` (item 2) — once a mainnet etch tx and a mainnet `deployments/bitcent-mainnet.json` exist, the existing route logic works unchanged (network is read from the deployment JSON, not hardcoded in the route). |

### Summary for the operator

The **engineering plumbing that is network-agnostic by construction** (the explorer helper, the DVN
receipt pipeline, the treasury-authority mandate logic's mainnet branch) is genuinely ready. What
remains before mainnet is **not implementation work** so much as **governance and custody
decisions that only the operator can make**:

1. Ratify a **separate mainnet issuance record** (own custodian address, own confirmation that the
   testnet dry run's tokenomics — name/symbol/divisibility/supply/allocation — carry over unchanged
   to mainnet, since a Rune name is global across networks in the sense that reusing `BITCENT` on
   mainnet is a fresh, independent etch, not a continuation of the testnet one).
2. Decide the **mainnet custody model** — the testnet single-key-plus-approval-chain profile was
   explicitly ratified as pilot-only; the governed-reserve doc's own review trigger list (signer
   topology, Aletheon participation, passkey replacement, key rotation, custody separation) needs
   answers before real BTC value is on the line.
3. Decide whether to fix the mandate-expiry-recheck gap (item 7) before a real mainnet broadcast —
   low effort, directly reduces broadcast-time risk.
4. Only after 1–2 are ratified: implement the mainnet flag/record check in `deploy-qct-bitcoin.js`
   (currently an unconditional refusal with no escape hatch at all — by design, until this ratification
   exists) and provision `BITCENT_MAINNET_DEPLOYER_WIF` / a mainnet custodian WIF as protected
   server-side secrets.

No mainnet transaction plan is proposed or begun here — items 1–2 are explicitly the operator's
separate, final authorisation, consistent with every prior Bitcent document in this series.

## Files touched this session

- `app/api/ops/bitcent/testnet/route.ts` — doc-comment only (records the seven indexer hosts tried
  and why none was wired in); response shape and confirmation logic unchanged.
- This file (new).

## Verification

- Full suite re-run after the comment change: `tests/btc-explorer.test.ts`'s canary initially caught
  literal `blockstream.info`/`mempool.space` substrings in my first draft of the comment (the file's
  own header already warns against this) — reworded to describe providers without the literal
  domain strings; canary passes clean on the corrected version.
- Confirmed (by stashing this session's one-line change and re-running) that the five other failing
  test files in this checkout (`tests/constitutional-context.test.ts`,
  `tests/passport-first-connection.test.ts`, `tests/require-cartridge-admin.test.ts`,
  `tests/onboarding-substrate.test.ts` — all `supabaseUrl is required` in this sandbox's env, and
  `tests/companion-observer.test.ts`'s one flaky terminal-vs-transient assertion) are pre-existing on
  `origin/dev` as merged into this worktree, not introduced by this session's change.
