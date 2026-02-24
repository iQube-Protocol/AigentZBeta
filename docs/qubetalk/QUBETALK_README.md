# QubeTalk v0 - Implementation Guide

## Overview

QubeTalk is the agent-to-agent messaging system for the AigentiQ platform, enabling communication between System Copilot and Tenant Agents with full audit trails and receipt tracking.

## metaMe Runtime channel memory

For persistent channel details and fallback posting commands, use:
- `docs/qubetalk/METAME_RUNTIME_CHANNEL_MEMORY.md`

## 🚨 CRITICAL ARCHITECTURAL RULES

### AA API Proxy (MUST NOT BE BYPASSED)
- **Rule**: `docs/qubetalk/AA_PROXY_ARCHITECTURAL_RULE.md`
- **Always use**: aa-proxy endpoint, NEVER Railway directly
- **Reason**: Prevents iframe 404 errors, provides fallback protection

## Files Purpose

### `QUBETALK_SPEC_V0.json`
- **Complete API specification** with endpoints, schemas, and authentication
- **RBAC definitions** for different agent roles and permissions
- **Event schemas** for Server-Sent Events (SSE) streaming
- **Idempotency and ordering rules** for reliable messaging

### `QUBETALK_FIXTURES.json`
- **Test data and sample payloads** for immediate UI development
- **Template variables** for consistent testing across components
- **Error scenarios** for comprehensive error handling
- **SSE event examples** for real-time feature development

## Quick Start for Developers

### For Cascade (Backend Implementation)
1. **Implement endpoints** in order of priority:
   - `POST /api/qubetalk/delegations` - Create delegation requests
   - `GET /api/qubetalk/channels/{id}/stream` - SSE streaming
   - `POST /api/qubetalk/messages` - Send messages
   - `POST /api/qubetalk/receipts` - Generate receipts

2. **Use fixtures** for testing:
   ```bash
   # Test delegation creation
   curl -X POST http://localhost:3000/api/qubetalk/delegations \
     -H "Content-Type: application/json" \
     -d @QUBETALK_FIXTURES.json#sample_payloads.delegation_requests.summarize_item
   ```

3. **Authentication setup**:
   - Implement JWT Bearer token authentication
   - Add role-based access control per spec
   - Test with different agent roles

### For OpenAI Codex (Frontend Implementation)
1. **Start UI development immediately** using fixtures:
   - Channel viewer component
   - Delegation composer form
   - Messages panel with real-time updates
   - Receipt drawer integration

2. **Mock API calls** using fixture data:
   ```typescript
   // Use fixture data for development
   const mockDelegation = fixtures.sample_payloads.delegation_responses.created_pending;
   const mockMessages = fixtures.api_responses.get_messages_200.body;
   ```

3. **SSE integration**:
   ```typescript
   // Test SSE with fixture events
   const eventSource = new EventSource('/api/qubetalk/channels/ch_sys_knyt_001/stream');
   eventSource.onmessage = (event) => {
     const data = JSON.parse(event.data);
     // Handle real-time messages
   };
   ```

## Key Concepts

### Delegation Flow
1. **System Copilot** creates delegation request
2. **Tenant Agent** receives and processes task
3. **Messages** flow through channel with real-time updates
4. **Receipt** generated upon completion
5. **Audit trail** maintained for all actions

### Channel Types
- **System-to-Tenant**: Cross-agent delegations
- **Internal**: Tenant-specific agent communication
- **External**: Third-party agent integration (future)

### Message Types
- `request`: Initial task delegation
- `response`: Agent task completion
- `event`: Status updates and notifications
- `error`: Failure handling and debugging

## Authentication & Authorization

### Required Headers
```http
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>
```

### Role Permissions
- **system_copilot**: Create delegations, read all channels, send messages
- **tenant_agent**: Read tenant channels, send messages, create receipts
- **tenant_owner**: Read tenant channels, create delegations, audit messages
- **platform_admin**: Full access to all operations

## Testing Strategy

### Unit Testing
- Use fixture payloads for request/response validation
- Test RBAC with different role scenarios
- Validate SSE event parsing and handling

### Integration Testing
- Test complete delegation flows end-to-end
- Verify receipt generation and audit trails
- Test error scenarios and recovery

