# ClawHack Group Agents - Pre-Hackathon Setup

This workspace contains the infrastructure for integrating XMTP/Convos group chat with QubeTalk, OpenClaw, and the DVN receipt system for the ClawHack 2026 hackathon.

## Architecture Overview

```
Convos (XMTP) ↔ XMTP Adapter ↔ QubeTalk ↔ OpenClaw ↔ MCP Registry
                                    ↓
                              DVN Receipts
                                    ↓
                         A2UI/Surface Planner
                                    ↓
                            Discord Capsules
```

## Directory Structure

```
clawhack-group-agents/
├── bridge-core/           # Core adapter interface and QubeTalk channels
│   ├── adapter.ts         # BridgeAdapter base class
│   ├── qubetalkChannels.ts # Channel structure definitions
│   └── index.ts
├── adapters/
│   ├── xmtp/              # XMTP/Convos adapter (server mode)
│   └── discord/           # Discord adapter with A2UI integration
│       └── discordAdapter.ts
├── openclaw-wrapper/      # OpenClaw worker + MCP registry + policy enforcement
├── router/                # Intent routing rules (Aigent Z behavior)
├── schemas/
│   └── bridgeEvents.ts    # Canonical event schemas
└── scripts/               # Test and deployment scripts
```

## Key Components

### 1. Bridge Core (`bridge-core/`)

**BridgeAdapter Interface:**
- `start()` - Initialize connection to provider
- `stop()` - Cleanup connections
- `ingest()` - Async generator yielding InboundEvents
- `publish()` - Send OutboundEvent to provider
- `checkpoint()` - Save/restore state for resilience

**QubeTalk Channels:**
- `main` - Group agents coordination
- `bridge/inbound` - Normalized messages from external surfaces
- `bridge/outbound` - Messages to publish externally
- `agents/openclaw/requests` - OpenClaw job requests
- `agents/openclaw/responses` - OpenClaw job responses
- `dvn/receipts` - Audit trail receipts
- `artifacts/minted` - Artifact creation events

### 2. Event Schemas (`schemas/bridgeEvents.ts`)

**InboundEvent:** External chat → QubeTalk
- Provider metadata (XMTP, Discord, etc.)
- Thread identification and mapping
- Message content and attachments
- Routing hints (intent detection)
- Security classification

**OutboundEvent:** QubeTalk → External chat
- Target thread/channel
- Message content (text, attachments, buttons)
- Audit trail (request_id, artifacts)
- Security classification

**DVNReceipt:** Audit trail for all operations
- Receipt types: `bridge.inbound_received`, `bridge.outbound_posted`, `tool.invoked`, `artifact.minted`, `artifact.versioned`, `capsule.published`
- Payload includes hashes, tool IDs, artifact IDs, etc.

**ConversationQube:** Thread-scoped durable state
- Policy (allowed agents, tools, memory rules)
- Cursor (last processed message)
- Memory (rolling summary, key facts, open tasks)
- Artifacts (references to minted iQubes)

**DiscordCapsulePayload:** Routed through A2UI/Surface Planner
- Surface plan ID for deterministic visual design
- Level (pill, capsule, full)
- Discord-specific embeds and components
- Provenance tracking

### 3. Discord Adapter (`adapters/discord/`)

Features:
- Polls Discord channels for new messages (5s interval)
- Normalizes to InboundEvent with intent detection
- Routes capsule generation through A2UI/Surface Planner endpoint
- Emits DVN receipts for inbound/outbound
- Supports allowlist of channel IDs

Configuration:
```typescript
{
  credentials: { bot_token: string },
  allowlist: { channel_ids: string[] },
  surface_planner_endpoint?: string, // Optional A2UI integration
  environment: "hackathon" | "dev" | "prod",
  tenant_id: string
}
```

## Environment Variables

Create `.env` file:

