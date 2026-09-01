'use client';

/**
 * FinancialSovereigntyPrepareCrossStage — the PREPARE/CROSS segment of the
 * KNYTS/CI → Financial Services main spine (AEE-XP-001 §4.2-4.3, §5).
 * Bridge-neutral, composed by both KNYTS and CI — one implementation.
 *
 * PREPARE: the visitor picks an agent CANDIDATE from the real registrable-
 * agent catalog (`services/horizen/registrableAgents.ts` — the SAME list the
 * Financial Services Register stage itself offers) — never a registration,
 * never a delegation. The choice is held in `sessionStorage` only long
 * enough to reach CROSS on the same visit (AEE-XP-001 §4.3: "arrive with an
 * agent candidate ready to register, not with a fabricated registration").
 *
 * CROSS: builds an `ExperienceHandoff` (types/experienceHandoff.ts) carrying
 * that candidate plus return context, and navigates to the Financial
 * Services Bridge with it encoded in the URL — no server round-trip, no new
 * persistence engine (see experienceHandoffService.ts's own header for why).
 */

import { useEffect, useState } from 'react';
import { listRegistrableAgents } from '@/services/horizen/registrableAgents';
import { createExperienceHandoff, encodeExperienceHandoff } from '@/services/journey/experienceHandoffService';
import { getJourneyBranchIntent } from '@/services/journey/journeyBranchActivation';
import { WALLET_CONVERSION_CAPABILITY_ID } from '@/services/financialServices/walletConversionCapability';
import type { BridgeAccent } from '@/components/journey/BridgeMediaStage';

const FINANCIAL_SERVICES_BRANCH = 'financial-services';
/** Fallback ONLY for a direct deep link into the branch that skipped the
 *  Choose trigger (so no intent was ever declared) — never fabricates a
 *  different intent than what was actually declared when one exists. */
const DEFAULT_FINANCIAL_SERVICES_INTENT = 'JOIN_FINANCIAL_SERVICES';

const SESSION_KEY_PREFIX = 'fsHandoffAgentCandidate:';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

const ACCENT_BUTTON: Record<BridgeAccent, string> = {
  amber: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
  indigo: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
};

export function FinancialSovereigntyPrepareCrossStage({
  mode,
  accent,
  sourceJourneyId,
  sourceStageId,
  nextStageId,
  returnStageId,
}: {
  mode: 'prepare' | 'cross';
  accent: BridgeAccent;
  sourceJourneyId: string;
  sourceStageId: string;
  /** PREPARE only — the CROSS stage id to advance to once a candidate is chosen. */
  nextStageId?: string;
  /** CROSS only — the stage to resume this journey at on return from Financial Services. */
  returnStageId?: string;
}) {
  const sessionKey = `${SESSION_KEY_PREFIX}${sourceJourneyId}`;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSelected(window.sessionStorage.getItem(sessionKey));
    } catch {
      /* storage unavailable — proceeds with no pre-selected candidate */
    }
  }, [sessionKey]);

  if (mode === 'prepare') {
    const agents = listRegistrableAgents();
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="max-w-xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prepare</p>
          <h2 className="text-2xl font-semibold text-white">Choose an agent candidate to bring with you.</h2>
          <p className="text-sm text-slate-400">
            This is a candidate, not a registration — the Financial Services Bridge registers it for real, under its
            own authority checks.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-2">
          {agents.map((agent) => (
            <button
              key={agent.slug}
              type="button"
              onClick={() => {
                try {
                  window.sessionStorage.setItem(sessionKey, agent.slug);
                } catch {
                  /* non-fatal — CROSS proceeds with no candidate */
                }
                setSelected(agent.slug);
                if (nextStageId) selectStage(nextStageId);
              }}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selected === agent.slug ? ACCENT_BUTTON[accent] : 'border-slate-800 bg-slate-900/40 text-slate-200 hover:opacity-80'
              }`}
            >
              {agent.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // mode === 'cross'
  const handleCross = () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId,
      sourceStageId,
      targetJourneyId: 'horizen-moneypenny',
      targetSurfaceRef: 'register-agent-panel',
      intent:
        getJourneyBranchIntent(sourceJourneyId, FINANCIAL_SERVICES_BRANCH) ?? DEFAULT_FINANCIAL_SERVICES_INTENT,
      agentCandidateRef: selected ?? undefined,
      // AEE-Next (2026-09-01) — capability READINESS carried across the
      // crossing, never an exercise of it: the real, registered CTP
      // primitive id, so the receiving journey can make the wallet-
      // conversion capability discoverable once the crossing completes.
      // This call performs no conversion and writes no ctp_transition_evidence.
      capabilityFocus: [WALLET_CONVERSION_CAPABILITY_ID],
      // The FS Bridge is a full persistent, copilot-enabled journey (its own
      // JourneyCopilotHost mount, multi-stage register→claim/orient/passport
      // →activate→delegate→operate spine) — the deepest tier of the
      // canonical depth ladder (DEPTH_LADDER in
      // services/invariants/nodes/journeyProgression.ts: pill < capsule <
      // mini_runtime < codex). Not a guess: this is the same vocabulary
      // applied to a destination whose own nature (persistent, copilot-
      // enabled) is exactly what that ladder's "codex" tier defines.
      recommendedExperienceAltitude: 'codex',
      // No experienceEvidenceRefs: every fs-* on-ramp stage's
      // completionEvidence is intentionally empty (gate-less segment — see
      // this journey's own header comment), so there is no real evidence to
      // reference yet. Left unset rather than fabricated.
      returnJourneyId: sourceJourneyId,
      returnStageId: returnStageId ?? sourceStageId,
      rationale: 'Progressive Financial Sovereignty on-ramp handoff (AEE-XP-001 §5).',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const token = encodeExperienceHandoff(handoff);
    window.location.href = `/bridge/fs?handoff=${encodeURIComponent(token)}`;
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="max-w-xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cross</p>
        <h2 className="text-2xl font-semibold text-white">Ready for the Financial Services Bridge.</h2>
        <p className="text-sm text-slate-400">
          {selected
            ? `You're bringing an agent candidate (${selected}). The Financial Services Bridge will register it under its own authority checks — nothing is registered yet.`
            : 'You can still cross without a chosen candidate — the Financial Services Bridge will let you pick one there.'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCross}
        className={`rounded-xl border px-6 py-3 text-sm font-semibold transition ${ACCENT_BUTTON[accent]}`}
      >
        Cross to Financial Services →
      </button>
    </div>
  );
}

export default FinancialSovereigntyPrepareCrossStage;
