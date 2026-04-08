# AgentiQ OS — Submission Guide

This guide covers the full submission flow: from a packaged contribution to a published Registry asset.

---

## Prerequisites

Before submitting:

1. You have a packaged contribution with a valid `manifest.json` — see `packaging-standards.md`
2. You have a `tenantId` and `personaId` (your identity in the platform)
3. You have installed the SDK: `npm install @agentiq/agentiq-sdk`

---

## Submission endpoint

```
POST /api/registry/intake
```

### Request body

```typescript
{
  tenantId: string;          // your tenant ID
  submittedBy: string;       // your persona ID
  sourceType:                // how your contribution is packaged
    | "github_repo"
    | "package_ref"
    | "mcp_endpoint"
    | "archive"
    | "manual_bundle"
    | "workflow_def";
  sourceUri?: string;        // URL if sourceType is github_repo or package_ref
  sourcePayload: {           // the manifest fields + source content
    name: string;
    version: string;
    category: string;
    // ... rest of manifest
  };
}
```

---

## Submit via SDK

```typescript
import { AgentIQClient, createUserMessage } from '@agentiq/agentiq-sdk';

const client = new AgentIQClient({
  apiUrl: process.env.AGENTIQ_API_URL!,
  defaultTenantId: process.env.AGENTIQ_TENANT_ID!,
  defaultPersonaId: process.env.AGENTIQ_PERSONA_ID!,
});

// Ask Aigent C to help with your submission
const guidance = await client.chat(
  [createUserMessage('I want to submit a ToolQube that wraps the OpenWeather API. How do I start?')],
  { agentId: 'aigent-c' }
);
```

---

## Submit via REST API

```bash
curl -X POST https://api.agentiq.ai/api/registry/intake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "tenantId": "your-tenant-id",
    "submittedBy": "your-persona-id",
    "sourceType": "manual_bundle",
    "sourcePayload": {
      "name": "weather-tool",
      "version": "1.0.0",
      "category": "ToolQube",
      "description": "Fetches current and forecast weather data from OpenWeather API",
      "license": "MIT",
      "entryPoint": "index.js",
      "policyClass": "network_limited",
      "wrapperStrategy": "http",
      "interface": {
        "inputs": [
          { "name": "city", "type": "string", "required": true },
          { "name": "units", "type": "string", "required": false }
        ],
        "outputs": [
          { "name": "temperature", "type": "number" },
          { "name": "description", "type": "string" }
        ]
      }
    }
  }'
```

### Response

```json
{
  "success": true,
  "intakeId": "intake_abc123",
  "status": "received",
  "currentStage": "intake.created"
}
```

Save the `intakeId`. You'll use it to track progress.

---

## Track your submission

### Query current stage

```bash
GET /api/registry/intake/:intakeId/status
```

```typescript
const status = await fetch(`/api/registry/intake/${intakeId}/status`)
  .then(r => r.json());

// {
//   intakeId: "intake_abc123",
//   status: "validating",
//   currentStage: "validation.running",
//   trustBand: null,  // assigned after validation
//   stageHistory: [...]
// }
```

---

## The pipeline stages

```
intake.created          Your submission was received
  ↓
source.fetching         The Factory is fetching your source
source.fetched
  ↓
source.classifying      The Factory is detecting your asset class
source.classified
  ↓
asset.packaging         Your contribution is being packaged into a registry-ready format
asset.packaged
  ↓
validation.starting     Validation pipeline is beginning
validation.running      Stages: license → dependencies → secrets → sandbox → interface → reproducibility
validation.completed
  ↓
trust.scoring           Trust band is being computed
trust.scored
  ↓
review.pending          Human or automated review (required for L3+)
  ↓
review.approved         ← publication proceeds
review.rejected         ← you will receive a rejection reason
  ↓
asset.published         ✓ Your contribution is now in the Registry
```

---

## Stage timing (approximate)

| Stage | Typical duration |
|-------|-----------------|
| intake.created → source.fetched | < 30 seconds |
| source.classified | < 1 minute |
| asset.packaged | < 2 minutes |
| validation.running | 2–10 minutes (depends on sandbox smoke) |
| trust.scored | < 1 minute |
| review.pending → approved | Minutes (automated) to hours (manual for L3+) |

---

## Handling failures

### Validation failure

If a stage fails, the intake reaches `ingestion.failed` status. Query the status to get the failure reason:

```typescript
const status = await fetch(`/api/registry/intake/${intakeId}/status`)
  .then(r => r.json());

console.log(status.failureReason);
// e.g. "secret_scan: found potential API key pattern at src/config.js:14"
```

Fix the issue in your bundle and submit a new intake. Each submission is independent.

### Common failure reasons

| Stage | Failure | Fix |
|-------|---------|-----|
| `license_check` | License file missing | Add `LICENSE` file matching `manifest.license` |
| `secret_scan` | Secret pattern found | Remove hardcoded keys; use env var references |
| `sandbox_smoke` | Entry point failed | Test locally; check path matches `manifest.entryPoint` |
| `interface_conformance` | Output doesn't match declared schema | Update `manifest.interface.outputs` to match actual output |
| `dependency_inventory` | Undeclared dependency | Add to `manifest.dependencies` |

---

## After publication

Once your contribution is at `asset.published`:

1. It appears in the Registry with its trust band
2. The `assetId` is returned in the status response — save this
3. Studio users can discover and compose it
4. You can reference it in WorkflowQube step definitions

### Check Registry visibility

```bash
GET /api/registry/supply?status=published&trustBand=L2_VERIFIED_COMMUNITY
```

---

## Re-submitting or updating

Each submission creates a new intake. To update a published asset:

1. Increment the `version` in your manifest (semver)
2. Submit a new intake
3. The Factory will process it as a new version
4. Previous versions remain available until explicitly deprecated

---

## Ask Aigent C

For help at any stage:

```typescript
const help = await client.chat(
  [createUserMessage(`My submission ${intakeId} failed at validation.running with reason: "secret_scan: found API key pattern". How do I fix it?`)],
  { agentId: 'aigent-c' }
);
```

---

## Summary

```
1. Package → manifest.json + source files
2. Submit → POST /api/registry/intake
3. Track → GET /api/registry/intake/:id/status
4. Fix failures → resubmit
5. Published → visible in Registry → composable in Studio
```
