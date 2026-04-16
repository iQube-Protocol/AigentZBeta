# AVL Relationship Builder — Customer Surface Addendum
*Doc 29 of 29 — Detailed spec for the customer/end-user relationship surface*

---

## Purpose

This addendum specifies the customer-facing axis of the AVL Relationship Builder in full detail. The customer surface is equally important as the partner surface — it is the primary mechanism for monitoring KNYT investor and backer progression, orchestrating personalised communications, and identifying who is ascending the ladder toward franchise and Venture Lab candidacy.

---

## Core Principle

**Internal AVL must support both partner relationship management and customer/end-user relationship management. This gives the venture studio a single surface for orchestrating communications to both partners and customers, while also monitoring the ascension of consumers and franchisees up the KNYT ladder into future Venture Lab pipeline candidates.**

---

## Customer Surface

### What "customer" means in AVL

In the AVL context, a **customer** is anyone in the KNYT investor/backer/community base — regardless of whether they have contributed financially. This includes:
- Current investors (cohorts A–F + Zero KNYT legacy)
- Kickstarter backers (ks_backed=true)
- Community members who have signalled interest (warmers)
- Past holders of KNYT digital assets
- Prospects who have opened or clicked campaign emails

The customer surface covers all 3748 synced personas plus any new personas added via campaign signals.

### Primary Customer Views

| View | Description |
|------|------------|
| **All Customers** | Full list, searchable, filterable by cohort/stage/campaign state |
| **Active Cohorts** | Grouped by cohort (A–F + Zero legacy) |
| **Campaign State** | Grouped by dormant / warming / reactivated / engaged / advocate / recruiter |
| **Ladder View** | Patronage × PCS heat map (who is where on the ladder) |
| **Pipeline Candidates** | Customers at/near First or Zero patronage, recruiters, high-value investors |
| **Near Transition** | Customers one action away from a ladder stage advance |

---

## Customer Cohort Management

### Cohort tags (from KNYT Partner + Investor Activation Addendum)
- `cohort_a_high_confidence_early_backer`
- `cohort_b_dormant_legacy_believer`
- `cohort_c_collector_oriented`
- `cohort_d_status_order_oriented`
- `cohort_e_digital_ecosystem_forward`
- `cohort_f_strategic_champion`
- `cohort_zero_knyt_legacy_1000_plus`

### Cohort management operations
- View all members of a cohort
- Add/remove cohort tag for a customer
- Bulk tag: apply cohort tag to a filtered set
- Move customer between cohort tags based on signal (signal-driven reassignment)
- See cohort-level campaign signal summary (open rate, click rate, conversion)

### Offer-fit tags (for campaign personalisation)
- `fit_top_knyt_shelf`
- `fit_zero_knyt`
- `fit_post_campaign_digital`
- `offer_interest_unknown`

Offer-fit determines which Kickstarter tier and post-campaign product the customer is routed toward in Composer.

---

## Ladder Ascension Monitoring

The patronage ladder (7 stages) and PCS ladder (8 stages) are the two axes of customer progression. Monitoring ascension is critical for:
- Knowing who to contact with next-best-experience prompts
- Identifying when a customer is ready for a deeper offer
- Surfacing pipeline candidates before they go cold

### Patronage stages (ascending)
`OutsideOrder → Acolyte → Keta KNYT → Keji KNYT → First KNYT → Zero KNYT → Sat KNYT`

### PCS stages (ascending)
`Lurker → Observer → Participant → Contributor → Curator → Remixer → Ambassador → Champion`

### Near-transition detection
A customer is "near transition" when they:
- Have completed the primary signal action for their current stage ≥ 1x
- Have not yet reached the next stage milestone
- Have been active within the last 30 days

Surface near-transition customers prominently with a suggested next action (from NBE prescription).

### Transition events
Log every ladder stage transition to a permanent audit trail. Display in customer detail view as a timeline.

---

## Venture Lab Candidate Pipeline

### Definition
A Venture Lab candidate is a customer who is ascending toward or has reached the level of engagement, investment, and community commitment that makes them a potential franchise holder or deep program participant.

### Candidate signals
| Signal | Weight |
|--------|--------|
| Patronage stage: Zero KNYT | High |
| Patronage stage: First KNYT | Medium-High |
| PCS stage: Ambassador or Champion | High |
| Investment band: $2,000+ | Medium |
| Campaign state: recruiter | High |
| Has referred ≥ 2 new backers | High |
| Has contributed to living canon | Medium |
| Has expressed franchise interest | Highest |

