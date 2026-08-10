"use client";

/**
 * /bridge/knyts — The KNYTS Bridge public front door.
 *
 * HOMECOMING and VIEW, browsable without a session (Constitutional Time
 * Principle: reduce unnecessary decisions before the visitor has any
 * reason to make one). ORIENT/PASSPORT/REMIX/STAND happen inline, gated
 * exactly where the visitor tries to act — see KnytCommunityContentTab's
 * RemixCrossingButton and usePassportSignInGate. BUY deep-links to the
 * existing KNYT Store; no new commerce code here.
 *
 * This page hosts Passport sign-in itself (usePassportSignInHost +
 * PassportConnectPanel, the same surface /invite/[code]/page.tsx uses
 * directly) because — unlike the cartridge tabs this page reuses — it has
 * no SmartWalletDrawer mounted anywhere in its tree to answer a
 * PASSPORT_SIGN_IN request otherwise.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, ShoppingBag, Sparkles, Trophy } from "lucide-react";
import { PassportConnectPanel } from "@/components/companion/PassportConnectPanel";
import { usePassportSignInHost } from "@/app/hooks/usePassportSignInHost";
import { KnytCommunityContentTab } from "@/app/triad/components/codex/tabs/KnytCommunityContentTab";
import { KnytsBridgeStandPanel } from "@/components/journey/KnytsBridgeStandPanel";
import { BridgeMediaStage } from "@/components/journey/BridgeMediaStage";
import { buildCodexUrl } from "@/utils/codex-nav";
import { KNYTS_BRIDGE_CAMPAIGN_ID } from "@/services/journey/knytsBridgeCrossingJourney";

interface CrossingOfTheWeek {
  weekStart: string;
  communityContentId: string;
  title: string;
  score: number;
}

export default function KnytsBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [crossingOfTheWeek, setCrossingOfTheWeek] = useState<CrossingOfTheWeek | null>(null);

  // Same pinned-persona read every top-level surface uses as its baseline
  // (personaFetch's own fallback, MetaMeRuntimeClient's resolver) — no
  // heavier resolution needed here: PassportConnectPanel's own completion
  // is what populates this key when a visitor signs in on this page.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("currentPersonaId");
      if (stored) setPersonaId(stored);
    } catch { /* storage unavailable — stays signed-out */ }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost("KnytsBridgeFrontDoor");

  useEffect(() => {
    fetch("/api/journey/knyts-bridge/crossing-of-the-week", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; crossing?: CrossingOfTheWeek | null }) => {
        if (j.ok && j.crossing) setCrossingOfTheWeek(j.crossing);
      })
      .catch(() => { /* non-fatal — front door still renders without it */ });
  }, []);

  const scrollToView = useCallback(() => {
    document.getElementById("knyts-bridge-view")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const buyUrl = buildCodexUrl("knyt-codex", { tab: "store-episodes", personaId, shell: "viewer" });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* HOMECOMING */}
      <BridgeMediaStage
        eyebrow="The KNYTS Bridge"
        headline="Cross the Threshold. Come home."
        paragraphs={[
          "The KNYTS Bridge is one path into the Polity — a constitutional home for people and their agents in the emerging Constitutional Internet.",
          "Follow the stories of those who are crossing. When you’re ready, claim your Passport, cross the Threshold and tell your own.",
          "Share your crossing. Discover others. Earn Standing. Win rewards.",
        ]}
        highlightLine="Every crossing builds the bridge."
        primaryCtaLabel="Explore the crossings"
        onPrimaryCta={scrollToView}
        accent="amber"
      />

      {/* Crossing of the Week */}
      {crossingOfTheWeek && (
        <div className="mx-auto max-w-3xl px-6 pb-6">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
            <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-amber-400">Crossing of the Week</p>
              <p className="text-sm font-semibold text-white truncate">{crossingOfTheWeek.title}</p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW — campaign-filtered Pulse, browsable signed-out */}
      <div id="knyts-bridge-view" className="mx-auto max-w-5xl px-6 pb-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-slate-200">Crossing Stories</h2>
        </div>
        <div className="h-[600px] rounded-2xl border border-white/10 overflow-hidden">
          <KnytCommunityContentTab
            personaId={personaId}
            cartridge="knyt"
            campaignTag={KNYTS_BRIDGE_CAMPAIGN_ID}
          />
        </div>
      </div>

      {/* STAND — only meaningful once signed in with a published crossing */}
      {personaId && (
        <div className="mx-auto max-w-3xl px-6 pb-10">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Your Standing</h2>
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <KnytsBridgeStandPanel personaId={personaId} />
          </div>
        </div>
      )}

      {/* BUY — deep-link into the existing KNYT Store, no new commerce code */}
      <div className="mx-auto max-w-3xl px-6 pb-20">
        <a
          href={buyUrl}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-amber-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShoppingBag className="h-4 w-4 text-amber-300" />
            Visit the KNYT Store
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>
      </div>

      {/* PASSPORT — hosted inline for whichever surface above requested it */}
      {showPassportSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
            <PassportConnectPanel
              world="application"
              embedded
              onConnected={() => {
                try {
                  const stored = window.localStorage.getItem("currentPersonaId");
                  if (stored) setPersonaId(stored);
                } catch { /* ignore */ }
                completeSignIn();
              }}
            />
            <button
              type="button"
              onClick={dismissSignIn}
              className="w-full border-t border-white/10 px-4 py-2.5 text-[12px] text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
