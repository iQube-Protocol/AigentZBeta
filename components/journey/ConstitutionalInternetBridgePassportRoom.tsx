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
 * Research/Safeguard). This is explicitly a preference/demand signal for
 * aigentMe, NOT an authority grant, NOT Standing, NOT delegation — persisted
 * best-effort via /api/journey/constitutional-internet-bridge/passport/intent
 * (mirrors ORIENT's own best-effort campaign-event POST exactly; failure to
 * persist never blocks the visitor, and a signed-out visitor's choice is
 * simply not persisted).
 */

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Hammer, Shield, Sparkles, Wrench, X } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const SECTION = 'ci-passport-established';
const BEARING_INSTRUMENT = canonicalPlateImage('CIP-007B');

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

const ACTION_MODES = [
  { value: 'create', label: 'Create', icon: Sparkles, description: 'Make something new.' },
  { value: 'build', label: 'Build', icon: Hammer, description: 'Construct and ship.' },
  { value: 'develop', label: 'Develop', icon: Wrench, description: 'Grow and improve something existing.' },
  { value: 'research', label: 'Research', icon: Compass, description: 'Investigate and understand.' },
  { value: 'safeguard', label: 'Safeguard', icon: Shield, description: 'Protect and preserve.' },
] as const;

/** "What would you like to do in the Polity?" — a preference signal for
 *  aigentMe, never an authority grant. Persisted best-effort, same pattern
 *  as ConstitutionalFrontierOrientSurface's reveal(). */
function PolityIntentQuestion() {
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = (value: string) => {
    setChosen(value);
    void personaFetch('/api/journey/constitutional-internet-bridge/passport/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionMode: value }),
    }).catch(() => { /* best-effort — the selection still renders regardless */ });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-slate-900/40 p-4">
      <p className="text-xs font-medium text-slate-200">What would you like to do in the Polity?</p>
      <p className="mt-1 text-[11px] text-slate-500">
        A signal for aigentMe, not an authority grant — this never becomes Standing or delegation.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTION_MODES.map((mode) => {
          const Icon = mode.icon;
          const selected = chosen === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => choose(mode.value)}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                selected
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20'
              }`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${selected ? 'text-amber-300' : 'text-slate-500'}`} />
              <span>
                <span className="font-medium">{mode.label}</span>
                <span className="mt-0.5 block text-slate-500">{mode.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ConstitutionalInternetBridgePassportRoom({ personaId, citizenPassportUsable }: Props) {
  // Presentation-only: hiding the notice never touches Passport state,
  // evidence, or the crossing itself — it only stops re-showing a banner
  // the visitor has already acknowledged for this page visit.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION]);

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
            CIP-007B fallback (same pattern as Orient). */}
        <div className="flex h-[45vh] max-h-[55vh] min-h-[16rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          {config.videoUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              className="h-full w-full object-contain"
              controls
              poster={config.posterUrl ?? undefined}
              src={config.videoUrl}
            />
          ) : (
            BEARING_INSTRUMENT && (
              <img
                src={BEARING_INSTRUMENT.url}
                alt={BEARING_INSTRUMENT.title}
                className="h-full w-full object-contain"
              />
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
          <PolityIntentQuestion />
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
    </div>
  );
}

export default ConstitutionalInternetBridgePassportRoom;
