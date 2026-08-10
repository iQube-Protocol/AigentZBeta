"use client";

/**
 * /bridge/ci — the Constitutional Internet Bridge
 * public front door. The canonical Ethos Bridge into the Polity, cloned
 * from the KNYTS Bridge's own Threshold Guide architecture
 * (app/bridge/knyts/page.tsx) per the operator's explicit instruction: "the
 * capabilities already exist; the implementation task is composition,
 * hydration, contextualization and limited generalization."
 *
 * HOME/VIEW/ORIENT are browsable without a session (Constitutional Time
 * Principle: reduce unnecessary decisions before the visitor has any reason
 * to make one). PASSPORT/ACT/STAND are the real, evidenced JourneyDefinition
 * stages (services/journey/constitutionalInternetBridgeJourney.ts). CHOOSE
 * is always available. This page hosts Passport sign-in itself
 * (usePassportSignInHost + PassportConnectPanel — the same surface
 * /invite/[code]/page.tsx and /bridge/knyts use directly) because it has no
 * SmartWalletDrawer mounted anywhere in its tree to answer a
 * PASSPORT_SIGN_IN request otherwise.
 */

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { PassportConnectPanel } from "@/components/companion/PassportConnectPanel";
import { usePassportSignInHost } from "@/app/hooks/usePassportSignInHost";
import { usePassportSignInGate } from "@/app/hooks/usePassportSignInGate";
import { BridgeMediaStage } from "@/components/journey/BridgeMediaStage";
import { ConstitutionalInternetBridgeViewSequence } from "@/components/journey/ConstitutionalInternetBridgeViewSequence";
import { ConstitutionalFrontierOrientSurface } from "@/components/journey/ConstitutionalFrontierOrientSurface";
import { ConstitutionalAgentFieldEntrySurface } from "@/components/journey/ConstitutionalAgentFieldEntrySurface";
import { ConstitutionalInternetBridgeStandPanel } from "@/components/journey/ConstitutionalInternetBridgeStandPanel";
import { ConstitutionalInternetBridgeChooseSurface } from "@/components/journey/ConstitutionalInternetBridgeChooseSurface";

const ACT_RETURN_TARGET = "campaign:constitutional-internet-bridge:act";

export default function ConstitutionalInternetBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("currentPersonaId");
      if (stored) setPersonaId(stored);
    } catch { /* storage unavailable — stays signed-out */ }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost("ConstitutionalInternetBridgeFrontDoor");

  const { requestSignIn, handoffUnanswered } = usePassportSignInGate({
    origin: "CI_BRIDGE_ACT",
    returnTarget: ACT_RETURN_TARGET,
    returnLabel: "Continue to your agent disposition",
    onSignedIn: () => {
      try {
        const stored = window.localStorage.getItem("currentPersonaId");
        if (stored) setPersonaId(stored);
      } catch { /* ignore */ }
    },
  });

  const scrollToView = () => {
    document.getElementById("ci-bridge-view")?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToBook = () => {
    document.getElementById("ci-bridge-choose")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* HOME */}
      <BridgeMediaStage
        eyebrow="The Constitutional Internet Bridge"
        headline="The Internet recognizes accounts. The Constitutional Internet recognizes persons."
        paragraphs={[
          "This is one path into the Polity — a constitutional home for people and their agents in the emerging Constitutional Internet.",
        ]}
        primaryCtaLabel="Enter"
        onPrimaryCta={scrollToView}
        secondaryCtaLabel="Explore the book"
        onSecondaryCta={scrollToBook}
        accent="indigo"
      />

      {/* VIEW */}
      <div id="ci-bridge-view" className="mx-auto max-w-3xl px-6 pb-12">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-indigo-300" />
          <h2 className="text-sm font-semibold text-slate-200">See the Frontier</h2>
        </div>
        <ConstitutionalInternetBridgeViewSequence />
      </div>

      {/* ORIENT */}
      <div className="mx-auto max-w-3xl px-6 pb-12">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Your Constitutional Frontier</h2>
        <ConstitutionalFrontierOrientSurface />
      </div>

      {/* ACT — gated on Passport, resumes the same intent on sign-in */}
      <div className="mx-auto max-w-3xl px-6 pb-12">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Bring Your Agent Into the Field</h2>
        <p className="text-xs text-slate-500 mb-4">Context may cross before authority does. Connection is never delegation.</p>
        {personaId ? (
          <ConstitutionalAgentFieldEntrySurface />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
            <p className="text-sm text-slate-300">
              Crossing the Threshold is something you do as yourself, so this is the one step between
              exploring the proposition and bringing an agent into the field with you.
            </p>
            <button
              type="button"
              onClick={requestSignIn}
              className="mt-4 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-400"
            >
              Claim your Passport
            </button>
            {handoffUnanswered && (
              <p className="mt-2 text-xs text-rose-400">Could not reach a Passport sign-in surface on this page.</p>
            )}
          </div>
        )}
      </div>

      {/* STAND */}
      {personaId && (
        <div className="mx-auto max-w-3xl px-6 pb-12">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">See Yourself Enter the Loop</h2>
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <ConstitutionalInternetBridgeStandPanel personaId={personaId} />
          </div>
        </div>
      )}

      {/* CHOOSE */}
      <div id="ci-bridge-choose" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Where Next?</h2>
        <ConstitutionalInternetBridgeChooseSurface personaId={personaId} />
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
