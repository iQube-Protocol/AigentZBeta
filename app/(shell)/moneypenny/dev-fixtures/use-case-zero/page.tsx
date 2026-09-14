/**
 * Use Case Zero demo fixture viewer — Use Case Zero build-order item 11,
 * Part 2. A DEV-ONLY route for browser QA of the Constitutional Risk Flow
 * causal chain populated with the local, non-live demo fixture
 * (`../../components/constitutionalRiskFlow/__fixtures__/useCaseZeroDemoFixture.ts`)
 * — no Supabase, no Vela, no live credential of any kind.
 *
 * ACTIVATION MECHANISM (documented per this build item's own instruction —
 * "make sure it CANNOT accidentally activate in a real deployed
 * environment, e.g. gate it behind NODE_ENV !== 'production' ... never a
 * URL param alone with no such gate"): this is a SERVER COMPONENT that
 * calls Next's `notFound()` whenever `process.env.NODE_ENV === 'production'`
 * — the route itself does not exist in a production build/runtime,
 * regardless of what URL a caller requests. There is no query-param toggle
 * anywhere in this mechanism to accidentally leave enabled; the gate is the
 * page's own existence, checked server-side before any client code runs.
 * (`NODE_ENV` is set by the Next.js/Amplify build+runtime, never a value a
 * request can influence.)
 *
 * This does not modify `ConstitutionalRiskFlowPanel.tsx` (protected,
 * build-order item 10a) at all — it is a wholly separate, additive route
 * that reuses the SAME shared presentation primitives
 * (`riskFlowSurfaceKit.tsx`) the real panel uses, per CLAUDE.md's "check for
 * existing UI primitives before hand-rolling" discipline.
 *
 * CLIENT/SERVER BOUNDARY FIX (2026-09-14, found by `next build`, not by unit
 * tests): `buildUseCaseZeroDemoFixture` is computed HERE, in this Server
 * Component, and passed to the client viewer as a plain prop.
 * `buildUseCaseZeroDemoFixture` reuses `composeUseCaseZeroDemoChain` from
 * `scripts/seedUseCaseZeroDemo.ts` (deliberately, to avoid a second,
 * driftable copy — see that fixture file's own header) — but that script's
 * OTHER top-level imports (the effectful/CLI half: `getSupabaseServer`,
 * `composeUnderwritingAdmissionEvidence`, which itself imports Aegis/DiDQube/
 * wallet-alias services that use Node's `crypto` module) come along with it
 * at the MODULE level, regardless of which named export is actually called.
 * The fixture computation itself performs no I/O and is safe to run
 * server-side (it always was — this route was never live data), but calling
 * it from a `'use client'` component pulled that whole server-only import
 * graph into the browser bundle, which webpack cannot resolve
 * (`UnhandledSchemeError: Reading from "node:crypto"`). Computing it here and
 * handing the client component only the resulting plain data object keeps
 * the client bundle free of every server-only import, without touching
 * `scripts/seedUseCaseZeroDemo.ts` or duplicating its logic.
 */

import { notFound } from 'next/navigation';
import { buildUseCaseZeroDemoFixture } from '../../components/constitutionalRiskFlow/__fixtures__/useCaseZeroDemoFixture';
import { UseCaseZeroDemoFixtureViewer } from './UseCaseZeroDemoFixtureViewer';

export default async function UseCaseZeroDemoFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  let fixture = null;
  let error: string | null = null;
  try {
    fixture = await buildUseCaseZeroDemoFixture();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return <UseCaseZeroDemoFixtureViewer fixture={fixture} error={error} />;
}
