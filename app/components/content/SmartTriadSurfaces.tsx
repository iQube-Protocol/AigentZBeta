"use client";

import React from "react";
import ContentViewer from "./ContentViewer";
import SmartWalletDrawer from "./SmartWalletDrawer";
import { useSmartTriad } from "./SmartTriadProvider";
import { agentConfigs } from "@/app/data/agentConfig";

interface SmartTriadSurfacesProps {
  personaId?: string;
}

export function SmartTriadSurfaces({ personaId }: SmartTriadSurfacesProps) {
  const { state, actions } = useSmartTriad();

  const payer = agentConfigs["aigent-z"];
  const recipient = agentConfigs["aigent-kn0w1"];

  const viewerOpen = state.activeDrawer === "contentViewer" && !!state.currentContent;
  const hasAccess = state.currentContent ? actions.checkOwnership(state.currentContent.id) : false;

  return (
    <>
      {viewerOpen && state.currentContent && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              actions.setActiveDrawer(null);
            }}
          />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[85vh] rounded-2xl bg-slate-950/70 ring-1 ring-white/10 overflow-hidden">
              <ContentViewer
                content={state.currentContent}
                initialModality={(state.viewerModality as any) || undefined}
                hasAccess={hasAccess}
                accessScope={hasAccess ? "full" : "preview"}
                onClose={() => actions.setActiveDrawer(null)}
                onPanelPayment={() => actions.openWallet("full")}
              />
            </div>
          </div>
        </div>
      )}

      <SmartWalletDrawer
        open={state.walletOpen}
        onClose={() => actions.closeWallet()}
        agent={{
          id: payer.id,
          name: payer.name,
          evmSepolia: payer.walletAddresses.evmAddress as `0x${string}`,
          evmArb: payer.walletAddresses.evmAddress as `0x${string}`,
          btcAddress: payer.walletAddresses.btcAddress,
        }}
        recipientAddress={recipient.walletAddresses.evmAddress}
        currentContent={state.currentContent || undefined}
        onPurchaseComplete={() => actions.refreshLibrary()}
        personaId={personaId}
      />
    </>
  );
}
