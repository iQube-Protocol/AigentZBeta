# Events and Tables Map (KNYT Tier 0 + Phase 1.5)

## Canonical principles

- Rewards and purchases in Phase 1/1.5 are Tier 0 only.
- The source of truth for KNYT balance changes is the x402/DVN ledger write path.
- Supabase tables are treated as the off-chain mirror/index for UI and reporting.

## Primary tables

- `wallet_balances`
  - **Role**: current balances by wallet/persona (e.g. `dvnKnyt` available/pending).
- `wallet_transactions`
  - **Role**: immutable ledger-like transaction history for credits/debits.
  - **Fields (conceptual)**: `wallet_id`, `asset`, `amount`, `direction`, `reason`, `reference_type`, `reference_id`, `metadata`, `created_at`.
- `event_logs` (EventQube)
  - **Role**: analytics/audit trail of user actions and reward triggers (non-financial).

## Event → ledger mapping

### Purchases

- `purchase.scroll.fiat.completed`
  - **Writes**: `wallet_transactions` (optional, if tracking fiat spend), plus entitlement rows (content access).
  - **Does not write**: KNYT balance.

- `purchase.scroll.knyt.completed`
  - **Writes**: `wallet_transactions` (KNYT debit)
  - **Updates**: `wallet_balances` (KNYT available decreases)
  - **Side effects**: entitlement rows (content access)

### Rewards (Phase 1.5)

- `reward.referral.qualified`
  - **Writes**: `wallet_transactions` (KNYT credit: referrer + welcome grant)
  - **Updates**: `wallet_balances`
  - **Also logs**: `event_logs` (qualification details)

- `reward.engagement.episode_completed`
  - **Writes**: `wallet_transactions` (KNYT credit)
  - **Updates**: `wallet_balances`

- `reward.engagement.weekly_streak`
  - **Writes**: `wallet_transactions` (KNYT credit)
  - **Updates**: `wallet_balances`

- `reward.social.share.milestone`
  - **Writes**: `wallet_transactions` (KNYT credit)
  - **Updates**: `wallet_balances`

## Idempotency + dedupe keys

- Rewards must be idempotent using a deterministic `reference_type` + `reference_id` tuple.
  - Example: `reference_type='episode_completion'`, `reference_id='{personaId}:{episodeId}'`.
- The ledger service should reject duplicates at write time (unique constraint or lookup) before crediting.
