# Commit Brief: `d45e06c` — SpecialistsLayout: unify composer + reply into a single emerald consultation card

| Field | Value |
|-------|-------|
| SHA | [`d45e06c`](https://github.com/iQube-Protocol/AigentZBeta/commit/d45e06cc3e144c3c0ef9f4dd6d8ed967c1a6340f) |
| Author | Claude |
| Date | 2026-05-24T18:28:47Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
SpecialistsLayout: unify composer + reply into a single emerald consultation card

The composer and the reply were rendering as two sibling sections,
which read like an unrelated input and an unrelated output rather
than a connected prompt-and-response surface.

Wraps both inside a single emerald-tinted ConsultationCard with a
"Consultation · <Specialist>" header, an in-flight badge that
surfaces the moment Send fires, the composer up top (what you ask),
and the reply (or in-flight loading state) immediately below it
inside the same card, divided by a thin emerald inset rule. Hand-off
chips remain attached to the reply since the pivot is an outcome of
seeing the response. The accent matches the active-specialist
FocusCard above so the conversation reads as a continuation of the
focused agent.

Removes the standalone AskingPlaceholder section since its job now
lives inside the unified card.
```

## Body

The composer and the reply were rendering as two sibling sections,
which read like an unrelated input and an unrelated output rather
than a connected prompt-and-response surface.

Wraps both inside a single emerald-tinted ConsultationCard with a
"Consultation · <Specialist>" header, an in-flight badge that
surfaces the moment Send fires, the composer up top (what you ask),
and the reply (or in-flight loading state) immediately below it
inside the same card, divided by a thin emerald inset rule. Hand-off
chips remain attached to the reply since the pivot is an outcome of
seeing the response. The accent matches the active-specialist
FocusCard above so the conversation reads as a continuation of the
focused agent.

Removes the standalone AskingPlaceholder section since its job now
lives inside the unified card.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/welcome/layouts/SpecialistsLayout.tsx` |

## Stats

 1 file changed, 93 insertions(+), 55 deletions(-)
