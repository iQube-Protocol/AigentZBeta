# Commit Brief: `569d3ea` — SECURITY ADDENDUM: remove query-derived administrator authority (IRL OS containment)

| Field | Value |
|-------|-------|
| SHA | [`569d3ea`](https://github.com/iQube-Protocol/AigentZBeta/commit/569d3ea485d7800b3ea333db3f020f2a67cb938e) |
| Author | Claude |
| Date | 2026-08-27T08:14:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
SECURITY ADDENDUM: remove query-derived administrator authority (IRL OS containment)

Operator directive following Phase 1 approval: ?isAdmin=true was confirmed
to set client state permanently for unauthenticated visitors and satisfy
client-side tab gates. Even though Phase 1's server-side route fixes
already prevent the presently-observed document reads through this path,
a client-controlled parameter must not create even UI-level administrator
state -- it is a misleading privilege presentation and a latent primitive
for the next route that trusts the tab gate.

app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts:
- initialIsAdmin removed from the hook's options type entirely.
- isAdmin state now always initializes to useState<boolean>(false) -- a
  plain literal, never a lazy initializer reading the URL/localStorage/a
  prop, so server and first-client render are identical (no protected-tab
  hydration flash).
- The canonical-persona resolver effect now opens with setIsAdmin(false)
  as its first, unconditional statement, before any async work -- a
  persona switch discards prior admin state immediately rather than
  retaining it until the new persona's own resolution completes.
- The only remaining path to isAdmin === true is a strict
  data.cartridgeFlags?.isAdmin === true from a successful, authenticated
  fetch to /api/wallet/active-persona (the canonical server resolver). No
  URL parameter, prop, or postMessage payload can reach it.
- The postMessage handler no longer reads payload.isAdmin -- a trusted,
  origin-verified parent frame may still propose which persona to select
  (a navigation hint) but can never assert admin authority.
- Result type's isAdmin changed from boolean | undefined to a definite
  boolean.

Callers updated to match: app/(embed)/triad/embed/codex/[codexSlug]/page.tsx
and app/(embed)/triad/embed/codex/page.tsx no longer derive queryIsAdmin
or forward initialIsAdmin.

utils/codex-nav.ts (buildCodexUrl/CodexNavOptions): isAdmin removed from
the shared cross-cartridge navigation helper's options type, destructure,
and query-string serialization -- centrally, not just at call sites, so a
future caller cannot silently reintroduce it (and would now fail to
compile if it tried). Every real call site updated: PartnerProgrammesTab's
DeepLinkCard (the confirmed Phase 1 irl-cartridge deep-link vector),
QuickLinksCard, KnytAlphaTab, AlphaProgrammeTab.

Broader-use audit (required by the directive): useCodexEmbedAuthBridge has
exactly three real callers; none needed anything beyond the hook fix. The
broader search across the codebase found two independent instances of the
same defect class, fixed the same way (URL override removed, existing
canonical server-resolved flag kept as the sole source):
- components/metame/MetaMeRuntimeClient.tsx: runtimeAdminMode no longer
  ORs a ?runtimeAdmin=1/?admin=1 override into the canonical personaIsAdmin
  flag.
- components/composer/ComposerExperienceViewer.tsx: canEdit (Studio EDIT
  authority, not just tab visibility) no longer ORs a ?admin=1/
  ?runtimeAdmin=1 override into the canonical isAdmin flag.

tests/irl-os-query-derived-authority-removal.test.ts: 29 new
structural/source-authority canaries (same convention as the rest of
tests/) proving the hook's control flow directly -- no initialIsAdmin
field, isAdmin seeded only by a literal false, the only setIsAdmin(true)
call site is gated on a strict === true check, the resolver effect resets
before any async work and re-fires per personaId change, no buildCodexUrl
call site passes isAdmin, both independently-found sites are fixed, no
static import path exists from AgentiqCartridgeTab into codexes/packs/
(the structural guarantee against confidential content reaching the
public bundle), and both document routes read exclusively through
corpusReadPackFile.

Also fixes two stale-assertion test failures surfaced only by running the
FULL suite (not just the related subset) per the operator's instruction --
both were pre-existing tests asserting the operator-approved Phase 1
disposition's PRIOR state (irl-os-workspace/irl-os-validation-programme
enabled), not introduced by this addendum:
tests/irl-os-access-boundary.test.ts, tests/boundary-research-experiment-
scoping.test.ts, tests/validation-programme-journey.test.ts.

A second dangling-link instance was found and fixed during this pass:
services/journey/journeySurfaceRegistry.ts's irl-exchange-workspace
descriptor's expandedTab (OCSGA Bridge's "Open full view" affordance)
also pointed at the now-disabled irl-os-workspace -- repointed to
irl-os-welcome, mirroring the Phase 1 QuickLinksCard/
BoundaryResearchProgressPanel fixes.

Verification: 407 tests pass across 16 directly-related files. Full
repository suite compared against the exact origin/dev baseline (git
stash + checkout origin/dev -- . methodology): 21 failed files / 49
failed tests identical on both sides (byte-identical failing-file sets,
all pre-existing and unrelated); +46 passing tests exactly matching the
two new test files. TypeScript: 689 errors on both origin/dev baseline
and this addendum -- identical count, spot-checked same errors at shifted
line numbers in every touched file. Zero regressions, zero new failures,
zero new TypeScript errors.

Do not merge to dev until explicitly authorized.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Operator directive following Phase 1 approval: ?isAdmin=true was confirmed
to set client state permanently for unauthenticated visitors and satisfy
client-side tab gates. Even though Phase 1's server-side route fixes
already prevent the presently-observed document reads through this path,
a client-controlled parameter must not create even UI-level administrator
state -- it is a misleading privilege presentation and a latent primitive
for the next route that trusts the tab gate.

