# SPEC-MMC-002 §6.3 — mySoftware Phase 3: Core actions on registered capabilities

**Status:** Shipped 2026-07-24 (Archive, Test, Deploy-propose, Delegate-propose). Run/Publish/Share investigated and honestly deferred — no clean existing seam found for any of the three; see §6 below.
**Author:** Claude Code, 2026-07-24
**Companion to:** `codexes/packs/irl/foundation/SPEC-MMC-002_my-software-artefact-inventory.md` §6.3 (the charter this document reports against), `2026-07-24_prd-mmc-impl-007-mysoftware-tab-implementation-plan.md` (Phase 1 + Phase 2 — this is that document's Phase 3 continuation), `services/constitutional/capabilityRegistry.ts`, `services/constitutional/constitutionalAgreement.ts`, `app/api/constitutional/deployment-proposal/route.ts`.
**Operator authorisation:** "Ok. Will run the script etc shortly. Meantime phase 2/3 ratified/authorised." (2026-07-24) — authorised design+build to proceed; did not waive the per-action ceremony-design requirement, and explicitly did not supersede D1 (CFS-016) or the DVN Pipeline Protection paramount rules (CLAUDE.md). Neither was touched by this pass.

---

## 1. What this pass builds

SPEC-MMC-002 §5 names eleven target actions for mySoftware: Open · Continue building · Test · Run · Deploy · Publish · Share · Delegate · Inspect receipts · View source · Archive. Open/Continue building/Inspect receipts/View source (the read-only actions) shipped in Phases 1–2. This pass ships the four MUTATING actions that had a clean, already-existing, D1-safe ceremony to compose:

| Action | Ceremony composed | New code |
|---|---|---|
| **Archive** | New `deprecateCapability()` — a pure lifecycle status-flag flip | Yes — the one genuinely new service function this pass adds |
| **Test** | Pre-existing `recordOperationalValidation()` (CFS-032 §5), now persona-scoped | No new service logic — only the ownership-gated route wrapper |
| **Deploy** | Pre-existing `POST /api/constitutional/deployment-proposal` (D1, CFS-016) | No new backend at all — the UI is a direct caller |
| **Delegate** | Pre-existing `constitutionalAgreement.ts` form→accept→authorize primitive | No new service logic — only UI composition |

Run, Publish, and Share are **not built this pass** — see §6.

---

## 2. Archive

**The only genuinely new backend logic in this pass.** A capability's own registrant can transition its `lifecycle_state` to `'deprecated'` — a pure status-flag update, receipted, reversible only by re-registration (never silently).

- `deprecateCapability(personaId, { capabilityId })` — new function, `services/constitutional/capabilityRegistry.ts`. Mirrors `recordOperationalValidation`'s shape (look up by `capability_id` → mutate → receipt → persist). Idempotent: archiving an already-`deprecated` capability returns `alreadyDeprecated: true`, no duplicate receipt, no error.
- New receipt action type: `capability_deprecated` — added to the closed `ActivityActionType` union (`services/receipts/activityReceiptService.ts`) and to `ANCHORABLE_ACTION_TYPES` (`services/dvn/activityReceiptDvnPipeline.ts` — the ONE unilateral change CLAUDE.md's DVN Pipeline Protection section explicitly permits without operator sign-off, because it only extends which receipt types get anchored, touching neither the submission mechanism, the state machine, nor the canister interaction).
- **New migration:** `supabase/migrations/20260724120000_capability_deprecated_and_receipt_check_drift_fix.sql` rebuilds the `activity_receipts_action_type_check` CHECK constraint wholesale (the established convention every prior action-type addition in this repo follows — see §7 for why a partial rebuild is unsafe).
- **Route:** `POST /api/constitutional/capability-registry/mine`, `{ action: 'archive', capabilityId }` (the GET route on this same file is extended with a POST — see §5 for the shared ownership mechanism).
- **UI:** an "Archive" button behind the canonical `ConfirmDialog` primitive (`components/ui/ConfirmDialog.tsx`) on each registered-capability card in `MySoftwareTab.tsx`. Archived capabilities keep showing in the list with a `deprecated` badge — the read surface never hides information, only marks its terminal state.

## 3. Test (operational validation)

`recordOperationalValidation()` already existed (CFS-032 §5) and was already reachable via the admin-gated `POST /api/constitutional/capability-registry` route. This pass adds the SAME function's reachability for the capability's own registrant — a citizen no longer needs an admin to record that they observed their own capability working in production.

- **Route:** same `mine` route, `{ action: 'test', capabilityId, evidence }`.
- **Unchanged gate:** the ≥10-character evidence requirement (`recordOperationalValidation`'s own refusal — "Standing accrues from verified contribution, not from a click") is untouched. This pass did not weaken it.
- **UI:** a "Test" button expands an inline evidence textarea + "Submit test evidence" — never a bare click. This is a human typing what they observed working; it executes nothing.

## 4. Deploy (propose-only)

This tab's Deploy action calls the pre-existing, D1-safe `POST /api/constitutional/deployment-proposal` ceremony directly. **No new deployment logic exists anywhere in this pass.**

- Read the route in full to get its exact required body shape rather than guessing it: `{ packId, commitRange, goal?, validationNotes?, touchesProtectedFiles?, constitutionalThresholdMet? }` — `packId` and `commitRange` are required.
- **UI:** shown only when `isAdmin` (an optimistic client hint; the route itself re-enforces the admin gate server-side regardless — CLAUDE.md's Inter-Cartridge Navigation rule). The operator fills in the REAL `packId`/`commitRange` — there is no honest default commit range for a capability card, so nothing is fabricated.
- **Result surfaced verbatim:** the route's own `d1Semantics` string ("Proposal recorded... Execution stays human (D1): review the chain, then push manually exactly as today") is displayed as-is. This pass adds no new interpretation of what a deployment proposal means.

## 5. Delegate (propose-only: form + accept; human-only authorize)

`constitutionalAgreement.ts`'s form→accept→authorize primitive turned out to be a clean fit: `capabilityRef` accepts any stable capability-id string (the existing MoneyPenny Runtime integration already keys it on plain slugs like `cap-moneypenny-financial-services`, not a registry row UUID), so a capability's own `capabilityId` composes directly with no forcing.

- **"Propose delegation"** (one click) calls `POST /api/constitutional/agreement` twice: `{ action: 'form', ... }` then `{ action: 'accept', acceptorType: 'agent', acceptorId: 'aigent-z' }` — the delegate agent's OWN side of the ceremony. Default delegated authority is conservative and non-money-moving: `forbiddenActions: ['transfer']`, `valueCeiling: null`, no settlement terms.
- **"Authorize (human step)"** is a SEPARATE, distinctly-labelled button. It is the ONLY call site for `{ action: 'authorize' }` in `MySoftwareTab.tsx` — `handleProposeDelegation` never calls it. This mirrors `app/(shell)/moneypenny/components/RuntimePanel.tsx`'s own reviewed form/accept/authorize precedent (its own canary: `tests/moneypenny-runtime-authority-boundary.test.ts`) rather than inventing a new authorization UI pattern. `tests/companion-mysoftware.test.ts` now carries the matching canary: exactly one `action: 'authorize'` call site in the whole file, and it must be textually inside `handleAuthorizeDelegation`.
- On load, the tab also reads `GET /api/constitutional/agreement` (best-effort) so a prior visit's accepted/authorized state survives a tab reload.

**Why this satisfies Principal–Delegate Separation:** the human authorizes; the agent (or this UI on the agent's behalf) never self-authorizes. No code path in this pass calls `authorizeAgreement` outside that one explicit button click.

## 6. What did NOT ship, and why (investigated, not silently narrowed)

- **Run** — no existing D1-safe "execute this capability" runtime was found anywhere in the codebase. The nearest things (`softwarePilot.ts`, the DCC dev-loop) produce artifacts/packs, they don't execute a shipped capability on demand. Building a Run ceremony from scratch is exactly the kind of new execution machinery this pass was told not to invent. A real Run ceremony is future chartering work (a Phase 4 item), not composed here.
- **Publish** — `registerCapability()` already sets `lifecycle.state` / `version.status` to `'published'` immediately on registration (CFS-032 §4 — Registry Registration IS Constitutional Acceptance, one event not two). There is no draft workflow in use today, so a distinct "Publish" action has no state transition left to perform for anything already in the registry. This is documented as an honest gap, not papered over with a fake draft stage invented just to give Publish something to do.
- **Share** — investigated `services/passport/participationAccess.ts` and the x409/CAS invitation surfaces. Both are cohort/participation-scoped grants (who may join a programme), not a persona-to-persona "share this specific capability with another citizen" primitive. No clean existing fit was found; Share was not forced onto either mechanism.

## 7. Bug found and fixed during this pass

Rebuilding the `activity_receipts_action_type_check` CHECK constraint for the new `capability_deprecated` type (required wholesale — the convention every migration in this chain follows since the 2026-07-15 constraint-drift incident) meant cross-referencing the live TypeScript `ActivityActionType` union against the constraint's last actual rebuild (`20260719000000_constitutional_agreements.sql`). That comparison surfaced four action types already shipped in TypeScript and in `ANCHORABLE_ACTION_TYPES` with **no matching CHECK-constraint entry**: `qubetalk_artifact_shared`, `qubetalk_artifact_opened`, `qubetalk_artifact_copied` (QubeTalk Peer Exchange, 2026-07-21) and `finance_authoritative_execution` (MoneyPenny Runtime P4-4). Any `createActivityReceipt` call with one of those four types would hit the CHECK constraint in production and throw — the receipt AND its DVN anchor silently lost, since neither `isMissingTable` nor `isMissingColumn` catches a check-violation error. Folded into the same wholesale rebuild this migration was already writing — no separate migration, and no DVN pipeline logic (state machine, canister call, hashing) was touched to fix it, consistent with CLAUDE.md's "the ONLY permitted unilateral change" boundary.

## 8. SQL the operator must run

```sql
-- 20260724120000 — capability_deprecated receipt type + CHECK-constraint
-- drift fix (qubetalk_artifact_*, finance_authoritative_execution were
-- missing from the CHECK since their own 2026-07-21 migrations never
-- rebuilt it — see §7 above).
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
    'capability_deprecated'
  ));
```

Full file: `supabase/migrations/20260724120000_capability_deprecated_and_receipt_check_drift_fix.sql`.

## 9. Files touched

| File | Change |
|---|---|
| `supabase/migrations/20260724120000_capability_deprecated_and_receipt_check_drift_fix.sql` | New — CHECK-constraint rebuild (adds `capability_deprecated` + fixes the 4-type drift, §7) |
| `services/receipts/activityReceiptService.ts` | New `ActivityActionType` literal: `capability_deprecated` |
| `services/dvn/activityReceiptDvnPipeline.ts` | `capability_deprecated` added to `ANCHORABLE_ACTION_TYPES` |
| `services/constitutional/capabilityRegistry.ts` | New `deprecateCapability(personaId, { capabilityId })` |
| `app/api/constitutional/capability-registry/mine/route.ts` | New `POST` (`archive` \| `test`), ownership re-derived via a shared `myRegisteredCapabilities()` helper used by GET and POST alike |
| `app/triad/components/codex/tabs/MySoftwareTab.tsx` | Archive/Test/Deploy/Delegate UI + handlers |
| `tests/companion-mysoftware.test.ts` | Updated composition canary (new route set, new sanctioned-action-set canary) + new authority-boundary canary for the `authorize` call site |
| `codexes/packs/irl/foundation/SPEC-MMC-002_my-software-artefact-inventory.md` | §6.3 rewritten from placeholder to shipped-state record |

## 10. What this pass explicitly does NOT do

- Does not build Run, Publish, or Share (§6) — each is an honest gap, not a silent scope-narrowing.
- Does not modify `services/dvn/activityReceiptDvnPipeline.ts` beyond the one permitted `ANCHORABLE_ACTION_TYPES` addition — no state-machine, canister, or payload-shape change.
- Does not modify `services/artifact/pilots/softwarePilot.ts` or any D1 execution boundary.
- Does not add any code path that calls `authorizeAgreement` outside the one explicit human button click.
- Does not weaken the admin gate on `/api/constitutional/deployment-proposal`, nor any other existing access gate.
- Does not backfill or reinterpret any T0/T1/T2 identifier tier — every new route re-derives ownership server-side from the caller's own receipts, never from a client-supplied claim.

---

*Authored docs-first, 2026-07-24. Reconciled against SPEC-MMC-002 §6.3 directly, `services/constitutional/capabilityRegistry.ts`, `services/constitutional/constitutionalAgreement.ts`, `app/api/constitutional/deployment-proposal/route.ts`, `app/api/constitutional/agreement/route.ts`, `app/(shell)/moneypenny/components/RuntimePanel.tsx` (the form/accept/authorize UI precedent), and `services/receipts/activityReceiptService.ts` / `services/dvn/activityReceiptDvnPipeline.ts` (the receipt-type + CHECK-constraint drift finding, §7). Builds nothing beyond what §6.3 charters.*
