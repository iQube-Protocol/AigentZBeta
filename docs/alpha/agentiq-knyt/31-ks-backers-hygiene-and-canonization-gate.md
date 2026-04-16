# KS Backers Hygiene and Canonization Gate

## Purpose

This document defines the transition gate between:
- Stage 1 — seeded cohort activation
- Stage 2 — cohort enrichment and expansion

Before expanding the KS Backers cohort, the seeded list must be cleaned, stabilized, and canonized.

## Why this is required

Without a hygiene gate, expansion compounds noise:
- poor deliverability
- duplicate outreach
- inaccurate reporting
- broken cohort logic
- weak Matrix and ladder routing

With a hygiene gate, Stage 2 begins from a clean, authoritative cohort asset.

## Required actions

### Deliverability hygiene
- remove or suppress hard bounces
- suppress repeated soft bounces per threshold
- process unsubscribes immediately
- mark invalid records clearly

### Record hygiene
- deduplicate contacts
- normalize identifiers
- normalize source fields
- identify canonical record vs duplicate records

### Engagement hygiene
Classify records by:
- not_contacted
- sent
- opened
- clicked
- replied
- converted
- unresponsive

### Segmentation hygiene
Reclassify records into:
- deliverable_active
- deliverable_unengaged
- bounced
- unsubscribed
- suppressed
- deduplicated_primary
- deduplicated_secondary
- high_engagement
- likely_continuity_candidate
- likely_ladder_candidate

## Canonization

Canonization means:
- one authoritative KS Backers cohort object
- one approved cohort naming convention
- one clean reporting baseline
- one approved set of segmentation rules
- one CRM / AVL source of truth
- one approved base for Stage 2 expansion

## Recommended fields
- `cohort_id = ks_backers`
- `campaign_id = knyt_ks_campaign`
- `seed_source = imported_seed`
- `deliverability_status`
- `engagement_status`
- `suppression_status`
- `dedupe_status`
- `canonical_record`
- `canonized_at`
- `canonized_by`
- `stage_transition_ready`

## Transition gate

Stage 2 should not begin until:
- bounce handling is complete
- unsubscribe handling is complete
- suppression handling is complete
- deduplication is complete
- engagement scoring is complete
- canonical cohort state is recorded
- the cohort is approved as the authoritative KS Backers seed cohort

## One-line definition

This gate turns the imported KS Backers list into a clean, authoritative cohort asset before broader expansion begins.
