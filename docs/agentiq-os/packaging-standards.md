# AgentiQ OS — Packaging Standards

Every contribution must be packaged before submission. This document defines the packaging requirements that determine whether your contribution passes validation and what trust band it can achieve.

These standards map directly to `types/registryIngestion.ts` — the canonical intake schema in the codebase.

---

## Required: manifest.json

Every contribution bundle must include a `manifest.json` at its root.

### Full manifest schema

```json
{
  "name": "string (required)",
  "version": "string (required, semver)",
  "category": "ToolQube | SkillQube | WorkflowQube | ConnectorQube (required)",
  "description": "string (required, ≥20 chars)",
  "sourceType": "github_repo | package_ref | mcp_endpoint | archive | manual_bundle | workflow_def (required)",
  "license": "string (required, SPDX identifier e.g. MIT, Apache-2.0)",
  "entryPoint": "string (required, relative path to main file)",
  "interface": {
    "inputs": [
      { "name": "string", "type": "string | number | boolean | object | array", "required": true }
    ],
    "outputs": [
      { "name": "string", "type": "string | number | boolean | object | array" }
    ]
  },
  "policyClass": "read_only | network_limited | sandbox_exec | browser_operator | secret_bound | human_approval_required (required)",
  "wrapperStrategy": "http | cli_container | mcp | browser | skill | workflow (required)",

  "author": "string (recommended)",
  "repository": "string (recommended, URL)",
  "homepage": "string (optional)",
  "keywords": ["string"] ,
  "dependencies": { "package": "version" },
  "devDependencies": { "package": "version" }
}
```

---

## Policy classes — choose the right one

The `policyClass` field declares how your contribution interacts with the outside world. Choose the most restrictive class that still lets your contribution function.

| Policy class | When to use |
|-------------|-------------|
| `read_only` | No side effects; reads data only; no outbound writes |
| `network_limited` | Makes outbound HTTP calls to a declared, constrained set of endpoints |
| `sandbox_exec` | Executes code; must run in an isolated sandbox container |
| `browser_operator` | Controls a browser; highest-risk; requires justification |
| `secret_bound` | Requires credentials; credentials are injected at invocation, never stored in bundle |
| `human_approval_required` | Has side effects that require a human to approve before execution |

**Important:** Declaring `read_only` when your contribution makes outbound writes will cause the secret scan and sandbox smoke stages to fail.

---

## Wrapper strategies — how your contribution is invoked

| Strategy | What it means |
|----------|--------------|
| `http` | Invoked via HTTP request; you expose a REST endpoint |
| `cli_container` | Invoked via CLI; runs in a container with stdin/stdout |
| `mcp` | Exposed as an MCP server |
| `browser` | Controls a browser via Playwright or similar |
| `skill` | Invoked as a discrete skill step in a workflow |
| `workflow` | Invoked as a multi-step workflow with defined state transitions |

---

## Validation stages

After submission, your contribution passes through six validation stages. Each stage can either pass, warn, or fail. Failures block publication. Warnings reduce the trust band ceiling.

| Stage | What is checked | Failure cause |
|-------|-----------------|---------------|
| `license_check` | SPDX license identifier, license file present | Missing or non-OSS license |
| `dependency_inventory` | All dependencies declared and resolvable | Undeclared dependencies, known vulnerable packages |
| `secret_scan` | No hardcoded secrets, API keys, or credentials | Found secret pattern in source |
| `sandbox_smoke` | Basic invocation in sandbox succeeds | Entry point fails, interface mismatch |
| `interface_conformance` | Declared inputs/outputs match runtime behavior | Output schema diverges from manifest |
| `reproducibility` | Two independent builds produce identical artifacts | Non-deterministic build |

---

## Trust band ceilings

Each validation stage can cap the maximum trust band your contribution can achieve:

| Outcome | Trust band cap |
|---------|---------------|
| All stages passed | Up to L5 (based on additional review) |
| Any stage warned | Capped at L2_VERIFIED_COMMUNITY |
| `sandbox_smoke` warned | Capped at L1_EXPERIMENTAL |
| `secret_scan` failed | Submission rejected |
| `license_check` failed | Submission rejected |

---

## Bundle layout

### For `manual_bundle` or `archive` source type:

```
my-tool/
  manifest.json          ← required
  index.js               ← entry point (matches manifest.entryPoint)
  README.md              ← recommended
  LICENSE                ← required (must match manifest.license)
  package.json           ← if Node.js
  requirements.txt       ← if Python
  src/
    ...
```

### For `github_repo` source type:

Your `manifest.json` must be at the repository root. The Factory will fetch, fingerprint, and validate.

### For `workflow_def` source type:

```json
{
  "name": "my-workflow",
  "version": "1.0.0",
  "category": "WorkflowQube",
  "steps": [
    {
      "id": "step-1",
      "assetId": "registry-asset-id",
      "inputs": { "query": "{{ workflow.input.query }}" }
    },
    {
      "id": "step-2",
      "assetId": "registry-asset-id-2",
      "inputs": { "text": "{{ steps.step-1.output.result }}" }
    }
  ],
  "inputs": [{ "name": "query", "type": "string", "required": true }],
  "outputs": [{ "name": "summary", "type": "string" }]
}
```

---

## Common packaging mistakes

**Mistake: No LICENSE file**
The `license_check` stage will fail. Include the full license text in `LICENSE` at the root.

**Mistake: Hardcoded API keys**
The `secret_scan` stage will reject your submission. Use environment variable references instead (`process.env.MY_KEY`) and declare `policyClass: "secret_bound"`.

**Mistake: `interface` fields don't match runtime**
The `interface_conformance` stage will warn. Test your entry point locally before submitting.

**Mistake: Wrong `policyClass`**
Declaring `read_only` when you make outbound HTTP calls causes `sandbox_smoke` to fail. Match the class to actual behavior.

**Mistake: No description or too-short description**
The Factory will warn. Write a meaningful description (≥20 characters) that explains what the tool does.

---

## Checking your manifest

Before submitting, you can validate your manifest structure locally using the Factory's schema:

```typescript
import type { IntakeQube } from '@agentiq/types'; // types/registryIngestion.ts

// The sourcePayload of your IntakeQube submission should include:
const payload = {
  name: 'my-tool',
  version: '1.0.0',
  category: 'ToolQube',
  // ... rest of manifest fields
};
```

---

## Next step

Once your contribution is packaged, submit it through the Factory. See `submission-guide.md`.
