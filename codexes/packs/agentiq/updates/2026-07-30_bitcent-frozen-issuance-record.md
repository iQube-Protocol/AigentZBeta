# BitCent (B¢) Frozen Issuance Record

**Status: 7 of 10 required fields ratified. 3 open.** Etching is refused (via
`scripts/deploy-qct-bitcoin.js`'s `--execute` path) until all ten are ratified. This document is
the human-readable companion to the machine-checked record at
`scripts/bitcent-issuance-record.json`, which the script actually loads — this doc explains the
history and reasoning; the JSON is the enforced source of truth.

Supersedes: `2026-07-29_qriptocent-supply-constitution.md`'s "what remains before an etch" section
for the specific ten-item checklist (that document remains authoritative for everything else —
the governing rule, the class/denomination distinction, interoperability model).

---

## The ten required fields

| # | Field | Status | Value |
|---|---|---|---|
| 1 | Rune name | ✅ Ratified | `BITCENT` |
| 2 | Symbol | ✅ Ratified | `B¢`, ASCII fallback `Bc` |
| 3 | Divisibility | ✅ Ratified (2026-07-30) | `2` |
| 4 | Maximum supply | ✅ Ratified (2026-07-29) | `1,000,000,000` |
| 5 | Premine | ✅ Ratified (2026-07-29) | `100,000,000` |
| 6 | Mint terms | ❌ Open | — |
| 7 | Allocation schedule | ❌ Open (proposed) | see below |
| 8 | Issuer/holder of premine | ❌ Open (policy ratified, wallet not provisioned) | see below |
| 9 | Relationship to Base Q¢ | ✅ Ratified | independent ledgers, cent-for-cent settlement, no wrapping |
| 10 | Independence declaration | ✅ Ratified | B¢ and Base Q¢ are separate denominations of one class |

### 3. Divisibility — ratified 2026-07-30

**2, not 18, and not the 8 previously coded in the (now-deleted) draft scripts.** B¢ is already a
cent-denominated economic unit (`1 B¢ = $0.01` reference value). With 2 decimal places:

```
1 B¢
0.10 B¢
0.01 B¢  = $0.0001 reference value — already sufficiently granular for micropayments
```

Eighteen decimals would give atomic precision far beyond a cent-denominated instrument's economic
meaning, and would complicate display, reconciliation, mint terms, and wallets for no benefit.

The rule this produces, stated for the record: **Base Q¢ may retain 18 ERC-20 decimals as a
technical contract property (it already does, live on Base mainnet). BitCent/B¢ uses 2 Rune
divisibility places as an economic denomination property.** Cross-ledger settlement normalizes
value through canonical minor units — the two networks do not need identical native decimal
precision to settle cent-for-cent. If a canonical internal accounting unit is needed system-wide,
one ten-thousandth of the reference dollar (matching B¢'s smallest unit) is the natural choice,
but that is a separate, not-yet-needed decision.

### 6. Mint terms — OPEN

Prior draft code (`deploy-qct-bitcoin.js`, before this consolidation) carried
`amountPerMint = 1000`, `cap = 900,000,000` — but this was never actually ratified as a decision,
only present as code. `scripts/bitcent-issuance-record.json` records these as `illustrativeOnly`
values usable for dry-run demonstrations only. Before mainnet (and before a testnet `--execute`),
this field needs an explicit ruling.

### 7. Allocation schedule — proposed, not ratified

How the 100,000,000 premine splits across purposes. Proposed 2026-07-30:

| Purpose | Allocation | B¢ |
|---|---:|---:|
| Settlement liquidity and market-making | 35% | 35,000,000 |
| Service-economy reserve | 25% | 25,000,000 |
| Ecosystem incentives and participation | 15% | 15,000,000 |
| Operational settlement reserve | 10% | 10,000,000 |
| Treasury and contingency | 10% | 10,000,000 |
| Future governed distribution | 5% | 5,000,000 |
| **Total** | **100%** | **100,000,000** |

This redistributes the already-ratified 100,000,000 premine among purposes; approving this table
does **not** reopen the premine amount itself. The emphasis on liquidity and the service economy
matches B¢'s intended role (arbitrage against Base Q¢, financial-services disruption) rather than a
conventional speculative-token distribution — but this is a proposal pending operator ratification,
not yet a ruling.

### 8. Issuer/holder of the premine — policy ratified, wallet not yet provisioned

**Aigent Z is the ratified operational custodian.** Reasoning on record:

- Aigent Z already carries platform and treasury operational responsibility.
- MoneyPenny is the customer-facing Financial Services Runtime orchestrator — it should route or
  request authorised liquidity, but must not control the root issuance reserve.
- Aigent Nakamoto is the Bitcoin issuance-integrity / governance overseer, positioned for approval
  or veto authority over issuance-sensitive acts — not the operational treasury holder.

```
Aigent Z         = operational treasury custodian
MoneyPenny       = Financial Services Runtime orchestrator (may request/route liquidity, no control)
Aigent Nakamoto  = Bitcoin governance / issuance-integrity overseer (approval/veto authority)
```

**What still blocks ratification of this field:** the premine may not be held by an ordinary
single-key wallet. Required before this field can flip to `ratified: true`:

- a dedicated **Aigent Z BitCent Treasury** wallet (a real address);
- threshold or multisignature control, never single-key;
- a documented transaction policy and spending limits;
- a required-approvals process;
- a recovery and key-rotation procedure;
- DVN receipts for every consequential movement;
- independent reconciliation against the B¢ ledger;
- Aigent Nakamoto oversight/veto wired in for issuance-sensitive actions.

None of this infrastructure exists yet. Standing this up is separate, larger engineering work than
this consolidation — tracked as R-15 in the gap register.

---

## Enforcement

`scripts/bitcent-issuance-record.json` is what `scripts/deploy-qct-bitcoin.js` actually loads and
checks — not this document. Each of the ten fields carries a `ratified: true|false` flag; the
script's `--execute` (real broadcast) path refuses outright if any field is `false`, naming exactly
which ones. A dry run (the default, no `--execute`) is still possible and uses the fields marked
`illustrativeOnly`/`proposed` for the open items, loudly logged as such, purely to demonstrate that
the `runelib`-based Runestone encoding itself is correct and complete.

Mainnet is refused unconditionally regardless of this record's state — it requires its own
separate ratification flag and record, not yet implemented, per the operator's explicit ruling
(2026-07-30): testnet readiness and mainnet readiness are deliberately different bars.

To update a field's ratification status, edit `scripts/bitcent-issuance-record.json` directly and
record the reasoning here. Do not edit the script to bypass the check.
