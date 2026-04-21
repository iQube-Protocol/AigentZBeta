# 34 — KNYT Runtime Context: System Prompt, Persona Auto-Switch & Journey Data

**Work package:** Post shell-message-handler wire-up  
**Status:** Backlog — start after cartridge overlay + KNYT context trigger are shipped

---

## What this work package delivers

When the user activates KNYT context in the runtime (via the KNYT quick action), Aigent C
should operate with full KNYT framing. Currently the stub sends a generic "I'd like to
explore my KNYT journey" prompt. This work package replaces the stub with the real stack.

---

## Three pieces

### 1. KNYT system prompt injection

Define what Aigent C's system prompt looks like when `runtimeContext === "knyt"`:

- Aigent C introduces itself as the user's KNYT copilot
- It is aware of the KNYT universe, characters, lore, story arc
- It draws from the KNYT cartridge's runtime KB (see `codex-configs.ts` for KB config)
- It knows the user's KNYT shelf (what they own), their current position in the arc, and their NBE

**API contract needed:** System prompt injection point in the runtime's LLM call. Currently
`handlePrompt` constructs a fixed prompt. We need to prepend a context block when
`runtimeContext` is set.

### 2. Persona auto-switch (with user notification)

When KNYT context is activated:
- Check if the user has a KNYT persona (query Supabase `personas` table where `domain = 'knyt'`)
- If found: auto-switch `activePersonaId` to the KNYT persona and notify the user
  - Message: "I've switched you to your KNYT persona — [persona name]. Let's explore your journey."
- If not found: prompt the user to create one, or offer a guest KNYT experience

**State surface:** `activePersonaId` is already in `MetaMeRuntimeClient` state and is sent
to the shell via `STATE_SYNC`. The persona switch sets this and triggers a re-render of
persona-dependent UI.

### 3. Journey data fetch

The KNYT cartridge's Order/runtime tab contains the user's journey state. When KNYT context
activates, fetch this data and inject it into the prompt context:

- KNYT shelf: episodes owned, editions, formats (still/motion/print)
- Current arc position: last read/watched episode
- NBE recommendations: next episode, next format upgrade, events
- Community status: collector tier, edition rarity

**API surface:** This data lives in the runtime tab of the KNYT cartridge. Define the fetch
contract — probably a new API route `GET /api/knyt/journey?personaId=<id>` that returns the
structured journey state.

---

## Dependency map

```
34 (this task)
  ← 33 (alpha program overview — defines persona model)
  ← journey-state-schema.md (in docs/agent-harness/)
  ← KNYT cartridge runtime tab data (KnytStoreTab + Order tab)
  ← codex KB config in codex-configs.ts
```

---

## File surfaces to touch

| File | Change |
|------|--------|
| `components/metame/MetaMeRuntimeClient.tsx` | System prompt injection when `runtimeContext === 'knyt'`; persona auto-switch on context change |
| `app/api/knyt/journey/route.ts` | New route — returns user's KNYT journey state |
| `app/triad/components/codex/tabs/KnytOrderTab.tsx` | Source of truth for journey data structure |
| `data/codex-configs.ts` | Ensure KNYT KB config is wired for runtime injection |
