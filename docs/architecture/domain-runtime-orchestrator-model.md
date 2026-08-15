# Domain Runtime Orchestrator Model

**Status: Canonical architecture model**
**Date:** 2026-08-15
**Applies to:** AgentiQ domain runtimes, specialist agents, model/tool routing, consequence observation

## 1. Canonical pattern

A consequential service domain is organized around a persistent constitutional orchestrator agent.

```text
Domain Runtime
  → Domain Orchestrator Agent
      → Specialist / Service Agents
          → Models / Tools / External Providers
              → Action / Artifact / Service
                  → DCIR consequence observation
                      → IDE evidence / learning
                          → Crystal governed memory
```

The orchestrator owns the user's relationship with the domain runtime. Specialist agents, models, tools, and providers remain replaceable capabilities inside that runtime.

## 2. Orchestrator responsibility

The domain orchestrator is responsible for:

- resolving user intent;
- applying constitutional constraints and authority;
- resolving the applicable invariant/risk field through IDE 2.0;
- selecting and coordinating specialist agents, models, tools, and providers;
- preserving continuity of the domain interaction;
- interpreting implementation/service results;
- routing remediation or escalation;
- observing consequence through DCIR;
- returning scoped evidence into the governed learning lifecycle.

The orchestrator is not identical to any one underlying model or provider.

## 3. Capability sovereignty

External providers and specialist agents supply capabilities. They do not become the constitutional identity or authority of the domain runtime.

**Rule:** provider/model substitution may change implementation capability; it must not redefine domain authority, invariant semantics, or consequence criteria.

## 4. DevOn — Software Development Runtime

**Runtime:** Software Development Runtime / Dev Command Center

**Orchestrator:** **DevOn**

DevOn is the persistent development-domain orchestrator and overseer. A user interacts with their contextualized DevOn across the development lifecycle.

DevOn may orchestrate:

- **Aigent Z** — deep platform / engineering intelligence;
- **Claude Code** — current implementation-execution agent/capability;
- architecture, security, governance, UI, testing, and other specialist agents;
- routed/open development models as they become available;
- GitHub, Terminal, Linear, DevTools, CI, Model Routes, and related tools.

DevOn therefore owns the development relationship; Aigent Z, Claude Code, models, and tools operate as capabilities within that relationship.

### Platform DevOn and user DevOn

Platform DevOn may use Aigent Z as the dominant/default engineering intelligence because the platform itself is the subject of development.

A user's DevOn is a contextualized instance of the common DevOn runtime, grounded in the user's authorized project/repository/development context and applicable invariants. It is not a private fork of the shared Crystal or a separate copy of Aigent Z.

## 5. MoneyPenny — Financial Services Runtime

**Runtime:** Financial Services Runtime

**Orchestrator:** **MoneyPenny**

MoneyPenny performs the equivalent domain-orchestrator role for financial services. It may coordinate payment, treasury, trading, risk, pricing, underwriting, commerce, wallet, and other specialist capabilities while preserving constitutional authority and consequence criteria.

Thus DevOn and MoneyPenny instantiate the same architectural pattern in different domains.

## 6. Generalization to other domains

The same pattern SHOULD be reused for other consequential domains, including research, media services, and search/knowledge services:

```text
Software Development → DevOn → development specialists
Financial Services    → MoneyPenny → financial specialists
Research              → research-domain orchestrator → research/judge/reviewer specialists
Media Services        → media-domain orchestrator → writing/design/video/publishing specialists
Search / Knowledge    → search-domain orchestrator → retrieval/research/synthesis specialists
```

The exact orchestrator identity for domains not yet canonically named remains unresolved until governed separately. Do not invent names merely to complete the table.

## 7. Shared constitutional substrate

Domain runtimes reuse the common constitutional substrate rather than implementing domain-specific substitutes:

- sovereign personhood / agent continuity where applicable;
- authority and bounded delegation;
- Common Ground;
- IDE 2.0;
- Crystal;
- DCIR — Dynamic Constitutional Interaction Runtime;
- receipts / DVN evidence;
- standing;
- capability/service adapters.

## 8. Scope and context

Shared causal memory flows downward through IDE resolution. Context-specific observations flow upward only as scoped evidence.

```text
shared constitutional + invariant memory
        ↓
IDE 2.0 resolution/discovery
        ↓
domain orchestrator
        ↓
authorized user/project/domain context
        ↓
specialist capability execution
        ↓
DCIR consequence observation
        ↓
scoped evidence
        ↓
governed abstraction / portability
        ↓
Crystal only when justified
```

A consequence observed in one user's project or one domain MUST NOT silently become universal causal truth.

## 9. UI consequence

The orchestrator remains the continuous user-facing interaction identity. Specialist agents should appear as invoked participants or execution events within that interaction rather than replacing the orchestrator's relationship with the user.

For DevOn this means, conceptually:

```text
User ↔ DevOn
        ├─ invokes Aigent Z
        ├─ invokes Claude Code
        ├─ invokes specialist reviewers
        └─ invokes tools / models
```

Detailed artifacts and project state may be inspected in the Development Command Center, while the development interaction remains continuous through DevOn.

## 10. Canonical architecture invariant

> Each consequential service domain has a persistent constitutional orchestrator responsible for intent, capability selection, authority, risk, evidence, and consequence; specialist agents, models, tools, and vendors remain replaceable capabilities within the domain runtime.

This is an architectural model. Individual runtime implementations MAY vary internally provided they preserve this role separation and constitutional authority boundary.
