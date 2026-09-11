# PRD Amendment: Human Mobility Services Refactor

**Status:** Applied (amendment to Marketa Activation Engine PRD v0.1)
**Applied:** 2026-06-11

## Purpose

Replace the narrower "Mobility, Residency, and Being Services" framing with a
broader **Human Mobility Services** framework: executive travel, corporate
mobility, immigration, housing, relocation, lawful presence, residency, and
stateless citizen support are all instances of the same underlying mobility
capability stack. This creates a commercially attractive, high-frequency,
high-touch vertical while preserving the Polity's constitutional and
humanitarian mission.

**Definition.** Human Mobility Services are agentic services supporting the
movement, placement, accommodation, lawful presence, residency, continuity,
and coordination of people across short-, medium-, and long-term horizons.

## Reference architecture

Two dimensions:

**Dimension A — User context.**
- *Top reference case*: corporate mobility and executive travel (mobility
  teams, executive operations, CPOs, GCs, founder operators, relocation
  firms, corporate immigration providers, executive assistants). Core
  question: "How do we move the right person to the right place efficiently,
  lawfully, and with minimal friction?"
- *Bottom reference case*: stateless citizens and vulnerable populations
  (refugees, asylum seekers, housing-insecure individuals, NGOs, legal
  clinics). Core question: "Where can I safely be, remain, and build
  continuity?"
- User-facing labels remain **Exec / Vulnerable persons mobility** per the
  operator's standing UI mandate; the top/bottom model maps 1:1 onto them.

**Dimension B — Time horizon.**
- *Short-term* (hours–weeks): executive/business travel, conferences,
  roadshows; emergency relocation, crisis travel, temporary shelter routing,
  evacuation. "Where do I need to go now?"
- *Medium-term* (weeks–months): project assignments, secondments;
  transitional housing, temporary residency/work authorization, aid
  placement. "Where do I need to remain for the next several months?"
- *Long-term* (months–years): executive relocation, corporate immigration,
  residency planning; asylum pathways, permanent residency, citizenship.
  "Where can I build long-term continuity?"

## Shared mobility process spine (extended)

intake → identity profile → destination assessment → jurisdiction matching →
pathway eligibility → document preparation → travel coordination →
accommodation coordination → lawful presence support → partner routing →
status tracking → renewal/compliance → continuity planning.

Marketa prioritizes agents that support multiple process-spine stages.

## Discovery categories added

- **Travel**: business/executive travel, flight coordination, travel
  planning/compliance/risk agents.
- **Accommodation**: hotel, temporary accommodation, corporate housing,
  relocation housing agents.
- **Mobility operations**: executive assistant, scheduling, mobility
  coordinator, travel logistics, relocation coordinator agents.
- **Immigration and residency**: visa, immigration workflow, residency,
  document preparation agents.
- **Humanitarian mobility**: shelter routing, aid routing, refugee support,
  crisis mobility agents.

## Recruitment priorities (updated)

1. High-Yield Legal Services
2. **Human Mobility Services**
3. Agentic AI + Blockchain Infrastructure
4. Media, Communications, and Public Affairs
5. General aigentMe Service Agents

## Implementation mapping (what changed in code)

| Amendment item | Implementation |
|---|---|
| Terminology | Strategic lane `mobility_residency_being` → `human_mobility_services` (`services/marketa/activation/types.ts`); normalizers map the legacy value on every read path; data migration rewrites stored lanes |
| Schema `human_mobility` object | `HumanMobility` interface (horizons, top/bottom reference cases, `mobilityDomains` (11), `processSpineSupport`); stored in new `human_mobility` JSONB column (`supabase/migrations/20260611100000_marketa_human_mobility.sql`) |
| Process spine | `MOBILITY_SPINE_TAGS` extended: `destination_assessment`, `travel_coordination`, `accommodation_coordination`, `lawful_presence_support`, `continuity_planning` |
| Discovery categories | Classifier term lists extended (`MOBILITY_TERMS`, `MOBILITY_DOMAIN_TERMS`, horizon term lists) in `classification.ts`; new `classifyHumanMobility()` wired into `classifyCandidate()` |
| Scoring | `mobilityFrequencyScore`, `mobilityLeverageScore`, `mobilityContinuityScore` added to `CandidateScores` and computed in `scoring.ts`. **Informational for now** — the amendment defines no weights, so they do not feed `overallPriorityScore` until calibration assigns weights |
| UI | Scorecard grid shows the three mobility dimensions |
| Revenue categories / aigentMe integration / recruitment priorities | Documented here; no code surface yet (revenue categories land with the opportunity tracker; priorities inform operator triage) |

Top/bottom reference detection intentionally reuses the existing
Exec/Vulnerable classifiers so the amendment's model and the user-facing
tagging can never disagree.

## Strategic rationale

Human Mobility Services align economic value (executive travel, corporate
mobility, relocation), constitutional value (stateless citizens, lawful
presence, aid, housing, continuity), and operational value (high workflow
frequency, fast feedback loops, measurable outcomes, recurring engagement) —
and bridge Marketa, aigentMe, and the future activation marketplace, since
travel, mobility, accommodation, scheduling, immigration, relocation, and
executive support sit naturally at the intersection of agentic
chief-of-staff services and high-value commercial workflows.
