# PRD-MPY-001 — Agent MoneyPenny: the Constitutional Financial Services Agent

**Specialize the agent, not the engine — MoneyPenny is the FS lens on rails that already exist.**

> **MoneyPenny advises, architects, and (within bounded, receipted, delegated authority) acts on money — as a specialization of the constitutional reasoning pipeline, never a parallel one.**

- **Status:** **RATIFIED 2026-07-21** (operator) — docs-first gate cleared; all seven open decisions resolved (§9). Build may proceed per the phase sequence (§6), gated only on operator-provided corpus sources (D2).
- **Class:** Agent specialization + a registerable source corpus. NOT a new engine, NOT a new FS capability domain (CRP-003 already chartered that), NOT a new settlement rail. A **thin specialization** over the built Constitutional Financial Services Programme (CRP-003a) and the invariant reasoning pipeline (CFS-035/037/040/048).
- **Constitutional parents:** **CRP-003** (Financial Services — the First Constitutional Capability Domain, CHARTERED 2026-07-15) · **CRP-003a** (Constitutional Financial Services Programme — Increments 1–3 BUILT 2026-07-17) · **CFS-048** (Invariant Discovery Engine) · **CFS-037/PRD-IRE-001** (Invariant Resolution Engine) · **CFS-035/PRD-IPE-001** (Invariant Projection Engine) · **CFS-040/PRD-KRE-001** (Knowledge Resolution Engine) · **CFS-018** ("primitives are invariant; providers are replaceable") · the Identity & Access Spine.
- **Sibling PRD (format precedent):** PRD-THR-001 (metaMe Threshold) — this PRD mirrors its structure, reuse-map, phases, guardrails, and honest-limits discipline. It does not extend, gate, or modify Threshold scope.
- **Authors:** operator (intent) + Claude Code (codebase reconciliation).

---

## 0. The framing (why this is a specialization, not a build)

The platform already has a **Financial Services constitutional capability domain** (CRP-003) and a **built constitutional service pipeline** (CRP-003a). It already has an **Invariant Discovery Engine** that turns a source corpus into a candidate invariant library (`services/invariants/discoveryEngine.ts`), and a **grounding/resolution/projection** stack that lets any surface reason from resolved invariants (`services/invariants/grounding.ts`, `engine.ts`, `resolution.ts`).

What it does **not** yet have is a **named financial-services primary agent** that (a) is grounded in a canonical financial-services corpus, (b) consumes the FS invariant library at reasoning time, and (c) drives the built FS pipeline in three coherent modes. MoneyPenny becomes that agent by **composition**:

```
QriptoCENT Constitutional Corpus  ──(Invariant Discovery Engine, CFS-048)──▶  FS Invariant Library (inv.finance.*, proposed)
        (source material)                                                              │
                                                                                       ▼
                          MoneyPenny  ──(grounding.ts / IRE→IPE)──▶  Advisor · Architect · Runtime
                                                                     over the BUILT FS pipeline (CRP-003a)
```

No new engine. No forked resolver. No parallel settlement path. **MoneyPenny is the FS lens; the rails are the platform's.**

---

## 1. The problem — MoneyPenny today is a pricing specialist, not a constitutional FS agent

MoneyPenny already exists in code, but narrowly:

- She is one specialist among several in `services/agents/specialistRouter.ts` (id `moneypenny` → agent `aigent-moneypenny`, action type `micro_economics_brief`). Her framing is *"Q¢ pricing, micro-transaction flows, and payment-ops integrity"* (`specialistRouter.ts:554–572`).
- She has an agent voice — *"Money guide, DeFi strategist, practical"* (`services/orchestration/agentVoices.ts:78`) — and a shell surface (`app/(shell)/moneypenny/`, `app/triad/components/codex/tabs/MoneyPennyTab.tsx`).
- She is **not grounded** in any financial-services invariant library, does **not** consume resolved FS invariants at reasoning time, and does **not** drive the built constitutional service pipeline (`services/constitutional/constitutionalServicePipeline.ts`). Her recommendations are hand-authored strings, not constitutional projections.

The gap is not "build MoneyPenny" — she exists. The gap is **specialize MoneyPenny into the canonical Constitutional Financial Services Agent** by giving her a corpus, a derived invariant library, and a wire into the reasoning pipeline and the FS executors.

