# Polity Alpha Pricing Framework — Canonical Commercial Architecture v1.0

**Status:** Canonised — admin-gated  
**Date:** 2026-06-25  
**Classification:** Operator/Admin only (Venture Lab α Docs tab, `adminOnly: true`)

---

## 1. Overview

The Polity Alpha commercial model is a two-ladder subscription architecture:

- **Citizen Ladder** — personal identity, standing, and participation tiers ($0 / $29 / $99 /month)
- **Founder Office** — venture creation and operation tiers ($299 / $999 / $2,999 /month)

The two ladders are **independent axes** (a citizen can enter the Founder Office without being a Steward), but the journey design nudges people up the citizen ladder first. Founder Office prices are **all-inclusive** — $299 bundles everything in Stewardship; you pay one monthly price for your highest active tier, not stacked subscriptions.

### Payment rails (metaMe subscriptions)

Accepted: **Q¢ · USDC · PayPal / direct card (stubbed for alpha)**  
KNYT is explicitly excluded from metaMe plan payments. KNYT remains an in-cartridge currency within the KNYT cartridge only.

---

## 2. Four Operator Archetypes

Every Polity member selects an operator archetype that composes with their tier label and biases their Next-Best-Experience recommendations:

| Archetype | Identity | Primary practice |
|---|---|---|
| **Entrepreneurial** | Entrepreneurial path | Ventures, markets, revenue |
| **Technical** | Technical path | DevOn, AigentZ, infrastructure |
| **Creative** | Creative path | Content, cultural production |
| **Citizen** | General participation | Governance, stewardship, community |

Archetype is selected in the Experience Model setup wizard and persisted as `operator_archetype` on the ExperienceQube.

---

## 3. Tier Definitions

### Tier 0 — Participation (Free)

**Label:** `<Archetype>` (e.g. "Entrepreneur", "Creative", "Citizen")  
**Code:** `plan_tier = citizen`, `venture_tier = none`

Included services:
- Polity Passport (apply, registry, locker)
- aigentMe (chat, Brief me, Move forward, NBE) — Haiku/mini model tier
- Standing Core (Level 1 — participation score, basic accrual)
- Basic Experience Model (1 primary goal, ≤ 3 KPIs, 1 cartridge)
- VentureQube Lite (1 venture, idea incubation) — outside Founder Office
- Operator Archetype selection
- Community participation (Qriptopian Pulse, KNYT public)

### Tier 1 — Sovereignty ($29/month)

**Label:** `Sovereign <Archetype>` (e.g. "Sovereign Entrepreneur", "Sovereign Creative")  
**Code:** `plan_tier = sovereign_citizen`

Additional services:
- Advanced Standing + Standing history and analytics
- Archetype-tagged standing scores (entrepreneurial / technical / creative / citizen pathway filters applied to the unified Standing score)
- Premium aigentMe — Sonnet model tier; better analysis and synthesis
- Enhanced Experience Model (multi-goal, multi-cartridge, confidential notes, lifted KPI cap)
- Credential depth unlock (deeper VSP fact verification)
- Early venture discovery (read-only Founder Office preview)
- **DevOn / AigentZ lite** — developers incubate pre-Founder-Office projects and graduate them as ventures when ready; full operational DevOn is Founder Office ($299+)

### Tier 2 — Stewardship ($99/month)

**Label:** `<Archetype> Steward` (e.g. "Entrepreneur Steward", "Creative Steward")  
**Code:** `plan_tier = steward`, `standing_tier = professional`

Additional services:
- Full Standing profile — Level 3 Professional, reports and analytics, opportunity-matching
- Steward privileges — governance rights within the Polity (`passport_citizen_privileges`)
- "Act as Aigent" — first tier of delegated AI action. Evolves to include: deeper specialisation, persistent memory, subject matter expertise, and eventually putting the aigentMe out as a consultant-for-hire. This is the steward-grade delegation entitlement and grows with platform capability.
- Founder discovery + Founder Office setup readiness (preview surface, distinct from operational Founder Office)
- HMS discovery (operational HMS at Founder Office)
- Community leadership roles (cartridge steward roles)
- Priority support

