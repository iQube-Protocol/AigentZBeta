# CCR-001 — Constitutional Capability Completion and Reproduction Standard

**Status:** Proposed for constitutional ratification
**Classification:** Constitutional Computing · Engineering Governance
**Proposed:** 2026-07-27 (operator-supplied specification)
**Commons destination:** metaProof Commons (metaCommons)
**Primary enforcement point:** PRD completion and merge acceptance

---

## §25 COMMISSION RESPONSE — audit first, and the finding that shapes everything

The commission's binding instruction was: *"Claude must not create a parallel capability
registry, invariant register or Commons architecture if canonical equivalents already exist.
Where existing structures are sufficient, Claude must extend them."*

**Canonical equivalents exist for three of the four structures this specification proposes.**
Recorded before any structure is created:

| CCR-001 proposes | Canonical equivalent already shipped | Disposition |
|---|---|---|
| Capability Completion Artifact (CCA) | **CFS-049 — Constitutional Capability Brief (CCB)**: *"the repo path (or published Artifact URL) a reader lands on to learn what this capability does, where to find it, and how to use it"* (`capabilityRegistry.ts:briefUrl`). CCBs exist today for the Financial Services suite, the metaMe Companion and the MoneyPenny runtime | **EXTEND — do not create a second artifact family.** The CCA is the CCB **plus** reproduction invariants, provenance, canary mapping, reproduction procedure, modification rules, hazards and Commons class |
| Capability registry | **CFS-032 — Capability Registry** (`services/constitutional/capabilityRegistry.ts`, ratified 2026-07-16). *"Registry Registration IS Constitutional Acceptance — one event, not two stages"*; already carries `governingInvariants`, `briefUrl`, `reuseDisposition`, validation + deployment receipt ids | **EXTEND** — completion state and artifact linkage belong on this registry, which is already the acceptance ceremony |
| Invariant register | **The canonical invariant crystal** (`canonical-invariants.seed.json`, 365 invariants, 13 namespaces) + the runtime store + `FINDING_LIFECYCLE` (`observed → replicated → canonized-as-invariant`, **pinned constitutional data**) | **EXTEND** — see the lifecycle conflict below |
| Commons architecture | **metaProof Commons (metaCommons)** — governed by Amendments D/E of the Horizen audit; `MetaCommonsResource` not yet built | **ALIGN** — CCR-001's §14 Commons object is a proof class, subject to Principle 5 (*only governed proof enters*) |

**So CCR-001 is not a new system. It is the completion half of CFS-032/CFS-049** — the part that
turns a Brief (*what this does, where it is, how to use it*) into a Completion Record (*and what
must remain true, how it was proven, how to reproduce it, and how it may safely change*).

### Conflict requiring an operator decision — §9 lifecycle vs pinned canon

CCR-001 §9 proposes `Observed → Candidate → Validated → Ratified → Canonical → Deprecated`.

The platform already pins `FINDING_LIFECYCLE = ['observed','replicated','canonized-as-invariant']`
as **constitutional data whose ORDER is meaning** (`types/research.ts`, canary-enforced —
*"Lifecycle ORDER is constitutional data (sequencing corollary, `inv.constitutional.078`)"*), and
invariant status in the seed crystal is `proposed | validated | canonical`.

Per §25's stop-and-report rule, **I have not overridden it.** The two ladders differ in kind:
`FINDING_LIFECYCLE` governs *empirical findings earning canonisation through replication*;
CCR-001's governs *engineering invariants earning enforcement through canaries*. The recommended
resolution mirrors the Horizen audit's ratified discipline — **map, do not unify**: keep
`FINDING_LIFECYCLE` untouched, and give software invariants their own status vocabulary that maps
onto the seed crystal's `proposed | validated | canonical` at the point of registration.
**Operator decision required before §9 is implemented.**

---

## The Law (canonical statement)

> **Constitutional Capability Completion Law**
>
> Every material computational capability must conclude in a versioned artifact that preserves its
> behavioural definition, operating location, invocation method, reproduction conditions,
> discovered invariants and executable proofs. Implementation without this artifact is not
> constitutionally complete.

Stated as the governing principle of the standard:

```
Implementation produces capability.
Iteration reveals invariants.
Completion preserves both.
```

**A capability that is implemented but lacks this artifact may be operationally present, but it is
not constitutionally complete.** A PRD may not be marked complete, ratified as delivered, or
closed until its artifact passes the completion gate (§11).

## The twelve constitutional invariants (CCR-INV-1 … 12)

Recorded verbatim in intent; each carries its enforcement disposition against what exists today.

| # | Invariant | Enforcement disposition |
|---|---|---|
| **CCR-INV-1** | Capability without reproduction knowledge is incomplete | Completion gate (§11) |
| **CCR-INV-2** | Every material PRD concludes with a Capability Completion Artifact | PRD template + CI |
| **CCR-INV-3** | Development history must yield reusable invariants | Completion review |
| **CCR-INV-4** | Every invariant retains provenance | `CAN-CCR-2` |
| **CCR-INV-5** | Every ratified software invariant must be enforceable | `CAN-CCR-3` |
| **CCR-INV-6** | Tests must enforce named behaviour, not accidental implementation | Invariant-reference linting (§13.4) |
| **CCR-INV-7** | The artifact describes capability, not merely code location | `CAN-CCR-4` |
| **CCR-INV-8** | Reproduction does not require identical implementation | Artifact schema §7.7 `implementationFreedom` |
| **CCR-INV-9** | A new defect must map to an existing invariant or create a candidate | `CAN-CCR-6` + PR template |
| **CCR-INV-10** | Commons publication follows constitutional acceptance | Aligns with Principle 5 (*only governed proof enters*) |
| **CCR-INV-11** | A capability artifact must remain attached to the live capability | `CAN-CCR-7`; **a stale artifact is a constitutional defect** |
| **CCR-INV-12** | Completion claims must be machine-verifiable where practicable | CI gate (§13.3) |

