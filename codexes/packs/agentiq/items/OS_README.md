# AgentiQ OS

AgentiQ OS is the public upstream build layer of the AgentiQ ecosystem.

It is the entry point for builders, developers, and contributors who want to create tools, services, and workflows that enter the AgentiQ ecosystem and get delivered to users through the full production loop.

---

## What AgentiQ OS is

AgentiQ OS is not a traditional operating system. It is the open-contribution zone of the AgentiQ platform — the governed layer through which external builders package their work and submit it to the Registry Ingestion Factory, where it is validated, trust-scored, and made available as composable supply.

```
AgentiQ OS (you are here)
  ↓ package + submit
Registry Ingestion Factory
  ↓ validate + trust score
Registry (accepted supply)
  ↓ compose
Studio
  ↓ deliver
metaMe Runtime
  ↓ participate
KNYT and other cartridges
  ↓ signal
Future supply decisions
  ↑ feeds back
```

Everything you build through AgentiQ OS has the potential to be composed into experiences and delivered to users. Downstream participation signals — votes, likes, sparks, remixes — flow back to inform what gets built next.

---

## What you can build

AgentiQ OS accepts four contribution categories:

| Category | What it is |
|----------|-----------|
| **ToolQube** | A standalone tool or capability — API wrappers, AI models, data processors, analysis engines |
| **SkillQube** | A specialized skill or workflow step — classification, generation, summarization, transformation |
| **WorkflowQube** | A multi-step orchestration — a sequence of tools and skills with defined inputs and outputs |
| **ConnectorQube** | An integration or bridge — connecting external systems, data sources, or services |

See `contribution-categories.md` for full detail on each category, what qualifies, and what doesn't.

---

## How contributions flow

```
1. You package your contribution (SDK + packaging standards)
2. You submit it to the Registry Ingestion Factory
3. The Factory validates: license, dependencies, secrets, sandbox, interface, reproducibility
4. A trust band is assigned (L1 Experimental → L5 Core Sovereign)
5. Accepted supply enters the Registry
6. Registry supply is composable in Studio
7. Composed experiences are delivered in metaMe Runtime
8. Users interact with your contribution in cartridges like KNYT
9. Signal from those interactions can inform future supply decisions
```

---

## The trust band system

Every accepted contribution is assigned a trust band:

| Band | Label | What it means |
|------|-------|---------------|
| L1 | Experimental | Early/unverified; limited availability |
| L2 | Verified Community | Community-checked; broader availability |
| L3 | Production Candidate | Meets production bar; composable in Studio |
| L4 | Production Approved | Fully vetted; high-confidence production use |
| L5 | Core Sovereign | Platform-core quality; highest trust |

Most alpha contributions start at L1 or L2. Trust bands increase as contributions are verified, reproduced, and used.

---

## Your guide: Aigent C

Aigent C is the AgentiQ OS builder guide. When you have questions about what to build, how to package it, or how to submit it, Aigent C can help.

Aigent C is available in the AgentiQ Codex and through the `agentiq-sdk`:

```typescript
import { AgentIQClient } from '@agentiqos/agentiq-sdk';

const client = new AgentIQClient({ apiUrl: 'https://api.agentiq.ai' });
const response = await client.chat(
  [{ role: 'user', content: 'What should I build for AgentiQ OS?' }],
  { agentId: 'aigent-c' }
);
```

---

## Quick navigation

| Document | What it covers |
|----------|---------------|
| `quickstart.md` | Get started in 5 steps |
| `contribution-categories.md` | What to build and what qualifies |
| `packaging-standards.md` | How to package your contribution |
| `submission-guide.md` | How to submit to the Factory |

---

## SDK

The AgentiQ SDK gives you programmatic access to the platform:

```bash
npm install @agentiqos/agentiq-sdk
```

```typescript
import { AgentIQClient, createUserMessage } from '@agentiqos/agentiq-sdk';
```

Source: `packages/agentiq-sdk/`

---

## Alpha note

AgentiQ OS is in alpha. The contribution categories, validation pipeline, and trust band system are live but being refined. The best way to contribute during alpha is to pick a category, package your work following the standards, and submit. Feedback from early contributors directly shapes what AgentiQ OS becomes.
