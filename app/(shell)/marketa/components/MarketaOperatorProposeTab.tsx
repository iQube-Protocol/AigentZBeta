'use client';

/**
 * MarketaOperatorProposeTab — operator/admin variant of the partner Propose
 * surface. Authoring path identical to MarketaProposeTab but adds:
 *   • cohort selector (CRM Investors / Zero KNYT / KS Backers / All Personas)
 *   • cohort recipient count preview before AI enrichment
 *   • origin='operator' tagging on the resulting pack
 *
 * The actual send is dispatched via the existing Marketa send pipeline; this
 * tab is for authoring + cohort-attached approval queue handoff.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Sparkles, Users } from 'lucide-react';

interface Cohort {
  id: string;
  label: string;
  description: string;
}

interface Pack {
  id: string;
  name: string;
  tagline: string;
  objectives: string[];
  milestones: Array<{ title: string; description: string; metric: string }>;
  copy_variants: Array<{ channel: string; subject: string | null; body: string }>;
  reward_estimate: { knyt: number; qc: number };
  campaign_fit_score: number;
}

interface CohortResolved {
  id: string;
  count: number;
  samplePersonaIds: string[];
}

const CHANNELS = [
  { key: 'email',      label: 'Email' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'x',          label: 'X / Twitter' },
  { key: 'linkedin',   label: 'LinkedIn' },
  { key: 'instagram',  label: 'Instagram' },
];

interface Props {
  theme?: 'light' | 'dark';
  personaId?: string;
}

export function MarketaOperatorProposeTab({ theme = 'dark', personaId }: Props) {
  const d = theme === 'dark';

  const [cohorts, setCohorts]     = useState<Cohort[]>([]);
  const [cohortId, setCohortId]   = useState<string>('crm-investors');
  const [intent, setIntent]       = useState('');
  const [channels, setChannels]   = useState<string[]>(['email']);
  const [timing, setTiming]       = useState('');
  const [angle, setAngle]         = useState('');
  const [building, setBuilding]   = useState(false);
  const [pack, setPack]           = useState<Pack | null>(null);
  const [cohortResolved, setCohortResolved] = useState<CohortResolved | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/marketa/operator-propose')
      .then((r) => r.json())
      .then((data: { cohorts?: Cohort[] }) => setCohorts(data.cohorts ?? []))
      .catch(() => setCohorts([]));
  }, []);

  const toggleChannel = (key: string) =>
    setChannels((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);

  const handleBuild = async () => {
    if (!personaId || !intent.trim() || !channels.length || !cohortId) return;
    setBuilding(true);
    setError(null);
    setPack(null);
    setCohortResolved(null);
    try {
      const res = await fetch('/api/admin/marketa/operator-propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, intent, channels, timing, angle, cohort_id: cohortId }),
      });
      const data = await res.json();
      if (data.ok && data.pack) {
        setPack(data.pack);
        setCohortResolved(data.cohort ?? null);
      } else {
        setError(data.error ?? 'Marketa couldn\'t build the pack right now. Try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBuilding(false);
    }
  };

  const handleSubmit = async () => {
    if (!pack?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/marketa/packs/${pack.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_review' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? 'Submit failed');
      }
    } catch {
      setError('Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const baseTextClass  = d ? 'text-slate-100' : 'text-slate-900';
  const mutedTextClass = d ? 'text-slate-400' : 'text-slate-600';
  const inputClass = d
    ? 'w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-pink-400 focus:outline-none'
    : 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-pink-400 focus:outline-none';

  if (submitted) {
    return (
      <div className="p-4">
        <div className={`rounded-xl border ${d ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-300 bg-emerald-50'} p-6 text-center`}>
          <p className={`text-base font-semibold ${d ? 'text-emerald-300' : 'text-emerald-700'}`}>Proposal submitted</p>
          <p className={`mt-1 text-sm ${mutedTextClass}`}>The campaign pack is now in the approval queue tagged origin: operator. Cohort {cohortResolved?.id ?? cohortId} ({cohortResolved?.count ?? 0} recipients).</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSubmitted(false); setPack(null); setCohortResolved(null); setIntent(''); setTiming(''); setAngle(''); }}>
            Author another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className={`rounded-xl border ${d ? 'border-pink-400/20 bg-slate-900/40' : 'border-pink-200 bg-white'} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className={`h-4 w-4 ${d ? 'text-pink-300' : 'text-pink-500'}`} />
          <p className={`text-sm font-semibold ${baseTextClass}`}>Operator Campaign Proposal</p>
        </div>
        <p className={`text-xs ${mutedTextClass} mb-4`}>Author a campaign brief, pick a cohort, and Marketa enriches it into a full pack. The pack lands in the approval queue tagged as operator-origin so it&apos;s distinguishable from partner submissions.</p>

        <div className="space-y-3">
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedTextClass}`}>Cohort</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className={inputClass}
              disabled={building}
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.label} — {c.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedTextClass}`}>Channels</label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => {
                const active = channels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleChannel(c.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? d ? 'border-pink-400/60 bg-pink-400/15 text-pink-200' : 'border-pink-400 bg-pink-50 text-pink-600'
                        : d ? 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedTextClass}`}>Intent (what is the campaign about?)</label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              placeholder="e.g. Activate Wave 1 investors with the launch of the KNYT Codex bundle, drive bundle preorders by Friday."
              className={inputClass}
              disabled={building}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${mutedTextClass}`}>Timing (optional)</label>
              <input
                type="text"
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                placeholder="e.g. Send Tuesday morning, follow-up Friday"
                className={inputClass}
                disabled={building}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${mutedTextClass}`}>Audience / Angle (optional)</label>
              <input
                type="text"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. Founder voice, urgency, scarcity"
                className={inputClass}
                disabled={building}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={handleBuild}
              disabled={building || !personaId || !intent.trim() || !channels.length}
            >
              {building ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Building pack…</> : <><Sparkles className="h-4 w-4 mr-2" /> Build pack with Marketa</>}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border ${d ? 'border-red-700 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'} p-3 text-sm`}>
          {error}
        </div>
      )}

      {pack && (
        <div className={`rounded-xl border ${d ? 'border-emerald-500/30 bg-slate-900/60' : 'border-emerald-200 bg-white'} p-4 space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm font-semibold ${baseTextClass}`}>{pack.name}</p>
              <p className={`text-xs ${mutedTextClass} mt-0.5`}>{pack.tagline}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px]">Fit: {pack.campaign_fit_score}/100</Badge>
              {cohortResolved && (
                <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1 inline" /> {cohortResolved.count} recipients</Badge>
              )}
            </div>
          </div>

          <div>
            <p className={`text-[11px] uppercase tracking-wider ${mutedTextClass}`}>Objectives</p>
            <ul className={`text-xs ${baseTextClass} list-disc pl-5 mt-1 space-y-0.5`}>
              {pack.objectives.map((o, i) => (<li key={i}>{o}</li>))}
            </ul>
          </div>

          <div>
            <p className={`text-[11px] uppercase tracking-wider ${mutedTextClass}`}>Copy variants ({pack.copy_variants.length})</p>
            <div className="space-y-2 mt-1">
              {pack.copy_variants.map((cv, i) => (
                <div key={i} className={`rounded border ${d ? 'border-white/10 bg-slate-800/40' : 'border-slate-200 bg-slate-50'} p-2`}>
                  <p className={`text-[10px] uppercase tracking-wider ${mutedTextClass}`}>{cv.channel}</p>
                  {cv.subject && <p className={`text-xs font-medium ${baseTextClass} mt-0.5`}>{cv.subject}</p>}
                  <p className={`text-xs ${baseTextClass} mt-0.5 whitespace-pre-wrap`}>{cv.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</> : <><Send className="h-4 w-4 mr-2" /> Submit to approval queue</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
