# Q¢ payment-modes control framework (atomic / deferred / remote)

**Status:** backlog — design agreed 2026-05-22. Atomic mode shipped same
day via custodial settlement (`custodialSettlement.ts`). The
admin-customizer and Studio control surfaces are the follow-on work
described here.

**Touches:** `RuntimeCapsuleAdminEditor`, `metame:experience_qubes`
schema, Studio super-admin surface, `community-content/generate` route,
`debitQc` mode-router.

---

## Three modes

| Mode | Settlement timing | User UX | When to use |
|---|---|---|---|
| **Atomic** | Mainnet → DVN → debit happens in one tx, server-signs from persona's custodial key (`agent_keys`) | Zero friction — no prompt, just runs. Identical to A2A | Default for FIO-handle personas with custodial keys. Highest-fidelity audit trail. |
| **Deferred** | Debit DVN immediately; batch-reconcile DVN → Mainnet at scheduled intervals via deferred minting | Zero friction. Some latency between user action and Mainnet settlement | High-volume actions where one Mainnet tx per debit is cost-prohibitive. Free-tier or accumulated-credit flows. |
| **Remote** | Payment is granted from a remote custody source (cohort treasury, sponsor wallet, scholarship pool) | Zero friction — invisible to user. The custody source pays | Granted access (e.g. a partner sponsors all KNYT cohort members for episode N). User's own DVN balance untouched. |

DVN always remains in the loop in all three modes — it's the canonical
Q¢ ledger; Mainnet is the underlying asset; remote custody is just an
alternative source of DVN credit.

---

## Control framework

Two layers of admin permission govern which modes can be selected:

### Layer 1 — Studio super-admin (upstream)

When a super-admin creates / publishes an Experience Qube in the
Studio, they specify the **allowed set** of payment modes for that
qube. Examples:
- `{ atomic }` only — premium content, must settle on-chain per access
- `{ atomic, deferred }` — flexible; admin chooses based on volume
- `{ atomic, remote }` — paid or sponsored, no batch mode
- `{ atomic, deferred, remote }` — fully flexible

The allowed-set is stored on the qube row, e.g.
`experience_qubes.allowed_payment_modes text[]`.

### Layer 2 — Admin customizer (per-deployment)

Within `RuntimeCapsuleAdminEditor`'s price configuration area, admins
see a **radio group** restricted to the qube's allowed set. They pick
ONE mode for this deployment. Stored on the runtime capsule
configuration alongside the price.

Tooltips on each radio button explain the mode (copy below).

If `allowed_payment_modes` has only one element, the radio group is
displayed read-only as informational text ("This qube is configured
for *atomic* payment only.").

### Tooltip copy

- **Atomic** — *"Pay per access on Mainnet Base. The user's custodial
  wallet is debited the moment they access the qube; the platform
  signs the transaction. No wallet prompt, instant settlement."*
- **Deferred** — *"Pay from the user's DVN Q¢ balance instantly;
  Mainnet settlement happens in scheduled batches. Lowest friction,
  best for high-volume actions."*
- **Remote** — *"Payment is granted by a remote custody source
  (cohort treasury, sponsor, scholarship). The user pays nothing
  from their own balance."*

---

## Runtime routing

When a paid action fires (`debitQc` is the current canonical entry
point), the route reads the qube's chosen mode and dispatches:

```
mode === 'atomic'    → attemptCustodialSettlement (shipped)
mode === 'deferred'  → debit DVN directly; queue Mainnet reconciliation
mode === 'remote'    → debit the configured remote custody persona instead
                       of the user's own persona
```

Today's `debitQc` defaults to `atomic` (with x402 external-wallet
fallback when no custodial key). After the mode framework lands, the
route accepts an explicit `mode` parameter from the qube config.

---

## Schema additions (proposed)

```sql
-- Per-qube allowed modes (Studio super-admin layer)
ALTER TABLE experience_qubes
  ADD COLUMN allowed_payment_modes text[] NOT NULL DEFAULT '{atomic}';

-- Per-runtime-capsule chosen mode (admin customizer layer)
ALTER TABLE runtime_capsules
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'atomic'
    CHECK (payment_mode IN ('atomic', 'deferred', 'remote'));

-- Remote-custody persona pointer (when payment_mode = 'remote')
ALTER TABLE runtime_capsules
  ADD COLUMN remote_custody_persona_id text;
```

The exact table names need verification against the current schema —
this is the shape, not the literal DDL.

---

## Phasing

| Phase | Scope | Prereq |
|---|---|---|
| ✅ A | Atomic mode via custodial settlement | shipped 2026-05-22 |
| B | Wallet parity — SmartWallet drawer reads the same custodial address that `debitQc` settles from | Phase A stable in dev |
| C | Admin customizer radio group + tooltips + per-capsule persistence | Schema additions above |
| D | Studio super-admin allowed-set selector | Phase C deployed |
| E | Deferred mode + batch reconciliation worker | Phase D + the parity-backlog brief |
| F | Remote-custody mode | Phase E + cohort-pool wiring (separate workstream) |

Phases B and C can run in parallel after A is verified. D–F are
sequential.

---

## Open questions for the Studio surface

- **Where in Studio does the super-admin set `allowed_payment_modes`?**
  Likely the same panel that sets base price / surcharge, since the
  two are economically related. UI shape TBD.
- **Should the allowed-set be inheritable** from a parent qube /
  template, or always explicit per-qube? Default: explicit; consider
  template inheritance once we have a template tier.
- **Migration strategy** — every existing qube needs a default
  `allowed_payment_modes`. Proposal: `'{atomic}'` for paid qubes,
  `'{atomic,remote}'` if the qube belongs to a cohort with a sponsor.

---

## Out of scope for this backlog

- Frontend wallet-balance display unification (covered in the
  2026-05-22 parity brief)
- Bridge-to-other-chains routing (covered in the parity brief)
- KYC / fiat ramp (separate workstream)
