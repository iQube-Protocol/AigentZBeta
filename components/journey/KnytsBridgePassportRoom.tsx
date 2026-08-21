'use client';

/**
 * KnytsBridgePassportRoom — the PASSPORT stage's state-aware surface,
 * reconstituted onto the CI Passport framework (2026-08-12, KNYTS↔CI parity
 * pass) rather than its own bespoke shape. Mirrors
 * ConstitutionalInternetBridgePassportRoom's exact pattern:
 *
 *   NO USABLE PASSPORT    → claim it (the canonical PassportBureauApplyTab —
 *                           never a campaign-specific fork).
 *   PASSPORT ESTABLISHED  → a dismissible "you have crossed" banner, a
 *                           parchment-matte plate pane (fullscreenable), the
 *                           SAME shared `BridgeActionModeQuestion`
 *                           (Create/Build/Develop/Research/Safeguard) CI
 *                           composes — never a second questionnaire — and
 *                           TWO peer post-activation actions: "Create a
 *                           delegate" and "Tell your own story".
 *
 * The prior behavior — auto-embedding the full aigentMe dashboard iframe the
 * instant a Passport was usable — is retired: KNYTS is personhood-first
 * (knytsBridgeCrossingJourney.ts's header note), and Passport completion
 * itself never REQUIRES a delegate. Delegate creation remains optional — but
 * (operator ruling, 2026-08-21) it is now intentionally EXPOSED as an
 * optional post-activation capability right here on the Passport-established
 * state, confirm-gated by a dismissible modal, rather than being reserved
 * exclusively for Remix/PERSONIFY. "Tell your own story" advances to REMIX,
 * matching `nextStageId: 'remix'` on the PASSPORT stage; "Create a delegate"
 * opens the canonical Agent/Participant Passport flow
 * (`PassportBureauApplyTab`, `routeTo="delegate"`) inline, once confirmed —
 * never a KNYTS-specific delegate wizard.
 *
 * `citizenPassportUsable` is the SAME evidence value the Passport stage's
 * own completion already resolves from (services/identity/passportPrincipal.ts
 * via /api/journey/knyts-bridge/state) — threaded in by the page's
 * `resolveSurfaceProps`, never re-derived here (one observer, one record).
 */

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Maximize2, X } from 'lucide-react';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { BridgeActionModeQuestion } from '@/components/journey/BridgeActionModeQuestion';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'passport-established';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');
const INTENT_POST_URL = '/api/journey/knyts-bridge/passport/intent';
const NOTICE_AUTO_DISMISS_MS = 2750;