### Tier 3 — Founder Office Operator ($299/month)

**Label:** Founder Office Operator (+ archetype context from venture)  
**Code:** `venture_tier = lite`

Includes everything in Stewardship (all-inclusive), plus:
- Venture Lab cartridge + Founder Office (full access)
- VentureQube Pro (13-layer schema)
- Operating model / Operating Brief
- Full aigentMe + AI delegation + CRM — Sonnet/Opus model tier
- Marketa (campaigns and relationship building)
- metaMe Studio
- HMS (operational)
- Opportunity management (CRM)
- 1 active venture on Pro schema

### Tier 4 — Operator Plus ($999/month)

**Label:** Operator Plus  
**Code:** `venture_tier = pro`

Includes everything in Tier 3, plus:
- 3 active ventures
- Portfolio wizard (cross-venture thesis and priorities)
- Professional Standing (bundled)
- Cross-venture coordination

### Tier 5 — Portfolio Operator ($2,999/month)

**Label:** Portfolio Operator  
**Code:** `venture_tier = elite`

Includes everything in Tier 4, plus:
- Unlimited ventures
- PortfolioQube + Portfolio Operating Model
- Executive aigentMe (Opus model tier — top model routing)

---

## 4. Service → Tier Matrix

| Service | Tier 0 (Free) | Tier 1 ($29) | Tier 2 ($99) | Tier 3 ($299) | Tier 4 ($999) | Tier 5 ($2,999) |
|---|---|---|---|---|---|---|
| Polity Passport | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| aigentMe (basic) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI model tier | Haiku | Sonnet | Sonnet | Sonnet | Sonnet | Opus |
| Standing (Level 1) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Standing history + analytics | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Archetype-tagged standing scores | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Professional Standing (Level 3) | — | — | ✅ | ✅ | ✅ | ✅ |
| Enhanced Experience Model | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| "Act as Aigent" delegation | — | — | ✅ | ✅ | ✅ | ✅ |
| Steward privileges | — | — | ✅ | ✅ | ✅ | ✅ |
| Founder Office preview | — | ✅ | ✅ | — | — | — |
| HMS discovery | — | — | ✅ | — | — | — |
| Venture Lab (Founder Office) | — | — | — | ✅ | ✅ | ✅ |
| VentureQube Pro schema | — | — | — | ✅ | ✅ | ✅ |
| Operating model / Brief | — | — | — | ✅ | ✅ | ✅ |
| DevOn / AigentZ lite | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| DevOn / AigentZ full | — | — | — | ✅ | ✅ | ✅ |
| Marketa | — | — | — | ✅ | ✅ | ✅ |
| metaMe Studio | — | — | — | ✅ | ✅ | ✅ |
| HMS (operational) | — | — | — | ✅ | ✅ | ✅ |
| Venture limit | 1 (Light) | 1 (Light) | 1 (Light) | 1 (Pro) | 3 (Pro) | ∞ (Pro) |
| Portfolio | — | — | — | — | ✅ | ✅ |
| Executive aigentMe (Opus) | — | — | — | — | — | ✅ |

---

## 5. Code ↔ Pricing Reconciliation

### Citizen ladder (`plan_tier`)

| Pricing tier | `plan_tier` value | Status |
|---|---|---|
| Tier 0 (Free) | `citizen` | ✅ exists |
| Tier 1 ($29 Sovereignty) | `sovereign_citizen` | ✅ exists (free today; checkout wires the price) |
| Tier 2 ($99 Stewardship) | `steward` | ⬜ new value — migration `20260625000002` |

Legacy values `citizen_plus` and `first_citizen` are reserved for future use.

### Founder Office ladder (`venture_tier`)

| Pricing tier | `venture_tier` value | Status |
|---|---|---|
| Tier 3 ($299 Operator) | `lite` | ✅ wired |
| Tier 4 ($999 Operator Plus) | `pro` | ✅ wired |
| Tier 5 ($2,999 Portfolio) | `elite` | ✅ wired |

---

## 6. Architecture Decisions

**D1 — Independent axes, sequential journey.** You do not have to be a $99 Steward to buy the $299 Operator. The NBE journey nudges people up the citizen ladder, but the tiers are independently purchasable. Matches the code; avoids forcing a stack.

