# HMS — Progressive Disclosure & Engagement Protocol (PDEP) + Adaptive Disclosure Tempo Framework (ADTF)

**Date:** 2026-06-17  
**Classification:** BlakQube Governance Standard  
**Applies To:** Human Mobility Services · SRB · IES · PSC-001 · Capability Preservation Cases

---

## What Changed

The IES disclosure model was upgraded from **selective disclosure** (who gets what) to **progressive disclosure** (who gets what, and when). This is the PDEP + ADTF implementation.

The key distinction:
- **Selective disclosure** answers: *Who gets access to what?*
- **Progressive disclosure** answers: *When do they get access?*

In capability-preservation cases, timing is as important as content. The founder's identity, reputation, business relationships, family details, and financial circumstances are assets that remain protected until there is a demonstrated need for disclosure.

---

## Foundational Principle

**The objective of initial engagement is pathway discovery, not identity disclosure.**

Before identity is disclosed, the system first determines:
- Whether the institution is relevant
- Whether the institution has a pathway
- Whether the institution has discretion
- Whether the institution can assist
- Whether further engagement is warranted

**Need-to-know is insufficient. The system also enforces need-to-know-now.**

In capability-preservation cases, identity is an asset. It must not be disclosed merely because communication has begun.

---

## PDEP — Four Engagement Stages

| Stage | Name | What's Disclosed | PII |
|-------|------|-----------------|-----|
| 0 | Anonymous Context Discovery | Pathway exists? Case type, capability/continuity profile | None |
| 1 | Pseudonymous Case Disclosure | Household composition, citizenship, destination, timeline | None |
| 2 | Authorized Identity Disclosure | Names, contact info, supporting docs | After pathway validation + principal authorization |
| 3 | Operational Disclosure | Only what's required for a specific service | Proportional |

---

## PDEP — Disclosure Packages

| Package | Contents | PII |
|---------|----------|-----|
| A | Case type, capability profile, continuity profile, objectives | None |
| B | Household composition, citizenship, destination, timeline, continuity requirements | None |
| AB | A + B combined (Strategic Context) | None — accelerated tempo default |
| C | Names, contact details, approved identifiers, supporting documentation | Yes — requires authorization |
| D | Only information required for a specific service execution | Proportional |

---

## ADTF — Engagement Tempo

| Tempo | Use Case | Sequence | Package Flow |
|-------|----------|----------|-------------|
| Standard | Flexible timelines | S0 → S1 → S2 → S3 | A → B → C → D |
| **Accelerated** | **Default for founder/family repatriation** | S0+S1 → S2 → S3 | AB → C → D |
| Emergency | Safety/displacement/legal risks | S0+S1+S2 → S3 | ABC → D |

**Accelerated Tempo is the default for this case.** The compressed timeline (30-day deadline, September school intake) justifies rich anonymous context with deferred identity disclosure.

---

## IES Integration

Every institution in the IES now carries:
- `engagement_stage` (0–3): the PDEP stage for initial outreach
- `recommended_package` (A/B/AB/C/D): the disclosure package to use
- `expected_response`: what a useful institutional response looks like
- `escalation_criteria`: conditions that justify advancing to the next stage

The IES-level `engagement_tempo` field records the overall case tempo (standard/accelerated/emergency).

---

## Outreach Email Doctrine

The first email to any institution (Stage 0 or 1) using Package A, B, or AB:
- Contains **no names**, no addresses, no personal identifiers
- Uses "a British founder-led household with dependent children" — not the subject's name
- Objective: determine if a pathway exists

**Example Stage 0 / Package AB opening (British Consulate):**

> "We are writing to enquire about available pathways and guidance for a British founder-led household with dependent children seeking urgent repatriation from the United States to London. The household requires guidance on educational continuity, housing continuity, and professional re-establishment support ahead of the September school intake."

**Only after** the institution demonstrates relevance, capability, and willingness to engage does the system advance to Stage 2 (Package C) with identity disclosure.

---

## Subject Email Address

The subject's email address is a **unique identifier (T0)**. It must never appear in outreach emails. The Marketa system inbox handles all institutional correspondence, with per-case forward addresses for response routing.

---

## Files Modified

| File | Change |
|------|--------|
| `app/api/mobility/cases/[caseId]/ies/route.ts` | Updated IES generation prompt to include PDEP fields (engagement_stage, recommended_package, engagement_tempo, expected_response, escalation_criteria) |
| `app/api/mobility/cases/[caseId]/ies/draft-outreach/route.ts` | Rewrote disclosure package builder using PDEP Package A/B/AB/C/D model; enforces anonymity for Stage 0/1 |
| `app/triad/components/codex/tabs/MobilityIESTab.tsx` | Updated Institution interface with PDEP fields; replaced DisclosureBadge with PackageBadge (shows package + stage); OutreachModal shows anonymity notice for A/B/AB packages; recipient fields optional for anonymous packages |

---

## Engagement Loop Model

```
Send → Receive → Assess → Authorize → Respond
```

Not: Send → Disclose Everything

Every institutional relationship is managed as a staged dialogue. Stage escalation requires agent validation, policy validation, and principal authorization. No stage advances automatically.
