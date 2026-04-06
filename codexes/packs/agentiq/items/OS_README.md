# AgentiQ OS

AgentiQ OS is the public upstream build layer of the AgentiQ ecosystem — the governed zone through which external builders package their work and submit it to the Registry Ingestion Factory.

> Full docs: `docs/agentiq-os/README.md`

---

## What AgentiQ OS is

AgentiQ OS is not a traditional operating system. It is the open-contribution zone of the AgentiQ platform. Everything you build through AgentiQ OS can be composed into experiences and delivered to users through the full production loop:

```
AgentiQ OS (you are here)
  ↓ package + submit
Registry Ingestion Factory
  ↓ validate + trust score
Registry (accepted supply)
  ↓ compose
Studio → metaMe Runtime → KNYT → signal → future supply
```

## What you can build

| Category | What it is |
|----------|-----------|
| **ToolQube** | Standalone tool or capability — API wrappers, models, processors |
| **SkillQube** | Specialized workflow step — classification, summarization, generation |
| **WorkflowQube** | Multi-step orchestration with defined inputs and outputs |
| **ConnectorQube** | Integration bridging an external system or service |

## The trust band system

| Band | Label | Meaning |
|------|-------|---------|
| L1 | Experimental | Early/unverified |
| L2 | Verified Community | Community-checked |
| L3 | Production Candidate | Meets production bar |
| L4 | Production Approved | Fully vetted |
| L5 | Core Sovereign | Platform-core quality |

## Your guide: Aigent C

Aigent C is the builder guide for AgentiQ OS. When you have questions about what to build, how to package it, or how to submit it, Aigent C can help.

## Navigation

| Doc | Covers |
|-----|--------|
| `OS_QUICKSTART.md` | Get started in 5 steps |
| `OS_CONTRIBUTION_CATEGORIES.md` | What to build and what qualifies |
| `OS_PACKAGING_STANDARDS.md` | Manifest spec, policy classes, validation |
| `OS_SUBMISSION_GUIDE.md` | Full submission flow |

## SDK

```bash
npm install @agentiq/agentiq-sdk
```

Source: `packages/agentiq-sdk/`

## Alpha note

AgentiQ OS is in alpha. Contribute, package, submit, and help shape what it becomes.
