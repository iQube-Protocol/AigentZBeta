# Use Case Zero — Client/Server Boundary Fix (Dev Fixture Route)

**Date:** 14 September 2026
**Status:** Fixed and verified via a real `next build`.
**Scope:** `app/(shell)/moneypenny/dev-fixtures/use-case-zero/page.tsx` and
`UseCaseZeroDemoFixtureViewer.tsx` only — build-order item 11's other files
(`scripts/seedUseCaseZeroDemo.ts`, the fixture, the copilot wiring) were not
touched.

## What broke

`npm run build` failed with:

```
Module build failed: UnhandledSchemeError: Reading from "node:crypto" is not
handled by plugins (Unhandled scheme).

Import trace for requested module:
node:crypto
./services/identity/walletAliasService.ts
./services/identity/passportPrincipal.ts
./services/identity/didQubeResolver.ts
./services/aegis/aegisAssessmentService.ts
./services/vela/velaUnderwritingAdmissionEvidence.ts
./scripts/seedUseCaseZeroDemo.ts
./app/(shell)/moneypenny/components/constitutionalRiskFlow/__fixtures__/useCaseZeroDemoFixture.ts
./app/(shell)/moneypenny/dev-fixtures/use-case-zero/UseCaseZeroDemoFixtureViewer.tsx
```

`UseCaseZeroDemoFixtureViewer.tsx` is a `'use client'` component. It imported
`buildUseCaseZeroDemoFixture` (a value) from the fixture file, which imports
`composeUseCaseZeroDemoChain` (a value) from `scripts/seedUseCaseZeroDemo.ts`
— a file that, by design, also carries server-only imports at module scope
(`getSupabaseServer`, `composeUnderwritingAdmissionEvidence`, which itself
transitively reaches `node:crypto` via the Aegis/DiDQube/wallet-alias chain).
A module's top-level imports are bundled as a unit regardless of which single
export a caller actually uses — so importing one pure function pulled the
whole server-only graph into the browser bundle.

**No prior check caught this.** Item 11's own verification (245 Vitest tests,
`npx tsc --noEmit`) reported success, and correctly — Vitest runs in Node,
where every server-only module resolves fine, and TypeScript has no concept
of "this file is bundled for the browser." Only an actual `next build`
(webpack) surfaces this class of defect.

## The fix

`page.tsx` (a Server Component) now computes the fixture itself —
`await buildUseCaseZeroDemoFixture()` — and passes the resulting plain object
as a prop to `UseCaseZeroDemoFixtureViewer`. The viewer no longer imports
anything as a VALUE from the fixture file — only as a `type` (erased at
compile time, contributes nothing to the client bundle) — and is now purely
presentational: `fixture`/`error` are props, not client-fetched state.

Neither `scripts/seedUseCaseZeroDemo.ts` nor the fixture file were modified —
the violation was entirely in the two route files.

## Verification

- `rm -rf .next && npm run build`, twice: once reproducing the original
  failure (confirming the diagnosis), once after the fix showing **zero**
  `node:crypto`/`UnhandledSchemeError` occurrences. The build then progresses
  past webpack compilation entirely and fails later at page-data-collection
  on an unrelated, pre-existing `supabaseUrl is required` error — this
  environment has no live Supabase credentials configured (a known,
  already-documented limitation, unrelated to this fix or to anything in
  `scripts/seedUseCaseZeroDemo.ts`/its fixture).
- `tests/seed-use-case-zero-demo.test.ts` (9 tests) and
  `tests/moneypenny-constitutional-risk-flow-quick-prompt.test.ts` (3 tests)
  re-run and still pass — neither file's own logic changed.

## Resolution → invariant loop

- Resolution record: `RES-2026-09-14-USE-CASE-ZERO-CLIENT-SERVER-BOUNDARY-001.json`
- Candidate invariant (status `candidate`, not self-ratified):
  `CI-2026-09-14-CLIENT-COMPONENTS-NEVER-VALUE-IMPORT-SHARED-COMPOSE-MODULES-001.json`
  — a `'use client'` component must never value-import from a shared compose
  module that carries server-only sibling imports; compute server-side and
  pass a plain prop instead. Type-only imports remain fine.
- Flagged as a follow-up (not implemented here, out of this fix's scope): no
  automated canary exists yet in this repo for this defect class — Vitest and
  `tsc --noEmit` are structurally incapable of catching it. A `next build`
  step in CI, or applying the `server-only` package convention to files like
  `scripts/seedUseCaseZeroDemo.ts` so a future violation fails loudly at
  build time instead of via an opaque webpack trace, are both worth
  considering.
