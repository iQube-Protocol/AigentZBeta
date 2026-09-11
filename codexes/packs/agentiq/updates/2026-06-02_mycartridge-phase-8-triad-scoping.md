# myCartridge Phase 8 — Triad scoping (chat route + KB filter signature)

**Date:** 2026-06-02
**Status:** shipped — `/api/codex/chat` accepts `cartridgeSlug`, system prompt + KB lookup scope to it
**PRD:** `codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md` §16, §32 Phase 8, §33 row 8
**Predecessors:** Phase 4a (codex_configs columns), Phase 6 (wizard populates them), Phase 7 (manager edits them)

## Scope

When the chat client passes a `cartridgeSlug`, the chat copilot reframes itself as the cartridge owner's regent — drawing on the operator-authored purpose, the cartridge's available specialists, and (in v0.5) cartridge-scoped KB. MVP keeps `copilotSource: 'aigentMe'` per PRD §16 — no persona swap yet; the surface still posts as the visitor.

## Files added (1) + modified (2)

| File | Status | Change |
|---|---|---|
| `services/cartridge/getChatContext.ts` | NEW | `getCartridgeChatContext(slug)` reads `codex_configs` for the cartridge title, owner-authored purpose, available specialists, copilot prompt context, copilot source, and owner persona id. Returns null for legacy hand-curated cartridges (no Phase 4a fields). T1-safe projection — owner persona id is server-only. |
| `services/content/embeddingService.ts` | MODIFIED | `hybridSearch` signature extended with optional `options?: { cartridgeSlug?: string }`. v0.5 will wire the actual cartridge-scoped lookup; today the parameter is logged + the call falls back to domain-scoped semantic search, matching the PRD §17 "if cartridge KB is empty, copilot falls back to domain-scoped KB." |
| `app/api/codex/chat/route.ts` | MODIFIED | (a) New `UserContext.cartridgeContext` field. (b) Body destructure accepts `cartridgeSlug`. (c) Pre-KB lookup resolves the cartridge via `getCartridgeChatContext`. (d) `searchKnowledgeBase` signature widened to forward the slug. (e) `buildSystemPrompt` weaves a new "## Operating Cartridge" block carrying title / category / visibility / purpose / copilot prompt context / available specialists, telling the model to speak as the owner's regent and suggest handoffs only from the listed specialists. |

## How the chat client uses it

```ts
await personaFetch("/api/codex/chat", {
  method: "POST",
  body: JSON.stringify({
    message: "...",
    chatHistory: [...],
    persona: "aigent-me",
    cartridgeSlug: "knyt-wheel",   // ← Phase 8 addition
  }),
});
```

When `cartridgeSlug` is omitted, the route behaves exactly as before. When it's set but the slug doesn't resolve, the route silently falls back to non-cartridge-scoped behaviour (a `console.log` records the miss for diagnostics).

## System prompt block

```
## Operating Cartridge

You are operating inside the cartridge below as its copilot. Speak as the
cartridge owner's regent — frame your replies inside this cartridge's
purpose, refer to it by name when natural, and when a question is better
served by a specialist in the available list above, suggest a handoff
explicitly. Do not invent specialists that aren't listed.

- Cartridge: **<title>** (slug: <slug>)
- Category: <category>
- Visibility: <visibility>
- Owner's stated purpose: <purpose>
- Copilot prompt context: <smart_triad_config.copilot.promptContext>
- Available specialists for handoff: <comma-joined list>
```

The block is inserted between the `policyBlock` and the `metameContextBlock` so policy constraints (Guardian Mode, etc.) bind the cartridge framing rather than the other way around.

## Privacy / spine alignment

- `getCartridgeChatContext` reads `owner_persona_id` (T0) but propagates it ONLY to the server-side `CartridgeChatContext` return. `UserContext.cartridgeContext` (which feeds the system prompt) intentionally drops `ownerPersonaId` — it never reaches the LLM, never echoes to the browser, and never lands in any DVN receipt.
- The "specialists for handoff" list is T1-safe (slugs only — `aigent-c`, `marketa`, `kn0w1`, etc.).
- The system prompt instructs the model to suggest only listed specialists, mitigating the failure mode where the model invents a specialist that doesn't exist in the cartridge.

## What's intentionally NOT in Phase 8

- **Persona swap** — PRD §16 says "the aigentMe persona resolves to the cartridge owner (not the visitor) for MVP." The persona swap touches message attribution, DVN receipts, and rewards routing — best landed as a dedicated Phase 8b with operator review of the attribution model.
- **Cartridge-scoped KB filter** — the parameter threads cleanly through `hybridSearch`, but the actual filter implementation needs (a) `cartridge_kb_sources` table from PRD §26 (v0.5), (b) a `cartridge_slug` column on the embeddings table or chunk metadata, and (c) the ingest pipeline that populates it. Phase 8a is the contract; Phase 8b/v0.5 wires the filter.
- **`source: 'cartridge-copilot'` and `source: 'specialist'`** — typed in the v0.4 schema, accepted by the wizard, but unwired in MVP per PRD §16. The chat route currently treats every source as aigentMe.
- **Specialist routing via `specialistRouter.ts`** — already exists; wiring the cartridge's `availableSpecialists` into the router happens in v0.5 once the persona swap lands.

## Test posture

- Full TS typecheck: clean.
- Sibling spine tests: 42 pass, 1 pre-existing fail (logged `isDebugBypassEnabled` mismatch). Zero new regressions.
- No chat-route unit test added in Phase 8 — the route is 2255 lines of orchestration over providers (OpenAI / Anthropic / ChainGPT / Venice) and the existing test surface is light. A focused test would mock all providers + the embedding service + `getCartridgeChatContext`; this is best landed as a regression net once Phase 8b adds the persona swap (which changes the receipt-emission path).

## Operator smoke test (after deploy)

1. With the Phase 6 cartridge created and the Phase 7 manager open, edit:
   - **Purpose** (Identity panel) → "A creative universe centred on the Knights of the Round Table."
   - **Specialists** → `aigent-c, kn0w1`
2. Open the metaMe copilot drawer for any tab in that cartridge.
3. Ask: *"What should I focus on this week?"*
4. The reply should reference the cartridge by title and frame the answer inside the purpose. It should NOT suggest specialists outside the configured list.
5. Confirm in server logs:
   ```
   [CodexChat] cartridge=<slug> title="..." specialists=2 copilotSource=aigentMe
   [embeddingService] cartridgeSlug=<slug> requested; falling back to domain-scoped lookup
   ```

## What unlocks next

- **Phase 9 (wallet integration):** the cartridge's token whitelist (already manager-editable) drops into the `SmartWalletDrawer` mount; the wallet primitives (send/receive/request/reward) read from `smart_triad_config.wallet.primitives`.
- **Phase 10 (receipts + catalogue):** every chat turn inside a cartridge emits a DVN receipt with `cartridgeSlug` attribution, so the cartridge owner's Ledger view aggregates per-cartridge.
- **Phase 8b (persona swap + cartridge KB filter):** lands together since both require careful attribution review.
