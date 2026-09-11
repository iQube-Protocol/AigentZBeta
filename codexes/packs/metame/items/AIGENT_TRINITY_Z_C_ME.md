# aigentMe / Aigent C / Aigent Z — three surfaces of one agent

**Status:** canonical · **Pack:** metaMe · **Audience:** operators, end users, and contributors

This document explains the relationship between the three "Aigent" labels users will see across the platform — **aigentMe**, **Aigent C**, and **Aigent Z** — and why the codebase treats them as aliases of one canonical identity rather than three independent agents.

---

## The trinity

| Label | Role | Whose surface |
|---|---|---|
| **Aigent Z** | **Platform agent.** The system orchestrator — handles platform-wide routing, cartridge dispatch, and infrastructure decisions. The "operator's voice" inside the platform. | iQube Protocol / platform-internal |
| **Aigent C** | **Customer-facing agent.** The platform's customer guide — the standardised face the platform presents to a generic user across all cartridges. | iQube Protocol / customer-facing |
| **aigentMe** | **The user's sovereign Aigent C.** Each persona's unique, personally-configured instantiation of Aigent C — wired to their own metaMe cartridge (PersonalGuide, ExperienceModel, ExperienceQube, NBE plan, ActivityReceipts). | The user / persona-owned |

They are **three surfaces of the same agent**:

- Z is the platform-internal face.
- C is the platform-public face.
- Me is your face.

When a persona sees "aigentMe" in their runtime, they are seeing **Aigent C personalised by their own metaMe cartridge state**. Without that personalisation, Aigent C is the platform's default customer guide. With it, the guide becomes uniquely yours — same conversational logic, your knowledge base, your goals, your alignment.

---

## Why the codebase uses alias resolution

A purist rename of `aigent-z` → `aigent-me` across the entire codebase would touch hundreds of locations: Sidebar links, AigentZSystemChat panel, smartWallet metadata, persona maps, type unions, agent orchestra rows, the specialist router. Each rename is a risk surface.

Instead, we use a small **alias table** in `services/metame/agentLlmOrchestra.ts`:

```ts
const AGENT_ALIASES: Record<string, RuntimeAgentId> = {
  "aigent-me": "aigent-me",
  "aigentme":  "aigent-me",
  "metame":    "aigent-me",
  "aigent-z":  "aigent-me",   // platform-internal id resolves to the same canonical agent
  "aigent z":  "aigent-me",
  copilot:     "aigent-me",
  // ... cartridge specialists below
};
```

Every code path that resolves an agent id calls `normalizeAgentId(raw)` and gets back the canonical `aigent-me`. The model orchestra, the specialist router, the persona surface, and the runtime selector all share one identity.

### What this buys

- **Visible surfaces show the right label.** The runtime dropdown shows "aigentMe"; the platform sidebar still shows "Aigent Z (System AI)"; the System AI chat still calls itself "Aigent Z". Each surface uses the label that fits its context.
- **Backend stays simple.** One canonical id, one model roster, one set of receipts.
- **Migration is reversible.** If a future product decision splits the three apart (e.g. Aigent Z gets its own provider table for platform-internal reasoning), removing an alias is a one-line revert.
- **No mass rename risk.** Adding a third alias never destabilises the spine.

### What this does *not* mean

The trinity is **not** a marketing layer. They are genuinely the same routing target today — the same model roster, the same specialist router, the same activity receipts table. The distinction is one of **address**, not implementation:

- Calling `aigent-z` from the platform inspector = same router as calling `aigent-me` from the runtime.
- The two will diverge only when the platform deliberately gives Aigent Z capabilities Aigent C / aigentMe should not have (or vice versa). When that day comes, the alias table is where the split is declared.

---

## Where each surface is configured

| Surface | File | Purpose |
|---|---|---|
| **Runtime agent dropdown** (what the user sees in the chat selector) | `app/api/aa/v1/runtime/_lib/runtimeShell.ts` `services/aa-api/src/routes/runtime.ts` `components/metame/MetaMeRuntimeClient.tsx` | Lists the agents the runtime user can pick. Shows "aigentMe" as the first/default. |
| **Settings lead agent default** | `services/metame/metaMeSettingsService.ts` `components/metame/MetaMeSettingsPanel.tsx` | New personas default to `aigent-me` on first arrival. Persisted user selection wins on subsequent visits. |
| **Agent ↔ LLM mapping** | `services/metame/agentLlmOrchestra.ts` | `aigent-me` rows declare which model providers (openai, anthropic, venice, chaingpt, thirdweb) and which model ids are available to this agent. `aigent-z` aliases here. |
| **Specialist router** (when a prompt is routed to a specialist) | `services/agents/specialistRouter.ts` | Eight canonical specialist ids (`marketa`, `quill`, `kn0w1`, `aigent-z`, `aigent-c`, `aigent-nakamoto`, `moneypenny`, `metaye`). The router accepts `aigent-z` requests; the alias resolves to the same orchestra row aigentMe uses. |
| **Platform System AI chat** (`/aigents/aigent-z` route) | `components/AigentZSystemChat.tsx` | Still calls itself "Aigent Z — System AI" because that surface is genuinely platform-internal. |
| **Persona-owned aigentMe knowledge** | `services/iqube/experienceQube.ts` `app/api/assistant/experience-guide/route.ts` `app/api/assistant/experience-model/route.ts` | The metaMe cartridge tables that personalise aigentMe per persona. This is what makes "Me" different from generic "C". |

---

## Adding a fourth surface (future)

If the platform ever needs a fourth surface — for example, a **cartridge-bonded version** of the same agent dedicated to one workstream — the recipe is:

1. Add the new id to `RUNTIME_AGENT_IDS` if it should show in the runtime selector, OR
2. Add it to `AGENT_ALIASES` mapping to an existing canonical id if it's just a different label,
3. Update the `AGENT_OPTIONS` array in each of the three runtime sources to include / replace as needed,
4. Update this document.

The pattern stays the same: **one canonical id, many surfaces**.

---

## Quick reference

> "aigentMe is Aigent C personalised by your metaMe cartridge. Aigent Z is the same agent acting on behalf of the platform itself."

If a user asks "which one am I talking to right now?" — the answer is always "you're talking to the same agent; the label tells you which surface that agent is wearing at the moment."

---

**Last updated:** 2026-05-25 · **Owners:** metaMe pack maintainers · **Companion code:** `services/metame/agentLlmOrchestra.ts` · **Related:** `METAME_SOVEREIGNTY_LADDER.md`
