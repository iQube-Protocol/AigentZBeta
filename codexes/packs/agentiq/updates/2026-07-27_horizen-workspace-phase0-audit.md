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

---

# Amendment B — Four-Tier Experimental Operating Model (operator ruling, 2026-07-27)

**Ruling received and recorded in full as the governing architecture.** The correction: this is a
**four-tier experimental operating model**, not a three-tier collaboration model, shared across
both Labs but specialised by domain. Commonality sits at participation, constitutional access,
collaboration, evidence, invariants and commons projection. **Domain richness stays deliberately
asymmetric.**

```
Tier 0  Internal Programme Space            (operator-only, BlakQube-oriented)
Tier 1  Sovereign Locker + Bounded Collab   (participant-sovereign)
Tier 2  Shared Research or Venture Workspace (cohort-scoped metaQube)
Tier 3  Governed metaCommons                (proof commons)
```

Amendment B asks for two audit passes that had not been run. Both are below, with findings.

## B.1 NEW AUDIT — the invariant underpinning of the Venture Lab (§6)

**Finding: the Venture Lab has essentially no invariant underpinning today, and the namespaces
the ruling calls for do not exist.**

The seed crystal holds **365 invariants** across thirteen namespaces:

| Namespace | Count | | Namespace | Count |
|---|---|---|---|---|
| polity | 143 | | capability | 8 |
| reasoning | 89 | | style | 8 |
| constitutional | 38 | | sovereignty | 8 |
| engineering | 24 | | interaction | 7 |
| epistemology | 13 | | representation | 7 |
| experience | 9 | | narrative | 6 |
| | | | cybernetics | 5 |

Status split: **202 canonical · 7 validated · 156 proposed.**

There is **no `commercial`, `operational`, `service`, `transaction`, `adoption` or `value`
namespace.** Keyword coverage across all 365 statements:

| Concept the ruling names | Invariants touching it | Assessment |
|---|---|---|
| commercial | 4 (3 are `sovereignty.*` about provider substitutability) | effectively unmodelled |
| venture | 4 — `polity.166` (Standing calibrates, never gates), `polity.172` (ventures execute, people participate), `polity.174` (VentureQube is a living venture specification), `polity.167` | **doctrine about ventures, not commercial invariants** |
| revenue · customer · delivery · pilot | **0** | absent |
| adoption | 3 | incidental |
| operational | 30 | almost all "operational" as an epistemic qualifier (operational-vs-absolute truth), **not** operational invariants |
| partner | 1 | absent in practice |

**And no code under `services/venture/**` or `types/ventureQube.ts` cites a single invariant id.**
The Venture Lab is not currently invariant-governed in any executable sense — it is
invariant-*described* by four polity invariants and otherwise disconnected from the substrate.

**Consequences for the plan:**

1. The ruling's Venture invariant emphasis (commercial · operational · service-delivery ·
   transaction · value-creation · adoption · partner-operation) is **entirely net-new**. It is
   correctly scoped as *candidates*, and the ruling's own discipline applies: the Venture Lab may
   **apply, test and propose** invariants but **must not canonise** on commercial success.
2. This makes the Hypothesis-vs-Canon rule load-bearing here. Any commercial or operational
   invariant enters at `proposed` and stays there until evidence exists — the same discipline that
   keeps `inv.reasoning.323` proposed.
3. `polity.166` is directly relevant and already canonical: **Standing calibrates confidence; it
   does not gate.** A Venture Lab workspace must not use Standing as an access gate.
4. **Recommendation:** do not create a `commercial`/`operational` namespace in this phase. Add
   `invariantReferences` to the spine (Phase 2) so pilots can *cite* existing invariants and
   *propose* candidates through the established seed-and-ratify path. Namespace creation is its
   own operator ratification.

## B.2 NEW AUDIT — Tier 0 already exists, informally (§2, Tier 0)

The ruling's expectation — *"This tier likely already exists partly within the Partner framework,
Portfolio surfaces, operator workspaces, private Lockers and administrative records"* — is
**confirmed**. Venture Lab's sixteen tabs split cleanly along the Tier 0 / Tier 2 line already:

| Posture | Tabs |
|---|---|
| **adminOnly — de facto Tier 0** | Partner Overview · Collaborate · Operate · Evidence · Communicate · α Programme · AgentiQ OS α · α Docs · Plan Pricing |
| Open to venture participants | Founder Office · Founders Club · Financial Services · Commercial Funnel · Relationship Builder · Growth Matrix · Portfolio |

So Tier 0 needs **recognition and naming, not construction**. What is missing is the *distinction*
— today `adminOnly` conflates "internal programme space" with "platform administration", and the
Partner group is caught in that conflation (§B.3).

## B.3 NEW AUDIT — Partner group posture (§13)

The ruling asks which of three postures the Partner group should take. **Finding: the third — split
it.** The evidence is that all five Partner tabs are `adminOnly`, which is correct for exactly two
of them and wrong for three:

| Partner view | Contains | Correct tier |
|---|---|---|
| Overview (Pilot Command Center) | phase, owner, partner, open actions | **Tier 2** — the shared record; this is what a partner operator must see |
| Collaborate | invitations, peer exchange, Locker | **Tier 2** (Locker contents stay Tier 1) |
| Operate | integration checklist, delivery state | **Tier 2** |
| Evidence | receipts, validation | **Tier 2**, with Tier 0 items filtered |
| Communicate | announcement approvals, partner messaging | **Tier 0 → Tier 2 on approval** — drafting is internal, approved output is shared |

Plus genuinely Tier 0 material with no home today: internal partner assessment, negotiation
posture, commercial assumptions, internal risk analysis, pre-release reports.

**Recommended posture, matching the ruling's preference:**

```
Partner Administration   → internal only        (Tier 0)  — new, small
Partner Workspace        → programme-scoped     (Tier 2)  — the five views, membership-gated
```

**This is the mechanism that resolves the hard blocker** (base audit §7 item 4): partner operators
never become platform admins. The Tier 2 views gate on **workspace membership** resolved through
`participationAccess`; the Tier 0 view keeps `adminOnly`. It also gives the Communicate view its
correct two-stage behaviour rather than one blanket gate.

## B.4 Accepted without change

- **Evidence posture — map, don't unify** (§8). Accepted; already the audit's own recommendation.
  `FINDING_LIFECYCLE` stays pinned canon; `CommonsEvidencePosture` carries `sourceLifecycle` so the
  native ladder is never erased.
- **Four proof classes** (§9) — scientific · operational · commercial · constitutional. Adopted as
  the commons discriminator. Note that **constitutional proof is the only class both Labs produce
  natively**, which makes it the right first proof class to implement.
- **Narrow spine** (§5) — accepted verbatim; matches the seam proposed in Amendment A §A.5, now
  extended with `invariantReferences` per §6.
- **Transport defect as a prerequisite** (§12) — accepted, with the eight sub-requirements as the
  acceptance criteria for that work.
