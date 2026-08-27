# Commit Brief: `c05c2c3` — SECURITY: contain IRL OS -> metaMe IRL boundary breach (Phase 1)

| Field | Value |
|-------|-------|
| SHA | [`c05c2c3`](https://github.com/iQube-Protocol/AigentZBeta/commit/c05c2c347206a129a53f8d31bb88fa6d9ea457c6) |
| Author | Claude |
| Date | 2026-08-27T07:42:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
SECURITY: contain IRL OS -> metaMe IRL boundary breach (Phase 1)

CRITICAL incident: the public IRL OS cartridge shared its Workspace and
Validation Programme tabs' rendering machinery (buildResearchWorkspaceTab ->
PartnerProgrammesTab -> DeepLinkCard) with the private metaMe IRL cartridge.
researchWorkspace.ts hardcodes codexSlug: 'irl-cartridge' on every
research-programme workspace's Protocols/EXP-P1 Readiness/Experiments/
Reports/Records links; DeepLinkCard built these into live hrefs with
personaId/isAdmin as query params -- exactly the exposure in the reported
screenshots. Separately, two document-serving routes
(/api/codex/packs/[packId]/file for the irl pack, and /api/public/irl/doc)
had NO access control for the irl pack's confidential collections
(col_foundation, col_experiments) -- explaining the internal documents
rendering in the public cartridge independent of the navigation issue.

Root causes verified by reading the implementation (not inferred from
screenshots alone) -- full findings, exposure matrix, and residual risks in
docs/security/2026-08-27_irl-os-containment-breach-audit.md.

Fixes:
- app/api/codex/packs/[packId]/file/route.ts: default-deny for the irl pack
  (IRL_PUBLIC_PACK_PATHS allowlist; everything else requires canonical
  server-resolved admin, never a query param)
- app/api/public/irl/doc/route.ts: same default-deny allowlist (this route
  has no persona resolution at all -- non-allowlisted paths 404)
- app/api/experiments/access/route.ts: assignable experiment catalogue no
  longer leaks to unauthenticated/unentitled callers as an existence signal
- data/codex-configs.ts: disabled IRL_OS_CARTRIDGE's Workspace tab (the
  confirmed irl-cartridge deep-link vector), Validation Programme tab (same
  vector via a second component), and every tab serving irl-pack content
  that was not explicitly public-classified (Charter, Layers I-III,
  Protocols & Articles, Glossary, Constitutional Evaluation, Research
  Programmes, Experiments) -- disabled not removed, per the file's own
  irl-os-records precedent, so Phase 2 restoration is a diff
- components/metame/cards/QuickLinksCard.tsx,
  components/journey/BoundaryResearchProgressPanel.tsx: repointed dangling
  deep links off the now-disabled tabs onto the always-enabled Welcome tab

Verified NOT exploitable (server independently re-checks, ignoring any
client-supplied isAdmin/personaId): /api/venture/workspace/[id],
/api/experiments/access, /api/research/readiness/[id],
/api/corpus-scout/candidates -- all resolve authority exclusively via
getActivePersona(req).cartridgeFlags.isAdmin, never a query parameter.
Query-derived isAdmin WAS effectively authority-bearing for document
content gated only by the two now-fixed unauthenticated irl-pack routes;
that chain is closed by this commit.

tests/irl-os-containment.test.ts: 17 new canaries (no irl-cartridge
destination anywhere in IRL_OS_CARTRIDGE's tab tree; confirmed vectors stay
disabled; verified-public tabs stay enabled; query params never read for
authorization in the fixed routes; default-deny allowlists present).

Verification: 299 tests pass across 9 related suites (irl-os-containment,
research-lab-workspace, research-workspace-spec, participation-tab-gate,
venture-lab-cohort-isolation, delegated-invitation-authority,
source-of-truth-parity, validation-programme-agent-package,
ian-journey-first-touch) -- zero regressions. TypeScript: 689 errors before
and after this change (pre-existing baseline, confirmed via git stash
comparison) -- zero new errors introduced.

Residual Phase 2 work (not silently dropped -- see audit doc): scoped
invitation/cohort-aware gating for the irl-pack document routes (currently
admin-only, which also affects the already-approved Autonomi/Austin
reviewer document-fetch flow -- flagged prominently for prompt operator
attention); IRL OS-native public projections for the now-hidden tabs;
repointing researchWorkspace.ts's remaining irl-cartridge links.

Do not merge to dev -- review-only security branch pending operator
authorization.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

