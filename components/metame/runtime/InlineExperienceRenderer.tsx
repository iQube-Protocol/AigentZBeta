"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ExperienceLiquidRenderer } from "@/components/composer/ExperienceLiquidRenderer";

interface Props {
  experienceId: string;
  personaId?: string;
  canEdit?: boolean;
}

export function InlineExperienceRenderer({ experienceId, personaId, canEdit = false }: Props) {
  const [experience, setExperience] = useState<Record<string, any> | null>(null);
  const [packet, setPacket] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!experienceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [expRes, packetRes] = await Promise.all([
          fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}`, { cache: "no-store" }),
          fetch(`/api/composer/experiences/${encodeURIComponent(experienceId)}/packet`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (expRes.ok) {
          const expData = await expRes.json();
          setExperience(expData?.experience_qube ?? null);
        } else {
          setError("Could not load experience");
        }
        if (packetRes.ok) {
          const packetData = await packetRes.json();
          setPacket(packetData?.packet ?? null);
        }
      } catch {
        if (!cancelled) setError("Could not load experience");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [experienceId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading experience…
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        {error || "Experience not available."}
      </div>
    );
  }

  return (
    <ExperienceLiquidRenderer
      experience={experience as any}
      packet={packet}
      personaId={personaId}
      canEdit={canEdit}
    />
  );
}
