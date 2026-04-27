/**
 * SmartWallet Embed Page
 * 
 * Full-panel SmartWallet for iframe embedding.
 * Query params:
 * - theme: 'light' | 'dark' (optional)
 * - density: 'narrow' | 'wide' (optional)
 * - wallet_mode: 'narrow-only' (optional; disables wide/collapsed expansion for this deployment)
 * - allowWide: '0' | 'false' to disable wide mode (optional)
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
  const walletMode = toText(searchParams?.get("wallet_mode"))?.toLowerCase();
  const allowWideParam = toText(searchParams?.get("allowWide"))?.toLowerCase();
  const disableWideParam = toText(searchParams?.get("disableWide"))?.toLowerCase();
  const isNarrowOnly =
    walletMode === "narrow-only" ||
    allowWideParam === "0" ||
    allowWideParam === "false" ||
    disableWideParam === "1" ||
    disableWideParam === "true";
  const effectiveDensity: "narrow" | "wide" = isNarrowOnly ? "narrow" : density;
  const embeddedWidthMode: "fill" | "fixed" =
    isNarrowOnly ? "fixed" : effectiveDensity === "wide" ? "fixed" : "fill";
  const personaIdFromQuery = toText(searchParams?.get("personaId"));
  const agentIdFromQuery = toText(searchParams?.get("agentId"));
  const agentNameFromQuery = toText(searchParams?.get("agentName"));
  const fioHandleFromQuery = toText(searchParams?.get("fioHandle"));
  const VALID_TABS = ["wallet", "library", "tasks", "reputation", "rewards", "payments", "connections", "iqube"] as const;
  type EmbedDrawerTab = typeof VALID_TABS[number];
  const tabFromQuery = toText(searchParams?.get("tab"));
  const initialTab: EmbedDrawerTab = VALID_TABS.includes(tabFromQuery as EmbedDrawerTab)
    ? (tabFromQuery as EmbedDrawerTab)
    : "wallet";

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
        const bootstrapParams = new URLSearchParams();
        if (personaIdFromQuery) bootstrapParams.set("personaId", personaIdFromQuery);
        if (agentIdFromQuery) bootstrapParams.set("agentId", agentIdFromQuery);
        if (agentNameFromQuery) bootstrapParams.set("agentName", agentNameFromQuery);
        if (fioHandleFromQuery) bootstrapParams.set("fioHandle", fioHandleFromQuery);
        const bootstrapQuery = bootstrapParams.toString();

        const bootstrapResponse = await fetch(
          `/api/embed/wallet/bootstrap${bootstrapQuery ? `?${bootstrapQuery}` : ""}`,
          { cache: "no-store" }
        );
        if (bootstrapResponse.ok) {
          const bootstrap = await bootstrapResponse.json();
          if (!cancelled && bootstrap?.ok) {
            const hydratedPersonaId = toText(bootstrap.personaId) || personaIdFromQuery;
            const hydratedAgent = {
              id: toText(bootstrap?.agent?.id) || agentOverrides.agentId || hydratedPersonaId || "embed-agent",
              name: toText(bootstrap?.agent?.name) || agentOverrides.agentName || "Embed User",
              fioHandle: toText(bootstrap?.agent?.fioHandle) || agentOverrides.fioHandle || undefined,
            };
            setPersonaId(hydratedPersonaId || undefined);
            setAgent(hydratedAgent);

            if (hydratedPersonaId || toText(bootstrap?.agent?.id) || toText(bootstrap?.agent?.name)) {
              return;
            }
          }
        }

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
      <div
        className={
          isNarrowOnly
            ? "h-full w-[22.25rem] max-w-[22.25rem] ml-auto overflow-hidden"
            : "h-full w-full"
        }
        data-wallet-mode={isNarrowOnly ? "narrow-only" : "default"}
      >
        <SmartWalletDrawer
          open={true}
          onClose={() => {}} // No-op in embedded mode
          variant="embedded"
          embeddedWidth={embeddedWidthMode}
          allowWideLayout={!isNarrowOnly}
          agent={agent}
          personaId={personaId}
          initialTab={initialTab}
          codexMode={false} // Regular embed mode, not Codex
        />
      </div>
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
