# Factor's live Horizen registration + Journey 0 status (2026-09-06)

**Supersedes, in fact not in text, the "Factor is not registered" statement in
`2026-09-05_factor-vela-horizen-rehearsal-tranche.md`.** That statement was accurate at its own
cutoff. Shortly afterward, in this same environment, Factor was taken through the full ceremony that
report only rehearsed up to the signing boundary. This is the closeout, verified directly against
live Supabase (project `bsjhfvctmduxhohtllly`) — every claim below is either a direct read of
`activity_receipts`/`signing_requests`/`registry_assets.metadata`, or explicitly marked as not
independently verified.

## What actually happened, live-verified

**Factor is registered.** `activity_receipts` (`horizen_agent_registered`, id `5d458e9c-...`):
Aigent Factor registered in Horizen's ERC-8004 registry, base-sepolia, tx
`0xfc3eac87874d3a0647ee1c1ce48828cc1367afe824d2d736f8e432ce674af573`, **tokenId `9176`**, block
`46445602`, `confirmationSource: "on-chain-receipt"`, owner `0xF67299Ad3CB85f3A788CE38012C99Df7213E2734`
(Factor's own custodied wallet — the same address confirmed as Factor's real `agent_keys.evm_address`
in the prior tranche), registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`.

**The full ceremony ran, not a shortcut.** In order, from `signing_requests` and their matching
`activity_receipts`:
1. `sr_8fbaca29...` — operator's PRINCIPAL mandate approved 2026-09-05 21:50 (an earlier attempt).
2. `sr_21362d59...` — AGENT invocation prepared 21:50, but never resolved (`status: pending`,
   `resolved_at: null`) — this attempt stalled before signing.
3. `sr_149e721d...` — operator's PRINCIPAL mandate approved again 2026-09-06 01:51.
4. `sr_433e7bbb...` — AGENT invocation **executed** 01:51:32, `signer_address` = Factor's real
   wallet — this is the one that actually signed and broadcast.
5. Receipts follow in order within the same minute: `agent_registry_transaction_signed` →
   `horizen_registration_submitted` → `horizen_agent_registered` (tokenId 9176) →
   `horizen_registration_confirmed` → `agent_registry_binding_recorded`.

**Journey Spine milestones recorded on Factor's own AigentQube**
(`registry_assets.metadata.journey_resolutions['horizen-moneypenny-admission']`):
`milestones: ["REGISTERED","VERIFIED","CLAIMED","PASSPORT_ISSUED","DELEGATED"]`,
`highestMilestone: "DELEGATED"`, `canonicalStages: ["register","claim","orient","passport",
"activate","delegate","verify"]`. Also present: `operator:passport_is_issued` settled fact
(citizenStatus active, passportClass citizen), `aigent-factor:registry_activated` settled fact, and
`external_registry_bindings[0]` showing `pulse_enabled: true`, `pnl_disclosure_authorized: true`,
`pulse_authorization_ref: "horizen-pulse-auth-aigentqube-factor-9176-base-sepolia"`.

**Not independently re-verified here:** the operator's account additionally names Orient, Activate,
and Ratify as proven. Orient and Activate are consistent with `canonicalStages` above; a distinct
"Ratify" milestone or receipt was not found in this pass and is not asserted as confirmed — if it
refers to Aegis ratification, that is a separate domain (`aegis_assessments`) not queried here.

## What is still exactly as reported (unchanged by the registration)

**Vela remains the deterministic in-memory `VelaTestTransport`, not the real SDK-backed local
test-TEE.** Nothing in this session touched `services/vela/velaFactorProvider.ts` or
`factorConfidentialWorkload.ts` after the prior report — the caveat there still holds verbatim: no
Factor workload has run inside an actual local TEE process.

**The Horizen mandate rehearsal script** (`scripts/factor-horizen-mandate-rehearsal.mjs`) is now
provably redundant for Factor's own registration — that registration already happened by a route
other than this script (the live wallet UI ceremony, not this script, which was never run). The
script remains valuable as the safe, stop-before-signing rehearsal path for the **next** agent taken
through this ceremony, per Journey 0 closure item 9 below.

## DVN gap — confirmed live, matches the operator's report exactly

Grouping Factor's `activity_receipts` by `(action_type, dvn_status)` shows real gaps, not a single
flake:

| action_type | dvn_status | count |
|---|---|---|
| `agent_control_proven` | **failed** | 1 |
| `agent_registry_binding_recorded` | failed | 1 |
| `agent_registry_binding_recorded` | submitted | 1 |
| `agent_registry_transaction_signed` | **failed** | 1 |
| `horizen_agent_registered` | failed | 1 |
| `horizen_agent_registered` | submitted | 1 |
| `horizen_registration_confirmed` | failed | 1 |
| `horizen_registration_confirmed` | submitted | 1 |
| `horizen_registration_submitted` | **failed** | 1 |

The failed rows line up with the FIRST (stalled, 21:44-21:50) registration attempt; the submitted
rows line up with the SECOND (successful, 01:51) attempt. So the underlying registration itself
succeeded cleanly on retry, but the failed-attempt receipts (including `agent_control_proven`) are
still sitting as `dvn_failed` with no automatic retry or archival — exactly the operator's point:
evidence from a superseded attempt is neither closed out nor distinguished from the successful one at
the DVN layer.

## Next: Journey 0 closure (operator-directed, 2026-09-06)

The next tranche is **not** another Factor registration — it is closing the loose ends this live run
exposed, per the operator's own numbered list:

1. Advanced-user identity inheritance — an established aigentMe/metaMe persona should persist into
   FS and Horizen; Operate should not require reopening Operators through MoneyPenny.
2. Stale-state UI defect — completed stages should turn green immediately, not require leave/re-enter.
3. Close DVN states — including the failed `agent_control_proven` anchor and the other `dvn_failed`
   rows above (retry, or archive as superseded-attempt evidence, distinctly from the live one).
4. Preserve successful Passport/steward-approval evidence while archiving expired/failed attempts
   appropriately (not deleting, not conflating).
5. Make Passport states truthful and distinct: exported/submitted vs pending-steward-approval vs
   approved vs issued.
6. Complete independent Aegis assessment + explicit MoneyPenny admission (for Factor itself, not
   just the Bankr token-launch domain).
7. Generate Factor's first EARNED Standing event — registration/activation evidence establishes
   eligibility, but must not manufacture reputation on its own.
8. Run Factor's confidential workload through the actual available Vela SDK/local test-TEE path
   (not just `VelaTestTransport`), binding its attestation to the live Factor case.
9. Use Factor to guide a separate test agent through the same journey — the real proof Factor can
   authoritatively assist another agent, not just complete its own registration.
10. Only after 1-9: extract the generic DevOn bootstrap skill.

This tranche has not started implementation yet — this document is the reconciled starting point for
it, and the ten items above are tracked as open tasks.
