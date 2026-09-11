# QriptoCENT Supply Constitution

**Status:** ratified 2026-07-29 (supply architecture + B¢ initial issuance approved in principle)
**R-10 OPEN:** the B¢ **allocation plan** and final etching constitution — not the amount
**Supersedes:** every description of "1 billion" as a protocol-wide QriptoCENT cap

---

## The governing rule

> **QriptoCENT has no fixed class-wide maximum supply.** Each canonical denomination has its own
> **expressly governed** maximum supply, alongside its own issuance network, initial issuance,
> backing model and circulation record. New denominations, or increases to a denomination's cap,
> require an explicit governed issuance act.
>
> **Base Q¢ and BitCent/B¢ are presently assigned maximum supplies of 1,000,000,000 each. That
> figure applies to these two denominations. It is not an automatic entitlement, a default, or a
> constitutional rule for future denominations** — a later denomination may be governed at 50
> million, 100 million, 500 million, 1 billion or another maximum appropriate to its demand and
> backing model.

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
| **BitCent / B¢** | Bitcoin (Runes) | 1,000,000,000 | **100,000,000 — intended, approved in principle** |

```text
B¢ initial issuance:
  100,000,000 intended
  Status: approved in principle; etching blocked pending allocation plan
          and final issuance ratification
```

```text
Aggregate maximum CAPACITY:            2,000,000,000 class units
Initial native issuance (if B¢ = 100M):  500,000,000
Unissued capacity:                     1,500,000,000
   ├── Base Q¢   600,000,000
   └── B¢        900,000,000
```

**Capacity is not issuance, and it is not a class cap.** Two billion is the aggregate maximum
capacity of the **first two** denominations — not current issuance, and *not* a 2-billion cap on the
QriptoCENT class. Both of these are false and must be corrected on sight:

- "QriptoCENT has 2 billion units" — confuses capacity with issuance.
- "QriptoCENT is capped at 2 billion" — the class has **no** aggregate cap; 2 billion is simply what
  these two denominations currently sum to.

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
> supply. A deployment on an additional execution chain is either a **DVN-settled representation of
> that issuance domain** or a **separately named and governed** denomination. It is never an
> unqualified second issuance of the same name.

**A new denomination must never be called plain `Q¢`.** Without qualification, holders cannot
distinguish one denomination's native issuance from another's — which is the whole failure this rule
exists to prevent.

---

## Interoperability is inter-ledger settlement, not token bridging

> **CORRECTION, 2026-07-29.** An earlier revision of this constitution described additional-chain
> reach as "lock on Base, issue wrapped Base Q¢ elsewhere" and as "bridged supply". That framing was
> **too narrow for this architecture and is replaced, not softened.** QriptoCENT interoperability is
> a **cross-chain ledger settlement network**. It is correspondent/inter-ledger settlement, not token
> bridging, and the difference is constitutional rather than cosmetic.

### Each denomination keeps its own ledger

Base Q¢ and B¢ each maintain **their own native ledger, balances, issuance and settlement on their
own network**. LayerZero/DVN carries **authenticated settlement instructions** between them. A holder
does **not** lock B¢ and mint a wrapped copy on Base.

A cross-network payment is a coordinated ledger operation:

```text
B¢ payer on Bitcoin
  → debit authorised on the Bitcoin ledger
  → DVN-verified cross-chain settlement message
  → corresponding Base Q¢ settlement liquidity debited/allocated
  → recipient credited on the Base ledger
  → settlement receipts on BOTH networks
```

**The token does not move.** What moves is:

- an authenticated payment instruction;
- proof the source debit is final, or sufficiently final under the declared finality policy;
- the amount and the denomination;
- sender and beneficiary references (commitments, never raw identifiers);
- settlement and replay identifiers;
- the destination credit instruction.

Economically, value moves between denomination ledgers. Technically, **each network settles
natively.**

### Liquidity replaces lockups

There is **no lock pool backing wrapped assets 1:1**. What is required instead is **sufficient native
liquidity on each settlement network.**

Spending 100 B¢ into Base:

```text
payer                      −100 B¢        (Bitcoin ledger)
recipient                  +100 Base Q¢   (Base ledger)
settlement liquidity       −100 Base Q¢   (Base ledger)

NO wrapped B¢ is created on Base.
```

Imbalanced flows mean Base Q¢ settlement liquidity falls while B¢ accumulates on the Bitcoin side. So
**lockups disappear, but liquidity and reconciliation do not**: CryptoSent rebalances inventories,
issues or redeems under policy, or routes offsetting flows.

### Cent-for-cent parity

```text
1 B¢ = 1 Base Q¢ = one cent of reference value
```

At the protocol settlement layer there is **no speculative exchange rate and no intended slippage** —
ten cents in, ten cents out. Any difference must be **explicitly classified** as one of:

