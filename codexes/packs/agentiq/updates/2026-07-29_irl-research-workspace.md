# IRL Research Workspace — SPEC-IRL-WORKSPACE-001, built 2026-07-29

**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Spec:** `codexes/packs/irl/foundation/SPEC-IRL-WORKSPACE-001_research-workspace.md`
(recorded this session; operator ruled it a **spec, not a PRD requiring ratification**).

---

## 1 — The audit verdict, first

The operator gated this work on an audit of the existing workspace engine, with instructions to
**stop and report** if extraction would change Venture Lab behaviour.

> **Verdict: the engine is ALREADY GENERIC. No extraction was needed, and none was performed.**

`services/experiments/experimentWorkspace.ts` was already the common spine, and it already had a
research half:

| Concern | Already generic before this session |
|---|---|
| The spine type + projections | `ExperimentWorkspace`, `experimentWorkspaceFromPartner` / `…FromResearch` |
| The instance registries | `PARTNER_WORKSPACES` (venture) / `RESEARCH_WORKSPACES` (research) |
| The read route | `GET /api/venture/workspace/[workspaceId]` — resolves `ws.participation.domain`, not a hardcoded `venture-lab` |
| The surface | `PartnerProgrammesTab`, already mounted by BOTH Labs via `workspaceDomain` |
| Domain + scope gating | `satisfiesParticipationGate` / `satisfiesWorkspaceScope` — domain-parameterised, deny-by-default |

So the research implementation **configures** the primitive. What was added is configuration and
four genuinely-missing pieces of the primitive itself (workspace type, hierarchy, lifecycle
templates, institutions) — added as **optional fields with derived venture defaults**, so the
Venture Lab projection produces the same values it always did.

**Acceptance criterion 3 is asserted on values, not on the absence of a diff.** `AC-3` in
`tests/research-workspace-spec.test.ts` pins every field the venture projection produced before the
primitive grew — id, label, domain, class, objectives, participation domain, the exact six venture
roles, evidence cartridge — plus the new fields, each traced to something `PARTNER_WORKSPACES`
already said. `tests/partner-workspace.test.ts`, `tests/venture-lab-cohort-isolation.test.ts` and
`tests/experiment-workspace.test.ts` all pass **unmodified**.

---

## 2 — What was built

### The primitive (shared, both Labs)

