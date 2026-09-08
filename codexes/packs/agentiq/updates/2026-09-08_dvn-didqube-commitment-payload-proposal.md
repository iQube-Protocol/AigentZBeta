# DVN receipt payload — proposed DiDQube commitment fields (PROPOSAL ONLY, NOT IMPLEMENTED)

**Status:** Proposal for operator review. No code has been changed under
`services/dvn/` to produce this document. Per CLAUDE.md's DVN Pipeline
Protection PARAMOUNT rule, adding/reordering fields in the DVN JSON payload
requires explicit operator approval BEFORE coding — this is that request,
not an implementation. This is DiDQube Phase 4 item 6, deliberately excluded
from the Phase 4 closure (`2026-09-07_didqube-canonical-resolver-execution-plan.md`,
"Phase 4 — PARTIAL, NOT closed") pending exactly this approval.

Prepared now, separately from Use Case Zero, per the operator's own
instruction: "Prepare its precise proposed payload diff separately when Use
Case Zero is no longer blocked." Use Case Zero itself was not blocked on
this — the preflight rehearsal (see the accompanying capsule) reached its
stop-boundary without needing any DVN change. This proposal is handed over
now so it is ready whenever the operator wants to act on it.

## Current payload (unchanged, quoted verbatim for reference)

`services/dvn/activityReceiptDvnPipeline.ts::submitActivityReceiptToDvn`, lines ~533-548:

```ts
const payload = JSON.stringify({
  action: 'AIGENTME_ACTIVITY_RECEIPT',
  receiptId: record.id,
  commitmentHash, // the shared H — reconciles this leg with the PoS leg by identity
  personaRef, // T2-safe; never personaId
  activeCartridge: record.activeCartridge,
  actionType: record.actionType,
  summary: record.summary,
  agentsInvoked: record.agentsInvoked,
  toolsUsed: record.toolsUsed,
  iqubesUsed: record.iqubesUsed,
  contextShared: record.contextShared,
  artifactsCreated: record.artifactsCreated,
  approvalsGranted: record.approvalsGranted,
  timestamp: Date.parse(record.createdAt) || Date.now(),
});
```

`personaRef` is already `hashPersonaRef(personaId)` — sha256(personaId), truncated to 16 hex
chars. It is the ONLY identity-shaped field on this payload today, and it names the persona,
never the DiDQube/constitutional-container the persona or agent resolves to.

## What is missing

Nothing on this payload currently distinguishes receipts belonging to genuinely different
constitutional identities that happen to route through the same persona (e.g. a persona acting
on behalf of two different delegated agents), nor does it let an on-chain observer verify that a
receipt's actor was actually a *resolved* DiDQube at the time of the action (versus an
unresolved/conflicted one). This is the same gap Phase 4 already closed for Aegis assessments
(`subject_didqube_id`/`subject_resolution_commitment` columns) and CTP transition evidence
(`subjectDidqubeId`/resolution snapshot) — DVN is the one remaining consumer named in the
original plan that still carries no DiDQube-aware field at all.

## Proposed additive fields (never replacing `personaRef` or `commitmentHash`)

Two new, OPTIONAL fields, populated only when `resolveDiDQube` reaches `state === 'resolved'`
for the receipt's subject — mirroring the Aegis/CTP pattern of "additive, never blocking":

```ts
const payload = JSON.stringify({
  action: 'AIGENTME_ACTIVITY_RECEIPT',
  receiptId: record.id,
  commitmentHash,
  personaRef,
  // --- proposed additions, both optional, both omitted when unresolved ---
  subjectDidqubeRef: didqubeResolution?.state === 'resolved'
    ? didqubeResolution.primitive.publicCommitment.value   // T2-safe — same didPublicRef() commitment already used for receipts elsewhere (three-level reference model, Level 2)
    : undefined,
  subjectDidqubeCommitmentVersion: didqubeResolution?.state === 'resolved'
    ? didqubeResolution.primitive.publicCommitment.commitmentVersion   // e.g. 'v1' — versions the commitment scheme itself, so a future re-derivation is distinguishable from today's
    : undefined,
  // --- end proposed additions ---
  activeCartridge: record.activeCartridge,
  actionType: record.actionType,
  summary: record.summary,
  agentsInvoked: record.agentsInvoked,
  toolsUsed: record.toolsUsed,
  iqubesUsed: record.iqubesUsed,
  contextShared: record.contextShared,
  artifactsCreated: record.artifactsCreated,
  approvalsGranted: record.approvalsGranted,
  timestamp: Date.parse(record.createdAt) || Date.now(),
});
```

