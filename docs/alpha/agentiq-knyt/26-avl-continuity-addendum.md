# AVL Relationship Builder — Continuity Addendum
*Doc 26 of 29 — Post-Kickstarter continuity and long-term relationship architecture*

---

## Purpose

The Kickstarter campaign has a hard end date. The Relationship Builder must be designed from day one for continuity beyond it — so that the relationships built during the campaign (with partners and customers alike) do not go cold when the campaign closes.

This addendum defines the continuity architecture: what happens after KS closes, how customer ladder progression continues, how partner relationships evolve from activation to integration, and how the Venture Lab pipeline feeds from this surface.

---

## Post-Campaign Customer Journey

### Ladder progression continues
The patronage axis (OutsideOrder → Sat KNYT) and PCS axis (Lurker → Champion) are permanent structures — not campaign constructs. After KS closes:
- Backed customers progress along the ladder via product engagement, signal actions, and milestone completions
- The NBE prescription engine continues to serve personalised next-best-experiences
- $KNYT rewards for signal actions remain active

### Retention sequences
Three post-campaign phases:

| Phase | Trigger | Comms focus |
|-------|---------|------------|
| **Immediate post-campaign (0–30 days)** | KS campaign closes | Delivery timeline, collector content, world-building reveals |
| **Engagement window (30–90 days)** | Product delivery in progress | Behind-the-scenes, community building, PCS advancement prompts |
| **Ladder ascension (90 days+)** | Ongoing | Stage transition prompts, franchise path previews, advanced collector tiers |

### Franchise and consumer progression
Customers who reach First or Zero KNYT patronage stage become eligible for franchise consideration. The Relationship Builder should surface:
- Current First / Zero stage holders
- Customers trending toward those stages
- Customers who have explicitly expressed franchise interest (via signal or form)

These are the primary Venture Lab pipeline candidates.

---

## Post-Campaign Partner Journey

### From activation to integration
Wave 1 partners are first contacted for campaign amplification. After the campaign:
- Responsive partners move into deeper integration conversations
- Integration paths: SDK adoption, AgentiQ OS participation, co-branded campaigns, KNYT lore expansion
- The BD pipeline stage system covers both campaign and post-campaign phases

### Partner pipeline post-campaign stages
`co_activation_agreed → integration_scoped → integration_active → live_partner`

### Signal-driven deprioritisation
Partners who do not respond to Wave 1 outreach by campaign end are marked `low_signal` and move to a maintenance cadence — one check-in per quarter, not active outreach.

---

## Venture Lab Pipeline Visibility

The Relationship Builder is the primary surface for identifying Venture Lab pipeline candidates — both customers and partners who could graduate into deeper program relationships.

### Customer → Venture Lab candidate signals
- Patronage stage: First or Zero
- PCS stage: Ambassador or Champion
- Investment band: $2,000+
- Has expressed franchise interest
- Has referred ≥ 2 new backers (recruiter tag)
- Has contributed to the living canon

### Partner → Venture Lab candidate signals
- BD stage: co_activation_agreed or beyond
- Audience overlap: high
- Strategic value: tier 1
- Has engaged with AgentiQ OS or SDK

### Pipeline Candidate view
A dedicated view in the Customers section (and a summary card in Reports) that shows:
- All First/Zero stage customers
- All customers with recruiter tag
- All partners at co_activation or beyond
- Next-best-action for each candidate (from NBE prescription or partner pipeline)

---

## Data Continuity Requirements

To ensure relationship continuity across campaign phases, the following data must persist and not be reset at campaign close:

| Data | Table | Must Persist |
|------|-------|-------------|
| Patronage stage | `journey_states.stage` | Yes — permanent ladder |
| PCS stage | `journey_states.depth` | Yes — permanent |
| Campaign state tags | `crm_personas.campaign_state` | Yes — evolve, don't reset |
| $KNYT balance | `knyt_reward_events` | Yes — cumulative |
| DVN receipts | `dvn_receipts` | Yes — permanent audit trail |
| Partner outreach status | partner pipeline table | Yes — BD context is permanent |
| Offer fit tags | `crm_personas` custom fields | Yes — signals don't expire |

---

## Comms Continuity Beyond Campaign

Post-campaign comms sequences should already be authored (as Packs) before the campaign closes. The operator should not scramble post-close.

**Packs to prepare before campaign close:**
1. Post-campaign thank-you + delivery timeline (all backers)
2. Zero KNYT holder — exclusive content unlock
3. First KNYT holder — franchise path preview
4. Active community member — PCS advancement prompt
5. Dormant backer — 60-day re-engagement
6. Partner — post-campaign integration invitation

---

## AVL as Permanent Infrastructure

The Relationship Builder is not a campaign tool. It is the permanent relationship operating surface for AgentiQ Ventures. After the KNYT campaign it will manage:

- All future KNYT season communications
- Future cartridge launch campaigns (new IP)
- Partner integrations across Venture Lab α portfolio
- Customer ascension across all future ladder programs

Design it to last, not just to ship.
