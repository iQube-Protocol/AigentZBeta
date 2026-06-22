"use client";

/**
 * StandingCoreChip — aigentMe right-pane carousel chip that launches the
 * Standing Core wizard. Mirrors PersonalGuideChip: self-contained, shows
 * whether the citizen has attested a Standing yet, and opens the wizard.
 *
 * Standing Core is free for every citizen, so the chip always renders.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { StandingCoreWizard } from "@/components/metame/setup/StandingCoreWizard";

export function StandingCoreChip({ personaId }: { personaId?: string }) {
  const [hasStanding, setHasStanding] = useState<boolean | null>(null);
  const [claimCount, setClaimCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await personaFetch("/api/standing/core-wizard", { personaIdHint: personaId, cache: "no-store" });
      if (!res.ok) { setHasStanding(false); return; }
      const data = await res.json();
      const answered = Object.values((data?.answers ?? {}) as Record<string, string>).some(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
      setHasStanding(!!data?.hasProfile && answered);
      setClaimCount(Number(data?.capabilityClaimCount ?? 0));
    } catch {
      setHasStanding(false);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  if (hasStanding === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Standing Core — attest who you are and what you intend"
        className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1 hover:brightness-110 ${
          hasStanding
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-violet-500/10 border-violet-500/30 text-violet-300"
        }`}
      >
        <ShieldCheck className="w-3 h-3" />
        {hasStanding ? (claimCount > 0 ? `Standing: ${claimCount} claims` : "Standing set") : "Build my Standing"}
      </button>
      <StandingCoreWizard
        open={open}
        onOpenChange={setOpen}
        personaId={personaId}
        onSaved={() => void load()}
      />
    </>
  );
}

export default StandingCoreChip;
