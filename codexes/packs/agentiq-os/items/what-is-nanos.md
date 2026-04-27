# What Is nanOS?

nanOS is the low-level agent execution substrate beneath AgentiQ OS. It handles the raw mechanics of agent lifecycle — spawning, sandboxing, memory management, tool invocation, and inter-agent messaging — without imposing opinions about identity, policy, or experience design.

## AgentiQ OS vs nanOS

| Concern | nanOS | AgentiQ OS |
|---------|-------|-----------|
| Agent spawning and lifecycle | ✓ | — |
| Sandboxed execution | ✓ | — |
| Raw tool invocation | ✓ | — |
| Inter-agent messaging primitives | ✓ | — |
| Identity (Root DiD, PersonaQube) | — | ✓ |
| Policy enforcement (PolicyEnvelope) | — | ✓ |
| Trust bands and reputation | — | ✓ |
| Bounded delegation | — | ✓ |
| Registry (asset discovery) | — | ✓ |
| DVN receipts and audit trail | — | ✓ |
| Experience design (NBE, cartridges) | — | ✓ |
| Payment and x402 settlement | — | ✓ |

## Design Relationship

nanOS is **purposely unopinionated**. It provides the substrate. AgentiQ OS provides the semantics.

An Aigent running on AgentiQ OS uses nanOS for execution mechanics, but its identity, policy scope, capability declarations, and reputation all live at the AgentiQ OS layer.

```
AgentiQ OS: "This Aigent has Root DiD X, bounded persona Y, policy envelope Z, trust band L3"
     ↓
nanOS: "Spawn agent process, route tool calls, sandbox memory, enforce execution limits"
```

## What Developers Interact With

As an AgentiQ OS developer, you interact with the **AgentiQ OS SDK** — not nanOS directly. nanOS is an implementation detail of the runtime.

You declare what your agent can do (capabilities, policy bindings, trust band). nanOS handles how it runs.

## Open vs Proprietary

nanOS internals are not documented in this cartridge. Aigent C-OS will not speculate about nanOS implementation details — any such question should be directed to the nanOS documentation when it is published.

The boundary between AgentiQ OS and nanOS is stable and versioned. Breaking changes to nanOS that affect AgentiQ OS contracts will be announced in the Qriptopian feed and recorded in this codex.
