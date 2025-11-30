'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  RefreshCw,
  Coins,
  Wallet,
  Clock,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  Gift
} from 'lucide-react';
import { CrmReward, TokenType } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

interface RewardsDisplayProps {
  tenantId: string;
  personaId?: string;
  compact?: boolean;
}

const tokenConfig: Record<TokenType, { label: string; color: string; icon: string }> = {
  QCT: { label: 'QCT', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: '🔷' },
  QOYN: { label: 'QOYN', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: '💎' },
  KNYT: { label: 'KNYT', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: '🪙' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-600' },
  approved: { label: 'Approved', color: 'bg-blue-500/10 text-blue-600' },
  paid: { label: 'Paid', color: 'bg-green-500/10 text-green-600' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-600' },
};

export function RewardsDisplay({ tenantId, personaId, compact = false }: RewardsDisplayProps) {
  const [rewards, setRewards] = useState<CrmReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId });
      if (personaId) params.append('personaId', personaId);

      const response = await fetch(`/api/crm/rewards?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch rewards');
      }

      setRewards(data.data || []);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rewards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, [tenantId, personaId]);

  // Calculate totals by token type
  const totals = rewards.reduce((acc, reward) => {
    const type = reward.tokenType as TokenType;
    if (!acc[type]) acc[type] = { pending: 0, paid: 0, total: 0 };
    acc[type].total += reward.amount;
    if (reward.status === 'paid') {
      acc[type].paid += reward.amount;
    } else if (reward.status !== 'cancelled') {
      acc[type].pending += reward.amount;
    }
    return acc;
  }, {} as Record<TokenType, { pending: number; paid: number; total: number }>);

  const filteredRewards = activeTab === 'all' 
    ? rewards 
    : rewards.filter(r => r.tokenType === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Rewards
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchRewards}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(totals).map(([type, amounts]) => {
              const config = tokenConfig[type as TokenType];
              return (
                <div key={type} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </span>
                  <div className="text-right">
                    <p className="font-bold">{amounts.total.toLocaleString()}</p>
                    {amounts.pending > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {amounts.pending.toLocaleString()} pending
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(totals).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No rewards yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['QCT', 'QOYN', 'KNYT'] as TokenType[]).map(type => {
          const config = tokenConfig[type];
          const amounts = totals[type] || { pending: 0, paid: 0, total: 0 };
          
          return (
            <Card key={type} className={`border ${config.color.split(' ')[2] || ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <p className="text-sm text-muted-foreground">{config.label}</p>
                      <p className="text-2xl font-bold">{amounts.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{amounts.paid.toLocaleString()} paid</span>
                    </div>
                    {amounts.pending > 0 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Clock className="h-3 w-3" />
                        <span>{amounts.pending.toLocaleString()} pending</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rewards History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reward History</CardTitle>
              <CardDescription>
                {rewards.length} reward{rewards.length !== 1 ? 's' : ''} earned
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRewards}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="QCT">QCT</TabsTrigger>
              <TabsTrigger value="QOYN">QOYN</TabsTrigger>
              <TabsTrigger value="KNYT">KNYT</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredRewards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rewards found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRewards.map(reward => {
                    const tokenCfg = tokenConfig[reward.tokenType as TokenType];
                    const statusCfg = statusConfig[reward.status] || statusConfig.draft;
                    
                    return (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{tokenCfg.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                +{reward.amount.toLocaleString()} {tokenCfg.label}
                              </span>
                              <Badge variant="outline" className={statusCfg.color}>
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {reward.notes || 'Reward earned'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{new Date(reward.createdAt).toLocaleDateString()}</p>
                          {reward.txHash && (
                            <a
                              href={`https://etherscan.io/tx/${reward.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View tx
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default RewardsDisplay;
