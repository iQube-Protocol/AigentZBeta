'use client';

import React, { useState, useEffect } from 'react';
import { TaskCard } from './TaskCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, RefreshCw, Plus } from 'lucide-react';
import { CrmTaskTemplate, TaskCategory } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

interface TaskListProps {
  tenantId: string;
  personaId?: string;
  onCreateTask?: () => void;
  onViewTask?: (taskId: string) => void;
  showCreateButton?: boolean;
  onTaskClaimed?: () => void;
}

const categories: { value: TaskCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'technical', label: 'Technical' },
  { value: 'creative', label: 'Creative' },
  { value: 'entrepreneurial', label: 'Entrepreneurial' },
  { value: 'data', label: 'Data' },
  { value: 'iqube_design', label: 'iQube Design' },
  { value: 'community', label: 'Community' },
];

export function TaskList({ 
  tenantId, 
  personaId, 
  onCreateTask, 
  onViewTask,
  showCreateButton = false,
  onTaskClaimed
}: TaskListProps) {
  const [tasks, setTasks] = useState<CrmTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [claimedTaskIds, setClaimedTaskIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId,
        isActive: 'true',
      });
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      const response = await fetch(`/api/crm/tasks?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tasks');
      }

      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [tenantId, categoryFilter]);

  const handleClaimTask = async (taskId: string) => {
    if (!personaId) {
      toast({
        title: 'Error',
        description: 'Please select a persona to claim tasks',
        variant: 'destructive',
      });
      return;
    }

    setClaimingTaskId(taskId);
    try {
      const response = await fetch(`/api/crm/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, personaId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim task');
      }

      setClaimedTaskIds(prev => new Set([...prev, taskId]));
      toast({
        title: 'Task Claimed!',
        description: `You've claimed "${data.task.title}". Go to My Tasks to submit your work.`,
      });

      // Refresh to update claim counts
      fetchTasks();
      onTaskClaimed?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to claim task',
        variant: 'destructive',
      });
    } finally {
      setClaimingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.slug.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TaskCategory | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {showCreateButton && onCreateTask && (
            <Button size="sm" onClick={onCreateTask}>
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No tasks found</p>
          {searchQuery && (
            <Button variant="link" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClaim={personaId ? handleClaimTask : undefined}
              onView={onViewTask}
              isClaiming={claimingTaskId === task.id}
              alreadyClaimed={claimedTaskIds.has(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskList;