```bash
# Tenant Configuration
QT_TENANT_ID=tnt_clawhack
QT_CHANNEL_MAIN=clawhack

# XMTP Configuration
XMTP_GROUP_ID_ALLOWLIST=group_abc123,group_xyz789
XMTP_DB_ENCRYPTION_KEY=your_encryption_key_here

# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_METAKNYTS_CHANNEL_ID=your_channel_id_here

# MCP Registry
MCP_REGISTRY_ENDPOINT=http://localhost:8080/registry
MCP_SHELF_ID=shelf_clawhack_2026_group_agents

# DVN Receipts
DVN_ENDPOINT=qt://tnt_clawhack/clawhack/dvn/receipts

# A2UI/Surface Planner Integration
SURFACE_PLANNER_ENDPOINT=http://localhost:3000/api/metame/runtime/plan
```

## QubeTalk Studio Integration

The DVN Receipts are now visible in the Composer Studio modal as a third tab:

1. **Agentic UI Design Parity** - DPR validation
2. **Surface Planning** - A2UI surface plan generation
3. **DVN Receipts** - Real-time audit trail (NEW)

The DVN Receipts tab shows:
- Timeline of all bridge, tool, artifact, and capsule events
- Filterable by receipt type
- Auto-refresh every 5 seconds
- Export to JSON
- Summary statistics

## Discord Capsule Flow

When OpenClaw generates artifacts and publishes to Discord:

1. **OutboundEvent** created with artifacts
2. **Discord Adapter** checks for `surface_planner_endpoint`
3. If configured, calls Surface Planner API:
   ```json
   {
     "capsule_type": "discord_pill",
     "content": { "text": "...", "artifacts": [...] },
     "device_context": { "type": "mobile" }
   }
   ```
4. Surface Planner returns **DiscordCapsulePayload** with deterministic design
5. Adapter posts to Discord with embeds/components
6. **DVN receipt** emitted: `capsule.published`

This ensures all Discord capsules have consistent visual design via A2UI.

## Running the System

### 1. Start QubeTalk Channels

```bash
# Initialize channels (run once)
npm run init-channels
```
This now provisions real channels through `/api/qubetalk/channels` and writes
`.data/channel-map.json` for runtime use.
Ensure the app/API server is running so `/api/qubetalk/*` endpoints are reachable.

### 2. Start Discord Adapter

```bash
npm run adapter:discord
```
The adapter now forwards inbound Discord messages into QubeTalk `bridge/inbound`
and consumes QubeTalk `bridge/outbound` messages for Discord publishing.

### 3. Start XMTP Adapter (when implemented)

```bash
npm run adapter:xmtp
```
The XMTP adapter now follows the same bidirectional bridge behavior as Discord.
Current implementation still runs in simulation mode by default (`XMTP_SIMULATION_MODE=true`);
wire the real XMTP SDK path before production XMTP rollout.

### 4. Start OpenClaw Worker

```bash
npm run openclaw:worker -- --text "Make a 21 Sats comic drop"
```

### 5. Start Group Runtime (Router + OpenClaw)

```bash
npm run runtime:group
```

### 6. Monitor DVN Receipts

Open Composer Studio → Analysis Tab → DVN Receipts

## Testing

### Manual Test: Discord Inbound

1. Post message in Discord channel: "Make a 21 Sats comic drop"
2. Check QubeTalk `bridge/inbound` topic for InboundEvent
3. Check DVN Receipts tab for `bridge.inbound_received`

### Manual Test: Discord Outbound

1. Trigger OpenClaw job that produces artifacts
2. Check QubeTalk `bridge/outbound` topic for OutboundEvent
3. Check Discord channel for capsule post
4. Check DVN Receipts tab for `capsule.published` and `bridge.outbound_posted`

## Next Steps (Pre-Hackathon)

- [x] Implement XMTP adapter (server mode)
- [x] Wire OpenClaw to MCP Registry allowlist
- [x] Create ConversationQube persistence layer
- [x] Test E2E flow: Convos → OpenClaw → Discord
- [x] Add Surface Planner integration for capsule generation
- [x] Add router intent detection rules
- [ ] Deploy to staging environment

## Hackathon Day

During the hackathon:
1. Add MoltComics agent to the group
2. Iterate on collaboration workflows
3. Test multi-agent coordination
4. Demo the full audit trail via DVN Receipts

## Support

For questions or issues, see:
- Bridge Core docs: `bridge-core/README.md` (to be created)
- XMTP adapter docs: `adapters/xmtp/README.md` (to be created)
- Discord adapter docs: `adapters/discord/README.md` (to be created)