- **Participation surfaces** (§11) — accepted; Venture Lab Participation as its own cross-programme
  group.

## B.5 Revised implementation sequence (supersedes Amendment A §A.7)

| Stage | Scope | Gating |
|---|---|---|
| **Prerequisite** | Persona-safe participation transport: `personaFetch` on the steward routes, the missing `tests/persona-spine-fetch.test.ts` canary, mutation-tested, multi-persona isolation, non-admin participation | **Blocks Phase 1** |
| **Phase 1** | Participant-facing Participation surfaces, both Labs, over the existing domain-scoped substrate. No new participation engine | Prerequisite |
| **Phase 2** | Common `ExperimentWorkspace` spine — everything by reference except milestones/actions/blockers/decisions; `invariantReferences` included | — |
| **Phase 3** | **Horizen Workspace**: Tier 0 Partner Administration split from Tier 2 Partner Workspace (§B.3), participant Lockers + bounded QubeTalk, Aigent Z administration + weekly reporting (**one increment with tracker row 102**), Venture Lab projections | Phases 1–2 |
| **Phase 4** | Research Workspace adoption of the same four tiers, without weakening the native experimental model | Does **not** gate Horizen |
| **Phase 5** | metaCommons proof layer — governed promotion, four proof classes, domain-aware posture, commons reporting | Does **not** gate Horizen |

**Horizen becomes operational at the end of Phase 3.**

## B.6 Governing formulation (recorded verbatim as canon for this workstream)

> The Research Lab and Venture Lab are parallel experimental environments operating on a common
> constitutional and collaborative substrate. The Research Lab is scientifically rich and primarily
> produces structural and scientific proof. The Venture Lab is venture-rich and primarily produces
> commercial and operational proof. Both are constitutionally governed, both may apply and test
> invariants, and both contribute approved evidence into a shared metaCommons.

## B.7 Decisions outstanding after Amendment B

Amendment B resolves base-audit items 4 (partner access → split, §B.3), 7 (evidence posture → map)
and 6 (transport → prerequisite). Still open:

1. **Roles** — extend `DOMAIN_ROLES['venture-lab']` with the workspace roles? *(recommend yes)*
2. **Instance id** — keep `horizen-pilot-series-001`? *(recommend yes)*
3. **Actions substrate** — project from IntentQubes + Agreements rather than a new store? *(recommend yes)*
4. **NEW — invariant namespaces** — confirm that no `commercial`/`operational` namespace is created
   in this phase, and that Venture invariant candidates enter at `proposed` via the existing
   seed-and-ratify path (§B.1). *(recommend yes)*
5. **Scope** — authorise Prerequisite + Phases 1–3 as the Horizen delivery, with 4–5 following?

---

# Amendment C — CORRECTION to §B.1, and the commercialisation discovery proposal

**The operator challenged §B.1 on two points. Both challenges are correct, and §B.1 was wrong in
an important way. This amendment supersedes it.**

## C.1 What §B.1 got wrong — a methodological error

§B.1 concluded that "the Venture Lab has essentially no invariant underpinning" and that "no
`commercial` or `operational` namespace exists". **That conclusion was drawn from the wrong
source.** I counted `codexes/packs/irl/foundation/canonical-invariants.seed.json` — the **canonical
seed crystal** — and treated it as the whole invariant population. It is not.

**Discovered invariants live in the runtime invariant STORE, not the seed file.** The seed is what
has been ratified into canon; discovery output lands in the store as `proposed`, scoped by domain.
`services/experiments/expP2Utility.ts` reads them live:

```ts
const slice = await buildInvariantSlice({ domains: [domain], statuses: ['proposed'], limit: 40 });
// DEFAULT_DOMAIN = 'financial-services'
```

…and its failure message names the population explicitly: *"discovered FS invariant library is
empty — promote some discovered financial-services invariants (they land as `proposed`)."*

Likewise a `finance` namespace **does** exist and is grounded against in production —
`services/constitutional/moneyPennyArchitect.ts` calls
`buildInvariantSlice({ namespaces: ['finance'], limit: 8 })`. My namespace census was seed-scoped
and therefore incomplete.

**Correct statement of the finding:** the seed crystal contains no commercial/operational
namespace. The runtime store contains a **discovered financial-services invariant library**,
`proposed`-status, produced by the Invariant Discovery Engine and already under experimental test
by EXP-011.

## C.2 Answering "do you have sight of the proposed FS invariants?"

**Honestly: I can see the machinery and the seam, not the rows.** The discovered library lives in
Supabase, and this sandbox has no database access. What I can confirm from source:

| Question | Answer from source |
|---|---|
| Does an IDE exist? | **Yes** — `services/invariants/discoveryEngine.ts` (CFS-048, chartered 2026-07-20) |
| Is it aimed at Financial Services? | **Yes** — `expP2Utility` defaults `domain: 'financial-services'` |
| What documents does it ingest? | `EvidenceKind`: legislation · regulation · compliance · standard · contract · policy, plus (PRD-ICA-001 §6, 2026-07-22) **academic-literature** (actuarial standards, risk-science papers), **incident-report** (bank/insurance/operational post-mortems), **disclosure-report** (annual/risk/stress-test reports, aggregate-only per Crystal Canon Collection H) |
| At what abstraction? | Ladder `L0 verbatim → L1 summary → L2 cross-regulation → L3 domain-constitutional → L4 domain-independent`. **Discovery targets L2–L3**; L4 emerges from cross-domain comparison |
| Scope ladder | `domain · sub-domain · capability` — so a new commercialisation scope needs **no engine change** |
| Compare semantics | `supported · specialized · split · novel · equivalent` (Aletheon, 2026-07-20) |
| Recorded runs | Charter + four build records in `agentiq/updates/2026-07-20_cfs-048-*` and `2026-07-21_cfs-048-recursive-compression.md`. **Run *results* are DB state — not visible here** |

To answer the question properly I would need either a DB read or the Laboratory's Invariant
Discovery / Invariant Registry view filtered to `domains: ['financial-services'], status: proposed`.
**That is a five-minute check on the deployed app, and I'd rather you point me at it than have me
infer a count.**

## C.3 Answering "is the platform not already observer- and invariant-driven, including Venture Lab?"

**Yes — and §B.1 understated it.** The correction matters because it changes what Phase 2 has to
build. Invariant grounding is applied at the **engine** level, so surfaces inherit it without
citing invariant ids:

| Seam | Where | Reaches Venture Lab? |
|---|---|---|
| `groundReasoning` | `/api/assistant/ask-agent` | Yes — the assistant path serves venture surfaces |
| `resolveConstitutionalField` | `constitutionalServicePipeline`, `services/companion/observerContext.ts` | Yes |
| Five Invariant Decision Nodes | `services/invariants/nodes/` — `discoveryRanking · journeyProgression · nbeRanking · routingStage · standingScore` | Yes — `standingScore` and `nbeRanking` are venture-facing |
| `buildInvariantSlice` | `moneyPennyArchitect` (`namespaces: ['finance']`) | **Directly** — Financial Services |
| **`invariantsUsed` + `forecastConsequences`** | **`services/venture/blueprintHandoff.ts`** | **Directly — this is Venture Lab code resolving invariants and recording which were used** |

