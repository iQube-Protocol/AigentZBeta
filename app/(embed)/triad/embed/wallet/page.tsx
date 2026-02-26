/**
 * SmartWallet Embed Page
 * 
 * Full-panel SmartWallet for iframe embedding.
 * Query params:
 * - theme: 'light' | 'dark' (optional)
 * - density: 'narrow' | 'wide' (optional)
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import SmartWalletDrawer from "../../../../components/content/SmartWalletDrawer";
import {
  getMyPersonas,
  resolveCurrentPersona,
} from "@/app/services/personaService";

type EmbedAgent = {
  id: string;
  name: string;
  fioHandle?: string;
};

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildAgent(
  persona: Record<string, unknown> | null | undefined,
  fallbackPersonaId?: string,
  overrides?: {
    agentId?: string;
    agentName?: string;
    fioHandle?: string;
  }
): EmbedAgent {
  const personaId = toText(persona?.id) || fallbackPersonaId || "embed-agent";
  const personaName =
    toText(persona?.display_name) ||
    toText(persona?.displayName) ||
    toText(persona?.name) ||
    "Embed User";

  return {
    id: overrides?.agentId || personaId,
    name: overrides?.agentName || personaName,
    fioHandle:
      overrides?.fioHandle ||
      toText(persona?.fio_handle) ||
      toText(persona?.fioHandle) ||
      undefined,
  };
}

function SmartWalletContent() {
  const searchParams = useSearchParams();
  const theme = (searchParams?.get('theme') as 'light' | 'dark') || 'dark';
  const density = (searchParams?.get('density') as 'narrow' | 'wide') || 'wide';
  const personaIdFromQuery = toText(searchParams?.get("personaId"));
  const agentIdFromQuery = toText(searchParams?.get("agentId"));
  const agentNameFromQuery = toText(searchParams?.get("agentName"));
  const fioHandleFromQuery = toText(searchParams?.get("fioHandle"));

  const [personaId, setPersonaId] = useState<string | undefined>(personaIdFromQuery);
  const [agent, setAgent] = useState<EmbedAgent>(() =>
    buildAgent(
      null,
      personaIdFromQuery,
      {
        agentId: agentIdFromQuery,
        agentName: agentNameFromQuery,
        fioHandle: fioHandleFromQuery,
      }
    )
  );

  const agentOverrides = useMemo(
    () => ({
      agentId: agentIdFromQuery,
      agentName: agentNameFromQuery,
      fioHandle: fioHandleFromQuery,
    }),
    [agentIdFromQuery, agentNameFromQuery, fioHandleFromQuery]
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateEmbedIdentity = async () => {
      try {
        const resolvedPersonaId = personaIdFromQuery || (await resolveCurrentPersona()) || undefined;
        const { personas } = await getMyPersonas();

        const activePersona =
          personas.find((persona) => toText(persona?.id) === resolvedPersonaId) ||
          personas[0] ||
          null;

        const nextPersonaId = toText(activePersona?.id) || resolvedPersonaId;
        if (cancelled) return;

        setPersonaId(nextPersonaId);
        setAgent(buildAgent(activePersona, nextPersonaId, agentOverrides));
      } catch (error) {
        console.warn("[WalletEmbed] Failed to hydrate persona context:", error);
        if (cancelled) return;
        setPersonaId(personaIdFromQuery);
        setAgent(buildAgent(null, personaIdFromQuery, agentOverrides));
      }
    };

    void hydrateEmbedIdentity();

    return () => {
      cancelled = true;
    };
  }, [agentOverrides, personaIdFromQuery]);

  return (
    <div className={`h-full ${theme === "light" ? "bg-slate-100" : "bg-slate-900"}`}>
      <SmartWalletDrawer
        open={true}
        onClose={() => {}} // No-op in embedded mode
        variant="embedded"
        embeddedWidth={density === 'wide' ? 'fixed' : 'fill'}
        agent={agent}
        personaId={personaId}
        codexMode={false} // Regular embed mode, not Codex
      />
    </div>
  );
}

export default function WalletEmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="text-white">Loading SmartWallet...</div>
      </div>
    }>
      <SmartWalletContent />
    </Suspense>
  );
}
