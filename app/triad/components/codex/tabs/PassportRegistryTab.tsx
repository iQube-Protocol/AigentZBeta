'use client';

/**
 * PassportRegistryTab — public listing of issued Polity Passports (Stage 5).
 *
 * Surfaces the public projection from /api/polity-passport/registry. This
 * tab is mirrored on both the Bureau cartridge and the iQube Registry
 * cartridge ("Passports" tab) — same component, two homes, per the
 * subTabs-mirror pattern. Everything shown is public-safe: commitment refs,
 * never raw identity (T0 rule lives server-side in the projection).
 */

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpenCheck, RefreshCw, Loader2, AlertCircle, ShieldCheck, Bot } from 'lucide-react';
import { SubHeaderSlotContext } from '../SubHeaderSlot';

interface PublicPassport {
  passportId: string;
  passportClass: string;
  passportGrade: string | null;
  passportStatus: string | null;
  kybeDidPublicRef: string | null;
  issuedAt: string | null;
  citizenPassportIrrevocable?: boolean;
  revoked?: boolean;
}

const CLASS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'citizen', label: 'Citizens' },
  { value: 'agent_participant', label: 'Agents' },
  { value: 'robot_participant', label: 'Robots' },
  { value: 'organization_participant', label: 'Organizations' },
];

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportRegistryTab() {
  const [passports, setPassports] = useState<PublicPassport[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = classFilter ? `?class=${encodeURIComponent(classFilter)}` : '';
      const res = await fetch(`/api/polity-passport/registry${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Registry load failed');
      setPassports(json.passports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registry load failed');
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Class filter chips — rendered into the cartridge sub-menu bar
  // (left-justified on the breadcrumb row) per the cartridge template, with
  // an inline fallback for surfaces that don't mount the slot.
  const filterChips = (
    <div className="flex gap-1 flex-wrap items-center">
      {CLASS_FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => setClassFilter(f.value)}
          className={cls(
            'rounded-full px-2.5 py-0.5 text-[11px] transition-all duration-300',
            classFilter === f.value
              ? 'bg-violet-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {subHeaderSlotEl ? createPortal(filterChips, subHeaderSlotEl) : filterChips}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-6 w-6 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Polity Passport Registry</h2>
            <p className="text-sm text-slate-400">
              Public record of issued passports. Identity appears as commitments only.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && passports.length === 0 && !error && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No passports issued yet.
        </div>
      )}

      <div className="space-y-2">
        {passports.map((p) => {
          const isCitizen = p.passportClass === 'citizen';
          return (
            <div
              key={p.passportId}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {isCitizen ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Bot className="h-5 w-5 text-sky-400" />
                )}
                <div>
                  <p className="font-mono text-sm text-slate-200">{p.passportId}</p>
                  <p className="text-xs text-slate-500">
                    {p.passportGrade ?? p.passportClass}
                    {p.kybeDidPublicRef && ` · kybe:${p.kybeDidPublicRef}`}
                    {p.issuedAt && ` · ${new Date(p.issuedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCitizen && p.citizenPassportIrrevocable && (
                  <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                    irrevocable
                  </span>
                )}
                <span
                  className={cls(
                    'rounded-full px-2 py-0.5 text-xs',
                    p.passportStatus === 'active' || p.passportStatus === 'approved'
                      ? 'bg-emerald-900 text-emerald-300'
                      : p.passportStatus === 'revoked' || p.passportStatus === 'delisted'
                        ? 'bg-rose-900 text-rose-300'
                        : 'bg-slate-800 text-slate-400',
                  )}
                >
                  {p.passportStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
