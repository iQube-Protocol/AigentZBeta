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

const SECTION = 'ci-passport-established';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');
const INTENT_POST_URL = '/api/journey/constitutional-internet-bridge/passport/intent';

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

export function ConstitutionalInternetBridgePassportRoom({ personaId, citizenPassportUsable }: Props) {
  // Presentation-only: hiding the notice never touches Passport state,
  // evidence, or the crossing itself — it only stops re-showing a banner
  // the visitor has already acknowledged for this page visit.
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
        <PassportBureauApplyTab personaId={personaId} routeTo="citizen" />
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

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — personhood/Passport media, admin-editable video with a
            CIP-007B fallback (same pattern as Orient). The still-image
            fallback gets the same warm parchment museum-matte View mounts
            its plates in (targeted correction pass, 2026-08-11) — it reads
            as another canonical artifact in the same CI gallery system,
            not a white image floating in a dark panel. Video (rare, admin-
            configured) stays plain black-bg object-contain, matching
            View's own video-vs-plate treatment split exactly. */}
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

        {/* RIGHT — orientation copy + the primary signal question. */}
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
        onClick={() => selectStage('personify')}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="text-sm font-semibold text-white">Tell your Constitutional story</span>
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

export default ConstitutionalInternetBridgePassportRoom;
