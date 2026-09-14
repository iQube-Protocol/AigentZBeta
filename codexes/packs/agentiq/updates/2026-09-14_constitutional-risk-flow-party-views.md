# Constitutional Risk Flow — Party Bindings & Participant Views — Use Case Zero Build-Order Item 10b

**Date:** 14 September 2026
**Status:** Implemented, tested, committed locally (not pushed).
**Base:** dev@26a3cb321 (Use Case Zero build-order item 10a, Constitutional Risk Flow panel).
**Scope:** Closes the gap named explicitly in this item's brief — there was no
binding anywhere in this codebase between a `party` label used in a
`VelaMultiPartyDisclosureScope` grant and any real, authenticated persona, so
a party's "view" of the Constitutional Risk Flow could not be authorized
non-spoofably. Adds a new server-internal binding table + service, and
extends item 10a's own route/panel with an optional, redacted, per-party
view gated by that binding and by the exact `COMPUTE_WITH`/`DISCLOSE_TO`
grants in scope. Zero changes to
`services/vela/velaUnderwritingChainProjection.ts`,
`services/vela/velaUnderwritingCompositionGate.ts`,
`services/vela/velaMultiPartyProjection.ts`, `services/vela/velaPartyNamespace.ts`,
or `services/dvn/activityReceiptDvnPipeline.ts`.

## 1. The model this item implements (operator's own ruling, verbatim)

> "Party identity in a transaction is not a client-supplied label. It is a
> recorded constitutional binding between the transaction namespace and the
> authenticated principal/persona that contributed or was authorized to
> control that namespace."

## 2. What was built

### 2.1 `supabase/migrations/20261001001100_vela_underwriting_party_bindings.sql` (new)

