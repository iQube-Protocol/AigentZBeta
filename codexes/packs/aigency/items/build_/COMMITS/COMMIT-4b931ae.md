# Commit Brief: `4b931ae` — Fix OCSGA Presence stage to recognize a principal's Citizen Passport for an agent-persona caller

| Field | Value |
|-------|-------|
| SHA | [`4b931ae`](https://github.com/iQube-Protocol/AigentZBeta/commit/4b931ae89bf71d49425265a0ad354243791552a8) |
| Author | Claude |
| Date | 2026-08-27T09:43:52Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix OCSGA Presence stage to recognize a principal's Citizen Passport for an agent-persona caller

Root cause: the Ian Boundary Research journey's passport stage evidence
(services/journey/ianJourneyState.ts) derived exclusively from a
passport_issued receipt scoped to the ACTIVE personaId. When the active
persona is an agent persona (e.g. Aigent Z) acting for a human principal who
claimed their Citizen Passport under their OWN persona, that receipt was
never written against the agent's persona, so Establish Presence re-rendered
a fresh class-selection wizard even though Presence was already established.
citizenPassportUsable (authProfileId-scoped, walking every persona the
caller's auth account owns) was already computed correctly but never fed
into stage completion, and was only exposed as a bare boolean with no way
for the UI to name what was recognized.

Fix:
- ianJourneyState.ts: passport stage is now satisfied by
  hasReceiptType('passport_issued') OR citizenPassportUsable — widening the
  evidence source, never the identifier direction (still authProfileId-first,
  per RES-2026-08-15-PASSPORT-PRINCIPAL-FIRST-SUPERSESSION-001). Also exposes
  citizenPassportClass/citizenPassportRef (a T2-safe persona_public_ref,
  never the raw Passport UUID) for a recognized-state UI.
- passportPrincipal.ts: PassportSnapshot gains an optional personaPublicRef,
  selected by loadUsableCitizenPassportForAuthProfile.
- types/journey.ts / app/api/journey/ian/state/route.ts: thread the two new
  fields through JourneyRuntimeState / the state route response.
- IanJourneyTab.tsx: passes initialUsablePassport/initialPassportClass/
  initialPassportRef into the venture-participate-apply surface.
- PassportBureauApplyTab.tsx: seeds its existing recognized-state
  short-circuit from initialUsablePassport instead of requiring the wizard's
  own internal Bureau-account sign-in sub-step (which never fires for an
  already-platform-authenticated caller) to detect an existing Passport;
  displays the recognized class + safe reference.

Tests: tests/ocsga-early-invitation-passport-routing.test.ts updated (canary
4's old assertion literally encoded the receipt-only defect) plus a new
describe block proving the actual 'Aigent Z' identity shape, not a
simplified persona-owns-its-own-Passport fixture.
```

## Body

Root cause: the Ian Boundary Research journey's passport stage evidence
(services/journey/ianJourneyState.ts) derived exclusively from a
passport_issued receipt scoped to the ACTIVE personaId. When the active
persona is an agent persona (e.g. Aigent Z) acting for a human principal who
claimed their Citizen Passport under their OWN persona, that receipt was
never written against the agent's persona, so Establish Presence re-rendered
a fresh class-selection wizard even though Presence was already established.
citizenPassportUsable (authProfileId-scoped, walking every persona the
caller's auth account owns) was already computed correctly but never fed
into stage completion, and was only exposed as a bare boolean with no way
for the UI to name what was recognized.

Fix:
- ianJourneyState.ts: passport stage is now satisfied by
  hasReceiptType('passport_issued') OR citizenPassportUsable — widening the
  evidence source, never the identifier direction (still authProfileId-first,
  per RES-2026-08-15-PASSPORT-PRINCIPAL-FIRST-SUPERSESSION-001). Also exposes
  citizenPassportClass/citizenPassportRef (a T2-safe persona_public_ref,
  never the raw Passport UUID) for a recognized-state UI.
- passportPrincipal.ts: PassportSnapshot gains an optional personaPublicRef,
  selected by loadUsableCitizenPassportForAuthProfile.
- types/journey.ts / app/api/journey/ian/state/route.ts: thread the two new
  fields through JourneyRuntimeState / the state route response.
- IanJourneyTab.tsx: passes initialUsablePassport/initialPassportClass/
  initialPassportRef into the venture-participate-apply surface.
- PassportBureauApplyTab.tsx: seeds its existing recognized-state
  short-circuit from initialUsablePassport instead of requiring the wizard's
  own internal Bureau-account sign-in sub-step (which never fires for an
  already-platform-authenticated caller) to detect an existing Passport;
  displays the recognized class + safe reference.

Tests: tests/ocsga-early-invitation-passport-routing.test.ts updated (canary
4's old assertion literally encoded the receipt-only defect) plus a new
describe block proving the actual 'Aigent Z' identity shape, not a
simplified persona-owns-its-own-Passport fixture.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/ian/state/route.ts` |
| Modified | `app/triad/components/codex/tabs/IanJourneyTab.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` |
| Modified | `services/identity/passportPrincipal.ts` |
| Modified | `services/journey/ianJourneyState.ts` |
| Modified | `tests/ocsga-early-invitation-passport-routing.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 7 files changed, 254 insertions(+), 18 deletions(-)
