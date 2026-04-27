# What Is AgentiQ OS?

AgentiQ OS is the open protocol layer that connects the Qripto trust infrastructure, the iQube data and identity model, and the AgentiQ agent runtime into a coherent developer platform.

It is not a blockchain. It is not a wallet. It is the **governed coordination layer** that makes agents, experiences, and assets interoperable across the ecosystem.

## The Two Layers

```
┌─────────────────────────────────────────┐
│  AgentiQ Platform + nanOS (proprietary) │  ← Cartridges, experiences, UX; production ops
├─────────────────────────────────────────┤
│         AgentiQ OS  ← you are here      │  ← Protocols, SDK, Runtime, Registry (open)
└─────────────────────────────────────────┘
```

**nanOS** is metaMe's proprietary production distribution of AgentiQ OS — a private operating cartridge for governing the live ecosystem (users, personas, Aigents, partners, commercial flows). It sits alongside the AgentiQ Platform, not beneath AgentiQ OS as a substrate.

## What AgentiQ OS Provides

### Protocol Contracts
Canonical interfaces that all agents, cartridges, and assets must satisfy:
- **iQube protocol** — data sovereignty, ownership, and disclosure classes
- **Qripto protocol** — trust, payments, and receipts (x402)
- **Aigent protocol** — agent registration, capability declaration, policy binding, Root DiD

### Runtime
The execution environment for cartridges and agent sessions:
- SmartTriad shell (copilot layer)
- Experience depth ladder (pill → capsule → mini_runtime → codex)
- NBE (Next Best Experience) routing
- OrchestrationEvent receipts

### Registry
The on-chain and off-chain asset ledger:
- Published AigentQubes, SkillQubes, ExperienceQubes
- Trust band classification (L1 Experimental → L5 Core Sovereign)
- DVN receipt anchoring

### SDK
The developer surface for building on AgentiQ OS:
- `@agentiq/sdk` — cartridge scaffolding, persona creation, delegation flows
- `@agentiq/smartwallet` — wallet binding and token balances
- `@agentiq/smarttriad` — copilot layer integration

## Who Is It For?

| Role | What They Build |
|------|----------------|
| Cartridge Developer | Experience modules for specific domains |
| Agent Builder | AigentQubes with declared capabilities and policy bindings |
| Skill Publisher | SkillQubes registered to the open Registry |
| Protocol Integrator | Systems that consume iQube, Qripto, or Aigent protocol contracts |

## Open Source Status

The AgentiQ OS layer — protocols, SDK, and public documentation — is open source under the iQube Protocol license. The AgentiQ Platform (cartridge renderer, engineering KB, admin tooling) remains private.

See the [Governance](governance.md) doc for the open/proprietary boundary policy.
