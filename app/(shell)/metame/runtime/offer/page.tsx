"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import { useDesignQubeTheme } from "@/components/metame/useDesignQubeTheme";
import { ValueChip } from "@/components/metame/ValueChip";
import AliasConsentToggle from "@/app/components/identity/AliasConsentToggle";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";
import type { SmartContentQube } from "@/types/smartContent";
import { Copy, CheckCircle2, Share2, Wallet, UserCircle2, Sparkles } from "lucide-react";
import type { DesignQube, DesignQubeThemeMode } from "@/types/designQube";

const SMART_OFFER_CONTENT = {
  id: "metame-smart-offer",
  title: "Smart Offer",
  pricingModel: {
    tiers: [{ amount: 40, currency: "Q¢", kind: "paid" }],
  },
  rewardOutcomes: {
    engagementRewards: [{ amount: 40, currency: "Q¢" }],
  },
  modalities: {
    read: { enabled: true },
    watch: { enabled: false },
    listen: { enabled: false },
    interact: { enabled: true },
  },
} as unknown as SmartContentQube;

type OfferSession = {
  id: string;
  data: {
    offerTitle: string;
    offerDescription: string;
    amount: number;
    currency: string;
    consentGiven: boolean;
    iqubeId?: string | null;
    iqubeShared?: boolean;
    settlement?: { amount: number; currency: string; receiptId?: string } | null;
    inviteToken: string;
    participants: string[];
    receipts?: Array<{ id: string; action: string; createdAt: string; receiptId: string }>;
  };
};

