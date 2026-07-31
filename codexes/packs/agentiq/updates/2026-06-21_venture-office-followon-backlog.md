# Venture Office — follow-on backlog

**Date:** 2026-06-21
**Status:** backlog (stubbed — not built)
**Owner:** Venture Office / Founder Office Pro workstream

Items deferred for a focused Pro pass. The current builds deliberately do NOT
implement these; this is the canonical record so they aren't lost.

## 1. Studio matrix → venture-customer view aligned to business goals (Pro)

**Why:** The metaMe **Studio matrix is venture-customer-centric** — it shows
*where the individuals within a venture are* (the venture's customer base on
engagement × sovereignty), NOT the operator's own single position. The current
build rings the operator's own derived cell in the Studio, which is the wrong
representation there (operator position belongs on aigentMe (persona) + Venture
Lab (venture)).

**To build (Pro):**
- Drop the operator-cell ring from the Studio matrix.
- Scope the Studio customer matrix to the **active venture's** customers (the
  generalized `/api/venture/customer-matrix` already provides the distribution;
  scope it per venture rather than per tenant/platform).
- Overlay the venture's **business-goal targets** (target cohorts / conversion /
  passport + MRR targets from the VentureQube Commercial Operating Model layer)
  so the matrix reads as "customers vs the venture's goals."
- **Rename** the Studio matrix to signal it (e.g. "Venture Customer Matrix" /
  "Customer Experience Matrix").
- This is a venture-centric Pro feature — reinforces the Lite (persona) vs Pro
  (venture) split.

## 2. CRM ingestion into the venture-customer matrix (Pro)

**Why:** For the venture-customer matrix to reflect real customers, it needs a
CRM ingestion path so a venture's actual customer/contact data flows into the
engagement × sovereignty distribution (today the feed reads `journey_states`
only).

**To build (Pro):**
- A CRM ingestion connector that maps a venture's CRM contacts → persona/journey
  signals → the customer-matrix cells (engagement × sovereignty).
- Respect T0–T2: only aggregate/commitment data into the matrix; raw CRM PII
  stays server-side / in the venture's locker.
- Tie into the existing CRM substrate (`crm_personas`, `nakamoto_knyt_personas`
  pattern) generalized per venture.

## Relationship to other stubs
Tracked alongside the Step 4 scope stubs (`2026-06-21_ventureqube-lite-pro-step4-scope.md`):
Pro ExperienceGuide intake (Standing-fed), multiple metaMe Studio venture views,
Pro portfolio management. All are Founder Office Pro / Venture Office surface
area, gated by the plan-tier layer (Step 4).
