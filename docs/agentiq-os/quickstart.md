# AgentiQ OS — Quickstart

Get your first contribution into the AgentiQ ecosystem in 5 steps.

---

## Step 1 — Choose your contribution category

Pick what you're building:

| You have... | Category |
|-------------|----------|
| A tool or API integration | **ToolQube** |
| A specialized skill or capability | **SkillQube** |
| A multi-step orchestration or workflow | **WorkflowQube** |
| An integration with an external system | **ConnectorQube** |

Not sure? See `contribution-categories.md` for full definitions and examples.

---

## Step 2 — Install the SDK

```bash
npm install @agentiq/agentiq-sdk
```

The SDK gives you access to the platform API, agent personas, and utility functions.

```typescript
import { AgentIQClient, createUserMessage } from '@agentiq/agentiq-sdk';
```

---

## Step 3 — Package your contribution

Every contribution needs a `manifest.json` that describes it:

```json
{
  "name": "my-tool",
  "version": "1.0.0",
  "category": "ToolQube",
  "description": "A brief description of what this tool does",
  "sourceType": "manual_bundle",
  "license": "MIT",
  "entryPoint": "index.js",
  "interface": {
    "inputs": [
      { "name": "query", "type": "string", "required": true }
    ],
    "outputs": [
      { "name": "result", "type": "string" }
    ]
  },
  "policyClass": "read_only",
  "wrapperStrategy": "http",
  "author": "your-name",
  "repository": "https://github.com/your-org/your-tool"
}
```

See `packaging-standards.md` for the full manifest spec and validation requirements.

---

## Step 4 — Submit to the Registry Ingestion Factory

Use the SDK to submit:

```typescript
import { AgentIQClient } from '@agentiq/agentiq-sdk';

const client = new AgentIQClient({
  apiUrl: process.env.AGENTIQ_API_URL,
  defaultTenantId: process.env.AGENTIQ_TENANT_ID,
});

// Submit your contribution
const response = await client.chat(
  [createUserMessage('Submit my contribution bundle')],
  { agentId: 'aigent-c' }
);
```

Or submit directly via the API:

```bash
curl -X POST https://api.agentiq.ai/api/registry/intake \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "your-tenant-id",
    "submittedBy": "your-persona-id",
    "sourceType": "manual_bundle",
    "sourcePayload": { ... }
  }'
```

See `submission-guide.md` for the full submission flow.

---

## Step 5 — Track your submission

After submission, your contribution moves through the Factory pipeline:

```
intake.created
  → source.fetched
    → source.classified
      → asset.packaged
        → validation.running
          → trust.scored
            → review.pending
              → asset.published  ✓
```

Query status:

```typescript
const status = await fetch(
  `/api/registry/intake/${intakeId}/status`
).then(r => r.json());

console.log(status.currentStage);  // e.g. "validation.running"
console.log(status.trustBand);     // e.g. "L2_VERIFIED_COMMUNITY"
```

---

## What happens next

Once your contribution is published:

1. It appears in the Registry with its trust band
2. Studio can import it as composable supply
3. Composers can include it in experiences delivered through metaMe Runtime
4. Users encounter it in cartridges like KNYT
5. Signal from those interactions (votes, sparks, remixes) feeds back to you

---

## Ask Aigent C

If you get stuck, Aigent C is your guide:

```typescript
const response = await client.chat(
  [createUserMessage('My SkillQube submission failed validation — how do I fix it?')],
  { agentId: 'aigent-c' }
);
```

Or open the AgentiQ Codex → Ask Aigent C.

---

## Next steps

- `contribution-categories.md` — detailed breakdown of what qualifies in each category
- `packaging-standards.md` — full manifest spec, validation requirements, and policy classes
- `submission-guide.md` — complete submission flow with error handling