---

## 2. What MoneyPenny is — the Constitutional Financial Services Agent (three modes)

MoneyPenny is the platform's **primary financial-services agent**: the named lead for the Financial Services Constitutional Capability Domain (CRP-003 §1). She operates in three modes, each mapped to capability that already exists so the specialization adds a lens, not a mechanism.

| Mode | What she does | Consumes / drives (existing seam) | Consequence class |
|---|---|---|---|
| **Advisor** | Constitutional financial guidance — grounded, cited, standing-ranked answers about payments, settlement, treasury, compliance posture, protocol economics. Read-only. | FS invariant slice via `buildInvariantSlice` + `citeInvariants` (`services/invariants/grounding.ts`); Financial Intelligence executor read path (`financialIntelligenceExecutor.ts`, Domain 3) | No fund movement — safe-first (CRP-003a §5 consequence ordering) |
| **Architect** | Designs constitutional financial **structures/products** — pricing models, fee-split ("constitutional service fee"), settlement-terms design, delegation envelopes, agreement templates. Produces artifacts, not transactions. | Constitutional Agreement Object as a design target (`constitutionalAgreement.ts`); artifact runtime (`saveArtifactRecord`); Advisor grounding | No fund movement — produces proposals a human ratifies |
| **Runtime** | Executes financial actions **within bounded, receipted, delegated authority** — money-moving via the built executors, gated by the agreement + P3 spend cap + the 409 authorization gate. Never autonomous. | `constitutionalServicePipeline.ts` (12-step, `authoritative` mode) → `settlementExecutor.ts`; `requireAuthorizedAgreement` + `spendWithinCap` (`constitutionalAgreement.ts`) | Money-moving — highest consequence; World-ID-graded, human-authorized, DVN-receipted |

**Core law (inherited from CRP-003 §5 / Threshold §5.1):** MoneyPenny is a **delegate**, never a principal. She may advise, architect, `form`, and `accept` her own side of an agreement; only the **human** authorizes delegation and money movement. She may accrue standing for her acts but can never become an independent delegating principal.

---

## 3. The QriptoCENT Constitutional Corpus (the source material)

### 3.1 What it is

The **QriptoCENT Constitutional Corpus** is a canonical, registerable **pack corpus** — the source material from which MoneyPenny's financial-services invariant library is *derived* (not hand-authored). It is the FS analogue of the Polity Papers corpus that already produced the `inv.polity.*` library via ingest (`scripts/ingest-polity-papers.mjs` → seeded `inv.polity.160/161/162…`, 2026-07-17 canonization pass).

**Critical discipline:** the corpus is the **SOURCE**. The FS invariants are **DERIVED FROM it by the Invariant Discovery Engine** (CFS-048, `services/invariants/discoveryEngine.ts`) and enter at status `proposed`. **No invariant is hand-authored into this PRD as canonical.** Per CLAUDE.md's Hypothesis-vs-Canon discipline: definitions/methods/governance may be `canonical`; world-claims about how constitutional finance behaves enter and remain `proposed` until their experiments produce supporting evidence.

### 3.2 QriptoCENT vs Q¢ — the distinction this corpus must keep straight

These are related but must not be conflated:

- **QriptoCENT (the protocol)** — the ecosystem's Bitcoin/COYN-anchored **micro-stablecoin** and its economic grammar: deterministic pricing and settlement of sub-cent units of value, machine-to-machine and human-to-machine (canonical source: `codexes/packs/aigency/items/knowledge/protocol-economics.md`; COYN thesis: `codexes/packs/polity-core/items/commentary/coyn-thesis/`). **This protocol is the subject of the corpus.**
- **Q¢ (Q-cent) — the pricing/display unit** — the accounting convention where **$1 = 100 Q¢** (CLAUDE.md "Q¢ (Q-cent) Pricing"), used across store/cart/wallet surfaces. It is the cent denomination of QriptoCENT as surfaced in pricing math (e.g. `app/api/wallet/base-qc/credit-from-usdc/route.ts`, `1 USDC = 100 Q¢`).

