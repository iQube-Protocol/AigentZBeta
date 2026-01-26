/**
 * KnytSmartTriad Component
 * 
 * SmartTriad interface for KNYT Codex with quick actions
 * Maintains Lovable thin client connections and commerce integrations
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Sparkles, 
  ShoppingCart, 
  Coins, 
  CreditCard,
  UserPlus,
  Trophy,
  Settings,
  ExternalLink
} from "lucide-react";

interface KnytSmartTriadProps {
  compact?: boolean;
  personaId?: string;
}

export function KnytSmartTriad({ compact = false, personaId }: KnytSmartTriadProps) {
  const { state, actions } = useSmartTriad();
  const { balance, spendableBalance, refreshBalance } = useKnytBalance(personaId);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const openDrawer = (drawerType: string) => {
    actions.setActiveDrawer(`knyt-${drawerType}`);
  };

  const quickActions = [
    {
      id: 'codex',
      label: 'KNYT Codex',
      icon: BookOpen,
      description: 'Browse and collect character cards',
      color: 'bg-purple-500',
    },
    {
      id: 'cards',
      label: 'My Cards',
      icon: Sparkles,
      description: 'View your collection',
      color: 'bg-emerald-500',
    },
    {
      id: 'shop',
      label: 'KNYT Shop',
      icon: ShoppingCart,
      description: 'Buy KNYT tokens',
      color: 'bg-blue-500',
    },
    {
      id: 'balance',
      label: 'Balance',
      icon: Coins,
      description: 'Manage KNYT balance',
      color: 'bg-yellow-500',
    },
  ];

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'balance') {
      refreshBalance();
      toast({
        title: "Balance Refreshed",
        description: `Your KNYT balance: ${balance?.dvnKnyt || 0}`,
      });
    } else {
      openDrawer(actionId);
    }
  };

  if (compact) {
    return (
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">KNYT Codex</h3>
                <p className="text-xs text-white/60">Collect & Trade</p>
              </div>
            </div>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              {balance?.dvnKnyt || 0} KNYT
            </Badge>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.id)}
                  className="h-auto p-2 flex flex-col items-center gap-1 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            KNYT Codex
          </CardTitle>
          <CardDescription className="text-white/60">
            Collect character cards, manage your KNYT balance, and access exclusive content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <Coins className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <div className="text-2xl font-bold text-white">{balance?.dvnKnyt || 0}</div>
              <div className="text-sm text-white/60">KNYT Balance</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <div className="text-2xl font-bold text-white">{spendableBalance}</div>
              <div className="text-sm text-white/60">Spendable</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-sm text-white/60">Cards Owned</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
          <CardDescription className="text-white/60">
            Access KNYT features and manage your collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  onClick={() => handleQuickAction(action.id)}
                  className="h-auto p-4 flex flex-col items-center gap-2 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                >
                  <div className={`p-3 rounded-full ${action.color} bg-opacity-20`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{action.label}</div>
                    <div className="text-xs text-white/60">{action.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lovable Integration Status */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ExternalLink className="w-5 h-5 text-purple-400" />
            Lovable Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="font-medium text-white">Thin Client Connected</div>
                  <div className="text-sm text-white/60">Lovable hooks active</div>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Active
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-white">Liquid UI Templates</div>
                  <div className="text-sm text-white/60">Dynamic rendering ready</div>
                </div>
              </div>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                Ready
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Coins className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="font-medium text-white">Commerce Integration</div>
                  <div className="text-sm text-white/60">KNYT & PayPal payments</div>
                </div>
              </div>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                Connected
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
