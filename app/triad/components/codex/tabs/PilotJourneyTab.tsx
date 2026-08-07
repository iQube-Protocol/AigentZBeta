'use client';

/**
 * PilotJourneyTab — Partner workspace "Pilot > Journey" surface (PRD-GJR-001
 * §6, §7, §14). Renders the Guided Journey Runtime for the Horizen x
 * MoneyPenny journey (services/journey/horizenMoneyPennyJourney.ts) via the
 * shared, journey-agnostic runner `JourneyRunSurface`
 * (components/journey/JourneyRunSurface.tsx, extracted 2026-08-01 so the
 * Validation Programme journey — services/journey/validationProgrammeJourney.ts
 * — can reuse the same stepper/viewport rather than forking a second one,
 * inv.engineering.036).
 *
 * This file now owns ONLY what is genuinely Horizen-specific: which agent is
 * currently being sponsored (`selectedAgentSlug`, carried into
 * RegisterAgentPanel/PassportBureauApplyTab/HorizenAgentPageSurface so they
 * agree on "which agent" rather than each independently re-resolving it —
 * operator ruling 2026-07-31), the Horizen-specific component registry, and
 * the Companion quick-links document.title signal.
 */

import { useCallback, useEffect, useState } from 'react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { AgentCardSurface } from '@/components/journey/AgentCardSurface';
import { RegisterAgentPanel, PILOT_AGENTS } from '@/components/journey/RegisterAgentPanel';
import { HorizenAgentPageSurface } from '@/components/journey/HorizenAgentPageSurface';
import { AgreementRatifyPanel } from '@/components/journey/AgreementRatifyPanel';
import { PulseTransparencyToggle } from '@/components/journey/PulseTransparencyToggle';
import { MarketaEligibilityView } from '@/components/journey/MarketaEligibilityView';
import { PassportBureauApplyTab } from './PassportBureauApplyTab';
import { BoundedDelegationTab } from './BoundedDelegationTab';
import { ParticipationStandingTab } from './ParticipationStandingTab';

interface PilotJourneyTabProps {
  personaId?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  theme?: string;
}

/**
 * Real, built journey-surface components, keyed by
 * journeySurfaceRegistry.ts's `component` name. Only surfaces the registry
 * marks `kind: 'component'` (built) resolve here — `kind: 'component-new'`
 * entries render the explicit "not yet built" state instead, never a silent
 * fallback into this map.
 *
 * PassportBureauApplyTab / BoundedDelegationTab / ParticipationStandingTab
 * are rendered bare (Guided Journey Runtime §24.4 Navigation Suppression) —
 * the same Venture Lab α Participate modules, with no cartridge nav or
 * tab-group chrome around them.
 */
const JOURNEY_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  AgentCardSurface,
  RegisterAgentPanel,
  HorizenAgentPageSurface,
  AgreementRatifyPanel,
  PulseTransparencyToggle,
  MarketaEligibilityView,
  PassportBureauApplyTab,
  BoundedDelegationTab,
  ParticipationStandingTab,
};

