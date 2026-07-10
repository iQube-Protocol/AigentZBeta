# CFS-025 — The Constitutional Production Runtime (CPR)

**Chrysalis Foundation Specification · v0.1 · Status: PROPOSED (2026-07-10; discovery by Aletheon, operator-sponsored) — pending seam audit + ratification**
Substrate (planned): `types/constitutionalProduction.ts` · runtime `services/production/*` · canary `tests/constitutional-production.test.ts`
Companion to: `CFS-022` (Constitutional Operating Environment) · `CFS-006a` (Consequence Operating Model) · `CFS-016` (Constitutional Deployment) · `CFS-024` (Constitutional Identity Hierarchy)

> The breakthrough is a separation, not a merger: **composition** (where ideas are explored, edited, refined) versus **production** (where an idea becomes a reviewed, verified, versioned, signed, published, recorded constitutional artifact). CPR owns production. Nothing else has to.

---

## The discovery

Production logic is duplicated across the ecosystem. AgentMe produces proposals/PDFs; AigentZ produces software; Studio produces specifications; Cryptopia produces publications; CCRL produces papers. Each carries its own review pipeline, its own approval model, its own versioning, its own publication + receipt path. The consequences: divergent approval models, inconsistent publication quality, fragmented versioning, inconsistent consequence tracking.

The correction mirrors what we did with **Standing** and with **Identity** (CFS-024): extract the shared concern into a constitutional primitive that everyone *invokes* and nobody *owns*.

**The crucial constraint on what CPR subsumes:** CPR must NOT subsume AgentMe, AigentZ, or Studio. It subsumes their **production phases**. Each runtime keeps its identity and its distinctive value; it simply stops owning production.

```
Before                          After
──────                          ─────
AgentMe:  Intent→Planning→      AgentMe:  Intent→Planning→ CPR →Proposal
          Proposal→Review→PDF
AigentZ:  Reqs→Architecture→    AigentZ:  Reqs→Architecture→ CPR →Code
          CodeGen→Review→Deploy
Studio:   Design→Compose→       Studio:   Design→ CPR →Publication
          Preview→Publish
Cryptopia: Research→…→Magazine   Cryptopia: Research→ CPR →Magazine
CCRL:     Experiment→…→Paper     CCRL:     Experiment→ CPR →Paper
```

Nothing loses its identity. They simply stop owning production.

## Constitutional position

CPR is **not a cartridge, not an application — a constitutional primitive.** It sits alongside:

| Primitive | Answers |
|---|---|
| Identity (CFS-024) | Who is acting, in what capacity, through which agent? |
| Standing | What authority have they earned? |
| Registry | What canonical objects exist? |
| Wallet | What do they hold? |
| Delegation | What bounded authority is granted? |
| Agreements | What is committed between parties? |
| **Production (CPR)** | **How does a consequential artifact become constitutional?** |

Every runtime may invoke CPR. No runtime owns CPR.

## Relationship to Consequence Engineering

CPR operates **downstream of the Consequence Engineering Runtime** — production is a constitutionally authorised consequence, never an unmediated act:

```
Intent → IntentQube → Context → Identity → Standing → Delegation
      → Invariant Evaluation → Consequence Engineering → CPR
      → Verification → Publication → Receipts → Standing → Registry
```

## The single production lifecycle

Every artifact — whatever its profile — follows ONE lifecycle:

```
Intent → Planning → Composition → Review → Verification
      → Publication → Distribution → Receipts → Standing → Registry
```

(To be pinned as `PRODUCTION_LIFECYCLE` in the contract; order is meaning.)

## Composition vs production — the boundary (the key breakthrough)

CPR is **not a replacement for Studio; it is the execution engine Studio invokes.** Studio stays the creative workspace where ideas are explored, composed, edited, refined. CPR is where those ideas *become constitutional artifacts*. The same split applies to every runtime:

