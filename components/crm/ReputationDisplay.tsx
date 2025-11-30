'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  RefreshCw, 
  Code, 
  Palette, 
  Briefcase, 
  Database, 
  Users,
  Trophy,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { CrmPersonaReputation } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

interface ReputationDisplayProps {
  personaId: string;
  compact?: boolean;
}

const dimensionConfig = [
  { key: 'repTechnical', label: 'Technical', icon: Code, color: 'bg-blue-500' },
  { key: 'repCreative', label: 'Creative', icon: Palette, color: 'bg-purple-500' },
  { key: 'repEntrepreneurial', label: 'Entrepreneurial', icon: Briefcase, color: 'bg-green-500' },
  { key: 'repDataArch', label: 'Data Architecture', icon: Database, color: 'bg-orange-500' },
  { key: 'repCommunity', label: 'Community', icon: Users, color: 'bg-pink-500' },
];

export function ReputationDisplay({ personaId, compact = false }: ReputationDisplayProps) {
  const [reputation, setReputation] = useState<CrmPersonaReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReputation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/reputation?personaId=${personaId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reputation');
      }

      setReputation(data.reputation);
    } catch (error) {
      console.error('Failed to fetch reputation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reputation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (personaId) {
      fetchReputation();
    }
  }, [personaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No reputation data available</p>
      </div>
    );
  }

  // Calculate max value for scaling progress bars
  const maxDimensionValue = Math.max(
    reputation.repTechnical,
    reputation.repCreative,
    reputation.repEntrepreneurial,
    reputation.repDataArch,
    reputation.repCommunity,
    1 // Minimum to avoid division by zero
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Reputation</span>
          <Badge variant="secondary" className="text-lg">
            {reputation.repOverall.toFixed(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3" />
          {reputation.totalTasksCompleted} tasks completed
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy className="h-3 w-3" />
          {reputation.lifetimeCvs.toFixed(1)} lifetime CVS
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Reputation</CardTitle>
            <CardDescription>Multi-dimensional contribution score</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchReputation}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className="text-3xl font-bold">{reputation.repOverall.toFixed(1)}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>12m: {reputation.repRolling12m.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Dimension Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Dimensions</h4>
          {dimensionConfig.map(({ key, label, icon: Icon, color }) => {
            const value = reputation[key as keyof CrmPersonaReputation] as number;
            const percentage = maxDimensionValue > 0 ? (value / maxDimensionValue) * 100 : 0;
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </span>
                  <span className="font-medium">{value.toFixed(1)}</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold">{reputation.totalTasksCompleted}</p>
            <p className="text-xs text-muted-foreground">Tasks Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{reputation.totalTasksClaimed}</p>
            <p className="text-xs text-muted-foreground">Tasks Claimed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{reputation.lifetimeCvs.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Lifetime CVS</p>
          </div>
        </div>

        {/* RQH Sync Status */}
        {reputation.rqhBucketId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Synced to RQH: {reputation.rqhSyncedAt ? new Date(reputation.rqhSyncedAt).toLocaleString() : 'Never'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReputationDisplay;
