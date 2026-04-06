# AgentiQ OS — Submission Guide

> Full docs: `docs/agentiq-os/submission-guide.md`

---

## Submit endpoint

```
POST /api/registry/intake
```

```json
{
  "tenantId": "your-tenant-id",
  "submittedBy": "your-persona-id",
  "sourceType": "manual_bundle",
  "sourcePayload": {
    "name": "my-tool",
    "version": "1.0.0",
    "category": "ToolQube",
    "description": "Fetches weather data from OpenWeather API",
    "license": "MIT",
    "entryPoint": "index.js",
    "policyClass": "network_limited",
    "wrapperStrategy": "http",
    "interface": {
      "inputs": [{ "name": "city", "type": "string", "required": true }],
      "outputs": [{ "name": "temperature", "type": "number" }]
    }
  }
}
```

Response: `{ "success": true, "intakeId": "intake_abc123", "currentStage": "intake.created" }`

---

## Track status

```
GET /api/registry/intake/:intakeId/status
```

Returns: `currentStage`, `status`, `trustBand` (once scored), `stageHistory`, `failureReason` (if failed)

---

## Pipeline stages

```
intake.created → source.fetched → classified → packaged
  → validation.running → trust.scored → review.pending
    → review.approved → asset.published ✓
```

---

## Common failure fixes

| Stage | Failure | Fix |
|-------|---------|-----|
| `license_check` | License file missing | Add LICENSE file |
| `secret_scan` | Secret found | Remove keys; use env var refs |
| `sandbox_smoke` | Entry point failed | Test locally; check path |
| `interface_conformance` | Output mismatch | Update manifest interface |
| `dependency_inventory` | Undeclared dep | Add to manifest.dependencies |

---

## After publication

- Asset appears in Registry with trust band
- Composable in Studio
- Accessible to WorkflowQube step definitions
- Signal from usage feeds back through the ecosystem

---

## Update / re-submit

Increment `version` in manifest → submit new intake. Previous versions persist until deprecated.