So my claim that "no venture code cites a single invariant id" was **literally true but misleading**.
`blueprintHandoff` doesn't hardcode ids — it *resolves* them at runtime and records `invariantsUsed`,
which is the better pattern and exactly what the spine intends. Reading absence of literals as
absence of grounding was the error.

**Revised finding:** the Venture Lab **is** invariant- and observer-driven through the shared
engines. What it lacks is not grounding — it is a **domain substrate to ground *against***. The
discovered FS library is about financial-services *practice* (drawn from regulation, standards and
incident post-mortems); nothing in it is about **commercialisation**.

**Consequence for the plan:** Phase 2's `invariantReferences` is now *smaller* than Amendment B
implied — the resolution seam exists and is proven in `blueprintHandoff`. The workspace records
which invariants a pilot resolved; it does not need new grounding machinery.

## C.4 The operator's proposal — Financial Services Commercialisation as the next IDE target

**Assessment: well-formed, supported by the existing engine, and it fills the precise gap C.3
identifies.** No engine change is required — `DiscoveryScopeLevel` already admits
`domain | sub-domain | capability`.

What a commercialisation substrate would cover, and which existing corpus does *not*:

| Existing FS discovery | Proposed FS Commercialisation discovery |
|---|---|
| regulation · compliance · standards · contracts · policy · incident post-mortems | pricing · packaging · demand evidence · adoption · conversion · unit economics · partner operations · distribution · retention · service-delivery economics |
| Answers *"what must hold for a financial service to be sound?"* | Answers *"what must hold for a financial service to be commercially viable and repeatable?"* |
| L2–L3 domain-constitutional | L2–L3, with genuine L4 potential — commercialisation invariants likely generalise beyond finance |

**Three design cautions, offered before rather than after:**

1. **Scope it as a sub-domain, not a new domain.** `financial-services / commercialisation` keeps
   the Compare machinery able to classify against the existing FS baseline (`supported ·
   specialized · split · novel · equivalent`). A sibling top-level domain would forfeit that, and
   the comparison is where the value is.
2. **Corpus honesty.** The current `EvidenceKind` set is regulatory/actuarial. Commercialisation
   evidence is a different literature — pricing studies, adoption research, go-to-market
   post-mortems, disclosed unit economics. Either the corpus campaign targets those explicitly, or
   discovery will re-derive compliance invariants wearing commercial labels. **`disclosure-report`
   already exists and is aggregate-only per Crystal Canon Collection H** — that constraint carries
   over.
3. **Everything enters `proposed`.** Commercialisation claims are empirical claims about the world.
   The Hypothesis-vs-Canon rule applies with full force: no commercialisation invariant becomes
   `canonical` because a pilot succeeded. The Venture Lab **applies and tests**; it does not
   canonise.

**Why this sequences well with Horizen:** the Horizen pilot is precisely a commercialisation
experiment in financial services. It would be the **first field test** of a commercialisation
substrate — the recursive loop the ruling describes (Research discovers → Venture applies →
commercial evidence appends → refined pattern returns to metaCommons), instantiated on its natural
first case.

**Recommendation:** charter it as its own increment — **not** inside the Horizen delivery. It is a
discovery campaign with its own corpus acquisition, and folding it into a workspace build would
delay Horizen and blur two very different kinds of work. Run them in parallel; let Horizen consume
whatever the campaign has promoted by the time Phase 3 lands.

## C.5 Corrections to record

- §B.1's headline claim is **withdrawn**. The Venture Lab is invariant-driven through shared
  engines; `blueprintHandoff` is the proof.
- §B.1's namespace census stands **only for the seed crystal** and must not be read as the whole
  invariant population.
- The §B.7 decision item 4 ("confirm no commercial/operational namespace is created") is
  **superseded**: the question is not whether to create a namespace but whether to charter a
  **commercialisation discovery campaign** scoped as an FS sub-domain (§C.4).

---

# Amendment D — The Proof Commons (constitutional design principles, operator ruling 2026-07-27)

Four rulings, recorded as constitutional design principles governing this workstream and the
metaCommons implementation. Plus one naming collision the audit is obliged to flag before the name
is adopted.

## D.1 PRINCIPLE — The Commons is a Proof Commons, not a knowledge commons

> *"The thing that both Labs genuinely have in common is not knowledge. It's evidence."*

```
        Research → Knowledge → Commons        (superseded)
        Research → Proof     → Commons        (canonical)
```

**Knowledge becomes a projection of proof, not the other way round.** The four native proof
classes — **scientific · operational · commercial · constitutional** — are the commons' primary
discriminator, established in Amendment B §9 and now promoted from a classification scheme to the
commons' *reason for existing*.

**Immediate consequence for the implementation — the promotion verb changes.** Not *Publish to
Commons*. **Submit Proof** / **Promote Evidence**. Everything entering carries an evidence
posture, a claim scope and supporting evidence references. Opinion, documentation, chat and notes
are **not** commons-eligible; they are Tier 1 or Tier 2 material that may *support* a proof
submission without being one.

This is a stricter gate than the earlier "governed projection" framing, and it is the right one: it
makes the commons falsifiable by construction. A submission that cannot name its evidence cannot
enter.

## D.2 PRINCIPLE — Constitutional proof is the spine

```
                Constitutional Proof
        /               |               \
  Scientific       Commercial       Operational
```

The audit's observation is ratified as architecture: **constitutional proof is the only class both
Labs already produce natively**, and the platform already generates it continuously —

| Producer | Constitutional proof it emits |
|---|---|
| Passport | personhood continuity, credential validity |
| Standing | accrual correctness, calibration-not-gating (`inv.polity.166`) |
| Delegation | boundedness, sponsorship, revocation |
| Receipts + DVN | attribution, tamper-evidence, anchoring |
| Access spine | policy operated correctly, protected information stayed protected |

**Implementation consequence: constitutional proof is the FIRST proof class to implement**, in
Phase 5. It is the cheapest to make real (the producers already exist and are receipted) and it is
the substrate the other three hang from. Building scientific or commercial proof first would mean
building the branches before the trunk.

## D.3 PRINCIPLE — Resolved invariants with provenance, never stored ids

> *"The Workspace should never store: Invariant 143, Invariant 201, Invariant 98. It stores
> Resolved Invariants with provenance. Exactly like Blueprint Handoff already does."*

Ratified, and it has a working precedent to copy verbatim: `services/venture/blueprintHandoff.ts`
resolves invariants at runtime and records `invariantsUsed` with a consequence forecast, rather
than hardcoding ids.

