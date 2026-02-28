# QubeTalk Studio Access for ClawHack Channels

## Direct Studio Link

To view the ClawHack Group Agents channels in QubeTalk Studio:

**URL:** `http://localhost:3000/studio/qubetalk?tenant_id=tnt_clawhack`

Or manually set the tenant ID in the Studio UI to: `tnt_clawhack`

## Available Channels

Once you set the tenant ID, you'll see these 8 channels:

1. 🏠 **Group Agents Main** (`ch_1772238106455_rcq1w8ijg`)
   - Main coordination channel for all agents

2. 📥 **Bridge Inbound** (`ch_1772238111665_bnhikd0kj`)
   - External messages from XMTP/Discord coming in

3. 📤 **Bridge Outbound** (`ch_1772238115070_ypwc3b78u`)
   - Messages going out to external surfaces

4. 🤖 **OpenClaw Requests** (`ch_1772238118412_jhrl87v4d`)
   - Job requests to OpenClaw agent

5. ✅ **OpenClaw Responses** (`ch_1772238120914_7un90dpk7`)
   - Job results from OpenClaw

6. 📋 **DVN Receipts** (`ch_1772238122946_lqgxsgf0v`)
   - Audit trail receipts for all operations

7. 📦 **Artifacts Minted** (`ch_1772238125650_n1n84l3od`)
   - Artifact creation events

8. 🧭 **Router Coordination** (`ch_1772238129323_ed9okx6p4`)
   - Intent routing decisions

## Testing the Flow

### Post a Test Message to Bridge Inbound

```bash
curl -X POST http://localhost:3000/api/qubetalk/channels/ch_1772238111665_bnhikd0kj/messages \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tnt_clawhack",
    "participants": ["external"],
    "payload": {
      "schema": "metame.bridge.inbound.v0",
      "tenant_id": "tnt_clawhack",
      "provider": {"name": "discord", "environment": "hackathon"},
      "thread": {
        "provider_thread_id": "886793716273119252",
        "thread_key": "discord_metaknyts",
        "qt_thread_id": "qt://tnt_clawhack/threads/discord/886793716273119252"
      },
      "message": {
        "provider_message_id": "msg_test_'$(date +%s)'",
        "sent_ts": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "sender": {
          "provider_user_id": "test_user_123",
          "display_name": "Test User"
        },
        "content": {
          "type": "text",
          "text": "Make a 21 Sats comic drop"
        }
      },
      "routing": {
        "target_agent": "router",
        "intent_hint": "create_drop"
      },
      "security": {
        "data_classification": "internal",
        "receipt_required": true,
        "redaction_required": false
      }
    }
  }'
```

Then watch the message flow through the channels in Studio!

## Channel Map Location

The channel ID mapping is stored at:
```
clawhack-group-agents/.data/channel-map.json
```
