'use client';

/**
 * FinancialServicesBridgeFrontDoor — the ONE implementation both `/bridge/fs`
 * and `/bridge/financial-services` mount (2026-08-12, KNYTS↔CI parity pass,
 * FS Bridge section; extended 2026-08-24, Catalogue Helper closeout). Before
 * the 2026-08-12 pass, the metaMe × Horizen Constitutional Admission Journey
 * (services/journey/horizenMoneyPennyJourney.ts) was reachable ONLY through
 * the Partner cartridge's PilotJourneyTab
 * (app/triad/components/codex/tabs/PilotJourneyTab.tsx, mounted inside
 * PartnerProgrammesTab's `adminOnly` "Pilot" tab). The operator's directive
 * was explicit: expose the SAME journey at bare public routes, as thin
 * adapters — "clone PilotJourneyTab", "create a second Horizen state route",
 * "rename persisted Horizen identifiers", "move the Partner cartridge
 * implementation", and "fork any POSIT/DVN/Observer/AR logic" were all named
 * as forbidden. This component does none of that: it mounts
 * `PilotJourneyTab` itself — the exact same component, same
 * `HORIZEN_MONEYPENNY_JOURNEY` definition, same
 * `/api/journey/moneypenny-horizen/state` observer, same surfaces, same
 * receipts the Partner path renders. There is no second implementation for
 * either new URL to drift from — both, and the existing Partner path, share
 * this one component tree.
 *
 * Wallet-surface hosting mirrors the established CI/KNYTS Bridge pattern
 * exactly (usePassportSignInHost + PassportConnectPanel, the same surface
 * /invite/[code]/page.tsx uses directly) because a bare page — unlike the
 * Partner cartridge, which always has a SmartWalletDrawer mounted in its
 * CodexPanelDynamic tree — has nothing else to answer a PASSPORT_SIGN_IN
 * interrupt with. Register's own PRINCIPAL_WALLET_PROVISIONING request
 * (components/journey/RegisterAgentPanel.tsx) is NOT hosted here — that
 * ceremony was always reached through the cartridge shell's own
 * SmartWalletDrawer, and building a second wallet-hosting surface for it
 * would be exactly the forked implementation the operator's directive rules
 * out. A visitor who reaches Register from this bare front door and
 * provisions no principal wallet elsewhere sees that stage's own honest
 * "prerequisite not met" state — the same thing the Partner path shows
 * before a wallet exists, never a silent failure.
 *
 * DIRECT OPERATE DEEP-LINK (2026-08-24, Catalogue Helper closeout, refined
 * same day per operator direction — "separate metaMe activation from
 * aigentMe activation") —
 * `services/journey/catalogueDestinationHelper.ts`'s
 * `resolveJourneyOperatorDestination()` is the ONLY place this page decides
 * WHETHER MoneyPenny Orchestration is the correct Operate destination for
 * the current threshold state. Once the operator holds a usable Citizen
 * Passport, this page's DEFAULT foregrounded content is a direct embed of
 * MoneyPenny's Orchestration console — the operator never has to stop at
 * MyCanvas, the metaMe Catalogue page, or MoneyPenny's own root tab first.
 *
 * This default is deliberately NOT conditioned on the `aigentme` stage's own
 * completion. metaMe activation (what's foregrounded when Operate is
 * reached) and aigentMe activation (that stage's own welcome/focus-
 * disposition ceremony) are two separate things:
 *   - metaMe = the operating environment. Default at Operate: MoneyPenny
 *     Orchestration.
 *   - aigentMe = one agent/capability WITHIN that environment, reachable
 *     through the "Explore metaMe ↗" affordance below (which expands the
 *     SAME embed to full canonical metaMe navigation — see the FS Operate
 *     viewport note) or through the stage stepper's own normal navigation.
 *
 * `services/journey/horizenMoneyPennyJourney.ts` is completely untouched:
 * the `aigentme` stage's `completionEvidence` (`focusDispositionRecorded`)
 * is still only recordable inside the aigentme-welcome shell's Welcome
 * Capsule, reached exactly as before — by navigating to aigentMe from within
 * the MoneyPenny embed's own expanded/full navigation chrome or through the
 * stage stepper's own normal navigation. MoneyPenny never records, derives,
 * or synthesizes that evidence — it has no code path that references it at
 * all. Journey guidance determines the recommended/default path, never the
 * maximum accessible capability depth: a task-focused operator can stay
 * entirely inside MoneyPenny; an advanced operator can expand into full
 * metaMe and reach aigentMe (or anything else) exactly as today.
 *
 * FS OPERATE VIEWPORT + FOCUS/FULL PARITY (2026-08-25) — the foreground
 * override for Operate is now a `foregroundSurfaceRefByStage` REF
 * (`'moneypenny-orchestration-focused'`, journeySurfaceRegistry.ts), not a
 * hand-built `<iframe>`. This closes a real Amplify-visible defect: the old
 * hand-built `<div className="flex h-full flex-col"><iframe
 * className="w-full flex-1">` had no resolved ancestor height for
 * `h-full`/`flex-1` to resolve against (JourneyRunSurface wraps foreground
 * nodes in ordinary auto-height divs), so the iframe collapsed to its
 * intrinsic browser height — unusable for MoneyPenny's own modals. Routing
 * through the registry ref instead means this destination renders through
 * the EXACT SAME `descriptor.kind === 'embed'` switch every ordinary journey
 * surface uses (JourneyRunSurface.tsx), inheriting its `h-[calc(100vh-200px)]`
 * focused-viewport height, its Focus/Full in-place toggle, and its
 * copilot-suppression handling for free — never a second, hand-rolled
 * version of any of them. Also supersedes the earlier FS-specific decision
 * to always embed MoneyPenny with full navigation chrome: the default is
 * now FOCUSED (metaMe's primary cartridge chrome suppressed, matching every
 * other focused Bridge embed), with the registry entry's own `openLabel`
 * ("Explore metaMe ↗") the explicit, reversible affordance into full
 * canonical metaMe navigation — never a second page, never a second iframe.
 *
 * JOURNEY RUNTIME COPILOT INVARIANT (item 1, semantic repair 2026-08-25) —
 * the single floating copilot is no longer mounted here by hand. It is now
 * `JourneyCopilotHost`, mounted once from the shared `JourneyRunSurface`
 * runner itself, resolving MoneyPenny's identity
 * (`aigent-moneypenny` — the platform's primary Constitutional Financial
 * Services Agent, PRD-MPY-001) from
 * `HORIZEN_MONEYPENNY_JOURNEY.copilot` (data/codex-configs.ts's
 * `MONEYPENNY_CARTRIDGE.copilot`) — never hand-copied here anymore. It
 * stays mounted across every stage, including Operate/aigentme, and is
 * still NEVER doubled by a copilot inside the MoneyPenny Orchestration
 * embed: the `'moneypenny-orchestration-focused'` registry entry declares
 * `suppressFloatingCopilot: true`, the same mechanism `aigentme-welcome`
 * already uses (MS-1).
 *
 * `MetaAvatarProvider`/`MetaAvatarHost` still wrap this bare page for the
 * same reason KNYTS/CI Bridge each add their own instance (2026-08-10/11) —
 * this page sits outside both `app/(shell)/layout.tsx` and
 * `app/(embed)/layout.tsx`, the only two places that otherwise supply the
 * context `CodexCopilotLayer`'s `useMetaAvatar()` requires (still needed by
 * `JourneyCopilotHost`, which uses that same layer).
 */

