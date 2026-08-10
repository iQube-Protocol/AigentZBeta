# MoneyPenny Pre-Recording Evidence Snapshot — 2026-08-10

**Status: pre-recording baseline, captured and frozen per operator instruction ("treat the current
live API baseline as the pre-recording evidence snapshot and preserve it alongside the final
recording/closure matrix").** This is the durable record of what the canonical state actually was,
via read-only unauthenticated `GET` calls against the live `dev` deployment, immediately before the
MoneyPenny recording run. It corroborates 5 of the operator's 10 pre-recording verification points
at the data level; the remaining 5 are pure UI/visual checks the operator is performing directly on
`dev` (see "What this snapshot does not cover" below).

Captured: **2026-08-10T07:32:07Z**, against `dev` at commit `4e77fcd1e` (the merge that reconciled
the compact narrator header with dev's KNYTS Bridge `headerActions` refactor and shipped the
Register ceremony replay projection — see `2026-08-10_horizen-coherence-matrix-nakamoto.md` for the
prior Ingest diagnostic this session also relied on).

All requests: `curl` from the session sandbox, no `Authorization` header, no mutation. The state
route resolves and returns real canonical data even unauthenticated for this journey — confirmed by
`registerCeremony` being present and populated (a field that did not exist before this session's
commits), which is itself proof the deploy had already picked up the latest push at capture time.

---

## 1. MoneyPenny (`agentSlug=moneypenny`) — full stage resolution

```
GET /api/journey/moneypenny-horizen/state?agentSlug=moneypenny
```

```json
{
  "currentStageId": "claim",
  "stages": [
    { "stageId": "register", "state": "COMPLETE", "evidenceMissing": [], "receiptRefs": [
      "3ab6bb61-cdff-4347-a633-713395c3f3aa", "b0fe09d4-3d45-4860-abe4-982b412e6688",
      "efba95ce-1a75-43ed-becd-fad577598f9c", "4894a100-89c8-4e60-9977-3450f8c3601c",
      "034d66e6-0776-40fa-b061-bbb2ffc08023", "c8dc591b-d6f4-47b7-a74e-1496d0a71b42",
      "7f7293f7-cac0-44ce-af31-2c06a31c6ba9"
    ]},
    { "stageId": "claim", "state": "READY", "evidenceMissing": ["controlProofFresh"], "receiptRefs": [] },
    { "stageId": "orient", "state": "BLOCKED", "evidenceMissing": ["orientationComplete"], "receiptRefs": [] },
    { "stageId": "passport", "state": "BLOCKED",
      "evidencePresent": ["operatorPolityCitizenPassportValid"],
      "evidenceMissing": ["sponsorBinding", "delegatePassportIssued"], "receiptRefs": [] },
    { "stageId": "delegate", "state": "BLOCKED",
      "evidenceMissing": ["delegatePassportActive", "boundedDelegationActive", "personaAssignedAsDelegate"] },
    { "stageId": "aigentme", "state": "BLOCKED", "evidenceMissing": ["aigentMeActive", "focusDispositionRecorded"] },
    { "stageId": "verify", "state": "BLOCKED", "evidenceMissing": [
      "agreementTermsCommitted", "agreementAcceptanceRecorded", "agreementAuthorized",
      "agreementReceiptsAnchored", "agreementGateRecognized"
    ]},
    { "stageId": "deploy", "state": "BLOCKED", "evidenceMissing": ["factoryIngested"],
      "receiptRefs": ["56b99451-936a-44ee-959e-38c8e33a4eba"] },
    { "stageId": "standing", "state": "BLOCKED", "evidenceMissing": ["standingGatewayEnabled"],
      "receiptRefs": ["56b99451-936a-44ee-959e-38c8e33a4eba"] }
  ],
  "complete": false
}
```

`axes`:

```json
{
  "admission": { "registered": true, "claimed": false, "passportReady": false, "delegated": false, "aigentMeActive": false },
  "factory": { "ingested": false, "standingEligible": false },
  "verification": { "pulse": "not-started", "pnl": "not-started", "financialServicesEligible": false },
  "standing": { "accrued": 0, "initialAccrued": 0, "contributionAccrued": 0, "sourceReceipts": [] }
}
```

`consequenceFork`: `verify` / `deploy` / `standing` all `{ tier: "refused-unresolved", label: "Unresolved" }` —
consistent with each being genuinely un-actioned, never a stale or superseded observation.

**Corroborates operator checklist item 8** — `Register COMPLETE → Claim READY → Stand 0/unresolved`,
exactly as specified, byte-for-byte.

---

## 2. Repeated refresh — stability check (item 9)

Same endpoint fetched **3 times** in immediate succession. `register` / `claim` / `deploy` / `standing`
state and `axes.standing.accrued` were **identical on every fetch** (diffed byte-for-byte, zero
difference). No resurrection of `deploy` or `standing` from any prior/tombstoned resolution.

**Corroborates operator checklist item 9.**

---

## 3. `registerCeremony` projection — the Part C replay's data source (items 5, 6)

```json
{
  "principalWalletReady": { "established": true, "authority": "inferred", "receiptRefs": [], "dvnStatus": null },
  "mandatePrepared":      { "established": true, "authority": "inferred", "receiptRefs": [], "dvnStatus": null },
  "mandateSigned": {
    "established": true, "authority": "evidence", "effectiveAt": "2026-08-02T05:51:35.090791+00:00",
    "receiptRefs": ["b0fe09d4-3d45-4860-abe4-982b412e6688", "efba95ce-1a75-43ed-becd-fad577598f9c"],
    "dvnStatus": "dvn_recorded"
  },
  "invocationApproved": {
    "established": true, "authority": "evidence", "effectiveAt": "2026-08-07T15:19:58.843493+00:00",
    "receiptRefs": ["4894a100-89c8-4e60-9977-3450f8c3601c"], "dvnStatus": "dvn_recorded"
  },
  "transactionBroadcast": {
    "established": true, "authority": "evidence", "effectiveAt": "2026-08-07T15:19:59.138828+00:00",
    "receiptRefs": ["034d66e6-0776-40fa-b061-bbb2ffc08023"], "dvnStatus": "dvn_recorded"
  },
  "horizenConfirmed": {
    "established": true, "authority": "evidence", "effectiveAt": "2026-08-09T06:39:28.359006+00:00",
    "receiptRefs": ["c8dc591b-d6f4-47b7-a74e-1496d0a71b42"], "dvnStatus": "dvn_pending"
  },
  "registryBindingRecorded": {
    "established": true, "authority": "evidence", "effectiveAt": "2026-08-09T06:39:28.678295+00:00",
    "receiptRefs": ["7f7293f7-cac0-44ce-af31-2c06a31c6ba9"], "dvnStatus": "dvn_recorded"
  }
}
```

**Corroborates operator checklist item 5** — `principalWalletReady`/`mandatePrepared` carry
`authority: "inferred"`, no receipt, no fabricated evidence.

**Corroborates operator checklist item 6 at the data level** — all five remaining steps carry real
receipt UUIDs and a real `dvnStatus`. The *interaction* of expanding into receipt detail in the UI
was not exercised here (it requires an authenticated persona via `personaFetch`), so this snapshot
proves the data exists to expand into, not that the expand affordance itself renders correctly — that
remains one of the operator's direct visual checks.

---

## 4. Nakamoto (`agentSlug=nakamoto`) — Ingest / DVN-pending state (item 10)

```
GET /api/journey/moneypenny-horizen/state?agentSlug=nakamoto
```

```json
{
  "deploy": {
    "state": "COMPLETE",
    "evidencePresent": ["factoryIngested"],
    "evidenceMissing": [],
    "receiptRefs": [
      "ed175286-f964-433f-9f41-dac3e4cf8e27",
      "534bb5c6-dbd0-4e5f-a47c-c3e48fb057af",
      "fab232f9-6c2f-41db-8397-9651374365b8"
    ]
  }
}
```

`consequenceFork.deploy`:

```json
{ "tier": "pending-observer-active", "label": "DVN Pending",
  "detail": "Your action is complete. DVN anchoring of that action has not yet reached finality." }
```

**Corroborates operator checklist item 10** — Ingest is canonically `COMPLETE` with three real
receipts; the `DVN Pending` fork badge is additive and never gates the stepper's own completion
tick. No code change made here (per the Part B diagnostic, `2026-08-10_horizen-coherence-matrix-nakamoto.md`)
and none needed now — left exactly as observed, per instruction.

---

## What this snapshot does not cover

Operator checklist items **1, 2, 3, 4, 7** are visual/rendering checks (one compact header row, the
narrator's active↔consequence alternation, absence of the old second description row, the ceremony
replay actually opening on Register, and the absence of any mutating control in the rendered UI).
This sandbox's headless browser has no outbound network access at capture time (confirmed general,
not host-specific — even `https://example.com` reset), so these five were not captured here. They
are covered at the source level by `tests/register-ceremony-replay.test.ts` (16 assertions) and the
updated `tests/journey-orient-stage.test.ts` (40 assertions, all passing against the deployed commit),
but a passing source-scan test is not the same claim as a rendered pixel — the operator is confirming
those five directly against `dev`.

## Where the final record goes

This snapshot is the **pre-recording** half of the record. Once the operator confirms the five visual
items and the MoneyPenny recording run completes, the **closure matrix** (post-recording) belongs in
a follow-up doc in this same `updates/` directory, cross-referencing this file by name so the two
together form the complete before/after evidence trail for the recording.