**D2 — Founder Office is all-inclusive.** Buying Operator ($299) includes everything in Stewardship ($99). One monthly price for the highest active tier; not stacked subscriptions.

**D3 — Alpha billing = wallet-debit-on-period-end.** Q¢/USDC/PayPal rails are live for one-time debits. A period-end cron debits and flips `persona_plans.status`. Card subscription processors (Stripe recurring) are deferred to post-alpha.

**D4 — KNYT excluded from plan payments.** KNYT is an in-cartridge currency for KNYT cartridge activities. metaMe subscription payments accept Q¢, USDC, and PayPal/card (stubbed). No KNYT bleed into the metaMe payment rails.

**D7 — DevOn/AigentZ lite at Sovereignty tier.** To support developers who incubate projects pre-Founder-Office, a lite access mode for DevOn/AigentZ is unlocked at Tier 1 (Sovereignty, $29). This lets a Technical pathway citizen build and iterate on a project, then graduate it into the Founder Office as a venture when ready. Full operational DevOn access (the "Technical Operator" Founder Office practice) remains Tier 3 ($299+). Code: `aigentzLiteAccess = sovereignAccess`.

**D5 — Standing stays unified; archetype pathway filters added.** The Standing scoring engine is one system. Tier 1 and above unlock archetype-tagged standing views: entrepreneurial / technical / creative / citizen pathway score filters applied to the unified score vector.

**D6 — "Act as Aigent" is Steward-grade and evolves.** The first unlock is Steward tier ($99). The capability grows over time: deeper specialisation, persistent memory, subject matter expertise, and eventually offering the aigentMe as a consultant-for-hire. The code gate is `steward_role` on `passport_citizen_privileges`.

---

## 7. Build Sequencing

| Step | Work | Status |
|---|---|---|
| 1 | Service↔tier mapping and decisions | ✅ this doc |
| 2 | `steward` plan_tier migration + label helper | 🔧 migration `20260625000002` |
| 3 | `plan_price_config` table + admin editor | 🔧 in progress |
| 4 | `/api/billing/checkout` (quote → debit → plan flip → DVN receipt) | ⬜ |
| 5a | AI model routing per tier (Haiku / Sonnet / Opus) | ⬜ |
| 5b | Archetype-tagged standing score filters | ⬜ |
| 5c | Experience Model soft-cap at Tier 0 + lift at Tier 1 | ⬜ |
| 5d | Steward privileges on `passport_citizen_privileges` | ⬜ |
| 5e | Preview surfaces for Founder Office at Tier 1 | ⬜ |
| 6 | Renewal cron (wallet-debit-on-period-end) | ⬜ |
| 7 | Upgrade NBEs in commercial spine; plan in `getActivePersona` | ⬜ |

---

## 8. Payment Flow (sketch)

**Entry points:**
- Locked surface → "Unlock with [tier]" upgrade pill
- SmartWalletDrawer → "Upgrade plan"
- NBE → "Upgrade to Sovereign to unlock Standing history"

**Flow:**
1. Upgrade modal → tier summary + price (USD primary)
2. Rail picker: Q¢ · USDC · PayPal (KNYT not offered for plan payments)
3. Confirm → debit → `persona_plans` upsert → DVN receipt in myLedger
4. Unlocked surfaces re-render (plan in `cartridgeFlags`)

**Renewal:** shows `current_period_end` in wallet; cron debits at period end; insufficient balance → `past_due` + grace + downgrade to free.

---

## 9. Archetype Label Composition

Display labels are composed, not stored separately:

```
label = tierPrefix(plan_tier) + archetypeNoun(operator_archetype)

Tier 0 citizen  →  "Citizen" / "Entrepreneur" / "Technical" / "Creative"
Tier 1          →  "Sovereign Citizen" / "Sovereign Entrepreneur" / "Sovereign Technical" / "Sovereign Creative"
Tier 2          →  "Citizen Steward" / "Entrepreneur Steward" / "Technical Steward" / "Creative Steward"
```

Founder Office tiers use the venture label directly: "Operator", "Operator Pro", "Portfolio Operator".
