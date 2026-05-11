/**
 * AigentMeWelcomeTab — metaMe cartridge welcome takeover.
 *
 * Phase 1 of the metaMe Personal Assistant Alpha (Aigent Me).
 *
 * Reads /api/assistant/bootstrap and renders:
 *   - Greeting ("metaMe Personal Assistant, powered by Aigent Me")
 *   - ExperienceModel state (configured? primary stage?)
 *   - Context chips (active cartridges + Metayé Media + Google Workspace)
 *   - Primary CTAs (PRD §9.1) — alpha-preview state until backend phases land
 *   - Specialist directory (Marketa / Quill / Kn0w1 / Aigent Z / Aigent C)
 *   - Locked naming notice
 *
 * Backends for the CTAs land in subsequent phases:
 *   Phase 2 — ExperienceModel setup
 *   Phase 3 — Brief / Move forward
 *   Phase 4 — Venture progress
 *   Phase 5 — Specialist routing
 *   Phase 6 — Artifact creation + approvals
 *   Phase 7 — Receipts
 */

"use client";

/**
 * Reference implementation for the PersonaSpine client protocol.
 * Every other surface (tab, sub-tab, drawer, chip, capsule, ExperienceQube,
 * iQube card, modal) follows this exact pattern:
 *
 *   1. const spine = usePersonaSpine({ personaIdHint });
 *   2. <PersonaSpineGate state={spine}> ...your render... </PersonaSpineGate>
 *   3. For data fetches: personaFetch('/api/...', { personaIdHint });
 *
 * See docs/architecture/persona-spine-client-protocol.md
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  usePersonaSpine,
  personaFetch,
  PersonaSpineGate,
} from "@/utils/personaSpine";
import {
  ExperienceModelCard,
  type ExperienceModelCardData,
} from "@/components/metame/cards/ExperienceModelCard";
import { IqubeContextDisclosure } from "@/components/metame/cards/IqubeContextDisclosure";
import { ExperienceModelSetupWizard } from "@/components/metame/setup/ExperienceModelSetupWizard";
import { BriefCard, type BriefCardData } from "@/components/metame/cards/BriefCard";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";

interface Specialist {
  id: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c';
  label: string;
  description: string;
  homeCartridge: 'cross-cutting' | 'qriptopian' | 'knyt' | 'platform';
}

interface PrimaryCta {
  id: string;
  label: string;
  enabled: boolean;
  status: 'available' | 'preview';
}

interface BootstrapSurface {
  personaSessionToken: string;
  sessionExpiresAt: string;
  displayLabel?: string;
  cartridgeFlags: { isAdmin: boolean; isPartner: boolean };
  activeCartridge: string;
  availableCartridges: Array<{ slug: string; label: string }>;
  availableSpecialists: Specialist[];
  primaryCtas: PrimaryCta[];
  experienceModel: { configured: boolean; name?: string; currentStage?: string };
  pendingApprovals: number;
  naming: {
    productLabel: string;
    knytSpecialist: string;
    qriptopianSpecialist: string;
    canonicalMediaBrand: string;
  };
}

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
  isPartner?: boolean;
  personaId?: string;
  density?: 'narrow' | 'wide';
}

// Static context chips (PRD §9.1). Not part of bootstrap because they're
// always shown — adding/removing chips is a code change, not a runtime one.
const CONTEXT_CHIPS = [
  'metaMe',
  'KNYT',
  'The Qriptopian',
  'Marketa',
  'AVL',
  'Metayé Media',
  'Google Workspace',
];

export function AigentMeWelcomeTab({ theme = 'dark', personaId }: Props) {
  const spine = usePersonaSpine({ personaIdHint: personaId });
  const [data, setData] = useState<BootstrapSurface | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  // Phase 2.b — ExperienceQube state, fetched once spine is ready.
  const [expModel, setExpModel] = useState<ExperienceModelCardData | null>(null);
  const [expModelLoading, setExpModelLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Phase 3 — brief + move-forward state.
  const [brief, setBrief] = useState<BriefCardData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [moveForwardCartridgeOpen, setMoveForwardCartridgeOpen] = useState(false);
  const [moveForwardResult, setMoveForwardResult] = useState<{
    cartridge: string;
    topAction: NextBestActionData | null;
    alternates: NextBestActionData[];
  } | null>(null);
  const [moveForwardLoading, setMoveForwardLoading] = useState(false);

  // Only fetch the bootstrap surface once the spine is ready. The spine's
  // own auth gate (PersonaSpineGate below) handles the loading /
  // unauthenticated / error states for persona resolution itself.
  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    setBootstrapLoading(true);
    setBootstrapError(null);

    personaFetch('/api/assistant/bootstrap', {
      personaIdHint: personaId,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `bootstrap failed (${res.status})`);
        }
        return res.json() as Promise<BootstrapSurface>;
      })
      .then((surface) => {
        if (!cancelled) setData(surface);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setBootstrapError(msg);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [spine.status, personaId]);

  // Fetch ExperienceQube state in parallel with bootstrap.
  useEffect(() => {
    if (spine.status !== 'ready' && spine.status !== 'refreshing') return;
    let cancelled = false;
    setExpModelLoading(true);
    personaFetch('/api/assistant/experience-model', { personaIdHint: personaId })
      .then(async (res) => {
        if (!res.ok) throw new Error(`experience-model fetch failed (${res.status})`);
        return res.json() as Promise<ExperienceModelCardData>;
      })
      .then((d) => { if (!cancelled) setExpModel(d); })
      .catch(() => { if (!cancelled) setExpModel({ configured: false, meta: null, blakSummary: null, updatedAt: null }); })
      .finally(() => { if (!cancelled) setExpModelLoading(false); });
    return () => { cancelled = true; };
  }, [spine.status, personaId]);

  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const res = await personaFetch('/api/assistant/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType: 'daily' }),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `brief failed (${res.status})`);
      }
      const data = (await res.json()) as BriefCardData;
      setBrief(data);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : String(err));
    } finally {
      setBriefLoading(false);
    }
  }, [personaId]);

  /**
   * Move-forward fetch.
   *
   * - No `cartridge` arg → auto-pick mode: server returns the strongest NBE
   *   across the user's active cartridges (default behaviour when the user
   *   clicks "Move this forward").
   * - `cartridge` arg → steering mode: re-fetch scoped to one cartridge
   *   (used by the "Switch cartridge" strip below the hero card).
   */
  const fetchMoveForward = useCallback(async (cartridge?: string) => {
    setMoveForwardLoading(true);
    setMoveForwardResult(null);
    try {
      const res = await personaFetch('/api/assistant/move-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartridge ? { cartridge } : {}),
        personaIdHint: personaId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; detail?: string }));
        throw new Error(body?.detail || body?.error || `move-forward failed (${res.status})`);
      }
      const data = (await res.json()) as {
        cartridge: string;
        topAction: NextBestActionData | null;
        alternates: NextBestActionData[];
      };
      setMoveForwardResult(data);
    } catch {
      // Surface failures inline; keep welcome usable.
      setMoveForwardResult({ cartridge: cartridge ?? 'metame', topAction: null, alternates: [] });
    } finally {
      setMoveForwardLoading(false);
    }
  }, [personaId]);

  const handleCtaClick = useCallback((ctaId: string) => {
    if (ctaId === 'set-up-experience-model') {
      setWizardOpen(true);
      return;
    }
    if (ctaId === 'brief-me') {
      void fetchBrief();
      return;
    }
    if (ctaId === 'move-this-forward') {
      // Open the section + fire the auto-pick fetch immediately. No picker
      // step — Aigent Me decides the cartridge from the ExperienceQube.
      setMoveForwardCartridgeOpen(true);
      void fetchMoveForward();
      return;
    }
    // Other CTAs (review-venture-progress, create-something, etc.) remain
    // in 'preview' state until later phases land.
  }, [fetchBrief, fetchMoveForward]);

  const handleWizardSaved = useCallback((saved: ExperienceModelCardData) => {
    setExpModel(saved);
  }, []);

  const isDark = theme === 'dark';
  const surfaceClass = isDark
    ? 'bg-slate-900/40 border-slate-700/60 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const accentClass = isDark ? 'text-violet-300' : 'text-violet-700';
  const chipClass = isDark
    ? 'bg-slate-800/60 border-slate-700 text-slate-200'
    : 'bg-slate-100 border-slate-200 text-slate-700';

  // ── Persona-spine gate handles idle / loading / unauth / error states.
  return (
    <>
      <PersonaSpineGate state={spine}>
        <AigentMeWelcomeBody
          data={data}
          bootstrapLoading={bootstrapLoading}
          bootstrapError={bootstrapError}
          spineDisplayLabel={spine.displayLabel}
          expModel={expModel}
          expModelLoading={expModelLoading}
          brief={brief}
          briefLoading={briefLoading}
          briefError={briefError}
          moveForwardCartridgeOpen={moveForwardCartridgeOpen}
          moveForwardResult={moveForwardResult}
          moveForwardLoading={moveForwardLoading}
          onPickMoveForwardCartridge={fetchMoveForward}
          onCtaClick={handleCtaClick}
          theme={theme}
          surfaceClass={surfaceClass}
          mutedClass={mutedClass}
          accentClass={accentClass}
          chipClass={chipClass}
          isDark={isDark}
        />
      </PersonaSpineGate>
      <ExperienceModelSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={expModel?.meta ? {
          experienceName: expModel.meta.experienceName ?? undefined,
          experienceType: expModel.meta.experienceType as never,
          primaryGoal: expModel.meta.primaryGoal ?? undefined,
          activeCartridges: expModel.meta.activeCartridges as never,
          currentStage: expModel.meta.currentStage as never,
          confidentialityDefault: expModel.meta.confidentialityDefault as never,
          progressModel: expModel.meta.progressModel,
        } : undefined}
        onSaved={handleWizardSaved}
      />
    </>
  );
}

