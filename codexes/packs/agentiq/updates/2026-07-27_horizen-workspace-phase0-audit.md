# Horizen Workspace — Phase 0 Audit and Composition Plan

**Status: AUDIT — no code written. Phase 1 is gated on operator sign-off of §7.**
**Spec:** operator instruction *"SPEC — Horizen Workspace"*, 2026-07-27.
**Final instruction obeyed:** *"Start with the code audit. Do not assume that any new capability
is required."*

---

## 0. Verdict on the working hypothesis

The spec's hypothesis was:

> Horizen Workspace = existing Workspace shell + Research Lab Locker and QubeTalk + Portfolio
> operations + α Programme reporting + Relationship Builder + Agent Z administration + Marketa
> communications + receipts and evidence + governed metaCommons projection.

**Confirmed for seven of nine terms. Falsified for two.** Stated precisely:

| Term | Verdict |
|---|---|
| Existing Workspace shell | **Confirmed** — `services/venture/partnerWorkspace.ts` + `PartnerProgrammesTab` (shipped 2026-07-26; regrouped into a first-class Partner domain 2026-07-27). |
| Research Lab Locker | **Confirmed** — `LockerTab`, `services/passport/lockerItems.ts` / `lockerStorage.ts`. |
| QubeTalk | **Confirmed** — `services/qubetalk/peerChannel.ts` carries channels, messages, a rights envelope and shared artifacts. |
| Portfolio operations | **Confirmed** — `VentureLabPortfolioTab`, `FounderOfficeTab`, `_ventureLabData.ts`. |
| α Programme reporting | **Confirmed** — `AlphaProgrammeTab` (workstreams + infrastructure readiness). |
| Relationship Builder | **Confirmed** — `RelationshipBuilderTab`. |
| Marketa communications | **Confirmed** — `MarketaTab` + `services/marketa/*`. |
| Receipts and evidence | **Confirmed** — `services/receipts/activityReceiptService.ts`, the DVN pipeline, `capabilityReceiptService`. |
| **Agent Z daily/weekly administration** | **FALSIFIED as an existing capability.** No daily or weekly *workspace* administration flow exists. What exists is adjacent and reusable: `services/orchestration/briefBuilder.ts`, `/api/assistant/brief`, `/api/assistant/venture-progress`, `/api/assistant/move-forward` — all **persona-scoped**, none workspace-scoped. This is genuinely new composition work, not a wiring job. |
| **Governed metaCommons projection** | **FALSIFIED as an existing capability.** `metaCommons` exists as *constitutional doctrine* (`services/polity/constitution.ts`) and as a **deterministic stub** (`services/venture/metacommonsSignals.ts`, whose own header says "the metaCommons engine … is constitutional-only today"). There is no resource model, no promotion flow, no approval state. `MetaCommonsResource` does not exist. |

**So the honest headline: the spec is ~75% composition and ~25% net-new.** The two new pieces are
exactly the two the spec itself sequences last (Phases 3 and 4), which is the right instinct.

**Also absent, and load-bearing for the three-tier model:** `WorkingGroup`, `WorkspaceReport`,
`EvidenceRecord` — no matches anywhere in the tree. The current `PartnerWorkspace` type has
`objectives · phase · ownerAgentId · layerOwners · contacts? · links` and **no** milestones,
actions, blockers, decisions, participants, agents, working groups, resources, evidence, reports,
communications, locker links, or commons references. The spec's §12 model is roughly **4× the
current shape**.

---

## 1. Audit table (spec §15)

