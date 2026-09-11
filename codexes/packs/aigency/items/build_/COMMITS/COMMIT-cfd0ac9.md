# Commit Brief: `cfd0ac9` — Fix build-breaking node:crypto leak into client bundles (15 failed deploys) [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`cfd0ac9`](https://github.com/iQube-Protocol/AigentZBeta/commit/cfd0ac9c48f666a7f75f8d4b9fd7c7a65340b80e) |
| Author | Claude |
| Date | 2026-09-01T09:22:20Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix build-breaking node:crypto leak into client bundles (15 failed deploys) [merge review/irl-scoped-restoration-2026-08-27]

Root cause: services/journey/journeyCopilotResolver.ts (client-safe,
imported directly by JourneyCopilotHost.tsx, a 'use client' component)
also exported resolvePrimaryCompanionForJourney, which statically
imports resolveAigentMeIdentity -> getActivePersona ->
constitutionalContext.ts -> personaSessionToken.ts -> Node's crypto
module. Webpack's client bundler must resolve a module's FULL static
import graph the moment any client component imports anything from
it, whether or not that export is ever called -- so node:crypto ended
up in the browser bundle and webpack refused it (UnhandledSchemeError,
first introduced at dev commit 7a2cfda4c, every deploy since).

A second, independent instance of the identical defect class was found
and fixed in the same pass: JourneyRunSurface.tsx ('use client')
imported shouldReEvaluateAeeProjection/JourneyReEvaluationTrigger from
journeyAeeOrchestrator.ts, which transitively imports
journeySpineAdapter.ts and nativeProvider.ts -- both of which import
Node's crypto for hash-based id generation. Introduced at dev commit
e21460f83.

Repair (mechanical file-boundary fix, no behavior change, no
architecture change):
- services/journey/primaryCompanionResolver.ts (new): holds
  resolvePrimaryCompanionForJourney, the server-only additive
  resolver. journeyCopilotResolver.ts is restored to pure/sync/
  client-safe, exporting only resolveJourneyCopilot.
- services/adaptive/journeyReEvaluationTrigger.ts (new): holds
  JourneyReEvaluationTrigger + shouldReEvaluateAeeProjection, zero
  dependencies. journeyAeeOrchestrator.ts re-exports both for
  server-side convenience but JourneyRunSurface.tsx now imports
  directly from the zero-dependency file.
- The three journey state routes (knyts-bridge, constitutional-
  internet-bridge, moneypenny-horizen) now import
  resolvePrimaryCompanionForJourney from its new home.
- Two new client-bundle-safety canaries added asserting the two shared
  files never gain a server-only/crypto-touching import again -- the
  existing canaries only checked the CLIENT component's own source
  text, which cannot catch a transitive leak through a shared module.

Verified: typecheck 678/678 (unchanged baseline), all 76 tests across
7 affected files pass, and a full local `next build` now compiles
cleanly through webpack (5.6 min) -- the node:crypto
UnhandledSchemeError is gone. The build's only remaining local failure
("supabaseUrl is required" during page-data collection) is this
sandbox having no Supabase credentials configured -- not a code
defect, and not present in the Amplify environment.

No architecture changes: the already-deployed FS branch, Journey/AEE
convergence, immediate re-evaluation, CI parity, and CTP foundation
are all untouched in behavior -- this commit only moves two exports to
new files and updates their import paths.
```

## Body

Root cause: services/journey/journeyCopilotResolver.ts (client-safe,
imported directly by JourneyCopilotHost.tsx, a 'use client' component)
also exported resolvePrimaryCompanionForJourney, which statically
imports resolveAigentMeIdentity -> getActivePersona ->
constitutionalContext.ts -> personaSessionToken.ts -> Node's crypto
module. Webpack's client bundler must resolve a module's FULL static
import graph the moment any client component imports anything from
it, whether or not that export is ever called -- so node:crypto ended
up in the browser bundle and webpack refused it (UnhandledSchemeError,
first introduced at dev commit 7a2cfda4c, every deploy since).

A second, independent instance of the identical defect class was found
and fixed in the same pass: JourneyRunSurface.tsx ('use client')
imported shouldReEvaluateAeeProjection/JourneyReEvaluationTrigger from
journeyAeeOrchestrator.ts, which transitively imports
journeySpineAdapter.ts and nativeProvider.ts -- both of which import
Node's crypto for hash-based id generation. Introduced at dev commit
e21460f83.

Repair (mechanical file-boundary fix, no behavior change, no
architecture change):
- services/journey/primaryCompanionResolver.ts (new): holds
  resolvePrimaryCompanionForJourney, the server-only additive
  resolver. journeyCopilotResolver.ts is restored to pure/sync/
  client-safe, exporting only resolveJourneyCopilot.
- services/adaptive/journeyReEvaluationTrigger.ts (new): holds
  JourneyReEvaluationTrigger + shouldReEvaluateAeeProjection, zero
  dependencies. journeyAeeOrchestrator.ts re-exports both for
  server-side convenience but JourneyRunSurface.tsx now imports
  directly from the zero-dependency file.
- The three journey state routes (knyts-bridge, constitutional-
  internet-bridge, moneypenny-horizen) now import
  resolvePrimaryCompanionForJourney from its new home.
- Two new client-bundle-safety canaries added asserting the two shared
  files never gain a server-only/crypto-touching import again -- the
  existing canaries only checked the CLIENT component's own source
  text, which cannot catch a transitive leak through a shared module.

Verified: typecheck 678/678 (unchanged baseline), all 76 tests across
7 affected files pass, and a full local `next build` now compiles
cleanly through webpack (5.6 min) -- the node:crypto
UnhandledSchemeError is gone. The build's only remaining local failure
("supabaseUrl is required" during page-data collection) is this
sandbox having no Supabase credentials configured -- not a code
defect, and not present in the Amplify environment.

No architecture changes: the already-deployed FS branch, Journey/AEE
convergence, immediate re-evaluation, CI parity, and CTP foundation
are all untouched in behavior -- this commit only moves two exports to
new files and updates their import paths.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/api/journey/knyts-bridge/state/route.ts` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `services/adaptive/journeyAeeOrchestrator.ts` |
| Added | `services/adaptive/journeyReEvaluationTrigger.ts` |
| Modified | `services/journey/journeyCopilotResolver.ts` |
| Added | `services/journey/primaryCompanionResolver.ts` |
| Modified | `tests/journey-branch-immediate-reevaluation.test.ts` |
| Modified | `tests/journey-copilot-assigned-companion-wiring.test.ts` |
| Modified | `tests/journey-copilot-primary-companion.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 13 files changed, 212 insertions(+), 82 deletions(-)
