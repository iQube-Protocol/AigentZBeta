# Phase 1.5 – KNYT Rewards System (Tier 0)

**Copilot Knowledge Base: Pricing, Tasks, and Rewards**

## Overview

KNYT is the native token of the KNYT Codex / KNYTMall ecosystem. In Phase 1 (Tier 0), KNYT operates as ledger credits within the x402/QriptoSmart Wallet system:
- **No on-chain transfers** - All KNYT is tracked in the DVN ledger (Supabase mirror)
- **No canonical rights** - Content access is via entitlements, not NFT ownership
- **Gas-free** - Users don't need external wallets or ETH for gas

---

## Pricing Configuration

### Pricing Knobs (Phase 1 Defaults)
| Parameter | Value | Description |
|-----------|-------|-------------|
| `knytUsdRate` | $1.40 | 1 KNYT = $1.40 USD |
| `fiatFeePercent` | 3% | Processing fee for fiat payments |
| `fiatPremiumPercent` | 7% | Premium added to fiat prices |
| `knytDiscountPercent` | 20% | Discount when paying with KNYT |
| `usdcFeePercent` | 1% | Processing fee for USDC payments |

### Multi-Rail Pricing Formula
```
Base Price: Set in KNYT (e.g., 3 KNYT for a scroll)
USD Base: baseKnyt × knytUsdRate

Q¢ Rail:    usdBase (no fees)
KNYT Rail:  baseKnyt × (1 - knytDiscount) = 20% off
USDC Rail:  usdBase × (1 + usdcFee)
PayPal Rail: usdBase × (1 + fiatFee + fiatPremium)
```

### Content Pricing (KNYT Base Prices)
| Product Type | KNYT Price | USD Equivalent |
|--------------|------------|----------------|
| Single Scroll (Still) | 3 KNYT | $4.20 |
| Single Scroll (Motion) | 5 KNYT | $7.00 |
| Character Card (Still) | 2 KNYT | $2.80 |
| Character Card (Motion) | 4 KNYT | $5.60 |
| 3-Scroll Bundle (Still) | 8 KNYT | $11.20 |
| 5-Scroll Bundle (Still) | 12 KNYT | $16.80 |
| 3-Scroll Bundle (Motion) | 12 KNYT | $16.80 |
| 5-Scroll Bundle (Motion) | 18 KNYT | $25.20 |
| Season Codex (Stills) | 25 KNYT | $35.00 |
| Season Codex (Motion) | 40 KNYT | $56.00 |

---

## Hero Tasks (Earn KNYT)

### 1. Bring a Knight (Referral Program)
**Earn KNYT by inviting friends to join the Order.**

| Reward | Amount | Trigger |
|--------|--------|---------|
| Referrer Bonus | 2 KNYT | When referred user makes first paid purchase |
| New User Welcome | 1 KNYT | Granted to new user on first paid purchase |

**How it works:**
1. Share your unique referral link (FIO handle-based)
2. Friend signs up using your link
3. When they make their first purchase, both earn KNYT
4. Referral is tracked via `referrer_persona_id` in personas table

### 2. Knight of Attention (Engagement Rewards)
**Earn KNYT by watching episodes and building streaks.**

| Reward | Amount | Trigger |
|--------|--------|---------|
| Episode Complete | 0.5 KNYT | Complete an episode (≥90% watched) |
| Weekly Streak | 0.5 KNYT | Complete 2+ episodes in a calendar week |
| 4-Week Bonus | 2 KNYT | Maintain streak for 4 consecutive weeks |

**Streak Rules:**
- Week runs Monday-Sunday
- Need 2+ episode completions per week to maintain streak
- Missing a week resets streak counter
- Maximum 1 episode completion reward per episode per user

### 3. Herald of the Order (Social Sharing)
**Earn KNYT by sharing content and driving engagement.**

| Milestone | Amount | Trigger |
|-----------|--------|---------|
| 10 Clicks | 0.25 KNYT | 10 unique clicks on your share links |
| 25 Clicks | 0.50 KNYT | 25 unique clicks |
| 50 Clicks | 1 KNYT | 50 unique clicks |
| 3 Signups | 1 KNYT | 3 users sign up via your links |
| 10 Signups | 2 KNYT | 10 users sign up |
| 1 Conversion | 2 KNYT | 1 user makes a purchase via your link |

---