**The rule for the spine (Phase 2):** `invariantReferences` on an `ExperimentWorkspace` records
*what was resolved, when, by which resolution, and with what provenance* — never a literal id list
authored by hand. A hand-authored id list would make the workspace a second source of truth for
canon, which is the `inv.engineering.036` defect this whole session has been eliminating. It would
also silently rot the moment an invariant is renumbered — the exact failure mode the EXP-P2/P3
renumbering exposed earlier today.

## D.4 PRINCIPLE — Commercialisation discovery is its own programme

Ratified as two independent programmes, with the dependency running one way only:

```
Programme A — Commercialisation Invariant Discovery
  GTM literature · pricing research · adoption studies · commercial failures ·
  post-mortems · SaaS metrics · marketplaces · venture scaling · network effects
        ↓ IDE
  Commercialisation invariant candidates (status: proposed)

Programme B — Horizen Pilot
  consumes A's candidates → tests them in operation → operational + commercial proof
        ↓ feeds back
  Programme A
```

**Horizen is the first CONSUMER of the discovery, not the discovery itself.** Programme B must not
be gated on Programme A: if A has promoted nothing by the time Phase 3 lands, Horizen runs against
existing constitutional and financial invariants and contributes its evidence back regardless.

### D.4a Operator refinement — platform campaign, Financial Services as first corpus

> *"I'd make it a platform discovery campaign with Financial Services as its first instantiated
> corpus… commercialisation invariants almost certainly transcend sectors."*

**Accepted, and it is stronger than the audit's own recommendation.** Amendment C §C.4 advised
scoping commercialisation as an FS *sub-domain* so Compare could classify against the FS baseline.
That was too conservative: a cross-sector commercialisation domain is precisely the path to **L4
(domain-independent)** invariants, which the discovery engine already defines as *"discovered later
by cross-domain comparison."* The operator's framing targets L4 deliberately rather than settling
for L3.

**One sequencing caution that follows, in the engine's own vocabulary.** With only one sector's
corpus ingested, discovery *cannot yet distinguish* a commercialisation invariant from a
financial-services commercialisation invariant. The engine already has the right word for this:
`specialized` (one branch only) versus `supported` (recurs across ≥2 sub-domains).

**Rule: anything discovered from a single sector's corpus is classified `specialized` until a
second sector's corpus confirms it.** Promotion to `supported` requires the second sector. This
keeps the L4 ambition honest without waiting for it — FS runs first, and the claim strengthens as
AI, healthcare, manufacturing, mobility and energy corpora land.

## D.5 The recursive loop, closed

```
Discovery → Candidate Invariants → Canonical Invariants → Applied in Ventures
    ↑                                                              ↓
New Questions ← Operational Proof ← Commercial Proof ←─────────────┘
```

Recorded as the governing loop. Two disciplines keep it honest, both already canon:

- **Direction of canonisation.** Only the Research Lab canonises. The Venture Lab applies, tests,
  and *proposes* — a commercial success never promotes an invariant to `canonical` (Amendment B
  §B.1, Hypothesis-vs-Canon).
- **Falsification travels too.** The loop must carry failures: an invariant that fails under real
  operating conditions is a first-class commons submission (a proof of the negative), not an
  omission. The evidence posture must be able to express *falsified in deployment*.

## D.6 Lab articulation (recorded as canon for this workstream)

| Lab | Primary function | Primary output | Asks |
|---|---|---|---|
| **Research Lab** | Discover and validate invariants | Scientific & structural proof | *"What is true?"* |
| **Venture Lab** | Apply invariants in real ventures | Commercial & operational proof | *"Does it work in the real world?"* |
| **Proof Commons** | Preserve and govern validated proof | Constitutional memory | *"What has now been demonstrated?"* |

## D.7 NAMING — a three-way collision the audit must flag

The operator's ruling: *"We can call it the metaProof Commons aka metaCommons."* Recorded. But
**`metaProof` is already a load-bearing platform term with two distinct existing meanings**, and
adopting a third without deciding is how ontology drift starts:

| Existing usage | Where | What it names |
|---|---|---|
| **metaProof Agent Harness** | `CLAUDE.md` §"metaProof Agent Harness"; `docs/agent-harness/metaproof-core.md` — *"Source of truth. All tool-specific instruction layers are derived from this file"* | The canonical agent-harness spec (role hierarchy, NBE contract, DVN receipt taxonomy, QubeTalk conventions) |
| **MetaProof operators** | The Horizen Workspace spec, §5.2 and §6 — *"authorised MetaProof operators"* | The organisation / platform side of the partnership, as distinct from Horizen |
| **metaProof Commons** | This ruling | The proof commons |

These are reconcilable — arguably they share a root idea (the platform *is* the proof system) — but
the ontology must say so explicitly rather than leave three referents sharing one word.

**Recommendation (operator decision required):**

- **Canonical concept:** **Proof Commons** — this is the constitutional term, and it is unambiguous.
- **Canonical implementation:** **metaCommons** — already in the codebase (`metacommonsSignals.ts`,
  the metaCommons Charter in Polity Core) and already ontologically distinct.
- **Use "metaProof Commons" as a descriptive alias only**, not as an identifier — no type, service,
  route, or table takes the name.
- If `metaProof` is to become the umbrella brand for the proof system as a whole, that is a
  **separate ontology ruling** that would need to reconcile the harness and the operator-side usages
  in `docs/platform-ontology.md`. Not decided here.

This keeps the ruling's intent (the Commons is about proof) while preventing a single word from
naming an agent harness, an organisation and a knowledge substrate simultaneously.

## D.8 Consequences for the implementation plan

| Change | Effect |
|---|---|
| Promotion verb becomes **Submit Proof** | Phase 5 gains an evidence-posture requirement at the gate; submissions without evidence references are refused |
| **Constitutional proof implemented first** | Phase 5 reorders: constitutional → operational → commercial → scientific |
| **Resolved invariants, never ids** | Phase 2 `invariantReferences` copies the `blueprintHandoff` pattern; a canary should forbid hand-authored id arrays on workspace records |
| **Programme A independent** | Commercialisation discovery chartered separately; Horizen is not gated on it |
| **Single-sector = `specialized`** | Programme A's promotion rule; L4 claims require a second sector |
| **Falsification is submissible** | The evidence posture must express failure in deployment, not only success |

---

# Amendment E — metaProof Commons formalised (operator ruling, 2026-07-27)

**Resolves the D.7 naming collision.** The ruling separates the constitutional object from the
product surface, exactly as the platform already does elsewhere:

| Layer | Name | Precedent |
|---|---|---|
| Constitutional concept | **metaProof Commons** | *MetaProof* — the operating entity |
| Product / UI name | **metaCommons** | *metaMe* — the experiential runtime |

**Canonised in `docs/platform-ontology.md`** (mandatory reading for every agent) so the pairing
travels beyond this workstream. The terminology canon parser (`loadTerminologyCanon`) picks the
section up automatically; the ontology canary passes.

## E.1 Constitutional definition (recorded verbatim)