`vela_underwriting_party_bindings` — server-internal access-control metadata,
**never** DVN-anchored, **never** an `activity_receipts` row, **never** a new
`ActivityActionType`. Mirrors `factor_cases_service_only`'s exact
service-role-only RLS idiom, and mirrors `factor_case_events.actor_persona_id`'s
precedent for storing a real `personaId` in a non-chain-bound internal table
(per CLAUDE.md's HMS Identifier Isolation / Identity & Access Spine T0 rule).

Columns: `request_ref`, `application_id`, `party_label`, `party_namespace_ref`,
`authority_principal_id`, `authority_persona_id`, `flow_owner_persona_id`
(the persona whose OWN `activity_receipts` rows carry this requestRef's
chain evidence — needed because a viewing party's own personaId is NOT the
persona whose receipts must be read), `binding_type` (`'CONTRIBUTOR'` only,
today), `binding_evidence_ref`, `bound_at`.

**`UNIQUE (request_ref, party_label)` ONLY** — deliberately never on
`authority_persona_id`: the same persona may legitimately hold more than one
party role in the same transaction, each as its own row.

**Not applied to any live database** — no Supabase credentials exist in this
worktree (same as item 10a). The exact SQL is below for the operator to run.

### 2.2 `services/vela/velaUnderwritingPartyBinding.ts` (new)

- `recordUnderwritingPartyBinding(input)` — plain insert, fail-closed to
  `null` (never throws) on a missing admin client, a write error (including a
  UNIQUE-violation on a duplicate binding attempt), or a thrown exception.
- `resolvePartyBindingForViewer({ requestRef, partyLabel, viewerPersonaId })`
  — the anti-enumeration gate: looks up the ONE row for
  `(requestRef, partyLabel)` and returns `{ authorized: true,
  flowOwnerPersonaId }` ONLY when that row's `authority_persona_id` equals
  `viewerPersonaId` exactly. EVERY other case — no row at all, or a row
  naming a different persona — resolves the exact SAME `{ authorized: false
  }` shape, so a caller can never distinguish "no such party" from "wrong
  persona" from the response alone. Fail-closed on a query error too.

### 2.3 `services/vela/velaUnderwritingPartyView.ts` (new, pure)

`redactConstitutionalRiskFlowStateForParty(state, partyLabel)` — a PURE
function (no I/O) implementing the operator's own five-gate visibility
model over an already-assembled `ConstitutionalRiskFlowState`:

1. **Select/Admit/Freeze/Receipt/Telemetry** — always `visible: true`, real
   fields unchanged. Process/constitutional evidence about the request as a
   whole, not any one party's private operand.
2. **Authorize** — always `visible: true`; `scope.grants` filtered to
   `grant.party === partyLabel || grant.to === partyLabel`. The total
   original grant count is never exposed anywhere in the shape.
3. **Execute/Quote** — visible ONLY when a `DISCLOSE_TO` grant names this
   party as `to`. `COMPUTE_WITH` membership alone never grants visibility.
   When not entitled: `visible: false`, every substantive field `null`,
   `reason` is the SAME fixed literal string
   (`"Confidential contribution present — not disclosed to this party."`)
   regardless of the real disposition/premium/anything else.
4. **Settle** — gated by the identical `DISCLOSE_TO`-to-self check.
5. Every step's `state` field is always the real, un-redacted state; only
   substantive fields and `reason` are ever redacted.

Extends (via a TypeScript intersection with `{ visible: boolean }`), rather
than parallel-redefines, `velaUnderwritingChainProjection.ts`'s own per-step
interfaces — every field on those interfaces was already nullable (verified
by reading that file in full), so no field was hand-copied.

### 2.4 Route: `app/api/moneypenny/constitutional-risk-flow/route.ts` (extended)

New OPTIONAL `?party=` query param:

- **Absent** — byte-for-byte the original item-10a behavior. The four
  original route tests pass UNMODIFIED.
- **Present** — resolves the caller's own persona via the identity spine
  (never a client-supplied value — there is none on this route), calls
  `resolvePartyBindingForViewer`, returns a SINGLE generic 403
  (`"Not authorized to view this party's flow."`) for every denial case, and
  on authorization reads the chain state against the RESOLVED
  `flowOwnerPersonaId` (never the viewer's own persona) before redacting it
  for that party. `flowOwnerPersonaId` never reaches the response body.

### 2.5 UI: `app/(shell)/moneypenny/components/ConstitutionalRiskFlowPanel.tsx` (extended)

An optional `party` text input alongside `requestRef` (same honest "no
picker exists" pattern). The returned `ConstitutionalRiskFlowParticipantView`
is a structural superset of `ConstitutionalRiskFlowState`, so every existing
capsule renders it via the SAME field accesses with zero changes — except
the Settlement capsule, whose `settlementOccurred === null` special case
would otherwise have silently swallowed the redaction's own fixed reason
string; that one spot now checks the participant view's `visible` field
first, byte-identical to before when `visible` is absent. A 403 surfaces
through the existing `RiskFlowErrorNote` with the route's own generic
message. Additionally: the owner ground-context write
(`setActiveRiskFlowRequestRef`) is skipped when viewing a participant view,
since that state belongs to another persona's evidence.

## 3. Tests

- `tests/vela-underwriting-party-binding.test.ts` (14 tests) — field mapping,
  fail-closed discipline, anti-enumeration, and the two operator-mandated
  non-spoofability properties verbatim (party-label spoofing across
  personas; cross-requestRef binding leakage) plus the "one persona, two
  party roles on the same request" case.
- `tests/vela-underwriting-party-view.test.ts` (14 tests) — all five
  visibility gates, including the "COMPUTE_WITH-only never grants
  visibility" case and the exact grant-filtering behavior for both the
  disclosing and receiving party.
- `tests/moneypenny-constitutional-risk-flow-route-party.test.ts` (8 tests)
  — route-level 403 behavior, `flowOwnerPersonaId` never leaking into the
  response, and the operator's own exact regression scenario end-to-end.
- `tests/moneypenny-constitutional-risk-flow-route.test.ts` — the four
  original tests, unmodified, still passing.

**Full verification run** (this item's own new/touched suites plus every
suite item 10a's own record listed): 218 tests passed across 13 test files
(36 new + 182 pre-existing, all unchanged in behavior). `npx tsc --noEmit`
shows exactly 677 pre-existing repo-wide errors — the identical count item
10a's own record reported — confirming zero new TypeScript errors from this
item's files. `git diff` against `dev@26a3cb321` confirms zero changes to
`velaUnderwritingChainProjection.ts`, `velaUnderwritingCompositionGate.ts`,
`velaMultiPartyProjection.ts`, `velaPartyNamespace.ts`, and
`activityReceiptDvnPipeline.ts`.

## 4. Migration SQL — for the operator to run (not applied; no live DB credentials in this worktree)

```sql
-- 20261001001100_vela_underwriting_party_bindings.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.vela_underwriting_party_bindings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ref             TEXT NOT NULL,
  application_id          TEXT NOT NULL,
  party_label             TEXT NOT NULL,
  party_namespace_ref     TEXT NOT NULL,
  authority_principal_id  TEXT NOT NULL,
  authority_persona_id    UUID NOT NULL,
  flow_owner_persona_id   UUID NOT NULL,
  binding_type            TEXT NOT NULL DEFAULT 'CONTRIBUTOR' CHECK (binding_type IN ('CONTRIBUTOR')),
  binding_evidence_ref    TEXT,
  bound_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_ref, party_label)
);

CREATE INDEX IF NOT EXISTS idx_vela_underwriting_party_bindings_request
  ON public.vela_underwriting_party_bindings (request_ref);

COMMENT ON TABLE public.vela_underwriting_party_bindings IS
  'Vela underwriting party binding (Use Case Zero build-order item 10b) — a recorded constitutional binding between a VelaMultiPartyDisclosureScope party_label and the authenticated persona that contributed/controls that namespace, for one requestRef. Server-internal access-control metadata: never DVN-anchored, never an activity_receipts row, never client-exposed. UNIQUE(request_ref, party_label) only — the same persona may legitimately hold more than one party role on the same request, each as its own row.';
COMMENT ON COLUMN public.vela_underwriting_party_bindings.flow_owner_persona_id IS
  'The persona whose OWN activity_receipts rows carry this requestRef''s chain evidence — the persona a viewing party''s Constitutional Risk Flow read is actually resolved against, distinct from authority_persona_id (the viewing party''s own persona).';

ALTER TABLE public.vela_underwriting_party_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vela_underwriting_party_bindings_service_only ON public.vela_underwriting_party_bindings;
CREATE POLICY vela_underwriting_party_bindings_service_only ON public.vela_underwriting_party_bindings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
```

## 5. Resolution → invariant loop

- Resolution record:
  `codexes/packs/agentiq/resolution-records/records/RES-2026-09-14-VELA-PARTY-BINDING-CONSTITUTIONAL-VIEWS-001.json`
- Candidate invariant (parented to item 10a's own
  `CI-2026-09-13-CONSTITUTIONAL-CHAIN-VIEWER-READS-EACH-STEPS-OWN-EVIDENCE-001`):
  `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-09-14-PARTY-LABEL-REQUIRES-RECORDED-PERSONA-BINDING-001.json`
- Both left at `status: "candidate"` — never self-ratified, per CLAUDE.md.

## 6. Out of scope for this item

- No route/UI to CREATE a party binding — this item builds the service
  function (`recordUnderwritingPartyBinding`) and its own tests exercise it
  directly; wiring binding creation into the composition-gate flow (item 9)
  or a dedicated admin surface is future work.
- No "list my party bindings" lookup — mirrors item 10a's own "no list my
  requests" precedent; a participant must already know their own requestRef
  + partyLabel.
