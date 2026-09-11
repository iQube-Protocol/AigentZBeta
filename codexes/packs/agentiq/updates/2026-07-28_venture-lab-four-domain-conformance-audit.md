# Venture Lab Four-Domain Participation Model — Conformance Audit

**Status: AUDIT — no code written at time of filing. Ratified by the operator 2026-07-28; the
five build rulings and the Commons/Registry/Public correction issued in response are implemented
under the same-day build record and `2026-07-27_horizen-workspace-phase0-audit.md` Amendment G.**

**Spec under audit:** the operator's live restatement of a four-part Venture Lab participation
model (Internal / Partner / Participant / Public-Community), including a terminology correction
("workspace" → "domain" for the constitutional concept) issued in the same message.

**Method:** read the ratified text first, code second — the same discipline as the PAG-001 audit
this session. Read-only; no files edited during this pass.

---

## Finding on the source text

No document in this repository states the operator's four-domain model verbatim. The closest
ratified antecedent is **Amendment F** ("Tier→Surface mapping," operator ruling 2026-07-27,
`2026-07-27_horizen-workspace-phase0-audit.md:1221-1289`), which names four *spaces* — Internal
workspace, Partner space, Project space, Commons — canary-enforced by
`tests/tier-surface-map.test.ts`. Amendment F's own table is internally inconsistent about the
umbrella term ("workspace" once, "space" three times), frames the Project space as **"all Horizen
project participants"** (single-project, not general-cohort), and names no Public/Community space
at all. The operator's restatement is therefore audited as a refinement of Amendment F, not a
restatement of it — and is recorded as such in Amendment G rather than presented as text that was
already present.

## Clause-by-clause table

| # | Ratified requirement (source) | Current implementation (file:line) | Status |
|---|---|---|---|
| 1 | **Internal domain** — "Internal workspace → Venture Lab cartridge (admin-gated)" (Amendment F.1) | `administer` tabGroup, `adminOnly: true` (`data/codex-configs.ts:2594`); nine de-facto Tier-0 tabs catalogued in Amendment B §B.2 | Conforms |
| 2 | **Partner domain**, split Tier 0+2 — "Partner space → Venture Lab → Partner group (Tier 0+2)" (Amendment F.1; Amendment B §B.3) | `partner` group: Overview/Collaborate/Operate/Evidence carry `participationDomain: 'venture-lab'` (Tier 2, `data/codex-configs.ts:2834-2912`); Communicate + Administration carry `adminOnly: true` (Tier 0, `:2913-2959`) | Conforms |
| 3 | **Participant/Project domain** — "Project space (all Horizen project participants) → Participate group … Tier 2" (Amendment F.1/F.2, literal text) | `participate` group in `VENTURE_LAB_CODEX` (`data/codex-configs.ts:2589, 2724-2813`); mirrors IRL/IRL OS `participation` groups per `tests/tier-surface-map.test.ts:30-34` | Conforms to the literal ratified text — see row 4 |
| 4 | **Operator's refinement**: participants are organised by cohorts, not by partner organisation; isolated cohorts, not one flat network | `ACCESS_DOMAINS` has one flat `'venture-lab'` domain (`services/passport/participationAccess.ts:61-67`); `satisfiesParticipationGate` checks only `accessDomain` + `role`, no scope field exists on `ParticipationGrantSignal` (`services/passport/participationTabGate.ts:33-36, 67-82`); `experimentWorkspaceFromPartner()` hardcodes `participation.domain: 'venture-lab'` for every partner workspace (`services/experiments/experimentWorkspace.ts:181-185`); `GET /api/venture/workspace/[workspaceId]` checks domain membership only, not workspace/pilot scope (`app/api/venture/workspace/[workspaceId]/route.ts:74`); `PartnerProgrammesTab` renders `listPartnerWorkspaces()` unfiltered (`app/triad/components/codex/tabs/PartnerProgrammesTab.tsx:366`) | Diverges — the single biggest structural gap; addressed under build ruling 1 |
| 5 | `access_grants.allowed_experiments` as a possible existing solution | Column exists (`supabase/migrations/20260727000000_access_allowed_experiments.sql:22-23`); reused for venture-lab pilots via `ASSIGNABLE_PILOTS` (`services/venture/partnerWorkspace.ts:224-238`, 2026-07-28); issuance-time scope containment enforced (`tests/delegated-invitation-authority.test.ts:112-150`); resolved and returned by `resolveParticipationSelfView` (`services/passport/participationSelfView.ts:42-57, 85-97`) | Partially solves it — scoped at issuance, never read at access-check time (row 4) |
| 6 | Contrast case — Research Lab equivalent | `getGrantedExperiments()` (`services/passport/participationAccess.ts:260-279`) + `GET /api/experiments/access` (`app/api/experiments/access/route.ts:36-64`) — real per-experiment scoping, already shipped | Working precedent for the venture-lab fix |
| 7 | Implicit: Partner-tier content should require Partner roles specifically | None of the four Tier-2 Partner tabs set `participationRoles` (`data/codex-configs.ts:2834-2912`); any of the eleven `venture-lab` roles, including `observer`, satisfies the gate | Diverges — addressed under build ruling 2 |
| 8 | **Public / Community domain** | Not named in Amendment F. Amendment F's fourth space (Commons) is a governed Proof Commons (Amendment D §D.1, E §E.1/E.3) — explicitly not a document repository, social feed, wiki, or knowledge base. Six Venture Lab tabs carry neither `adminOnly` nor `participationDomain` (Founder Office, Founders Club, Financial Services, Commercial Funnel, Growth Matrix, Portfolio) and are reachable by any authenticated persona, but this was never named or ratified as a Public/Community domain | Not-yet-specified prior to Amendment G; named in Amendment G §G.2; the six tabs individually classified in the same-day build record rather than batch-assumed |
| 9 | Terminology: "domain" vs "workspace" | Amendment F itself is inconsistent (see Finding above); `docs/platform-ontology.md` has no entry for either term; `AccessDomain` already exists as code vocabulary at the access-control layer | New ruling, not a divergence to fix — recorded in Amendment G §G.1 |

## Disposition

Operator ratified this audit 2026-07-28 and issued five build rulings plus the Commons/Registry/
Public lineage correction. Recorded as Amendment G to `2026-07-27_horizen-workspace-phase0-audit.md`.
Implementation (cohort isolation, Partner role restriction, six-tab classification) is recorded in
that same day's build history, not duplicated in this document.