> The **metaProof Commons (metaCommons)** is the governed constitutional commons of scientific,
> operational, commercial and constitutional proof generated across the metaProof ecosystem.

Stated as exclusions, because each was a live misreading during this audit: **not** a document
repository, **not** a social feed, **not** a wiki, **not** simply a knowledge base. It is a
**governed proof substrate**, and knowledge is an interpretation or projection of accumulated
proof.

## E.2 CORRECTED — metaProof is the organisation (operator, 2026-07-27)

**The D.7 "collision" was not a collision, and E.2's first answer over-thought it.** I framed
`metaProof` as an *ecosystem prefix* naming three referents that needed disambiguation. The
operator's correction is simpler and correct:

> *"metaProof is an organisation that produces various organisation branded products eg metaProof
> Commons, metaProof Agent Harness and has metaProof Operators. Like metaMe, metaProof is the
> canonical spelling."*

So there is nothing to reconcile — this is the ordinary relationship between a company and its
branded products:

| | |
|---|---|
| **metaProof** | the organisation |
| **metaProof Commons** (product: **metaCommons**) | an organisation-branded product |
| **metaProof Agent Harness** | an organisation-branded product |
| **metaProof Operators** | people of the organisation |

**Canonical spelling: `metaProof`** — lowercase `m`, capital `P`, exactly as **metaMe**. The two
are siblings. "MetaProof" is a non-canonical variant and is now a spelling bug under the ontology's
Enforcement rule.

**Recorded in `docs/platform-ontology.md`** as its own canonical term, alongside the metaProof
Commons entry. A spelling canary enforces it.

**Two occurrences left uncorrected, deliberately:** `CHRYSALIS_WORKSTREAM_TRACKER.md` row 98 and
`CRP-003a` §front-matter both quote an operator-supplied PRD's own label — *"PRD v1.0 (MetaProof
Internal)"*. Those are provenance, not prose: correcting the title of a source document would
falsify how that document identified itself, which is the same discipline applied to EXP-P1's
countersigned §14. Every non-quoted use is canonical.

## E.3 PRINCIPLE 5 — Only governed proof enters the metaProof Commons

> *"Not every observation. Not every discussion. Not every report. Only proof that has passed the
> appropriate governance for its domain and classification."*

This sits **above** the four proof classes and is the strictest gate in the architecture. Its
implementation consequences:

1. **Submission is refused, not filtered.** A submission without evidence references, a claim scope
   and an evidence posture never enters — it is not accepted-then-hidden. The Commons has no
   ungoverned tier.
2. **Governance is domain-appropriate, not uniform.** Scientific proof answers to the research
   lifecycle (`observed → replicated → canonized-as-invariant`, pinned canon); commercial and
   operational proof answer to their own postures; constitutional proof answers to receipts and
   access decisions. **One gate, four rulebooks** — the mapping discipline of Amendment B §8.
3. **The BlakQube refusal is a special case of this principle**, not a separate rule: unapproved
   Tier 0/Tier 1 material is by definition ungoverned proof.
4. **Canary:** no code path may write a commons record without an `ApprovalRecord` and at least one
   evidence reference. This is the single most important canary in Phase 5 — it is what stops the
   Commons decaying into the document repository the definition excludes.

## E.4 The complete architecture (recorded as canon for this workstream)

```
Research Lab ──── Scientific Proof ────► Research Workspace ─────┐
                                                                 ▼
                                                    metaProof Commons
                                                       (metaCommons)
                                                                 ▲
Venture Lab ◄──── Venture Workspace ◄──── Commercial / Operational / Constitutional Proof
```

And the recursive loop, with the direction of canonisation preserved:

```
Invariant Discovery → Candidate Invariants → Canonical Invariants
        ▲                                            │
        │                                   ┌────────┴────────┐
   New Questions                    Applied in Research   Applied in Ventures
        ▲                                   │                 │
        │                          Scientific Proof   Commercial · Operational
        └──────────────────────────────────┴─────────┬───────┘   · Constitutional Proof
                                                      ▼
                                             metaProof Commons
```

**Only the Research Lab canonises.** The Venture Lab applies, tests and proposes; commercial
success never promotes an invariant to `canonical` (Amendment B §B.1, D.5).

## E.5 UI vocabulary (product surface)

Recorded so the surfaces are built with one voice:

- *Submit to metaCommons* · *Promote to metaCommons* · *Review in metaCommons* ·
  *Search metaCommons* · *Publish from metaCommons*
- **Never** *"publish to metaCommons"* — publication is what happens **from** the Commons, after
  governance; submission is what happens **to** it.

## E.6 Consolidated principles governing this workstream

| # | Principle | Source |
|---|---|---|
| **P1** | The Commons holds **proof**, not knowledge; knowledge is a projection of proof | D.1 |
| **P2** | **Constitutional proof is the spine** — produced everywhere, implemented first | D.2 |
| **P3** | Workspaces record **resolved invariants with provenance**, never hand-authored ids | D.3 |
| **P4** | **Commercialisation discovery is its own programme**; Horizen is its first consumer, never its gate | D.4 |
| **P5** | **Only governed proof enters the metaProof Commons** | E.3 |

Supporting disciplines already recorded: single-sector findings stay `specialized` until a second
corpus confirms them (D.4a); falsification is a first-class submission (D.5); the four tiers are
information boundaries, not four authentication systems (B); evidence postures **map**, never
unify (B.4).

---

# Delivery record — Phase 2: the common `ExperimentWorkspace` spine

**Shipped 2026-07-27.** `f14bb33af`. Suite 1918/1918 (145 files).

## What was built

| File | Role |
|---|---|
| `services/experiments/experimentWorkspace.ts` | The spine — domain-discriminated workspace, all references, invariant resolution, action + decision projections |
| `services/experiments/workspaceTracking.ts` | The only workspace-local state: milestones + blockers |
| `supabase/migrations/20260824000000_experiment_workspace_tracking.sql` | One table, RLS-enabled, service-role only |
| `tests/experiment-workspace.test.ts` | 11 canaries, mutation-tested |

## The reference table (what is stored vs. what is resolved)

| Concern | Where it lives | On the workspace |
|---|---|---|
| Participants | `participationAccess` grants | `{ domain, roles }` — where to look, never who |
| Agents | canonical agent ids + Constitutional Agreements | agent ids only; agreements resolved live |
| Actions | IntentQubes (`nbe_plans`) | **projected**, `projectWorkspaceActions()` |
| Decisions | Constitutional Agreement lifecycle | **projected**, `projectWorkspaceDecisions()` |
| Evidence | activity receipts | `{ cartridge, actionTypes }` |
| Invariants | the runtime invariant store | **resolved with provenance**, `resolveWorkspaceInvariants()` |
| Channels | QubeTalk peer channels | working groups = named sets of channel ids |
| **Milestones · blockers** | **nowhere else** | **the only new state** |

