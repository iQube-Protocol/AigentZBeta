'use client';

/**
 * MobilityCaseManagementTab — Workstream A: Case Management & Coordination.
 * Central log: contacts, review history, operator notes, case status controls.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList, AlertTriangle, Plus, Trash2, Save, Loader2,
  RefreshCw, Phone, Mail, User, Shield, ChevronDown, ChevronUp,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(' '); }

interface CaseNote { id: string; author: string; content: string; createdAt: string; }
interface Contact { id: string; name: string; role: string; phone: string; email: string; org: string; }
interface CaseData {
  id: string; case_status: string; case_type: string; priority_level: string; classification: string;
  created_at: string; intake_completed_at: string | null; capability_score: number | null;
  continuity_score: number | null; recovery_velocity_class: string | null;
  marketa_forward_email?: string | null;
}
interface WorkstreamRow { id: string; workstream_key: string; notes: string | null; tasks: CaseNote[]; }

const STATUS_OPTIONS = ['intake', 'active', 'paused', 'complete', 'closed'] as const;
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;

export function MobilityCaseManagementTab({ caseId }: { caseId: string }) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [workstream, setWorkstream] = useState<WorkstreamRow | null>(null);
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsOpen, setContactsOpen] = useState(true);
  const [forwardEmail, setForwardEmail] = useState('');
  const [savingForwardEmail, setSavingForwardEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [caseRes, wsRes] = await Promise.all([
        personaFetch(`/api/mobility/cases/${caseId}`, { cache: 'no-store' }),
        personaFetch(`/api/mobility/cases/${caseId}/workstreams`, { cache: 'no-store' }),
      ]);
      const [caseJson, wsJson] = await Promise.all([caseRes.json(), wsRes.json()]);
      if (caseJson.ok) {
        setCaseData(caseJson.case);
        setContacts((caseJson.case.household_profile?.contacts as Contact[]) ?? []);
        setForwardEmail(caseJson.case.marketa_forward_email ?? '');
      }
      if (wsJson.ok) {
        const ws = (wsJson.workstreams as WorkstreamRow[]).find(w => w.workstream_key === 'A');
        if (ws) { setWorkstream(ws); setNotes(ws.notes ?? ''); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const saveNotes = useCallback(async () => {
    if (!workstream) return;
    setSaving(true);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/workstreams`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstream_key: 'A', notes, status: 'active' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setWorkstream(json.workstream);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }, [caseId, workstream, notes]);

  const updateStatus = useCallback(async (field: 'case_status' | 'priority_level', value: string) => {
    if (!caseData) return;
    setSavingStatus(true);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Update failed');
      setCaseData(json.case);
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setSavingStatus(false); }
  }, [caseId, caseData]);

  const saveForwardEmail = useCallback(async () => {
    setSavingForwardEmail(true);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketa_forward_email: forwardEmail.trim() || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setCaseData(json.case);
      setForwardEmail(json.case.marketa_forward_email ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSavingForwardEmail(false); }
  }, [caseId, forwardEmail]);

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  const isBlakQube = caseData?.classification === 'black_cube';

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-slate-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Workstream A — Case Management</h2>
            <p className="text-xs text-slate-400">Case controls · Contact log · Operator notes · Review history</p>
          </div>
        </div>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2"><AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" /><p className="text-xs text-rose-300">{error}</p></div>}

      {/* Classification notice */}
      {isBlakQube && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <Shield className="h-4 w-4 text-violet-400 shrink-0" />
          <p className="text-xs text-violet-200/80">
            <span className="font-semibold">BlakQube</span> — case under compartmentalised management. aigentMe is the sole authorised disclosure broker.
          </p>
        </div>
      )}

      {/* Case status controls */}
      {caseData && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Case Controls</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">Status</label>
              <select
                value={caseData.case_status}
                onChange={e => updateStatus('case_status', e.target.value)}
                disabled={savingStatus}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-slate-400 disabled:opacity-50"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">Priority</label>
              <select
                value={caseData.priority_level}
                onChange={e => updateStatus('priority_level', e.target.value)}
                disabled={savingStatus}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-slate-400 disabled:opacity-50"
              >
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-700/50">
            <StatField label="Case type" value={caseData.case_type.replace('_', ' ')} />
            <StatField label="Classification" value={caseData.classification === 'black_cube' ? 'BlakQube' : caseData.classification} highlight={isBlakQube} />
            {caseData.capability_score !== null && <StatField label="Capability" value={`${caseData.capability_score}/100`} />}
            {caseData.recovery_velocity_class && <StatField label="RV class" value={caseData.recovery_velocity_class} />}
          </div>
          <div className="flex items-center gap-4 pt-0.5">
            <p className="text-[11px] text-slate-500">Opened {new Date(caseData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            {caseData.intake_completed_at && <p className="text-[11px] text-emerald-500">Intake complete</p>}
          </div>
        </div>
      )}

      {/* Marketa response routing */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Institutional Response Routing</h3>
          <p className="text-xs text-slate-400 mt-0.5">Marketa sends outreach from the system inbox and forwards institutional responses to this address. aigentMe will evaluate responses against PDEP escalation criteria (fast-follow).</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] text-slate-500">Forward responses to</label>
            <input
              type="email"
              value={forwardEmail}
              onChange={e => setForwardEmail(e.target.value)}
              placeholder="e.g. case-lead@yourdomain.com"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            />
          </div>
          <div className="shrink-0 pt-5">
            <button
              onClick={saveForwardEmail}
              disabled={savingForwardEmail || forwardEmail === (caseData?.marketa_forward_email ?? '')}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-600/20 disabled:opacity-40 transition-colors"
            >
              {savingForwardEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>
          </div>
        </div>
        {caseData?.marketa_forward_email && (
          <p className="text-[11px] text-emerald-500">Responses routed → {caseData.marketa_forward_email}</p>
        )}
      </div>

      {/* Key contacts */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60">
        <button
          onClick={() => setContactsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Key Contacts</span>
            <span className="text-[10px] text-slate-500">({contacts.length})</span>
          </div>
          {contactsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
        {contactsOpen && (
          <div className="px-4 pb-4 space-y-2">
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">No contacts added yet. Add advisors, solicitors, school contacts, or letting agents.</p>
            ) : contacts.map(c => (
              <div key={c.id} className="flex items-start justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium text-slate-200">{c.name} <span className="text-slate-500 font-normal">· {c.role}</span></p>
                  {c.org && <p className="text-[11px] text-slate-400">{c.org}</p>}
                  <div className="flex items-center gap-3">
                    {c.phone && <span className="flex items-center gap-1 text-[11px] text-slate-400"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1 text-[11px] text-slate-400"><Mail className="h-3 w-3" />{c.email}</span>}
                  </div>
                </div>
                <button onClick={() => setContacts(cs => cs.filter(x => x.id !== c.id))} className="text-slate-600 hover:text-rose-400 transition-colors ml-2 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setContacts(cs => [...cs, { id: crypto.randomUUID(), name: '', role: '', phone: '', email: '', org: '' }])}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add contact
            </button>
            {contacts.some(c => !c.name) && (
              <div className="space-y-2 pt-1">
                {contacts.filter(c => !c.name).map(c => (
                  <div key={c.id} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                    {(['name', 'role', 'org', 'phone', 'email'] as const).map(field => (
                      <input key={field}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
                        value={c[field]}
                        onChange={e => setContacts(cs => cs.map(x => x.id === c.id ? { ...x, [field]: e.target.value } : x))}
                        placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operator notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-200">Case Log / Operator Notes</label>
          <button onClick={saveNotes} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
          </button>
        </div>
        <textarea
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500/60 focus:outline-none resize-none"
          rows={8}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Case log entries, review notes, advisor communications, key decisions…&#10;&#10;Format: [DATE] [AUTHOR] — Note content"
        />
      </div>
    </div>
  );
}

function StatField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={cls('text-xs font-medium capitalize', highlight ? 'text-violet-300' : 'text-slate-200')}>{value}</p>
    </div>
  );
}
