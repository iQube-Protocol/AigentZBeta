# DVN ⇄ Mainnet Q¢ parity, USDC top-up, deferred minting

**Status:** backlog — design direction agreed. Build after atomic per-tx
on-chain settlement (shipped 2026-05-22) is verified stable in dev.

**Touches:** `qc_balances`, `qc_transactions`, `/api/wallet/base-qc/*`,
`/api/community-content/settle`, `/api/community-content/_lib/generate.ts`,
RemixDialog payment flow, MoneyPenny treasury reconciliation.

---

## Direction

Stop treating DVN Q¢ as "off-chain" — it's an ICP-anchored on-chain
ledger; Mainnet Q¢ is an EVM ERC20 on Base (testnet/mainnet). The two
should run in **1:1 parity**, with DVN serving as the user's day-to-day
settlement layer and Mainnet as the underlying canonical asset.

Three workstreams compose the parity model:

### 1. USDC / USD purchase → DVN Q¢ credit

When a user buys Q¢ on the platform with USDC (or a USD off-ramp), the
purchase credits DVN Q¢ directly rather than minting Mainnet Q¢ to
their wallet. The treasury holds the equivalent Mainnet Q¢ in MoneyPenny
custody; the user's DVN Q¢ balance represents their pro-rata claim on
treasury Mainnet Q¢.

- Removes friction: no on-chain tx, no signature, no gas
- Standardises the entry path: USDC → DVN → spend with no per-tx sigs
- Treasury accumulates Mainnet Q¢ which can be batch-minted/burned by
  the deferred-minting job (workstream 3)

### 2. User-initiated Mainnet Q¢ → DVN Q¢ swap