Operator ruling honoured verbatim: *actions substrate = **Hybrid***.

## The venture variant is a derivation, not a second list

`experimentWorkspaceFromPartner()` projects `PARTNER_WORKSPACES` onto the spine. The partner record
is carried by identity (`ws.partner === partner`), not reshaped — so the registry stays the single
authoritative source and the next partner is one new entry there and zero here
(`inv.engineering.036` / `.037`). The research variant binds `EXPERIMENT_REGISTRY` entries in
Phase 4; the registry is not modified to do it.

## Amendment D Principle 3, enforced

`resolveWorkspaceInvariants()` copies `services/venture/blueprintHandoff.ts` in shape: resolve the
workspace's own operator-facing text through the canonical ontology, look the seed ids up in the
runtime store, and record **what resolved, against which canon version, via which resolution
source**, plus the concepts canon does **not** govern (`unresolved` — surfaced, never hidden). A
canary fails the build on any literal `inv.*` id in the spine's executable source.

## The refusal teaches the architecture

`assertTrackableKind()` rejects `action`, `decision`, `participant`, `evidence` and `invariant` **by
name**, each with the substrate that owns it — so the next agent to reach for a workspace action
store is told where actions already live rather than left to rediscover the ruling.

## Mutations verified to fail the suite

literal invariant id in the spine · an invented participation role · a dropped refusal · a
`messages` field on the spine · a `persona_id` column in the migration · a blocker reaching `done`.

## Operator action required — run this SQL in the Supabase SQL editor

The Phase 2 code soft-fails to empty until this table exists (milestones and blockers read as
none; every projection and resolution works without it).

```sql
CREATE TABLE IF NOT EXISTS public.experiment_workspace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  layer text,
  owner_agent_id text,
  due_date date,
  linked_intent_id text,
  linked_agreement_id text,
  created_by_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experiment_workspace_items
  DROP CONSTRAINT IF EXISTS experiment_workspace_items_kind_check;
ALTER TABLE public.experiment_workspace_items
  ADD CONSTRAINT experiment_workspace_items_kind_check
  CHECK (kind IN ('milestone', 'blocker'));

ALTER TABLE public.experiment_workspace_items
  DROP CONSTRAINT IF EXISTS experiment_workspace_items_status_check;
ALTER TABLE public.experiment_workspace_items
  ADD CONSTRAINT experiment_workspace_items_status_check
  CHECK (status IN ('open', 'in_progress', 'done', 'cleared'));

CREATE INDEX IF NOT EXISTS experiment_workspace_items_workspace_idx
  ON public.experiment_workspace_items (workspace_id, kind, status);

CREATE INDEX IF NOT EXISTS experiment_workspace_items_created_idx
  ON public.experiment_workspace_items (created_at DESC);

ALTER TABLE public.experiment_workspace_items ENABLE ROW LEVEL SECURITY;
```

## What Phase 2 deliberately did NOT build

- **No surface.** The spine has no tab; Phase 3 renders it inside the Horizen Workspace.
- **No channel provisioning.** Working groups carry empty `channelIds` until convened — honest, not
  a placeholder for a parallel store.
- **No Locker items.** `lockers` is empty until Phase 3 attaches participant Lockers by commitment.
- **No research variant.** Phase 4, and it does not gate Horizen.

---

# Delivery record — Phase 3: the Horizen Workspace becomes operational

**Shipped 2026-07-27.** `85b587476` (3a) + `7bf5f1227` (3b). Suite 1967/1967 (148 files).

Per Amendment B §B.5, **Horizen becomes operational at the end of Phase 3.** Phases 4–5 do not
gate it.

## 3a — the tier split (§B.3, operator ruling "Partner gate = split agreed")

| Partner view | Tier | Gate |
|---|---|---|
| Overview · Collaborate · Operate · Evidence | **2** | `participationDomain: 'venture-lab'` |
| Communicate | **0** | `adminOnly` — until the two-stage draft/share behaviour exists |
| **Administration** (new) | **0** | `adminOnly` |

**This resolves the hard blocker** (base audit §7 item 4): partner operators see the shared record
without becoming platform admins.

**Communicate deliberately stayed Tier 0.** The audit's target is two-stage — internal drafting,
shared on approval. Until the approval step exists, widening it would publish drafts, which is the
failure the two-stage design prevents. Only the safe half shipped.

### The gate

`services/passport/participationTabGate.ts` — ONE implementation, called by `getEnabledTabs` and all
four tab tiers in `CodexPanelDynamic`. Two properties are load-bearing and canary-enforced:

1. **It never widens `adminOnly`.** A tab carrying both stays admin-only, so adding a domain to an
   existing tab cannot open it by accident.
2. **It fails closed.** Before grants resolve, a gated tab is hidden — "not answered yet" must not
   be readable as "yes".

The group-level `adminOnly` it replaced existed so a non-admin would not see a Partner pill that
filters to empty. That is now **structural**: a group with no visible tabs does not render
(**MS-9** — a control that cannot act must not render).

### The server still decides

`GET /api/venture/workspace/[workspaceId]` resolves membership through
`resolveParticipationSelfView` — the same resolver `/api/participation/my-access` and the client
gate use, so the three can never disagree about who is a member (CS-001 discipline). Tier 0 content
is returned to admins only. The tab gate governs what RENDERS; the route governs what is PERMITTED.

### Administration renders the Phase 2 spine

Reference integrity · invariants resolved with provenance (canon version, resolving term, source) ·
projected decisions · milestones · blockers. Empty sections say they are empty and why.

## 3b — Aigent Z workspace administration (tracker row 102, built ONCE)

`services/experiments/workspaceReport.ts` + `GET|POST /api/venture/workspace/[workspaceId]/report`.

- **Daily and weekly are one composer with two windows**, not two reports. A canary fails on a
  second builder or a period-branched body.
- **No new data source** — projected actions, projected decisions, workspace-local
  milestones/blockers, reference integrity, invariant resolution. A direct database read in the
  composer fails the suite.
- **Gaps are reported, not dropped.** No working-group channel is convened yet, so the
  communication section says exactly that.
- **GET composes · POST publishes.** Publishing additionally requires admin: a member may read
  programme state without minting a record of it.
- **`workspace_report_published`** added to the TS union, `ANCHORABLE_ACTION_TYPES` and the CHECK
  constraint **in one commit** — the 2026-07-15 and 2026-07-26 drift incidents were both a type
  present in some of those and not others, failing in silence. The DVN change is an **action-type
  addition only**, the one change that file permits unilaterally.

## Operator actions required

**1. Run this SQL** (in addition to the Phase 2 table above) so report receipts can be written —
without it every report write is rejected by the CHECK constraint and discarded silently.

> **Corrected 2026-07-27.** The block first published here was hand-transcribed and dropped
> `operator_action_logged` and `standing_document_added` — two Standing-signal types with live rows
> — so the `ADD CONSTRAINT` failed with *"violated by some row"*. The authoritative list is
> `supabase/migrations/20260824000100_receipt_action_type_workspace_report.sql`; the block below is
> generated from it. **Never hand-transcribe a constraint list** — that is the same
> single-source-of-truth failure the migration itself exists to prevent, committed in the prose
> describing it.

