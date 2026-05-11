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

import React, { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { authedFetchHeaders } from "@/utils/supabaseBrowser";

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
  const [data, setData] = useState<BootstrapSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    (async () => {
      try {
        const headers = await authedFetchHeaders({ Accept: 'application/json' });
        // Pass the resolved personaId from the codex auth bridge as a hint —
        // the server still resolves the active persona via the spine, but
        // this lets it pick the right one when the caller owns several.
        const url = personaId
          ? `/api/assistant/bootstrap?personaId=${encodeURIComponent(personaId)}`
          : '/api/assistant/bootstrap';
        const res = await fetch(url, {
          headers,
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `bootstrap failed (${res.status})`);
        }
        const surface = (await res.json()) as BootstrapSurface;
        if (!cancelled) setData(surface);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [personaId]);

  const isDark = theme === 'dark';
  const surfaceClass = isDark
    ? 'bg-slate-900/40 border-slate-700/60 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const accentClass = isDark ? 'text-violet-300' : 'text-violet-700';
  const chipClass = isDark
    ? 'bg-slate-800/60 border-slate-700 text-slate-200'
    : 'bg-slate-100 border-slate-200 text-slate-700';

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        <span className={mutedClass}>Bringing Aigent Me online…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className={`rounded-lg border p-6 ${surfaceClass}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Aigent Me is not available right now</h3>
              <p className={`text-sm ${mutedClass}`}>
                {error || 'Bootstrap returned no data.'}
              </p>
              <p className={`text-sm mt-3 ${mutedClass}`}>
                Sign in with an active persona to begin. If you are signed in, refresh this tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const greetingName = data.displayLabel?.trim();
  const experienceLine = data.experienceModel.configured
    ? `ExperienceModel: ${data.experienceModel.name || 'configured'}${
        data.experienceModel.currentStage ? ` · stage: ${data.experienceModel.currentStage}` : ''
      }`
    : 'ExperienceModel: not yet set up';

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

      {/* ExperienceModel state line */}
      <div className={`rounded-lg border px-4 py-3 ${surfaceClass}`}>
        <p className="text-sm">
          <span className={accentClass}>{experienceLine}</span>
        </p>
        {!data.experienceModel.configured && (
          <p className={`text-xs mt-1 ${mutedClass}`}>
            Setup flow lands in Phase 2. The button below will activate once
            the ExperienceModel API is live.
          </p>
        )}
      </div>

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