import { useCallback, useEffect, useState } from 'react';
import { PilotJourneyTab } from '@/app/triad/components/codex/tabs/PilotJourneyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';
import { usePersonaSpine } from '@/utils/personaSpine';
import { PersonaProvider, usePersona } from '@/app/contexts/PersonaContext';
import { MetaAvatarProvider } from '@/app/contexts/MetaAvatarContext';
import { MetaAvatarHost } from '@/app/components/metaVatar/MetaAvatarHost';
import type { JourneyRuntimeState } from '@/types/journey';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { decodeExperienceHandoff } from '@/services/journey/experienceHandoffService';
import { setSelectedPilotAgentSlug } from '@/services/journey/selectedPilotAgent';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { WALLET_CONVERSION_CAPABILITY_ID } from '@/services/financialServices/walletConversionCapability';

/** Sessionstorage key holding the return context from an incoming
 *  ExperienceHandoff — read by a future "return to <source>" affordance.
 *  Consuming the handoff never fabricates registration/Passport/delegation
 *  state; it only pre-selects an agent CANDIDATE and remembers where to
 *  resume (AEE-XP-001 §4.3, §5). */
export const FS_BRIDGE_RETURN_CONTEXT_KEY = 'fsHandoffReturnContext';

/**
 * AEE-Next (2026-09-01) — set ONLY when the incoming handoff's
 * `capabilityFocus` names the real wallet-conversion primitive id
 * (WALLET_CONVERSION_CAPABILITY_ID). Records READINESS only — this journey
 * still resolves whether the capability is actually reachable (Passport,
 * delegation, wallet state) entirely from its own canonical state, exactly
 * as before; this flag never grants, executes, or implies a conversion.
 * The real conversion surface remains the SAME `SmartWalletDrawer` every
 * other MoneyPenny surface already uses (CLAUDE.md "Wallet-Over-Cartridge
 * Overlay") — this journey adds no second wallet UI.
 */