> The corpus governs **the protocol and its constitutional economics** — not the Q¢ pricing-helper arithmetic. Where both appear, MoneyPenny (and this corpus) treat QriptoCENT as the protocol/currency and Q¢ as its cent-unit pricing surface. **Operator to confirm** whether `protocol-economics.md` remains the single canonical source binding the two (it currently states Qc/Q¢ *is* QriptoCENT's cent unit), so the corpus does not mint a competing definition.

### 3.3 Coverage (the source areas — operator-supplied, mapped to the CFS-048 scope ladder)

The Invariant Discovery Engine's scope ladder is **domain → sub-domain → capability** (`discoveryEngine.ts`, `DiscoveryScopeLevel`). The corpus is organized to feed it:

| Corpus area | Scope level | Source status |
|---|---|---|
| **QriptoCENT Protocol** (micro-stablecoin, anchoring, pricing/settlement grammar) | domain | Partial — `protocol-economics.md` is ground truth; deeper protocol spec **operator to provide** |
| **Constitutional Commerce** (standing-mediated exchange, vendor-neutral settlement adapters) | sub-domain | Charter-level in CRP-003 §6; deeper source **operator to provide** |
| **Constitutional Payments** (payment intent, x402/x409, receipts, custody) | sub-domain | Partial — x402/x409 seams exist; payments doctrine source **operator to provide** |
| **Constitutional Financial Services** (advisory, treasury, intelligence, integrity) | sub-domain | CRP-003 §2–5 + CRP-003a (built pipeline) |
| **Economic Governance — PoTS / PoWP** | sub-domain | **Found in-repo, see §3.4** |
| **Runtime Specs** (Smart Wallet / Menu / Content) | capability | Partial — Smart Wallet surfaces exist (`SmartWalletDrawer`, `app/(shell)/moneypenny/`); Menu/Content runtime specs **operator to provide** |

### 3.4 PoTS / PoWP — found, not invented (naming to confirm)

The operator flagged PoTS/PoWP as possibly needing definition. They are **already canonical in-repo** (polity namespace, seeded 2026-07-17 — `codexes/packs/agentiq/updates/2026-07-17_polity-papers-canonization-pass1.md`):

- **PoWP = Proof of Work Potential** — "capability latent in truthful information before it is applied" — `inv.polity.160`.
- **PoTS = Proof of Time Saved / Net Value Acceleration** = Time-to-Value − Risk Repair Burden — `inv.polity.161`.
- Companion: **Verification-accrual gate** — "verified over claimed" — `inv.polity.162`.

**These are NOT invented here.** The corpus references the seeded polity definitions rather than re-defining them. **Operator to confirm** that the brief's "PoTS/PoWP proof-of-… mechanisms" mean exactly these seeded meanings (the brief's shorthand could be read as "proof-of-transfer / proof-of-work-process"; the repo says Work **Potential** / Time **Saved**). Do not create a second definition — reconcile to `inv.polity.160/161` or have the operator ratify a distinct FS-scoped meaning.

### 3.5 On-disk location + registration (RATIFIED — sub-corpus, D6)

**Decision (D6, ratified 2026-07-21):** the QriptoCENT Constitutional Corpus is a **sub-corpus under the existing FS foundation, NOT a standalone `codexes/packs/qriptocent/` pack**, and in the **Invariant Discovery Engine's scope ladder it is its own SUB-DOMAIN under the `finance` domain**. This keeps the FS constitutional canon in one place while giving QriptoCENT a clean ingestion boundary.

Ratified layout — a new collection alongside the FS foundation docs (final parent pack a Phase-1 build detail; `codexes/packs/irl/foundation/qriptocent/` is the default):

```
codexes/packs/irl/foundation/qriptocent/     # a SUB-CORPUS collection (not a new pack)
  protocol/                      # QriptoCENT protocol source        → sub-domain: finance/qriptocent/protocol
  commerce/                      # Constitutional Commerce            → finance/qriptocent/commerce
  payments/                      # Constitutional Payments            → finance/qriptocent/payments
  financial-services/            # Constitutional Financial Services  → finance/qriptocent/financial-services
  economic-governance/           # PoTS / PoWP (refs inv.polity.160/161)
  runtime/                       # Smart Wallet / Menu / Content runtime specs
# registered as a col_qriptocent_corpus collection in the parent pack's collections.json
```

