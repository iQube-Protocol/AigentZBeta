'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RefreshCcw, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Circle, AlertCircle, Clock, Target,
  TrendingUp, Users, Shield, BookOpen, Zap,
} from 'lucide-react';
import type {
  LaunchOpsProgramData,
  LaunchSprintTask,
  LoTaskStatus,
  LoReadinessScore,
  VReadinessDashboard,
} from '@/types/launchOps';

// ── Theme helpers ──────────────────────────────────────────────────────────────

function th(d: boolean) {
  return {
    card:         d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:    d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    textPrimary:  d ? 'text-slate-100' : 'text-slate-900',
    textSecondary:d ? 'text-slate-300' : 'text-slate-700',
    textMuted:    d ? 'text-slate-400' : 'text-slate-600',
    textSubtle:   d ? 'text-slate-500' : 'text-slate-400',
    divider:      d ? 'border-white/[0.07]' : 'border-slate-200',
  };
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function taskStatusIcon(status: LoTaskStatus) {
  switch (status) {
    case 'done':    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'doing':   return <Clock className="w-4 h-4 text-blue-400" />;
    case 'blocked': return <AlertCircle className="w-4 h-4 text-red-400" />;
    case 'canceled':return <Circle className="w-4 h-4 text-slate-500" />;
    default:        return <Circle className="w-4 h-4 text-slate-400" />;
  }
}

function taskStatusBadge(status: LoTaskStatus, isDark: boolean) {
  const base = 'text-[10px] uppercase font-medium px-1.5 py-0.5 rounded';
  const map: Record<LoTaskStatus, string> = {
    done:     'bg-emerald-500/20 text-emerald-400',
    doing:    'bg-blue-500/20 text-blue-400',
    blocked:  'bg-red-500/20 text-red-400',
    todo:     isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500',
    canceled: 'bg-slate-500/20 text-slate-500',
  };
  return <span className={`${base} ${map[status]}`}>{status}</span>;
}

function priorityDot(priority: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-500',
    high:     'bg-orange-400',
    medium:   'bg-yellow-400',
    low:      'bg-slate-400',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${map[priority] ?? 'bg-slate-400'} mr-1.5 flex-shrink-0`} />;
}

function readinessColor(score: LoReadinessScore | null | undefined) {
  switch (score) {
    case 'green':  return 'bg-emerald-500';
    case 'yellow': return 'bg-yellow-400';
    case 'red':    return 'bg-red-500';
    default:       return 'bg-slate-600';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, isDark }: { pct: number | null; isDark: boolean }) {
  const p = pct ?? 0;
  return (
    <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function ReadinessGrid({ data, isDark }: { data: VReadinessDashboard; isDark: boolean }) {
  const s = th(isDark);
  const buckets: { key: keyof VReadinessDashboard; label: string; icon: React.ReactNode }[] = [
    { key: 'offer_score',    label: 'Offer',    icon: <Target className="w-3.5 h-3.5" /> },
    { key: 'audience_score', label: 'Audience', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'proof_score',    label: 'Proof',    icon: <Shield className="w-3.5 h-3.5" /> },
    { key: 'ops_score',      label: 'Ops',      icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'story_score',    label: 'Story',    icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={`rounded-lg ${s.innerCard} p-3`}>
      <p className={`text-[10px] uppercase tracking-wide ${s.textSubtle} mb-2`}>Readiness — Week {data.week_number ?? '?'}</p>
      <div className="grid grid-cols-5 gap-2">
        {buckets.map(({ key, label, icon }) => {
          const score = data[key] as LoReadinessScore | null;
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${readinessColor(score)}/20`}>
                <span className={readinessColor(score).replace('bg-', 'text-')}>{icon}</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${readinessColor(score)}`} />
              <p className={`text-[9px] ${s.textSubtle}`}>{label}</p>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 pt-2 border-t border-white/[0.05]">
        <span className="text-[10px] text-emerald-400">● {data.green_count} green</span>
        <span className="text-[10px] text-yellow-400">● {data.yellow_count} yellow</span>
        <span className="text-[10px] text-red-400">● {data.red_count} red</span>
      </div>
    </div>
  );
}

function TaskRow({
  task, onStatusChange, isDark, updating,
}: {
  task: LaunchSprintTask;
  onStatusChange: (id: string, status: LoTaskStatus) => void;
  isDark: boolean;
  updating: string | null;
}) {
  const s = th(isDark);
  const cycleStatus = (current: LoTaskStatus): LoTaskStatus => {
    const cycle: LoTaskStatus[] = ['todo', 'doing', 'done', 'blocked'];
    const i = cycle.indexOf(current);
    return cycle[(i + 1) % cycle.length];
  };

  return (
    <div className={`flex items-start gap-2 py-2 px-2 rounded hover:bg-white/[0.03] transition-colors`}>
      <button
        className="mt-0.5 flex-shrink-0"
        onClick={() => onStatusChange(task.id, cycleStatus(task.status))}
        disabled={updating === task.id}
        title="Cycle status"
      >
        {updating === task.id
          ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          : taskStatusIcon(task.status)}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {priorityDot(task.priority)}
          <span className={`text-[11px] ${task.status === 'done' ? 'line-through ' + s.textSubtle : s.textPrimary}`}>
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] ${s.textSubtle}`}>{task.code}</span>
          <span className={`text-[9px] ${s.textSubtle}`}>·</span>
          <span className={`text-[9px] ${s.textMuted}`}>{task.owner}</span>
          {task.due_date && (
            <>
              <span className={`text-[9px] ${s.textSubtle}`}>·</span>
              <span className="text-[9px] text-orange-400">{task.due_date}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{taskStatusBadge(task.status, isDark)}</div>
    </div>
  );
}

