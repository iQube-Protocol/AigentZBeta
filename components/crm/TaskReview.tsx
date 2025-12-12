'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, User, Calendar, Star } from 'lucide-react';
import { CrmContribution } from '@/types/crm';

interface TaskReviewProps {
  tenantId: string;
  reviewerPersonaId?: string;
  onReviewComplete?: () => void;
}

interface ReviewableContribution extends CrmContribution {
  task?: { id: string; title: string; slug: string; category: string; difficultyLevel: number; expectedImpactLevel: number; rewardQct: number; rewardQoyn: number; rewardKnyt: number; };
  persona?: { id: string; displayName: string; };
}

export function TaskReview({ tenantId, reviewerPersonaId, onReviewComplete }: TaskReviewProps) {
  const [contributions, setContributions] = useState<ReviewableContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<ReviewableContribution | null>(null);
  const [processing, setProcessing] = useState(false);
  const [finalScore, setFinalScore] = useState(80);
  const [qualityScore, setQualityScore] = useState(80);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/contributions?tenantId=${tenantId}&status=submitted&hasTask=true`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setContributions(data.contributions || []);
    } catch (error) {
      showToast('Failed to load submissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, [tenantId]);

  const handleApprove = async () => {
    if (!selectedContribution) return;
    setProcessing(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, contributionId: selectedContribution.id, action: 'complete', finalScore, qualityScore, reviewerPersonaId, notes: reviewNotes || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      showToast(`Approved! Score: ${finalScore}%`);
      setReviewDialogOpen(false);
      resetForm();
      setTimeout(() => { fetchSubmissions(); onReviewComplete?.(); }, 100);
    } catch (error: any) {
      showToast(error.message || 'Failed to approve', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedContribution || !rejectionReason) return;
    setProcessing(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, contributionId: selectedContribution.id, action: 'reject', rejectionReason, reviewerPersonaId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      showToast('Submission rejected');
      setRejectDialogOpen(false);
      resetForm();
      setTimeout(() => { fetchSubmissions(); onReviewComplete?.(); }, 100);
    } catch (error: any) {
      showToast(error.message || 'Failed to reject', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => { setSelectedContribution(null); setFinalScore(80); setQualityScore(80); setReviewNotes(''); setRejectionReason(''); };

  const calculateRewards = (task: ReviewableContribution['task'], score: number) => {
    if (!task) return { qct: 0, qoyn: 0, knyt: 0 };
    const m = score / 100;
    return { qct: Math.round(task.rewardQct * m * 100) / 100, qoyn: Math.round(task.rewardQoyn * m * 100) / 100, knyt: Math.round(task.rewardKnyt * m * 100) / 100 };
  };

  const reviewableCount = contributions.filter(c => c.personaId !== reviewerPersonaId).length;

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Review Submissions</h2>
          <p className="text-sm text-slate-400">{reviewableCount} submission(s) awaiting review</p>
        </div>
        <button onClick={fetchSubmissions} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1.5 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" /></div>
      ) : contributions.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No submissions awaiting review</p></div>
      ) : (
        <div className="space-y-4">
          {contributions.map(contribution => {
            const task = contribution.task;
            const isOwn = contribution.personaId === reviewerPersonaId;
            return (
              <div key={contribution.id} className="rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10">
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-white">{task?.title || contribution.contributionType}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {contribution.persona && <span className="flex items-center gap-1"><User className="h-3 w-3" />{contribution.persona.displayName}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(contribution.updatedAt as string).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30">Pending</span>
                  </div>
                </div>
                <div className="p-4">
                  {task && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                      <div><span className="text-slate-500">Category</span><p className="text-white capitalize">{task.category}</p></div>
                      <div><span className="text-slate-500">Difficulty</span><p className="text-white">L{task.difficultyLevel}</p></div>
                      <div><span className="text-slate-500">Impact</span><p className="text-white">L{task.expectedImpactLevel}</p></div>
                      <div><span className="text-slate-500">Rewards</span>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {task.rewardQct > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">{task.rewardQct} QCT</span>}
                          {task.rewardQoyn > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{task.rewardQoyn} QOYN</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  {contribution.artifactUrl && (
                    <a href={contribution.artifactUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 mb-2">
                      <ExternalLink className="h-3 w-3" />View Artifact
                    </a>
                  )}
                  {contribution.notes && <div className="p-2 rounded-lg bg-white/5 text-xs text-slate-300 mt-2">{contribution.notes}</div>}
                </div>
                <div className="px-4 py-3 border-t border-white/5 flex gap-2">
                  {isOwn ? (
                    <p className="text-xs text-slate-500 italic">Cannot review your own submission</p>
                  ) : (
                    <>
                      <button onClick={() => { setSelectedContribution(contribution); setReviewDialogOpen(true); }} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium flex items-center gap-1.5">
                        <Star className="h-3 w-3" />Approve
                      </button>
                      <button onClick={() => { setSelectedContribution(contribution); setRejectDialogOpen(true); }} className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs flex items-center gap-1.5 hover:bg-white/10">
                        <XCircle className="h-3 w-3" />Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      {reviewDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewDialogOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl bg-slate-900 ring-1 ring-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Review Submission</h2>
            <p className="text-sm text-slate-400 mb-4">Score "{selectedContribution?.task?.title}"</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-xs text-slate-400">Final Score</label><span className="text-xl font-bold text-white">{finalScore}%</span></div>
                <input type="range" min={0} max={100} step={5} value={finalScore} onChange={(e) => setFinalScore(Number(e.target.value))} className="w-full accent-fuchsia-500" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-xs text-slate-400">Quality Score</label><span className="text-sm text-white">{qualityScore}%</span></div>
                <input type="range" min={0} max={100} step={5} value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full accent-fuchsia-500" />
              </div>
              {selectedContribution?.task && (
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-slate-400 mb-2">Rewards at {finalScore}%:</p>
                  <div className="flex gap-1.5">
                    {(() => { const r = calculateRewards(selectedContribution.task, finalScore); return (<>
                      {r.qct > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">{r.qct} QCT</span>}
                      {r.qoyn > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{r.qoyn} QOYN</span>}
                      {r.knyt > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">{r.knyt} KNYT</span>}
                    </>); })()}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2} placeholder="Feedback..." className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 resize-none placeholder:text-slate-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setReviewDialogOpen(false)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={handleApprove} disabled={processing} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {processing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></> : <><CheckCircle2 className="h-4 w-4" />Approve ({finalScore}%)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRejectDialogOpen(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl bg-slate-900 ring-1 ring-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Reject Submission</h2>
            <p className="text-sm text-slate-400 mb-4">Provide a reason for rejection</p>
            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} placeholder="Reason..." className="w-full px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 resize-none placeholder:text-slate-500" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRejectDialogOpen(false)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={handleReject} disabled={!rejectionReason || processing} className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 ring-1 ring-red-500/30 text-red-300 font-medium disabled:opacity-50">
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskReview;
