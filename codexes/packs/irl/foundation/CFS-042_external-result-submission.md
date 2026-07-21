# CFS-042 — External Result Submission (Passport-Delegated, x409-Signed)

**Chrysalis Foundation · Constitutional Charter · Status: PROPOSED (docs-only, ratify-before-build)**
**Date:** 2026-07-18
**Depends on / composes:** CFS-033 (Constitutional Evaluation — distributed replication §5), the Constitutional Agreement primitive (`services/constitutional/constitutionalAgreement.ts`), the x409/Consenti acceptance provider (`services/constitutional/agreementProviders.ts`), the experiment-result publication path (`services/experiments/publishResult.ts`, `/api/experiments/results`), and the public IRL OS read routes (`/api/public/irl/*`).
**Anchors:** `IRL_VALIDATION_ROADMAP.md` (independent-execution / replication contract), EXP-P1 §11/§13, EXP-P2, EXP-P3.

---

## 1. Why this charter exists

The Validation Programme's replication contract (EXP-P1 §11, §13; `IRL_VALIDATION_ROADMAP.md`) already gives an external party — Austin Ambrozi / Autonomi Solutions, and any future reviewer — everything needed to **re-run** an arm and the judge from frozen, hash-committed inputs. What it does **not** yet give them is a way to **submit results back** into the Institute's constitutional memory as a first-class, receipted publication — under a bound, revocable authority, without an operator manually copy-pasting their dataset into an admin-gated endpoint.

Today `POST /api/experiments/results` is gated by `persona.cartridgeFlags?.isAdmin` (`app/api/experiments/results/route.ts:44`). That is correct for **Phase 1** (internally executed, admin published), and it must stay exactly as it is. This charter defines **Phase 2**: a distinct, additive path by which an external party's *agent* can publish a result under a **Polity Passport + bounded delegation**, with the submission authorized by an **x409 Constitutional Agreement** the operator countersigns once.

This is not a convenience feature. It is the programme **dogfooding its own constitutional primitives**: the same agreement/acceptance/bounded-authority machinery the platform sells is what admits an outside scientist's result. CFS-033 §5 asks for replication "by distinct parties"; this charter is the mechanism that makes "distinct party" a cryptographic fact (a countersigned agreement + a passport-scoped commitment) rather than a claim in prose.

---

## 2. The two-phase model (the governing frame)

> **Phase 1 is internally executed and admin-published. Phase 2 is passport-delegated external submission. Phase 1 ships first; Phase 2 is chartered here and built later.**

| | **Phase 1 — Internally executed** | **Phase 2 — Passport-delegated external submission** |
|---|---|---|
| Who publishes | The Institute (operator, `isAdmin`) | The external party's **agent**, under delegation |
| Endpoint | `POST /api/experiments/results` (unchanged) | `POST /api/experiments/results/external` (new, additive) |
| Auth | Spine `isAdmin` flag | Polity Passport + bounded `DelegatedAuthority` + authorized x409 agreement |
| Labelling | results carry the existing publication receipt | results carry `origin: 'external'` + the agreement id commitment; **honestly labelled** `internally executed` vs `independently submitted` |
| Gate | admin only | **cohort/payment tier** + `requireAuthorizedAgreement(...)` 409 gate |
| Ships | now (Phase 1 of the roadmap) | after Phase 1 results are read (roadmap "next phase") |

**Discipline:** Phase 2 does not weaken, replace, or route around Phase 1. It is a *second door* with its own lock. The admin door stays. This mirrors the platform's Extend-Don't-Duplicate law and the public-read pattern (`/api/public/irl/*` added a read-only route beside the gated one; this adds a delegated-write route beside the admin one).

### Adoption posture — Phase-2-first for the countersigned partner (operator direction, 2026-07-18)

The two-phase split above is the **rollout frame for the wider IRL OS user base**: most external users meet Phase 1 first (read + replicate) and graduate to Phase 2 (delegated submission) as they mature. But for the **countersigned EXP-P1 partner (Austin), adopt Phase 2 from the outset** — do not stage it behind a Phase-1 period.

The reason is that it collapses two acts into one. The **x409 Constitutional Agreement the partner signs to get started IS the same signature that freezes EXP-P1** (§15 sign-off) **and authorizes their agent's submission**. Rather than "sign the protocol now, get a submission capability later," the onboarding handshake and the delegation grant are a single constitutional act: signing the agreement is *how you begin*, and it simultaneously (a) freezes the pre-registration bundle, (b) issues the agent's bounded passport, and (c) opens the submission door. This brings the partner **into the constitutional operating model from day one** — they don't consume the platform, they enter an agreement with it — which is precisely the posture the whole programme is trying to demonstrate.

