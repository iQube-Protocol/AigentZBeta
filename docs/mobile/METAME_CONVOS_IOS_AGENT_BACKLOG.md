# metaMe Runtime x Convos iOS Agent Backlog

## Backlog Intent
Implementation-ready backlog split across Codex/Cascade/Lovable/Aigent Z to execute the Convos iOS adoption without regressing existing runtime behavior.

## Track A: Contracts + Bridge (Codex)
1. Implement canonical envelope contract and export (`metame.envelope.v1`).
Status: Done in this repo.
Acceptance:
- Schema validates in TypeScript.
- Can parse unknown payloads safely.

2. Add bridge helpers for envelope-to-transport mapping.
Status: Done in this repo.
Acceptance:
- XMTP adapter can ingest envelope payloads.
- Outbound event can emit envelope payload or text fallback.

3. Add conformance fixtures.
Status: Pending.
Acceptance:
- Fixtures for `prompt`, `action`, `iqube_ref`, `inference`.
- Negative fixtures for malformed payloads.

## Track B: XMTP Runtime Bridge (Cascade)
1. Extend routing service to prioritize envelope intent over text heuristics.
Status: Pending.
Acceptance:
- `routing.intent_hint` uses envelope intent when present.
- Fallback to heuristics when absent.

2. Add E2E script: QubeTalk -> XMTP -> QubeTalk roundtrip.
Status: Pending.
Acceptance:
- Message id correlation via request/trace ids.
- Receipt emitted on inbound/outbound.

3. Harden production mode checks.
Status: Pending.
Acceptance:
- Reject malformed envelopes in prod.
- Attach normalized error receipts.

## Track C: iOS Runtime UI (Lovable + iOS team)
1. Fork Convos iOS and create `MetaMeRuntimeApp` target.
Status: Pending.
Acceptance:
- Builds on iPhone + iPad simulators.
- Existing Convos target still builds.

2. Replace root view with runtime shell primitives (header/menu/prompt/trust).
Status: Pending.
Acceptance:
- Mobile/tablet runtime shell parity.
- Dynamic device-class behavior.

3. Integrate `MetaMeMessagingBridge` in app state.
Status: Pending.
Acceptance:
- Prompt send -> envelope emit.
- Envelope receive -> runtime inference render.

## Track D: API + Control Plane (Aigent Z)
1. Publish iOS-specific shell hydration profile in AA API.
Status: Pending.
Acceptance:
- `/runtime/shell-config` supports ios/mobile/tablet explicit profile fields.

2. QubeTalk channel policy for iOS runtime workers.
Status: Pending.
Acceptance:
- channel + thread + permission sets for runtime app actors.

3. iQube resolver service for runtime mobile payloads.
Status: Pending.
Acceptance:
- envelope iQube refs resolve with trust-policy checks.

## Phase Gate Checklist
### Gate 1 (Bridge Ready)
- Envelope contract merged.
- XMTP adapter handles envelope + fallback.
- No regressions in existing clawhack bridge runtime.

### Gate 2 (iOS Target Ready)
- Convos fork builds with new target.
- Runtime shell replaces default Convos UI in new target.

### Gate 3 (End-to-End)
- Prompt from runtime app reaches XMTP group.
- Agent response returns as envelope.
- iQube ref renders as runtime card.

### Gate 4 (Pilot)
- Push notifications routed to correct runtime thread.
- Failure modes tested (AA down, QubeTalk down, XMTP down).

