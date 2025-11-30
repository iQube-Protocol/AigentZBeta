'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  technical: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  creative: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  entrepreneurial: 'bg-green-500/10 text-green-500 border-green-500/20',
  data: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  iqube_design: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  community: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
};

const difficultyLabels = ['', 'Easy', 'Medium', 'Challenging', 'Hard', 'Expert'];

export function TaskCard({ task, onClaim, onView, isClaiming, alreadyClaimed }: TaskCardProps) {
  const totalReward = task.rewardQct + task.rewardQoyn + task.rewardKnyt;
  const hasRewards = totalReward > 0;
  const isExpired = task.expiresAt && new Date(task.expiresAt) < new Date();
  const isFull = task.maxClaims !== null && task.currentClaims >= task.maxClaims;
  const canClaim = task.isActive && !isExpired && !isFull && !alreadyClaimed;

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge 
            variant="outline" 
            className={`${categoryColors[task.category]} flex items-center gap-1`}
          >
            {categoryIcons[task.category]}
            {task.category.replace('_', ' ')}
          </Badge>
          {task.isKnowledgePillar && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">📚 Knowledge</Badge>
          )}
          {task.isComputePillar && (
            <Badge variant="secondary" className="text-xs">Compute</Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-2 line-clamp-2">{task.title}</CardTitle>
        {task.description && (
          <CardDescription className="line-clamp-2">{task.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>{difficultyLabels[task.difficultyLevel]} (L{task.difficultyLevel})</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span>Impact L{task.expectedImpactLevel}</span>
          </div>
          {hasRewards && (
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-muted-foreground">Rewards:</span>
              <div className="flex gap-1 flex-wrap">
                {task.rewardQct > 0 && (
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600">
                    {task.rewardQct} QCT
                  </Badge>
                )}
                {task.rewardQoyn > 0 && (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                    {task.rewardQoyn} QOYN
                  </Badge>
                )}
                {task.rewardKnyt > 0 && (
                  <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600">
                    {task.rewardKnyt} KNYT
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status indicators */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          {task.maxClaims && (
            <span className="text-muted-foreground">
              {task.currentClaims}/{task.maxClaims} claimed
            </span>
          )}
          {task.expiresAt && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {isExpired ? 'Expired' : `Expires ${new Date(task.expiresAt).toLocaleDateString()}`}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t gap-2">
        {alreadyClaimed ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Already Claimed
          </Badge>
        ) : isExpired ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
          </Badge>
        ) : isFull ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Fully Claimed
          </Badge>
        ) : (
          <>
            {onClaim && (
              <Button 
                size="sm" 
                onClick={() => onClaim(task.id)}
                disabled={!canClaim || isClaiming}
              >
                {isClaiming ? 'Claiming...' : 'Claim Task'}
              </Button>
            )}
          </>
        )}
        {onView && (
          <Button variant="outline" size="sm" onClick={() => onView(task.id)}>
            View Details
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default TaskCard;