The sub-corpus feeds the Invariant Discovery Engine exactly as the Polity Papers did — scoped to the `finance` domain / `qriptocent` sub-domain: ingest pass (`scripts/ingest-*`) → `discovery_evidence` (Stage 1) → `callSovereign` candidate extraction (Stage 2) → synthesis (Stage 3) → validation harness (Stage 4) → publication at `proposed` (Stage 5). **This PRD ratifies the sub-corpus + its scope; the corpus CONTENT is authored/ingested by the operator via the Discovery Engine (D2)** — no source is invented in its absence.

---

## 4. The four knowledge layers (MoneyPenny's grounding stack)

MoneyPenny reasons over four distinct knowledge layers, kept epistemically separate:

| # | Layer | What it is | Source / seam | Epistemic status |
|---|---|---|---|---|
| **1** | **Native Constitutional Knowledge** | The platform's own FS constitutional canon — the built pipeline's doctrine, the FS capability domain, spine/access rules | CRP-003 / CRP-003a; the Invariant Registry (`services/invariants/store.ts`) `canonical`+`validated` slice | Canonical/validated — grounding authority |
| **2** | **FS Invariant Library** | Candidate financial-services invariants **derived** from the QriptoCENT Corpus by the Invariant Discovery Engine | `services/invariants/discoveryEngine.ts` → `inv.finance.*` (namespace to be widened, §9) | **`proposed`** until validated (never auto-canonical — `inv.reasoning.337`) |
| **3** | **Source Corpus — external FS references** | Basel III/IV, FATF, AML/KYC, MiCA, PSD2, ISO 20022, SEC, FCA, FinCEN | Cited as **evidence/authority** (Stage-1 `discovery_evidence`, `EvidenceKind: 'regulation'|'compliance'|'standard'`), **NOT ingested as constitutional canon** | External cited authority — informs, never becomes platform invariant by import |
| **4** | **Runtime Experience** | Receipts + memory from actual FS runtime executions, fed back to refine the library | `services/receipts/activityReceiptService.ts` + DVN anchor; the "Cultivate" loop (CFS-037 §7) | Evidence for future validation (the Evolution face, CFS-035 §5) |

**The epistemic boundary (paramount):** external regulation (layer 3) is **cited authority**, not a source of platform invariants. Platform FS invariants (layer 2) are **derived from the QriptoCENT Corpus** and validated through the IRL harness. A Basel/MiCA rule can be *cited* in a MoneyPenny answer and can serve as Stage-1 evidence; it never silently becomes an `inv.finance.*` canonical invariant. This mirrors CRP-003 §9 ("no invariant is seeded by import") and CFS-048's discovery-not-generation discipline (`inv.reasoning.334`).

---

## 5. Integration with the constitutional reasoning pipeline

MoneyPenny plugs into the **existing** seam. Named files, verified present:

**Resolution → grounding → projection (reasoning-time):**
1. An FS intent resolves through the **Invariant Resolution Engine** path (CFS-037): `services/invariants/resolution.ts` + `perception.ts` (qualification v0) produce the region of the field the intent needs.
2. MoneyPenny consumes the resolved FS slice via **`buildInvariantSlice`** with an FS-scoped `GroundingContext` (`namespaces: ['finance', …]`, plus domain signals) — `services/invariants/grounding.ts`. She cites what she used via **`citeInvariants`** (Reach accrual), exactly as other grounded surfaces do (NBE rerank, `runArtifact`, the specialist router when a slice is threaded — CFS-035 §5/§6).
3. Where a decision is a ranking/threshold/branch (e.g. "which settlement rail," "is this within cap"), it becomes an **Invariant Decision Node** projected by the **Invariant Projection Engine** (`services/invariants/engine.ts` + `nodes/`) — shadow-first (CFS-017), never a hand-tuned constant.
4. Knowledge reuse (does an FS iQube already answer this?) runs through the **Knowledge Resolution Engine** seam (`services/invariants/knowledgeResolution.ts`, CFS-040) before any generation.

