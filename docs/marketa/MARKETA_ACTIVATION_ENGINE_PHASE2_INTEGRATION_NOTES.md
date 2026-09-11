# Marketa Activation Engine Phase 2 Integration Notes

**Status:** implemented for review  
**Scope:** extend the existing Marketa Activation Engine with live handoff points into existing platform systems.

## Golden Rule application

Phase 2 does not create a standalone registry, reputation, outreach, or import/export system.

| Capability | Existing system reused | Phase 2 extension |
| --- | --- | --- |
| iQube Registry | `services/registry/persistence.ts`, `app/api/registry/*`, registry receipts | Candidate-to-`AigentQube` handoff route that creates/relinks a registry asset and emits a registry receipt. |
| Reputation | RQH ICP canister via `services/ops/icAgent` + `services/ops/idl/rqh` (same path as `app/api/identity/reputation/*`) | Candidate reputation sync route that reads the authoritative RQH canister bucket by agent partition, falls back to the Supabase `reputation_bucket` cache/mirror, then to a non-authoritative activation score. |
| Outreach | Existing Marketa/AVL review-before-send pattern | Draft-only activation outreach route that records a human-review draft in activation events and never sends automatically. |
| Import/export | Existing Activation Engine JSON/CSV endpoints surfaced in Marketa UI | File picker now posts JSON/CSV to the import endpoint; export buttons continue to use download endpoints. |
| Passport Bureau | **Completed Polity Passport Bureau cartridge** (`polity_passport_applications` / `polity_passport_records`, `/api/polity-passport/*` machine surfaces) | Candidate-to-Bureau handoff route that prepares a draft participant application, dry-runs it through the Bureau's own validator, and syncs public application status / issued passport id back onto the candidate. |

## Registry state

There are two relevant surfaces:

1. Main platform Registry side-menu surface under `app/(shell)/registry`.
2. More complete iQube Registry cartridge/API layer under `app/api/registry` and `services/registry`.

Phase 2 uses the second path. Candidate agents are linked as `AigentQube` registry assets, with metadata preserving the Marketa candidate ID, classification, clean-revenue state, and source references.

## Reputation state

**RQH is an ICP canister and is the authoritative reputation source.** The Marketa
candidate reputation route binds a candidate to a partition ID (preferring the
iQube Registry asset ID), then reads in strict priority order:

1. **RQH canister** (`get_reputation_bucket(partitionId)` via `getActor` + `rqhIDL`,
   configured by `RQH_CANISTER_ID`) — authoritative.
2. Supabase `reputation_bucket` — cache/mirror only, consulted when the canister
   is unreachable or unconfigured. Never treated as source of truth.
3. Activation score — explicit non-authoritative fallback so operators can see
   that reputation is still pending rather than silently treating the agent as
   trusted.

The response's `source` field (`rqh_canister` | `reputation_bucket_mirror` |
`activation_score_fallback`) and `note` make the provenance visible to the UI.
Phase 2 does not mint or manage reputation independently.

## Outreach state

Existing outbound systems already enforce review-before-send patterns. Phase 2 follows that principle by creating only a draft and logging it to `marketa_activation_events`. It does not call a live send route.

## Passport Bureau state

The Polity Passport Bureau cartridge is **complete**. The Marketa handoff at
`POST /api/marketa/activation/candidates/:id/passport`:

- requires the iQube Registry handoff first (the Agent iQube anchors the passport);
- keys on the candidate's `agent_card_url` — the Bureau's participant identity anchor;
- if the Bureau already has an application for that agent card, syncs its public
  status (and the issued `ppp-*` passport id when approved) into the candidate's
  `passportIntegration`;
- otherwise prepares a draft participant application from public candidate fields
  and dry-runs it through the Bureau's own `validateParticipantApplication` —
  **without faking the four mandatory consents**, which only the participant or
  its operator may give at submission time;
- stores only public application/status/reference fields back into Marketa —
  never private Passport payloads or blakQube data.

Marketa recommends and prepares; the Bureau owns approval and issuance.

## Phase 2 endpoints

- `POST /api/marketa/activation/candidates/:id/registry`
- `GET|POST /api/marketa/activation/candidates/:id/reputation`
- `POST /api/marketa/activation/candidates/:id/outreach`
- `POST /api/marketa/activation/candidates/:id/passport`

## Operator workflow

1. Add/import candidate.
2. Score candidate.
3. Register/relink candidate to the iQube Registry.
4. Sync reputation against the RQH ICP canister (mirror/score fallbacks are labelled non-authoritative).
5. Draft outreach for human review.
6. Hand off to the Polity Passport Bureau: prepare the application draft, have the participant/operator complete consents and submit, then re-run the passport sync to track Bureau status through to issuance.
