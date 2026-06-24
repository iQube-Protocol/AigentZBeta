"use client";

/**
 * VentureLightChip — aigentMe carousel chip for the VentureQube Lite surface.
 *
 * Dual utilization (mirrors the operating-model `operatorMode`):
 *   • Operator mode (single venture) — Lite is the seed venture being incubated.
 *     The chip opens VentureLightWizard bound to that one venture (it later
 *     graduates into a VentureQube Pro).
 *   • Portfolio-operator mode (multiple ventures) — Lite is the PORTFOLIO
 *     ORCHESTRATION layer, NOT a venture. The chip opens the Operating Brief
 *     (VenturePortfolioWizard mode="operating"), which reads/writes the
 *     portfolio's operating model and NEVER touches any of the Pro ventures.
 *
 * Portfolio mode is detected when the operating model declares
 * operatorMode === 'portfolio-operator' OR the persona has more than one
 * venture (you cannot interpret Lite as a single seed venture with several Pro
 * ventures in flight). This is the fix for the conflation where editing Lite
 * mutated the first Pro venture (it used to bind to ventures[0]).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Sparkles, Compass } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { VentureLightWizard } from "@/components/metame/setup/VentureLightWizard";
import { VenturePortfolioWizard } from "@/components/metame/setup/VenturePortfolioWizard";

export function VentureLightChip({ personaId }: { personaId?: string }) {
  const [ventureName, setVentureName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  // Portfolio-mode state — when true the chip edits the operating brief, not a venture.
  const [portfolioMode, setPortfolioMode] = useState(false);
  const [canPortfolio, setCanPortfolio] = useState(false);
  const [briefSet, setBriefSet] = useState(false);

  const load = useCallback(async () => {
    try {
      // Ventures (operator-mode display + count).
      let ventures: Array<{ name?: string }> = [];
      const res = await personaFetch("/api/venture/qubes", { personaIdHint: personaId, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        ventures = Array.isArray(data?.ventures) ? data.ventures : [];
      }

      // Portfolio (operating model + operatorMode). Only succeeds for Founder
      // Office tiers; a failure means free/single-venture → operator mode.
      let operatorMode: string | null = null;
      let missionSet = false;
      let canPort = false;
      let ventureCount = ventures.length;
      try {
        const pRes = await personaFetch("/api/venture/portfolio", { personaIdHint: personaId, cache: "no-store" });
        if (pRes.ok) {
          const p = await pRes.json();
          operatorMode = p?.operatingModel?.operatorMode ?? null;
          missionSet = Boolean(p?.operatingModel?.mission);
          canPort = Boolean(p?.canPortfolio);
          if (typeof p?.ventureCount === "number") ventureCount = p.ventureCount;
        }
      } catch { /* no operating access → operator mode */ }

      const isPortfolio = operatorMode === "portfolio-operator" || ventureCount > 1;
      setPortfolioMode(isPortfolio);
      setCanPortfolio(canPort);
      setBriefSet(missionSet);
      // In portfolio mode the chip represents the orchestration layer, not a
      // venture — never surface a Pro venture's name as the Lite label.
      setVentureName(isPortfolio ? null : (ventures[0]?.name ?? null));
    } catch { /* best-effort */ } finally {
      setLoaded(true);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) return null;

  const label = portfolioMode
    ? (briefSet ? "Portfolio brief" : "Set portfolio brief")
    : (ventureName ? `Venture: ${ventureName}` : "Start my venture");
  const filled = portfolioMode ? briefSet : Boolean(ventureName);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={portfolioMode
          ? "VentureQube Lite (portfolio mode) — your portfolio operating brief. Does not change your ventures."
          : "Venture Light — incubate one venture"}
        className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1 hover:brightness-110 ${
          filled
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-violet-500/10 border-violet-500/30 text-violet-300"
        }`}
      >
        {portfolioMode ? <Compass className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
        {label}
      </button>
      {portfolioMode ? (
        <VenturePortfolioWizard
          open={open}
          onOpenChange={setOpen}
          personaId={personaId}
          mode="operating"
          hasOperatingAccess
          hasPortfolioAccess={canPortfolio}
          onSaved={() => void load()}
        />
      ) : (
        <VentureLightWizard
          open={open}
          onOpenChange={setOpen}
          personaId={personaId}
          onSaved={() => void load()}
        />
      )}
    </>
  );
}

export default VentureLightChip;