**The onboarding is itself agent-guided (CFS-043).** Austin's agent walks Austin through his Passport application and the bounded delegation — this experiment-submission agreement is the *first instance* of the reusable agent-guided onboarding pattern chartered in `CFS-043_agent-guided-passport-delegation.md` (which generalizes it for Horizen + Marketa distribution). The safeguard that makes agent-guided onboarding safe — **the agent guides but only the human principal, under their own authentication, may authorize (no self-sponsorship, no self-delegation)** — is structural in the agreement lifecycle (`authorizeAgreement` owner-commitment match; acceptance ≠ authorization). See CFS-043 §2.

This does **not** re-complicate the design: the same primitives, the same endpoint, the same gates. It is only a statement of *when* Austin crosses into Phase 2 (immediately, not after a Phase-1 interval). Phase 1's admin door still exists and the Institute still self-publishes internally-executed results through it; Austin is simply onboarded straight to the delegated door. For the general population, the staged two-phase rollout stands.

---

## 3. Composition — the primitives this stands on (all confirmed to exist)

Nothing in the trust core is invented here. Phase 2 is a *composition* of shipped primitives:

| Concern | Primitive (existing) | Location |
|---|---|---|
| Terms before transactions | `requireAuthorizedAgreement({ capabilityRef, selectedAgentRef, requestingPersonaId })` → 409 unless an authorized agreement binds the triple | `constitutionalAgreement.ts:529` |
| Form / accept / authorize lifecycle | `formAgreement` · `acceptAgreement` · `authorizeAgreement` | `constitutionalAgreement.ts` |
| x409 acceptance (Consenti) | x409 Consenti adapter; `AcceptorType = 'operator' \| 'agent'`; `localAcceptanceCommitment` | `agreementProviders.ts` |
| Bounded authority | `DelegatedAuthority { band, allowedActions, forbiddenActions, allowedSurfaces, ttlHours, maxActions, valueCeiling? }` | `constitutionalAgreement.ts:92` |
| Spend ceiling enforcement (if a submission fee moves funds) | `spendWithinCap(authority, amount)` — refuses null-ceiling money movement (P3) | `constitutionalAgreement.ts:119` |
| Owner / acceptor commitments (T2-safe, no raw ids) | `agreementOwnerCommitment(personaId)` · `acceptorCommitmentFor(acceptorType, acceptorId)` | `constitutionalAgreement.ts` |
| Receipted, hash-committed publication | `publishExperimentResult(...)` → `content_hash` + `experiment_result_published` receipt (DVN-anchorable) | `publishResult.ts` |
| Public verification surface | `/api/public/irl/experiments-results` reads the same rows the gated endpoint writes | `services/research/publicReads.ts` |

**The capability triple** the agreement binds:
- `capabilityRef` = `irl:experiment-result:submit` (a capability_registry id for the submission capability).
- `selectedAgentRef` = the external party's **agent** ref (the delegate that will call the endpoint).
- `requestingPersonaId` = the **operator** who countersigns (the Institute persona granting the authority) — its `agreementOwnerCommitment` is what the gate looks up.

---

## 4. The Polity Passport for Austin's agent

Austin's agent submits **as itself**, not as the operator. The passport is what makes that safe:

1. **Issue an agent Polity Passport** scoped to the submission capability only — `allowedSurfaces: ['irl:experiment-result:submit']`, `allowedActions: ['publish-result']`, `forbiddenActions: ['ratify','flip-authoritative','edit-crystal','read-persona']`.
2. **Bind it in a bounded `DelegatedAuthority`:**
   - `band`: a read/write band scoped to result publication (never a governance band).
   - `ttlHours`: the experiment window (e.g. the EXP-P1 §13 "main runs within 14 days of freeze" envelope + margin) — the authority **expires**, it is not standing.
   - `maxActions`: bounded to the number of results the experiment produces (one per experiment id the agreement lists) — a runaway agent cannot spam publications.
   - `valueCeiling`: **null if submission is free** (Domain-3 read/write, no fund movement); a declared ceiling **only** if a submission fee is charged (§6) — `spendWithinCap` then enforces it and refuses any unbounded spend.