interface BodyProps {
  data: BootstrapSurface | null;
  bootstrapLoading: boolean;
  bootstrapError: string | null;
  spineDisplayLabel: string | null;
  expModel: ExperienceModelCardData | null;
  expModelLoading: boolean;
  brief: BriefCardData | null;
  briefLoading: boolean;
  briefError: string | null;
  moveForwardCartridgeOpen: boolean;
  moveForwardResult: { cartridge: string; topAction: NextBestActionData | null; alternates: NextBestActionData[] } | null;
  moveForwardLoading: boolean;
  onPickMoveForwardCartridge: (cartridge: string) => void;
  onCtaClick: (ctaId: string) => void;
  theme: 'light' | 'dark';
  surfaceClass: string;
  mutedClass: string;
  accentClass: string;
  chipClass: string;
  isDark: boolean;
}

function AigentMeWelcomeBody({
  data,
  bootstrapLoading,
  bootstrapError,
  spineDisplayLabel,
  expModel,
  expModelLoading,
  brief,
  briefLoading,
  briefError,
  moveForwardCartridgeOpen,
  moveForwardResult,
  moveForwardLoading,
  onPickMoveForwardCartridge,
  onCtaClick,
  theme,
  surfaceClass,
  mutedClass,
  accentClass,
  chipClass,
  isDark,
}: BodyProps) {
  const moveForwardSectionRef = useRef<HTMLElement | null>(null);

  // When the move-forward section opens, scroll it into view so the user
  // sees Aigent Me's hero recommendation immediately. Without this, the
  // section can appear below the fold and look like a no-op click.
  useEffect(() => {
    if (moveForwardCartridgeOpen && moveForwardSectionRef.current) {
      moveForwardSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [moveForwardCartridgeOpen]);

  if (bootstrapLoading && !data) {
    return (
      <div className="p-10 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        <span className={mutedClass}>Bringing Aigent Me online…</span>
      </div>
    );
  }

  if (bootstrapError && !data) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className={`rounded-lg border p-6 ${surfaceClass}`}>
          <h3 className="font-semibold mb-1">Aigent Me bootstrap failed</h3>
          <p className={`text-sm ${mutedClass}`}>{bootstrapError}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prefer the spine's displayLabel (single source of truth across surfaces);
  // fall back to the bootstrap copy if for some reason it differs.
  const greetingName = (spineDisplayLabel || data.displayLabel || '').trim();
  const usingIqubes: ('PersonaQube' | 'ExperienceQube' | 'IntentQube')[] =
    expModel?.configured ? ['PersonaQube', 'ExperienceQube'] : ['PersonaQube'];

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header — product label + greeting */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${accentClass}`} />
          <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
            {data.naming.productLabel}
          </span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-semibold leading-tight">
          {greetingName ? `Welcome back, ${greetingName}.` : 'Welcome back.'}
        </h1>
        <p className={`max-w-2xl ${mutedClass}`}>
          I can help you brief your day, guide your experience strategy, move
          your cartridges forward, create artifacts, coordinate trusted
          agents, and track progress.
        </p>
      </header>

      {/* iQube context disclosure — what's being used right now */}
      <IqubeContextDisclosure using={usingIqubes} theme={theme} />

      {/* ExperienceModel card */}
      <ExperienceModelCard
        data={expModel}
        loading={expModelLoading}
        onEdit={() => onCtaClick('set-up-experience-model')}
        theme={theme}
      />

      {/* Context chips */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Active context
        </h2>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_CHIPS.map((chip) => (
            <span
              key={chip}
              className={`px-3 py-1 text-sm rounded-full border ${chipClass}`}
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      {/* Primary CTAs */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          What would you like to do?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.primaryCtas.map((cta) => {
            const isPreview = cta.status === 'preview';
            const baseBtn =
              'text-left px-4 py-3 rounded-lg border transition w-full';
            const enabledBtn = isDark
              ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-violet-500/40'
              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-violet-400';
            const disabledBtn = isDark
              ? 'bg-slate-900/40 border-slate-800 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 cursor-not-allowed';
            return (
              <button
                key={cta.id}
                disabled={!cta.enabled}
                onClick={() => cta.enabled && onCtaClick(cta.id)}
                className={`${baseBtn} ${cta.enabled ? enabledBtn : disabledBtn}`}
                title={isPreview ? 'Coming in a later phase of the alpha' : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cta.label}</span>
                  {isPreview && (
                    <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                      preview
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Brief Card — appears once 'Brief me' is clicked */}
      {(briefLoading || briefError || brief) && (
        <section>
          <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Brief
          </h2>
          <BriefCard
            data={brief}
            loading={briefLoading}
            error={briefError}
            theme={theme}
          />
        </section>
      )}

      {/* Move-forward — hero NBE first, then alternates, then 'switch cartridge' strip */}
      {moveForwardCartridgeOpen && (
        <section ref={moveForwardSectionRef}>
          <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
            Move this forward
          </h2>

          {moveForwardLoading && (
            <p className={`text-sm ${mutedClass}`}>Looking for the strongest move…</p>
          )}

          {moveForwardResult && !moveForwardLoading && (
            <div className="space-y-3">
              {moveForwardResult.topAction ? (
                <NextBestActionCard
                  action={moveForwardResult.topAction}
                  variant="hero"
                  theme={theme}
                />
              ) : (
                <p className={`text-sm ${mutedClass}`}>
                  No catalogue match at your current stage.
                  Try setting up your ExperienceModel first.
                </p>
              )}
              {moveForwardResult.alternates.length > 0 && (
                <>
                  <h3 className={`text-xs uppercase tracking-wider mt-4 mb-1 ${mutedClass}`}>
                    Or instead
                  </h3>
                  <div className="space-y-2">
                    {moveForwardResult.alternates.map((a) => (
                      <NextBestActionCard
                        key={a.id}
                        action={a}
                        theme={theme}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Steering strip — swap cartridge if the user wants a different angle */}
              <div className="pt-3 mt-3 border-t border-slate-800/40">
                <div className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
                  Switch cartridge
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.availableCartridges.map((c) => {
                    const selected = moveForwardResult.cartridge === c.slug;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => onPickMoveForwardCartridge(c.slug)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition ${
                          selected
                            ? 'bg-violet-500/20 border-violet-500 text-violet-200'
                            : isDark
                              ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-violet-400'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Specialist directory */}
      <section>
        <h2 className={`text-xs uppercase tracking-wider mb-2 ${mutedClass}`}>
          Specialists I can coordinate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.availableSpecialists.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-4 ${surfaceClass}`}
            >
              <div className="font-medium mb-1">{s.label}</div>
              <div className={`text-sm ${mutedClass}`}>{s.description}</div>
              <div className={`text-[11px] mt-2 uppercase tracking-wider ${mutedClass}`}>
                {s.homeCartridge}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Naming notice — locked decisions */}
      <footer className={`text-xs ${mutedClass} pt-4 border-t border-slate-800/60`}>
        <p>
          Locked names: <strong>{data.naming.canonicalMediaBrand}</strong> ·
          KNYT specialist <strong>{data.naming.knytSpecialist}</strong> ·
          Qriptopian editorial <strong>Quill</strong>.
          Workspace tools (Gmail, Calendar, Drive) are opt-in per source.
        </p>
      </footer>
    </div>
  );
}

export default AigentMeWelcomeTab;