interface Props {
  personaId?: string;
  /** Undefined while the journey's first state read is still in flight —
   *  treated the same as "not yet established" so the claim flow is always
   *  the safe default until evidence says otherwise. */
  citizenPassportUsable?: boolean;
  /**
   * CFS-055 coherence pass (2026-08-12) — threaded straight from
   * JourneyRunSurface's `resolveSurfaceProps` seam (`requestStateRefresh`).
   * Passed to PassportBureauApplyTab as `onUsablePassportDetected` so that
   * when the Bureau discovers an existing usable Citizen Passport (wallet
   * auth sign-in), the enclosing observer rereads authoritative state —
   * this room never sets `citizenPassportUsable` itself, and never advances
   * the stage; the Journey's own next `/state` read is what flips this
   * room from the claim branch to the established branch below.
   */
  requestStateRefresh?: () => void;
}

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export function KnytsBridgePassportRoom({ personaId, citizenPassportUsable, requestStateRefresh }: Props) {
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  // Delegate affordance (operator ruling, 2026-08-21) — a confirm-gated,
  // dismissible entry into the CANONICAL Agent/Participant Passport flow.
  // `delegateModalOpen` is only the confirmation step; `delegateFlowOpen`
  // is set ONLY from the modal's own "Create delegate" action, never from
  // the row button directly — "Maybe later" must be a true no-op.
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegateFlowOpen, setDelegateFlowOpen] = useState(false);

  useEffect(() => {
    if (!citizenPassportUsable) return;
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${SECTION}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [citizenPassportUsable]);

  useEffect(() => {
    if (!citizenPassportUsable || noticeDismissed) return;
    const timer = setTimeout(() => {
      setNoticeDismissed(true);
    }, NOTICE_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [citizenPassportUsable, noticeDismissed]);

  if (!citizenPassportUsable) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">First constitutional act</p>
          <p className="mt-1 text-sm text-slate-300">Claim your Polity Citizen Passport.</p>
        </div>
        {/* Both crossings this Bridge hosts are explicitly human/Citizen —
            `routeTo="citizen"` reuses the SAME auto-route mechanism
            PilotJourneyTab already drives from its own observer
            (autoRoutedRef effect in PassportBureauApplyTab.tsx), so the
            wizard skips the generic Citizen/Agent class picker and opens
            directly on the Citizen route's own next step: Account (New
            account | Sign in) when signed out, or straight to Personhood
            binding when a Bureau session already exists. No new deep-link
            parameter, no fork — the same prop the Bureau already supports. */}
        <PassportBureauApplyTab
          personaId={personaId}
          routeTo="citizen"
          onUsablePassportDetected={requestStateRefresh}
        />
      </div>
    );
  }

  const introCopy = (config.shortCopy ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].shortCopy ?? '')
    .split('\n\n')
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-3">
      {!noticeDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-200">You have crossed the threshold.</p>
            <p className="mt-0.5 text-xs text-emerald-300/80">
              Your constitutional presence is confirmed. Tell your own crossing when you're ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoticeDismissed(true)}
            aria-label="Dismiss notice"
            title="Dismiss — this only hides the notice, it does not undo your crossing"
            className="shrink-0 rounded-md p-0.5 text-emerald-300/60 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — personhood/Passport media, admin-editable video with a
            CIP-007B fallback (same pattern as CI's own room), mounted in the
            same warm parchment museum-matte View/Orient use elsewhere. */}
        <div className="relative flex h-[45vh] max-h-[55vh] min-h-[16rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setFullscreenImage(true)}
            aria-label="Fullscreen"
            title="Fullscreen"
            className="absolute right-3 top-3 z-10 rounded-md bg-slate-900/60 p-2 text-slate-300 transition hover:bg-slate-900 hover:text-slate-100"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {config.videoUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              className="h-full w-full bg-black object-contain"
              controls
              poster={config.posterUrl ?? undefined}
              src={config.videoUrl}
            />
          ) : (
            BEARING_INSTRUMENT && (
              <ArtifactMattedFrame>
                <img
                  src={BEARING_INSTRUMENT.url}
                  alt={BEARING_INSTRUMENT.title}
                  className="max-h-full max-w-full object-contain"
                />
              </ArtifactMattedFrame>
            )
          )}
        </div>

        {/* RIGHT — orientation copy + the shared signal question. */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              {config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline}
            </h2>
            {introCopy && <p className="mt-2 text-[13px] leading-[1.5] text-slate-300">{introCopy}</p>}
          </div>
          <BridgeActionModeQuestion postUrl={INTENT_POST_URL} />
        </div>
      </div>

      {/* Two peer post-activation actions (operator ruling, 2026-08-21).
          "Create a delegate" is the lighter-weight action — it only opens
          a confirm step, never the delegate flow directly. "Tell your own
          story" keeps the room's original stronger styling (amber hover,
          arrow) since it remains this room's primary continuation. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setDelegateModalOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 transition hover:bg-slate-900/60"
        >
          <span className="text-sm font-medium text-slate-300">Create a delegate</span>
        </button>
        <button
          type="button"
          onClick={() => selectStage('remix')}
          className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 transition hover:border-amber-400/30"
        >
          <span className="text-sm font-semibold text-white">Tell your own story</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <ConfirmDialog
        open={delegateModalOpen}
        title="Create your delegate"
        description="Give an agent bounded authority to act with you in the Polity. You can do this now or come back later."
        confirmText="Create delegate"
        cancelText="Maybe later"
        onConfirm={() => {
          setDelegateModalOpen(false);
          setDelegateFlowOpen(true);
        }}
        onCancel={() => setDelegateModalOpen(false)}
      />

      {delegateFlowOpen && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">Create your delegate</p>
            <button
              type="button"
              onClick={() => setDelegateFlowOpen(false)}
              aria-label="Close"
              title="Close"
              className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* THE CANONICAL Agent/Participant Passport flow — the SAME
              component this room already mounts for the Citizen path
              above, routed to its existing agent-delegation entry
              (`routeTo="delegate"`). Never a KNYTS-specific wizard. */}
          <PassportBureauApplyTab personaId={personaId} routeTo="delegate" />
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="h-full w-full">
            <div className="flex h-full items-center justify-center">
              {config.videoUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  className="max-h-full max-w-full bg-black object-contain"
                  controls
                  autoPlay
                  poster={config.posterUrl ?? undefined}
                  src={config.videoUrl}
                />
              ) : (
                BEARING_INSTRUMENT && (
                  <img
                    src={BEARING_INSTRUMENT.url}
                    alt={BEARING_INSTRUMENT.title}
                    className="max-h-full max-w-full object-contain"
                  />
                )
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFullscreenImage(false)}
            aria-label="Close fullscreen"
            title="Close (Esc)"
            className="absolute right-4 top-4 rounded-md bg-slate-900/60 p-2 text-slate-300 transition hover:bg-slate-900 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default KnytsBridgePassportRoom;