export const FS_BRIDGE_WALLET_CAPABILITY_KEY = 'fsHandoffWalletConversionCapabilityAvailable';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

/**
 * Persisted operator context inheritance (Journey 0 closure item 1,
 * 2026-09-06) — this bare page sits outside both `app/(shell)/layout.tsx`
 * and `app/(embed)/layout.tsx`, so it previously had no `PersonaProvider`
 * ancestor and hand-rolled its own one-shot `localStorage.getItem
 * ('currentPersonaId')` read on mount instead. That read never re-fired on
 * a `storage` event, a cross-frame `metame:persona-changed`/
 * `aa-persona-change-v1` broadcast, or a persona switch made through
 * `ActivePersonaControl`'s own `SmartWalletDrawer` inside the journey
 * header — so an operator who already held an established aigentMe/metaMe
 * persona (session restored asynchronously, persona switched in another
 * tab, or established moments after this component mounted) still landed
 * on the pre-Passport/Register path instead of directly at Operate, even
 * though their Passport was already valid. `resolveJourneyOperatorDestination`
 * below only resolves `CATALOGUE_ACTIVATION` (direct MoneyPenny Operate)
 * once the observer's state read — keyed on this component's own
 * `personaId` — actually reflects the operator's real persona; a stale
 * `personaId` produced a stale, or entirely undetermined, Passport read.
 *
 * Fixed by mounting the SAME `PersonaProvider` / `usePersona()` seam every
 * other surface in the platform already shares (`app/contexts/
 * PersonaContext.tsx`) — never a second persona store, wallet abstraction,
 * or onboarding state. `PersonaProvider` already hydrates from
 * localStorage/sessionStorage (plus legacy key fallbacks) on mount, stays
 * in sync via the native `storage` event, and is the same instance
 * `ActivePersonaControl`'s wallet-driven persona switch (via
 * `onPersonaChange`) and `PassportConnectPanel`'s sign-in completion now
 * both write through — so an advanced user is never asked to repeat
 * onboarding, and quarantine/eligibility remain exactly where they always
 * were: resolved server-side by `getActivePersona`/`evaluateAccess`, never
 * touched by this component.
 */
