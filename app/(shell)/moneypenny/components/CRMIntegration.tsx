/**
 * MoneyPenny CRM Integration
 * 
 * CRM connectivity and contribution tracking for trading operations
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Users, TrendingUp, DollarSign, Award, Plus, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contribution {
  id: string;
  type: 'trade_execution' | 'strategy_optimization' | 'market_analysis' | 'ai_insight';
  title: string;
  description: string;
  value: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'recorded' | 'processed';
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'optimization' | 'monitoring' | 'research';
  priority: 'low' | 'medium' | 'high';
  reward: number;
  currency: string;
  status: 'available' | 'claimed' | 'completed';
  deadline?: string;
}

export function CRMIntegration() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRecordingContribution, setIsRecordingContribution] = useState(false);
  const [newContribution, setNewContribution] = useState({
    type: 'trade_execution' as const,
    title: '',
    description: '',
    value: '',
    currency: 'USD',
    public: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    // Load mock data
    setContributions([
      {
        id: '1',
        type: 'trade_execution',
        title: 'Arbitrage Execution - ETH/ARB',
        description: 'Successfully executed 15 bps arbitrage trade between Ethereum and Arbitrum',
        value: 150.50,
        currency: 'Q¢',
        timestamp: '2024-01-23T14:30:00Z',
        status: 'recorded',
      },
      {
        id: '2',
        type: 'strategy_optimization',
        title: 'Strategy Parameter Tuning',
        description: 'Optimized Arbitrage Hunter strategy parameters for improved win rate',
        value: 75.00,
        currency: 'Q¢',
        timestamp: '2024-01-23T10:15:00Z',
        status: 'processed',
      },
    ]);

    setTasks([
      {
        id: '1',
        title: 'Analyze Cross-Chain Opportunities',
        description: 'Identify and analyze new arbitrage opportunities between Base and Optimism',
        type: 'analysis',
        priority: 'high',
        reward: 100,
        currency: 'Q¢',
        status: 'available',
        deadline: '2024-01-25T23:59:59Z',
      },
      {
        id: '2',
        title: 'Monitor Market Volatility',
        description: 'Track and report on unusual market patterns across all supported chains',
        type: 'monitoring',
        priority: 'medium',
        reward: 50,
        currency: 'Q¢',
        status: 'claimed',
      },
    ]);
  }, []);

  const handleRecordContribution = async () => {
    if (!newContribution.title || !newContribution.value) return;

    const contribution: Contribution = {
      id: Date.now().toString(),
      type: newContribution.type,
      title: newContribution.title,
      description: newContribution.description,
      value: parseFloat(newContribution.value),
      currency: newContribution.currency,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    // Mock API call
    try {
      const response = await fetch('/api/moneypenny/crm/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contribution),
      });

      if (response.ok) {
        setContributions([contribution, ...contributions]);
        setNewContribution({
          type: 'trade_execution',
          title: '',
          description: '',
          value: '',
          currency: 'USD',
          public: false,
        });
        setIsRecordingContribution(false);
        
        toast({
          title: "Contribution Recorded",
          description: "Your contribution has been submitted to CRM.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record contribution.",
        variant: "destructive",
      });
    }
  };

  const handleClaimTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/moneypenny/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', taskId }),
      });

      if (response.ok) {
        setTasks(tasks.map(task => 
          task.id === taskId ? { ...task, status: 'claimed' as const } : task
        ));
        
        toast({
          title: "Task Claimed",
          description: "You have successfully claimed this task.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim task.",
        variant: "destructive",
      });
    }
  };

  const getContributionTypeLabel = (type: Contribution['type']) => {
    switch (type) {
      case 'trade_execution': return 'Trade Execution';
      case 'strategy_optimization': return 'Strategy Optimization';
      case 'market_analysis': return 'Market Analysis';
      case 'ai_insight': return 'AI Insight';
      default: return type;
    }
  };

  const getTaskTypeLabel = (type: Task['type']) => {
    switch (type) {
      case 'analysis': return 'Analysis';
      case 'optimization': return 'Optimization';
      case 'monitoring': return 'Monitoring';
      case 'research': return 'Research';
      default: return type;
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'recorded': return 'bg-blue-500';
      case 'processed': return 'bg-green-500';
      case 'available': return 'bg-green-500';
      case 'claimed': return 'bg-blue-500';
      case 'completed': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                CRM Integration
              </CardTitle>
              <CardDescription className="text-white/60">
                Track contributions and manage trading-related tasks
              </CardDescription>
            </div>
            <Button 
              onClick={() => setIsRecordingContribution(true)}
              className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Record Contribution
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Record Contribution Form */}
      {isRecordingContribution && (
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="text-white">Record New Contribution</CardTitle>
            <CardDescription className="text-white/60">
              Document your trading activities and insights for CRM tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type" className="text-white/80">Contribution Type</Label>
                <Select 
                  value={newContribution.type} 
                  onValueChange={(value: any) => setNewContribution({...newContribution, type: value})}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white/90">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/90 border-white/10">
                    <SelectItem value="trade_execution" className="text-white/90">Trade Execution</SelectItem>
                    <SelectItem value="strategy_optimization" className="text-white/90">Strategy Optimization</SelectItem>
                    <SelectItem value="market_analysis" className="text-white/90">Market Analysis</SelectItem>
                    <SelectItem value="ai_insight" className="text-white/90">AI Insight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value" className="text-white/80">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={newContribution.value}
                  onChange={(e) => setNewContribution({...newContribution, value: e.target.value})}
                  placeholder="Enter contribution value"
                  className="w-full h-10 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white/90 placeholder:text-white/40 focus:border-blue-500/30 focus:bg-white/10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="title" className="text-white/80">Title</Label>
              <Input
                id="title"
                value={newContribution.title}
                onChange={(e) => setNewContribution({...newContribution, title: e.target.value})}
                placeholder="Enter contribution title"
                className="w-full h-10 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white/90 placeholder:text-white/40 focus:border-blue-500/30 focus:bg-white/10"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-white/80">Description</Label>
              <Textarea
                id="description"
                value={newContribution.description}
                onChange={(e) => setNewContribution({...newContribution, description: e.target.value})}
                placeholder="Describe your contribution..."
                className="w-full h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white/90 placeholder:text-white/40 focus:border-blue-500/30 focus:bg-white/10 resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="public"
                  checked={newContribution.public}
                  onChange={(e) => setNewContribution({...newContribution, public: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="public" className="text-white/80">Make public</Label>
              </div>
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsRecordingContribution(false)}
                  className="bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleRecordContribution}
                  className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                >
                  Record Contribution
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contributions and Tasks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contributions */}
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Recent Contributions
            </CardTitle>
            <CardDescription className="text-white/60">
              Your latest trading contributions and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contributions.map((contribution) => (
                <div key={contribution.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20 text-xs">
                          {getContributionTypeLabel(contribution.type)}
                        </Badge>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(contribution.status)}`} />
                      </div>
                      <p className="text-sm text-white/80 mb-2">{contribution.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          {new Date(contribution.timestamp).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-white/60">{contribution.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Available Tasks */}
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-400" />
              Available Tasks
            </CardTitle>
            <CardDescription className="text-white/60">
              Trading-related tasks with rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20 text-xs">
                          {getTaskTypeLabel(task.type)}
                        </Badge>
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                          {task.reward} Q¢
                        </Badge>
                      </div>
                      <p className="text-sm text-white/80 mb-2">{task.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Due {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleClaimTask(task.id)}
                          className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50"
                        >
                          Claim
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