### Pipeline Candidate view
- Sortable table: candidate name, patronage stage, PCS stage, investment band, signals present
- One-click action: move to "Active Conversation" in the Franchise track
- Next-best-action for each candidate (from NBE prescription or custom operator note)
- Export list for operator review

### Franchise track progression
`candidate_identified → initial_conversation → franchise_scoped → franchise_active`

This is tracked in the customer record alongside the standard patronage ladder.

---

## Customer Comms Campaigns

### Campaign types available in Composer for customer audience
| Type | Trigger | Audience |
|------|---------|---------|
| Re-engagement | dormant > 30 days | cohort_b + dormant campaign state |
| KS offer | campaign active | cohort_a + cohort_d + offer-fit tagged |
| Backed welcome | ks_backed becomes true | all newly backed |
| Ladder prompt | near-transition detected | near-transition customers |
| Advocate unlock | advocate campaign state | cohort_f + advocate |
| Recruiter prompt | 1 referral made | all recent referrers |
| Post-campaign | KS campaign closes | all backers |
| Franchise path | Zero/First stage reached | pipeline candidates |

### Campaign state progression
Each customer moves through these states via signal:
`campaign_dormant → campaign_warming → campaign_reactivated → campaign_engaged → campaign_advocate → campaign_recruiter → campaign_contributor_champion`

The Relationship Builder must make these state transitions visible and actionable — operator can manually advance or trigger automated progression via sequence workflow.

---

## Customer NBE / Next-Best-Experience Orchestration

The Experience Matrix prescribes a next-best-experience for every `patronage_stage × PCS_stage` combination. The AVL Customer surface surfaces this prescription per customer.

### In customer detail view
- Current patronage stage + PCS stage
- Prescribed experience: depth label, CTA label, next step
- Delivery surface: email / SMS / Runtime chip / in-product
- Last prescription delivered date
- Signal returned (was it acted on?)

### Batch NBE dispatch
From the Customers section, operator can:
1. Filter to a cohort or stage group
2. Review the prescribed experience for that group
3. Compose and send the NBE prompt via Composer
4. Mark as delivered (records to DVN receipt)

---

## Customer Loyalty, Affiliate, and Referral Actions

### Loyalty
- Signal actions (like, spark, vote, contribute) earn $KNYT rewards
- Cumulative balance visible in customer detail
- Milestone rewards: hitting patronage stage milestones earns bonus $KNYT

### Affiliate / referral
- Each backer gets a unique referral link via Kickstarter or in-product
- Referral tracked by `crm_personas.recruiter_for` or custom tag
- Reward issued when referred person backs: fixed $KNYT amount
- Recruiter tag applied at ≥ 1 referral; champion recruiter at ≥ 5

### Operator actions
- View top referrers
- Issue bonus $KNYT manually for exceptional contributions
- Flag customer for franchise fast-track based on referral pattern

---

## Customer-to-Franchise / Customer-to-Pipeline Progression Visibility

A critical view in the Relationship Builder is a progression map showing where each customer sits on the combined ladder × pipeline path.

### Progression stages
```
Community Member (any stage)
  → Active Backer (ks_backed + PCS: Participant+)
    → Advocate (campaign_state: advocate)
      → Recruiter (campaign_state: recruiter + ≥1 referral)
        → Pipeline Candidate (First/Zero stage + signals)
          → Franchise Holder (franchise_active)
```

### Progression view
- Visual pipeline funnel showing counts at each level
- Drill into each level to see individual customers
- One-click to promote a customer to the next stage (with notes)
- Marketa can generate a personalised prompt for each stage transition

---

## Implementation Priority

| Component | Priority | Notes |
|-----------|----------|-------|
| Customer search (all records) | P0 | Reuse individual search fix pattern |
| Cohort view + filter | P0 | Critical for campaign ops |
| Customer detail (CRM + ladder + NBE) | P0 | Operator must see full picture |
| Near-transition monitoring | P1 | Key signal for NBE dispatch |
| Pipeline candidates view | P1 | Venture Lab pipeline visibility |
| Campaign state filter + bulk update | P1 | Campaign ops |
| Composer integration (customer comms) | P1 | Marketa-led drafting |
| Loyalty / referral summary | P2 | Post-campaign retention |
| Franchise track progression | P2 | Post-campaign |
| Progression funnel view | P2 | Strategic visibility |
