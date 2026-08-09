# Agent Purpose-Bound Wallet Model — Fast-Follow Backlog Note

**Status:** Backlog note only. Not a redesign, not implemented beyond the one instance below.
**Trigger:** Horizen Pilot Closure — Nakamoto Verifiable-PnL trading wallet (operator directive, 2026-08-09, part 6).

---

## What happened

Horizen's Verifiable-PnL service hard-requires a trading wallet distinct from the ERC-8004 owner
wallet (server-enforced: `tradingWallet MUST differ from ownerWallet`, confirmed live on two
independent fetches of `AGENTS.md`). This codebase's wallet topology, until this pass, had exactly
one wallet per agent — `agent_keys`, one row per `runtimeAgentId`, the canonical agent-control /
ERC-8004 owner-wallet custody path (see `registrableAgents.ts`'s own doctrine: "the ONE agent-wallet
custody path, never a parallel one").

Rather than overwrite, expand, or reinterpret that row, this pass added the smallest generic
structure that names a SECOND, purpose-bound wallet without a Nakamoto-specific field or table:

- **Migration:** `supabase/migrations/20260930001300_agent_wallet_bindings.sql` — one row per
  `(agent_runtime_id, wallet_role)`, `wallet_role ∈ {owner, trading, settlement, treasury}`
  (only `trading` instantiated this pass).
- **Service:** `services/wallet/agentPurposeWalletService.ts` — provisions via the SAME
  `AgentKeyService` AES-256-CBC custody mechanism the owner wallet uses, under a namespaced
  `custody_ref` (`"<runtimeAgentId>::wallet::<role>"`) that can never collide with a real
  `runtimeAgentId`. Never stores or returns key material outside that boundary.
- **Wired into:** `app/api/journey/moneypenny-horizen/pnl/onboard/route.ts` (auto-resolves the
  trading wallet from the binding instead of requiring it in every request body) and
  `services/horizen/pnlOnboardingClient.ts`'s `resolveTradingWalletPrivateKey` deps hook.

This is the FIRST time this codebase has modeled an agent holding more than one wallet.

## The implication worth capturing

The operator's own framing (2026-08-09): *"the dedicated trading wallet is not really a workaround;
it exposes an important future SmartWallet model: one constitutional control wallet, potentially
multiple bounded purpose wallets."*

Concretely: an agent's wallet is not necessarily a single address — it may be a **role/purpose-bearing
affordance set**, where:

- **The control wallet stays singular and canonical.** `agent_keys` addressed directly by
  `runtimeAgentId` remains the one wallet that signs registration mandates, acceptance, and
  execution per the Wallet Signing Topology ruling
  (`2026-08-01_wallet-signing-topology-ruling-and-phase-1.md`). This is not up for revision.
- **Bounded capability wallets may exist alongside it** — trading (this pass), and plausibly
  settlement or treasury later — each scoped to one purpose, each independently revocable
  (`agent_wallet_bindings.status`), never substitutable for the control wallet's authority.
- This is a DIFFERENT relationship than `linked_external_wallets` (2026-08-02): that table holds
  a wallet the PLATFORM DOES NOT CUSTODY (an execution instrument, zero key material, capped at
  `authority_role = 'execution_instrument'` and `may_sign_principal_mandate = FALSE` by CHECK
  constraint, not convention). A purpose-bound agent wallet, by contrast, IS platform-custodied
  (same AES-256-CBC mechanism as the control wallet) — the distinction that matters is not
  custody, it's **scope of authority**.

## What this is NOT

- **Not a SmartWallet redesign.** `types/smartWallet.ts` / `SmartWalletNode` is a persona-facing
  UI aggregation model (balances, entitlements, tasks, rewards) — a different concern at a
  different layer. This note does not propose touching it.
- **Not a second control-wallet path.** `AgentPurposeWalletService.provisionPurposeWallet`
  explicitly refuses the `'owner'` role (`ROLE_NOT_PROVISIONABLE`) — provisioning it through this
  table would recreate exactly the parallel path the operator ruled out.
- **Not a claim that `settlement`/`treasury` are needed now.** They are named in the migration's
  CHECK constraint so that adding a real row for either is a deliberate schema decision later,
  never a silent widening — nothing here requests building either.

## Reconciliation this should feed, later

When SmartTriad / DVN Spine / MoneyPenny's operating model next revisits agent custody or
signing surfaces, fold this in rather than rediscovering it:

1. Does `signing_requests.wallet_ref` (today: literal `'principal'` or a bare `runtimeAgentId`)
   need a role dimension, now that an agent can have more than one wallet? Today a
   `SigningRequest` for Nakamoto's trading wallet would still resolve `wallet_ref = 'aigent-nakamoto'`
   ambiguously between its owner and trading wallets — untested because Phase 2 of the Signing
   Topology ruling (the Pending Actions UI surface) hasn't shipped yet, but worth resolving before
   it does.
2. Should the wallet-drawer UI (Phase 2 of the same ruling) ever need to show an agent's OWN
   multiple wallets side by side (e.g. an operator inspecting Nakamoto's control vs. trading
   wallet), `agent_wallet_bindings` plus a direct `agent_keys` read for the owner row is the
   read path — no new resolver needed, just a UI surface.
3. `services/identity/personaAddressResolver.ts` and its sibling resolvers must continue to
   resolve exactly one thing each (the RESOLVER_SEPARATION principle already established for
   `linked_external_wallets`) — a future "agent wallet resolver" should stay scoped to
   `agent_wallet_bindings` + `agent_keys`'s control row, and must never be asked to also resolve
   persona-facing `SmartWalletNode` state.

No code action is requested by this note. It exists so the next agent or session that touches
agent wallet custody finds this reasoning instead of re-deriving it.
