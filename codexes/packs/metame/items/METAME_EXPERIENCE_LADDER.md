# metaMe Experience Ladder — Detail

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-07

---

## Purpose

The Experience Ladder defines two dimensions of progression in the metaMe experience matrix:

1. **Y-axis — PCS engagement level** (this document): what type of creative agency a person exercises — from passive recipient to active steward
2. **X-axis — Sovereignty journey** (see `METAME_SOVEREIGNTY_LADDER.md`): how embedded and invested they are in the ecosystem — from Visitor to Architect

This document covers the **Y-axis**: the abstract canonical engagement form and its renderings.

---

## Abstract canonical form (Y-axis)

The architecture that all renderings derive from:

```
Recipient      — receives, consumes, is served
Selector       — chooses, curates, preferences emerge
Modifier       — adapts, adjusts, begins to shape
Producer       — creates, contributes, makes things
Builder        — constructs systems, architectures, workflows
Steward        — governs, maintains, guides, protects
```

This is universal. It does not depend on sector, world, or domain. It is the **Y-axis** of every experience matrix.

---

## PCS rendered form (AgentiQ ecosystem)

The Progressive Creative Sovereignty ladder:

```
Participant         — engages with the ecosystem
Community           — participates in shared activities and groups
Correspondent       — elevated participant, recognized contribution
Operator            — manages systems, leads operations
Creator             — produces original assets, experiences, workflows
Upstream contributor — shapes the platform itself via AgentiQ OS
```

This is the primary progression model used across the AgentiQ alpha ecosystem. It is the **canonical metaMe default Y-axis** referenced in Studio, the Journey Dashboard, and the experience matrices.

---

## Sovereignty journey — the X-axis

The canonical metaMe sovereignty ladder defines the X-axis of the experience matrix:

```
Visitor → Initiate → Participant → Curator → Composer → Operator → Architect
```

Full spec: `METAME_SOVEREIGNTY_LADDER.md`

Cartridges render their own branded equivalents. KNYT maps: Prospect → Acolyte → Keta → Keji → First → Zero KNYT → Sat KNYT.

---

## KNYT rendered form

For the KNYT live world (Patronage Axis × PCS Axis):

```
Observer                           → PCS: passive
Collector                          → PCS: first ownership/patronage
Curator                            → PCS: taste and preference
Remixer                            → PCS: creative agency
Creator                            → PCS: original production
Correspondent / Worldbuilder       → PCS: elevated contributor
Steward                            → PCS: governance and maintenance
Franchise-aligned Sovereign        → PCS: apex world-shaper
```

Cross-referenced with Patronage Axis: Outside the Order → Acolyte → Keta → Keji → First → Zero → Satoshi.

---

## Sector rendered examples

| Sector | Ladder |
|--------|--------|
| Healthcare | Patient → Organizer → Self-advocate → Care contributor → Care designer → Community health steward |
| Government | Citizen → Navigator → Participant → Contributor → Service co-designer → Civic steward |
| Education | Learner → Self-directed learner → Peer teacher → Content creator → Curriculum contributor → Education steward |
| Finance | User → Saver/Investor → Portfolio curator → Financial advisor → Product designer → Ecosystem builder |

The same canonical movement (Recipient → Steward) expresses differently per sector.

---

## Ladder usage in the stack

The ladder supports:

| Function | Description |
|----------|-------------|
| Current stage detection | `journey_states.depth` + `experience_matrices.depth_ladder` |
| Recommended next stage | NBE plan `next_experience` + `depth_step` |
| Permitted actions | Governance overlay `role_permissions` by stage |
| Unlock conditions | `experience_matrices.unlock_conditions` |
| Signal thresholds | Signal capture → `signal_meaning` → permission/reward effect |
| Reward pathways | `reward_eligibility_rules` per stage |
| Contribution pathways | `contributor_pathway_flag` set when Creator/Correspondent stage reached |

---

## PCS visibility requirements (alpha)

For the alpha, a user should be able to see:

1. **Current PCS stage** — where they are now
2. **Next PCS stage** — what they are moving toward
3. **Why it matters** — one-line explanation of what changes at the next stage
4. **What unlocks it** — the action or signal threshold that triggers progression
5. **Reward/contribution cue** — whether crossing this threshold earns $KNYT or opens a contributor pathway

This requires: `journey_states` record per persona + `experience_matrices.depth_ladder` populated with PCS stage labels.

---

## Stack implementation gap (Phase D — WS5)

The `experience_matrices.depth_ladder` field exists in the schema but needs populating with PCS stage labels for the AgentiQ strategy. This is a seed migration.

Required data:
```yaml
strategy: AgentiQ Alpha
stages:
  - level: 0
    label: Participant
    unlock: first_participation_signal
  - level: 1
    label: Community
    unlock: repeat_participation + 3 signals
  - level: 2
    label: Correspondent
    unlock: curation_or_remix + community_action
  - level: 3
    label: Operator
    unlock: contribution_submission_accepted
  - level: 4
    label: Creator
    unlock: repeated_accepted_contributions
  - level: 5
    label: Upstream contributor
    unlock: contributor_pathway_flag + Aigent C handoff
```

See `docs/alpha/build-plan.md` WS5 for delivery sequencing.
