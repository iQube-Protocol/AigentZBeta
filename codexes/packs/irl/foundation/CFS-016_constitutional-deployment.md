# CFS-016 — Constitutional Deployment

**Chrysalis Foundation Specification · v1.0 · Status: D1 RATIFIED by operator direction 2026-07-06; D2/D3 remain UNRATIFIED (D2's precondition: D1 operating history).**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Companion to CFS-015 (Strand One Phase Two: "deployment ownership transfers to Aigent Z" — the PRD's riskiest single item, deliberately designed before any code).

---

## Why this document exists before any code

Deploys are consequence-bearing acts: a deploy changes what the platform does for every persona simultaneously, and a bad one can violate gates the constitution declares inviolable. Law XI (humans define semantics; agents optimize implementation) therefore applies at full strength: **the authority to deploy is ratified explicitly, level by level, or not at all.** This document defines the ladder so ratification is a precise act — "ratify D1" means something concrete and bounded, not "give the agent deploy access."

The recursive preamble (CFS-015) applies to this document itself: designing deployment constitutionally before implementing it IS constitutional deployment practice.

## The deployment authority ladder

| Level | Name | Who decides | Who executes | Status |
|---|---|---|---|---|
| **D0** | Operator-manual | Operator | Operator (or an agent under live per-push operator direction, as today) | **CURRENT** |
| **D1** | Pack-proposed | Operator | Operator | **RATIFIED 2026-07-06** — implemented same day (`deployment_proposed` receipt type + the Capability Pipeline tab's propose affordance) |
| **D2** | Receipts-gated, operator-approved | Operator (per deploy, one explicit approval) | Aigent Z (through the existing rail) | Designed below — ratifiable AFTER D1 has operated |
| **D3** | Autonomous within bounds | Constitution (pre-ratified envelope) | Aigent Z | **EXPLICITLY NOT PROPOSED.** Requires its own future amendment with evidence from D2 operation |

**Nothing in this document proposes D3.** The ladder exists so that "not yet" is a position on a scale, not an absence of thought.

## D1 — Pack-proposed deployment

What changes from D0: the *proposal* becomes constitutional; the *execution* stays human.

**Flow:** Implementation Pack (generated, receipted) → implementation by any provider → validation receipts (parse gates, canaries, coherence where applicable) → **deploy-intent receipt** (`deployment_proposed` — new action type, DVN-anchorable) carrying: the pack id, the commit range, the validation receipt ids, and a T2-safe summary → the operator reviews the receipt chain and pushes manually, exactly as today.

**What ratifying D1 requires:**
1. One new receipt action type (`deployment_proposed`) — the permitted change class.
2. A "Propose deployment" affordance on the Capability Pipeline tab that assembles the receipt chain into one reviewable record.
3. Nothing else. No credentials move; no agent gains push authority; the operator's muscle memory is unchanged.

**What D1 buys:** every deploy becomes traceable to its pack, its invariant bindings, and its validation evidence — the provenance chain exists before any authority transfers.

## D2 — Receipts-gated, operator-approved deployment

What changes from D1: execution transfers to Aigent Z, gated by one explicit human approval per deploy.

**Flow:** D1 chain complete → operator clicks **Approve deployment** (an `approval_granted` receipt referencing the deploy-intent receipt — the Law XI gate, per-deploy, never blanket) → Aigent Z executes the push through the EXISTING rail only (session branch → `claude/**` → dev auto-merge; `.amplify-deploy` trigger) → `deployment_executed` receipt (new action type) carrying the commit hash and the approval receipt id → deploy status observed and receipted.

**Hard preconditions for ratifying D2:**
1. D1 has operated for a period the operator judges sufficient, with the receipt chains reviewed and found trustworthy.
2. The execution path is mechanically constrained to the dev rail (see boundaries below) — enforced in code, not policy prose.
3. A kill switch: the operator can revoke D2 with one action, reverting to D1, receipted.

## Hard boundaries — never crossed at ANY level without constitutional amendment

These bind D1, D2, and any future level equally:

1. **Branch scope:** `dev` via the existing `claude/**` rail ONLY. `main`, staging, and any production branch are outside every level of this ladder — deploying there remains a human act with no agent execution path, full stop.
2. **Protected files:** the access-gate rules, identity spine files, and DVN pipeline files (per CLAUDE.md's PARAMOUNT sections) are never modified by a deploy that hasn't had those specific diffs individually operator-reviewed — the deploy-intent receipt MUST flag any diff touching them, and D2 auto-execution refuses such deploys (falls back to D1 manual push).
3. **Credentials:** no level grants the agent new credentials. D2 uses only the repository-push capability the session already holds; Amplify, Supabase, and provider keys never become agent-managed.
4. **Gates:** a deploy may never weaken an access gate (CLAUDE.md PARAMOUNT rule restated here because deploys are where such weakening would ship).
5. **Approval is per-deploy:** no standing approvals, no batch approvals, no time-boxed auto-approve windows at D1/D2.

## Receipts taxonomy (all DVN-anchorable, added only upon ratification)

| Action type | Level | Carries |
|---|---|---|
| `deployment_proposed` | D1+ | pack id, commit range, validation receipt ids, protected-file flag |
| `deployment_executed` | D2+ | commit hash, approval receipt id, rail used |
| `deployment_reverted` | D2+ | reverted commit, reason, who initiated |
| `deployment_authority_changed` | any | ladder level change + who ratified (the kill switch is this receipt too) |

## Ratification record

- [x] **D1 RATIFIED — 2026-07-06, by operator direction.** Implemented the same day: `deployment_proposed` added to the receipt union + ANCHORABLE_ACTION_TYPES (the permitted change class), the admin-gated `/api/constitutional/deployment-proposal` route, and the "Propose deployment" section on the Capability Pipeline tab. Execution remains human; no credentials moved; the protected-file flag is operator self-declaration in v1 (honest limitation, stated in the UI).
- [ ] **D2 — not requested, not ratified.** Its precondition is D1 operating history. When D1 has run long enough to judge, a D2 ratification request will cite the actual receipt chains as evidence — the Improvement Loop applied to deployment authority itself.
- **D3 — explicitly not proposed** (unchanged).
