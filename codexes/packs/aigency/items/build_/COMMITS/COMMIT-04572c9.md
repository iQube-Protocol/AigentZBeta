# Commit Brief: `04572c9` — Replace global get_ready_messages() with targeted per-receipt DVN reads

| Field | Value |
|-------|-------|
| SHA | [`04572c9`](https://github.com/iQube-Protocol/AigentZBeta/commit/04572c9443deb6ad397f3ed907d14a7c465a8cf3) |
| Author | Claude |
| Date | 2026-08-09T06:24:52Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Replace global get_ready_messages() with targeted per-receipt DVN reads

The activity-receipts finalizer called the canister's global,
no-argument get_ready_messages() - enumerating the canister's entire
ready-message backlog. Live, this returned ~5.8MB, exceeding the IC's
3 MiB query-response cap (IC0504) and failing the finalizer outright.

Readiness is now read per receipt: a bounded batch (50) of our own
dvn_pending activity_receipts rows, each checked via the canister's
existing targeted query methods (get_dvn_message, get_message_attestations
- already declared in the IDL, no canister or IDL change). Preserves
the exact readiness predicate (attestation_count >= 2) and never
promotes a message the canister no longer has. One receipt's failed
read is isolated and retried next run rather than blocking the batch.
Never resubmits - read-only, only promotes an existing dvn_pending row.

Receipt commitment/hash semantics, DVN submission, the
local -> dvn_pending -> dvn_recorded state machine, PoS/Bitcoin logic,
and the definition of DVN Minted are all unchanged - only the
readiness READ strategy changed.
```

## Body

The activity-receipts finalizer called the canister's global,
no-argument get_ready_messages() - enumerating the canister's entire
ready-message backlog. Live, this returned ~5.8MB, exceeding the IC's
3 MiB query-response cap (IC0504) and failing the finalizer outright.

Readiness is now read per receipt: a bounded batch (50) of our own
dvn_pending activity_receipts rows, each checked via the canister's
existing targeted query methods (get_dvn_message, get_message_attestations
- already declared in the IDL, no canister or IDL change). Preserves
the exact readiness predicate (attestation_count >= 2) and never
promotes a message the canister no longer has. One receipt's failed
read is isolated and retried next run rather than blocking the batch.
Never resubmits - read-only, only promotes an existing dvn_pending row.

Receipt commitment/hash semantics, DVN submission, the
local -> dvn_pending -> dvn_recorded state machine, PoS/Bitcoin logic,
and the definition of DVN Minted are all unchanged - only the
readiness READ strategy changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Added | `tests/dvn-finalizer-targeted-batch.test.ts` |

## Stats

 2 files changed, 443 insertions(+), 16 deletions(-)
