'use client';

/**
 * Client-side renderer for the Use Case Zero demo fixture (see
 * `page.tsx`'s own header for the activation-safety mechanism). Renders a
 * simplified, standalone view of the causal chain + a switcher between the
 * operator/global view and each of the three parties' redacted views — NOT
 * a byte-identical copy of `ConstitutionalRiskFlowPanel.tsx` (protected;
 * never modified here), but built from the SAME shared
 * `riskFlowSurfaceKit.tsx` primitives that panel uses, so the visual
 * language matches.
 *
 * Every render carries an unmistakable amber "DEMO / LOCAL FIXTURE" banner
 * — this data is never live, never persisted, and never fetched from any
 * route.
 *
 * PURELY PRESENTATIONAL (2026-09-14 fix — see `page.tsx`'s own header for
 * why): this component receives the already-computed `fixture` as a plain
 * prop from the Server Component that renders it. It imports
 * `useCaseZeroDemoFixture.ts` ONLY as a `type` (erased at compile time, so
 * it adds nothing to the client bundle) — it never imports or calls
 * `buildUseCaseZeroDemoFixture` itself, which is what previously pulled
 * `scripts/seedUseCaseZeroDemo.ts`'s server-only import graph (Supabase,
 * Aegis, DiDQube, `node:crypto`) into the browser bundle.
 */

import { useState } from 'react';
import type { UseCaseZeroDemoFixture } from '../../components/constitutionalRiskFlow/__fixtures__/useCaseZeroDemoFixture';
import type {
  ConstitutionalRiskFlowState,
  ConstitutionalRiskFlowStepId,
} from '@/services/vela/velaUnderwritingChainProjection';
import type { ConstitutionalRiskFlowParticipantView } from '@/services/vela/velaUnderwritingPartyView';
import {
  RiskFlowSection,
  RiskFlowCapsule,
  RiskFlowStepChip,
  RiskFlowFieldRow,
  RiskFlowProviderModeBadge,
  classifyProviderMode,
} from '../../components/constitutionalRiskFlow/riskFlowSurfaceKit';

const STEP_ORDER: ConstitutionalRiskFlowStepId[] = [
  'select', 'admit', 'authorize', 'freeze', 'execute', 'quote', 'settle', 'receipt', 'telemetry',
];
const STEP_LABELS: Record<ConstitutionalRiskFlowStepId, string> = {
  select: 'Select', admit: 'Admit', authorize: 'Authorize', freeze: 'Freeze',
  execute: 'Execute', quote: 'Quote', settle: 'Settle', receipt: 'Receipt', telemetry: 'Telemetry',
};

type ViewKey = 'operator' | 'party-a' | 'party-b' | 'party-c';

function renderableState(
  fixture: UseCaseZeroDemoFixture,
  view: ViewKey,
): ConstitutionalRiskFlowState | ConstitutionalRiskFlowParticipantView {
  return view === 'operator' ? fixture.state : fixture.participantViews[view];
}

interface UseCaseZeroDemoFixtureViewerProps {
  fixture: UseCaseZeroDemoFixture | null;
  error: string | null;
}

export function UseCaseZeroDemoFixtureViewer({ fixture, error }: UseCaseZeroDemoFixtureViewerProps) {
  const [view, setView] = useState<ViewKey>('operator');

  return (
    <div className="min-h-full space-y-4 bg-slate-950 p-4">
      <div className="flex items-center gap-2 rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
        <span>DEMO / LOCAL FIXTURE</span>
        <span className="font-normal text-amber-300/80">
          — non-live, in-memory data. No Supabase, no Vela, no real receipts.
        </span>
      </div>

      <RiskFlowSection title="Use Case Zero — Constitutional Risk Flow (fixture)">
        <p className="text-xs text-slate-400">
          ArkAgent (party-a) / Aigent Nakamoto (party-b) / Aigent Kn0w1 (party-c) — a jointly-computed
          underwriting request, rendered from the local demo fixture.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['operator', 'party-a', 'party-b', 'party-c'] as ViewKey[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
                view === v
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                  : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {v === 'operator' ? 'Operator view' : `View as ${v}`}
            </button>
          ))}
        </div>
      </RiskFlowSection>

      {error && <p className="text-xs text-rose-300">Fixture build failed: {error}</p>}
      {!fixture && !error && <p className="text-xs text-slate-500">Fixture unavailable.</p>}

      {fixture && (
        <div className="space-y-2">
          {STEP_ORDER.map((id) => {
            const state = renderableState(fixture, view);
            const step = state[id];
            const visible = 'visible' in step ? step.visible : true;
            return (
              <RiskFlowCapsule
                key={id}
                title={STEP_LABELS[id]}
                badge={<RiskFlowStepChip state={step.state} />}
                defaultOpen
              >
                <p className="text-xs text-slate-400">{step.reason}</p>
                {!visible && <p className="text-[11px] text-amber-300/80">Redacted for this party.</p>}
                {id === 'select' && visible && 'selectionRef' in step && step.selectionRef && (
                  <RiskFlowFieldRow label="Candidate agent" value={step.candidateAgentId} />
                )}
                {id === 'quote' && visible && 'quote' in step && step.quote && (
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <RiskFlowFieldRow label="Risk band" value={step.quote.riskBand} />
                    <RiskFlowFieldRow label="Coverage limit" value={step.quote.coverageLimit} />
                    <RiskFlowFieldRow label="Premium" value={step.quote.premium} />
                    <RiskFlowFieldRow
                      label="Provider mode"
                      value={<RiskFlowProviderModeBadge mode={classifyProviderMode(step.quote.providerMode)} />}
                    />
                  </div>
                )}
              </RiskFlowCapsule>
            );
          })}
        </div>
      )}
    </div>
  );
}