function PilotJourneyTabInner({ personaId, isAdmin }: PilotJourneyTabProps) {
  // Which registrable agent the Register stage is currently sponsoring
  // (services/horizen/registrableAgents.ts, MoneyPenny is the demo default).
  // The dry-run agent is the one being exercised, so it is the one selected on
  // arrival. Kept in step with PILOT_AGENTS[0] — see the note there.
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string>('nakamoto');

  /*
   * THE AGENT CARD URL MUST BE ABSOLUTE (operator, 2026-08-03).
   *
   * `registrableAgents.agentCardPath` is a PATH — '/api/agents/nakamoto/
   * agent-card.json' — and it was handed straight to the Bureau as
   * `prefillAgentCardUrl`. The Bureau anchors participant identity on that
   * value and validates it as a URL, so Delegate Passport submission refused:
   *
   *   agent_identity.agent_card.agent_card_url — Must be a valid http(s) URL
   *
   * Resolved from the BROWSER'S OWN ORIGIN rather than a configured host: the
   * card is served by this same deployment, and hardcoding a hostname would
   * both break across environments and violate the No-Guessing rule (CLAUDE.md
   * — never construct or infer a deployment URL).
   *
   * Held in state and set in an effect, never read during render: `window` is
   * undefined server-side, and reading it in a render path is the SSR/CSR
   * mismatch CLAUDE.md's State Management rule forbids. Empty until mounted,
   * which is honest — a prefill that is not yet known is simply not offered.
   */
  const [origin, setOrigin] = useState<string>('');
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const resolveSurfaceProps = useCallback(
    ({ surfaceRef, descriptor, runtimeState }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      const selectedAgent = PILOT_AGENTS.find((a) => a.slug === selectedAgentSlug) ?? PILOT_AGENTS[0];

      /*
       * IS THE OPERATOR'S PASSPORT PRESENT? — ASKED OF THE OBSERVER, ANSWERED
       * ONCE (operator, 2026-08-03: "in the passport step the decision should
       * be: is passport present? Yes = move to agent delegation path. No =
       * move to citizen passport path").
       *
       * `operatorPolityCitizenPassportValid` is the observer's own signal,
       * resolved server-side from the CANONICAL Passport read (with a journey
       * receipt only as corroboration). Read here rather than re-derived in
       * the wizard, so the stage and the surface cannot disagree about whether
       * the operator holds a Passport.
       *
       * `undefined` while the state read is in flight — passed through as
       * undefined so the wizard shows its class picker rather than guessing.
       * Absence of an answer is not an answer.
       */
      const passportStage = runtimeState?.stages.find((s) => s.stageId === 'passport');
      const passportRouteTo = passportStage
        ? passportStage.evidencePresent.includes('operatorPolityCitizenPassportValid')
          ? ('delegate' as const)
          : ('citizen' as const)
        : undefined;
      return descriptor.component === 'RegisterAgentPanel'
        ? { agentSlug: selectedAgentSlug, onAgentSlugChange: setSelectedAgentSlug }
        /* The Verify stage must speak about the agent the operator SELECTED,
           not a hardcoded MoneyPenny (operator, 2026-08-02). The tab already
           tracked the selection and the authorize route already accepted an
           agentSlug — only this surface was never handed it, so Verify
           narrated a different agent than Register had just acted on. */
        : descriptor.component === 'AgreementRatifyPanel'
          ? { agentSlug: selectedAgentSlug, agentDisplayName: selectedAgent.displayName }
        : descriptor.component === 'PulseTransparencyToggle'
          /*
           * "Run correlated trace" is a diagnostic instrument, not part of
           * the primary constitutional ceremony (operator directive,
           * 2026-08-08: "once constitutional state is receipt-driven, it
           * belongs under Evidence/Admin/diagnostics rather than in the
           * primary constitutional ceremony"). `isAdmin` already reaches
           * this component from the codex shell (PilotJourneyTabProps) —
           * it previously dead-ended here, gating nothing. Threading it
           * through as `showDiagnostics` is the same adminOnly-prop
           * pattern already used elsewhere in this codebase, never a new
           * gating mechanism.
           */
          ? { agentSlug: selectedAgentSlug, agentDisplayName: selectedAgent.displayName, showDiagnostics: isAdmin === true }
        /* Claim must speak about the agent Register/Verify just acted on, not
           a hardcoded MoneyPenny (operator, 2026-08-03 — Nakamoto's "Prove
           wallet control" resolved MoneyPenny's registry_assets row).
           MarketaEligibilityView's agentSlug is now REQUIRED for the same
           reason PulseTransparencyToggle's is: a default would silently
           restore exactly this. */
        : descriptor.component === 'MarketaEligibilityView'
          ? { agentSlug: selectedAgentSlug }
        : descriptor.component === 'PassportBureauApplyTab'
          ? {
              // Absolute, per the Bureau's URL validation — see the `origin` note above.
              prefillAgentCardUrl: origin ? `${origin}${selectedAgent.agentCardPath}` : '',
              prefillAgentDisplayName: selectedAgent.displayName,
              routeTo: passportRouteTo,
            }
          : descriptor.component === 'HorizenAgentPageSurface'
            ? { agentSlug: selectedAgentSlug, mode: surfaceRef.ref === 'horizen-agent-page-verify' ? 'verify' : 'register' }
            : {};
    },
    [selectedAgentSlug, origin, isAdmin],
  );

  return (
    <JourneyRunSurface
      journey={HORIZEN_MONEYPENNY_JOURNEY}
      /*
       * THE OBSERVER MUST WATCH THE AGENT THE SURFACES ARE ACTING ON
       * (operator, 2026-08-03: "Is the observer recognising that the wallet
       * has been proven?").
       *
       * Every SURFACE above threads `selectedAgentSlug` — RegisterAgentPanel,
       * PulseTransparencyToggle, MarketaEligibilityView and
       * HorizenAgentPageSurface each got that fix individually, each with its
       * own comment. This URL — the ONE input the observer reads — never did.
       * So `/state` fell back to DEFAULT_REGISTRABLE_AGENT_SLUG (moneypenny)
       * and `findAgentReceiptRefs('aigent-moneypenny', …)` returned nothing,
       * while the stage's own receipts drawer (persona-scoped, not
       * agent-scoped) displayed Nakamoto's `agent_control_proven` receipt in
       * plain view. Claim rendered "Awaiting: Control Proof Fresh · 0 of 2
       * recorded" directly above the very proof it was awaiting.
       *
       * The execution layer had done the act. The projection layer was
       * faithful. The OBSERVER was watching a different agent.
       */
      stateUrl={`/api/journey/moneypenny-horizen/state?agentSlug=${encodeURIComponent(selectedAgentSlug)}`}
      // Same value the observer's own stateUrl above already carries — the
      // iframe's selected agent and the observer's selected agent must never
      // diverge (al, 2026-08-04).
      selectedAgentSlug={selectedAgentSlug}
      personaId={personaId}
      documentTitle="metaMe × Horizen — Constitutional Admission Journey"
      components={JOURNEY_COMPONENTS}
      resolveSurfaceProps={resolveSurfaceProps}
      headerLabel={
        <>
          <span className="shrink-0 font-semibold text-slate-100">metaMe × Horizen</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="truncate text-slate-300">{HORIZEN_MONEYPENNY_JOURNEY.label}</span>
          <span className="shrink-0 text-slate-600">·</span>
          <span className="shrink-0 text-xs text-slate-500">Destination: aigentMe</span>
        </>
      }
    />
  );
}

export function PilotJourneyTab(props: PilotJourneyTabProps) {
  return <PilotJourneyTabInner {...props} />;
}

export default PilotJourneyTab;