3. **The operator authorizes once** via the x409 flow (Consenti `AcceptorType='agent'` acceptance + operator authorization). From then until TTL/maxActions/revocation, the agent may publish; every publication still passes the 409 gate and still writes a receipt.

**Revocation is first-class:** letting the agreement lapse (TTL), exhausting `maxActions`, or flipping its status non-authorized all cause `requireAuthorizedAgreement` to 409 the next call. No separate kill-switch is needed — the gate *is* the switch.

---

## 5. Cohort / payment gating (who may even hold the passport)

Two independent gates, both required, checked in order:

1. **Cohort/payment tier** — the requesting agent's cohort must carry the `experiment-submission` entitlement (a cohort/payment-tier flag resolved server-side, the same way other gated capabilities resolve). No entitlement → 403 before the agreement is even consulted. This is the "cohort/payment gated" requirement: only a party who has been admitted (paid/cohorted) can be issued the passport.
2. **Authorized agreement** — even with the entitlement, `requireAuthorizedAgreement(...)` must return `ok:true` for the exact `(capabilityRef, selectedAgentRef, operatorCommitment)` triple, or 409.

Order matters: **entitlement (403) before agreement (409)** so an un-entitled caller never learns whether an agreement exists. Both soft-fail closed (missing store → refuse), consistent with the gate's OPEN=false posture (`constitutionalAgreement.ts:518`).

---

## 6. If a submission fee is charged (optional, Domain-1/2)

The design supports a paid submission tier without changing the trust core:
- The agreement carries `settlementTerms { rail, amount, currency }` and a **declared `valueCeiling`**.
- `spendWithinCap(authority, amount)` enforces the ceiling; a null ceiling with settlement present is **refused** (P3 — no unbounded delegated spend).
- Q¢ amounts are integer cents per the canonical conversion ($1 = 100 Q¢); `amount` is the rail's smallest unit.
- If submission is **free** (the default for a scientific reviewer), there is no settlement, `valueCeiling` stays null, and the money path is never reached.

Default posture for Austin: **free submission** (a scientific reviewer is not charged to return a result). The fee tier exists for a future open, paid replication market, not for the countersigned EXP-P1 partner.

---

## 7. The new endpoint (additive — do not fold into the admin route)

`POST /api/experiments/results/external` — **built later**, sketched here so the charter is unambiguous:

```
POST /api/experiments/results/external
  headers: agent passport (bearer) — resolves the delegate agent ref + cohort
  body: { experiment, provider, model, aggregates, results, agreementId }

  1. Resolve the caller as an AGENT via its passport (not getActivePersona-as-operator).
  2. Cohort/payment gate → 403 if the agent's cohort lacks `experiment-submission`.
  3. requireAuthorizedAgreement({ capabilityRef:'irl:experiment-result:submit',
       selectedAgentRef: <agent ref>, requestingPersonaId: <operator who granted> })
       → 409 if no authorized agreement.
  4. (if paid tier) spendWithinCap(authority, fee) → 402/refuse if over ceiling.
  5. Decrement the agreement's maxActions budget (bounded delegation is spent, not standing).
  6. publishExperimentResult(client, <operator persona of record>, { ...body,
       origin:'external', agreementCommitment, submittedByAgentCommitment })
       → content_hash + experiment_result_published receipt (DVN-anchorable).
  7. Return { ok, id, contentHash, receiptId, receiptStatus, origin:'external' }.
```

**Trust invariants the endpoint must hold:**
- The result row records `origin:'external'` + the **agreement id commitment** + the **agent acceptor commitment** — never the raw agent id, never a personaId (T2-safe, same discipline as every DVN payload).
- The published result is **honestly labelled**: `independently submitted` (external agent, verifiable against the frozen bundle) vs the Phase-1 `internally executed` label. This directly satisfies EXP-P1 §13's honest-labelling clause: a component re-run/submitted by the external party is *not* dressed up as more than it is, and one that could not be is labelled `internally executed`.
- Verification stays trustless: the same public reader (`/api/public/irl/experiments-results`) serves the row; anyone recomputes sha256 over `resultsJson` verbatim and compares to the anchored hash. External origin changes *who wrote it*, not *how it is verified*.

---

## 8. EXPERIMENTS allow-list — widen before any new id can publish

