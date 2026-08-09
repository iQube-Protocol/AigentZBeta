# Commit Brief: `2165d02` — Fix Horizen Pulse enable call to send the same 5 fields build used

| Field | Value |
|-------|-------|
| SHA | [`2165d02`](https://github.com/iQube-Protocol/AigentZBeta/commit/2165d02924ed2d2e7c610ca1e1a11b9452231b13) |
| Author | Claude |
| Date | 2026-08-05T02:54:52Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Horizen Pulse enable call to send the same 5 fields build used

Horizen confirmed (2026-08-04): enable_pulse_monitoring never reads the
message/signedMessage/signedPayload fields we send. It reconstructs the
signed plaintext server-side from (action, agentId, walletAddress,
issuedAt, chain) and verifies the signature against its own
reconstruction, so byte-identity between the build call's inputs and the
submit call's inputs is required.

Two concrete bugs against that contract:

1. submitHorizenTransparencyAuthorization sent none of the five
   reconstruction fields to enable_pulse_monitoring -- only message,
   signature variants, signerAddress, and network. Whatever Horizen
   defaulted agentId/walletAddress/chain/action/issuedAt to had no reason
   to match what build_pulse_auth_message used, which alone is sufficient
   to produce the observed 401 Invalid signature.

2. issuedAt was generated locally via now().toISOString() AFTER the build
   call already returned its message -- independent of whatever timestamp
   the build tool actually embedded in the signed plaintext. Any clock
   skew between Horizen's stamp and this process's clock silently breaks
   the reconstruction with no code-level symptom.

Fixes both: prepareHorizenTransparencyAuthorization now parses the
partner's own returned message for its "Issued At:" line and uses that as
authoritative, falling back to the local clock only when the template
doesn't match (logged loudly via [HORIZEN ESCALATION] when it happens).
The five fields used to build the message are captured once as
PulseCeremonyArgs and threaded unchanged through prepare -> sign ->
submit -- never re-derived. submitHorizenTransparencyAuthorization now
sends all five to enable_pulse_monitoring and refuses locally with
PULSE_ARGUMENT_DRIFT (before calling Horizen) if any of them is missing
or if walletAddress was re-cased after the build step.

Also adds parsePulseAuthMessage and diffPulseCeremonyArgs as reusable
instrumentation, and a [HORIZEN ESCALATION] log at submission failure
carrying the partner's reason text -- the artifact John asked for.

28 new/updated assertions in tests/horizen-authorization-client.test.ts;
all 328 horizen-*.test.ts tests pass; tsc --noEmit clean on this file.
```

## Body

Horizen confirmed (2026-08-04): enable_pulse_monitoring never reads the
message/signedMessage/signedPayload fields we send. It reconstructs the
signed plaintext server-side from (action, agentId, walletAddress,
issuedAt, chain) and verifies the signature against its own
reconstruction, so byte-identity between the build call's inputs and the
submit call's inputs is required.

Two concrete bugs against that contract:

1. submitHorizenTransparencyAuthorization sent none of the five
   reconstruction fields to enable_pulse_monitoring -- only message,
   signature variants, signerAddress, and network. Whatever Horizen
   defaulted agentId/walletAddress/chain/action/issuedAt to had no reason
   to match what build_pulse_auth_message used, which alone is sufficient
   to produce the observed 401 Invalid signature.

2. issuedAt was generated locally via now().toISOString() AFTER the build
   call already returned its message -- independent of whatever timestamp
   the build tool actually embedded in the signed plaintext. Any clock
   skew between Horizen's stamp and this process's clock silently breaks
   the reconstruction with no code-level symptom.

Fixes both: prepareHorizenTransparencyAuthorization now parses the
partner's own returned message for its "Issued At:" line and uses that as
authoritative, falling back to the local clock only when the template
doesn't match (logged loudly via [HORIZEN ESCALATION] when it happens).
The five fields used to build the message are captured once as
PulseCeremonyArgs and threaded unchanged through prepare -> sign ->
submit -- never re-derived. submitHorizenTransparencyAuthorization now
sends all five to enable_pulse_monitoring and refuses locally with
PULSE_ARGUMENT_DRIFT (before calling Horizen) if any of them is missing
or if walletAddress was re-cased after the build step.

Also adds parsePulseAuthMessage and diffPulseCeremonyArgs as reusable
instrumentation, and a [HORIZEN ESCALATION] log at submission failure
carrying the partner's reason text -- the artifact John asked for.

28 new/updated assertions in tests/horizen-authorization-client.test.ts;
all 328 horizen-*.test.ts tests pass; tsc --noEmit clean on this file.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/horizen/authorizationClient.ts` |
| Modified | `tests/horizen-authorization-client.test.ts` |

## Stats

 2 files changed, 414 insertions(+), 8 deletions(-)
