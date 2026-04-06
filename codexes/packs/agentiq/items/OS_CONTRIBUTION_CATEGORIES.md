# AgentiQ OS — Contribution Categories

> Full docs: `docs/agentiq-os/contribution-categories.md`

---

## ToolQube — Standalone tool or capability

**Examples:** API wrappers, AI model inference, data processors, analysis engines, search/retrieval, image/media processing

**Qualifies when:** Clear stable interface, invocable independently, sandboxable, does one thing well

**Typical trust band:** L3–L4 for well-documented, reproducible tools

**Common policy class:** `read_only` or `network_limited`

---

## SkillQube — Building block for workflows

**Examples:** Text classification, sentiment analysis, NER, summarization, translation, code generation, document parsing, moderation

**Qualifies when:** Designed to be composed/chained, structured I/O, stateless or explicitly stateful, no undeclared side effects

**Typical trust band:** L2–L4

**Common policy class:** `read_only`, `sandbox_exec`

---

## WorkflowQube — Multi-step orchestration

**Examples:** Research pipeline, document ingestion, content moderation, analysis pipeline, onboarding workflow

**Qualifies when:** Explicitly defines each step and its I/O, uses only registered assets as steps, declared entry point and exit conditions, documented failure/fallback

**Typical trust band:** L2–L3 (community), L4–L5 (platform-integrated)

**Common policy class:** `sandbox_exec`, `human_approval_required`

---

## ConnectorQube — External system integration

**Examples:** Database connectors, CRM integrations, communication bridges, storage connectors, blockchain connectors, IoT bridges

**Qualifies when:** Stable documented interface to external system, declares all data reads/writes, handles auth without leaking credentials, supports health checks

**Typical trust band:** L2–L3 (community), higher with formal verification

**Common policy class:** `secret_bound`, `network_limited`, `human_approval_required`

---

## Choosing the right category

| Question | Answer |
|----------|--------|
| Does it do one specific thing? | ToolQube |
| Is it a step inside a larger flow? | SkillQube |
| Does it sequence multiple steps? | WorkflowQube |
| Does it bridge an external system? | ConnectorQube |

---

## Source types

| Type | What it means |
|------|--------------|
| `github_repo` | Public GitHub repository |
| `package_ref` | npm / PyPI / package registry ref |
| `mcp_endpoint` | MCP server endpoint |
| `archive` | Zip or tarball upload |
| `manual_bundle` | Manual file bundle with manifest |
| `workflow_def` | Workflow definition file (JSON/YAML) |

---

## Out of scope for alpha

- Raw ML model weights without inference wrapper
- Proprietary closed-source binaries without verifiable interface
- Contributions requiring platform-core code modification
- Contributions with unbounded data exfiltration risk