**Execution (Runtime mode):**
5. Money-moving flows through the built **`constitutionalServicePipeline.ts`** (12 steps: Intent → Discovery → **Constitutional Agreement** → Standing → Policy → Bounded Delegation → Execution → Verification → **Settlement** → Evidence → Standing Accrual → **Invariant Learning**). Step 3 is the N1 gate (`requireAuthorizedAgreement`); step 9 enforces the P3 spend cap (`spendWithinCap`) and binds a settlement **intent**, never an autonomous transfer; steps 11/12 accrue standing + cite for real Reach.

**MoneyPenny adds no new resolver, no new grounding module, no new executor.** She supplies the FS `GroundingContext`, the FS specialist framing (extending `specialistRouter.ts`), and the FS `standingType`/action-type call site (CRP-003a P4) — all composition.

---

## 6. Phases (docs-first; each increment ratify-before-build; mapped to what's already built)

| Phase | Deliverable | Maps to existing (do not rebuild) | New work |
|---|---|---|---|
| **Phase 1 — Corpus authoring + registration** | The QriptoCENT Constitutional Corpus on disk (§3.5) + `collections.json` registration + ingest plan | Pack/collections pattern; `scripts/ingest-polity-papers.mjs` precedent | Author/collect corpus content (much **operator-to-provide**, §3.3); a `qriptocent` pack |
| **Phase 2 — Invariant derivation run** | Run the Invariant Discovery Engine over the corpus → **proposed** FS invariant library | `services/invariants/discoveryEngine.ts` (CFS-048) — 5-stage pipeline, lands `proposed` | Widen namespace to `finance` (§9); a derivation run + candidate review; **no auto-canonization** |
| **Phase 3 — MoneyPenny Advisor + Architect** | MoneyPenny grounded + citing over the FS library; produces guidance + structure designs | `buildInvariantSlice`/`citeInvariants`; `specialistRouter.ts`; `agentVoices.ts`; artifact runtime; Financial Intelligence executor read path (Domain 3) | FS `GroundingContext`; extend MoneyPenny's specialist framing from "Q¢ pricing" to constitutional FS; Architect artifact templates |
| **Phase 4 — MoneyPenny Runtime** | Money-moving within bounded, receipted, delegated authority | **Built:** `constitutionalServicePipeline.ts` (authoritative mode), `constitutionalAgreement.ts` (409 gate + spend cap), `settlementExecutor.ts`, DVN receipts | Wire MoneyPenny as the driving agent; FS `standingType` accrual call site (P4); consequence-ordered rollout (Domain 3 → 1/2, CRP-003a §5) |

**Consequence ordering (safety, inherited from CRP-003a §5):** Advisor/Intelligence (read-only, Domain 3) first; Architect (proposals) next; Runtime money-moving (Domains 1/2) last — gated on the enforced spend cap (P3) and settlement binding already landed in CRP-003a.

---

## 7. Constitutional guardrails (reuse the mechanisms by name)

Every guardrail below already exists; MoneyPenny inherits, never re-implements them.

- **Principal–Delegate Separation** — only the human authorizes money movement. Enforced at `requireAuthorizedAgreement` (`constitutionalAgreement.ts`) and the guided-onboarding never emitting an agent-authorize step (`services/constitutional/guidedOnboarding.ts`). MoneyPenny may `form`/`accept`; she may not `authorize`.
- **Graded proof-of-humanity for money-moving** — captcha-grade for read/write, **World ID** for money-moving (`services/passport/personhoodProof.ts`; the `WORLD_ID_*` provisioning in CLAUDE.md). Runtime mode requires the money-moving grade.
- **Identifier tiers — no T0 in receipts** — MoneyPenny's receipts/agreements carry **T2** commitments only (`hashPersonaRef` / `personaPublicRef`), never `personaId`/`authProfileId`/`rootDid` (Identity & Access Spine; CLAUDE.md T0/T1/T2). No raw case/persona IDs in DVN/chain/locker.
- **Spend cap (P3)** — `spendWithinCap` enforces a per-agreement monetary ceiling before any fund movement (`constitutionalServicePipeline.ts` step 9). MoneyPenny cannot exceed the delegated `constraints` value ceiling.
- **x409 authorization gate** — HTTP 409 unless an accepted, authorized Constitutional Agreement binds {requesting operator · capability · selected agent · authority · constraints · verification · settlement}. Providers are swappable (`agreementProviders.ts`; CFS-018) — x409/Consenti is the acceptance-proof provider, **DVN is the anchor of record** (CRP-003a §8 decision 3).
- **DVN receipting** — agreement formation, execution, and settlement emit receipts anchored via the DVN pipeline (`services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts`). DVN failures escalate; they are never silent (CLAUDE.md DVN Pipeline Protection). Adding an FS action type to `ANCHORABLE_ACTION_TYPES` is the only permitted unilateral DVN change.

