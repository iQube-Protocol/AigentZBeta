'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  Clock, 
  XCircle,
  ExternalLink,
  Trophy,
  Zap
} from 'lucide-react';
import { CrmContribution, ContributionStatus } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

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
  claimed: { label: 'Claimed', color: 'bg-blue-500/10 text-blue-500', icon: <Clock className="h-3 w-3" /> },
  submitted: { label: 'Submitted', color: 'bg-yellow-500/10 text-yellow-500', icon: <Upload className="h-3 w-3" /> },
  under_review: { label: 'Under Review', color: 'bg-purple-500/10 text-purple-500', icon: <Clock className="h-3 w-3" /> },
  accepted: { label: 'Accepted', color: 'bg-green-500/10 text-green-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-500', icon: <XCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
};

export function MyTasks({ tenantId, personaId, onSubmit }: MyTasksProps) {
  const [contributions, setContributions] = useState<TaskContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<TaskContribution | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [artifactUrl, setArtifactUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const { toast } = useToast();

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      // Fetch contributions for this persona that have task_template_id
      const response = await fetch(
        `/api/crm/contributions?tenantId=${tenantId}&personaId=${personaId}&hasTask=true`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tasks');
      }

      setContributions(data.contributions || []);
    } catch (error) {
      console.error('Failed to fetch my tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (personaId) {
      fetchMyTasks();
    }
  }, [tenantId, personaId]);

  const handleSubmitWork = async () => {
    if (!selectedContribution) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          contributionId: selectedContribution.id,
          action: 'submit',
          artifactUrl: artifactUrl || undefined,
          notes: submitNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit work');
      }

      toast({
        title: 'Work Submitted!',
        description: 'Your work has been submitted for review.',
      });

      setSubmitDialogOpen(false);
      setArtifactUrl('');
      setSubmitNotes('');
      fetchMyTasks();
      onSubmit?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit work',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitDialog = (contribution: TaskContribution) => {
    setSelectedContribution(contribution);
    setSubmitDialogOpen(true);
  };

  const activeContributions = contributions.filter(c => 
    ['claimed', 'submitted', 'under_review'].includes(c.status as string)
  );
  const completedContributions = contributions.filter(c => 
    ['accepted', 'rejected', 'cancelled'].includes(c.status as string)
  );

  const renderContributionCard = (contribution: TaskContribution) => {
    const status = statusConfig[contribution.status as ContributionStatus] || statusConfig.claimed;
    const task = contribution.task;

    return (
      <Card key={contribution.id} className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <Badge variant="outline" className={status.color}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
            {contribution.finalScore !== undefined && contribution.finalScore !== null && (
              <Badge variant="secondary">
                Score: {contribution.finalScore}%
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-2">
            {task?.title || contribution.contributionType}
          </CardTitle>
          {task && (
            <CardDescription>
              {task.category} • Difficulty L{task.difficultyLevel} • Impact L{task.expectedImpactLevel}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          {task && (task.rewardQct > 0 || task.rewardQoyn > 0 || task.rewardKnyt > 0) && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Potential Rewards:</span>
              <div className="flex gap-1 flex-wrap">
                {task.rewardQct > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {task.rewardQct} QCT
                  </Badge>
                )}
                {task.rewardQoyn > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {task.rewardQoyn} QOYN
                  </Badge>
                )}
                {task.rewardKnyt > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {task.rewardKnyt} KNYT
                  </Badge>
                )}
              </div>
            </div>
          )}

          {contribution.artifactUrl && (
            <a 
              href={contribution.artifactUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View Artifact
            </a>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            Claimed: {new Date(contribution.createdAt).toLocaleDateString()}
          </p>
        </CardContent>

        <CardFooter className="pt-3 border-t">
          {contribution.status === 'claimed' && (
            <Button size="sm" onClick={() => openSubmitDialog(contribution)}>
              <Upload className="h-4 w-4 mr-1" />
              Submit Work
            </Button>
          )}
          {contribution.status === 'submitted' && (
            <span className="text-sm text-muted-foreground">Awaiting review...</span>
          )}
          {contribution.status === 'accepted' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Completed! Rewards issued.
            </span>
          )}
          {contribution.status === 'rejected' && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Rejected
            </span>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Tasks</h2>
        <Button variant="outline" size="sm" onClick={fetchMyTasks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeContributions.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedContributions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeContributions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No active tasks</p>
              <p className="text-sm mt-1">Browse available tasks to claim one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeContributions.map(renderContributionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : completedContributions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No completed tasks yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedContributions.map(renderContributionCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Submit Work Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Work</DialogTitle>
            <DialogDescription>
              Submit your completed work for "{selectedContribution?.task?.title || 'this task'}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="artifactUrl">Artifact URL (optional)</Label>
              <Input
                id="artifactUrl"
                placeholder="https://github.com/... or https://docs.google.com/..."
                value={artifactUrl}
                onChange={(e) => setArtifactUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to your work: GitHub PR, Google Doc, Figma, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Describe what you've done, any challenges, or notes for the reviewer..."
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitWork} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MyTasks;
