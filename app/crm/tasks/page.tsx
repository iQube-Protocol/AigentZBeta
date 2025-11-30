'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ListTodo, 
  ClipboardList, 
  Star, 
  Trophy,
  Users,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { TaskList } from '@/components/crm/TaskList';
import { MyTasks } from '@/components/crm/MyTasks';
import { TaskReview } from '@/components/crm/TaskReview';
import { ReputationDisplay } from '@/components/crm/ReputationDisplay';
import { useCrmContext } from '@/app/crm/CrmContext';
import { CrmPersona } from '@/types/crm';

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

  // Fetch personas
  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const response = await fetch(`/api/crm/personas?tenantId=${tenantId}`);
        if (response.ok) {
          const data = await response.json();
          // API returns { success, data: [...] } format
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

  // Fetch task stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/crm/tasks?tenantId=${tenantId}&stats=true`);
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
  }, [tenantId, refreshKey]);

  // Callback to refresh stats and reputation after actions
  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to CRM
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">
              Browse, claim, and complete tasks to earn rewards and reputation
            </p>
          </div>
        </div>

        {/* Persona Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Acting as:</span>
          <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select persona" />
            </SelectTrigger>
            <SelectContent>
              {personas?.map(persona => (
                <SelectItem key={persona.id} value={persona.id}>
                  {persona.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeTasks}</p>
                  <p className="text-xs text-muted-foreground">Active Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalClaims}</p>
                  <p className="text-xs text-muted-foreground">Total Claims</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalCompletions}</p>
                  <p className="text-xs text-muted-foreground">Completions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  <p className="text-xs text-muted-foreground">Total Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Task Tabs */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="browse" className="flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                Browse Tasks
              </TabsTrigger>
              <TabsTrigger value="my-tasks" className="flex items-center gap-1">
                <ClipboardList className="h-4 w-4" />
                My Tasks
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                Review
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-6">
              <TaskList
                tenantId={tenantId}
                personaId={selectedPersonaId}
                showCreateButton={false}
                onTaskClaimed={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="my-tasks" className="mt-6">
              {selectedPersonaId ? (
                <MyTasks tenantId={tenantId} personaId={selectedPersonaId} onSubmit={handleRefresh} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Please select a persona to view your tasks</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="review" className="mt-6">
              <TaskReview tenantId={tenantId} reviewerPersonaId={selectedPersonaId} onReviewComplete={handleRefresh} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Reputation Sidebar */}
        <div className="space-y-4">
          {selectedPersonaId ? (
            <ReputationDisplay personaId={selectedPersonaId} key={`${selectedPersonaId}-${refreshKey}`} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reputation</CardTitle>
                <CardDescription>Select a persona to view reputation</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
