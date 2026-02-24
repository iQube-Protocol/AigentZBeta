'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Target, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus,
  Eye,
  TrendingUp,
  Award,
  Calendar
} from 'lucide-react';

// Types for CRM integration
interface CRMContribution {
  id: string;
  contributionType: string;
  units: number;
  pokwScore: number;
  createdAt: string;
  source: string;
}

interface CRMTask {
  id: string;
  taskTemplateId: string;
  title: string;
  description: string;
  status: 'claimed' | 'submitted' | 'completed';
  claimedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  submissionData?: any;
}

interface CRMIntegrationProps {
  tenantId?: string;
  personaId?: string;
}

export default function CRMIntegration({ tenantId = 'kn0w1', personaId }: CRMIntegrationProps) {
  const [contributions, setContributions] = useState<CRMContribution[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personaId) {
      loadCRMData();
    }
  }, [personaId, tenantId]);

  const loadCRMData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load contributions
      const contributionsResponse = await fetch(
        `/api/marketa/crm/contributions?tenantId=${tenantId}&personaId=${personaId}`
      );
      if (contributionsResponse.ok) {
        const contributionsData = await contributionsResponse.json();
        if (contributionsData.success) {
          setContributions(contributionsData.contributions || []);
        }
      }

      // Load tasks
      const tasksResponse = await fetch(
        `/api/marketa/crm/tasks?tenantId=${tenantId}&personaId=${personaId}`
      );
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        if (tasksData.success) {
          setTasks(tasksData.tasks || []);
        }
      }
    } catch (error: any) {
      console.error('Failed to load CRM data:', error);
      setError(error?.message || 'Failed to load CRM data');
    } finally {
      setIsLoading(false);
    }
  };

  const recordContribution = async (contributionType: string, units: number = 1) => {
    if (!personaId) return;

    try {
      const response = await fetch('/api/marketa/crm/contributions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          personaId,
          contributionType,
          units,
          source: 'marketa-cartridge'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Reload contributions
          loadCRMData();
        }
      }
    } catch (error: any) {
      console.error('Failed to record contribution:', error);
      setError(error?.message || 'Failed to record contribution');
    }
  };

  const claimTask = async (taskTemplateId: string) => {
    if (!personaId) return;

    try {
      const response = await fetch('/api/marketa/crm/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          taskTemplateId,
          personaId,
          action: 'claim'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Reload tasks
          loadCRMData();
        }
      }
    } catch (error: any) {
      console.error('Failed to claim task:', error);
      setError(error?.message || 'Failed to claim task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'submitted':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'claimed':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'submitted':
        return <Eye className="w-4 h-4" />;
      case 'claimed':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const totalPoKW = contributions.reduce((sum, contribution) => sum + contribution.pokwScore, 0);

  if (!personaId) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto text-slate-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">CRM Integration</h3>
        <p className="text-slate-400 mb-4">
          Please set a persona ID to view CRM data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Users className="w-5 h-5" />
            AgentiQ CRM Integration
          </h3>
          <p className="text-slate-400 text-sm">Manage contributions and tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            {totalPoKW.toFixed(1)} PoKW
          </Badge>
          <Button 
            size="sm" 
            variant="outline" 
            className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
            onClick={loadCRMData}
            disabled={isLoading}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button 
          className="bg-rose-500 hover:bg-rose-600 text-white"
          onClick={() => recordContribution('campaign_created', 1)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Campaign Created
        </Button>
        <Button 
          variant="outline" 
          className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
          onClick={() => recordContribution('partner_onboarded', 2)}
        >
          <Users className="w-4 h-4 mr-2" />
          Partner Onboarded
        </Button>
        <Button 
          variant="outline" 
          className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
          onClick={() => recordContribution('content_published', 1)}
        >
          <Target className="w-4 h-4 mr-2" />
          Content Published
        </Button>
        <Button 
          variant="outline" 
          className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
          onClick={() => recordContribution('revenue_generated', 3)}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Revenue Generated
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contributions */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Recent Contributions
          </h4>
          <div className="space-y-2">
            {contributions.slice(0, 5).map((contribution) => (
              <div key={contribution.id} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">{contribution.contributionType}</span>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {contribution.pokwScore.toFixed(1)} PoKW
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">{contribution.source}</span>
                  <span className="text-xs text-slate-500">{formatDate(contribution.createdAt)}</span>
                </div>
              </div>
            ))}
            {contributions.length === 0 && (
              <div className="text-center py-4">
                <Award className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-slate-400 text-sm">No contributions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Tasks */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Active Tasks
          </h4>
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">{task.title}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <Badge className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">{task.description}</p>
                {task.claimedAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Claimed: {formatDate(task.claimedAt)}
                  </p>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-4">
                <Target className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-slate-400 text-sm">No active tasks</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