| Runtime | RETAINS (its identity) | TRANSFERS to CPR (production) |
|---|---|---|
| **AgentMe** | Customer intelligence · planning · relationship mgmt · delegation · decision-making | Proposal generation · document production · publication |
| **AigentZ** | Planning · architecture · reasoning · orchestration | Code production · artifact generation · documentation · release packaging |
| **Studio** | Composition environment · design · workspace · editing | Publishing · document generation · export · review · versioning |
| **CCRL** | Experiment design · evaluation | Paper production · publication |
| **Cryptopia** | Research · editorial | Magazine production · publication |

*Composition versus production* is the architectural insight. It prevents cartridge proliferation AND gives one place to evolve artifact production over time — better code generation, richer layouts, stronger review, multimodal outputs — with every runtime benefiting immediately. That is the Chrysalis leverage pattern.

## Production profiles (configure, don't replace)

CPR supports configurable profiles: **Standards · White Papers · Research · Software · Agreements · Presentations · Books · Investor Decks · APIs · Documentation · Policy · Multimedia.** A profile configures the runtime (templates, review rules, verification, output format); **adding a profile must not change CPR.** (To be pinned as `PRODUCTION_PROFILES`.)

## Constitutional publication contract

Every publication produces: an **immutable identifier**, a **version**, **evidence**, a **registry entry**, a **standing event**, and a **publication receipt**. These are non-negotiable outputs of any profile.

## Constitutional services CPR provides

Document composition · template management · citation management · diagram generation · code packaging · versioning · publication · distribution · review workflow · approval workflow · artifact signing · evidence packaging · receipt generation · registry integration · standing integration.

## Reuse guardrails — CPR COMPOSES, never forks

CPR sits ON TOP of already-shipped primitives. It must compose them, not duplicate them. The seam symbols below were verified against the tree during the production-surface audit (2026-07-10):

| Primitive | Real symbol / seam | CPR's relationship |
|---|---|---|
| **Constitutional Object Model** | `types/constitutionalObject.ts` — `ConstitutionalObject`, `ObjectVersion`, `ObjectRef`, `ConstitutionalObjectKind` | Every production output IS a `ConstitutionalObject`. `ProductionResult.object/version/registryEntry` are these types. CPR never emits an artifact outside the model. |
| **Composition engine** | `services/composition/composeArtifact.ts:composeArtifact()` → `CompositionResult` (`types/composition.ts`) | CPR's `composition` stage CONSUMES a `CompositionResult`; it does not re-implement composition. **The PUBLISH SEAM is `composeArtifact.ts` ~lines 449–456**, where `provenance.receiptId` stays `null` in propose-mode — that is the exact insertion point where a gated publish would mint the receipt at the route layer. |
| **Receipts + DVN** | `services/receipts/activityReceiptService.ts:createActivityReceipt` (unified, DVN-anchored) + the protected DVN pipeline (`services/dvn/activityReceiptDvnPipeline.ts`) | CPR EMITS through it, never modifies it. **The only permitted unilateral edit is adding a `production_*` action type to `ANCHORABLE_ACTION_TYPES`** (CLAUDE.md — the one permitted DVN change). |
| **Registry** | the Canonical Asset Registry (Chrysalis P1) + the iQube Registry | CPR's `registry` stage writes an `ObjectRef` entry; it consumes the registry, does not fork it. |
| **Standing** | the standing accrual service | CPR's `standing` stage emits a standing event. |
| **Consequence Engineering** | the Consequence Engineering runtime | CPR is invoked BY it, downstream — production is a constitutionally authorised consequence. |
| **Identity spine + CFS-024** | `getActivePersona` (read-only; a protected spine file — CPR must NOT modify it) | Production runs in a resolved `ConstitutionalContext`; the invoking persona/agent/standing gate what may be produced. CPR reads the spine, never forks a resolver. **CPR expresses only T2 commitments (`ownerCommitment`, `actorCommitment`) — no T0 personaId ever crosses the seam.** |

### Duplication is concentrated (not diffuse)

The audit found that the duplicated production concern reduces to two hot spots, not a sprawl:

