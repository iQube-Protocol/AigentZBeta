# AgentiQ OS — Quickstart

> Full docs: `docs/agentiq-os/quickstart.md`

Get your first contribution into the AgentiQ ecosystem in 5 steps.

---

## Step 1 — Choose your category

| You have... | Category |
|-------------|----------|
| A tool or API integration | **ToolQube** |
| A specialized skill | **SkillQube** |
| A multi-step workflow | **WorkflowQube** |
| An external system integration | **ConnectorQube** |

## Step 2 — Install the SDK

```bash
npm install @agentiqos/agentiq-sdk
```

## Step 3 — Package with manifest.json

```json
{
  "name": "my-tool",
  "version": "1.0.0",
  "category": "ToolQube",
  "description": "What this tool does",
  "sourceType": "manual_bundle",
  "license": "MIT",
  "entryPoint": "index.js",
  "interface": {
    "inputs": [{ "name": "query", "type": "string", "required": true }],
    "outputs": [{ "name": "result", "type": "string" }]
  },
  "policyClass": "read_only",
  "wrapperStrategy": "http"
}
```

## Step 4 — Submit to the Factory

```bash
POST /api/registry/intake
{
  "tenantId": "your-tenant-id",
  "submittedBy": "your-persona-id",
  "sourceType": "manual_bundle",
  "sourcePayload": { ...manifest fields }
}
```

## Step 5 — Track your submission

```bash
GET /api/registry/intake/:intakeId/status
# Returns currentStage, trustBand, stageHistory
```

Pipeline: `intake.created → source.fetched → classified → packaged → validation.running → trust.scored → review → asset.published ✓`

---

## Ask Aigent C

```typescript
const client = new AgentIQClient({ apiUrl: '...' });
const help = await client.chat(
  [{ role: 'user', content: 'How do I submit a ToolQube?' }],
  { agentId: 'aigent-c' }
);
```