Users who already hold Mainnet Q¢ in their EVM wallet can swap to DVN
at any time. The user signs a QCT `transfer(treasury, amount)` (same
mechanism as today's `/api/community-content/settle`), the server
verifies the receipt and credits DVN.

This is what `/api/community-content/settle` already does today —
generalise the endpoint so it's not bound to a community-content
intent. Name it something like `/api/wallet/base-qc/swap-in`.

The reverse direction (DVN → Mainnet) is workstream 3.

### 3. Deferred minting / batch reconciliation (DVN → Mainnet)

A scheduled job (cron / Lambda EventBridge / ICP heartbeat) reconciles
DVN balances back to Mainnet at regular intervals:

- For users withdrawing DVN → Mainnet: the treasury signs a Mainnet
  Q¢ `transfer` from the MoneyPenny address to the user's verified
  EVM address; the DVN balance is debited atomically.
- For ongoing operational drift: the treasury mints/burns Mainnet Q¢
  so the total Mainnet supply stays in parity with total DVN issued.

Batched on-chain settlement = one Mainnet tx per batch interval
instead of one per user action. Massively cheaper, lower latency for
the user (instant DVN debit), and a clean audit trail at every batch
boundary.

---

## What changes in the user-facing flow

### Today (atomic per-tx, shipped 2026-05-22)
1. Remix costs 15 Q¢, user has 5 in DVN
2. `/generate` returns 402 + x402 payment intent
3. User signs Mainnet QCT transfer to treasury (one wallet sig per remix)
4. `/settle` verifies, credits DVN 15
5. Client re-runs `/generate`, debit succeeds from DVN

### With this backlog
1. User pre-funds DVN via USDC purchase OR one Mainnet → DVN swap
   (one sig total, not one per remix)
2. Remix flow debits DVN directly — no payment intent, no wallet prompt,
   no on-chain tx for the user
3. Treasury reconciliation happens out of band on a schedule

---

## Multi-chain settlement layer

DVN ALSO unlocks multi-chain interop. Today's `qc_balances.currency =
'base_qc'` is the Base-anchored DVN balance. The same ledger structure
extends to `eth_qc`, `arb_qc`, `op_qc`, `poly_qc`, etc. Internally we
fungibilise across chains by treating DVN Q¢ as the unified balance and
recording the canonical Mainnet anchor as a per-row attribute. The user
spends DVN Q¢; the treasury chooses which Mainnet ledger to settle from
based on liquidity / fee conditions.

This is the cleanest path to "Q¢ that work everywhere" without forcing
users to think about bridges.

---

## Phasing

| Phase | Scope | Prereq |
|---|---|---|
| A | USDC checkout → DVN credit | Stripe/Coinbase Commerce integration; treasury Mainnet Q¢ float |
| B | Generalised Mainnet → DVN swap endpoint | Extract `/community-content/settle` core into `/wallet/base-qc/swap-in` |
| C | Batch reconciliation worker | Treasury hot-wallet signer; cron infra; supabase view for unsettled DVN |
| D | DVN → Mainnet withdrawal | Phase C deployed and proven |
| E | Multi-chain DVN fungibility | Phase D deployed; per-chain liquidity routing logic |

A and B can run in parallel. C–E are strictly sequential.

---

## Language hygiene (small but immediate)

Replace "off-chain DVN" with "DVN Q¢" (or "DVN ledger" when contrasting
with Mainnet). DVN is ICP-anchored, not off-chain. Already updated in
the freshly-written files (`qcPaymentIntent.ts`, `generate.ts::debitQc`,
`/community-content/settle`); older files like `useBaseQcBalance.ts`
and `/api/wallet/base-qc/debit/route.ts` still carry the legacy wording
and should be updated as those files are next touched (no urgent
sweep needed).

---

## Out of scope for the first build of this backlog

- KYC / fiat ramp integration (separate workstream)
- Cross-cartridge Q¢ accounting (separate KNYT/Qriptopian)
- ICP-side DVN ledger contract changes (the table-backed shim today is
  fine for the build; the canonical ICP canister is a follow-on)

---

## Server-side default-persona fix (PATH B — server-side persona override)

**Status:** backlog. Path A (client-side defense) shipped 2026-05-22 —
RemixDialog now refuses to submit without an explicit persona signal AND
attaches the persona-session-token so the server's getActivePersona
priority 1 fires reliably. Path B closes the silent "first owned" hole
durably for every consumer of getActivePersona, not just RemixDialog.

**Problem observed.** For dele@metame.com (and any user with multiple
owned personas), `getActivePersona()` priority chain runs:
1. PST                          (skipped when no header sent)
2. `x-persona-id` header        (skipped when not set)
3. `?personaId=` URL param      (skipped when not set)
4. **DEFAULT: first owned by `created_at ASC`** ← silent fallback fires

When step 4 fires it picks whichever persona has the oldest `created_at`
for that auth profile. Empirically this resolves to "devagent" — note
that the user reports devagent was actually their most-recently created
persona, so either the timestamps were back-filled at migration time,
or the ASC sort is somehow inverted to DESC for this auth profile.
Either way, the silent fallback is the bug — the platform should never
guess at the user's intent.

**Schema addition.**

```sql
ALTER TABLE auth_profiles
  ADD COLUMN default_persona_id text REFERENCES personas(id);

CREATE INDEX IF NOT EXISTS idx_auth_profiles_default_persona
  ON auth_profiles(default_persona_id);
```

Set the default on persona create (first persona becomes default), and
let the wallet drawer's persona-switch action update it whenever the
user explicitly switches.

**Resolver change** (services/identity/getActivePersona.ts — needs
operator approval, file is in CLAUDE.md protected list).

```ts
// New step 3.5 — auth_profiles.default_persona_id (if owned)
const profileDefault = await readAuthProfileDefault(authProfileId);
if (profileDefault && ownedPersonaIds.includes(profileDefault)) {
  return { personaId: profileDefault, source: 'session-cookie' };
}

// Step 4 stays but now only fires when no default has ever been set
// (brand-new accounts) — and even then ORDER BY created_at DESC so the
// MOST recent persona wins, not the oldest. New users typically create
// their "real" persona last after experimenting.
```

**Migration for existing users.**
- Set `auth_profiles.default_persona_id` to the user's most-recently
  used persona (look at `qc_transactions.persona_id` or
  `orchestration_events.persona_id` last activity).
- Fall back to most-recently-created persona for inactive accounts.

**Wallet drawer wiring.** When the user changes persona via
`setActivePersonaId()` in PersonaContext, also PUT to a new
`/api/wallet/persona/set-default` route that updates
`auth_profiles.default_persona_id` server-side. This persists the
choice across sessions and devices.

**Rollout.**
- Phase 1: add column + migration, default to most-recently-active
- Phase 2: deploy resolver change, gated by a feature flag
- Phase 3: turn on flag for one user (dele), verify, then ramp
- Phase 4: remove flag, deprecate the `created_at ASC` fallback

Once Path B is in place, Path A's client-side guard becomes a belt-and-
braces safety net (still useful — it catches genuinely missing personas
rather than silently defaulting), but the primary fix moves to the
resolver where it belongs.
