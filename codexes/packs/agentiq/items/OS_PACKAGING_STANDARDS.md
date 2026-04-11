# AgentiQ OS — Packaging Standards

> Full docs: `docs/agentiq-os/packaging-standards.md`  
> Schema source: `types/registryIngestion.ts` (`IntakeQube`)

---

## Required: manifest.json

```json
{
  "name": "string (required)",
  "version": "string (required, semver)",
  "category": "ToolQube | SkillQube | WorkflowQube | ConnectorQube",
  "description": "string (required, ≥20 chars)",
  "sourceType": "github_repo | package_ref | mcp_endpoint | archive | manual_bundle | workflow_def",
  "license": "string (required, SPDX — e.g. MIT, Apache-2.0)",
  "entryPoint": "string (required)",
  "interface": {
    "inputs": [{ "name": "string", "type": "string|number|boolean|object|array", "required": true }],
    "outputs": [{ "name": "string", "type": "string|number|boolean|object|array" }]
  },
  "policyClass": "read_only | network_limited | sandbox_exec | browser_operator | secret_bound | human_approval_required",
  "wrapperStrategy": "http | cli_container | mcp | browser | skill | workflow",
  "author": "string (recommended)",
  "repository": "string (recommended)"
}
```

---

## Policy classes

| Class | When to use |
|-------|------------|
| `read_only` | No side effects; reads only |
| `network_limited` | Constrained outbound HTTP |
| `sandbox_exec` | Executes code in isolated container |
| `browser_operator` | Controls a browser — highest risk |
| `secret_bound` | Requires credentials injected at invocation |
| `human_approval_required` | Side effects needing human sign-off |

---

## Validation stages

| Stage | What is checked | Failure cause |
|-------|-----------------|---------------|
| `license_check` | SPDX license, LICENSE file present | Missing or incompatible license |
| `dependency_inventory` | All deps declared and resolvable | Undeclared deps, known vulnerabilities |
| `secret_scan` | No hardcoded secrets or credentials | Found secret pattern in source |
| `sandbox_smoke` | Basic invocation succeeds | Entry point fails, interface mismatch |
| `interface_conformance` | Declared I/O matches runtime | Output diverges from manifest |
| `reproducibility` | Deterministic build | Non-deterministic build artifact |

---

## Trust band ceilings

| Outcome | Cap |
|---------|-----|
| All passed | Up to L5 |
| Any stage warned | L2 max |
| `sandbox_smoke` warned | L1 max |
| `secret_scan` failed | Rejected |
| `license_check` failed | Rejected |

---

## Bundle layout (manual_bundle)

```
my-tool/
  manifest.json       ← required
  index.js            ← entry point
  README.md           ← recommended
  LICENSE             ← required
  package.json        ← if Node.js
```

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| No LICENSE file | Add LICENSE matching manifest.license |
| Hardcoded API keys | Use env var references + `secret_bound` policyClass |
| Wrong policyClass | Match to actual behavior (e.g. don't declare `read_only` if making HTTP calls) |
| I/O doesn't match manifest | Test locally; update interface in manifest |
| Description too short | Write a meaningful description (≥20 chars) |
