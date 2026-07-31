# Constitutional Capability Brief — <Capability Name>

<!--
  CCB v2 — the Constitutional Capability Brief (CFS-049) with CCR-001's
  completion sections added. THIS IS NOT A SECOND ARTIFACT FAMILY.

  CFS-049 Amendment A is binding here: the Capability Completion Artifact IS
  this Brief. `briefUrl` on services/constitutional/capabilityRegistry.ts stays
  the single pointer, and CFS-032 registration stays the acceptance ceremony.

  NAMING IS RATIFIED (operator, 2026-07-27): the format keeps the CCB name and
  is versioned. `CAPABILITY-<id>-<slug>.md` is NOT introduced alongside it.

  WHERE THE FILE GOES: `codexes/packs/agentiq/updates/YYYY-MM-DD_ccb-<slug>.md`,
  registered in `codexes/packs/agentiq/collections.json` under `col_updates`
  (CFS-049 §5). The markdown twin is the SOURCE OF TRUTH; the published
  Artifact is a rendering of it. Never author a JSON mirror of this document —
  the machine-readable `capability-completion-artifact/v2.0` shape is DERIVED
  from these headings by `parseCompletionArtifact()` in
  `services/constitutional/capabilityCompletionArtifact.ts`, and a hand-kept
  duplicate would be the `inv.engineering.036` defect this standard exists to
  eliminate.

  WHICH SECTIONS ARE MACHINE-READ: every `##` heading below marked (§7.x) is
  parsed. Keep the heading text; the prose beneath it is yours. Sections with
  nothing to report are KEPT and marked "None" — a missing section reads as an
  oversight, not as "not applicable" (CFS-049 §3).

  CFS-049 §3's nineteen Brief sections (Executive Summary, What Was Built,
  Where To Find It, How To Use It, Screens, User Journey, Limitations, Capability
  Tour, …) still apply. Add them around this frame; they are omitted here only
  because they are already specified in CFS-049 and are not re-specified by
  CCR-001.
-->

## Capability identity

<!-- §7.1 — machine-read as a `| Field | Value |` table. `Capability ID` MUST be
     the same key `RegisterCapabilityInput.capabilityId` uses in CFS-032, so the
     registry entry and this document are one capability, not two. -->

| Field | Value |
|-------|-------|
| Capability ID | `<registry-capability-id>` |
| Display label | <Human name> |
| Artifact version | 1.0 |
| Schema | `capability-completion-artifact/v2.0` |
| Date | <YYYY-MM-DD> |
| Governing documents | `<PRD-XXX-000>`, `<CFS-000>`, `<SPEC-XXX-000>` |
| Artifact path | `codexes/packs/agentiq/updates/<this-file>.md` |

## Behavioural capability statement

<!-- §7.2 / CCR-INV-7 — what the capability DOES, behaviourally. A reader who
     has never seen the code must be able to tell whether a reimplementation
     behaves correctly from this paragraph alone. `CAN-CCR-4` REFUSES a
     statement that is mostly code references: naming files is location, not
     capability. Write behaviour; the paths belong under Location. -->

<One paragraph, prose.>

## Purpose

<!-- §7.3 — why this exists. State the problem in the world, not the ticket. -->

<One paragraph.>

## Location

<!-- §7.4 — where it operates. Surfaces FIRST (what a citizen sees), source
     paths second. Both lists are machine-read. -->

### Surfaces
- <Navigation trail a person can follow in the running app>

### Source paths
- `<path/to/module.ts>`

## Invocation

<!-- §7.5 — how the capability is actually entered. One entry route per line. -->

- <Route / control / event that invokes it>

## Capability boundary

<!-- §7.6 — the section code cannot record, and the one that pays for itself.
     `Does not own` is REQUIRED and validated: a boundary with no stated
     exclusions is unfalsifiable. Most duplicated-ownership defects would have
     been prevented by one honest line here. -->

### Owns
- <What this capability, and only this capability, decides>

### Does not own
- <What it must never decide, and who does>

### Dependencies
- <What it needs in order to work at all>

### External authorities
- <Constraints imposed from outside: the identity spine, DVN, a third-party SDK>

### Emits