export function FinancialServicesBridgeFrontDoor() {
  return (
    <PersonaProvider>
      <FinancialServicesBridgeFrontDoorInner />
    </PersonaProvider>
  );
}

function FinancialServicesBridgeFrontDoorInner() {
  const { activePersonaId, setActivePersonaId } = usePersona();
  const personaId = activePersonaId ?? undefined;
  usePersonaSpine();

  // Derived exclusively from onRuntimeStateChange — never re-read from a
  // second observer (CFS-055 coherence discipline, same as the CI bridge).
  const [citizenPassportUsable, setCitizenPassportUsable] = useState<boolean | undefined>(undefined);

  /*
   * THE aigentme STAGE'S OWN COMPLETION, NOT JUST A VALID PASSPORT
   * (Factor Operate blocker, diagnosed 2026-09-06).
   *
   * The 2026-08-24/2026-08-25 foreground override below used to fire the
   * instant `citizenPassportUsable` was true — but `aigentme`'s OWN
   * completionEvidence (`aigentMeActive`, `focusDispositionRecorded`,
   * horizenMoneyPennyJourney.ts) is a SEPARATE fact from Passport validity,
   * and is recordable ONLY inside the canonical `aigentme-welcome` surface
   * this override replaces. A Passport-holding operator who had not yet
   * completed that ceremony was routed straight past the one surface that
   * could ever complete it — Operate could never turn green, and the
   * deployed override additionally misrouted to metaMe's own first-enabled
   * tab whenever MoneyPenny's own group activation had not separately been
   * granted (CodexPanelDynamic's `enabledTabs.find(...) || enabledTabs[0]`
   * fallback — see the moneypenny-orchestration-focused registry entry's
   * `autoActivate` fix for the other half of that).
   *
   * Never regresses once true within a session (`||`) — the SAME
   * monotonic-within-session precedent RegisterAgentPanel/AgreementRatifyPanel
   * already establish for their own canonical-projection reads, so a
   * transient/slow re-read can never flip a completed ceremony back to
   * incomplete and re-show it.
   */
  const [aigentmeStageComplete, setAigentmeStageComplete] = useState(false);

  const handleRuntimeStateChange = useCallback((state: JourneyRuntimeState) => {
    const passportStage = state.stages.find((s) => s.stageId === 'passport');
    setCitizenPassportUsable(Boolean(passportStage?.evidencePresent.includes('operatorPolityCitizenPassportValid')));

    const aigentmeStage = state.stages.find((s) => s.stageId === 'aigentme');
    const aigentmeComplete = Boolean(
      aigentmeStage?.evidencePresent.includes('aigentMeActive') &&
        aigentmeStage?.evidencePresent.includes('focusDispositionRecorded'),
    );
    if (aigentmeComplete) setAigentmeStageComplete(true);
  }, []);

  // AEE-XP-001 §4.3/§15 Phase 1 item 6 — consume an incoming ExperienceHandoff
  // from a KNYTS/CI Financial Sovereignty crossing. This ONLY pre-selects an
  // agent CANDIDATE (via the SAME shared selectedPilotAgent mechanism every
  // Horizen surface already reads — services/journey/selectedPilotAgent.ts)
  // and remembers return context for a future "return to <source>"
  // affordance; it never sets Passport, delegation, or registration state —
  // this journey resolves all of that itself, from its own canonical state,
  // exactly as before.
  useEffect(() => {
    try {
      const token = new URL(window.location.href).searchParams.get('handoff');
      if (!token) return;
      const handoff = decodeExperienceHandoff(token);
      if (!handoff) return;
      if (handoff.agentCandidateRef && resolveRegistrableAgent(handoff.agentCandidateRef)) {
        setSelectedPilotAgentSlug(handoff.agentCandidateRef);
      }
      if (handoff.returnJourneyId) {
        window.sessionStorage.setItem(
          FS_BRIDGE_RETURN_CONTEXT_KEY,
          JSON.stringify({ returnJourneyId: handoff.returnJourneyId, returnStageId: handoff.returnStageId ?? null }),
        );
      }
      if (Array.isArray(handoff.capabilityFocus) && handoff.capabilityFocus.includes(WALLET_CONVERSION_CAPABILITY_ID)) {
        window.sessionStorage.setItem(FS_BRIDGE_WALLET_CAPABILITY_KEY, 'true');
      }
      selectStage('register');
    } catch {
      /* malformed/absent handoff — proceeds exactly as a direct visit would */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost(
    'FinancialServicesBridgeFrontDoor',
  );

  // Fails visibly if the registered destination stops resolving (a renamed
  // catalogue id, a deleted tab) — never a silent fallback to a generic
  // surface. citizenPassportUsable defaults to false (PRE_PASSPORT) while
  // the first read is in flight, which is the correct fail-safe: an unknown
  // threshold state must never resolve to CATALOGUE_ACTIVATION. Only
  // `valid`/`activationMode` are consumed here — WHICH ref presents that
  // destination is the registry's job (`.route` is unused; see the FS
  // Operate viewport note above), so no `navOptions` is passed.
  const destination = resolveJourneyOperatorDestination({
    journeyId: HORIZEN_MONEYPENNY_JOURNEY.id,
    participantState: { citizenPassportUsable: citizenPassportUsable === true },
  });

  /*
   * Projection layer: MoneyPenny Orchestration becomes the foreground for
   * aigentme (product-facing "Operate" label) ONLY AFTER the aigentme
   * stage's own canonical completion evidence exists — never before
   * (Factor Operate blocker fix, 2026-09-06; supersedes the 2026-08-24
   * "post-Passport" gating, which fired this override BEFORE the
   * ceremony could ever run and made Operate permanently uncompletable
   * for exactly the operators it targeted). The Journey Spine and all
   * navigation remain unchanged (operator direction, 2026-08-24: "separate
   * metaMe activation from aigentMe activation") — the stage stepper stays
   * visible throughout; only the aigentme stage's surface ref is
   * overridden, and only once there is nothing left for that surface to
   * produce. `destination.valid`/`activationMode` still gate WHETHER
   * MoneyPenny is even a registered, resolvable destination at all; WHICH
   * ref presents it is the registry's job either way (FS Operate viewport
   * parity, 2026-08-25 — see the 'moneypenny-orchestration-focused'
   * registry entry). If resolution fails, or the ceremony is not yet
   * complete, this stays undefined and PilotJourneyTab renders the normal,
   * canonical aigentme-welcome surface.
   */
  const foregroundSurfaceRefByStage =
    destination.valid && destination.activationMode === 'CATALOGUE_ACTIVATION' && aigentmeStageComplete
      ? { aigentme: 'moneypenny-orchestration-focused' }
      : undefined;

  return (
    <MetaAvatarProvider defaultAgent="aigent-moneypenny">
    <div className="h-screen bg-slate-950 text-slate-100">
      <PilotJourneyTab
        personaId={personaId}
        onRuntimeStateChange={handleRuntimeStateChange}
        foregroundSurfaceRefByStage={foregroundSurfaceRefByStage}
        onPersonaChange={setActivePersonaId}
      />

      {showPassportSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
            <PassportConnectPanel
              world="application"
              embedded
              onConnected={() => {
                try {
                  const stored = window.localStorage.getItem('currentPersonaId');
                  if (stored) setActivePersonaId(stored);
                } catch {
                  /* ignore */
                }
                completeSignIn();
              }}
            />
            <button
              type="button"
              onClick={dismissSignIn}
              className="w-full border-t border-white/10 px-4 py-2.5 text-[12px] text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
    <MetaAvatarHost />
    </MetaAvatarProvider>
  );
}

export default FinancialServicesBridgeFrontDoor;
