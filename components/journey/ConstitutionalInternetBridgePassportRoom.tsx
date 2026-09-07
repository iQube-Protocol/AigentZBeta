'use client';

/**
 * ConstitutionalInternetBridgePassportRoom — the PASSPORT stage's state-aware
 * surface, mirroring KnytsBridgePassportRoom's exact pattern:
 *
 *   NO USABLE PASSPORT    → claim it (the canonical PassportBureauApplyTab —
 *                           never a campaign-specific fork).
 *   PASSPORT ESTABLISHED  → a two-column post-crossing orientation surface
 *                           (mirrors Orient's own geometry) plus a
 *                           continuation toward PERSONIFY.
 *
 * `citizenPassportUsable` is the SAME evidence value the Passport stage's
 * own completion already resolves from (services/identity/passportPrincipal.ts
 * via /api/journey/constitutional-internet-bridge/state), threaded in by the
 * page's `resolveSurfaceProps`, never re-derived here (one observer, one
 * record).
 *
 * Post-crossing surface (integration pass, 2026-08-11): expanded from a
 * near-empty confirmation into a richer orientation surface, in the same
 * spirit as ConstitutionalInternetBridgeOrientIntro.tsx — left: personhood/
 * Passport media (admin-editable via the `ci-passport-established` editorial
 * config section, same pattern as `ci-orient`; falls back to the real
 * CIP-007B Bearing Instrument plate when no video is configured); right:
 * concise personhood orientation copy + ONE primary signal question —
 * "What would you like to do in the Polity?" (Create/Build/Develop/
 * Research/Safeguard), now the shared `BridgeActionModeQuestion`
 * (2026-08-12, KNYTS↔CI parity pass) — KNYTS's own PassportRoom composes the
 * SAME component, posting to its own campaign-scoped intent route. This is
 * explicitly a preference/demand signal for aigentMe, NOT an authority
 * grant, NOT Standing, NOT delegation — persisted best-effort via
 * /api/journey/constitutional-internet-bridge/passport/intent (mirrors
 * ORIENT's own best-effort campaign-event POST exactly; failure to persist
 * never blocks the visitor, and a signed-out visitor's choice is simply not
 * persisted).
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Maximize2, X } from 'lucide-react';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { BridgeActionModeQuestion } from '@/components/journey/BridgeActionModeQuestion';
import { BridgeStageCapsuleShell, BridgeStepTeachingNote } from '@/components/journey/BridgeStageCapsuleShell';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-passport-established';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');
const INTENT_POST_URL = '/api/journey/constitutional-internet-bridge/passport/intent';
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

export function ConstitutionalInternetBridgePassportRoom({ personaId, citizenPassportUsable, requestStateRefresh }: Props) {
  // Presentation-only: hiding the notice never touches Passport state,
  // evidence, or the crossing itself — it only stops re-showing a banner
  // the visitor has already acknowledged for this page visit.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  // Delegate affordance (KNYTS↔CI parity pass, 2026-09-06 — CI was missing
  // the optional post-activation delegate creation KnytsBridgePassportRoom
  // already has). `delegateModalOpen` is only the confirmation step;
  // `delegateFlowOpen` is set ONLY from the modal's own "Create delegate"
  // action, never from the row button directly — "Maybe later" is a true
  // no-op, exactly matching KNYTS's own implementation.
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegateFlowOpen, setDelegateFlowOpen] = useState(false);
  const delegateFlowRef = useRef<HTMLDivElement>(null);

  // Scroll fix (2026-09-06) — the delegate flow panel renders BELOW the
  // grid + action row, so on a shorter viewport it opened entirely beneath
  // the fold with no way to reach it. `scrollIntoView` bubbles up through
  // whatever ancestor actually scrolls (the outer page/iframe), so this
  // works regardless of the surrounding chrome — the panel it targets stays
  // untouched.
  useEffect(() => {
    if (delegateFlowOpen) {
      delegateFlowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [delegateFlowOpen]);

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
        <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">First constitutional act</p>
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
        <BridgeStepTeachingNote
          accent="indigo"
          eyebrow="What this step enables"
          title="Passport — your one first constitutional act"
          body="Claiming your Polity Citizen Passport is what makes every later step possible: it establishes your constitutional presence, so an agent can act with you and Standing can start accruing to a real identity, not an anonymous visit. You can create it in a minute — new account or sign in — and nothing here asks for more than personhood."
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
              Your constitutional presence is confirmed. Bring an agent into the field next.
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

      {/* Explicit shared row height (2026-09-06 fix) — same reasoning as
          BridgeOrientSurface's own grid: put the media's height range on
          the GRID, not the media pane, so both columns stretch to the SAME
          real height and the right capsule's internal scroll actually
          engages instead of just growing to fit its own content. */}
      <div className="grid gap-4 lg:h-[45vh] lg:max-h-[55vh] lg:min-h-[16rem] lg:grid-cols-[3fr_2fr] lg:items-stretch">
        {/* LEFT — personhood/Passport media, admin-editable video with a
            CIP-007B fallback (same pattern as Orient). The still-image
            fallback gets the same warm parchment museum-matte View mounts
            its plates in (targeted correction pass, 2026-08-11) — it reads
            as another canonical artifact in the same CI gallery system,
            not a white image floating in a dark panel. Video (rare, admin-
            configured) stays plain black-bg object-contain, matching
            View's own video-vs-plate treatment split exactly. */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
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

        {/* RIGHT — encapsulated in the same capsule shell/header treatment
            the FS bridge stages' companion column uses (2026-09-06).
            Content and affordances below are UNCHANGED. */}
        <BridgeStageCapsuleShell
          eyebrow="Passport capsule"
          description="Your constitutional presence, and what you'd like to do next."
          accentEyebrowClass="text-indigo-400/80"
        >
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {config.headline ?? KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION].headline}
              </h2>
              {introCopy && <p className="mt-2 text-[13px] leading-[1.5] text-slate-300">{introCopy}</p>}
            </div>
            <BridgeActionModeQuestion postUrl={INTENT_POST_URL} />
          </div>
        </BridgeStageCapsuleShell>
      </div>

      <BridgeStepTeachingNote
        accent="indigo"
        eyebrow="What this step enables"
        title="Passport — now that your presence is confirmed"
        body="With your Passport established, two things are yours to do here: tell aigentMe what you'd like to do in the Polity (a preference signal, not a binding commitment — Choose still decides your path), and optionally create a delegate — an agent granted bounded authority to act with you, never in your place. Neither action is required before continuing to Personify."
      />

      {/* Two peer post-activation actions (KNYTS↔CI parity pass, 2026-09-06
          — mirrors KnytsBridgePassportRoom exactly). "Create a delegate" is
          the lighter-weight action — it only opens a confirm step, never
          the delegate flow directly. "Tell your Constitutional story" keeps
          the room's original stronger styling since it remains this room's
          primary continuation. */}
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
          onClick={() => selectStage('personify')}
          className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
        >
          <span className="text-sm font-semibold text-white">Tell your Constitutional story</span>
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
        <div ref={delegateFlowRef} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
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

export default ConstitutionalInternetBridgePassportRoom;