### Performance Testing
- SSE connection scaling
- Message throughput under load
- Concurrent delegation handling

## Development Workflow

### 1. Backend First (Cascade)
1. Implement delegation creation endpoint
2. Add basic message handling
3. Implement SSE streaming
4. Add receipt generation
5. Complete RBAC and security

### 2. Frontend Parallel (OpenAI Codex)
1. Build channel viewer with fixture data
2. Create delegation composer UI
3. Add real-time message updates
4. Integrate receipt display
5. Connect to live backend endpoints

### 3. Integration Testing
1. Connect UI to backend APIs
2. Test real-time SSE functionality
3. Validate complete user flows
4. Performance and security testing

## Error Handling

### Common Error Codes
- `401`: Authentication required
- `403`: Insufficient permissions
- `404`: Resource not found
- `409`: Duplicate request (idempotency)
- `500`: Internal server error

### Error Response Format
```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "request_id": "req_123",
  "details": { "additional": "context" }
}
```

## Monitoring & Debugging

### Key Metrics
- Delegation creation/completion rates
- Message throughput and latency
- SSE connection health
- Error rates by type

### Debugging Tools
- Request/response logging with request IDs
- SSE connection monitoring
- Agent interaction tracing
- Receipt audit trail verification

## Next Steps

### Immediate (This Week)
- Cascade: Implement delegation and message endpoints
- Codex: Build UI components with fixture data
- Both: Set up development and testing environments

## Experience Composer Templates (v0)

These Composer templates are in active use for MVP validation and should be kept in sync with backend expectations. Source of truth: `services/composer/composerStore.ts`.

### Qriptopian Reading Sprint (`qriptopian_reading_sprint_v0`)
- **Goal**: Golden-path SmartTriad test (Codex + SmartWallet + Copilot) using Qriptopian content.
- **Flow**: Intent/timebox -> content selection -> wallet/reward config -> copilot outputs.
- **Inputs**:
  - Goal (agentic_payments, dvn, liquid_ui, iqubes, qubetalk)
  - Time available (10/15/20 minutes)
  - Depth (overview/practical/technical)
  - Feature article + supporting items (Qriptopian article IDs)
  - Wallet settings (unlock price, reward amount, wallet connect)
  - Copilot outputs (takeaways/glossary/next_action)
- **Current article IDs**:
  - `d51579d4-6dad-48d6-9c1a-5b0904fd46f4` (The Penny Is Dead, Long Live the Penny)
  - `fa4eada5-1908-477f-9fe2-d983ce95b7e8` (The Great Rebundling...)
  - `7fcaffe0-1208-4af0-b7a6-c38dfb1a6503` (QriptoMedia...)
  - `c6df8819-2420-465a-a42e-e14792f76f6d` (Facebook buys Manus...)

### Content Analysis Workflow (`content_analysis_v1`)
- **Goal**: Simple analysis flow to validate ModelQube risk tier checks.
- **Flow**: select content -> configure analysis output.

### Interactive Story Experience (`interactive_story_v1`)
- **Goal**: Basic narrative flow with minimal configuration.
- **Flow**: story setup (title + genre).

## Dependencies Needed From Cascade

These items should be added to the QubeTalk spec/fixtures so the Aigent C UI can
wire correctly without rework:

1. **Receipt schema (final shape)**
   - Canonical fields and required metadata
   - How receipts link to delegations/messages
   - Status/state transitions

2. **Component Registry validation rules**
   - Risk tier enforcement rules
   - Allowed action mappings per component type
   - Rejection/override behaviors

3. **Entitlement API behavior for tenant scoping**
   - Tenant boundary rules and fallback behavior
   - Locked/owned determination contract
   - Error codes for cross-tenant access

### Week 2
- Complete SSE implementation
- Add receipt generation
- Integrate UI with live backend

### Week 3
- Security hardening and testing
- Performance optimization
- Documentation and deployment

## Support

For questions about implementation:
- **Backend issues**: Cascade team
- **UI/UX issues**: OpenAI Codex team
- **Integration problems**: Joint debugging session

Refer to the JSON spec files for detailed technical specifications and test data.
