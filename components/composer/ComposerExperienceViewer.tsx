"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SmartTriadProvider, SmartTriadSurfaces } from "@/app/components/content";
import { ExperienceLiquidRenderer } from "./ExperienceLiquidRenderer";

type ExperienceQube = {
  id: string;
  name: string;
  description?: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: string;
  configuration: Record<string, any>;
};

const DEFAULT_PERSONA_ID = "00000000-0000-0000-0000-000000000001";

export const ComposerExperienceViewer = ({ experienceId }: { experienceId: string }) => {
  const router = useRouter();
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [packet, setPacket] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPacket, setShowPacket] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/composer/experiences/${experienceId}`);
        if (!res.ok) throw new Error("Failed to load experience");
        const data = await res.json();
        if (!active) return;
        setExperience(data.experience_qube);

        const packetRes = await fetch(`/api/composer/experiences/${experienceId}/packet`);
        if (packetRes.ok) {
          const packetData = await packetRes.json();
          if (active) setPacket(packetData.packet || null);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load experience");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [experienceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading experience...
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
            onClick={() => router.push("/studio/composer")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Composer
          </button>
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
            {error || "Experience not found."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SmartTriadProvider personaId={DEFAULT_PERSONA_ID} agentId="aigent-z">
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
              onClick={() => router.push("/studio/composer")}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Composer
            </button>
            <button
              onClick={() => setShowPacket((prev) => !prev)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              {showPacket ? "Hide Packet" : "Show Packet"}
            </button>
          </div>

          <ExperienceLiquidRenderer
            experience={experience}
            packet={packet}
            personaId={DEFAULT_PERSONA_ID}
          />

          {showPacket && (
            <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-slate-200">
              {JSON.stringify(packet, null, 2)}
            </pre>
          )}
        </div>

        <SmartTriadSurfaces personaId={DEFAULT_PERSONA_ID} />
      </div>
    </SmartTriadProvider>
  );
};
