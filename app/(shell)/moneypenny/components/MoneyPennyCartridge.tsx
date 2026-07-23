/**
 * MoneyPenny Cartridge Component
 * 
 * Main trading interface for Aigent MoneyPenny HFT agent
 * Integrates all trading functionality in a tabbed interface
 */

"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, MessageCircle, BarChart3, Target, Zap, Settings, Wallet, Users, Compass } from "lucide-react";

// Import tab components
import { HFTConsole } from "./HFTConsole";
import { MoneyPennyChat } from "./MoneyPennyChat";
import { PortfolioAnalytics } from "./PortfolioAnalytics";
import { StrategyBuilder } from "./StrategyBuilder";
import { X402Dashboard } from "./X402Dashboard";
import { FIOManager } from "./FIOManager";
import { MoneyPennySmartTriad } from "./MoneyPennySmartTriad";
import { CRMIntegration } from "./CRMIntegration";
import { ArchitectPanel } from "./ArchitectPanel";

// Import hooks
import { useMoneyPennyClient } from "../hooks/useMoneyPennyClient";

export default function MoneyPennyCartridge() {
  const [activeTab, setActiveTab] = useState("console");
  const [isConnected, setIsConnected] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    quotes: "offline",
    execution: "offline",
    settlements: "offline",
    fio: "offline",
  });

  const moneyPennyClient = useMoneyPennyClient();

  useEffect(() => {
    // Initialize MoneyPenny client and check system status
    const initializeClient = async () => {
      try {
        if (moneyPennyClient) {
          const healthCheck = await moneyPennyClient.healthCheck();
          setSystemStatus({
            quotes: healthCheck.services.redis ? "online" : "offline",
            execution: healthCheck.services.core ? "online" : "offline",
            settlements: "online", // Mock for now
            fio: "online", // Mock for now
          });
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to initialize MoneyPenny:", error);
        setIsConnected(false);
      }
    };

    initializeClient();
  }, [moneyPennyClient]);

  const tabs = [
    {
      id: "console",
      label: "HFT Console",
      icon: TrendingUp,
      description: "Real-time quotes and execution",
    },
    {
      id: "chat",
      label: "AI Assistant",
      icon: MessageCircle,
      description: "MoneyPenny trading assistant",
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: BarChart3,
      description: "Analytics and performance",
    },
    {
      id: "strategies",
      label: "Strategies",
      icon: Target,
      description: "Build and manage strategies",
    },
    {
      id: "settlements",
      label: "X402",
      icon: Zap,
      description: "Payment settlements",
    },
    {
      id: "identity",
      label: "Identity",
      icon: Wallet,
      description: "FIO and persona management",
    },
    {
      id: "smarttriad",
      label: "SmartTriad",
      icon: Settings,
      description: "Trading operations hub",
    },
    {
      id: "crm",
      label: "CRM",
      icon: Users,
      description: "Contributions and tasks",
    },
    {
      id: "architect",
      label: "Architect",
      icon: Compass,
      description: "Design constitutional financial structures (PRD-MPY-001)",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-emerald-500";
      case "offline":
        return "bg-red-500";
      case "degraded":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="h-full w-full p-6 space-y-6 bg-slate-950">
      {/* Header */}
      <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
                <span className="text-emerald-400">MoneyPenny</span>
                <span className="text-white/60">Q¢ HFT Aigent</span>
              </CardTitle>
              <CardDescription className="text-white/60">
                Real-time high-frequency trading agent powered by Qripto
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* System Status */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.quotes)}`} />
                  <span className="text-xs text-white/60">Quotes</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.execution)}`} />
                  <span className="text-xs text-white/60">Execution</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.settlements)}`} />
                  <span className="text-xs text-white/60">X402</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.fio)}`} />
                  <span className="text-xs text-white/60">FIO</span>
                </div>
              </div>
              <Badge variant={isConnected ? "default" : "destructive"} className={isConnected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full grid-cols-9 bg-black/20 ring-1 ring-white/10 border-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="flex items-center gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="console" className="space-y-4">
          <HFTConsole />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <MoneyPennyChat />
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          <PortfolioAnalytics />
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <StrategyBuilder />
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          <X402Dashboard />
        </TabsContent>

        <TabsContent value="identity" className="space-y-4">
          <FIOManager />
        </TabsContent>

        <TabsContent value="smarttriad" className="space-y-4">
          <MoneyPennySmartTriad />
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          <CRMIntegration />
        </TabsContent>

        <TabsContent value="architect" className="space-y-4">
          <ArchitectPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
