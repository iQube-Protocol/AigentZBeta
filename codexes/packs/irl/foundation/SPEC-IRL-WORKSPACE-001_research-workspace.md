# SPEC-IRL-WORKSPACE-001 — IRL Research Workspace

**Status:** Specification (operator ruling, 2026-07-29: *a spec, not a PRD requiring ratification —
the need was already raised*).
**Owner:** Invariant Research Laboratory (IRL).
**Depends on:** the shared constitutional workspace primitive
(`services/experiments/experimentWorkspace.ts`), IRL-REVIEW-001
(`SPEC-IRL-REVIEW-001_independent-review-capability.md`), the participation access substrate
(`services/passport/participationAccess.ts`), QubeTalk peer channels, the Locker, and the DVN
activity-receipt ledger.

---

## 1 — Purpose

A lightweight **private** workspace for research operations involving researchers, external
reviewers, institutional partners, faculty, students, observers and cohorts. The research
equivalent of the Venture Lab Partner/Pilot workspace, **reusing the same underlying primitive**.

Initial uses:

1. **Autonomi Independent Review Programme** — Austin and his agent review EXP-P1/P2/P3.
   Protocols, review packages, decisions, QubeTalk and frozen artefacts in one scoped space.
   Institutional relationship: Research Partner. Procedural role: External Reviewer.
2. **Lehigh University Capstones** — Master's in Financial Engineering (financial research,
   pricing, risk, financial-system artefacts) and Undergraduate CS (software design,
   implementation, testing, capability artefacts).

> The first release must stay **thin**. It organises existing Locker, QubeTalk, invitation, review,
> receipt and experiment capabilities; it does not replace them.

## 2 — Product thesis

> **One workspace engine; different constitutional purposes and templates.**

The shared primitive supplies membership, roles, scoped views, lifecycle stages, QubeTalk, Locker
links, working materials, activity and receipts. Lab configuration supplies vocabulary and
lifecycle.

## 3 — Problem

IRL has dashboards, participation, invitations, Locker, QubeTalk, experiment records and review
infrastructure but **no private operational collaboration space**. Reviewer work fragments,
capstone activity lives in WhatsApp and Google Drive, Locker gets misused as a project area, and
decisions stay trapped in chat.

## 4 — Scope

**In:** Research Programme container; Experiment/Cohort/Student Project workspaces; scoped roles
and invitations; the eight views; IRL-REVIEW-001 integration; Autonomi + both Lehigh templates.

**Out:** LMS or grading; public citizen-science; new editor/chat/storage; complex project
management; duplicated Venture Lab machinery; automatic canonisation, freeze or publication.

## 5 — The shared primitive

```ts
type ConstitutionalWorkspace = {
  workspaceId: string;
  workspaceType: 'venture-programme' | 'pilot' | 'research-programme'
    | 'experiment' | 'cohort' | 'student-project';
  parentWorkspaceId?: string;
  title: string; description?: string;
  institutionRefs: string[]; memberRefs: string[];
  roleAssignments: WorkspaceRoleAssignment[];
  lifecycleTemplateId: string;
  visibility: 'private' | 'invited' | 'public';
  qubeTalkChannelRefs: string[]; lockerCollectionRefs: string[];
  workingMaterialRefs: string[]; activityReceiptRefs: string[];
  createdAt: string; updatedAt: string;
};
```

**The research implementation CONFIGURES this primitive; it must not fork it.**

## 6 — Hierarchy

```
Research Programme ├── Experiment ├── Cohort └── Student Project
```

Autonomi: Programme → EXP-P1, EXP-P2, EXP-P3.

Lehigh: Programmes → MFE Capstone (Risk, Value, Price) + CS Capstone
(Software Build, Agent Integration, Constitutional Runtime).

The MFE ordering is constitutional, not cosmetic: **price is established by balancing risk and value**.

## 7 — The eight views

| View | What it holds |
|---|---|
| **Overview** | purpose, phase, institutions, active roles, next action, blockers, decisions, milestones, recent receipts |
| **Pipeline** | the lifecycle template's stages, with the current stage marked |
| **Review** | front end for IRL-REVIEW-001: packages, reviewers, rubric, decisions, contested items, review receipts |
| **Working Materials** | mutable drafts, notes, source packs, notebooks, code branches, unresolved decisions |
| **Locker** | frozen, signed, ratified or authoritative artefacts **only** |
| **QubeTalk** | mounted workspace-scoped channels — **do not rebuild chat** |
| **Activity** | consequential events and DVN receipts |
| **Participants** | people, institutions, roles, invitation status, scope |

**Pipeline templates.**