<!-- §7.6a / CB-3 (CFS-053) — REQUIRED, and required for a reason.

     An omitted section reads as "forgotten"; an empty one with a rationale
     reads as "none, deliberately"; a populated one reads as "these". Those are
     three different states, and an optional field collapses them into one —
     which is how a capability that SHOULD emit a receipt and does not (the
     IDE-6 finding) surfaces as an audit discovery instead of as an empty list
     where a list was expected. `CAN-CCR-9` refuses an omitted section.

     One entry per line, in exactly this shape (all three parts machine-read):

       - **<kind>** `<ref>` — <the act that writes it>

     `<kind>` is one of:
       receipt         — a `createActivityReceipt` action type
       durable-record  — a persisted row: a Supabase table, or another named store
       artifact        — an artifact_records / StudioArtifact-class output
       log             — a structured server log (the `[DVN ESCALATION]` class)

     `<ref>` is that kind's identifier: the ActivityActionType, the table or
     store, the format, the log prefix. A `receipt` ref is RESOLVED against the
     real `ActivityActionType` union by `CAN-CCR-9`, exactly as `CAN-CCR-5`
     resolves a canary path — an invented receipt type fails the build.

     `<the act that writes it>` names the invocation that actually emits it, so
     the claim can be checked against the code. Write what the code DOES, not
     what the governing document says it should; a brief that records an
     aspirational emission is worse than one that records none.

     If the capability emits nothing, write `- None` here and fill in the
     rationale below. Deleting the section is not the same thing. -->

- **<kind>** `<ref>` — <the act that writes it>

### Emission rationale

<!-- §7.6a — REQUIRED whenever `Emits` is empty, omitted otherwise. Why this
     capability legitimately emits nothing. An empty list with no rationale is
     "unknown", which is the state the field exists to eliminate.

     "Read-only; no state transition of record" is a valid rationale when it is
     TRUE (CFS-053 §5.3 bounds CB-3 to state transitions of record). It is not
     valid as a reflex: a capability that leaves no trace at all cannot be shown
     to have run, so if downstream readiness depends on knowing whether it ran,
     say that here rather than reaching for the convenient sentence. -->

<One paragraph, or omit the section entirely when Emits is non-empty.>

## Implementation freedom

<!-- §7.7 / CCR-INV-8 — reproduction does not require identical implementation.
     Say which parts may legitimately differ in a reimplementation and which
     may not. This is what stops the artifact freezing the code. -->

<One paragraph.>

## <INV-1> — <short name>

