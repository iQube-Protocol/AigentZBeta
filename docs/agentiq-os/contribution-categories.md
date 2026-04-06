# AgentiQ OS — Contribution Categories

AgentiQ OS accepts four contribution categories. Every submission must declare one of these categories in its manifest. The category determines how your contribution is classified, validated, and made available as composable supply.

---

## ToolQube

**What it is:** A standalone tool or capability that can be invoked with defined inputs and returns defined outputs.

**Good examples:**
- API wrapper (e.g. weather data, financial data, news feeds)
- AI model inference endpoint
- Data processor or transformer
- Analysis engine
- Search and retrieval tool
- Image or media processing tool
- Calculation or computation service

**What qualifies:**
- Has a clear, stable interface (defined inputs and outputs)
- Can be invoked predictably and independently
- Does one thing well
- Can be sandboxed

**What does not qualify:**
- Tools that require human-in-the-loop for every invocation
- Tools with unbounded network access that cannot be constrained
- Tools that require secret injection with no isolation boundary

**Typical trust band ceiling:** L3–L4 for well-documented, reproducible tools.

**Policy classes commonly applied:**
- `read_only` — tool reads data, no side effects
- `network_limited` — tool has constrained outbound network access
- `sandbox_exec` — tool executes in a sandbox container

---

## SkillQube

**What it is:** A specialized skill or capability designed as a step within a larger workflow or composition. Skills are building blocks.

**Good examples:**
- Text classification skill
- Sentiment analysis skill
- Named entity extraction
- Summarization skill
- Translation skill
- Code generation skill
- Document parsing skill
- Image captioning skill
- Moderation / safety check skill

**What qualifies:**
- Designed to be composed or chained with other skills
- Takes structured input, returns structured output
- Stateless or explicitly manages state
- Clear description of what the skill does and when to use it

**What does not qualify:**
- Skills with side effects that aren't declared
- Skills that make outbound calls not described in the manifest
- Multi-step orchestrations (submit as WorkflowQube instead)

**Typical trust band ceiling:** L2–L4 depending on provenance and validation quality.

**Policy classes commonly applied:**
- `read_only`
- `sandbox_exec`

---

## WorkflowQube

**What it is:** A multi-step orchestration that sequences tools and skills into a defined flow with explicit inputs, outputs, and handoffs.

**Good examples:**
- Research and summarization pipeline (search → extract → summarize)
- Document ingestion pipeline (parse → classify → index)
- Content moderation pipeline (extract → classify → flag → route)
- Analysis pipeline (gather → clean → analyze → report)
- Onboarding workflow (verify → provision → notify → confirm)

**What qualifies:**
- Explicitly defines each step and its inputs/outputs
- Uses only registered ToolQubes, SkillQubes, or other WorkflowQubes as steps
- Has a declared entry point and exit conditions
- Documents expected failures and fallback behavior

**What does not qualify:**
- Workflows that call unregistered or external services without declaration
- Workflows with unbounded execution paths
- Workflows that write to platform state without explicit governance approval

**Typical trust band ceiling:** L2–L3 for community workflows; L4–L5 for platform-integrated workflows.

**Policy classes commonly applied:**
- `sandbox_exec`
- `human_approval_required` (for workflows with side effects)

---

## ConnectorQube

**What it is:** An integration or bridge that connects an external system, data source, or service to the AgentiQ platform.

**Good examples:**
- Database connector (Postgres, Supabase, Mongo)
- CRM integration (Salesforce, HubSpot)
- Communication connector (Slack, Discord, email)
- Storage connector (S3, IPFS, Arweave)
- Blockchain connector (EVM, ICP, Solana)
- Content platform connector (RSS, webhooks, APIs)
- IoT or device bridge

**What qualifies:**
- Provides a stable, documented interface to an external system
- Declares all data it reads and writes
- Handles authentication without leaking credentials into the registry
- Supports connection health checks

**What does not qualify:**
- Connectors that require platform-level secrets embedded in the bundle
- Connectors to systems with no stable public API
- Connectors that do not declare their data access scope

**Typical trust band ceiling:** L2–L3 for community connectors; higher with formal verification.

**Policy classes commonly applied:**
- `secret_bound` (credentials injected at invocation, not stored in bundle)
- `network_limited`
- `human_approval_required` (for write connectors)

---

## Choosing the right category

| Question | Answer |
|----------|--------|
| Does it do one specific thing? | ToolQube |
| Is it designed to be a step inside a larger flow? | SkillQube |
| Does it sequence multiple steps? | WorkflowQube |
| Does it bridge to an external system? | ConnectorQube |

When in doubt, ask Aigent C:

```typescript
const response = await client.chat(
  [createUserMessage('I have a tool that calls the OpenAI API and summarizes text. What category is it?')],
  { agentId: 'aigent-c' }
);
```

---

## What is out of scope for alpha

The following are not accepted during alpha:

- Raw ML model weights without an inference wrapper
- Proprietary closed-source binaries without a verifiable interface
- Contributions that require modifying platform-core code
- Contributions with unbounded data exfiltration risk

---

## Source types

When submitting, you also declare how your contribution is packaged:

| Source type | What it means |
|-------------|--------------|
| `github_repo` | Public GitHub repository |
| `package_ref` | npm / PyPI / package registry reference |
| `mcp_endpoint` | MCP server endpoint |
| `archive` | Zip or tarball upload |
| `manual_bundle` | Manual file bundle with manifest |
| `workflow_def` | Workflow definition file (JSON/YAML) |