app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts:
- initialIsAdmin removed from the hook's options type entirely.
- isAdmin state now always initializes to useState<boolean>(false) -- a
  plain literal, never a lazy initializer reading the URL/localStorage/a
  prop, so server and first-client render are identical (no protected-tab
  hydration flash).
- The canonical-persona resolver effect now opens with setIsAdmin(false)
  as its first, unconditional statement, before any async work -- a
  persona switch discards prior admin state immediately rather than
  retaining it until the new persona's own resolution completes.
- The only remaining path to isAdmin === true is a strict
  data.cartridgeFlags?.isAdmin === true from a successful, authenticated
  fetch to /api/wallet/active-persona (the canonical server resolver). No
  URL parameter, prop, or postMessage payload can reach it.
- The postMessage handler no longer reads payload.isAdmin -- a trusted,
  origin-verified parent frame may still propose which persona to select
  (a navigation hint) but can never assert admin authority.
- Result type's isAdmin changed from boolean | undefined to a definite
  boolean.

Callers updated to match: app/(embed)/triad/embed/codex/[codexSlug]/page.tsx
and app/(embed)/triad/embed/codex/page.tsx no longer derive queryIsAdmin
or forward initialIsAdmin.

utils/codex-nav.ts (buildCodexUrl/CodexNavOptions): isAdmin removed from
the shared cross-cartridge navigation helper's options type, destructure,
and query-string serialization -- centrally, not just at call sites, so a
future caller cannot silently reintroduce it (and would now fail to
compile if it tried). Every real call site updated: PartnerProgrammesTab's
DeepLinkCard (the confirmed Phase 1 irl-cartridge deep-link vector),
QuickLinksCard, KnytAlphaTab, AlphaProgrammeTab.

Broader-use audit (required by the directive): useCodexEmbedAuthBridge has
exactly three real callers; none needed anything beyond the hook fix. The
broader search across the codebase found two independent instances of the
same defect class, fixed the same way (URL override removed, existing
canonical server-resolved flag kept as the sole source):
- components/metame/MetaMeRuntimeClient.tsx: runtimeAdminMode no longer
  ORs a ?runtimeAdmin=1/?admin=1 override into the canonical personaIsAdmin
  flag.
- components/composer/ComposerExperienceViewer.tsx: canEdit (Studio EDIT
  authority, not just tab visibility) no longer ORs a ?admin=1/
  ?runtimeAdmin=1 override into the canonical isAdmin flag.

tests/irl-os-query-derived-authority-removal.test.ts: 29 new
structural/source-authority canaries (same convention as the rest of
tests/) proving the hook's control flow directly -- no initialIsAdmin
field, isAdmin seeded only by a literal false, the only setIsAdmin(true)
call site is gated on a strict === true check, the resolver effect resets
before any async work and re-fires per personaId change, no buildCodexUrl
call site passes isAdmin, both independently-found sites are fixed, no
static import path exists from AgentiqCartridgeTab into codexes/packs/
(the structural guarantee against confidential content reaching the
public bundle), and both document routes read exclusively through
corpusReadPackFile.

Also fixes two stale-assertion test failures surfaced only by running the
FULL suite (not just the related subset) per the operator's instruction --
both were pre-existing tests asserting the operator-approved Phase 1
disposition's PRIOR state (irl-os-workspace/irl-os-validation-programme
enabled), not introduced by this addendum:
tests/irl-os-access-boundary.test.ts, tests/boundary-research-experiment-
scoping.test.ts, tests/validation-programme-journey.test.ts.

A second dangling-link instance was found and fixed during this pass:
services/journey/journeySurfaceRegistry.ts's irl-exchange-workspace
descriptor's expandedTab (OCSGA Bridge's "Open full view" affordance)
also pointed at the now-disabled irl-os-workspace -- repointed to
irl-os-welcome, mirroring the Phase 1 QuickLinksCard/
BoundaryResearchProgressPanel fixes.

Verification: 407 tests pass across 16 directly-related files. Full
repository suite compared against the exact origin/dev baseline (git
stash + checkout origin/dev -- . methodology): 21 failed files / 49
failed tests identical on both sides (byte-identical failing-file sets,
all pre-existing and unrelated); +46 passing tests exactly matching the
two new test files. TypeScript: 689 errors on both origin/dev baseline
and this addendum -- identical count, spot-checked same errors at shifted
line numbers in every touched file. Zero regressions, zero new failures,
zero new TypeScript errors.

Do not merge to dev until explicitly authorized.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(embed)/triad/embed/codex/[codexSlug]/page.tsx` |
| Modified | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` |
| Modified | `app/(embed)/triad/embed/codex/page.tsx` |
| Modified | `app/triad/components/codex/tabs/AlphaProgrammeTab.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytAlphaTab.tsx` |
| Modified | `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` |
| Modified | `components/composer/ComposerExperienceViewer.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `components/metame/cards/QuickLinksCard.tsx` |
| Modified | `docs/security/2026-08-27_irl-os-containment-breach-audit.md` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/boundary-research-experiment-scoping.test.ts` |
| Modified | `tests/irl-os-access-boundary.test.ts` |
| Added | `tests/irl-os-query-derived-authority-removal.test.ts` |
| Modified | `tests/validation-programme-journey.test.ts` |
| Modified | `utils/codex-nav.ts` |

## Stats

 16 files changed, 633 insertions(+), 67 deletions(-)
