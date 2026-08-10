'use client';

/**
 * KnytsBridgeAdminPanel — light editorial config for Bridge-owned media/copy
 * ONLY (reconstitution spec, point 6). Generic over `section` so a future
 * media-rich stage (e.g. a VIEW featured slot) reuses this same form and the
 * same table without a new admin page — pass a different `section` prop.
 *
 * This panel edits NOTHING about Pulse, Passport, myCanvas, Standing or the
 * Store — those stay owned by their own admin surfaces. The PUT route this
 * calls is server-gated via requireAdminPersona; this component's own
 * render-gate (in the hosting page) is optimistic UX only, never the real
 * enforcement (CLAUDE.md's Security — Access Gates rule).
 */

import { useCallback, useEffect, useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { KNYTS_BRIDGE_HOME_DEFAULTS } from '@/services/journey/knytsBridgeEditorialConfig';

interface Props {
  section?: string;
  personaId?: string;
}

const FIELDS: Array<{ key: keyof KnytsBridgeEditorialSection; label: string; multiline?: boolean }> = [
  { key: 'headline', label: 'Headline' },
  { key: 'shortCopy', label: 'Short copy (blank line between paragraphs)', multiline: true },
  { key: 'videoUrl', label: 'Video URL' },
  { key: 'posterUrl', label: 'Poster image URL' },
  { key: 'campaignCta', label: 'Campaign CTA' },
  { key: 'rewardCopy', label: 'Current prize / reward copy' },
];

export function KnytsBridgeAdminPanel({ section = 'home', personaId }: Props) {
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>({ ...KNYTS_BRIDGE_HOME_DEFAULTS, section });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/journey/knyts-bridge/editorial-config?section=${encodeURIComponent(section)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.ok && json.config) setConfig(json.config);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await personaFetch('/api/journey/knyts-bridge/editorial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        personaIdHint: personaId,
        body: JSON.stringify({ section, ...config }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setNotice(json.error || `Save failed (${res.status})`);
        return;
      }
      setConfig(json.config);
      setNotice('Saved.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [config, personaId, section]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading editorial config…</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-lg font-semibold text-slate-100">KNYTS Bridge — {section.toUpperCase()} editorial config</h1>
      <p className="text-xs text-slate-500">
        Copy and media for this section only. Pulse, Passport, myCanvas, Standing and the Store are
        edited in their own canonical admin surfaces, not here.
      </p>
      {FIELDS.map(({ key, label, multiline }) => (
        <div key={key}>
          <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
          {multiline ? (
            <textarea
              value={config[key] ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
              rows={5}
              className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
            />
          ) : (
            <input
              type="text"
              value={config[key] ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
              className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {notice && <span className="text-xs text-slate-400">{notice}</span>}
      </div>
    </div>
  );
}

export default KnytsBridgeAdminPanel;
