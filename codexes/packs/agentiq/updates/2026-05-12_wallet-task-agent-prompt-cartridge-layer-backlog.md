# Backlog — Wallet Task → Agent Prompt + Cartridge-as-Layer

**Date filed:** 2026-05-12
**Workstream:** Wallet task chip UX hardening (closes the broken-journey class of bugs end-to-end)
**Severity:** medium-high (UX gap; user has to reset the app to recover)
**Discovered by:** Operator review 2026-05-12 after the Wave 1 returnTo fix
**Status:** Wave 1 (returnTo) shipped this session; Wave 2 design captured here for a follow-up workstream

---

## The vision (operator's spec, verbatim)

> When the KNYT cartridge is launched from the Wallet (both the cartridge-embedded one and layered drawer one), it is launched without any background inference, so when that cartridge is then closed it leaves a blank screen. Furthermore this blank screen seems to be above the wallet drawer on the z axis and/or replaces the home or previously active screen so the journey is broken and the only way back in is to reset the whole app — which is sub-optimal.
>
> I think the way to resolve this is to send a dual message at the point of launching the cartridge that:
> 1. Sends a prompt for inference based on the link clicked — e.g. *"What is the Bring a Knight task and how does it work?"* or *"What are community contributions?"*
> 2. Launches the cartridge as a layer on top of this inferred output as it does with the metaMe Aigent Me tab.
>
> That way when the launched cartridge is closed there is an inferred output behind it with follow-on actions etc., enabling the user to stay in the journey and preventing a break.
>
> We should also make the inference go to the agent that relates to the task in question — so in this case it will be the KNYT Guide / Kn0w1 / KNYT Cartridge copilot agent. But if in the future there are rewards that relate to the Qriptopian or metaMe's Aigent Me, then the prompt should be sent to that agent and the inferred content screen should come from the correlating agent.

---

## Wave 1 (shipped this commit) — interim mitigation

The wallet's `navigateToKnytTab` now captures the user's current URL as a `returnTo` query param and appends it to `buildCodexUrl(...)`. `CodexPanelDynamic`'s `handleCloseLayer` forwards `returnTo` to `/triad/embed/codex-closed`, which reads it and `window.location.replace()`s back to the prior URL.

Three fallback layers in `/triad/embed/codex-closed` (best to worst):
1. `?returnTo=<url>` query param — explicit caller intent
2. `document.referrer` (same-origin only) — browser-provided
3. `window.history.back()` — last-resort

If all three fail, the route renders a minimal "Cartridge closed → Home / KNYT Codex" UI so the user is never trapped on a true blank screen.

**Caveat:** Wave 1 returns the user to the *pre-cartridge URL*, which is wherever the wallet drawer was launched from. The user gets back into the flow, but there's no agent-driven inference output enriching the journey. Wave 2 closes that gap.

---

## Wave 2 — full operator-spec implementation

### Three architectural pieces

**1. Agent-routing table per task family**

Each KNYT task family maps to a specialist agent + a templated prompt:

| Task family | Specialist | Prompt template |
|---|---|---|
| `knyt:bring-a-knight` | `kn0w1` (KNYT Guide) | "What is the Bring-a-Knight task and how does it work? How do I earn KNYT through referrals?" |
| `knyt:knight-of-attention` | `kn0w1` | "What is the Knight-of-Attention task? How do episode completions + weekly streaks earn rewards?" |
| `knyt:herald-of-the-order` | `kn0w1` | "What is the Herald-of-the-Order task? How does share-attribution unlock click/signup/conversion rewards?" |
| `knyt:living-canon-vote` | `kn0w1` | "What are open Living Canon elections and how do I vote? What's at stake?" |
| `knyt:living-canon-contribute` | `kn0w1` | "What are community contributions in the Living Canon? How does PoKW scoring work?" |
| `knyt:living-canon-dispatch` | `kn0w1` | "What are Correspondent dispatches in the Living Canon? How do I file one and what role does it serve?" |
| *(future)* Qriptopian tasks | `quill` | "What is the X task in the Qriptopian cartridge?" |
| *(future)* metaMe Aigent Me tasks | `aigent-c` | "What is the X NBE / journey step in metaMe?" |

The table lives in a single config file (`config/walletTaskAgentRouting.ts`) so future cartridges plug in declaratively.

**2. Pre-launch chat injection**

When a wallet task chip is clicked:
1. Resolve `(specialistId, prompt)` from the routing table.
2. POST to `/api/assistant/ask-agent` with `{ specialistId, prompt }` — same endpoint Aigent Me's "Ask specialist" flow uses (per `app/api/assistant/ask-agent/route.ts`).
3. The response surfaces inline in the chat panel of the specialist's owning surface (Aigent Me tab for `aigent-c`, KNYT Codex Co-Pilot for `kn0w1`, etc.).
4. The user may also be navigated to the specialist's tab if they aren't already viewing it — TBD design call.

**Open question:** the existing `/api/assistant/ask-agent` returns a synchronous SpecialistResponse. We need the response to actually appear in a chat UI the user can see. Two paths:
- **Mount the chat UI server-side**: e.g. force-open the codex copilot drawer pinned to the agent's chat surface, inject the prompt + render the response.
- **Use streaming via Server-Sent Events**: existing copilot infrastructure already does this; reuse.

