'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Trophy,
  User,
  Calendar,
  Star
} from 'lucide-react';
import { CrmContribution } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

interface TaskReviewProps {
  tenantId: string;
  reviewerPersonaId?: string;
  onReviewComplete?: () => void;
}

interface ReviewableContribution extends CrmContribution {
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
  persona?: {
    id: string;
    displayName: string;
  };
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
  const { toast } = useToast();

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/crm/contributions?tenantId=${tenantId}&status=submitted&hasTask=true`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch submissions');
      }

      setContributions(data.contributions || []);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [tenantId]);

  const handleApprove = async () => {
    if (!selectedContribution) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          contributionId: selectedContribution.id,
          action: 'complete',
          finalScore,
          qualityScore,
          reviewerPersonaId,
          notes: reviewNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve submission');
      }

      toast({
        title: 'Submission Approved!',
        description: `Score: ${finalScore}%. ${data.rewards?.length || 0} reward(s) created. CVS: ${data.cvs?.toFixed(2) || 0}`,
      });

      setReviewDialogOpen(false);
      resetForm();
      fetchSubmissions();
      onReviewComplete?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve submission',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedContribution || !rejectionReason) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/crm/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          contributionId: selectedContribution.id,
          action: 'reject',
          rejectionReason,
          reviewerPersonaId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject submission');
      }

      toast({
        title: 'Submission Rejected',
        description: 'The contributor has been notified.',
      });

      setRejectDialogOpen(false);
      resetForm();
      fetchSubmissions();
      onReviewComplete?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject submission',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedContribution(null);
    setFinalScore(80);
    setQualityScore(80);
    setReviewNotes('');
    setRejectionReason('');
  };

  const openReviewDialog = (contribution: ReviewableContribution) => {
    setSelectedContribution(contribution);
    setReviewDialogOpen(true);
  };

  const openRejectDialog = (contribution: ReviewableContribution) => {
    setSelectedContribution(contribution);
    setRejectDialogOpen(true);
  };

  const calculatePotentialRewards = (task: ReviewableContribution['task'], score: number) => {
    if (!task) return { qct: 0, qoyn: 0, knyt: 0 };
    const multiplier = score / 100;
    return {
      qct: Math.round(task.rewardQct * multiplier * 100) / 100,
      qoyn: Math.round(task.rewardQoyn * multiplier * 100) / 100,
      knyt: Math.round(task.rewardKnyt * multiplier * 100) / 100,
    };
  };

  const reviewableCount = contributions.filter(c => c.personaId !== reviewerPersonaId).length;
  const ownSubmissionsCount = contributions.filter(c => c.personaId === reviewerPersonaId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review Submissions</h2>
          <p className="text-sm text-muted-foreground">
            {reviewableCount} submission(s) you can review
            {ownSubmissionsCount > 0 && (
              <span className="ml-2 text-yellow-600">
                ({ownSubmissionsCount} own submission{ownSubmissionsCount > 1 ? 's' : ''} - needs other reviewer)
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : contributions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No submissions awaiting review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contributions.map(contribution => {
            const task = contribution.task;
            return (
              <Card key={contribution.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {task?.title || contribution.contributionType}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {contribution.persona && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {contribution.persona.displayName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Submitted {new Date(contribution.updatedAt).toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                      Pending Review
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {task && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <p className="font-medium capitalize">{task.category}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Difficulty:</span>
                          <p className="font-medium">Level {task.difficultyLevel}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Impact:</span>
                          <p className="font-medium">Level {task.expectedImpactLevel}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Rewards:</span>
                          <div className="flex gap-1 flex-wrap">
                            {task.rewardQct > 0 && <Badge variant="outline" className="text-xs">{task.rewardQct} QCT</Badge>}
                            {task.rewardQoyn > 0 && <Badge variant="outline" className="text-xs">{task.rewardQoyn} QOYN</Badge>}
                            {task.rewardKnyt > 0 && <Badge variant="outline" className="text-xs">{task.rewardKnyt} KNYT</Badge>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {contribution.artifactUrl && (
                    <div className="mt-4">
                      <a 
                        href={contribution.artifactUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Submitted Artifact
                      </a>
                    </div>
                  )}

                  {contribution.notes && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Contributor Notes:</p>
                      <p className="text-sm text-muted-foreground">{contribution.notes}</p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="border-t pt-4 gap-2">
                  {contribution.personaId === reviewerPersonaId ? (
                    <p className="text-sm text-muted-foreground italic">
                      You cannot review your own submission. Another reviewer must approve this.
                    </p>
                  ) : (
                    <>
                      <Button onClick={() => openReviewDialog(contribution)}>
                        <Star className="h-4 w-4 mr-1" />
                        Review & Approve
                      </Button>
                      <Button variant="outline" onClick={() => openRejectDialog(contribution)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>
              Score and approve "{selectedContribution?.task?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Final Score</Label>
                <span className="text-2xl font-bold">{finalScore}%</span>
              </div>
              <Slider
                value={[finalScore]}
                onValueChange={([v]) => setFinalScore(v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                This score determines reward amount and reputation gain
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Quality Score</Label>
                <span className="font-medium">{qualityScore}%</span>
              </div>
              <Slider
                value={[qualityScore]}
                onValueChange={([v]) => setQualityScore(v)}
                min={0}
                max={100}
                step={5}
              />
            </div>

            {selectedContribution?.task && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">Calculated Rewards at {finalScore}%:</p>
                <div className="flex gap-2">
                  {(() => {
                    const rewards = calculatePotentialRewards(selectedContribution.task, finalScore);
                    return (
                      <>
                        {rewards.qct > 0 && <Badge variant="secondary">{rewards.qct} QCT</Badge>}
                        {rewards.qoyn > 0 && <Badge variant="secondary">{rewards.qoyn} QOYN</Badge>}
                        {rewards.knyt > 0 && <Badge variant="secondary">{rewards.knyt} KNYT</Badge>}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
              <Textarea
                id="reviewNotes"
                placeholder="Feedback for the contributor..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve ({finalScore}%)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this submission. The contributor will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject} 
              disabled={!rejectionReason || processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? 'Rejecting...' : 'Reject Submission'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TaskReview;
