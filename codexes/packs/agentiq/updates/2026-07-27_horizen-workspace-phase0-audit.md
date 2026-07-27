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