| Required capability | Existing implementation | Reusable as-is | Extension required | Proposed canonical source |
|---|---|---|---|---|
| Workspace instance + registry | `services/venture/partnerWorkspace.ts` (`PARTNER_WORKSPACES`, one seed: `horizen-pilot-series-001`) | ✅ | Extend the type toward §12 | `services/venture/partnerWorkspace.ts` |
| Workspace UI shell + 5 views | `PartnerProgrammesTab` + the Partner tab group (Overview/Collaborate/Operate/Evidence/Communicate) | ✅ | Bind views to real state | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` |
| Sovereign Locker (Tier 1) | `LockerTab`, `services/passport/lockerItems.ts`, `lockerStorage.ts` | ✅ | Add `lockerLinks` references only | `services/passport/lockerItems.ts` |
| Bounded QubeTalk channels | `services/qubetalk/peerChannel.ts` — channels, messages, `RightsEnvelope`, `SharedArtifact` | ✅ | Working-group grouping over existing channels | `services/qubetalk/peerChannel.ts` |
| Invitation + entry flow | `services/passport/participationAccess.ts` (`ACCESS_DOMAINS`, `DOMAIN_ROLES`), `StewardParticipationTab`, `AccessInvitationRow` | ✅ | Workspace-scoped role set | `services/passport/participationAccess.ts` |
| Membership + roles | `DOMAIN_ROLES['venture-lab']` = founder-operator · venture-participant · mentor · venture-steward · portfolio-reviewer | ⚠️ partial | Spec asks for 7 roles; 5 exist and **do not map 1:1** | `participationAccess.ts` (extend, don't fork) |
| Delegation + agent admission | Constitutional Agreements (`services/constitutional/constitutionalAgreement.ts`, CRP-003a), bounded delegation | ✅ | Workspace-admission agreement kind | `constitutionalAgreement.ts` |
| Permissions / capability gates | Identity & Access Spine (`evaluateAccess`, `getActivePersona`), `quickLinkVisibility` pattern | ✅ | **No new gate** — compose the spine | `services/access/evaluateAccess.ts` |
| Portfolio projection | `VentureLabPortfolioTab`, `_ventureLabData.ts` | ✅ | Read workspace state, don't copy it | `services/venture/partnerWorkspace.ts` |
| α Programme projection | `AlphaProgrammeTab` | ✅ | Same | same |
| Relationship Builder projection | `RelationshipBuilderTab` | ✅ | Same | same |
| Financial Services evidence | `MoneyPennyTab` / `MoneyPennyPanelTab`, `financialIntelligenceExecutor`, step-up policy | ✅ | Contribution path into Evidence | MoneyPenny services |
| Communications | `MarketaTab`, `services/marketa/*` | ✅ | Approval gate before publish | `services/marketa/*` |
| Receipts + evidence | `activityReceiptService`, DVN pipeline, `capabilityReceiptService` | ✅ | Evidence view + provenance classes | `services/receipts/activityReceiptService.ts` |
| Agreements / decisions | Constitutional Agreements (already the live derivation for "Open Actions") | ✅ | Decision log projection | `constitutionalAgreement.ts` |
| **Daily status** | — *(persona-scoped `briefBuilder` only)* | ❌ | **New, workspace-scoped** | new `services/venture/workspaceAdministration.ts` |
| **Weekly report** | — | ❌ | **New** (15 sections, versioned) | same |
| **Milestones / actions / blockers** | — on the workspace; comparable shapes exist in intents + agreements | ❌ | **New workspace state** | `partnerWorkspace.ts` extension |
| **Working groups** | — *(channels exist; grouping does not)* | ❌ | **New, thin** — a named set of channels | `peerChannel.ts` composition |
| **metaCommons resource model** | doctrine + deterministic stub only | ❌ | **New** — `MetaCommonsResource`, promotion, approvals | new `services/commons/metaCommonsResource.ts` |
| Data classes (metaQube / BlakQube) | `types/access.ts` (`metaQubeId`, `metaQubeCid`), ontology canon | ⚠️ partial | No **workspace-scoped** class exists | `types/access.ts` + new classification field |

---

## 2. Duplication risks (the things most likely to go wrong)

Ranked by how expensive they'd be to unwind, and each mapped to the invariant it would break
(`agentiq/updates/2026-07-27_companion-menu-system-invariants.md` — MS-2 "one owner per surface"
and the `inv.engineering.036/037` source-of-truth rules apply verbatim here):

1. **A second programme-management system.** Milestones/actions/blockers already have near-relatives
   in IntentQubes and Constitutional Agreements. Inventing parallel `Action`/`Decision` stores would
   fork the platform's execution record. **Rule: an Action is an IntentQube projection or an
   Agreement projection, not a new table, unless the audit proves neither fits.**
2. **Pilot state copied per surface.** Portfolio, α Programme, Relationship Builder, Financial
   Services and Marketa each want a view. The spec is explicit — projections, not copies. **One
   canonical workspace record; every surface reads it.**
3. **A second invitation system.** `participationAccess` already issues bounded, role-scoped,
   domain-scoped invitations with optional auto-opened peer channels. The workspace invitation is
   that flow with a workspace scope — not a new one.
4. **A second chat.** QubeTalk is the channel substrate. The Hub *references* channels; it does
   not implement messaging.
5. **A second gate.** Membership must resolve through the Identity & Access Spine. A workspace-local
   permission check would be the parallel-resolver defect the spine exists to abolish.

---

## 3. Constitutional boundaries

| Boundary | Rule | Enforcement |
|---|---|---|
| T0 identifiers | `personaId`, `authProfileId`, `rootDid` never in workspace records, receipts, commons resources, or chain-bound data | Existing spine canaries; extend to commons |
| BlakQube → metaCommons | **No BlakQube content may enter the commons without explicit declassification or an approved derived summary** (spec §3) | Promotion flow must refuse; canary required |
| Promotion is deliberate | Locker → Workspace → Commons, each step attributable, never automatic | Canary: no code path writes a commons resource without an `ApprovalRecord` |
| Agent authority | An agent participates only via sponsorship + bounded delegation; Agent Z may update operational state but **not** admit partner members | Constitutional Agreements + step-up policy |
| Publication | Marketa may consume *approved* commons material only; never restricted workspace or Locker content | Classification check before publish |
| Honesty | Unwired metrics render "Not yet wired" — never a fabricated health glyph | Existing `tests/partner-workspace.test.ts` command-centre canary |

---

## 4. Naming corrections required (canonical ontology)

The spec uses several non-canonical spellings. Code and docs will use the canonical forms; this is
flagged rather than silently corrected because the operator's own text differs:

| Spec text | Canonical | Note |
|---|---|---|
| Marqueta | **Marketa** | `tests/partner-workspace.test.ts` actively FAILS on the spec's spelling |
| Know1 | **Kn0w1** (`aigent-kn0w1`) | `RUNTIME_AGENT_IDS` |
| Agent Z / Agent MoneyPenny / Agent C | **Aigent Z · Aigent MoneyPenny · Aigent C** | ontology |
| blakQube | **BlakQube** | ontology (BLAK = Binary Logic Avoiding Knowledge) |
| metaQube | **metaQube** ✓ | already canonical |

Instance identifier: the spec proposes `workspace:horizen-pilot-001`; the shipped registry id is
`horizen-pilot-series-001`. **Recommendation: keep the shipped id** (it is already referenced by
the tab, the canaries and the deep links) and treat `workspace:` as a display prefix. Operator to
confirm — this is the only identifier decision in the plan.

---

## 5. What already satisfies the acceptance criteria

Of the spec's fifteen acceptance criteria, **four are already met** by work shipped 2026-07-26/27:

- (1) partial — Horizen Pilot Series 001 has a canonical workspace inside Venture Lab ✅
- (5) all workspace members can reach the collective Hub ✅ *(gated adminOnly during the pilot)*
- (14) partial — no duplicated state exists today, because no surface yet projects it
- (15) another Partner Workspace can be instantiated from the registry without new architecture ✅

The remaining eleven need Phases 1–5.

---

## 6. Proposed smallest coherent implementation

Ordered to make the pilot operational early and to defer the genuinely new engine work:

**Phase 1 — Workspace state (extend, don't create).** Grow `PartnerWorkspace` toward §12 with the
fields the five views actually render today plus milestones/actions/blockers/participants/agents.
Objectives, phase, layer owners and links already exist. Membership resolves through
`participationAccess` with a workspace scope. *No new store.*

**Phase 2 — Collaboration (pure composition).** Working groups as named sets of existing QubeTalk
channels; `lockerLinks` as references, never content; the invitation flow gains a workspace scope.
The Hub shows *that* a restricted channel exists without exposing it — a visibility rule, not a
new access model.

**Phase 3 — Operations (the first genuinely new piece).** `services/venture/workspaceAdministration.ts`:
daily status and weekly report **derived from canonical state**, composing `briefBuilder`'s shape
at workspace scope rather than persona scope. This is also where tracker row 102 (the Aigent Z
morning report) lands — the two are the same increment; do not build them twice.

**Phase 4 — Evidence + metaCommons (the second new piece).** Evidence view over existing receipts
with the four provenance classes the spec names (observed fact / agent interpretation / human
decision / verified receipt). Then the minimum honest commons: the resource type, the promotion
flow, the approval record, the BlakQube refusal, and a workspace view of approved resources.
**Not** a commons product.

**Phase 5 — Communications.** Marketa integration behind an approval gate.

**Cross-cutting:** every phase ships its canaries, and the projections (Portfolio, α Programme,
Relationship Builder, Financial Services, Marketa) are *reads* added as each phase produces state
worth projecting — never a copy.

---

## 7. What needs operator decision before Phase 1

1. **Roles.** The spec names seven; `venture-lab` has five, not 1:1. Extend `DOMAIN_ROLES` with
   `workspace-steward` / `partner-operator` / `technical-contributor` / `communications-contributor`
   / `observer` / `agent-participant`, or map onto the existing five? *Recommendation: extend —
   capability-based permissions need the distinctions, and the existing five are venture roles, not
   workspace roles.*
2. **Instance id** — keep `horizen-pilot-series-001` (recommended) or migrate to
   `workspace:horizen-pilot-001`.
3. **Actions/decisions substrate** — project from IntentQubes + Constitutional Agreements
   (recommended, no new store) or accept a workspace-local action record?
4. **Pilot visibility** — the Partner group is `adminOnly` today. Partner operators are, by
   definition, not platform admins. **This blocks acceptance criterion (2).** Needs a membership-based
   gate before external participants can enter.
5. **Scope confirmation** — is Phase 1–2 (operational pilot hub) the near-term target, with 3–5
   following, or is the whole spec one delivery?

**Item 4 is the one hard blocker.** Everything else can proceed under the recommendations above.

---

# Amendment A — Cross-Lab audit (operator architectural ruling, 2026-07-27)

**Ruling:** *"The Research Lab and Venture Lab should not have separate collaboration
architectures. They are two domain-specific expressions of the same experimental substrate."*
**Instruction:** *"Do not copy Research Lab Participation into Venture Lab. Extract the shared
experimental-participation substrate, preserve Research and Venture specialisation, and make both
flow through sovereign Lockers, collective Workspaces and the governed metaCommons."*

This amendment answers the ten expanded audit points. Still **audit only** — no code.

## A.1 Headline: the participation substrate is ALREADY extracted

The instruction assumes Research Lab participation is a Research-Lab-shaped implementation that
would have to be copied. **It is not, and it never was.** `services/passport/participationAccess.ts`
was built as a domain-parameterised mechanism on 2026-07-18 (operator + Aletheon), and
`StewardParticipationTab`'s own header states the design intent verbatim:

> *"One mechanism, five access domains (Passport, Research Lab, Venture Lab, metaMe Studio,
> Developer Studio) as a left side-menu… Per domain: issue bounded bearer invitations, see issued
> invitations with claim state, revoke, and read the canonical access-grant record."*

`ACCESS_DOMAINS` already contains `venture-lab`, and `DOMAIN_ROLES['venture-lab']` already carries
five roles. Invitations, claims, revocation, grant records, application validation
(`participantApplicationValidator`), the participant self-view (`participationSelfView`) and the
Passport linkage are all domain-scoped today.

**So the extraction the ruling calls for is roughly 80% done, and the anti-goal it warns against is
structurally impossible to commit by accident** — there is only one implementation to reuse.

What is genuinely missing is **not** the substrate. It is:

1. a **participant-facing surface** — both Labs today expose participation through a *steward*
   workspace plus a self-view API. There is no "Participate" area for a participant in either Lab;
2. the **experiment/workspace spine** that sits above participation; and
3. the **commons** that sits below it.

## A.2 The real asymmetry — the two Labs model different objects

This is the finding that reshapes the plan.

| | Research Lab | Venture Lab |
|---|---|---|
| What is richly modelled | **The experiment.** `EXPERIMENT_REGISTRY`, `ResearchSeries`, `ResearchFinding`, `ResearchPublication`, three pinned lifecycles, `programmeFocus`, `formerly` lineage | **The venture.** `VentureQubeV1` — identity, thesis, intent, signal evidence, archetypes, revenue architecture, commercial model… |
| What is thin | The *workspace* around an experiment (participants, working groups, actions — none exist) | **The experiment.** `PartnerWorkspace` has objectives, phase, layer owners, links — and no hypothesis, milestones, actions, evidence or reports |

**Research models the experiment but not the collaboration. Venture models the entity but not the
experiment.** Neither Lab has the object the ruling names — `ExperimentProgramme` — and neither has
a workspace spine. That is precisely why this is a platform capability rather than a partner portal.

**Corollary:** the common spine is genuinely new in both Labs. It is not extractable from either,
because neither contains it. What IS extractable — participation, Locker, QubeTalk, receipts — is
already shared.

## A.3 Lifecycle mapping (and where it honestly breaks)

The ruling proposes `evidencePosture: observed | validated | reproduced | deployed`. The platform
already pins `FINDING_LIFECYCLE = observed → replicated → canonized-as-invariant` as constitutional
data (order is meaning, canary-enforced).

| Ruling's posture | Existing research lifecycle | Fit |
|---|---|---|
| observed | `observed` | exact |
| validated | — | new; sits between observed and replicated |
| reproduced | `replicated` | same concept, different word |
| deployed | — | **no research counterpart** — a commercial-only terminus |
| — | `canonized-as-invariant` | **no venture counterpart** — a research-only terminus |

**Recommendation:** do NOT unify these into one enum. Keep `FINDING_LIFECYCLE` untouched (it is
pinned canon) and give the commons an `evidencePosture` that *maps* to it per domain. Forcing one
ladder would either falsify a commercial result as canonizable or strand `deployed` outside the
model — exactly the misrepresentation the ruling warns against ("a commercial result should not
silently be represented as a scientific result").

## A.4 Answers to the ten expanded audit points

| # | Point | Finding |
|---|---|---|
| 1 | Extract the Research Lab participation model | **Already extracted** (§A.1). Nothing to extract; something to *surface*. |
| 2 | Identify the reusable participation substrate | `participationAccess.ts` (domains, roles, invitations, grants) + `participationSelfView.ts` + `participantApplicationValidator.ts` + `/api/participation/{claim,my-access}` + `/api/steward/participation/*` |
| 3 | Common Locker + QubeTalk substrate | `services/passport/locker{Items,Storage}.ts`; `services/qubetalk/peerChannel.ts` (channels · messages · `RightsEnvelope` · `SharedArtifact`). Domain-neutral already. |
| 4 | How Research experiments are represented | `types/research.ts` — registry + series + findings + publications + three lifecycles. Rich, canary-pinned, **no participants or workspace** |
| 5 | How Venture pilots are represented | `services/venture/partnerWorkspace.ts` — thin (§A.2). Ventures themselves: `types/ventureQube.ts`, rich but a different object |
| 6 | Define the common Experiment Workspace abstraction | **Net-new in both Labs.** Proposed seam in §A.5 |
| 7 | Configure Research + Venture variants | Domain discriminator + per-domain extension, mirroring the `ACCESS_DOMAINS` pattern that already works |
| 8 | Common metaCommons promotion model | **Net-new.** Doctrine (`services/polity/constitution.ts`) + deterministic stub (`metacommonsSignals.ts`) only |
| 9 | Avoid duplicated participation implementations | **Structurally satisfied** — one implementation exists. The risk is a second *surface*, not a second substrate |
| 10 | Both Labs project into one evidence substrate | Receipts already shared (`activityReceiptService`, DVN pipeline, `capabilityReceiptService`). The commons projection is the missing half |

## A.5 The smallest common abstraction that unblocks Horizen

The ruling's constraint is explicit: *"Horizen should not be delayed by an attempt to redesign the
entire Research Lab."* So the seam is deliberately narrow:

```
ExperimentWorkspace                      ← NEW, minimal, domain-discriminated
  ├─ domain: 'research' | 'venture'
  ├─ experimentClass: scientific | commercial | operational | hybrid
  ├─ participants  → participationAccess grants   (REFERENCE, not a copy)
  ├─ agents        → constitutional agreements    (REFERENCE)
  ├─ lockerLinks   → locker items                 (REFERENCE)
  ├─ workingGroups → named sets of peer channels  (COMPOSITION)
  ├─ milestones · actions · blockers · decisions  ← the only new state
  ├─ evidence      → receipts                     (REFERENCE)
  └─ commonsCandidates → MetaCommonsResource      (NEW, Phase 4)
```

`PartnerWorkspace` becomes the **venture variant** of this — it keeps `partnerName`, `series`,
`layerOwners`, `partnershipContext`, `links`. The research variant is authored later (Phase 4) by
binding `EXPERIMENT_REGISTRY` entries to a workspace; **the registry is not modified to do it.**

Everything marked REFERENCE is the discipline that prevents the second programme-management system
identified in §2 of the base audit.

## A.6 A material defect found during this audit (needs its own decision)

`StewardParticipationTab` calls `/api/steward/participation*` with `authedFetchHeaders` + raw
`fetch`. Those routes resolve the caller through **`getActivePersona`** — they are spine endpoints.
CLAUDE.md's Identity & Access Spine section names this exact pattern as forbidden and
persona-UNAWARE: it attaches the Bearer (so it does not 401) but carries no persona selection, so
the spine resolves a **fallback** persona for an operator who owns several.

Today the blast radius is bounded: the routes gate on `cartridgeFlags.isAdmin`, a global flag, so a
fallback persona belonging to the same admin still passes. **That bound disappears the moment
participation becomes participant-facing** — which is exactly what the Venture Lab Participate area
requires. A partner operator would then read *someone else's* grants, silently and plausibly.

**Additionally: `tests/persona-spine-fetch.test.ts` — the canary CLAUDE.md names as the enforcement
for this rule — does not exist in the repository.** The rule is documented but unenforced.

**Recommendation:** fix the transport (`personaFetch` with a persona hint) and create the missing
canary as a prerequisite of the participant-facing work — not as part of it. Flagged for operator
decision; not fixed in this audit pass.

## A.7 Amended phase sequence

Adopting the ruling's sequence, adjusted for what the audit found:

| Phase | Scope | Change from the ruling |
|---|---|---|
| **0** | Cross-Lab audit | **This document.** Complete |
| **1** | Common participation substrate | **Mostly a SURFACE, not a substrate** — the substrate exists. Add the participant-facing Participate area, domain-configured. Prerequisite: §A.6 |
| **2** | Common three-tier collaboration model | `ExperimentWorkspace` seam (§A.5) + working groups over existing channels + Locker references |
| **3** | Horizen Workspace instance | `PartnerWorkspace` as the venture variant; Aigent Z daily/weekly administration (**one increment with tracker row 102 — do not build twice**) |
| **4** | Research Lab adoption | Bind `EXPERIMENT_REGISTRY` entries to research workspaces **incrementally**; no migration of the registry itself |
| **5** | metaCommons promotion + cross-Lab projections | Resource model, promotion flow, BlakQube refusal, domain provenance (`sourceDomain` · `experimentClass` · `evidencePosture`) |

Horizen becomes operational at the end of Phase 3. Phases 4–5 do not gate it.

## A.8 Decisions this amendment adds to §7

6. **Spine transport defect (§A.6)** — fix + write the missing canary before participant-facing
   participation ships? *Recommendation: yes, as a prerequisite.*
7. **Evidence posture** — keep `FINDING_LIFECYCLE` untouched and map a domain-aware
   `evidencePosture` onto it (recommended), or unify the ladders?
8. **Where the Participate area lives** — a new Venture Lab group (`Venture Lab → Participate`),
   or inside the Partner domain? *Recommendation: its own group — participation is cross-programme,
   not partner-specific.*
