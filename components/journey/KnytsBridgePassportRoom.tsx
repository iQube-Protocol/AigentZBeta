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
 *                           parchment-matte plate pane (fullscreenable), and
 *                           the SAME shared `BridgeActionModeQuestion`
 *                           (Create/Build/Develop/Research/Safeguard) CI
 *                           composes — never a second questionnaire.
 *
 * The prior behavior — auto-embedding the full aigentMe dashboard iframe the
 * instant a Passport was usable — is retired: KNYTS is personhood-first
 * (knytsBridgeCrossingJourney.ts's header note), and meeting/delegating to
 * aigentMe is a PERSONIFY/Remix-time decision, not something Passport should
 * force on every visitor immediately on establishment. The continuation
 * button below advances to REMIX (telling your own crossing), matching
 * `nextStageId: 'remix'` on the PASSPORT stage.
 *
 * `citizenPassportUsable` is the SAME evidence value the Passport stage's
 * own completion already resolves from (services/identity/passportPrincipal.ts
 * via /api/journey/knyts-bridge/state) — threaded in by the page's
 * `resolveSurfaceProps`, never re-derived here (one observer, one record).
 */

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Maximize2, X } from 'lucide-react';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
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

interface Props {
  personaId?: string;
  /** Undefined while the journey's first state read is still in flight —
   *  treated the same as "not yet established" so the claim flow is always
   *  the safe default until evidence says otherwise. */
  citizenPassportUsable?: boolean;
}

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export function KnytsBridgePassportRoom({ personaId, citizenPassportUsable }: Props) {
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);
  const [fullscreenImage, setFullscreenImage] = useState(false);

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

  if (!citizenPassportUsable) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">First constitutional act</p>
          <p className="mt-1 text-sm text-slate-300">Claim your Polity Citizen Passport.</p>
        </div>
        <PassportBureauApplyTab personaId={personaId} />
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
            <p className="text-sm font-semibold text-emerald-200">You have crossed.</p>
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

      <button
        type="button"
        onClick={() => selectStage('remix')}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 transition hover:border-amber-400/30"
      >
        <span className="text-sm font-semibold text-white">Tell your own crossing</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>

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
