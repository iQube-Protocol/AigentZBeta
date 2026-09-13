# Person–Persona–iQube Constitutional Interaction Protocol v0.1

Status: **draft, DOCUMENT-ONLY (v0.1)** — 2026-09-11, IRL OS Human/Machine Experiment Dossier +
Person/Persona/iQube Protocol pass, Priority 2.

**This is a mapping and naming pass, not a refactor.** Nothing in this document changes, removes,
or bypasses `services/passport/participationAccess.ts`, `services/research/selectedWorkspaceState.ts`,
Supabase RLS policies, `services/identity/getActivePersona.ts`, `services/access/evaluateAccess.ts`,
or any other currently load-bearing authorization code. Its job is to (1) state the target
conceptual chain explicitly, (2) show what already implements each link — with file:line citations,
never guessed — and (3) classify every named component as `canonical / adapter / transitional /
duplicate / missing` so future work knows where to extend rather than where to fork. Two invariants
are proposed at the end as **candidates**, per the Resolution → Invariant Loop — neither is
ratified by this document; ratification requires a named operator act.

---

## 1. The canonical chain

```
KybeDID → RootDID → Persona → Authority/Delegation → iQube → Constitutional Action → DVN Receipt → Standing
```

- **KybeDID** — the durable personhood-continuity root. Rights, Standing, and sponsorship anchor
  here, not to a session or a device.
- **RootDID** — durable identity continuity. Distinct from personhood: reputation *may* be
  identity-bound in places, but Standing resolves to personhood, not merely to a RootDID.
- **Persona** — the contextual activation and interaction boundary. This is the thing that actually
  enters a cartridge, holds session state, accesses iQubes, exercises capabilities, signs/attests,
  delegates, and invokes agents. Application code acts through the active Persona, not by spraying
  KybeDID/RootDID through cartridge logic.
- **Authority/Delegation** — determines under whose mandate a Persona acts (itself, or as a
  delegate/bound agent of another principal).
- **iQube** — owns or resolves resource-specific access and constitutional policy: identity, type,
  ownership, visibility, capability requirements, delegability, and expiry of *this specific
  object*.
- **Constitutional Action** — the thing a Persona actually does (a transition, a freeze, a
  signature, an artifact deposit).
- **DVN Receipt** — attributable evidence of that action, hashed/anchored, never carrying a raw T0
  identifier.
- **Standing** — derived from evidenced action; accrues principally to personhood while retaining
  Persona/context provenance (it must never collapse to "just a RootDID number" or lose which
  Persona/delegation chain produced the evidence).

**The governing split, stated once:** *DiDQube resolves who is acting and under whose authority.
The iQube resolves what that actor may do with this constitutional object.* Identity resolution and
resource authorization are two different questions, answered by two different layers, on purpose.

---

## 2. What already implements each link (current-state audit, with citations)

This audit was produced by direct code inspection (grep + read of the actual files below), not
inferred from naming. Every citation is a real file:line range as of this session.

