'use client';

/**
 * MobilityHousingTab — Workstream B: Housing Acquisition.
 *
 * Surfaces the housing profile from the MAF, the critical housing dates,
 * and a task management area for the housing search.
 *
 * Priority: Critical. This is the most time-constrained workstream.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Save,
  Loader2,
  MapPin,
  PoundSterling,
  Users,
  RefreshCw,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const inputCls = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30';

interface HousingTask {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  notes: string;
  assignee: string;
  due: string;
}

interface HousingProfile {
  currentHousingStatus?: string;
  requiredDepartureDate?: string;
  housingBudget?: string;
  preferredLocation?: string;
  acceptableLocations?: string;
  housingPriorities?: string;
  guarantorsAvailable?: string;
  temporaryHousingAvailable?: string;
}

interface CriticalDate {
  id: string;
  label: string;
  date_category: string;
  workstream_key?: string;
  due_date: string;
  is_hard_deadline: boolean;
  status: string;
}

interface WorkstreamRow {
  id: string;
  workstream_key: string;
  label: string;
  priority: string;
  status: string;
  notes: string | null;
  tasks: HousingTask[];
}

const TASK_STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'slate'   },
  in_progress: { label: 'In Progress', color: 'amber'   },
  complete:    { label: 'Complete',    color: 'emerald' },
  blocked:     { label: 'Blocked',     color: 'rose'    },
} as const;

interface Props {
  caseId: string;
}

export function MobilityHousingTab({ caseId }: Props) {
  const [housingProfile, setHousingProfile] = useState<HousingProfile | null>(null);
  const [workstream, setWorkstream] = useState<WorkstreamRow | null>(null);
  const [criticalDates, setCriticalDates] = useState<CriticalDate[]>([]);
  const [tasks, setTasks] = useState<HousingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseRes, wsRes, datesRes] = await Promise.all([
        personaFetch(`/api/mobility/cases/${caseId}`, { cache: 'no-store' }),
        personaFetch(`/api/mobility/cases/${caseId}/workstreams`, { cache: 'no-store' }),
        personaFetch(`/api/mobility/cases/${caseId}/dates`, { cache: 'no-store' }),
      ]);
      const [caseJson, wsJson, datesJson] = await Promise.all([
        caseRes.json(), wsRes.json(), datesRes.json(),
      ]);
      if (caseJson.ok) setHousingProfile(caseJson.case.housing_profile ?? {});
      if (wsJson.ok) {
        const ws = (wsJson.workstreams as WorkstreamRow[]).find(w => w.workstream_key === 'B');
        if (ws) {
          setWorkstream(ws);
          setNotes(ws.notes ?? '');
          setTasks((ws.tasks as HousingTask[]) ?? []);
        }
      }
      if (datesJson.ok) {
        setCriticalDates(
          (datesJson.dates as CriticalDate[]).filter(d =>
            d.date_category === 'housing' || d.workstream_key === 'B',
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const saveWorkstream = useCallback(async (updatedTasks?: HousingTask[], updatedNotes?: string) => {
    if (!workstream) return;
    setSaving(true);
    try {
      const res = await personaFetch(`/api/mobility/cases/${caseId}/workstreams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstream_key: 'B',
          tasks: updatedTasks ?? tasks,
          notes: updatedNotes ?? notes,
          status: (updatedTasks ?? tasks).some(t => t.status === 'in_progress') ? 'active' :
                  (updatedTasks ?? tasks).every(t => t.status === 'complete') ? 'complete' : 'active',
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setWorkstream(json.workstream);
      setTasks(json.workstream.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [caseId, workstream, tasks, notes]);

  const addTask = () => {
    const newTask: HousingTask = {
      id: crypto.randomUUID(),
      label: '',
      status: 'pending',
      notes: '',
      assignee: '',
      due: '',
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
  };

  const updateTask = (id: string, field: keyof HousingTask, value: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    saveWorkstream(updated);
  };

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const departureDeadline = housingProfile?.requiredDepartureDate;
  const daysToDeadline = departureDeadline ? daysUntil(departureDeadline) : null;
  const isUrgent = daysToDeadline !== null && daysToDeadline <= 30;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Workstream B — Housing Acquisition</h2>
            <p className="text-xs text-slate-400">Priority: Critical{housingProfile?.preferredLocation ? ` · ${housingProfile.preferredLocation}` : ''} · Housing acquisition</p>
          </div>
        </div>
        <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Departure deadline alert */}
      {departureDeadline && (
        <div className={cls(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          isUrgent ? 'border-rose-500/40 bg-rose-500/8' : 'border-amber-500/30 bg-amber-500/5',
        )}>
          <Calendar className={cls('h-5 w-5 shrink-0', isUrgent ? 'text-rose-400' : 'text-amber-400')} />
          <div className="flex-1">
            <p className={cls('text-sm font-semibold', isUrgent ? 'text-rose-200' : 'text-amber-200')}>
              Housing Departure Deadline
            </p>
            <p className="text-xs text-slate-400">
              {new Date(departureDeadline).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className={cls('text-right', isUrgent ? 'text-rose-300' : 'text-amber-300')}>
            <p className="text-xl font-bold">{daysToDeadline !== null ? Math.abs(daysToDeadline) : '—'}</p>
            <p className="text-[10px]">{daysToDeadline !== null && daysToDeadline < 0 ? 'days past' : 'days remaining'}</p>
          </div>
        </div>
      )}

      {/* Housing profile summary */}
      {housingProfile && Object.keys(housingProfile).some(k => housingProfile[k as keyof HousingProfile]) && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Housing Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {housingProfile.housingBudget && (
              <ProfileField icon={<PoundSterling className="h-3.5 w-3.5" />} label="Budget" value={housingProfile.housingBudget} />
            )}
            {housingProfile.preferredLocation && (
              <ProfileField icon={<MapPin className="h-3.5 w-3.5" />} label="Preferred area" value={housingProfile.preferredLocation} />
            )}
            {housingProfile.acceptableLocations && (
              <ProfileField icon={<MapPin className="h-3.5 w-3.5 opacity-50" />} label="Acceptable areas" value={housingProfile.acceptableLocations} />
            )}
            {housingProfile.guarantorsAvailable && (
              <ProfileField icon={<Users className="h-3.5 w-3.5" />} label="Guarantors" value={housingProfile.guarantorsAvailable} />
            )}
            {housingProfile.temporaryHousingAvailable && (
              <ProfileField icon={<Home className="h-3.5 w-3.5 opacity-50" />} label="Temporary housing" value={housingProfile.temporaryHousingAvailable} />
            )}
          </div>
          {housingProfile.housingPriorities && (
            <div className="pt-1 border-t border-slate-700/50">
              <p className="text-[11px] text-slate-500 mb-0.5">Priorities</p>
              <p className="text-xs text-slate-300">{housingProfile.housingPriorities}</p>
            </div>
          )}
        </div>
      )}

      {/* Critical dates */}
      {criticalDates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200">Housing Deadlines</h3>
          <div className="space-y-1.5">
            {criticalDates.map(d => {
              const days = daysUntil(d.due_date);
              const urgent = days <= 14;
              return (
                <div key={d.id} className={cls(
                  'flex items-center justify-between rounded-lg border px-3 py-2',
                  urgent ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700 bg-slate-900/40',
                )}>
                  <span className="text-sm text-slate-200">{d.label}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">{new Date(d.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    <span className={cls('font-medium', urgent ? 'text-rose-300' : 'text-slate-300')}>
                      {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task board */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Housing Tasks</h3>
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 text-center">
            <p className="text-xs text-slate-500">No tasks yet. Add housing search tasks to begin tracking progress.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <select
                    value={task.status}
                    onChange={e => updateTask(task.id, 'status', e.target.value)}
                    className="shrink-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none"
                  >
                    {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <input
                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    value={task.label}
                    onChange={e => updateTask(task.id, 'label', e.target.value)}
                    placeholder="Task description…"
                  />
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={`${inputCls} text-xs py-1`}
                    value={task.assignee}
                    onChange={e => updateTask(task.id, 'assignee', e.target.value)}
                    placeholder="Assignee"
                  />
                  <input
                    type="date"
                    className={`${inputCls} text-xs py-1`}
                    value={task.due}
                    onChange={e => updateTask(task.id, 'due', e.target.value)}
                  />
                </div>
                {task.notes !== undefined && (
                  <input
                    className={`${inputCls} text-xs py-1`}
                    value={task.notes}
                    onChange={e => updateTask(task.id, 'notes', e.target.value)}
                    placeholder="Notes…"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Workstream notes */}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Workstream notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Housing agent contacts, property leads, viewing notes…"
          />
        </div>

        <button
          onClick={() => saveWorkstream()}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save workstream
        </button>
      </div>

      {/* Default task scaffold */}
      {tasks.length === 0 && (
        <button
          onClick={() => {
            const scaffold: HousingTask[] = [
              { id: crypto.randomUUID(), label: `Contact letting agents${housingProfile?.preferredLocation ? ` — ${housingProfile.preferredLocation}` : ' in target area'}`, status: 'pending', notes: housingProfile?.acceptableLocations ? `Also consider: ${housingProfile.acceptableLocations}` : '', assignee: '', due: '' },
              { id: crypto.randomUUID(), label: 'Verify school catchment areas for target properties', status: 'pending', notes: '', assignee: '', due: '' },
              { id: crypto.randomUUID(), label: 'Confirm guarantor / reference arrangements', status: 'pending', notes: '', assignee: '', due: '' },
              { id: crypto.randomUUID(), label: 'Identify temporary accommodation contingency', status: 'pending', notes: '', assignee: '', due: '' },
              { id: crypto.randomUUID(), label: 'Submit first rental applications', status: 'pending', notes: '', assignee: '', due: '' },
            ];
            setTasks(scaffold);
            saveWorkstream(scaffold);
          }}
          className="w-full rounded-lg border border-slate-600 border-dashed px-4 py-2.5 text-xs text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
        >
          Load default housing task scaffold
        </button>
      )}
    </div>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-xs text-slate-200">{value}</p>
      </div>
    </div>
  );
}