- network fee,
- service fee,
- liquidity fee,
- timing/finality premium,
- market deviation outside the protocol rate.

**It must never be hidden inside a variable exchange rate.**

### The corrected distinction, recorded

| | |
|---|---|
| **Canonical denominations** | native ledgers and native supply |
| **Cross-denomination transactions** | DVN-mediated debit-and-credit settlement |
| **Optional wrapped representations** | possible where useful — **not required** for interoperability |
| **New issuance** | a separate governed act, **never implied by settlement messaging** |

### The constitutional rule

> QriptoCENT interoperability shall operate through authenticated inter-ledger settlement rather than
> conventional wrapped-token bridging. Each canonical denomination maintains its own native ledger and
> supply. A cross-network payment consists of a source-side debit, a DVN-verified settlement message,
> and a destination-side credit from available native liquidity. The protocol settlement rate between
> QriptoCENT denominations is cent-for-cent; any fee must be separately disclosed. No cross-network
> payment may create duplicate spendable value, and every debit, message, credit, exception, and
> reconciliation must produce attributable DVN receipts.

---

## Interoperability is constitutional, not a later convenience

All denominations share: the same reference value; compatible decimal and accounting conventions;
verifiable reserve/backing evidence; DVN receipts for consequential issuance, redemption, settlement
and reconciliation; transparent supply reporting; declared settlement and redemption mechanisms;
network-qualified identity; bilateral inter-ledger reconciliation.

The system must always be able to answer:

```text
How much NATIVE ISSUED SUPPLY exists, per denomination?
What are the CIRCULATING WALLET BALANCES on each network?
What are the SETTLEMENT-LIQUIDITY BALANCES on each network?
What PENDING INTER-LEDGER OBLIGATIONS are outstanding?
What COMPLETED CROSS-NETWORK FLOWS have settled?
What UNRESOLVED RECONCILIATION EXPOSURE remains?
```

These replace the older "How much is bridged? / Where is backing locked?" questions, which presumed
a lock-and-wrap model this architecture does not use.

### Arbitrage is a separate mechanism — do not conflate it with settlement

```text
DVN settlement  =  deterministic transactional interoperability
arbitrage       =  market-based liquidity and price convergence
```

Because the denominations target the same reference value, a secondary-market divergence invites
correction:

```text
B¢ above Base Q¢  →  acquire/mint Base Q¢ → route toward B¢ liquidity → spread narrows
B¢ below Base Q¢  →  buy B¢ at a discount → settle toward Base Q¢     → spread narrows
```

Arbitrage **replenishes scarce settlement liquidity, exploits secondary-market discounts and balances
inventories**. It is **not** the core payment mechanism, and a cross-network payment never depends on
it: the protocol settlement rate is cent-for-cent whatever the secondary market is doing.

**Arbitrage only stabilises a secondary market where a credible pathway exists.** Sharing a target
price is not enough: without usable issuance, redemption, reserve settlement, cross-network liquidity
and receipt reconciliation, the two instruments can remain separately stable and still hold a
persistent spread.

**Same target value ≠ same asset.** Base Q¢ and B¢ are separate canonical denominations of one
stable-value class, connected through inter-ledger settlement, and secondarily through arbitrage.

---

## BitCent — what remains before an etch

**The intended initial issuance is 100,000,000 B¢, approved in principle.** What remains unratified
is not the amount — it is the **allocation plan and the final irreversible etching constitution**.

> **The 400,000,000 proposal is SUPERSEDED.** `deploy-qct-runes.*` still carries it and is obsolete
> on that point; it is not an equally live alternative to 100,000,000. The authoritative script is
> generated from the ratified issuance record, not selected from the scripts that happen to exist.

There was never a technical reason for B¢'s premine to equal Base Q¢'s 400,000,000 — that would have
been historical symmetry, not economic reasoning.

The remaining decision is how the 100,000,000 is **allocated** among purposes: liquidity and
market-making; service-economy reserves; operational settlement; ecosystem participation; treasury;
future distribution. **That plan can redistribute the 100,000,000 without reopening the selected
initial issuance amount.**

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

> Each canonical QriptoCENT denomination has its own **expressly governed** maximum supply.
> **Base Q¢ and BitCent/B¢ are each presently governed at 1,000,000,000** — a figure specific to
> them, not a default for future denominations. Class-level aggregate supply is the sum of the
> separately disclosed denominations, and the class itself has no cap.

Known offenders include the ops surface (`app/api/qct/trading/route.ts`), which reports a hardcoded
400M spread across seven chains — contradicted by Base alone holding 400M. Those figures are
placeholders with the real `balanceOf` call commented out; they must not be read as supply
reporting.