---

## 8. Reuse map (do NOT rebuild)

| Capability | Anchor (verified present) |
|---|---|
| FS constitutional service pipeline (12-step) | `services/constitutional/constitutionalServicePipeline.ts` |
| Constitutional Agreement + 409 gate + spend cap | `services/constitutional/constitutionalAgreement.ts` (`requireAuthorizedAgreement`, `spendWithinCap`) |
| Agreement acceptance/anchor providers (swappable) | `services/constitutional/agreementProviders.ts` |
| Financial Intelligence executor (Domain 3, read) | `services/constitutional/financialIntelligenceExecutor.ts` |
| Settlement executor (Domains 1/2, money-moving) | `services/constitutional/settlementExecutor.ts` |
| Invariant Discovery Engine (corpus → proposed library) | `services/invariants/discoveryEngine.ts` (CFS-048) |
| Grounding / cite (reasoning-time) | `services/invariants/grounding.ts` (`buildInvariantSlice`, `citeInvariants`) |
| Resolution / projection / knowledge-resolution | `services/invariants/{resolution,engine,knowledgeResolution,perception}.ts` (CFS-037/035/040) |
| Model router (invariant-aware inference) | `services/constitutional/modelRouter.ts` (`callSovereign`) |
| MoneyPenny specialist framing + voice + surfaces | `services/agents/specialistRouter.ts`, `services/orchestration/agentVoices.ts`, `app/(shell)/moneypenny/`, `app/triad/components/codex/tabs/MoneyPennyTab.tsx` |
| Receipts + DVN anchor | `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts` |
| Standing accrual (add FS source, P4) | `services/crm/standingAccrualService.ts`, `services/standing/standingScore.ts` |
| World-ID money-moving proof | `services/passport/personhoodProof.ts` |
| Corpus registration pattern | `codexes/packs/*/collections.json`; ingest precedent `scripts/ingest-polity-papers.mjs` |

**Net-new:** (1) the `qriptocent` pack corpus + its `collections.json`; (2) an FS derivation run producing the `proposed` `inv.finance.*` library; (3) the `finance` namespace widening; (4) MoneyPenny's FS `GroundingContext` + extended specialist framing + FS standing call site. Everything else composes existing rails.

---

## 9. Verification & open operator decisions

**Verification (each phase, before the next):**
1. Corpus registers cleanly — `collections.json` valid; items resolve; the `qriptocent` pack appears in the registry.
2. Derivation run lands candidates at status **`proposed` only** — none auto-canonical (`inv.reasoning.337`); external-regulation evidence recorded as `discovery_evidence` (kind `regulation`/`compliance`/`standard`), never as a canonical invariant.
3. MoneyPenny Advisor answers cite real `inv.finance.*` ids via `citeInvariants`; the cited slice is standing-ranked; no hand-tuned FS constants reintroduced (mirror the zero-literal canary pattern, `tests/irl-dashboard-adoption.test.ts`).
4. Runtime mode re-passes the 409 gate + spend cap on every money-moving act; out-of-scope/over-cap calls fail closed; receipts carry T2 refs only (no T0); DVN anchor written.
5. Spine canaries stay green (`tests/access-spine.test.ts`, `tests/persona-spine-fetch.test.ts`); `node scripts/verify-spine.mjs` passes for any spine-touching wiring.