CRITICAL incident: the public IRL OS cartridge shared its Workspace and
Validation Programme tabs' rendering machinery (buildResearchWorkspaceTab ->
PartnerProgrammesTab -> DeepLinkCard) with the private metaMe IRL cartridge.
researchWorkspace.ts hardcodes codexSlug: 'irl-cartridge' on every
research-programme workspace's Protocols/EXP-P1 Readiness/Experiments/
Reports/Records links; DeepLinkCard built these into live hrefs with
personaId/isAdmin as query params -- exactly the exposure in the reported
screenshots. Separately, two document-serving routes
(/api/codex/packs/[packId]/file for the irl pack, and /api/public/irl/doc)
had NO access control for the irl pack's confidential collections
(col_foundation, col_experiments) -- explaining the internal documents
rendering in the public cartridge independent of the navigation issue.

Root causes verified by reading the implementation (not inferred from
screenshots alone) -- full findings, exposure matrix, and residual risks in
docs/security/2026-08-27_irl-os-containment-breach-audit.md.

Fixes:
- app/api/codex/packs/[packId]/file/route.ts: default-deny for the irl pack
  (IRL_PUBLIC_PACK_PATHS allowlist; everything else requires canonical
  server-resolved admin, never a query param)
- app/api/public/irl/doc/route.ts: same default-deny allowlist (this route
  has no persona resolution at all -- non-allowlisted paths 404)
- app/api/experiments/access/route.ts: assignable experiment catalogue no
  longer leaks to unauthenticated/unentitled callers as an existence signal
- data/codex-configs.ts: disabled IRL_OS_CARTRIDGE's Workspace tab (the
  confirmed irl-cartridge deep-link vector), Validation Programme tab (same
  vector via a second component), and every tab serving irl-pack content
  that was not explicitly public-classified (Charter, Layers I-III,
  Protocols & Articles, Glossary, Constitutional Evaluation, Research
  Programmes, Experiments) -- disabled not removed, per the file's own
  irl-os-records precedent, so Phase 2 restoration is a diff
- components/metame/cards/QuickLinksCard.tsx,
  components/journey/BoundaryResearchProgressPanel.tsx: repointed dangling
  deep links off the now-disabled tabs onto the always-enabled Welcome tab

Verified NOT exploitable (server independently re-checks, ignoring any
client-supplied isAdmin/personaId): /api/venture/workspace/[id],
/api/experiments/access, /api/research/readiness/[id],
/api/corpus-scout/candidates -- all resolve authority exclusively via
getActivePersona(req).cartridgeFlags.isAdmin, never a query parameter.
Query-derived isAdmin WAS effectively authority-bearing for document
content gated only by the two now-fixed unauthenticated irl-pack routes;
that chain is closed by this commit.

tests/irl-os-containment.test.ts: 17 new canaries (no irl-cartridge
destination anywhere in IRL_OS_CARTRIDGE's tab tree; confirmed vectors stay
disabled; verified-public tabs stay enabled; query params never read for
authorization in the fixed routes; default-deny allowlists present).

Verification: 299 tests pass across 9 related suites (irl-os-containment,
research-lab-workspace, research-workspace-spec, participation-tab-gate,
venture-lab-cohort-isolation, delegated-invitation-authority,
source-of-truth-parity, validation-programme-agent-package,
ian-journey-first-touch) -- zero regressions. TypeScript: 689 errors before
and after this change (pre-existing baseline, confirmed via git stash
comparison) -- zero new errors introduced.

Residual Phase 2 work (not silently dropped -- see audit doc): scoped
invitation/cohort-aware gating for the irl-pack document routes (currently
admin-only, which also affects the already-approved Autonomi/Austin
reviewer document-fetch flow -- flagged prominently for prompt operator
attention); IRL OS-native public projections for the now-hidden tabs;
repointing researchWorkspace.ts's remaining irl-cartridge links.

Do not merge to dev -- review-only security branch pending operator
authorization.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/packs/[packId]/file/route.ts` |
| Modified | `app/api/experiments/access/route.ts` |
| Modified | `app/api/public/irl/doc/route.ts` |
| Modified | `components/journey/BoundaryResearchProgressPanel.tsx` |
| Modified | `components/metame/cards/QuickLinksCard.tsx` |
| Modified | `data/codex-configs.ts` |
| Added | `docs/security/2026-08-27_irl-os-containment-breach-audit.md` |
| Added | `tests/irl-os-containment.test.ts` |

## Stats

 8 files changed, 681 insertions(+), 27 deletions(-)