| # | Component | Classification | What it actually does | Citation |
|---|---|---|---|---|
| 1 | **DiDQube Resolver** | canonical (identity-only) | `resolveDiDQube()` walks `kybe_identity`/`agent_root_identity` anchors to the `didqubes`/`human_didqubes`/`agent_didqubes` supertype tables, returning constitutional anchor + identity primitive + passport-credential existence. Its own header states it is "pure, read-only, non-authoritative" and explicitly that Aegis, CTP, DCIR, Standing, Registry/Horizen and DVN are "not yet integrated" as consumers of it — it is **not** a resource-authorization mechanism. `services/ctp/subjectIdentityResolution.ts`'s own header states the same boundary from the consumer side: DiDQube resolution is "additive and never a gate on authority or authorization (each primitive's own concern, untouched by this module)." | `services/identity/didQubeResolver.ts:1–698`; `services/ctp/subjectIdentityResolution.ts:1–19`; `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-07-DIDQUBE-CONSUMER-RESOLVER-NOT-RAW-ANCHOR-001.json` |
| 2 | **Persona Spine** | canonical | `getActivePersona()` is "the SINGLE function that produces an ActivePersonaContext" (session-token → header → URL → default resolution priority, ownership check, admin/cartridge flags). `utils/personaSpine.tsx` (`personaFetch`, `usePersonaSpine`) is the client-side T1-only counterpart every spine-consuming fetch must use. | `services/identity/getActivePersona.ts:383–468`, `109–177`; `utils/personaSpine.tsx:1–718` |
| 3 | **Passport** | canonical (identity/credential); adapter (resource) | `services/identity/passportPrincipal.ts` resolves wallet→root/kybe principal and passport usability; reused by the DiDQube resolver. `services/passport/lockerItems.ts` owns encrypted, holder-scoped storage — a resource, but owner-gated only, not a general policy engine. Passport does **not** own generic resource/action authorization. | `services/identity/passportPrincipal.ts:1–732`; `services/passport/lockerItems.ts:1–123` |
| 4 | **Delegation grants** | canonical | Real durable persistence: `persistDelegationGrant`, `readActiveGrants`, `readActiveGrantForAgent`, `revokeGrantForAgent`. One active grant per (persona, agent) pair. This is where "under whose mandate a Persona acts" is actually decided when an agent is involved. | `services/delegation/delegationGrantStore.ts:1–601`, `90–144`; migration `20260622500000_delegation_grants.sql` |
| 5 | **CTP** (Constitutional Transition Primitive) | canonical | A real registry/execution model for constitutional actions (`services/ctp/registry.ts`, `constitutionalRuntime.ts`, `evidence.ts`), consumed by wallet-convert and exchange-artifact primitives. Spec: `CTP-001_constitutional-transition-primitive-registry-and-execution-model.md`. | `services/ctp/registry.ts`; `services/ctp/constitutionalRuntime.ts`; `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md` |
| 6 | **RAX** (Reciprocal Artifact Exchange) | canonical | Comment-shorthand, never an exported symbol — used consistently across `boundaryResearchExchangeAdmission.ts`, `ianBoundaryResearchJourney.ts`, `constitutionalNavigator.ts`, `app/api/journey/ian/state/route.ts` to name the `reciprocal_exchanges` table and its resolver, `services/research/reciprocalExchange.ts` (`getExchangeView`, `listMyExchanges`) — the SAME system this session's `resolveExperimentDossier`'s Exchange section composes for OCSGA. `boundaryResearchExchangeAdmission.ts`'s header also names a real, previously-missing seam: a CAS (`access_grants`) grant does not automatically become RAX membership — one explicit admission-boundary module performs that translation, once, at the edge. | `services/journey/boundaryResearchExchangeAdmission.ts:1–30`; `services/research/reciprocalExchange.ts:1516–1622` |
| 7 | **iQube Registry** | canonical | `services/registry/resolver.ts`'s own doc states it "MUST NOT decide access... decide ownership... write receipts" — those are delegated to `evaluateAccess`/`userOwnsAsset`/orchestration events respectively. Registry (what an iQube *is*) and access (what a Persona may *do* with it) are enforced as structurally separate modules, with `tests/registry-authority.test.ts` as the boundary canary. | `services/registry/resolver.ts:1–80` |
| 8 | **`participationAccess.ts`** | canonical | The actual resource/participation-authorization engine for `passport`, `research-lab`, `venture-lab`, `metame-studio`, `developer-studio` domains: invitation issuance/claim, role catalogues, delegated invitation authority, experiment/workspace access resolution. Backed by `access_grants`/`access_invitations`. | `services/passport/participationAccess.ts:1–1226` |
| 9 | **`selectedWorkspaceState.ts`** | canonical | "THE canonical (principal + selectedWorkspaceId) resolver" — composes membership/role/access from `participationAccess.ts`, phase/stage/protocol from `experimentLifecycleState.ts`, reviewer state from `reviewerAgreement.ts`, exchange from `reciprocalExchange.ts`, receipts from `activityReceiptService.ts`. This session's `resolveExperimentDossier` (services/research/experimentDossier.ts) composes THIS resolver rather than re-deriving any of it. | `services/research/selectedWorkspaceState.ts:1–394` |
| 10 | **`evaluateAccess.ts`** | canonical | "The single gate every consumer calls" for content/asset delivery decisions (free/credential/ownership/payment gating), deriving a `DeliveryMode` and a privacy-preserving receipt handle (aliasCommitment/cohortId only, never personaId). A narrower, content-asset-specific sibling of `participationAccess.ts`'s domain/role gate — both legitimately coexist. | `services/access/evaluateAccess.ts:1–276` |
| 11 | **Supabase RLS** | adapter (defense-in-depth, not primary enforcement) | RLS is enabled on the identity/resource tables sampled, but the actual `CREATE POLICY` statements are overwhelmingly `service_role`-gated or absent entirely (default-deny for any non-service-role caller). The application's server routes use the service-role key and enforce per-user authorization in TypeScript (`evaluateAccess`, `participationAccess`), not in Postgres policy. RLS is a real backstop, not where the authorization decision actually lives. | migration `20260514000000` (activity_receipts, `service_role`-only policy); migration `20260725000000_participation_access.sql:63–64` (RLS enabled, no policy) |
| 12 | **DVN / activity receipts** | canonical | `activityReceiptService.ts` is "the canonical writer + reader" for `ActivityReceipt`; personaId is T0 and never serialized. `activityReceiptDvnPipeline.ts` is marked CRITICAL INFRASTRUCTURE and implements `local → dvn_pending → dvn_recorded/dvn_failed`, carrying only a hashed persona reference on-chain. | `services/receipts/activityReceiptService.ts:1–100`; `services/dvn/activityReceiptDvnPipeline.ts:1–90` |
| 13 | **Standing** | canonical (computation); transitional (DiDQube anchoring) | Real implementation exists: `standingCore.ts`, `standingScore.ts`, `buildStandingGraph.ts`, `standingSignalService.ts`, `services/crm/standingAccrualService.ts`, migration `20260618000000_vsp_standing_cartridge.sql`. Its full migration onto DiDQube-anchored personhood is Phase-4/in-progress per its own resolution record — the computation is real today, the personhood-anchoring is not yet fully wired. | `services/standing/standingCore.ts`; `codexes/packs/agentiq/resolution-records/records/RES-2026-09-07-DIDQUBE-PHASE-4-STANDING-CONSUMER-MIGRATION-001.json` |
| 14 | **MCP / Threshold** | canonical, deliberately segregated bearer-auth adapter | `requireThresholdSession.ts` carries an explicit invariant: "A route using this adapter must not reconstruct authority through `getActivePersona()` or another browser/Supabase auth mechanism" — Threshold's bearer-session model (`ths_…` tokens) is a distinct, documented identity channel, bridged back into the same T0 context-builders via `getActivePersonaByPublicRef` rather than duplicated. | `services/threshold/requireThresholdSession.ts:8–10`; `services/identity/getActivePersona.ts:479–519` |
| 15 | **IRL OS / Workspace surfaces** | canonical consumer | `PartnerProgrammesTab.tsx` imports `personaFetch` from the spine directly, and `useParticipationAccess`/`useResearchWorkspaceAccess` for authorization — it consumes the canonical spine and participation-access resolvers; it defines no competing identity or resource-authority semantics of its own. | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx:42–99` |
| 16 | **Venture Lab (alpha-knyt)** | missing (as an app-layer identity component) | `codexes/packs/alpha-knyt/` and `docs/alpha/agentiq-knyt/` are documentation/spec content only — no TypeScript services, no persona/identity logic to classify. Venture-lab *application* logic (the `'venture-lab'` domain in `participationAccess.ts`) already reuses the shared spine correctly; there is simply no separate Venture-Lab identity layer to name. | grep of `codexes/packs/alpha-knyt/**` for `getActivePersona`/`personaFetch`: zero hits |
| 17 | **MoneyPenny / Horizen** | adapter | `services/horizen/identity.ts` normalizes Horizen's own external agent-identity string formats (hex/decimal/UUID) — a necessary external-system adapter, not a competing internal identity model. `services/horizen/evidenceChain.ts` composes Horizen identity + DVN ingestion + passport-backed delegation into attributable evidence, rather than redefining any of them. `services/moneypenny/*` treats `personaId` as an opaque already-resolved identity, doing no persona resolution of its own. | `services/horizen/identity.ts:1–40`; `services/horizen/evidenceChain.ts` (header) |

**Note on RLS vs. the audit agent's independent pass:** an earlier, narrower grep pass in this same
investigation flagged RAX as "missing." Direct file inspection (item 6 above) shows this was a
false negative — RAX is real, working code, referred to only in code comments rather than as an
exported symbol, which a symbol-oriented search can miss. This document uses the citation-verified
result.

---

## 3. Candidate invariants (PROPOSED — not ratified by this document)

Per the Resolution → Invariant Loop (`RESOLUTION_RECORDS.md`), a lesson does not become doctrine
because it worked once, and this document does not itself ratify anything. These two are recorded
here as candidates for the operator to promote (or not) through the existing ceremony:

**Candidate 1.** *Identity logic belongs to the DiDQube; resource-authority logic belongs to the
iQube. No cartridge should independently redefine Person, Identity, Persona or resource-access
semantics.*
— Supported by items 1, 7, 9, 10 above: every canonical resolver this session found already draws
this line on purpose (DiDQube's own header disclaiming authorization; the Registry's own header
disclaiming access decisions).

**Candidate 2.** *Constitutional action is Persona-attributed, personhood-anchored, resource-governed
and receipt-evidenced.*
— Supported by items 4, 5, 6, 12: delegation grants bind a Persona's mandate, CTP/RAX bind the
action to a specific resource-typed exchange, and DVN receipts evidence the result without ever
carrying a raw T0 identifier.

Neither candidate authorizes any code change on its own. Promotion requires the two-or-more-
occurrence bar (or demonstrated regression prevention) and a named `ratifiedSource`, per the
existing ladder (`observed → candidate → validated → ratified → canonical`).

---

## 4. What this document explicitly does NOT do

- It does not replace, deprecate, or weaken `participationAccess.ts`, `selectedWorkspaceState.ts`,
  `evaluateAccess.ts`, Supabase RLS, or any existing delegation/access resolver.
- It does not ratify Candidate 1 or Candidate 2 as canon.
- It does not mandate an estate-wide migration. Section 2's classifications are a map, not a punch
  list — a `transitional` or `adapter` entry is not itself a defect requiring action.
- It does not introduce a second identity or resource-authority vocabulary. Every term used above
  (KybeDID, RootDID, Persona, iQube, DVN, Standing) is already in use elsewhere in this codebase and
  this document's ontology section; this is a consolidation of naming, not an invention of new
  concepts.

## 5. Follow-on (recorded, not started in this pass)

Per the operator's explicit architectural-backlog note from the preceding dossier pass: *"DiDQube
should remain the identity-continuity root, while authorization/reach converges behind a canonical
constitutional reach interface. Existing research access resolvers should become providers/adapters
to that interface rather than being prematurely replaced."* This is consistent with, and not
contradicted by, the current-state audit above (every resource-authorization resolver found is
already structurally separate from DiDQube) — the convergence-behind-one-interface step is future
work, not something this document's audit found missing today.
