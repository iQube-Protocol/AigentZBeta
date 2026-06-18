'use client';

/**
 * MobilityEducationTab — Workstream C: Educational Continuity.
 *
 * Priority: Critical. September school-year deadline for two children.
 * Age 13 (secondary) and age 5 (primary) require separate applications.
 *
 * Surfaces: education profile, school-category critical dates, task board.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Loader2,
  MapPin,
  Users,
  RefreshCw,
  BookOpen,
  Clock,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const inputCls = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30';

interface EduTask {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  notes: string;
  assignee: string;
  due: string;
  childRef: 'elder' | 'younger' | 'both' | '';
}

interface ChildRecord {
  childId: string;
  age: string;
  currentGrade: string;
  yearGroup: string;
  currentSchool: string;
  targetSchool: string;
  alternativeSchools: string;
  continuityPriority: string;
  notes: string;
}

interface EducationProfile {
  // New structured schema
  children?: ChildRecord[];
  admissionsDeadlines?: string;
  continuityPriorities?: string;
  specialRequirements?: string;
  // Legacy flat fields (read-only compat)
  numberOfChildren?: string;
  childrenAges?: string;
  currentSchoolSystem?: string;
  targetSchoolType?: string;
  preferredSchoolArea?: string;
  elder_currentYear?: string;
  elder_requirementsNotes?: string;
  younger_currentYear?: string;
  younger_requirementsNotes?: string;
  senOrAdditionalNeeds?: string;
  applicationDeadlineNotes?: string;
}

interface CriticalDate {
  id: string;
  label: string;
  date_category: string;
  due_date: string;
  is_hard_deadline: boolean;
  status: string;
  workstream_key: string | null;
}

interface WorkstreamRow {
  id: string;
  workstream_key: string;
  label: string;
  priority: string;
  status: string;
  notes: string | null;
  tasks: EduTask[];
}

const TASK_STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'slate'   },
  in_progress: { label: 'In Progress', color: 'amber'   },
  complete:    { label: 'Complete',    color: 'emerald' },
  blocked:     { label: 'Blocked',     color: 'rose'    },
} as const;

const CHILD_REF_LABELS: Record<string, string> = {
  elder:   'Elder child',
  younger: 'Younger child',
  both:    'All children',
  '':      'General',
};

interface Props {
  caseId: string;
}

export function MobilityEducationTab({ caseId }: Props) {
  const [eduProfile, setEduProfile] = useState<EducationProfile | null>(null);
  const [workstream, setWorkstream] = useState<WorkstreamRow | null>(null);
  const [criticalDates, setCriticalDates] = useState<CriticalDate[]>([]);
  const [tasks, setTasks] = useState<EduTask[]>([]);
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
      if (caseJson.ok) setEduProfile(caseJson.case.education_profile ?? {});
      if (wsJson.ok) {
        const ws = (wsJson.workstreams as WorkstreamRow[]).find(w => w.workstream_key === 'C');
        if (ws) {
          setWorkstream(ws);
          setNotes(ws.notes ?? '');
          setTasks((ws.tasks as EduTask[]) ?? []);
        }
      }
      if (datesJson.ok) {
        setCriticalDates(
          (datesJson.dates as CriticalDate[])
            .filter(d => d.date_category === 'school' || d.workstream_key === 'C')
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const saveWorkstream = useCallback(async (updatedTasks?: EduTask[], updatedNotes?: string) => {
    if (!workstream) return;
    setSaving(true);
    try {
      const t = updatedTasks ?? tasks;
      const res = await personaFetch(`/api/mobility/cases/${caseId}/workstreams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstream_key: 'C',
          tasks: t,
          notes: updatedNotes ?? notes,
          status: t.some(x => x.status === 'in_progress') ? 'active' :
                  t.every(x => x.status === 'complete') ? 'complete' : 'active',
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
    setTasks(ts => [...ts, {
      id: crypto.randomUUID(), label: '', status: 'pending',
      notes: '', assignee: '', due: '', childRef: '',
    }]);
  };

  const updateTask = (id: string, field: keyof EduTask, value: string) => {
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

  // September admission deadline — derive from criticalDates or default
  const septDeadline = criticalDates.find(d => d.label.toLowerCase().includes('school') || d.date_category === 'school');
  const daysToSept = septDeadline ? daysUntil(septDeadline.due_date) : null;
  const isUrgent = daysToSept !== null && daysToSept <= 60;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-sky-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">Workstream C — Educational Continuity</h2>
            <p className="text-xs text-slate-400">Priority: Critical · {eduProfile?.children?.length ? `${eduProfile.children.length} child${eduProfile.children.length !== 1 ? 'ren' : ''}` : 'Children'} · September intake window</p>
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

      {/* September deadline alert */}
      {septDeadline && (
        <div className={cls(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          isUrgent ? 'border-rose-500/40 bg-rose-500/5' : 'border-sky-500/30 bg-sky-500/5',
        )}>
          <Calendar className={cls('h-5 w-5 shrink-0', isUrgent ? 'text-rose-400' : 'text-sky-400')} />
          <div className="flex-1">
            <p className={cls('text-sm font-semibold', isUrgent ? 'text-rose-200' : 'text-sky-200')}>
              {septDeadline.label}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(septDeadline.due_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {daysToSept !== null && (
            <div className={cls('text-right', isUrgent ? 'text-rose-300' : 'text-sky-300')}>
              <p className="text-xl font-bold">{Math.abs(daysToSept)}</p>
              <p className="text-[10px]">{daysToSept < 0 ? 'days past' : 'days remaining'}</p>
            </div>
          )}
        </div>
      )}

      {/* Child summary cards */}
      {eduProfile?.children && eduProfile.children.length > 0 ? (
        <div className={cls('grid gap-3', eduProfile.children.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {eduProfile.children.map((child, i) => (
            <div key={child.childId} className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-xs font-semibold text-sky-200">
                  Child {i + 1} — Age {child.age || 'UNKNOWN'}
                  {child.continuityPriority ? ` · ${child.continuityPriority.charAt(0).toUpperCase() + child.continuityPriority.slice(1)}` : ''}
                </span>
              </div>
              {child.yearGroup && <p className="text-[11px] text-slate-400">UK year group: {child.yearGroup}</p>}
              {child.currentGrade && <p className="text-[11px] text-slate-400">Current grade: {child.currentGrade}</p>}
              {child.currentSchool && <p className="text-[11px] text-slate-300">Current: {child.currentSchool}</p>}
              {child.targetSchool
                ? <p className="text-[11px] text-emerald-300">Target: {child.targetSchool}</p>
                : <p className="text-[11px] text-amber-400/70 italic">No target school set — complete education intake</p>
              }
              {child.alternativeSchools && <p className="text-[11px] text-slate-500">Alt: {child.alternativeSchools}</p>}
              {child.notes && <p className="text-[11px] text-slate-400">{child.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-sky-200">Secondary child</span>
            </div>
            {eduProfile?.elder_currentYear && (
              <p className="text-[11px] text-slate-400">Current year: {eduProfile.elder_currentYear}</p>
            )}
            {eduProfile?.elder_requirementsNotes && (
              <p className="text-[11px] text-slate-300">{eduProfile.elder_requirementsNotes}</p>
            )}
            {!eduProfile?.elder_currentYear && (
              <p className="text-[11px] text-slate-500 italic">Complete education intake to add details</p>
            )}
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-sky-200">Primary child</span>
            </div>
            {eduProfile?.younger_currentYear && (
              <p className="text-[11px] text-slate-400">Current year: {eduProfile.younger_currentYear}</p>
            )}
            {eduProfile?.younger_requirementsNotes && (
              <p className="text-[11px] text-slate-300">{eduProfile.younger_requirementsNotes}</p>
            )}
            {!eduProfile?.younger_currentYear && (
              <p className="text-[11px] text-slate-500 italic">Complete education intake to add details</p>
            )}
          </div>
        </div>
      )}

      {/* Education profile summary */}
      {eduProfile && (eduProfile.admissionsDeadlines || eduProfile.specialRequirements || eduProfile.continuityPriorities || eduProfile.preferredSchoolArea || eduProfile.targetSchoolType || eduProfile.senOrAdditionalNeeds) && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Education Notes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(eduProfile.admissionsDeadlines) && (
              <ProfileField icon={<Calendar className="h-3.5 w-3.5" />} label="Admissions deadlines" value={eduProfile.admissionsDeadlines} />
            )}
            {(eduProfile.continuityPriorities) && (
              <ProfileField icon={<GraduationCap className="h-3.5 w-3.5" />} label="Continuity priorities" value={eduProfile.continuityPriorities} />
            )}
            {eduProfile.preferredSchoolArea && (
              <ProfileField icon={<MapPin className="h-3.5 w-3.5" />} label="Preferred area" value={eduProfile.preferredSchoolArea} />
            )}
            {eduProfile.currentSchoolSystem && (
              <ProfileField icon={<BookOpen className="h-3.5 w-3.5" />} label="Current system" value={eduProfile.currentSchoolSystem} />
            )}
          </div>
          {(eduProfile.specialRequirements || eduProfile.senOrAdditionalNeeds) && (
            <div className="pt-1 border-t border-slate-700/50">
              <p className="text-[11px] text-slate-500 mb-0.5">Special requirements / SEN</p>
              <p className="text-xs text-slate-300">{eduProfile.specialRequirements || eduProfile.senOrAdditionalNeeds}</p>
            </div>
          )}
        </div>
      )}

      {/* School deadlines */}
      {criticalDates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200">School Deadlines</h3>
          <div className="space-y-1.5">
            {criticalDates.map(d => {
              const days = daysUntil(d.due_date);
              const urgent = days <= 30;
              return (
                <div key={d.id} className={cls(
                  'flex items-center justify-between rounded-lg border px-3 py-2',
                  urgent ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-700 bg-slate-900/40',
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200">{d.label}</span>
                    {d.is_hard_deadline && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300">hard</span>
                    )}
                  </div>
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
          <h3 className="text-sm font-semibold text-slate-200">Education Tasks</h3>
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-6 text-center">
            <p className="text-xs text-slate-500">No tasks yet.</p>
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
                  <select
                    value={task.childRef}
                    onChange={e => updateTask(task.id, 'childRef', e.target.value)}
                    className="shrink-0 rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none"
                  >
                    {Object.entries(CHILD_REF_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
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
                <input
                  className={`${inputCls} text-xs py-1`}
                  value={task.notes}
                  onChange={e => updateTask(task.id, 'notes', e.target.value)}
                  placeholder="Notes…"
                />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-slate-400">Workstream notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30 resize-none"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="School research notes, admissions contacts, catchment findings…"
          />
        </div>

        <button
          onClick={() => saveWorkstream()}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save workstream
        </button>
      </div>

      {/* Default task scaffold */}
      {tasks.length === 0 && (
        <button
          onClick={() => {
            const scaffold: EduTask[] = [
              { id: crypto.randomUUID(), label: 'Research Dulwich secondary schools — year 9 entry', status: 'pending', notes: 'Dulwich College, JAGS, Alleyn\'s, Harris Boys\' Academy', assignee: '', due: '', childRef: 'elder' },
              { id: crypto.randomUUID(), label: 'Research Dulwich primary schools — reception/Year 1', status: 'pending', notes: 'Check Ofsted ratings and catchment areas', assignee: '', due: '', childRef: 'younger' },
              { id: crypto.randomUUID(), label: 'Confirm September intake application deadlines', status: 'pending', notes: 'Check Southwark & Lambeth council in-year admission processes', assignee: '', due: '', childRef: 'both' },
              { id: crypto.randomUUID(), label: 'Obtain current school records / transcripts from NJ schools', status: 'pending', notes: '', assignee: '', due: '', childRef: 'both' },
              { id: crypto.randomUUID(), label: 'Submit school applications with Dulwich address', status: 'pending', notes: 'Requires confirmed housing address — coordinate with Workstream B', assignee: '', due: '', childRef: 'both' },
            ];
            setTasks(scaffold);
            saveWorkstream(scaffold);
          }}
          className="w-full rounded-lg border border-slate-600 border-dashed px-4 py-2.5 text-xs text-slate-400 hover:border-sky-500/40 hover:text-sky-400 transition-colors"
        >
          Load default education task scaffold
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