export default function MetaMeSmartOfferPage() {
  const searchParams = useSearchParams();
  const previewMode = searchParams?.get("preview") === "1";
  const embedMode = searchParams?.get("embed") === "1";
  const stubMode = searchParams?.get("stub") === "1";
  const themeMode: DesignQubeThemeMode = searchParams?.get("theme") === "light" ? "light" : "dark";
  const deviceMode = searchParams?.get("device") || "mobile";
  const [session, setSession] = useState<OfferSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [designQube, setDesignQube] = useState<DesignQube | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const { activePersonaId: ctxPersonaId } = usePersonaSafe();
  const personaId = ctxPersonaId || "guest";

  const inviteToken = searchParams?.get("invite");

  const fetchSession = useCallback(async (action: string, payload: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metame/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, personaId, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Offer flow failed");
      }
      if (json.session) {
        setSession(json.session);
      }
      return json;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (stubMode) {
      setSession({
        id: "stub-session",
        data: {
          offerTitle: "Smart Offer Preview",
          offerDescription: "Sample offer preview (stub mode).",
          amount: 40,
          currency: "Q¢",
          consentGiven: false,
          iqubeId: null,
          iqubeShared: false,
          settlement: null,
          inviteToken: "stub",
          participants: ["preview"],
          receipts: [],
        },
      });
      setLoading(false);
      return;
    }
    const action = inviteToken ? "join" : "create";
    const payload = inviteToken ? { sessionId: inviteToken } : {};
    fetchSession(action, payload);
  }, [inviteToken, fetchSession, stubMode]);

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

  useDesignQubeTheme(designQube?.tokens, designQube?.constraints, themeMode);

  useEffect(() => {
    if (typeof window === "undefined" || !session) return;
    setInviteUrl(`${window.location.origin}/metame/runtime/offer?invite=${session.id}`);
  }, [session]);

  const handleConsent = async (value?: boolean) => {
    if (!session || value === false) return;
    await fetchSession("consent", { sessionId: session.id });
  };

  const handleCreateIQube = async () => {
    if (!session) return;
    await fetchSession("iqube", { sessionId: session.id, iqubeType: "DataQube" });
  };

  const handleShareIQube = async () => {
    if (!session) return;
    await fetchSession("share_iqube", { sessionId: session.id, accessLevel: "metaqube" });
  };

  const handleSettle = async () => {
    if (!session) return;
    await fetchSession("settle", {
      sessionId: session.id,
      amount: session.data.amount,
      currency: session.data.currency,
    });
  };

  const handleShare = async () => {
    if (!session) return;
    await fetchSession("share", { sessionId: session.id });
  };

  const handleCopyInvite = async () => {
    if (!session || !inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1500);
  };

  const runtimeMenu = [
    { id: "compass_be", label: "Be", slot: "left" },
    { id: "compass_earn", label: "Earn", slot: "center" },
    { id: "compass_play", label: "Play", slot: "center" },
    { id: "compass_make", label: "Make", slot: "center" },
    { id: "compass_share", label: "Share", slot: "right" },
  ];

  const receipts = session?.data?.receipts || [];

  const layoutClass =
    deviceMode === "desktop"
      ? "grid gap-4 xl:grid-cols-3"
      : deviceMode === "tablet"
        ? "grid gap-4 md:grid-cols-2"
        : "space-y-4";

  const containerClass = embedMode
    ? "w-full max-w-none px-0 pt-0"
    : "max-w-md mx-auto px-4 pt-6";

  const navPositionClass = embedMode ? "sticky" : previewMode ? "absolute" : "fixed";
  const navContainerClass = embedMode ? "w-full max-w-none" : "max-w-md";

  const runtimeContent = (
    <div className={`min-h-screen bg-slate-950 text-white pb-24 ${previewMode ? "relative" : ""}`}>
      <style jsx global>{`
        .copilotkit-launcher,
        .copilotkit-button,
        .copilotkit-floating-button {
          display: none !important;
        }
      `}</style>
      <div className={containerClass}>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">metaMe Runtime</p>
          <h1 className="text-2xl font-semibold">What do you want to do?</h1>
          <p className="text-sm text-slate-300">Smart Offer micro-experience (mobile-first compass flow).</p>
          {lastAction && (
            <p className="text-xs text-slate-500">Last action: {lastAction}</p>
          )}
        </div>

        {loading && <div className="text-sm text-slate-400">Loading experience...</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className={layoutClass}>
          {session && (
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">{session.data.offerTitle}</CardTitle>
                <p className="text-sm text-slate-300">{session.data.offerDescription}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Reward</span>
                  <ValueChip amount={session.data.amount} currency={session.data.currency || "Q¢"} context="offer" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Participants</span>
                  <span>{session.data.participants?.length || 1}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-cyan-300" />
                Consent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AliasConsentToggle consented={!!session?.data?.consentGiven} onChange={handleConsent} />
              <p className="text-xs text-slate-400">Accept terms to create a consent receipt and enable the iQube step.</p>
              <Button className="w-full" onClick={() => handleConsent(true)} disabled={!session || session.data.consentGiven}>
                {session?.data?.consentGiven ? "Consent Recorded" : "Accept Terms"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-300" />
                iQube
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-400">Generate an iQube reference for this offer instance.</p>
              <Button
                className="w-full"
                onClick={handleCreateIQube}
                disabled={!session || !session.data.consentGiven}
              >
                {session?.data?.iqubeId ? `iQube ${session.data.iqubeId}` : "Create iQube"}
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                onClick={handleShareIQube}
                disabled={!session || !session.data.iqubeId || session.data.iqubeShared}
              >
                {session?.data?.iqubeShared ? "iQube Shared" : "Share iQube"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-300" />
                Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-400">Authorize the settlement to earn the reward receipt.</p>
              <Button
                className="w-full"
                onClick={handleSettle}
                disabled={!session || !session.data.iqubeId}
              >
                {session?.data?.settlement ? (
                  "Settlement Complete"
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span>Settle</span>
                    <ValueChip
                      amount={session?.data?.amount ?? 0}
                      currency={session?.data?.currency || "Q¢"}
                      context="offer"
                      className="bg-slate-800/70"
                    />
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4 text-indigo-300" />
                Share
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={handleShare} disabled={!session}>
                Generate Invite
              </Button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="truncate">{inviteUrl}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleCopyInvite}
                  disabled={!session}
                >
                  {copySuccess ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Receipts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {receipts.length === 0 && <p className="text-xs text-slate-400">No receipts yet.</p>}
              {receipts.map((receipt) => (
                <div key={receipt.id} className="flex flex-col gap-1 rounded-lg bg-slate-900/80 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">{receipt.action}</span>
                    <span className="text-slate-500">{new Date(receipt.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <span className="font-mono text-slate-400">{receipt.receiptId}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <nav
        className={`${navPositionClass} bottom-0 left-0 right-0 z-40 border-t border-slate-800`}
        style={{
          backgroundColor: "rgba(12, 17, 27, var(--glass-alpha, 0.9))",
          backdropFilter: "blur(var(--glass-blur, 0px))",
        }}
      >
        <div className={`${navContainerClass} mx-auto px-4 py-2 flex items-center justify-between`}>
          <button
            className="flex flex-col items-center text-[10px] uppercase tracking-wide text-slate-400"
            onClick={() => setLastAction("Be")}
          >
            Be
          </button>
          <div className="flex items-center gap-4">
            {runtimeMenu.filter((item) => item.slot === "center").map((item) => (
              <button
                key={item.id}
                className="flex flex-col items-center text-[10px] uppercase tracking-wide text-white"
                onClick={() => {
                  if (item.id === "compass_play") setLastAction("Play");
                  if (item.id === "compass_earn") handleSettle();
                  if (item.id === "compass_make") handleCreateIQube();
                  if (item.id === "compass_earn") setLastAction("Earn");
                  if (item.id === "compass_make") setLastAction("Make");
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="flex flex-col items-center text-[10px] uppercase tracking-wide text-slate-400"
            onClick={() => {
              handleShare();
              setLastAction("Share");
            }}
          >
            Share
          </button>
        </div>
      </nav>
    </div>
  );

  if (previewMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Runtime Preview</p>
            <h1 className="text-lg font-semibold">Device preview</h1>
            <p className="text-sm text-slate-400">Toggle device sizes to validate the runtime flow.</p>
          </div>
          <div className="h-[620px]">
            <PreviewFrame defaultDevice="mobile" showToolbar={!embedMode}>
              {runtimeContent}
            </PreviewFrame>
          </div>
        </div>
      </div>
    );
  }

  if (embedMode) {
    return runtimeContent;
  }

  return runtimeContent;
}