<!-- §7.7–7.9 — ONE SECTION PER INVARIANT, repeated. The heading must read
     `## <ID> — <short name>` (em dash), where `<ID>` is like `MS-4`. All four
     fields below are machine-read.

     - Provenance MUST come from the §8 vocabulary:
         regression-derived · integration-derived · pre-release-intercepted ·
         adversarially-derived · formally-derived · cross-capability-recurrence ·
         proposed
       `proposed` is the only unevidenced kind; `CAN-CCR-2` refuses any
       validated/canonical invariant that carries it.
     - Status is the SOURCE lifecycle value: the seed crystal's
       `proposed | validated | canonical`. It is never rewritten.
     - Stage is CCR-001 §9's own ladder, carried ALONGSIDE Status —
         observed · candidate · validated · ratified · canonical · deprecated
       RESOLVED BY MAPPING, NOT UNIFICATION (operator, 2026-07-27: "map, don't
       unify"). `FINDING_LIFECYCLE` stays pinned canon; the two ladders project
       onto one another and neither is rewritten into the other. Stage is
       OPTIONAL, but when present it must project onto Status
       (ratified/canonical → canonical, validated → validated,
       observed/candidate → proposed). The validator enforces the projection.
     - `Enforced by` MUST name at least one real test file for a `canonical`
       invariant (`CAN-CCR-3`), and every named file must exist (`CAN-CCR-5`).
       No prose-only enforcement. An invariant nothing tests is a slogan. -->

<The rule, stated as something that must remain true. One short paragraph.>

- **Provenance:** <one of the §8 kinds>
- **Status:** <proposed | validated | canonical>
- **Broke it:** <the defect that proved it, in enough detail to recognise a repeat>
- **Enforced by:** `tests/<file>.test.ts` — <what the canary actually asserts>

## Reproduction procedure

<!-- §7.10 / CCR-INV-1 — the ordered steps by which someone who has never seen
     this code could rebuild the capability from this document. Numbered. -->

1. <Step>

## Modification rules

<!-- §7.11 — how it may safely change. Name the invariant a would-be change
     must not violate, and what to do when a change appears to require it. -->

- <Rule>

## Known hazards

<!-- §7.12 — what a reimplementer would otherwise rediscover expensively:
     prohibited patterns, inert-looking mechanisms, third-party surprises.
     Write "None" explicitly rather than deleting the section. -->

- <Hazard>

## Operational evidence

<!-- §7.13 — what has actually been observed working, and where the receipt is.
     This is the CFS-032 §5 accrual trigger's evidence, not a promise. -->

- <Observation, with date and reference>

## Commons publication record

<!-- §7.14 / CCR-INV-10 — publication FOLLOWS constitutional acceptance and is
     subject to metaProof Commons Principle 5 (Horizen audit Amendment E §E.3):
     only governed proof enters. A submission without evidence references, a
     claim scope and an evidence posture is REFUSED, never accepted-then-hidden.

     Proof class is one of the four native classes: scientific · operational ·
     commercial · constitutional.

     `Published: no` with `Approval record: None` is the honest default. The
     Commons resource model (`MetaCommonsResource`) is not built yet — nothing
     here may claim a publication that cannot have happened.

     The three lineage rows are `CAN-CCR-8`: publication preserves lineage, so
     a published proof can always be traced back to the record that produced it.
     They are validated against the identity block above and must agree with it. -->

| Field | Value |
|-------|-------|
| Proof class | <scientific \| operational \| commercial \| constitutional> |
| Claim scope | <what is claimed, and over what — never "true generally"> |
| Evidence references | `<path or receipt>`, `<path or receipt>` |
| Approval record | None — not yet submitted |
| Published | no |
| Lineage — capability | `<registry-capability-id>` |
| Lineage — artifact | `codexes/packs/agentiq/updates/<this-file>.md` |
| Lineage — sources | `<path>`, `<path>` |

---

# Appendix A — PRD section to paste (CCR-001 §13.1)

<!-- There is NO PRD template file in this repo; PRDs follow the de-facto shape
     of their siblings in `codexes/packs/irl/foundation/`. Rather than invent a
     PRD template family, CCR-001 §13.1's obligation is published here as a
     block to paste into a PRD's numbered sections. -->

```markdown
## <N>. Capability Completion Obligations

**Binding (CCR-001, CCR-INV-2).** This PRD may not be marked complete, ratified
as delivered, or closed until a Constitutional Capability Brief carrying the
CCR-001 completion sections exists and passes the completion gate.

- **Capability ID (CFS-032):** `<registry-capability-id>` — the same key the
  Capability Registry will use. Named here so the artifact and the registry
  entry cannot become two capabilities.
- **Artifact path:** `codexes/packs/agentiq/updates/YYYY-MM-DD_ccb-<slug>.md`
- **Invariants expected to be discovered:** <named up front where known;
  "unknown — to be derived from development" is an acceptable and honest entry.
  CCR-INV-3: development history must yield reusable invariants.>
- **Proof obligation:** every invariant that reaches `canonical` ships with at
  least one canary in the SAME change (CCR-INV-5 / CCR-INV-9).
- **Commons disposition:** <proof class, or "not commons-eligible" with a reason>
```

# Appendix B — PR section (CCR-001 §13.2)

<!-- This one DOES have a home: `.github/pull_request_template.md` (and its
     byte-identical twin `.github/PR_TEMPLATE.md`). The section below is
     already shipped in both. It is reproduced here so the standard's two
     enforcement points can be read in one place. -->

```markdown
## Capability and Invariant Completion (CCR-001)
- Does this PR complete or materially change a registered capability? Yes/No
  - If Yes, Capability Completion Artifact (CCB) path:
- New invariants discovered in this work:
  - ID / statement / provenance (§8 kind) / canary shipped in this PR:
- Defect fixed by this PR maps to invariant (CCR-INV-9): `<ID>` / new candidate / N/A
- Every invariant marked `canonical` names at least one canary: Yes/No/N/A
- Artifact updated to match the shipped behaviour (CCR-INV-11): Yes/No/N/A
```
