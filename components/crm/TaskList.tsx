'use client';

import React, { useState, useEffect } from 'react';
import { TaskCard } from './TaskCard';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { CrmTaskTemplate, TaskCategory } from '@/types/crm';

interface TaskListProps {
  tenantId: string;
  personaId?: string;
  onCreateTask?: () => void;
  onViewTask?: (taskId: string) => void;
  showCreateButton?: boolean;
  onTaskClaimed?: () => void;
}

const categories: { value: TaskCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'technical', label: 'Technical' },
  { value: 'creative', label: 'Creative' },
  { value: 'entrepreneurial', label: 'Business' },
  { value: 'data', label: 'Data' },
  { value: 'iqube_design', label: 'iQube' },
  { value: 'community', label: 'Community' },
];

export function TaskList({ tenantId, personaId, onCreateTask, onViewTask, showCreateButton = false, onTaskClaimed }: TaskListProps) {
  const [tasks, setTasks] = useState<CrmTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [claimedTaskIds, setClaimedTaskIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId, isActive: 'true' });
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      const response = await fetch(`/api/crm/tasks?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setTasks(data.tasks || []);
    } catch (error) {
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [tenantId, categoryFilter]);

  const handleClaimTask = async (taskId: string) => {
    if (!personaId) { showToast('Select a persona first', 'error'); return; }
    setClaimingTaskId(taskId);
    try {
      const response = await fetch(`/api/crm/tasks/${taskId}/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, personaId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setClaimedTaskIds(prev => new Set([...prev, taskId]));
      showToast('Task claimed!');
      fetchTasks();
      onTaskClaimed?.();
    } catch (error: any) {
      showToast(error.message || 'Failed to claim', 'error');
    } finally {
      setClaimingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter(t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm ${toast.type === 'error' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'}`}>{toast.msg}</div>}
      
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50 placeholder:text-slate-500" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as TaskCategory | 'all')} className="px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-white text-sm focus:outline-none focus:ring-fuchsia-500/50">
            {categories.map(c => <option key={c.value} value={c.value} className="bg-slate-900">{c.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTasks} disabled={loading} className="px-3 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1.5 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {showCreateButton && onCreateTask && (
            <button onClick={onCreateTask} className="px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Create
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" /></div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><p>No tasks found</p>{searchQuery && <button onClick={() => setSearchQuery('')} className="text-fuchsia-400 text-sm mt-2">Clear search</button>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => <TaskCard key={task.id} task={task} onClaim={personaId ? handleClaimTask : undefined} onView={onViewTask} isClaiming={claimingTaskId === task.id} alreadyClaimed={claimedTaskIds.has(task.id)} />)}
        </div>
      )}
    </div>
  );
}

export default TaskList;