- *Experiment*: `Concept → Protocol → Review → Preregistration → Freeze → Task Construction → Run
  → Adjudication → Interpretation → Publication → Replication`
- *Capstone*: `Brief → Research Plan → Source/Data Review → Build or Analysis → Review → Revision
  → Submission → Demonstration → Archive/Commons`

## 8 — Six roles

| Role | May | May **not** |
|---|---|---|
| **Principal Investigator** | define experiments, submit artefacts, request freezes, initiate runs, propose findings | self-review confirmatory work |
| **Research Steward** | administer access, verify required artefacts, coordinate review | canonise or publish unilaterally |
| **External Reviewer** | inspect assigned packages, comment, submit structured decisions, raise objections | alter, freeze, canonise, grant Standing or publish |
| **Institutional Observer** | view agreed materials and comment | change anything |
| **Faculty Lead** | administer one capstone/cohort, approve participation, review milestones | reach another programme |
| **Student Researcher** | work only in assigned projects, submit artefacts, receive attributable contribution receipts | reach another project |

## 9 — Functional boundaries

```
Workspace = mutable operations
Locker    = authoritative record
QubeTalk  = deliberation
Commons   = reusable proof
```

> **No consequential research decision may remain only in QubeTalk.**
>
> **Workspace membership does not confer freeze, canonisation or publication authority.**

## 10 — Invitations and access

Reuse the existing invitation framework. Invitations specify workspace, institution, role,
experiment/project scope, start and expiry, allowed views, confidentiality status.

**Access is fail-closed.** Access to one experiment must **not** imply access to sibling
experiments, faculty channels or the whole Locker.

## 11 — Public extension — preserve the path, build nothing

```
Private Workspace → approved publication → Public Research Space
→ citizen contribution → review → Standing and Commons proof
```

**Nothing becomes public by default.**

## 12 — First acceptance case

> An invited Autonomi reviewer can inspect the frozen EXP-P1 review package, communicate in scoped
> QubeTalk, submit an independent review, and access final Locker artefacts **without gaining
> authority to alter, freeze or canonise the experiment.**

## 13 — Acceptance criteria

1. Venture and Research Labs use the same workspace engine.
2. Research behaviour is configuration-driven.
3. **Existing Venture Lab workspaces remain unchanged.**
4. Autonomi reviewers reach only assigned experiments.
5. Reviewers can review but cannot mutate, freeze or canonise.
6. Faculty Leads administer their own programme only.
7. Students access only assigned projects.
8. Working Materials and Locker state remain distinct.
9. QubeTalk cannot directly change experiment status.
10. Consequential decisions create DVN receipts.
11. Public visibility requires an explicit publication act.
12. Both positive reachability and denial canaries exist.

## 14 — Required canaries

- Authorised reviewer reaches assigned experiment
- Unauthorised observer denied
- Reviewer cannot mutate or freeze
- Faculty Lead cannot enter another programme
- Student cannot enter another project
- **Working Materials cannot masquerade as Locker artefacts**
- **QubeTalk cannot directly change governed state**
- **No workspace joins navigation without a reachable entrance**
- **Every denial suite includes a positive reachability path**

## 15 — Constitutional rule

> The Research Lab shall use the platform's shared constitutional workspace primitive for private
> research programmes, experiments, institutional collaborations and cohorts. Research
> configuration may alter vocabulary, roles, lifecycle and views, but must not fork the underlying
> access, communication, artefact, receipt or workspace machinery. Workspaces support
> collaboration; they do not confer authority to freeze, canonise or publish.

## 16 — Reuse register (what this spec is forbidden from rebuilding)

| Concern | The one implementation |
|---|---|
| Workspace engine | `services/experiments/experimentWorkspace.ts` |
| Research workspace instances | `services/research/researchWorkspace.ts` |
| Lifecycle templates | `services/experiments/workspaceLifecycle.ts` |
| Access grants + invitations | `services/passport/participationAccess.ts` |
| Tab/scope gating | `services/passport/participationTabGate.ts` |
| Workspace surface | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` |
| Independent review | `services/research/review/*` (IRL-REVIEW-001) |
| Locker | `app/triad/components/codex/tabs/LockerTab.tsx` |
| QubeTalk | `components/composer/QubeTalkInboxTab.tsx` / `services/qubetalk/peerChannel.ts` |
| Receipts | `services/receipts/activityReceiptService.ts` + the DVN pipeline |
| Experiment / series records | `types/research.ts` (`EXPERIMENT_REGISTRY`, `SERIES_REGISTRY`) |

**No second role engine, Locker, chat system or research-only task engine.**