**Resolved operator decisions (RATIFIED 2026-07-21):**
- **D1 — PoTS/PoWP naming → RESOLVED.** The seeded polity definitions stand: `inv.polity.160` = Proof of Work **Potential**, `inv.polity.161` = Proof of Time **Saved**. The corpus references these; it does NOT mint a distinct FS-scoped definition. (§3.4)
- **D2 — QriptoCENT source material → RESOLVED (operator-inbound).** The operator will provide/ingest the Protocol, Commerce/Payments, and Runtime (Menu/Content) sources **via the Invariant Discovery Engine**, adding **QriptoCENT as its own ingestion sub-domain** (under `finance`, §3.5). No source is invented in the interim; Phases 1–2 consume real sources only once ingested. (§3.3)
- **D3 — QriptoCENT vs Q¢ SoT → RESOLVED.** `protocol-economics.md` remains the single binding definition (Q¢ = QriptoCENT's cent unit). The corpus does not mint a competing one. (§3.2)
- **D4 — External-regulation policy → RESOLVED.** Basel/FATF/MiCA/PSD2/ISO 20022/SEC/FCA/FinCEN are **cited authority only** — never ingested as constitutional canon. (§4)
- **D5 — `finance` namespace → RATIFIED.** Widen `InvariantNamespace` (`types/invariants.ts`) with `finance` + a declared composition law (CFS-013 §3), following the `polity` precedent. This is Phase-2 foundational work (the algebra must be authored before the derivation run lands candidates).
- **D6 — Corpus location → RESOLVED (sub-corpus).** A **sub-corpus** under the existing FS foundation + a **`finance/qriptocent` sub-domain** in the Discovery Engine — NOT a standalone `codexes/packs/qriptocent/` pack. (§3.5)
- **D7 — PRD id → CONFIRMED.** `PRD-MPY-001` (directly-filed product PRD, PRD-THR-001 precedent).

---

## 10. Honest limits

- **Nothing in this PRD is built.** It is the ratification gate. The reuse map (§8) is code-witnessed; the corpus, the derivation run, and MoneyPenny's specialization are proposed, not shipped.
- **The corpus content is largely operator-to-provide.** `protocol-economics.md` is the one verified canonical source; the Protocol spec, Constitutional Commerce/Payments doctrine, and Menu/Content runtime specs are named-not-provided (§3.3, D2). No source is invented to fill the gap.
- **No FS invariant is seeded or canonical here.** The derived `inv.finance.*` library will enter at `proposed` and stay there until the IRL validation harness produces evidence (CLAUDE.md Hypothesis-vs-Canon; `inv.reasoning.337`).
- **`finance` is not yet a namespace.** `types/invariants.ts` does not include it; derivation is blocked on D5.
- **MoneyPenny Runtime rides money-moving rails that exist but were built for the generic FS pipeline**, not MoneyPenny specifically — wiring her as the driving agent + the FS standing call site (P4) is new integration, not a new mechanism.
- **This PRD does not touch metaMe Threshold** (`services/threshold/*`, `app/api/threshold/*`, `tests/threshold*`, `app/threshold/*`) and does not extend/gate/modify Threshold scope.
- **This PRD seeds no invariant and gates no Chrysalis deliverable** (CRP-001 interface rule, inherited).

---

## 11. Naming

Agent: **MoneyPenny** — the **Constitutional Financial Services Agent** (the platform's primary FS agent). Modes: **Advisor · Architect · Runtime.** Source corpus: the **QriptoCENT Constitutional Corpus.** Derived library: the **FS Invariant Library** (`inv.finance.*`, proposed). QriptoCENT = the protocol/micro-stablecoin; **Q¢** = its cent-unit pricing surface ($1 = 100 Q¢). Governing law: **specialize the agent, not the engine.**

---

## Ratification record

- [x] **PROPOSED 2026-07-21** — authored as the specialization spec for Agent MoneyPenny, reconciled against a code-truth read of the built Constitutional Financial Services Programme (CRP-003a Increments 1–3), the Invariant Discovery Engine (CFS-048), and the grounding/resolution/projection stack (CFS-035/037/040).
- [x] **RATIFIED 2026-07-21** (operator) — all seven open decisions resolved (§9): D1 polity PoTS/PoWP definitions stand; D2 sources operator-inbound via the Discovery Engine (QriptoCENT as its own sub-domain); D3 `protocol-economics.md` binding; D4 external regs cited-authority-only; D5 `finance` namespace widening ratified; D6 sub-corpus + `finance/qriptocent` sub-domain (not a standalone pack); D7 id `PRD-MPY-001`. **Build may proceed per §6**, gated only on operator-provided corpus sources (D2). This PRD is ready to hand to a parallel build session.