The first path is simpler for alpha; the second is the long-term correct answer.

**3. Cartridge-as-layer mount**

Replace the wallet's `window.location.href = buildCodexUrl(...)` URL navigation with a layered React component mount. This mirrors the metaMe Aigent Me pattern that already works correctly.

A new `<CartridgeLayer>` wrapper (forward-declared in the CartridgePresenceRegistry spec doc) lives at `app/components/cartridge/CartridgeLayer.tsx`:

```tsx
function CartridgeLayer({ cartridgeId, initialTab, initialSubTab, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md">
      <CartridgeRenderer
        cartridgeId={cartridgeId}
        initialTab={initialTab}
        initialSubTab={initialSubTab}
        onClose={onDismiss}  // ← passes through to CodexPanelDynamic, which makes the X work
        mode="layer"
      />
    </div>
  );
}
```

Mounting the layer doesn't navigate the iframe — it stacks the cartridge UI on top of the current page. When `onDismiss` fires, the layer unmounts and the user sees whatever was beneath it (the agent chat from step 2).

`CartridgeRenderer` is a thin switch that maps `cartridgeId → top-level component` and forwards `onClose` so `useCartridgePresence` picks it up. The wallet's `openTask` mounts a `CartridgeLayer` instead of redirecting.

### Sequence diagram

```
User clicks "Vote on open elections" chip in wallet
        │
        ▼
walletTaskAgentRouting.resolve('knyt:living-canon-vote')
        │
        ▼
{ specialistId: 'kn0w1',
  prompt: "What are open Living Canon elections..." }
        │
        ├──► POST /api/assistant/ask-agent  ──► chat panel mounts with response
        │
        └──► mount <CartridgeLayer cartridgeId='knyt-codex'
                                   initialTab='living-canon'
                                   initialSubTab='knyt:living-canon-vote'
                                   onDismiss={() => setLayerOpen(false)} />
                  │
                  ▼
        User reads cartridge content, clicks X
                  │
                  ▼
        CartridgeLayer unmounts (calls onDismiss)
                  │
                  ▼
        User now sees the kn0w1 chat response from step 1,
        with follow-on actions inline (e.g. "Vote now", "Open Codex").
```

---

## Implementation scope (estimated)

| Phase | Description | Commits | Risk |
|---|---|---|---|
| 11a | `config/walletTaskAgentRouting.ts` — agent + prompt mapping | 1 | low |
| 11b | `app/components/cartridge/CartridgeLayer.tsx` + `CartridgeRenderer` switch | 2 | medium (touches all 10 cartridge top-level components) |
| 11c | Wallet drawer: replace URL nav with layer mount + chat injection | 2 | medium |
| 11d | Specialist response surfacing: force-open the right chat drawer + post the response inline | 2-3 | medium-high (touches CodexCopilotLayer + AigentMeWelcomeTab) |
| 11e | E2E tests covering: chip click → chat injection → layer mount → close → chat persists | 1 | low |

Total: ~8–9 commits, ~1.5–2 days of work.

---

## Privacy considerations

The `prompt` field of `/api/assistant/ask-agent` already strips T0 server-side per the `ask-agent` route's privacy contract. The prompt templates in `walletTaskAgentRouting.ts` carry no persona content — they're task-template descriptions. Per-persona context is fetched server-side from the spine, not from the prompt.

The agent's response carries T1 surface data only (per the existing spec doc `services/agents/specialistRouter.ts`). No T0 leakage in the chat injection path.

---

## Acceptance criteria for Wave 2

- [ ] `config/walletTaskAgentRouting.ts` exports `resolveTaskRoute(taskId): { specialistId, prompt }` for every wallet task chip.
- [ ] `<CartridgeLayer>` mounts a cartridge as a full-screen layer with backdrop + X close + `onClose` callback. Closing the layer does NOT navigate the iframe; it just unmounts the React tree.
- [ ] Wallet drawer's `navigateToKnytTab` (and equivalent helpers) is replaced by `openTaskExperience(taskId)` which:
  1. POSTs to `/api/assistant/ask-agent` to inject the prompt + response.
  2. Mounts the `<CartridgeLayer>`.
- [ ] On close, the user sees the specialist's chat response with follow-on actions; the layer is gone but the previous page state is preserved.
- [ ] Smoke test: from metaMe runtime tab, click "Bring a Knight" → Kn0w1 chat appears with task explanation, then cartridge layers on top with BaK share UI; close cartridge → Kn0w1 chat still visible with follow-on "Open Codex" / "Share Now" buttons.

---

## References

- Wave 1 fix this session: `app/(embed)/triad/embed/codex-closed/page.tsx` + `app/triad/components/CodexPanelDynamic.tsx` + `app/components/content/SmartWalletDrawer.tsx`
- Existing specialist routing: `app/api/assistant/ask-agent/route.ts`, `services/agents/specialistRouter.ts`
- Layer pattern reference: `app/triad/components/codex/tabs/AigentMeWelcomeTab.tsx` (how Aigent Me already does this for its NBE actions)
- CartridgePresenceRegistry: `docs/architecture/cartridge-presence-registry.md` (the `<CartridgeLayer>` is forward-declared there)
- Wallet drawer entry point: `app/components/content/SmartWalletDrawer.tsx::navigateToKnytTab`
- Operator's design specification: top of this doc (verbatim)
