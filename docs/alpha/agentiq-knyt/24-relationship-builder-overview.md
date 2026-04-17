# AVL Relationship Builder α — Overview
*Doc 24 of 29 — Relationship Builder surface for Venture Lab α*

---

## What It Is

The **AVL Relationship Builder** is a venture-studio relationship surface for managing and composing communications, journeys, and next-best-experiences for both partners and customers, led by Marketa and powered by Studio.

It is the primary internal operator surface for AgentiQ Ventures (AVL) — consolidating partner relationship management, customer/end-user relationship management, and Venture Lab pipeline visibility into a single studio-grade interface.

**Internal AVL must support both partner relationship management and customer/end-user relationship management. This gives the venture studio a single surface for orchestrating communications to both partners and customers, while also monitoring the ascension of consumers and franchisees up the KNYT ladder into future Venture Lab pipeline candidates.**

---

## Why Both Surfaces

The AVL operates across two relationship axes simultaneously:

| Axis | Audience | Purpose |
|------|---------|---------|
| **Partner** | Web3 orgs, ecosystem allies, Wave 1/2 outreach targets | Co-activation, co-marketing, BD conversations, integration proposals |
| **Customer / End-User** | KNYT investors, backers, collectors, community members | Ladder ascension, patronage progression, loyalty, re-engagement, referral |

A single operator surface — not two separate tools — makes cross-axis context visible. A customer who becomes a franchise holder is also a partner candidate. A partner contact who holds Zero KNYTs is also a customer. The Relationship Builder surfaces this.

---

## Core Mode: Internal Operator

The internal AVL mode has eight primary navigation sections:

| Section | What It Manages |
|---------|----------------|
| **Partners** | Wave 1/2 partner contacts, outreach status, BD pipeline, co-activation tracking |
| **Customers** | Investor and backer CRM, cohort management, ladder ascension, progression monitoring |
| **Programs** | Active campaign programs — KNYT Wheel, Kickstarter, post-campaign sequences |
| **Composer** | Studio-powered message and journey authoring for both partner and customer audiences |
| **Packs** | Content and communications packs — approved templates, signal sequences, playbooks |
| **Reports** | Campaign signals, engagement analytics, ladder movement, partner response rates |
| **QubeTalk** | Internal agent-to-agent coordination, Marketa delegation interface |
| **Settings** | Audience rules, permission gates, integration config |

---

## Marketa as Lead Agent

Marketa is the primary agent for the Relationship Builder. She:

- Holds the KNYT Wheel KB (19 operator docs indexed in metaKnyts domain)
- Manages campaign copy, investor activation sequences, and partner outreach logic
- Composes both partner comms and customer NBE prompts via Studio
- Can be delegated to via QubeTalk by Aigent Z or the operator
- Coordinates with Know1 for KNYT world context injection into customer-facing content

---

## Studio Integration

The Composer section is powered by the Studio infrastructure already built in AgentiQ Alpha:

- **Plan → Experience tab**: Experience Matrix cell prescriptions drive personalised customer content
- **Design tab**: Template authoring for both partner outreach emails and customer re-engagement sequences
- **Workflows tab**: Sequence automation — trigger-based sends, stage-change hooks
- **Surfaces tab**: Destination mapping — email, SMS, Runtime surface, in-product chip
- **Pipeline tab**: Content in flight — drafts, scheduled, delivered, signal-returned
- **Receipts tab**: DVN receipt trail for every sent communication

---

## Current Campaign Context

The Relationship Builder launches in the context of the live KNYT/Kickstarter campaign:

- **Wave 1 partners (16):** Autonomys → PubKey — first contact outreach
- **Wave 2 partners (2):** Comic Republic, World Class Scholars — activate on Wave 1 ignition signal
- **Investor cohorts:** cohort_zero_knyt_legacy_1000_plus (priority), A–F cohorts, offer-fit tags
- **Customer ladder stages:** OutsideOrder → Sat KNYT (7 patronage stages), Lurker → Champion (8 PCS stages)

The Relationship Builder makes these structures navigable and actionable from a single operator surface.

---

## Relationship to Other Platform Surfaces

| Surface | Relationship |
|---------|-------------|
| KNYT Runtime | Customer-facing; Relationship Builder drives the NBE / capsule prescriptions shown there |
| Experience Matrix | Source data for customer segment mapping; Relationship Builder reads and acts on it |
| Marketa Cartridge | KB home; Relationship Builder is the action surface above Marketa's knowledge layer |
| Qriptopian Cartridge | MoneyPenny handoff; multi-chain partner interactions can route here |
| AgentiQ Studio | Composer is powered by Studio's Plan/Design/Workflows tabs |