function WeekCard({
  week, onStatusChange, updatingTask, isDark,
}: {
  week: LaunchOpsProgramData['weeks'][number];
  onStatusChange: (id: string, status: LoTaskStatus) => void;
  updatingTask: string | null;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(week.status === 'doing');
  const s = th(isDark);
  const done = week.tasks.filter((t) => t.status === 'done').length;
  const total = week.tasks.length;

  const weekStatusColor: Record<string, string> = {
    doing:   'border-l-blue-500',
    done:    'border-l-emerald-500',
    blocked: 'border-l-red-500',
    todo:    'border-l-slate-600',
    canceled:'border-l-slate-700',
  };

  return (
    <div className={`rounded-lg ${s.innerCard} border-l-2 ${weekStatusColor[week.status] ?? 'border-l-slate-600'}`}>
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wide ${s.textSubtle}`}>Week {week.week_number}</span>
          <span className={`text-sm font-semibold ${s.textPrimary}`}>{week.label}</span>
          {taskStatusBadge(week.status, isDark)}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] ${s.textMuted}`}>{done}/{total}</span>
          <div className="w-16">
            <ProgressBar pct={week.completion_pct} isDark={isDark} />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {week.goal && (
            <p className={`text-[11px] ${s.textMuted} mb-2 italic`}>{week.goal}</p>
          )}
          {week.tasks.length === 0 ? (
            <p className={`text-[11px] ${s.textSubtle} text-center py-2`}>No tasks yet.</p>
          ) : (
            <div className={`divide-y ${s.divider}`}>
              {week.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  isDark={isDark}
                  updating={updatingTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  theme?: 'light' | 'dark';
}

const PROGRAM_SLUG = 'metaknyt-launch-reset';

export default function MarketaLaunchOpsTab({ theme = 'dark' }: Props) {
  const isDark = theme === 'dark';
  const s = th(isDark);

  const [data, setData] = useState<LaunchOpsProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/launch-ops?slug=${PROGRAM_SLUG}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
      } else {
        setError(json.error ?? 'Failed to load launch ops data.');
      }
    } catch {
      setError('Network error loading launch ops.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = useCallback(async (taskId: string, status: LoTaskStatus) => {
    setUpdatingTask(taskId);
    try {
      await fetch('/api/marketa/launch-ops/task-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status }),
      });
      // Optimistic local update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          weeks: prev.weeks.map((w) => ({
            ...w,
            tasks: w.tasks.map((t) =>
              t.id === taskId ? { ...t, status } : t
            ),
          })),
        };
      });
    } finally {
      setUpdatingTask(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
        <span className={`ml-2 text-sm ${s.textMuted}`}>Loading launch ops…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className={`text-sm ${s.textMuted}`}>{error ?? 'No program data found.'}</p>
        <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  const { program, health, weeks, readiness } = data;
  const totalDone = health.done_tasks;
  const totalAll = health.total_tasks;
  const completionPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className={`rounded-xl ${s.card} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-4 h-4 text-rose-400" />
              <h2 className={`text-base font-bold ${s.textPrimary}`}>{program.name}</h2>
              <Badge variant="outline" className="text-[10px] capitalize border-rose-500/40 text-rose-400">
                {program.status}
              </Badge>
            </div>
            <p className={`text-[11px] ${s.textMuted}`}>30-day sprint · investor-first activation → Kickstarter relaunch</p>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchData} className="text-slate-400 hover:text-white">
            <RefreshCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Sprint KPI strip */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Tasks Done',    value: `${totalDone}/${totalAll}`, accent: 'text-emerald-400' },
            { label: 'Blocked',       value: health.blocked_tasks,       accent: 'text-red-400' },
            { label: 'Proof Assets',  value: `${data.approvedProofCount}/${data.proofCount}`, accent: 'text-purple-400' },
            { label: 'Sprint',        value: `${completionPct}%`,        accent: 'text-rose-400' },
          ].map(({ label, value, accent }) => (
            <div key={label} className={`rounded-lg ${s.innerCard} p-2 text-center`}>
              <p className={`text-lg font-bold ${accent}`}>{value}</p>
              <p className={`text-[9px] uppercase tracking-wide ${s.textSubtle} mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Overall progress bar */}
        <div className="mt-2">
          <ProgressBar pct={completionPct} isDark={isDark} />
        </div>
      </div>

      {/* Readiness */}
      {readiness && <ReadinessGrid data={readiness} isDark={isDark} />}

      {/* Sprint weeks */}
      <div className={`rounded-xl ${s.card} p-4`}>
        <p className={`text-[11px] uppercase tracking-wide ${s.textSubtle} mb-3`}>30-day Sprint Board</p>
        <div className="space-y-2">
          {weeks.map((week) => (
            <WeekCard
              key={week.id}
              week={week}
              onStatusChange={handleStatusChange}
              updatingTask={updatingTask}
              isDark={isDark}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
