'use client';

/**
 * MobilityFamilyTab — Workstream G: Family Stabilization.
 * Priority: Medium-High. Children settling, UK support network, wellbeing continuity.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Heart, AlertTriangle, Plus, Trash2, Save, Loader2, RefreshCw, Users, Shield } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(' '); }

interface FamilyTask { id: string; label: string; status: 'pending'|'in_progress'|'complete'|'blocked'; notes: string; assignee: string; due: string; }
interface HouseholdProfile { adultCount?: number; childCount?: number; childAges?: number[]; petsCount?: number; specialNeeds?: string; gpRegistered?: string; }
interface WorkstreamRow { id: string; workstream_key: string; label: string; priority: string; status: string; notes: string | null; tasks: FamilyTask[]; }
const TASK_STATUS_CONFIG = { pending: { label: 'Pending', color: 'slate' }, in_progress: { label: 'In Progress', color: 'amber' }, complete: { label: 'Complete', color: 'emerald' }, blocked: { label: 'Blocked', color: 'rose' } } as const;

export function MobilityFamilyTab({ caseId }: { caseId: string }) {
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [workstream, setWorkstream] = useState<WorkstreamRow | null>(null);
  const [tasks, setTasks] = useState<FamilyTask[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [caseRes, wsRes] = await Promise.all([
        personaFetch(`/api/mobility/cases/${caseId}`, { cache: 'no-store' }),
        personaFetch(`/api/mobility/cases/${caseId}/workstreams`, { cache: 'no-store' }),
      ]);
      const [caseJson, wsJson] = await Promise.all([caseRes.json(), wsRes.json()]);
      if (caseJson.ok) setProfile(caseJson.case.household_profile ?? {});
      if (wsJson.ok) {
        const ws = (wsJson.workstreams as WorkstreamRow[]).find(w => w.workstream_key === 'G');
        if (ws) { setWorkstream(ws); setNotes(ws.notes ?? ''); setTasks((ws.tasks as FamilyTask[]) ?? []); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (t?: FamilyTask[], n?: string) => {
    if (!workstream) return;
    setSaving(true);
    try {
      const tasks_ = t ?? tasks;
      const res = await personaFetch(`/api/mobility/cases/${caseId}/workstreams`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workstream_key: 'G', tasks: tasks_, notes: n ?? notes,
          status: tasks_.some(x => x.status === 'in_progress') ? 'active' : tasks_.every(x => x.status === 'complete') ? 'complete' : 'active' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setWorkstream(json.workstream); setTasks(json.workstream.tasks ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }, [caseId, workstream, tasks, notes]);

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  const childAges = profile?.childAges ?? [];
  const hasElder = childAges.some(a => a >= 10);
  const hasYounger = childAges.some(a => a < 10);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-pink-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Workstream G — Family Stabilization</h2>
            <p className="text-xs text-slate-400">Priority: Medium-High · Wellbeing continuity · UK support network · Children settling</p>
          </div>
        </div>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2"><AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" /><p className="text-xs text-rose-300">{error}</p></div>}

      {/* aigentMe notice */}
      <div className="flex items-center gap-2 rounded-lg border border-pink-500/20 bg-pink-500/5 px-3 py-2">
        <Shield className="h-4 w-4 text-pink-400 shrink-0" />
        <p className="text-xs text-pink-200/80">Family and children's data is held under BlakQube compartmentalisation. aigentMe enforces minimum-disclosure — no family member details shared beyond necessity.</p>
      </div>

      {/* Household overview */}
      {profile && (profile.adultCount !== undefined || childAges.length > 0) && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> Household</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profile.adultCount !== undefined && <ProfileField label="Adults" value={String(profile.adultCount)} />}
            {profile.childCount !== undefined && <ProfileField label="Children" value={String(profile.childCount)} />}
            {childAges.length > 0 && <ProfileField label="Child ages" value={childAges.join(', ')} />}
            {profile.petsCount !== undefined && profile.petsCount > 0 && <ProfileField label="Pets" value={String(profile.petsCount)} />}
          </div>
          {profile.specialNeeds && <div className="pt-1 border-t border-slate-700/50"><p className="text-[11px] text-slate-500 mb-0.5">Special needs / medical</p><p className="text-xs text-slate-300">{profile.specialNeeds}</p></div>}
          {profile.gpRegistered && <div><p className="text-[11px] text-slate-500 mb-0.5">GP registration status</p><p className="text-xs text-slate-300">{profile.gpRegistered}</p></div>}
        </div>
      )}

      {/* Child transition cards */}
      {(hasElder || hasYounger) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasElder && (
            <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-pink-200">Secondary-age child (13)</p>
              <p className="text-[11px] text-slate-400">GCSE continuity · friendship networks · extracurricular</p>
            </div>
          )}
          {hasYounger && (
            <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-pink-200">Primary-age child (5)</p>
              <p className="text-[11px] text-slate-400">Reception / Year 1 transition · early settling support</p>
            </div>
          )}
        </div>
      )}

      {/* Task board */}
      <TaskBoard tasks={tasks} notes={notes} accentColor="pink" saving={saving}
        placeholder="GP registration, childcare, support contacts, family network notes…"
        onAdd={() => setTasks(ts => [...ts, { id: crypto.randomUUID(), label: '', status: 'pending', notes: '', assignee: '', due: '' }])}
        onUpdate={(id, f, v) => setTasks(ts => ts.map(t => t.id === id ? { ...t, [f]: v } : t))}
        onRemove={(id) => { const u = tasks.filter(t => t.id !== id); setTasks(u); save(u); }}
        onNotesChange={setNotes} onSave={() => save()} statusConfig={TASK_STATUS_CONFIG}
        scaffold={tasks.length === 0 ? () => {
          const s: FamilyTask[] = [
            { id: crypto.randomUUID(), label: 'Register with GP surgery in Dulwich / SE London', status: 'pending', notes: 'NHS registration requires proof of address — do immediately on arrival', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Register children with NHS dentist', status: 'pending', notes: 'NHS dental waitlists — register early', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Support 13yr-old: GCSE subject continuity review', status: 'pending', notes: 'Confirm subject alignment between NJ and UK curriculum — liaise with new school', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Support 5yr-old: September Year 1 settling plan', status: 'pending', notes: 'Visit school before start date if possible; arrange playdates if school permits', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Re-establish family support network (extended family, friends)', status: 'pending', notes: '', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Identify local activities / clubs for children (sports, arts)', status: 'pending', notes: 'Dulwich community — Herne Hill Velodrome, Dulwich Hamlet, local drama clubs', assignee: '', due: '' },
            { id: crypto.randomUUID(), label: 'Ensure continuity of any ongoing therapeutic / support services', status: 'pending', notes: '', assignee: '', due: '' },
          ]; setTasks(s); save(s);
        } : undefined}
        scaffoldLabel="Load default family stabilization scaffold"
      />
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-slate-500">{label}</p><p className="text-xs text-slate-200">{value}</p></div>;
}

