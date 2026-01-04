'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TaskList } from '@/components/crm/TaskList';
import { MyTasks } from '@/components/crm/MyTasks';
import { TaskReview } from '@/components/crm/TaskReview';
import { ReputationDisplay } from '@/components/crm/ReputationDisplay';
import { RewardsDisplay } from '@/components/crm/RewardsDisplay';
import { useCrmContext } from '@/app/(shell)/crm/CrmContext';
import { CrmPersona } from '@/types/crm';

const TABS = [
  { key: 'browse', label: 'Browse Tasks', icon: '📋' },
  { key: 'my-tasks', label: 'My Tasks', icon: '✅' },
  { key: 'review', label: 'Review', icon: '⭐' },
];

export default function TasksPage() {
  const { currentTenantId } = useCrmContext();
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [personas, setPersonas] = useState<CrmPersona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [stats, setStats] = useState<{
    totalTasks: number;
    activeTasks: number;
    totalClaims: number;
    totalCompletions: number;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tenantId = currentTenantId || 'default';

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const response = await fetch(`/api/crm/personas?tenantId=${tenantId}&source=live`);
        if (response.ok) {
          const data = await response.json();
          const personaList = data.data || data.personas || [];
          setPersonas(personaList);
          if (personaList.length > 0 && !selectedPersonaId) {
            setSelectedPersonaId(personaList[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch personas:', error);
      } finally {
        setLoadingPersonas(false);
      }
    };
    fetchPersonas();
  }, [tenantId, selectedPersonaId]);

  const fetchStats = async () => {
    try {
      if (!selectedPersonaId) {
        setStats(null);
        return;
      }
      const response = await fetch(`/api/crm/tasks?tenantId=${tenantId}&stats=true&source=campaign&personaId=${selectedPersonaId}`);
      const data = await response.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [tenantId, refreshKey, selectedPersonaId]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse, claim, and complete tasks to earn rewards
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Persona Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Acting as:</span>
            <select
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-white focus:outline-none focus:ring-fuchsia-500/50"
            >
              <option value="" className="bg-slate-900">Select persona</option>
              {personas.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900">{p.displayName}</option>
              ))}
            </select>
          </div>
          
          <Link
            href="/crm/tasks/admin"
            className="px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-slate-300 hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            ⚙️ Admin
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.activeTasks}</p>
                <p className="text-xs text-slate-400">Active Tasks</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalClaims}</p>
                <p className="text-xs text-slate-400">Total Claims</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalCompletions}</p>
                <p className="text-xs text-slate-400">Completions</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalTasks}</p>
                <p className="text-xs text-slate-400">Total Tasks</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Task Tabs */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 ring-1 ring-white/10">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            {activeTab === 'browse' && (
              <TaskList
                tenantId={tenantId}
                personaId={selectedPersonaId}
                showCreateButton={false}
                source="campaign"
                onTaskClaimed={handleRefresh}
              />
            )}

            {activeTab === 'my-tasks' && (
              selectedPersonaId ? (
                <MyTasks tenantId={tenantId} personaId={selectedPersonaId} onSubmit={handleRefresh} />
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p>Please select a persona to view your tasks</p>
                </div>
              )
            )}

            {activeTab === 'review' && (
              <TaskReview tenantId={tenantId} reviewerPersonaId={selectedPersonaId} onReviewComplete={handleRefresh} />
            )}
          </div>
        </div>

        {/* Right: Reputation & Rewards Sidebar */}
        <div className="space-y-4">
          {selectedPersonaId ? (
            <>
              <ReputationDisplay personaId={selectedPersonaId} key={`rep-${selectedPersonaId}-${refreshKey}`} />
              <RewardsDisplay tenantId={tenantId} personaId={selectedPersonaId} compact key={`rew-${selectedPersonaId}-${refreshKey}`} />
            </>
          ) : (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <h3 className="text-sm font-medium text-white mb-1">Reputation & Rewards</h3>
              <p className="text-xs text-slate-400">Select a persona to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