## Reputation Tiers & Multipliers

Reputation tiers are seeded from investor order tiers and affect reward amounts.

| Order Tier | Reputation Tier | Multiplier | Description |
|------------|-----------------|------------|-------------|
| None | `non_investor` | 1.0× | Default for non-investors |
| Knight | `knight` | 1.05× | Entry-level investor |
| Baronet | `baronet` | 1.10× | |
| Baron | `baron` | 1.15× | |
| Viscount | `viscount` | 1.20× | |
| Earl | `earl` | 1.25× | |
| Marquess | `marquess` | 1.30× | |
| Duke | `duke` | 1.35× | |
| SatKNYT | `satknyt` | 1.40× | Highest tier |

**Example:** A Duke completing an episode earns 0.5 × 1.35 = 0.675 KNYT

---

## Reward Caps

To prevent abuse, daily and monthly caps are enforced:

| Task Type | Daily Cap | Monthly Cap |
|-----------|-----------|-------------|
| Referral (Referrer) | 10 KNYT | 50 KNYT |
| Referral (New User) | 1 KNYT | 1 KNYT |
| Episode Complete | 5 KNYT | 30 KNYT |
| Weekly Streak | 2 KNYT | 8 KNYT |
| 4-Week Bonus | 2 KNYT | 2 KNYT |
| Social Clicks | 5 KNYT | 20 KNYT |
| Social Signups | 10 KNYT | 40 KNYT |
| Social Conversions | 20 KNYT | 100 KNYT |

---

## Entitlements (Tier 0)

### Entitlement Types
- **`tier_0_remote`** - Streaming/in-app access only (Phase 1 default)
- **`tier_1_download`** - Download access (future)
- **`tier_2_canonical`** - NFT ownership rights (future)

### Entitlement Policy
- **Perpetual by default** - `expires_at` is NULL
- **No auto-conversion** - Tier 0 does NOT auto-convert to canonical mints
- **Explicit grants** - Entitlements are explicitly granted on purchase

---

## API Endpoints

### Rewards
- `POST /api/rewards/grant` - Grant a reward for task completion
- `GET /api/rewards/history?personaId=xxx` - Get reward history

### Entitlements
- `GET /api/entitlements/check?personaId=xxx&assetId=yyy` - Check access
- `GET /api/entitlements/list?personaId=xxx` - List all entitlements

### Engagement
- `POST /api/engagement/episode-progress` - Record episode progress
- `GET /api/engagement/streak-status?personaId=xxx` - Get streak status

### Purchases
- `POST /api/purchase/complete` - Process a purchase
- `GET /api/purchase/history?personaId=xxx` - Get purchase history

### Referrals
- `POST /api/referral/process` - Process referral at signup
- `GET /api/referral/stats?personaId=xxx` - Get referral stats

### Pricing
- `GET /api/pricing/content?productType=xxx` - Get multi-rail pricing

---

## Database Tables

### Core Tables
- `user_entitlements` - Content access rights
- `reward_grants` - Reward transaction records
- `reputation_events` - Reputation change history
- `products` - Product catalog with pricing
- `purchases` - Purchase records

### Engagement Tables
- `episode_engagement_events` - Episode watch events
- `weekly_engagement_streaks` - Streak tracking

### Sharing Tables
- `share_links` - Generated share links
- `share_clicks` - Click tracking
- `share_signups` - Signup attribution

### Persona Extensions
- `personas.order_tier` - Investor order tier
- `personas.reputation_tier` - Computed reputation tier
- `personas.referrer_persona_id` - Referral attribution

---

## Copilot Prompts

**For pricing questions:**
> "KNYT is priced at $1.40 USD. Paying with KNYT gives you a 20% discount. A single scroll costs 3 KNYT ($4.20), or 2.4 KNYT with the discount."

**For earning KNYT:**
> "You can earn KNYT three ways: 1) Refer friends (2 KNYT per conversion), 2) Watch episodes (0.5 KNYT each, plus streak bonuses), 3) Share content (earn from clicks, signups, and conversions)."

**For reputation:**
> "Your Order Tier determines your reward multiplier. Higher tiers earn more KNYT per task. Upgrade by investing or building reputation through contributions."

**For entitlements:**
> "When you purchase content, you get Tier 0 access - streaming and in-app viewing. This is perpetual and doesn't expire. Future phases will add download and NFT ownership options."