interface TaskBoardProps {
  tasks: FamilyTask[]; notes: string; accentColor: string; saving: boolean;
  statusConfig: typeof TASK_STATUS_CONFIG; placeholder: string;
  scaffold?: () => void; scaffoldLabel?: string;
  onAdd: () => void; onUpdate: (id: string, f: keyof FamilyTask, v: string) => void;
  onRemove: (id: string) => void; onNotesChange: (v: string) => void; onSave: () => void;
}

function TaskBoard({ tasks, notes, accentColor, saving, statusConfig, placeholder, scaffold, scaffoldLabel, onAdd, onUpdate, onRemove, onNotesChange, onSave }: TaskBoardProps) {
  const inputCls = `w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-${accentColor}-500/60 focus:outline-none`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Tasks</h3>
        <button onClick={onAdd} className={`flex items-center gap-1.5 text-xs text-${accentColor}-400 hover:text-${accentColor}-300 transition-colors`}><Plus className="h-3.5 w-3.5" />Add task</button>
      </div>
      {tasks.length === 0 ? <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 text-center"><p className="text-xs text-slate-500">No tasks yet.</p></div> : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <select value={task.status} onChange={e => onUpdate(task.id, 'status', e.target.value)} className="shrink-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none">
                  {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none" value={task.label} onChange={e => onUpdate(task.id, 'label', e.target.value)} placeholder="Task description…" />
                <button onClick={() => onRemove(task.id)} className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={`${inputCls} text-xs py-1`} value={task.assignee} onChange={e => onUpdate(task.id, 'assignee', e.target.value)} placeholder="Assignee" />
                <input type="date" className={`${inputCls} text-xs py-1`} value={task.due} onChange={e => onUpdate(task.id, 'due', e.target.value)} />
              </div>
              <input className={`${inputCls} text-xs py-1`} value={task.notes} onChange={e => onUpdate(task.id, 'notes', e.target.value)} placeholder="Notes…" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Workstream notes</label>
        <textarea className={`w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-${accentColor}-500/60 focus:outline-none resize-none`} rows={3} value={notes} onChange={e => onNotesChange(e.target.value)} placeholder={placeholder} />
      </div>
      <button onClick={onSave} disabled={saving} className={`flex items-center gap-2 rounded-lg bg-${accentColor}-600 px-4 py-2 text-sm font-medium text-white hover:bg-${accentColor}-500 disabled:opacity-50 transition-colors`}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save workstream
      </button>
      {scaffold && (
        <button onClick={scaffold} className={`w-full rounded-lg border border-slate-600 border-dashed px-4 py-2.5 text-xs text-slate-400 hover:border-${accentColor}-500/40 hover:text-${accentColor}-400 transition-colors`}>
          {scaffoldLabel ?? 'Load default task scaffold'}
        </button>
      )}
    </div>
  );
}