- **`services/experiments/workspaceLifecycle.ts`** (new) — `WORKSPACE_TYPES` (the spec's six),
  visibility postures, and the three lifecycle templates. The `venture-pilot` template's stages are
  **derived** from `PARTNER_WORKSPACE_PHASES`; `research-experiment` and `capstone` transcribe the
  spec's §7 pipelines and are held by a parity canary that reads them back out of the document.
- **`services/venture/partnerWorkspace.ts`** — the phase union became a const array
  (`PARTNER_WORKSPACE_PHASES`) with the type derived from it. Same members, same order, zero
  behaviour change; it exists so the venture template can be derived rather than transcribed.
- **`services/experiments/experimentWorkspace.ts`** — `ExperimentWorkspace` gained
  `workspaceType`, `parentWorkspaceId`, `institutionRefs`, `lifecycleTemplateId`, `currentStage`,
  `visibility`.

### The research configuration

- **`services/research/researchWorkspace.ts`** — hierarchy (`parentId`, four workspace types),
  optional `seriesId` / `experimentId` / `title`, institutions, lifecycle, visibility, and
  **inheritance**: a child resolves its nearest ancestor's owner / layer owners / links /
  institutions, so a student project is five lines instead of forty.
- **`services/research/researchWorkspaceViews.ts`** (new) — **the eight views and the role matrix**.
  One definition; the IRL tab config *builds* its tabs from it and the surface reads it.
- **`services/research/researchWorkspaceRoles.ts`** (new) — what each role may **do**, with the
  powers workspace membership never confers declared as the literal type `false`.
- **`services/research/workspaceMaterials.ts`** (new) — the Working Materials / Locker admission
  gate and the per-surface authority table.

### The instances (SPEC §1)

```
autonomi-independent-review-programme     research-programme
├── autonomi-review-exp-p1                experiment (EXP-P1)
├── autonomi-review-exp-p2                experiment (EXP-P2)
└── autonomi-review-exp-p3                experiment (EXP-P3)

lehigh-capstone-programme                 research-programme
├── lehigh-mfe-capstone                   cohort
│   ├── lehigh-mfe-risk-management        student-project
│   ├── lehigh-mfe-pricing                student-project
│   └── lehigh-mfe-financial-systems      student-project
└── lehigh-cs-capstone                    cohort
    ├── lehigh-cs-software-build          student-project
    ├── lehigh-cs-agent-integration       student-project
    └── lehigh-cs-constitutional-runtime  student-project
```

**Why the three Autonomi experiments are separate workspaces:** a grant is scoped to a *workspace
id*. Acceptance criterion 4 — "reviewers reach only assigned experiments" — is only *expressible*,
and its denial only testable, if each experiment is its own workspace. Same reason cohorts and
student projects are workspaces (criteria 6 and 7).

### The eight views

| View | Slug | Roles admitted |
|---|---|---|
| Overview | `irl-workspace-overview` | all seven |
| Pipeline | `irl-workspace-pipeline` | all seven |
| Review | `irl-workspace-review` | PI, steward, reviewer, faculty, researcher |
| Working Materials | `irl-workspace-materials` | PI, steward, faculty, student, researcher |
| Locker | `irl-workspace-locker` | all except observer |
| QubeTalk | `irl-workspace-qubetalk` | all seven |
| Activity | `irl-workspace-evidence` | all seven |
| Participants | `irl-workspace-participants` | **steward + faculty only** |
| *(Administration)* | `irl-workspace-administration` | `adminOnly` — not one of the eight |

The `evidence` **id and slug are unchanged** while the label became "Activity": the id is what
`?tab=` deep links resolve, and a dangling `?tab=` does not error — it silently lands the principal
on the cartridge default.

The **reviewer's exclusion from Working Materials** is criterion 5 in navigable form: a reviewer who
could open the mutable area is one habit away from editing it.

---

## 3 — Roles: three reused, three added

| SPEC §8 role | Substrate role | New? |
|---|---|---|
| Research Steward | `research-steward` | reused |
| External Reviewer | `reviewer` | reused |
| Institutional Observer | `research-participant` | reused |
| Principal Investigator | `principal-investigator` | **added** |
| Faculty Lead | `faculty-lead` | **added** |
| Student Researcher | `student-researcher` | **added** |

The 2026-07-28 ruling ("do not invent new names if equivalent roles already exist") is honoured by
the three reuses. The three additions have no equivalent — flattening a PI into `researcher` would
make "cannot self-review confirmatory work" unstateable. Adding a role grants nothing by itself.

### The one gate this work widens, stated plainly

**`faculty-lead` was added to `DOMAIN_STEWARD_ROLES['research-lab']`**, giving Faculty Leads
delegated invitation authority (SPEC §8: "administers one capstone/cohort, approves participation").
Bounded by mechanisms that already existed, and canaried from both sides:

- `resolveInvitationAuthority` derives the tier **server-side from the caller's own grants**, so a
  Faculty Lead's reach is exactly their own `allowedScopes` — their cohort and its projects.
- `issuableRoles(domain, 'delegated')` subtracts every steward role, so a Faculty Lead **cannot
  appoint another Faculty Lead or a Research Steward**. Only a platform admin does.
- This also **tightens** the existing `research-steward`, which can no longer issue `faculty-lead`.
- A `faculty-lead` grant exists only because a platform admin issued one.

**No scope descent.** A grant scoped to a cohort does **not** confer its projects, and vice versa —
asserted in both directions. A Faculty Lead's grant must list the cohort *and* its projects
explicitly; that is data, not a mechanism change.

---

## 4 — Student Standing (operator ruling, same session)

### How the gate was generalised — and what was flagged instead of changed

`services/venture/trading/standingAdmission.ts` is now **domain-neutral in name and in shape**:

- `evaluateStandingSignal(StandingSignalInput)` is the canonical entry point, with
  `domain: 'venture-trading' | 'research-contribution'`. The domain is recorded for correlation and
  **does not branch the decision** — the moment it did, there would be two gates again.
- `evaluateTradingStandingSignal` is a thin alias that renames one field and stamps the domain, so
  every existing venture caller and every ratified venture canary exercises the identical code.
- `services/research/studentContribution.ts` **configures** it. It re-partitions nothing,
  re-computes no weight, re-checks no evidence.

> **FLAGGED, NOT DECIDED — the gate did not move.** It is now a platform-wide gate living at a
> trading-specific address. Moving it to a neutral home (e.g. `services/standing/`) would fail the
> **ratified** canary in `tests/venture-trading-substrate.test.ts` — *"nothing outside the venture
> substrate reads the provisional constant"* — which walks the tree and flags any file **outside**
> `services/venture/trading/` containing `MAX_STANDING_SIGNAL_WEIGHT`. Relocating requires
> re-pointing that canary's directory scope in the same change. **That is an operator decision.**

### The submission is not the unit

```
executed-trade count earning Standing  ≡  submission count earning Standing
```

`submission-count`, `artefact-count`, `resubmission-count`, `page-count`, `word-count`,
`commit-count` and `hours-logged` were added to the **one closed** `PROHIBITED_STANDING_BASES` list
— not to a research-only second list, because the list is not "trading metrics", it is **quantity
metrics**, which are never a constitutional basis in any domain.

### Permitted bases for a research contribution

Derived by filtering the gate's own table — never a second list:

`correctness` · `veracity` · `proof-quality` · `constitutional-completeness` · `reproducibility` ·
`service-reliability` · `authority-compliance` · `no-unauthorised-expansion` ·
**`negative-result-reporting`**

`negative-result-reporting` is the one **new** basis, at **parity with `correct-refusal`** (1.0).
A capstone that correctly reports "this approach does not work, and here is the evidence" is the
research analogue of a correct refusal — publication bias is the volume-and-positive-results
ordering V-10 exists to prevent, wearing an academic hat. A lower constant would reintroduce it.

Venture-shaped bases (`correct-refusal`, `risk-detection`, `reconciliation-quality`) are **not**
offered to a research claim — the fail-closed direction.

### Grading is not Standing

A grade is an institutional judgement; Standing is a constitutional one. `faculty-lead` is the
**only** role with `mayAwardGrade: true`, and **every** role — including that one — carries the
literal type `mayGrantStanding: false`. No act of authority writes Standing; only a verified
contribution passing the gate does.

### Attribution, and the Slice C dependency

`contributorRef` is a `personaPublicRef()` commitment; a raw persona UUID is **refused**, not
sanitised. A student's Standing is theirs and does not end with the capstone.

> **Admitted is NOT accrued.** V-10's signals do not yet flow into the accrual service — Slice C
> defines how an admitted signal maps into Personal / Delegated / Stewardship / Capability Standing.
> This module produces an admission **decision** and stops. It writes nothing and accrues nothing.
> An admitted-but-unaccrued signal is honest; a fake accrual is not. Recorded as
> `STANDING_ACCRUAL_DEPENDENCY` and canaried.

---

## 5 — Verification

- **Suite: 184 files / 3311 tests green** (baseline 183 / 3252). No canary weakened.
- **Typecheck: zero new errors** (see the finding below).
- **Mutation testing: 34 mutations, 34 caught, 0 survivors.**

### ⚠️ Finding — `npx tsc --noEmit` is not type-checking this repo

`tsconfig.json` sets `typeRoots: ["./types", …]`, and `types/` contains ordinary source modules
rather than type packages. TS treats each subdirectory as an implicit type library, fails to resolve
`iqube`, and **includes no files** — so the command reports only its two config errors and would
report a deliberate `const x: number = "string"` as clean. **Verified with a probe.** The "two
pre-existing config errors" are therefore *not* evidence of a clean typecheck.

A real typecheck (typeRoots narrowed to `node_modules/@types`) surfaces **~950 pre-existing errors**
repo-wide. This session's changes were verified by diffing that full error list before and after,
normalised for line numbers: **zero new errors, and the four this work initially introduced were
fixed.** Repairing the `typeRoots` config is an operator decision — it is not this workstream's
change to make, and it would surface a large pre-existing backlog.

**To reproduce the finding and run a real typecheck** (one paste, from the repo root; it writes a
throwaway config, proves the default command misses a deliberate error, then runs the real check):

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta && \
printf 'export const __probe: number = "not a number";\n' > __tsc_probe.ts && \
echo "--- documented command (should FAIL on __probe, but does not) ---" && \
npx tsc --noEmit; \
printf '{\n  "extends": "./tsconfig.json",\n  "compilerOptions": {\n    "ignoreDeprecations": "5.0",\n    "typeRoots": ["./node_modules/@types"],\n    "incremental": false\n  }\n}\n' > tsconfig.verify.json && \
echo "--- real typecheck (finds __probe, plus the pre-existing backlog) ---" && \
npx tsc --noEmit -p tsconfig.verify.json | head -20; \
rm -f __tsc_probe.ts tsconfig.verify.json
```

### Mutation table

| # | Mutation | Result | Caught by |
|---|---|---|---|
| M1 | reviewer gains Working Materials | CAUGHT | spec, research-lab-workspace |
| M2 | observer gains the Locker | CAUGHT | spec, research-lab-workspace |
| M3 | student gains Review | CAUGHT | spec, research-lab-workspace |
| M4 | PI gains access administration | CAUGHT | spec, research-lab-workspace |
| M5 | views lose the domain gate | CAUGHT | spec, research-lab-workspace |
| M6 | Tier-0 loses `adminOnly` | CAUGHT | spec, research-lab-workspace |
| M7 | unscoped grant opens every cohort | CAUGHT | spec, research-lab, **venture-lab-cohort-isolation** |
| M8 | a student project admits a PI | CAUGHT | research-lab-workspace |
| M9 | a parent reference dangles | CAUGHT | research-lab-workspace |
| M10 | a workspace loses its name (id renders as heading) | CAUGHT | spec, research-lab-workspace |
| M11 | two experiment workspaces name one experiment | CAUGHT | spec |
| M12 | Locker admission drops the class check | CAUGHT | spec |
| M13 | partition uses class instead of admissibility | CAUGHT | spec |
| M14 | QubeTalk may mutate governed state | CAUGHT | spec |
| M15 | Working Materials may admit to the Locker | CAUGHT | spec |
| M16 | default visibility becomes `public` | CAUGHT | spec |
| M17 | a workspace is published with no act | CAUGHT | spec |
| M18 | the venture pilot is retyped | CAUGHT | spec (AC-3) |
| M19 | venture loses its institution | CAUGHT | spec (AC-3) |
| M20 | venture entrance offers a research view | CAUGHT | lab-tab-restructure |
| M21 | the experiment pipeline is reordered | CAUGHT | spec (doc parity) |
| M22 | the venture ladder is hand-listed | CAUGHT | spec |
| M23 | a stage is not in its own template | CAUGHT | spec |
| M24 | reviewer may edit working materials | CAUGHT | spec |
| M25 | a Faculty Lead can grant Standing (type widened **and** value flipped) | CAUGHT | spec |
| M26 | `faculty-lead` loses its steward designation | CAUGHT | spec |
| M27 | negative results are worth less | CAUGHT | spec |
| M28 | `submission-count` is no longer prohibited | CAUGHT | spec |
| M29 | incompleteness stops disqualifying (`if (false && …)`) | CAUGHT | **venture-trading-substrate** |
| M30 | research bases hand-listed instead of derived | CAUGHT | spec |
| M31a | the Slice C dependency is dropped | CAUGHT | spec |
| M31b | a fake accrual is added to the contribution path | CAUGHT | spec |
| M32 | the spec leaves the pack index | CAUGHT | spec |
| M33 | a view label drifts from the spec document | CAUGHT | spec |

**Every mutation was verified to have actually applied** (re-read from disk, compared against both
the original and the intended content) before its canary was judged — and every file was verified
restored afterwards.

**One false survivor was caught and corrected, which is the point of that discipline.** M2's first
form inserted a *duplicate* `roles:` key into the object literal; JavaScript takes the last one, so
the "mutation" changed nothing and reported SURVIVED. Re-run against the real key, it is caught by
four canaries. This is the same class CLAUDE.md records (an interface-only edit that no-oped;
`if (false && !isAdmin)`) — a survivor is a claim that must itself be verified.

M25 is the deliberate **two-part** mutation: widening the literal `false` type alone is a no-op, so
the type and the value were changed together.

---

## 6 — Reuse register (SPEC §16) — nothing was rebuilt

| Concern | The one implementation used |
|---|---|
| Workspace engine | `services/experiments/experimentWorkspace.ts` |
| Access grants + invitations | `services/passport/participationAccess.ts` |
| Tab / scope gating | `services/passport/participationTabGate.ts` |
| Workspace surface | `PartnerProgrammesTab` (one component, N entrances) |
| Independent review | `services/research/review/*` (IRL-REVIEW-001) |
| Locker | `LockerTab` |
| QubeTalk | `QubeTalkInboxTab` / `services/qubetalk/peerChannel` |
| Invitations | `StewardParticipationTab` |
| Standing admission | `evaluateStandingSignal` (the V-10 gate) |
| Receipts | `activityReceiptService` + the DVN pipeline |

**No DVN change was made.** `independent_review_completed` — the consequential decision of the first
acceptance case — was already in `ANCHORABLE_ACTION_TYPES`, as are all three research workspace
evidence action types. A canary asserts that every action type a workspace declares as evidence is
anchorable.

---

## 7 — The first acceptance case

> An invited Autonomi reviewer can inspect the frozen EXP-P1 review package, communicate in scoped
> QubeTalk, submit an independent review, and access final Locker artefacts **without gaining
> authority to alter, freeze or canonise the experiment.**

**Result: passing**, as two canaries — one positive, one denial — in
`tests/research-workspace-spec.test.ts`. A reviewer scoped to `autonomi-review-exp-p1` reaches
Review, QubeTalk, Locker and Overview *and* opens the workspace behind them; the same caller reaches
no Working Materials, no Participants, no Tier-0 space, is refused by the gate itself (not merely by
the filter), and opens none of EXP-P2, EXP-P3, the parent programme, or any Lehigh cohort.
