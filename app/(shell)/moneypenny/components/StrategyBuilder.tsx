/**
 * Strategy Builder Component
 * 
 * Trading strategy construction and management
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Target, Play, Pause, Settings, Plus, Trash2 } from "lucide-react";

interface Strategy {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  chains: string[];
  minEdgeBps: number;
  maxSlippageBps: number;
  maxPositionSize: number;
  autoExecute: boolean;
  createdAt: string;
}

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: '1',
      name: 'Arbitrage Hunter',
      status: 'active',
      chains: ['ETH', 'ARB', 'BASE'],
      minEdgeBps: 15,
      maxSlippageBps: 5,
      maxPositionSize: 10000,
      autoExecute: true,
      createdAt: '2024-01-20',
    },
    {
      id: '2',
      name: 'Liquidity Provider',
      status: 'paused',
      chains: ['POLYGON', 'OPTIMISM'],
      minEdgeBps: 8,
      maxSlippageBps: 10,
      maxPositionSize: 5000,
      autoExecute: false,
      createdAt: '2024-01-18',
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    chains: [] as string[],
    minEdgeBps: 10,
    maxSlippageBps: 5,
    maxPositionSize: 5000,
    autoExecute: false,
  });

  const availableChains = ['ETH', 'ARB', 'BASE', 'POLYGON', 'OPTIMISM'];

  const handleCreateStrategy = () => {
    if (!newStrategy.name || newStrategy.chains.length === 0) return;

    const strategy: Strategy = {
      id: Date.now().toString(),
      name: newStrategy.name,
      status: 'draft',
      chains: newStrategy.chains,
      minEdgeBps: newStrategy.minEdgeBps,
      maxSlippageBps: newStrategy.maxSlippageBps,
      maxPositionSize: newStrategy.maxPositionSize,
      autoExecute: newStrategy.autoExecute,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setStrategies([...strategies, strategy]);
    setNewStrategy({
      name: '',
      chains: [],
      minEdgeBps: 10,
      maxSlippageBps: 5,
      maxPositionSize: 5000,
      autoExecute: false,
    });
    setIsCreating(false);
  };

  const toggleStrategyStatus = (id: string) => {
    setStrategies(strategies.map(s => {
      if (s.id === id) {
        const newStatus = s.status === 'active' ? 'paused' : 'active';
        return { ...s, status: newStatus as 'active' | 'paused' };
      }
      return s;
    }));
  };

  const deleteStrategy = (id: string) => {
    setStrategies(strategies.filter(s => s.id !== id));
  };

  const getStatusColor = (status: Strategy['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'draft': return 'bg-gray-500';
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
                <Target className="h-5 w-5 text-emerald-400" />
                Strategy Builder
              </CardTitle>
              <CardDescription className="text-white/60">
                Create and manage automated trading strategies
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Strategy
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Create Strategy Form */}
      {isCreating && (
        <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
          <CardHeader>
            <CardTitle className="text-white">Create New Strategy</CardTitle>
            <CardDescription className="text-white/60">
              Configure your automated trading strategy parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-white/80">Strategy Name</Label>
                <Input
                  id="name"
                  value={newStrategy.name}
                  onChange={(e) => setNewStrategy({...newStrategy, name: e.target.value})}
                  placeholder="Enter strategy name"
                  className="bg-white/5 border-white/10 text-white/90 placeholder:text-white/40 focus:border-emerald-500/30 focus:bg-white/10"
                />
              </div>
              <div>
                <Label className="text-white/80">Chains</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableChains.map(chain => (
                    <Badge
                      key={chain}
                      variant={newStrategy.chains.includes(chain) ? "default" : "outline"}
                      className={newStrategy.chains.includes(chain) ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/10 text-white/60 border-white/20"}
                    >
                      {chain}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Min Edge (bps)</Label>
                <Slider
                  value={[newStrategy.minEdgeBps]}
                  onValueChange={([value]) => setNewStrategy({...newStrategy, minEdgeBps: value})}
                  max={100}
                  step={1}
                  className="mt-2"
                />
                <div className="text-sm text-white/60 mt-1">{newStrategy.minEdgeBps} bps</div>
              </div>
              <div>
                <Label>Max Slippage (bps)</Label>
                <Slider
                  value={[newStrategy.maxSlippageBps]}
                  onValueChange={([value]) => setNewStrategy({...newStrategy, maxSlippageBps: value})}
                  max={50}
                  step={1}
                  className="mt-2"
                />
                <div className="text-sm text-white/60 mt-1">{newStrategy.maxSlippageBps} bps</div>
              </div>
            </div>

            <div>
              <Label>Max Position Size</Label>
              <Slider
                value={[newStrategy.maxPositionSize]}
                onValueChange={([value]) => setNewStrategy({...newStrategy, maxPositionSize: value})}
                max={50000}
                step={1000}
                className="mt-2"
              />
              <div className="text-sm text-white/60 mt-1">${newStrategy.maxPositionSize.toLocaleString()}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-execute"
                  checked={newStrategy.autoExecute}
                  onChange={(e) => setNewStrategy({...newStrategy, autoExecute: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="auto-execute" className="text-white/80">Auto-execute trades</Label>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setIsCreating(false)} className="bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white">
                  Cancel
                </Button>
                <Button onClick={handleCreateStrategy} className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30">
                  Create Strategy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strategy) => (
          <Card key={strategy.id} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">{strategy.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(strategy.status)}`} />
                  <Badge variant="outline" className="bg-white/10 text-white/60 border-white/20">{strategy.status}</Badge>
                </div>
              </div>
              <CardDescription className="text-white/60">
                Created {strategy.createdAt}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {strategy.chains.map(chain => (
                    <Badge key={chain} variant="outline" className="bg-white/10 text-white/60 border-white/20 text-xs">
                      {chain}
                    </Badge>
                  ))}
                </div>
                
                <div className="text-xs mt-1 space-y-1 text-white/60">
                  <div>Min Edge: {strategy.minEdgeBps} bps</div>
                  <div>Max Slippage: {strategy.maxSlippageBps} bps</div>
                  <div>Max Position: ${strategy.maxPositionSize.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={strategy.status === 'active'}
                    onChange={() => toggleStrategyStatus(strategy.id)}
                    disabled={strategy.status === 'draft'}
                    className="rounded"
                  />
                  <span className="text-sm text-white/80">
                    {strategy.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteStrategy(strategy.id)}
                    className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
