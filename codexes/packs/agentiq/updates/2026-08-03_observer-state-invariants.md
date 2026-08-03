# Observer State Invariants — why "it's registered but nothing knows it" kept coming back

**Status:** ratified as working invariants, 2026-08-03. Written at the pilot's instruction after the
same defect shape returned three times in one day on Aigent Nakamoto's live Horizen registration
(tx `0xedda5f73…`, tokenId `8798`).

> "We probably need to capture the invariants here as we cross each significant milestone so we
> don't keep regressing like this." — pilot, 2026-08-03

Every invariant below is written from a defect that actually shipped. None is speculative. Each
names its canary, because the recurring lesson of this day was that **the doctrine was already
right and the enforcement was missing.**

---

## The shape that kept recurring

One fact — *Nakamoto is registered* — with several observers, each reading a different source,
disagreeing. Every instance looked like a new bug and was the same bug:

| # | What the operator saw | Which observer was wrong |
|---|---|---|
| 1 | Master Journey advanced to Verify, Verify said "no tokenId yet" | stepper read the receipt; Verify read the `registry_assets` projection; the projection write had silently failed |
| 2 | Claim refused with `aigentqube-moneypenny` while claiming **Nakamoto** | `MarketaEligibilityView` never sent `agentSlug`, so the server used its default |
| 3 | Ladder "Awaiting confirmation" + card "not yet registered" + banner "registered — tokenId 8798", **on one screen** | the panel held the tokenId three ways and fed its ladder from the weakest |

---

## OS-1 — A confirmed consequence outranks every local record of the request

Precedence, strongest first:

```
confirmed external consequence  >  confirmed receipt  >  pending request
                                >  expired request    >  prepared local state
```

An expired mandate, a lapsed invocation, or a stale "awaiting" poll must NEVER outrank a
registration the chain has already performed. The Register ladder rendering "The last attempt
lapsed — start again" underneath a banner reading "registered — tokenId 8798" is this invariant
violated.

**Canary:** `tests/horizen-agent-page-surface-wiring.test.ts` — "the ladder tokenId falls back
through card → receipt → this session's own confirmation".

## OS-2 — One screen may not assert a fact and its negation

If two sources disagree, the surface resolves by OS-1 or renders the conflict explicitly. What it
may never do is render both as current, leaving the operator to decide which panel is lying.

**Canary:** `tests/horizen-agent-page-surface-wiring.test.ts` — "one screen, one answer" block.

## OS-3 — A confirmed fact is never un-confirmed by a later failed read

Once a source has said "confirmed", a subsequent read that fails, times out, or returns nothing is
an absence of new information — not evidence of reversal. Any cache of a confirmation must have no
reset-to-null path.

**Canary:** "a confirmed tokenId is never cleared by a later poll that fails to see it" — asserts
`flowTokenIdRef.current = null` appears nowhere.

## OS-4 — Independent writes are not atomic; the reader must survive either one failing

`createRegistrationReceipt` and `updateRegistryAssetBinding` are two Supabase writes with nothing
making them one transaction. Any reader depending on both landing will eventually be wrong. The
remedy is a shared resilient reader with a named fallback and a `fromReceiptFallback` flag, so a
stuck write stays *diagnosable* rather than silently worked around forever.

**Canary:** `tests/horizen-agent-registration-binding.test.ts` — projection-wins, receipt-fallback,
and chain-decode paths, each asserting its own `fallbackSource`.

## OS-5 — A silent write failure is a defect even when nothing errors

`updateRegistryAssetBinding` had three silent-return points and a discarded `.update()` error. It
"succeeded" while writing nothing. Every branch that abandons a write now logs `[HORIZEN BINDING]`
with the ids that failed to persist.

## OS-6 — Find a record by the field that names its SUBJECT, not by the actor who created it

**This one cost the most.** A `horizen_agent_registered` receipt is written with
`personaId: actorPersonaId` — the **operator** who acted (ArkAgent) — not the agent being
registered. The first receipt-fallback looked receipts up under *Nakamoto's own persona*, which
structurally never holds them. It searched an empty set, every time, and reported "not registered".