1. **publication / version / content-commitment is implemented ~5×** — the experiment publish path, the invariant publish path, the composition provenance seam, the registry emitter, and per-cartridge PDF/document paths each re-derive "serialize-once → hash → version → publish". CPR's single lifecycle is exactly the unification of these.
2. **There are TWO receipt systems** — `services/receipts/activityReceiptService.ts:createActivityReceipt` (the **unified, DVN-anchored** path; e.g. the CCRL lifecycle already routes through `services/research/lifecycle.ts:writeLifecycleReceipt` → `createActivityReceipt`) versus `services/registry/receiptEmitter.ts:emitReceipt` (a **separate ReceiptQube**, with **no DVN anchoring**). **Reconciling these two is an operator-facing DESIGN CALL, not a quiet refactor** — CPR Phase 0/1 must NOT silently pick one; it standardises new production receipts on the unified `createActivityReceipt` path and flags the ReceiptQube reconciliation for explicit operator direction.

## Build plan (phased; contract-first)

> Finalised from the parallel production-seam audit + contract draft (agents in flight 2026-07-10). Placeholder shape below; firmed on their return.

- **Phase 0 — the contract + canary.** `types/constitutionalProduction.ts`: `PRODUCTION_LIFECYCLE`, `PRODUCTION_PROFILES`, `ProductionProfile`, `ProductionJob`, `ProductionResult`, `ProduceFn` seam type, pure helpers + `emptyProductionJob()`. No runtime organs. (Mirrors the CFS-024 Phase 0 discipline.)
- **Phase 1 — the runtime skeleton.** `services/production/*` composing existing receipts/registry/standing/DVN — NOT forking them. One lifecycle executor; profiles as configuration.
- **Phase 2 — ONE pilot invocation end-to-end. PILOT CHOSEN: CCRL experiment→paper (`research` profile).** The audit selected it as the lowest-risk highest-signal seam because: (a) it is **already on the unified `writeLifecycleReceipt` → `createActivityReceipt` path** (`services/research/lifecycle.ts`), so CPR reuses the receipt seam with zero new plumbing; (b) it is **T2-safe by construction** — the research lifecycle already carries commitments + receipt ids, never a T0 subject id; (c) it touches **no protected surface** — no identity-spine resolver, no DVN pipeline internals (only, if needed, a `production_*` addition to `ANCHORABLE_ACTION_TYPES`), no `getActivePersona` edit. Proves the seam + the publication contract (immutable id, version, evidence, registry, standing, receipt). The AgentMe proposal→PDF and AigentZ architecture→code-pack candidates were deferred — both cross more protected/product surface than the pilot needs.
- **Phase 3+ — additional profiles + runtimes** by configuration, no CPR change.

## Honest limits

- **This spec is PROPOSED, not ratified.** It captures Aletheon's PRD + the composition/production separation. The seam surfaces and the pilot are pending the production-surface audit; the invariants + primitive status require operator ratification.
- **CPR is large.** The multimodal future (audio/video/data/3D/skills/twins/manufacturing) is a long-horizon direction, not a near-term deliverable. Near-term = the contract + one pilot profile through one runtime.
- **Nothing is extracted until the audit confirms genuine duplication vs already-unified infrastructure.** Where a concern is already shared (receipts, DVN, registry), CPR consumes it rather than absorbing it.

## Ratification record

- [ ] Ratified (operator) — PROPOSED 2026-07-10
- [x] Production-surface audit complete (agent) → duplication map + extraction seam (2026-07-10; see Reuse guardrails — duplication concentrated in publication/version/content-commitment ~5× + two receipt systems)
- [x] CPR contract draft reviewed (agent) → `types/constitutionalProduction.ts` shape (2026-07-10; `PRODUCTION_LIFECYCLE`, `PRODUCTION_PROFILES`, `ProductionProfile`, `ProductionJob`, `ProductionResult`, `ProduceFn`, pure helpers + `emptyProductionJob()`; canary `tests/constitutional-production.test.ts`)
- [x] Phase 0 — contract + canary (`types/constitutionalProduction.ts` + `tests/constitutional-production.test.ts`; 2026-07-10). Additive, organ-free.
- [ ] Phase 1 — runtime skeleton (composing existing primitives) — **GATED on operator ratification of this spec**
- [ ] Phase 2 — one pilot runtime invocation end-to-end (CCRL `research`) — **GATED on operator ratification of this spec**
