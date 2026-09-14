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
 */

import { notFound } from 'next/navigation';
import { UseCaseZeroDemoFixtureViewer } from './UseCaseZeroDemoFixtureViewer';

export default function UseCaseZeroDemoFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <UseCaseZeroDemoFixtureViewer />;
}
