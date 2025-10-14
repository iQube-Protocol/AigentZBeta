"use client";
import { notFound } from "next/navigation";
import React from "react";
import { personas } from "../../data/personas";
import { ContextPanel } from "../../../components/ContextPanel";
import AgentWalletDrawer from "@/components/AgentWalletDrawer";
import { getAgentConfig } from "../../data/agentConfig";

export default function AgentPage({ params }: { params: { agentKey: string } }) {
  const persona = personas[params.agentKey as keyof typeof personas];
  const agentConfig = getAgentConfig(params.agentKey);
  const [walletOpen, setWalletOpen] = React.useState(false);

  if (!persona || !agentConfig) {
    return notFound();
  }

  const agentData = {
    id: agentConfig.id,
    name: agentConfig.name,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{persona.title}</h1>
        <button
          onClick={() => setWalletOpen(true)}
          className="px-3 py-1.5 text-xs rounded border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          Open Wallet Drawer
        </button>
      </div>
      <p className="text-slate-300 mb-4">
        Interact with the {persona.title} persona through the Context Transformation panel below.
      </p>
      <ContextPanel persona={persona} />
      <AgentWalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} agent={agentData} />
    </div>
  );
}
