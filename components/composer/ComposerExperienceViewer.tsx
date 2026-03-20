"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SmartTriadProvider } from "@/app/components/content/SmartTriadProvider";
import { SmartTriadSurfaces } from "@/app/components/content/SmartTriadSurfaces";
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
  metadata?: Record<string, any>;
};

const DEFAULT_PERSONA_ID = "00000000-0000-0000-0000-000000000001";

function resolveExperiencePersonaId(experience: ExperienceQube | null): string {
  const creatorPersonaId =
    typeof experience?.metadata?.creator_persona?.id === "string" &&
    experience.metadata.creator_persona.id.trim()
      ? experience.metadata.creator_persona.id.trim()
      : null;
  if (creatorPersonaId) return creatorPersonaId;

  if (typeof experience?.creator_id === "string" && experience.creator_id.trim()) {
    return experience.creator_id.trim();
  }

  return DEFAULT_PERSONA_ID;
}

export const ComposerExperienceViewer = ({ experienceId }: { experienceId: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [experience, setExperience] = useState<ExperienceQube | null>(null);
  const [packet, setPacket] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPacket, setShowPacket] = useState(false);
  const isEmbeddedPreview = searchParams?.get("embed") === "1";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/composer/experiences/${experienceId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load experience (${res.status})`);
        const text = await res.text();
        if (!text) throw new Error("Empty response from experience API");
        const data = JSON.parse(text);
        if (!active) return;
        setExperience(data.experience_qube);

        const packetRes = await fetch(`/api/composer/experiences/${experienceId}/packet`, {
          cache: "no-store",
        });
        if (packetRes.ok) {
          const packetText = await packetRes.text();
          const packetData = packetText ? JSON.parse(packetText) : {};
          if (active) setPacket(packetData.packet || null);
        }
      } catch (err: any) {
        console.error("[ExperienceViewer] load error:", err);
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
      <div data-parity-root="experience-viewer" className={`h-full overflow-y-auto bg-slate-900 ${isEmbeddedPreview ? "p-0" : "p-6"}`}>
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading experience...
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div data-parity-root="experience-viewer" className={`h-full overflow-y-auto bg-slate-900 ${isEmbeddedPreview ? "p-0" : "p-6"}`}>
        <div className="max-w-5xl mx-auto space-y-3">
          {!isEmbeddedPreview && (
            <button
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
              onClick={() => router.push(`/studio/composer?panel=exqubes&experienceId=${encodeURIComponent(experienceId)}`)}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Composer
            </button>
          )}
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
            {error || "Experience not found."}
          </div>
        </div>
      </div>
    );
  }

  const resolvedPersonaId = resolveExperiencePersonaId(experience);

  return (
    <SmartTriadProvider personaId={resolvedPersonaId} agentId="aigent-z">
      <div data-parity-root="experience-viewer" className={`h-full overflow-y-auto bg-slate-900 ${isEmbeddedPreview ? "p-0" : "p-6"}`}>
        <div className={`${isEmbeddedPreview ? "h-full" : "mx-auto max-w-6xl space-y-6"}`}>
          {!isEmbeddedPreview && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
                onClick={() => router.push(`/studio/composer?panel=exqubes&experienceId=${encodeURIComponent(experienceId)}`)}
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
          )}

          <ExperienceLiquidRenderer
            experience={experience}
            packet={packet}
            personaId={resolvedPersonaId}
          />

          {!isEmbeddedPreview && showPacket && (
            <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-slate-200">
              {JSON.stringify(packet, null, 2)}
            </pre>
          )}
        </div>

        {!isEmbeddedPreview && <SmartTriadSurfaces personaId={resolvedPersonaId} />}
      </div>
    </SmartTriadProvider>
  );
};
