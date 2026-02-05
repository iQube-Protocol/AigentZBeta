"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { useDesignQubeTheme } from "@/components/metame/useDesignQubeTheme";
import { ValueChip } from "@/components/metame/ValueChip";
import { SmartTriadProvider } from "@/app/components/content";
import { CopilotWalletDrawer } from "@/app/triad/components/codex/wallet/CopilotWalletDrawer";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";
import type { WalletUIComponent, DrawerMode } from "@/app/types/knytLiquidUI";
import { Copy, CheckCircle2, Share2, Wallet, UserCircle2, Sparkles, List, ChevronRight, Gift, PlayCircle } from "lucide-react";

const DEFAULT_EXPERIENCE = {
  id: "reading-sprint-default",
  name: "Reading Sprint Experience",
  description: "Complete a focused reading sprint with wallet integration",
  rewardAmount: 40,
  currency: "Q¢",
};

type RuntimeSession = {
  id: string;
  experienceId: string;
  walletUI: WalletUIComponent[];
  walletDrawerMode: DrawerMode;
  walletOpen: boolean;
  consentGiven: boolean;
  iqubeCreated: boolean;
  settlementComplete: boolean;
  shared: boolean;
  receipts: Array<{ id: string; action: string; createdAt: string; receiptId: string }>;
};

export default function MetaMeRuntimeClient() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [embedMode, setEmbedMode] = useState(false);
  const [capsuleId, setCapsuleId] = useState(DEFAULT_EXPERIENCE.id);
  const [themeMode, setThemeMode] = useState<DesignQubeThemeMode>("dark");
  const [deviceMode, setDeviceMode] = useState("mobile");
  
  const [session, setSession] = useState<RuntimeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [designQube, setDesignQube] = useState<DesignQube | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !searchParams) return;
    setPreviewMode(searchParams.get("preview") === "1");
    setEmbedMode(searchParams.get("embed") === "1");
    setCapsuleId(searchParams.get("capsule") || DEFAULT_EXPERIENCE.id);
    setThemeMode(searchParams.get("theme") === "light" ? "light" : "dark");
    setDeviceMode(searchParams.get("device") || "mobile");
  }, [mounted, searchParams]);

  useEffect(() => {
    let active = true;
    const fetchDesignQube = async () => {
      try {
        const res = await fetch("/api/metame/design-qube");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.success) {
          setDesignQube(data.designQube || null);
        }
      } catch {
        // ignore design qube errors in runtime flow
      }
    };
    fetchDesignQube();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    let active = true;
    const initSession = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Initialize session
        const sessionId = `runtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        setSession({
          id: sessionId,
          experienceId: capsuleId,
          walletUI: [],
          walletDrawerMode: "narrow",
          walletOpen: false,
          consentGiven: false,
          iqubeCreated: false,
          settlementComplete: false,
          shared: false,
          receipts: [],
        });
        
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to initialize session");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    
    initSession();
    return () => {
      active = false;
    };
  }, [mounted, capsuleId]);

  const handleCopyShareLink = useCallback(async () => {
    if (!session) return;
    
    const shareUrl = `${window.location.origin}/metame/runtime?capsule=${session.experienceId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }, [session]);

  const handleLastAction = useCallback((action: string) => {
    setLastAction(action);
    setTimeout(() => setLastAction(null), 3000);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-6 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading metaMe Runtime…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-6 flex items-center justify-center">
        <div className="text-sm text-slate-400">Initializing Runtime…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 mb-4">Error</div>
          <div className="text-sm text-slate-400">{error}</div>
        </div>
      </div>
    );
  }

  if (previewMode) {
    // Preview mode - show the experience in a preview frame
    return (
      <div className="min-h-screen bg-slate-950">
        <PreviewFrame
          src={`/studio/composer/experience/${capsuleId}?preview=1&theme=${themeMode}&device=${deviceMode}`}
          defaultDevice={deviceMode as any}
          deviceQueryParam="device"
          showToolbar={!embedMode}
          className={embedMode ? "h-screen" : "h-[calc(100vh-80px)]"}
        />
      </div>
    );
  }

  return (
    <SmartTriadProvider>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" />
                <h1 className="text-lg font-semibold">metaMe Runtime</h1>
              </div>
              {lastAction && (
                <div className="text-xs text-green-400">
                  {lastAction}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyShareLink}
                className="text-slate-400 hover:text-white"
              >
                {copySuccess ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Experience Card */}
            <Card className="bg-slate-900 border-slate-800 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Gift className="h-5 w-5 text-blue-400" />
                  {DEFAULT_EXPERIENCE.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 mb-4">{DEFAULT_EXPERIENCE.description}</p>
                <div className="flex items-center gap-4">
                  <ValueChip
                    label="Reward"
                    value={`${DEFAULT_EXPERIENCE.rewardAmount} ${DEFAULT_EXPERIENCE.currency}`}
                    variant="blue"
                  />
                  <ValueChip
                    label="Duration"
                    value="25 min"
                    variant="green"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => handleLastAction("Experience started")}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Experience
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => handleLastAction("Wallet opened")}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>

            {/* Design Qube Info */}
            {designQube && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-sm">Design System</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-400">
                    <p>Theme: {designQube.name}</p>
                    <p>Colors: {Object.keys(designQube.tokens.themes.dark?.color || {}).length}</p>
                    <p>Components: {Object.keys(designQube.components || {}).length}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Liquid UI Wallet Drawer */}
        <CopilotWalletDrawer />
      </div>
    </SmartTriadProvider>
  );
}
