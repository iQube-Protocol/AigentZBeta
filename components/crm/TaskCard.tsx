'use client';

import React from 'react';
import { 
  Code, 
  Palette, 
  Briefcase, 
  Database, 
  Boxes, 
  Users,
  Clock,
  Trophy,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CrmTaskTemplate, TaskCategory } from '@/types/crm';

interface TaskCardProps {
  task: CrmTaskTemplate;
  onClaim?: (taskId: string) => void;
  onView?: (taskId: string) => void;
  isClaiming?: boolean;
  alreadyClaimed?: boolean;
}

const categoryIcons: Record<TaskCategory, React.ReactNode> = {
  technical: <Code className="h-4 w-4" />,
  creative: <Palette className="h-4 w-4" />,
  entrepreneurial: <Briefcase className="h-4 w-4" />,
  data: <Database className="h-4 w-4" />,
  iqube_design: <Boxes className="h-4 w-4" />,
  community: <Users className="h-4 w-4" />,
};

const categoryColors: Record<TaskCategory, string> = {
  technical: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30',
  creative: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30',
  entrepreneurial: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
  data: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30',
  iqube_design: 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30',
  community: 'bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/30',
};

const difficultyLabels = ['', 'Easy', 'Medium', 'Challenging', 'Hard', 'Expert'];

export function TaskCard({ task, onClaim, onView, isClaiming, alreadyClaimed }: TaskCardProps) {
  const totalReward = task.rewardQct + task.rewardQoyn + task.rewardKnyt;
  const hasRewards = totalReward > 0;
  const isExpired = task.expiresAt && new Date(task.expiresAt) < new Date();
  const isFull = task.maxClaims != null && task.currentClaims >= task.maxClaims;
  const canClaim = task.isActive && !isExpired && !isFull && !alreadyClaimed;

  return (
    <div className="flex flex-col h-full rounded-xl bg-slate-900/60 backdrop-blur-sm ring-1 ring-white/10 hover:ring-white/20 transition-all">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[task.category]} flex items-center gap-1`}>
            {categoryIcons[task.category]}
            {task.category.replace('_', ' ')}
          </span>
          <div className="flex gap-1">
            {task.isKnowledgePillar && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">📚</span>
            )}
            {task.isComputePillar && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30">⚡</span>
            )}
          </div>
        </div>
        <h3 className="text-sm font-medium text-white mt-2 line-clamp-2">{task.title}</h3>
        {task.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Zap className="h-3 w-3" />
            <span>{difficultyLabels[task.difficultyLevel]} (L{task.difficultyLevel})</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Trophy className="h-3 w-3" />
            <span>Impact L{task.expectedImpactLevel}</span>
          </div>
        </div>
        
        {hasRewards && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {task.rewardQct > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30">
                {task.rewardQct} QCT
              </span>
            )}
            {task.rewardQoyn > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                {task.rewardQoyn} QOYN
              </span>
            )}
            {task.rewardKnyt > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30">
                {task.rewardKnyt} KNYT
              </span>
            )}
          </div>
        )}

        {/* Status indicators */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
          {task.maxClaims && (
            <span>{task.currentClaims}/{task.maxClaims} claimed</span>
          )}
          {task.expiresAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? 'Expired' : `Expires ${new Date(task.expiresAt).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 flex gap-2">
        {alreadyClaimed ? (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Already Claimed
          </span>
        ) : isExpired ? (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-red-500/20 text-red-300 ring-1 ring-red-500/30 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
          </span>
        ) : isFull ? (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Fully Claimed
          </span>
        ) : (
          <>
            {onClaim && (
              <button 
                onClick={() => onClaim(task.id)}
                disabled={!canClaim || isClaiming}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-xs font-medium hover:from-fuchsia-400 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isClaiming ? 'Claiming...' : 'Claim Task'}
              </button>
            )}
          </>
        )}
        {onView && (
          <button 
            onClick={() => onView(task.id)}
            className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-xs hover:bg-white/10 transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
