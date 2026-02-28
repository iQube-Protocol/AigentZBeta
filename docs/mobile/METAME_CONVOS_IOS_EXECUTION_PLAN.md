# metaMe Runtime iOS Execution Plan (Convos/XMTP Substrate)

## Objective
Ship a native iOS/iPadOS metaMe Runtime app by using `xmtplabs/convos-ios` for transport/runtime infrastructure and replacing UI surfaces with metaMe Runtime mobile/tablet UI patterns.

## Scope
- Keep XMTP rails, conversation lifecycle, sync, and notifications from Convos.
- Keep metaMe Runtime as UX authority (header/menu/trust/shell actions/iQube rendering).
- Use QubeTalk + AA API as control plane and hydration layer.
- Introduce one canonical transport envelope: `metame.envelope.v1`.

## Architecture
1. `MetaMeRuntimeApp` (new iOS app target)
   - Runtime shell UI (mobile/tablet)
   - Runtime state machine (welcome -> post-welcome)
   - Device-aware rendering for content modules
2. `ConvosCore` (forked upstream core)
   - XMTP client/session/conversation/group streams
   - push + notification service extensions
3. `MetaMeMessagingBridge` (new)
   - Maps XMTP payloads <-> `metame.envelope.v1`
   - Maps QubeTalk thread/channel events <-> runtime intents
   - Handles iQube refs + payload fetch hooks
4. `AA API` + `QubeTalk`
   - AA API hydrates selectors/menu/trust/reliability + runtime inputs
   - QubeTalk coordinates agent/runtime/system events and execution traces

## Message Contract (Canonical)
Use `metame.envelope.v1` for all payload-bearing messages:
- `type`: `prompt | inference | iqube_ref | action | system`
- `intent`: `be | earn | play | make | share | wallet | task | reward | find | unknown`
- `thread`: channel/thread identifiers
- `sender`: agent/persona/XMTP DID mapping
- `payload`: text, iQube refs, action, inference
- `meta`: source, timestamp, trust/reliability, device, request/trace ids

This contract is now added in `packages/metame-contracts` and bridged in `clawhack-group-agents` XMTP adapter.

## Implementation Phases
### Phase 1: Contract + Bridge Foundation
- Added canonical envelope schema (`@metame/contracts`).
- Added bridge-level envelope utilities.
- XMTP adapter now:
  - accepts/forwards `metame.envelope.v1`
  - falls back to text when envelope absent
  - preserves envelope on inbound normalized events.

### Phase 2: iOS Fork and Target Setup
1. Fork `xmtplabs/convos-ios`.
2. Create app target `MetaMeRuntimeApp`.
3. Keep upstream Convos targets for upgrade diffing.
4. Add app config envs:
   - `AA_API_BASE_URL`
   - `QUBETALK_WS_URL`
   - `METAME_TENANT_ID`
   - `RUNTIME_DEFAULT_AGENT`

### Phase 3: Runtime UI Integration
1. Replace Convos primary views with Runtime shell:
   - top runtime header
   - trust/reliability indicators
   - menu + quick links + prompt bar
2. Embed XMTP thread views as a runtime module (not root shell).
3. Route shell actions into `MetaMeMessagingBridge`.

### Phase 4: iQube + QubeTalk Flows
1. iQube ref resolution path:
   - envelope payload -> iQube resolver -> runtime module render
2. QubeTalk channel sync:
   - send runtime/system/task events
   - consume orchestration responses
3. Add receipts/trace hooks for auditability.

### Phase 5: Push + Reliability Hardening
1. Keep Convos NotificationService; map pushes to runtime thread state.
2. Add offline queue + retry policy for envelope sends.
3. Add deterministic fallback behavior when QubeTalk/AA unavailable.

## Integration Rules
- Runtime UI authority: metaMe.
- Messaging transport authority: XMTP/Convos core.
- Orchestration/state authority: QubeTalk + AA API.
- No ad-hoc message formats outside `metame.envelope.v1`.

## Immediate Next Deliverables
1. Create `metame-convos-ios` fork workspace.
2. Add `MetaMeMessagingBridge` module in iOS codebase.
3. Implement envelope serializer/deserializer in Swift matching the schema in this repo.
4. Wire first E2E:
   - send prompt from runtime shell
   - receive response via XMTP group
   - render iQube ref card in runtime UI.