```sql
ALTER TABLE activity_receipts
  DROP CONSTRAINT IF EXISTS activity_receipts_action_type_check;

ALTER TABLE activity_receipts
  ADD CONSTRAINT activity_receipts_action_type_check
  CHECK (action_type IN (
    'intent_queued','specialist_consulted','artifact_created','artifact_published','artifact_sent',
    'approval_granted','approval_rejected','experience_model_updated','session_started','session_completed',
    'passport_application_submitted','passport_issued','passport_status_changed',
    'passport_revoked','passport_privilege_changed','passport_infraction_recorded',
    'governance_decision_ratified','governance_decision_amended',
    'governance_authority_exercised','governance_escalation_triggered',
    'experience_task_completed',
    'agent_revocation_state_changed',
    'agent_delegated','agent_delegation_revoked',
    'operator_action_logged','standing_document_added',
    'plan_purchased','plan_renewed',
    'invariant_discovered','invariant_validated','invariant_canonized','invariant_superseded',
    'invariant_qube_published',
    'knowledge_curated','consequence_forecast_recorded','knowledge_evolved',
    'experience_render_validated',
    'implementation_pack_generated',
    'implementation_dispatched',
    'deployment_proposed',
    'constitutional_validation_recorded',
    'remediation_recorded',
    'deployment_authorized',
    'validation_override_granted',
    'research_lifecycle_transition',
    'experiment_result_published',
    'venture_blueprint_handoff',
    'standing_accrued',
    'capability_registered',
    'capability_operationally_validated',
    'invariant_node_flipped',
    'agreement_formed',
    'agreement_authorized',
    'qubetalk_artifact_shared',
    'qubetalk_artifact_opened',
    'qubetalk_artifact_copied',
    'finance_authoritative_execution',
    'capability_deprecated',
    'canonical_plate_composed',
    'plan_cancelled',
    'workspace_report_published'
  ));
```

**2. Grant the first partner operators.** The Tier 2 views are gated on an active `venture-lab`
participation grant. Issue those from **Venture Lab → Participate → Steward**. Until a grant exists,
only admins see the Partner group — which is the correct fail-closed posture, not a bug.

**3. Wire the report schedule.** The composer and route are live; the cadence is a Routine calling
`POST /api/venture/workspace/horizen-pilot-series-001/report?period=daily` (and `weekly`).

## What Phase 3 deliberately did NOT build

- **Two-stage Communicate.** Named above; it needs an approval step, not a gate change.
- **Channel provisioning for working groups.** Still empty, still reported honestly as a gap.
- **Participant Lockers attached by commitment.** `lockers` remains empty on the spine.
- **Phases 4–5.** Research Workspace adoption and the metaProof Commons proof layer, in that order,
  neither gating Horizen.

---

# Amendment F — Tier→Surface mapping (operator ruling, 2026-07-27)

**Recorded verbatim, then audited against the code.** Amendment B defined the four tiers as
information boundaries. This ruling says WHERE each one lives:

> "The Internal workspace > venture labs cartridge (admin gated), the partner space > partner tab;
> the project space (all horizen project participants) participants tab for both mIRL/IRL OS and
> MVL and the commons > mIRL/IRL OS and MVL, AgentiQ and AgentiQ OS with AgentiQ being the home and
> the others mirrors"

## F.1 The mapping

| Space | Tier | Surface | Gate |
|---|---|---|---|
| **Internal workspace** | 0 | Venture Lab cartridge | admin-gated |
| **Partner space** | 0 + 2 | Venture Lab → Partner group | split (§B.3) |
| **Project space** — *all* Horizen project participants | 2 | Participate group, in **IRL · IRL OS · Venture Lab** | participation grant |
| **Commons** | 3 | **AgentiQ (home)**, mirrored in **AgentiQ OS · IRL · IRL OS · Venture Lab** | — |

Reading recorded for the avoidance of doubt: **MVL** is the Venture Lab cartridge
(`alpha-knyt-codex`, slug `venture-lab`); **mIRL** is the IRL cartridge (`irl-cartridge`). If that
reading is wrong the mapping is unchanged in shape — only the file targets move.

## F.2 AUDIT — three of the four already exist

| Space | Status | Evidence |
|---|---|---|
| Internal workspace | **Exists** | Venture Lab's `administer` group, plus the nine de-facto Tier 0 tabs catalogued in §B.2 |
| Partner space | **Exists, split as ratified** | Partner group: 4 Tier 2 views + Communicate + Administration (Phase 3a) |
| **Project space** | **Exists in all three** | `participate` group (Venture Lab, 6 tabs) · `participation` group (IRL, 7 tabs) · `participation` group (IRL OS, 7 tabs) |
| **Commons** | **Does not exist anywhere** | No commons tab in any cartridge. This is Phase 5 |

**The Project space needed no construction** — this is the third time in this workstream that the
audit-first discipline found the capability already present (§A.1, §B.2, now §F.2). What the
ruling adds is that the three surfaces are now *ratified as one space with three entrances*, so
removing one is a constitutional change rather than a config tidy-up. `tests/tier-surface-map.test.ts`
enforces it.

### The asymmetry between the three, recorded rather than "fixed"

They are not identical, and two differences are legitimate:

- **IRL and IRL OS carry a `Passport Registry` tab; Venture Lab does not.** The Research Lab issues
  passports; the Venture Lab consumes participation grants. Different institutional role.
- **Steward differs by design.** Venture Lab mounts `StewardParticipationTab` (the participation-
  domain steward — invitations and grants); IRL/IRL OS mount `PassportBureauStewardTab` (the
  passport bureau). Two stewards of two different things, not drift.

Everything else — Overview, Apply, Delegation, Locker, Standing — is the SAME component in all
three, configured per domain. That is the substrate the cross-Lab ruling said was already
extracted (§A.1), visible as data.

## F.3 The Commons is the one real gap, and its shape is now specified

The ruling settles what Phase 5 was going to have to decide anyway: the Commons is **one surface
with five entrances**, AgentiQ being the home. That is the same home-and-mirror discipline the
capability-artefact home shipped under today — *a mirror is a second ENTRANCE, never a second copy*:
same source, same component, distinct slug. A mirror that forked its own data would make the
Commons a second source of proof, which is precisely what Principle P5 (*only governed proof enters
the metaProof Commons*) exists to prevent.

Recorded to the tracker as the Phase 5 surface specification. **Not built here** — Phase 5 is the
proof layer, and per Amendment D §D.8 it implements constitutional proof first. Building the tabs
before the proof model would produce five entrances to nothing.

## F.4 What this changes in the plan

Nothing is re-sequenced. Phase 5 gains a specified surface shape instead of an open question, and
the Project space's three entrances become ratified structure rather than incidental configuration.

