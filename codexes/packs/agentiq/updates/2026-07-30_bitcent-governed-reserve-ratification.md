# BitCent Governed-Reserve Ratification — Issuance Record Closed (2026-07-30)

**Status: `PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE`.** All ten required fields in
`scripts/bitcent-issuance-record.json` are now `ratified: true` (was 7/10). This closes R-14/R-15
from the gap register and adds R-16 (mint terms / open-mint policy) — see
`codexes/packs/agentiq/updates/2026-07-28_vl-ct-001-gap-register.md`.

## What was ratified

### 1. `premine` — AMENDED (superseding the 2026-07-29 ratification)

The 2026-07-29 ratification of `premine: 100,000,000` conflated the ON-CHAIN premine (the single
custodial output the Rune protocol actually etches) with the INITIALLY-ACTIVE operational amount.
Corrected: the full `maxSupply` — **1,000,000,000 B¢** — is premined in one output to the
`premineCustodian` address. Nothing further can ever be minted after the etch (`openMint: none`).

### 2. `mintTerms` — governed-reserve model (new R-16)

```json
{
  "initiallyActiveIssuance": 100000000,
  "governedReserve": 900000000,
  "openMint": "none"
}
```

- **No permissionless public mint.** `scripts/deploy-qct-bitcoin.js`'s `Etching` construction no
  longer builds a Runes `Terms` structure at all — previously it always constructed one from an
  unratified `amountPerMint`/`cap` placeholder that implied a public open mint. `resolveTokenomics()`
  refuses if `mintTerms.openMint` is ever anything other than `'none'` — a different open-mint policy
  requires new etching code, not just a new record value.
- **100,000,000 initially active** — the amount `allocationSchedule` (below) distributes, and what
  the pilot treasury authority gate's `treasuryCap` context should be set to for any FUTURE transfer
  mandate (not this etch, which is the genesis issuance itself — see the note in
  `deploy-qct-bitcoin.js` on why the etch mandate carries no cap).
- **900,000,000 governed reserve** — cannot be released from the premineCustodian address without a
  NEW operator mandate and governed treasury action. This is a SPEND-AUTHORISATION POLICY, enforced
  by `services/treasury/pilotTreasuryAuthority.js`, not a protocol-level split — Bitcoin Runes has no
  mechanism to partition a premine into tranches at the UTXO level. The whole 1B sits in one output;
  the 100M/900M line is governance, not cryptography.

### 3. `allocationSchedule` — ratified (was `proposed`)

```
35,000,000 B¢  settlement liquidity and market-making
25,000,000 B¢  service-economy reserve
15,000,000 B¢  ecosystem incentives and participation
10,000,000 B¢  operational settlement reserve
10,000,000 B¢  treasury and contingency
 5,000,000 B¢  future governed distribution
```

Sums to the 100,000,000 initially-active tranche, not the full 1B premine. These are **treasury
earmarks** — internal purpose allocation. They do NOT independently authorise any transfer; every
actual movement still requires the full pilot treasury authority chain.

### 4. `premineCustodian` — ratified for pilot

**Aigent Z BitCent Treasury** — a freshly generated testnet keypair (never reused from any
previously exposed key). The address is recorded in `scripts/bitcent-issuance-record.json`; the
private key (`BITCENT_TREASURY_CUSTODIAN_WIF`) is a server-side-only secret, never committed.

**This is a single-key wallet, not the threshold/multisig control this field originally required.**
The operator explicitly accepted this trade-off for pilot speed, substituting the pilot treasury
authority gate's multi-party chain for on-chain multisig:

```text
operator mandate
∩ operator passcode confirmation
∩ Aigent Z execution
∩ Aigent Nakamoto required-signatory approval
∩ Aigent Kn0w1 observation
```

