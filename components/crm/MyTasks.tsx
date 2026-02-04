'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Upload, CheckCircle2, Clock, XCircle, ExternalLink, Trophy } from 'lucide-react';
import { CrmContribution, ContributionStatus } from '@/types/crm';

interface MyTasksProps {
  tenantId: string;
  personaId: string;
  onSubmit?: () => void;
}

interface TaskContribution extends CrmContribution {
  task?: {
    id: string;
    title: string;
    slug: string;
    category: string;
    difficultyLevel: number;
    expectedImpactLevel: number;
    rewardQct: number;
    rewardQoyn: number;
    rewardKnyt: number;
  };
}

const statusConfig: Record<ContributionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  claimed: { label: 'Claimed', color: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30', icon: <Clock className="h-3 w-3" /> },
  submitted: { label: 'Submitted', color: 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30', icon: <Upload className="h-3 w-3" /> },
  under_review: { label: 'Under Review', color: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30', icon: <Clock className="h-3 w-3" /> },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30', icon: <XCircle className="h-3 w-3" /> },
};

export function MyTasks({ tenantId, personaId, onSubmit }: MyTasksProps) {
  const [contributions, setContributions] = useState<TaskContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<TaskContribution | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [artifactUrl, setArtifactUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/contributions?tenantId=${tenantId}&personaId=${personaId}&hasTask=true`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setContributions(data.contributions || []);
    } catch (error) {
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (personaId) fetchMyTasks(); }, [tenantId, personaId]);

  const handleSubmitWork = async () => {
    if (!selectedContribution) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, contributionId: selectedContribution.id, action: 'submit', artifactUrl: artifactUrl || undefined, notes: submitNotes || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      showToast('Work submitted!');
      setSubmitDialogOpen(false);
      setArtifactUrl('');
      setSubmitNotes('');
      fetchMyTasks();
      onSubmit?.();
    } catch (error: any) {
      showToast(error.message || 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeContributions = contributions.filter(c => ['claimed', 'submitted', 'under_review'].includes(c.status as string));
  const completedContributions = contributions.filter(c => ['accepted', 'rejected', 'cancelled'].includes(c.status as string));

  const renderCard = (contribution: TaskContribution) => {
    const status = statusConfig[contribution.status as ContributionStatus] || statusConfig.claimed;
    const task = contribution.task;
    return (
      <div key={contribution.id} className="flex flex-col rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10">
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.color} flex items-center gap-1`}>{status.icon}{status.label}</span>
            {contribution.finalScore !== undefined && contribution.finalScore !== null && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300">Score: {contribution.finalScore}%</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-white mt-2">{task?.title || contribution.contributionType}</h3>
          {task && <p className="text-xs text-slate-400 mt-1">{task.category} • L{task.difficultyLevel} • Impact L{task.expectedImpactLevel}</p>}
        </div>
        <div className="flex-1 px-4 pb-3">
          {task && (task.rewardQct > 0 || task.rewardQoyn > 0 || task.rewardKnyt > 0) && (
            <div className="flex gap-1.5 flex-wrap mb-2">
              {task.rewardQct > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30">{task.rewardQct} QCT</span>}
              {task.rewardQoyn > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">{task.rewardQoyn} QOYN</span>}
              {task.rewardKnyt > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">{task.rewardKnyt} KNYT</span>}
            </div>
          )}
          {contribution.artifactUrl && (
            <a href={contribution.artifactUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300">
              <ExternalLink className="h-3 w-3" />View Artifact
            </a>
          )}
          <p className="text-[10px] text-slate-500 mt-2">Claimed: {new Date(contribution.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="px-4 py-3 border-t border-white/5">
          {contribution.status === 'claimed' && (
            <button onClick={() => { setSelectedContribution(contribution); setSubmitDialogOpen(true); }} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium flex items-center gap-1.5">
              <Upload className="h-3 w-3" />Submit Work
            </button>
          )}
          {contribution.status === 'submitted' && <span className="text-xs text-slate-400">Awaiting review...</span>}
          {contribution.status === 'accepted' && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Completed!</span>}
          {contribution.status === 'rejected' && <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="h-3 w-3" />Rejected</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
      
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">My Tasks</h2>
        <button onClick={fetchMyTasks} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1.5 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/5 ring-1 ring-white/10">
        <button onClick={() => setActiveTab('active')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          Active ({activeContributions.length})
        </button>
        <button onClick={() => setActiveTab('completed')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'completed' ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          Completed ({completedContributions.length})
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" /></div>
        ) : (activeTab === 'active' ? activeContributions : completedContributions).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><p>No {activeTab} tasks</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(activeTab === 'active' ? activeContributions : completedContributions).map(renderCard)}
          </div>
        )}
      </div>

      {/* Submit Dialog */}
      {submitDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSubmitDialogOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl bg-slate-900 ring-1 ring-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Submit Work</h2>
            <p className="text-sm text-slate-400 mb-4">Submit your work for "{selectedContribution?.task?.title}"</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Artifact URL (optional)</label>
                <input value={artifactUrl} onChange={(e) => setArtifactUrl(e.target.value)} placeholder="https://github.com/..." className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 placeholder:text-slate-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                <textarea value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} rows={3} placeholder="Describe your work..." className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 resize-none placeholder:text-slate-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setSubmitDialogOpen(false)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={handleSubmitWork} disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</> : <><Upload className="h-4 w-4" />Submit</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyTasks;