`EXPERIMENTS = ['EXP-001','EXP-002','EXP-003','EXP-004']` (`app/api/experiments/results/route.ts:29`) and the `publishExperimentResult` type union both hard-cap the accepted experiment ids. **Before EXP-P1/P2/P3 (or IRV-001/IPV-001) results can publish through either door**, this allow-list and the `publishResult.ts` union must be widened to include the new ids, and the results table's experiment CHECK constraint (if present) migrated. This is a Phase-1 prerequisite (it blocks internal publication too), not Phase-2-specific — flagged here because it is the first blocker on the path and must not be discovered at runtime.

---

## 9. What ships when (build order — NOT this doc)

The sequencing is set by *when each piece is actually needed*, which — helpfully — does not gate the weekend start on the full Phase-2 build:

1. **At kickoff / freeze (the signature — primitive already built):** Austin signs the **x409 Constitutional Agreement** via the existing agreement flow (`formAgreement` → agent-accept via Consenti → operator-`authorizeAgreement`; the N1 primitive is already shipped — CRP-003a Increment 1). This one act *is* his Phase-2 onboarding: it freezes the EXP-P1 pre-registration bundle (§15), mints his agent's **bounded passport**, and pre-authorizes the submission triple. **Nothing new needs building for the signature** — it composes shipped primitives. This is what brings the partner into the constitutional operating model from day one.
2. **Phase-1 prerequisite (before any result publishes, internal or external):** widen the EXPERIMENTS allow-list + `publishResult` union + migration (§8). Blocks internal publication too, so it ships regardless.
3. **Before results are ready to submit (weeks after freeze, per EXP-P1 §13 timeline — not a weekend blocker):** build `POST /api/experiments/results/external` composing §7 — the `experiment-submission` cohort entitlement, the agent-passport resolution seam, the entitlement + `requireAuthorizedAgreement` gates, optional `spendWithinCap`, and `publishExperimentResult(origin:'external')`.
4. **Alongside (3):** the IRL OS **Constitutional Evaluation** tab surface that shows the partner their agreement terms + the submission front door.

**The key sequencing fact:** signing (step 1) uses only built primitives and can happen at freeze; the submission endpoint (step 3) is only exercised once runs complete, so its build has the whole main-runs window and never blocks getting started. No code lands from *this doc* — the charter is the ratification gate; steps 2–4 are separately authorized builds.

---

## 10. Why this is the elegant path (and the honest caveats)

**Elegant:** it moves zero new trust assumptions into existence. The 409 gate, the bounded authority, the x409 acceptance, the receipted publication, and the public verifier all already exist and are already load-bearing elsewhere. Phase 2 is their *composition* over one new additive route — the platform admitting an external scientist's result through the exact machinery it asks the world to trust. CFS-033 §5's "distinct parties" stops being prose and becomes a countersigned, revocable, receipted fact.

**Honest caveats (do not oversell):**
- An externally *submitted* result is still only as trustworthy as its **hash-consistency with the frozen bundle** — submission origin is a provenance label, not a proof of correctness. The dual-run hash-compare (EXP-P1 §8, §11) remains the integrity mechanism; this charter changes who may write, not what makes a write believable.
- Passport delegation makes external submission *possible and bounded*; it does not make the external party *independent of the Institute's instrument*. Independence is still bounded by whatever components are technically re-runnable (EXP-P1 §13) — anything not re-runnable stays labelled `internally executed`.
- **For the wider IRL OS population** Phase 2 is a graduation from Phase 1; **for the countersigned partner it is the entry point** (§2 adoption posture). The two are not in tension because the *signature* (built primitives, at freeze) and the *submission endpoint* (built during the runs window) are separable in time — onboarding Austin straight to Phase 2 does not gate the weekend start on the endpoint build (§9).

---

## Ratification record

- [ ] PROPOSED 2026-07-18 (operator direction: "public results-submission endpoint, cohort/payment gated, via a Polity Passport with bounded delegation for [the external] agent … use bounded delegation and our x409 contract to sign this off").
- [x] Adoption posture set 2026-07-18: two-phase split is the **wider-rollout** frame; the **countersigned EXP-P1 partner adopts Phase 2 from the outset** — the x409 signature that starts them IS the onboarding act (operator: "ask them to adopt the second phase from the get go as we want to use it to sign the agreement to actually get started … brings them into a constitutional operating model from the get go").
- [ ] Operator ratifies the capability triple (`irl:experiment-result:submit`) + the Phase-2-first onboarding for Austin.
- [ ] §8 EXPERIMENTS allow-list widened (Phase-1 prerequisite) — separate, ships first.
- [ ] Phase 2 build authorized (separate gate; not this doc).