Kn0w1 (not Platform Aletheon) is the observer for this class — acceptable for pilot speed per the
operator's ruling, provided the observer role stays substantive (it does: `services/treasury/
pilotTreasuryAuthority.js`'s `verifyKn0w1Observation` is a real check, not a rubber stamp — see
`2026-07-30_pilot-treasury-authority.md`). Platform Aletheon can be admitted as an alternative
constitutional signatory or observer in a later iteration without blocking this mint.

## Post-pilot constitutional review trigger

Recorded explicitly, per the operator's instruction, so this provisional profile is never mistaken
for a permanent one. Before any non-pilot (higher-value, longer-lived, or non-testnet) use of this
custody model, review:

- **Signer topology** — is a single required-signatory + single observer still sufficient, or does
  scale/value now justify true threshold signing (on-chain multisig, not just an off-chain approval
  chain)?
- **Platform Aletheon participation** — should Aletheon join as a signatory or observer for some or
  all transaction classes, not only the constitutional-exception class?
- **Passkey replacement** — should the operator passcode (a shared-secret scrypt hash) be replaced
  with a phishing-resistant authenticator (WebAuthn/passkey), per the Constitutional Authority
  Supremacy doctrine's Progressive Authority Principle?
- **Key rotation** — the custodian's private key has now existed for one pilot's duration; does it
  need scheduled rotation, and what does rotation-without-losing-custody look like for a Bitcoin Rune
  premine specifically (a rotation moves the balance to a new address — that IS a transaction, not a
  key-only operation, unlike an EVM key rotation)?
- **Custody separation** — should execution (Aigent Z) and custody (the wallet holding the key) be
  split across separately-secured processes/environments rather than one script reading one env var?

## Generating the operator passcode (never paste the plaintext anywhere)

```bash
node -e "
const c = require('crypto');
const salt = c.randomBytes(16).toString('hex');
const hash = c.scryptSync(process.argv[1], salt, 64).toString('hex');
console.log('TREASURY_OPERATOR_PASSCODE_SALT=' + salt);
console.log('TREASURY_OPERATOR_PASSCODE_HASH=' + hash);
" '<your chosen passcode>'
```

Run this locally, copy only the two `TREASURY_OPERATOR_PASSCODE_SALT=`/`TREASURY_OPERATOR_PASSCODE_HASH=`
lines into your server-side env (`.env.local`, never committed), and do not paste the passcode
argument itself into chat, a commit, or shell history you don't control.

## Verified (dry run, this session — no network, no broadcast)

```
Ratified fields (10/10): runeName, symbol, divisibility, maxSupply, premine, mintTerms,
  allocationSchedule, premineCustodian, relationshipToBaseQc, independenceDeclaration
Open fields (0/10): (none)

Max supply: 1,000,000,000
On-chain premine (this etch): 1,000,000,000
Initially active issuance: 100,000,000
Governed reserve (requires a new mandate to release): 900,000,000
Open mint: none
```

`--execute` (with a masked stdin, no passcode configured) correctly reached the treasury mandate
step — showing the full mandate (asset/amount/source/destination/network/expiry/class) — and
correctly refused with `passcode-not-configured` rather than proceeding. No wallet funded, no UTXO
fetched, no broadcast attempted.

## What still gates a real testnet etch

1. **R-12 — verify `BITCENT` name availability** against a live Bitcoin Rune indexer. This session's
   sandbox cannot reach the relevant hosts (network egress policy) — must be run from an environment
   with real network access (the operator's own machine, as with the reviewer-run commands).
2. **`TREASURY_OPERATOR_PASSCODE_HASH` / `_SALT`** — not yet set. Generate locally (command above)
   and set as protected server-side secrets.
3. **Fund the custodian address** with testnet BTC (a faucet) so `BITCENT_TESTNET_DEPLOYER_WIF`'s
   corresponding UTXO exists for the reveal transaction.
4. Then: `node scripts/deploy-qct-bitcoin.js --execute`, verify indexer recognition of the etched
   Rune, and produce the issuance/mandate/signer/observer/DVN receipts.

**Mainnet is unaffected by this ratification** — `deploy-qct-bitcoin.js` still refuses `--mainnet`
unconditionally, ahead of every other check, pending its own separate ratification path. No Mainnet
transaction plan is proposed here; that is explicitly the operator's separate, final authorization.