Both fields:
- Are **T2-safe by construction** — `publicCommitment.value` is `didPublicRef(...)`, the SAME
  one-way, already-in-production commitment the identity spine's own "three-level reference
  model" designates as "the ONLY persona identifier for receipts" (Level 2: Polity Public
  Reference). This proposal does not invent a new commitment scheme; it reuses the existing one.
- Are **never derived from a raw `didqubeId`, `agentRootIdentityId`, `personaId`, or `rootDid`** —
  only from `resolveDiDQube`'s own `publicCommitment`, exactly as `CI-2026-09-07-DIDQUBE-CONSUMER-
  RESOLVER-NOT-RAW-ANCHOR-001` requires of every Phase 4 consumer.
- Are **omitted, never fabricated**, when the subject's DiDQube is unresolved, conflicted, or
  ambiguous — matching the Aegis/CTP precedent exactly (a null/absent field, never a guessed one).

## What would need to be decided before implementation (open questions for the operator)

1. **Which receipt subject resolves the DiDQube?** Today's `submitActivityReceiptToDvn` receives
   only `personaId` — it has no agent/case/subject context to resolve against. The caller
   (wherever `submitActivityReceiptToDvn` is invoked) would need to pass an already-resolved
   `DiDQubeResolution` (or the raw input to resolve one) alongside the record. This is a caller-
   side change, not a payload-shape change by itself, but it determines which of the many
   receipt-producing call sites actually populate the new fields versus leaving them `undefined`
   forever.
2. **Backward compatibility of existing on-chain consumers.** Any external verifier currently
   parsing this JSON payload by field enumeration (rather than by key lookup) would see two new
   keys. Confirm no such brittle consumer exists before shipping.
3. **Whether this closes DiDQube Phase 4 item 6 outright, or is itself split further** (e.g. an
   agent-actor commitment separate from a persona-subject commitment, if a receipt's "subject" and
   "actor" can differ — this proposal only covers a single subject reference; the operator may want
   both).

## Explicitly NOT part of this proposal

- No change to `personaRef`, `commitmentHash`, the state machine (`local → dvn_pending →
  dvn_recorded / dvn_failed`), the canister call mechanism, or `hashPersonaRef`'s own logic.
- No change to `ANCHORABLE_ACTION_TYPES` (the one change this file's own header already permits
  unilaterally — untouched here, this proposal is about the payload shape, not the action-type
  allowlist).
- No code has been written against this proposal. `services/dvn/activityReceiptDvnPipeline.ts` is
  unmodified.

## Source references

- Current payload: `services/dvn/activityReceiptDvnPipeline.ts` (lines ~450-548, `hashPersonaRef`/`submitActivityReceiptToDvn`)
- Commitment primitive reused: `services/identity/didQubeResolver.ts` (`CommitmentRef`, `publicCommitment`, `didPublicRef`)
- Precedent (same pattern, different consumer): `RES-2026-09-07-DIDQUBE-PHASE-4-AEGIS-CONSUMER-MIGRATION-001.json`, `RES-2026-09-07-DIDQUBE-PHASE-4-CTP-CONSUMER-MIGRATION-001.json`
- Governing invariant: `CI-2026-09-07-DIDQUBE-CONSUMER-RESOLVER-NOT-RAW-ANCHOR-001.json`
- Original scoping (item 6, out of scope pending approval): `2026-09-07_didqube-canonical-resolver-execution-plan.md`, "Phase 4 — PARTIAL, NOT closed" section