## Why this is not optional documentation

The distinction the law turns on: **code records an implementation, but does not record why a
particular ownership boundary exists, which competing implementations previously caused
regressions, which mechanisms were found to be inert, or which apparent simplifications would
violate system behaviour.**

This session is the evidence. The Companion menu system took **ten cycles** to fix because six of
its nine defects were the same shape — *two things owning or describing one thing, and the stale
one winning* — and nothing named the rule being broken. The tenth cycle found the root cause only
after the invariants were written down. That is the failure mode CCR-001 exists to prevent, and
it is why §17 names the Companion Menu System as the originating example.

## Reference implementation — already substantially built

`codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md` was authored this
session and already satisfies much of §7:

- nine invariants (MS-1 … MS-9), each with **the defect that proved it** (§7.8 development-derived
  record) and **the canary that enforces it** (§7.9);
- an explicit prohibited-pattern section (§7.12);
- the third-party-embed hazard (§7.12);
- the standing rule that a defect fitting none of the nine becomes a tenth *with its canary in the
  same change* — which is CCR-INV-9 stated before CCR-001 existed.

**What it lacks to become the reference CCA:** the identity block (§7.1), behavioural capability
statement (§7.2), location/invocation (§7.4–7.5), capability boundary (§7.6), reproduction
procedure (§7.10), modification rules (§7.11), and Commons classification (§7.14). Converting it is
Phase 2 of the delivery plan and is the smallest honest first artifact.

## Placement

- **This document** is the constitutional record, in the IRL foundation alongside the CFS series.
- **The Law** belongs in the constitutional registry as a child of the requirement that
  consequential computational capabilities remain *intelligible, attributable, verifiable,
  reproducible, governable and safely evolvable*.
- **The artifact** extends CFS-049's Brief; **completion state** extends CFS-032's Registry.
- **Publication** is governed by the metaProof Commons rules (Principle 5).

## Delivery plan (as commissioned, sequenced against what exists)

| Phase | Scope | Note |
|---|---|---|
| **0 — Ratification** | Ratify the Law; resolve the §9 lifecycle conflict; assign registry placement | **Operator decision on §9 required** |
| **1 — Templates + schema** | CCA Markdown template **as an extension of the CCB format**; `capability-completion-artifact/v1.0`; PRD + PR template sections; provenance vocabulary (§8) | Must not fork CFS-049 |
| **2 — Companion reference artifact** | Convert the menu-system invariant record into the first complete CCA; map all nine invariants to code + canaries | Substantially pre-built |
| **3 — Enforcement** | The eight canaries (`CAN-CCR-1…8`); CI completion gate; invariant-reference linting; block PRD closure without a valid artifact | |
| **4 — Registry + Commons** | Link artifacts to PRDs, commits, invariants, proofs; publish eligible artifacts | Extends CFS-032 |
| **5 — Agent integration** | Agents retrieve the governing artifact before modifying a capability; repairs name their invariant; agents may propose candidates but never auto-promote | |

## Non-goals (recorded, because they bound the burden)

No formal proof for every feature; no documentation of every source file; no frozen
implementation; no treating every bug as a universal invariant; no publishing protected details;
no speculative invariants forced into canon; no prose replacing tests.

## Operator decisions

### RESOLVED — 1. §9 lifecycle conflict (operator, 2026-07-27)

> *"Recommended resolution is the discipline you already ratified for proof postures: map, don't
> unify. Agreed."*

**Map, do not unify.** `FINDING_LIFECYCLE` stays pinned canon and is never rewritten, extended or
re-ordered. CCR-001's completion lifecycle is a **separate ladder** that MAPS onto it, carrying the
source lifecycle value alongside its own — exactly as `CommonsEvidencePosture` carries
`sourceLifecycle` (Horizen audit Amendment B §B.4). The two ladders govern different things
(empirical findings earning canonisation through replication; engineering invariants earning
enforcement through canaries) and neither is rewritten into the other.

Implemented in `types/capabilityCompletion.ts` (`COMPLETION_LIFECYCLE`, `mapCompletionStage`) and
enforced by `tests/capability-completion.test.ts`, whose canary now fails if anyone **unifies** the
ladders rather than if §9 is implemented at all.

### RESOLVED — 2. Artifact naming (operator, 2026-07-27)

> *"My recommendation is to keep the name and version the format rather than introduce
> CAPABILITY-<id>-<slug>.md alongside it. Agreed."*

**Keep the Constitutional Capability Brief (CCB) name; version the format.**
`CAPABILITY-<id>-<slug>.md` is not introduced. Recorded in CFS-049 Amendment A.

### Still open

3. **Migration priority** — §18's three-tier order accepted as-is?
4. **Enforcement staging** — should CI block PRD closure from Phase 3, or warn first?
