# QriptoCENT Supply Constitution

**Status:** ratified 2026-07-29 (supply architecture) · **R-10 OPEN** on the B¢ premine amount
**Supersedes:** every description of "1 billion" as a protocol-wide QriptoCENT cap

---

## The governing rule

> **QriptoCENT has no fixed class-wide maximum supply.** Each canonical denomination has its own
> disclosed issuance domain, maximum supply, minting authority, backing policy and circulation
> record. New denominations, or increases to a denomination's cap, require an explicit governed
> issuance act.

The distinction that makes this work:

```text
per denomination  ≠  per chain
```

A denomination is `one canonical issuance domain + one native supply ledger`. A chain is where code
happens to run.

---

## The class and its denominations

**QriptoCENT / Q¢** is the stable-value currency class. It is extensible and has **no aggregate
cap**.

| Denomination | Canonical issuance network | Maximum supply | Initial issuance |
|---|---|---:|---:|
| **Base Q¢** | Base (8453) | 1,000,000,000 | **400,000,000 — minted** |
| **BitCent / B¢** | Bitcoin (Runes) | 1,000,000,000 | **100,000,000 — PROPOSED, not ratified** |

```text
Aggregate maximum CAPACITY:            2,000,000,000 class units
Initial native issuance (if B¢ = 100M):  500,000,000
Unissued capacity:                     1,500,000,000
   ├── Base Q¢   600,000,000
   └── B¢        900,000,000
```

**Capacity is not issuance.** Two billion is the ceiling the two denominations could reach, not what
exists. Any statement of the form "QriptoCENT has 2 billion units" is false and must be corrected on
sight.

### Base Q¢ — the live record

| | |
|---|---|
| Contract | `0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE` |
| Chain | Base mainnet, 8453 |
| Deployed | 2026-05-28 |
| Minted | 400,000,000 (constructor premine, `contracts/QCT.sol:36`) |
| Decimals | 18 · Max 1,000,000,000 |

Source of truth: `deployments/qct-base-mainnet.json`.

---

## Why "1 billion per chain" is the dangerous reading

`contracts/QCT.sol` mints `400_000_000 * 10**18` **unconditionally in its constructor**, and its
`MAX_SUPPLY` is a per-contract constant. Deploy it independently to seven chains and you get:

```text
7 × 400,000,000 premined   = 2,800,000,000 issued
7 × 1,000,000,000 ceiling  = 7,000,000,000 issuable
```

with **no contract able to detect the others**.

The quantity is not the worst part. The worst part is that every deployment presents the *same
apparent asset identity*, so a holder could reasonably read `1 Q¢ on Base`, `1 Q¢ on Optimism` and
`1 Q¢ on Arbitrum` as one currency when they are independent supplies. **That is an
issuance-integrity failure, not an accounting inconvenience.**

### The rule this produces

> A QriptoCENT denomination may have **one** canonical issuance domain and **one** declared maximum
> supply. Deployments on additional execution chains must either represent **bridged supply** from
> that issuance domain, or be **separately named and governed** denominations.

Two legitimate ways to extend to another chain:

1. **Interoperable representation** — lock on Base, issue wrapped Base Q¢ elsewhere. No new
   class-level supply; the representation stays economically tied to the canonical supply.
2. **New native denomination** — its own name, issuance network, maximum, initial issuance, backing
   and redemption terms. Increases aggregate capacity, transparently.

**A new denomination must never be called plain `Q¢`.** Without qualification, holders cannot
distinguish native issuance from a bridged representation — which is the whole failure this rule
exists to prevent.

---

## Interoperability is constitutional, not a later convenience

All denominations share: the same reference value; compatible decimal and accounting conventions;
verifiable reserve/backing evidence; DVN receipts for consequential issuance, redemption, bridging
and settlement; transparent supply reporting; declared conversion and redemption mechanisms;
network-qualified identity; cross-chain reconciliation.

The system must always be able to answer:

```text
How much native supply exists?
How much is bridged?
Where is backing locked?
How much circulates on each network?
Is any representation double-counted?
```

### Arbitrage is an intended stabiliser — and it needs a pathway

Because the denominations target the same reference value, a divergence invites correction:

```text
B¢ above Base Q¢  →  acquire/mint Base Q¢ → convert toward B¢ liquidity → spread narrows
B¢ below Base Q¢  →  buy B¢ → redeem/settle toward Base Q¢             → spread narrows
```

**Arbitrage only stabilises where a credible conversion pathway exists.** Sharing a target price is
not enough: without usable minting, redemption, reserve settlement, cross-chain liquidity and
receipt reconciliation, the two instruments can remain separately stable and still hold a persistent
spread.

**Same target value ≠ same asset.** Base Q¢ and B¢ are separate canonical denominations of one
stable-value class, connected through interoperability, conversion and arbitrage.

---

## BitCent — what remains before an etch

**R-10 is open on the premine amount only.** The supply architecture above is settled: B¢ may have
an independent 1,000,000,000 maximum as a distinct Bitcoin denomination.

> **Neither existing script is authoritative.** `deploy-qct-runes.*` (400M premine) and
> `deploy-qct-bitcoin.js` (100M premine) are competing proposals, not candidates. The authoritative
> script is generated *after* the BitCent issuance constitution is approved.

There is no technical reason for B¢'s premine to equal Base Q¢'s 400,000,000. Copying it would be
historical symmetry, not economic reasoning. The proposed 100,000,000 must first become a ratified
allocation plan naming what it is for — liquidity provision, service-economy reserves, ecosystem
incentives, treasury, market-making, operational settlement, future distribution.

### Pre-etch freeze list — all ten, frozen and hashed, before any broadcast

1. Immutable Rune name (`BITCENT`)
2. Symbol / display convention (`B¢`, ASCII fallback `Bc`)
3. Divisibility
4. Maximum supply
5. Premine
6. Mint terms
7. Allocation schedule
8. Issuer / holder of the premine
9. Relationship to Base Q¢
10. Explicit declaration that the two supplies are **independent**

Both etching scripts refuse to run until this record exists. A Rune's name, divisibility, cap and
premine are all immutable at etch; there is no second attempt.

---

## Documentation to correct

Anything stating or implying a protocol-wide 1B QriptoCENT cap. The accurate statement is:

> **1 billion maximum per canonical QriptoCENT denomination**, with class-level aggregate supply
> equal to the sum of those separately disclosed denominations.

Known offenders include the ops surface (`app/api/qct/trading/route.ts`), which reports a hardcoded
400M spread across seven chains — contradicted by Base alone holding 400M. Those figures are
placeholders with the real `balanceOf` call commented out; they must not be read as supply
reporting.