---

# Amendment G — Domain / Scope / Workspace ontology, and the Public↔Registry↔Commons lineage
correction (operator ruling, 2026-07-28)

**This amendment is a NEW canonical clarification, anchored to Amendment F as its antecedent — it
is not a restatement of text that was already present.** A conformance audit run against Amendment F
(`codexes/packs/agentiq/updates/2026-07-28_venture-lab-four-domain-conformance-audit.md`) found that
F never states a four-domain participation model verbatim: it names four *spaces* — Internal
workspace, Partner space, Project space, Commons — and its own F.1 table is internally inconsistent
about which word to use for the umbrella concept (**"workspace"** once, for Internal; **"space"**
three times, for Partner/Project/Commons). F also frames the Project space as **"all Horizen project
participants"** — a single-project scope, not a general cohort-isolation model — and names no Public
/ Community space at all; its fourth space (Commons) is a governed proof substrate (Amendment D/E),
not a public engagement surface. The operator has ratified the audit's finding and issued the
clarification below to close exactly those three gaps. Recorded as ruling, not retrofit.

## G.1 The ontology (ruling 4)

Three words, three distinct jobs, deliberately not synonyms:

| Term | Definition |
|---|---|
| **Domain** | The constitutional engagement/access class. There are four: **Internal, Partner, Participant, Public/Community.** |
| **Scope** | The partner, pilot, programme or cohort boundary **within** a domain. A domain answers "what kind of relationship is this?"; a scope answers "which specific instance of it?" |
| **Workspace** | An **optional** collaborative surface instantiated within a domain and scope. Not every domain requires one — Internal administration may be an admin surface rather than a collaboration workspace. |

`AccessDomain` (`services/passport/participationAccess.ts:61-68`) already exists as code vocabulary
for the first concept, at the access-control layer, under the name `venture-lab` — one value across
what this amendment now names as (at minimum) the Partner and Participant domains. That flattening is
the structural gap Step 3 of the build (2026-07-28) corrects; it is recorded here as the ontology
gap, not the code gap, which lives in its own build record.

## G.2 The four domains (ruling 3)

- **Internal** — MetaProof/platform-side administration and Venture Lab operations. Amendment F's
  "Internal workspace," renamed to Internal *domain* under G.1 — its concrete surface (the
  `administer` tab group, `data/codex-configs.ts`) remains a workspace-shaped implementation of it.
- **Partner** — the shared operational relationship between the MetaProof team and a named partner
  organisation (e.g. Horizen). Amendment F's "Partner space." Scoped to the specific partner/pilot.
- **Participant** — members of a specific pilot **cohort**. Cohort-scoped, not partner-scoped:
  participants may come from inside or outside the partner organisation, and a partner's own pilot is
  one cohort among potentially several. Amendment F's "Project space" was this domain's first
  instance, described in single-project terms because only one pilot (Horizen) existed at ratification
  time; this amendment generalises it to the cohort model the domain actually needs.
- **Public/Community** — general participants and members of the public engaging with the Venture Lab
  outside any specific pilot cohort. **Named here for the first time** — Amendment F specified no
  fourth domain of this kind.

**Public/Community is explicitly distinct from the Commons, and the distinction is stated here rather
than left as a side note.** The Commons (Amendment D/E) is governed proof infrastructure — *"not a
document repository, not a social feed, not a wiki, not simply a knowledge base"* (Amendment E §E.1)
— gated by Principle P5, *only governed proof enters the metaProof Commons* (§E.3). The Public/
Community domain is an engagement surface with no such gate. **The Commons must never be treated as
the Venture Lab's public workspace, social surface, or document repository** — that would be exactly
the misreading Amendment E's exclusions were written to foreclose, now arriving from the opposite
direction (mistaking a new domain for an old one, rather than mistaking the old one for something
softer).

## G.3 The Public → Registry → Commons lineage correction

**Search performed before writing this section**, per the instruction to find and correct every place
the superseded framing appears: `codexes/packs/agentiq/updates/` (all files), this audit document in
full (Amendments A–F), and the `metaCommons` entries in `canonical-invariants.seed.json`. **No file in
this repository states, verbatim or in close paraphrase, "public participation seeds the Commons"
directly.** The nearest adjacent doctrine is `inv.polity.165` (`canonical-invariants.seed.json:2651`,
Polity canon, unrelated to the Horizen/Venture Lab workstream specifically): *"The metaCommons is a
field... it aggregates Proof of Work Potential across the Polity."* That statement does not itself
collapse Public participation into Commons contribution, but it is broad enough that an
under-specified reading of it could be mistaken for exactly that collapse — which is consistent with
the operator's own characterisation of the earlier framing as something said in this programme rather
than something written into canon. Since no specific prior text was found to strike, this section
records the corrected lineage as the operative ground truth going forward; if the operator can locate
the specific earlier statement, it should be corrected in place at that citation in a follow-up note.

**The corrected lineage, recorded exactly as ruled:**

```
Public / Community participation
  → may generate actions, artefacts and receipts
  → some of those may mature into governed proofs
  → governed proofs may be admitted to the Registry
  → the Commons is the shared proof layer constituted through those admitted proofs
```

**Operative sentence, verbatim:**

> **"Public participation may seed proof formation, but it does not directly seed the Commons."**

**The four-layer separation, verbatim:**

- **Public/Community** — engagement and contribution.
- **Venture Lab** — experimentation, participation and value creation.
- **Registry** — admission, indexing, lineage and discoverability of constitutional artefacts and
  proofs.
- **Commons** — the collectively available body of governed proof represented through the Registry.

**A contribution can travel across those layers, but the layers must never be collapsed into one
another.** Public engagement is not itself Venture Lab participation; Venture Lab participation is not
itself Registry admission; Registry admission is not itself the Commons. Each transition is a
deliberate, governed act (Amendment D §D.1's promotion discipline — *Submit Proof*, never *Publish to
Commons* — applies at the Registry→Commons transition specifically; the Public→Venture Lab and Venture
Lab→Registry transitions are governed by the domain/scope access model this amendment names and the
evidence-posture gates Amendments B/D already specify).

## G.4 Consequences for the implementation

- The `AccessDomain` flattening under `'venture-lab'` (G.1) is the code-level expression of
  Partner/Participant domain conflation and is corrected by the same-day build (cohort isolation +
  Partner role restriction), recorded in its own commit history rather than duplicated here.
- The six currently-open Venture Lab tabs (Founder Office, Founders Club, Financial Services,
  Commercial Funnel, Growth Matrix, Portfolio) are **not** assumed to constitute the Public/Community
  domain merely because they are ungated today — each requires individual classification, recorded in
  the same-day build's tab audit rather than asserted here.
- Commons implementation (Phase 5, Amendment D §D.8) is unaffected in sequencing by this amendment;
  G.3 clarifies its *relationship* to Public/Community, it does not move its build order.