Lookups must key on the field naming the subject (`agents_invoked`), never on the acting persona.
Crossing persona scope to do so means returning **only** the narrow facts asked for — never the
receipt body, which stays persona-scoped.

**Canary:** "queries on the runtime agent id and never looks up a persona row" — asserts the
`personas` table is not touched at all.

## OS-7 — A fallback must read the evidence that ALREADY EXISTS, not only what the new code emits

The first fallback read only the structured `actionInput.registration` block introduced in the same
change. Nakamoto's real receipt — the one it existed to rescue — predated it and carried only
`{txHash, network, aigentQubeId}`, so it was skipped as malformed. **A fallback that cannot read
the data already in production is not a fallback.**

Where a legacy record carries less, recover the rest from a source that can still be interrogated:
here, decode the transaction the receipt names. Bound it with an owner check so it proves something
about *this* subject, and refuse rather than guess when it doesn't.

**Canary:** "recovers Nakamoto's tokenId from the transaction her legacy receipt names", plus
"reports unregistered — never a guess — when the chain does not confirm the tx".

## OS-8 — A surface acts on the SELECTED subject; a server default is not a selection

Both times Claim misbehaved, the client omitted `agentSlug` and the server fell back to
`DEFAULT_REGISTRABLE_AGENT_SLUG` (MoneyPenny). A default is a safety net for an unspecified caller,
never a substitute for a selection the operator visibly made.

**Canary:** the `PilotJourneyTab`/`MarketaEligibilityView` wiring block — props are read, not
discarded (`_props` is itself the smell), and both GET and POST carry the slug.

---

## OS-9 — THE META-INVARIANT: a canary must be written against real evidence, not against the
## assumptions of the code it guards

This is the one that let all of the above ship green.

The original binding-resolver test file had **six passing tests** while the resolver could never
work. It passed because it mocked the author's beliefs rather than the system's data:

- it asserted the lookup uses the agent's persona — encoding OS-6's bug as a **requirement**;
- one test was literally titled *"ignores a receipt with no structured registration block"* and fed
  it `{aigentQubeId, network, txHash}` — **exactly** the shape of Nakamoto's real receipt. The bug
  was not merely untested; it was **specified, asserted, and defended by a green test.**

Rules that follow:

1. **Fixture from production, not from the writer.** When a real record exists — a receipt, a row,
   a payload — the canary uses its actual shape. Nakamoto's real tx hash, tokenId, registry address
   and wallet are now fixture constants at the top of the file for exactly this reason.
2. **A test asserting that real data is ignored is a red flag, not a passing test.** If a canary
   says "input X is correctly skipped", confirm X is not a shape that exists in production.
3. **Mock the boundary, never the belief.** Mocking `listActivityReceiptsForPersona` hid that the
   wrong function was being called with the wrong key entirely.
4. **A canary that cannot fail is worse than none** — it converts an open question into a settled
   one. (Same family as the Companion system's MS-7, "an inert mechanism is a defect".)

---

## What to do at the next milestone

When a stage of this Journey is crossed, before moving on:

1. Name which observer(s) learned something new, and from which source.
2. For each, ask the OS-2 question: *can this surface now contradict another one?*
3. If a new fallback or projection was added, ask OS-7: *can it read what is already in the
   database today, written by older code?*
4. Write the canary against a record that actually exists — then confirm it FAILS against the
   pre-fix code before accepting it as green.

---

## Files

| File | Role |
|---|---|
| `services/receipts/activityReceiptService.ts` | `findAgentRegistrationReceipts` — subject-keyed lookup (OS-6), narrow facts only |
| `services/horizen/agentRegistrationBinding.ts` | the ONE resilient reader (OS-4/OS-7), named `fallbackSource` |
| `components/journey/RegisterAgentPanel.tsx` | ladder precedence (OS-1/OS-2/OS-3) |
| `app/api/journey/moneypenny-horizen/register/status/route.ts` | loud `[HORIZEN BINDING]` write failures (OS-5) |
| `tests/horizen-agent-registration-binding.test.ts` | rewritten against real evidence (OS-9) |
| `tests/horizen-agent-page-surface-wiring.test.ts` | one-screen-one-answer + agent-selection canaries |
