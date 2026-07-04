"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SmartTriadProvider } from "@/app/components/content/SmartTriadProvider";
import { SmartTriadSurfaces } from "@/app/components/content/SmartTriadSurfaces";
import { ExperienceLiquidRenderer } from "./ExperienceLiquidRenderer";
import { personaFetch } from "@/utils/personaSpine";

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
  const [packetError, setPacketError] = useState<string | null>(null);
  const [packetRetryKey, setPacketRetryKey] = useState(0);
  const isEmbeddedPreview = searchParams?.get("embed") === "1";
  const fromRuntime = searchParams?.get("from") === "runtime";
  const adminUrlOverride =
    searchParams?.get("admin") === "1" || searchParams?.get("runtimeAdmin") === "1";
  const [showPacket, setShowPacket] = useState(false);
  // Admin is a PERSONA attribute resolved server-side by the identity spine —
  // never email-gated. personaFetch attaches the Supabase Bearer token; the
  // spine returns cartridgeFlags.isAdmin (global/platform-tier) + adminCartridges
  // (per-cartridge tenant admin). Email only enables persona access/recovery;
  // the active persona is the identifier. Editing the launcher is admin-only;
  // the runtime consumer surface (embed=1 / from=runtime) must not expose the
  // Studio authoring controls. Direct Studio authoring stays editable.
  const [adminFlags, setAdminFlags] = useState<{ isAdmin: boolean; adminCartridges: string[] }>({
    isAdmin: false,
    adminCartridges: [],
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch("/api/wallet/active-persona", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const surface = await res.json();
        const flags = surface?.cartridgeFlags;
        if (!cancelled) {
          setAdminFlags({
            isAdmin: Boolean(flags?.isAdmin),
            adminCartridges: Array.isArray(flags?.adminCartridges)
              ? flags.adminCartridges.filter((x: unknown): x is string => typeof x === "string")
              : [],
          });
        }
      } catch {
        // Non-fatal — defaults to the consumer (non-editing) view.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Resolve the experience's cartridge so per-cartridge (tenant) admins also edit.
  const experienceCartridge =
    typeof (experience?.metadata?.runtime_publication as { cartridge_id?: unknown } | undefined)
      ?.cartridge_id === "string"
      ? ((experience?.metadata?.runtime_publication as { cartridge_id?: string }).cartridge_id as string)
      : null;
  const isAdmin =
    adminFlags.isAdmin ||
    (experienceCartridge ? adminFlags.adminCartridges.includes(experienceCartridge) : false);
  const isConsumerSurface = isEmbeddedPreview || fromRuntime;
  const canEdit = adminUrlOverride || isAdmin || !isConsumerSurface;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setPacketError(null);
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
          if (active) {
            setPacket(packetData.packet || null);
            setPacketError(null);
          }
        } else {
          const errText = await packetRes.text().catch(() => "");
          let errMsg = `Packet build failed (${packetRes.status})`;
          try {
            const errData = errText ? JSON.parse(errText) : {};
            if (typeof errData.error === "string") errMsg = errData.error;
          } catch { /* ignore parse failures */ }
          if (active) setPacketError(errMsg);
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
  }, [experienceId, packetRetryKey]);

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
              {canEdit && (
                <button
                  onClick={() => setShowPacket((prev) => !prev)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {showPacket ? "Hide Packet" : "Show Packet"}
                </button>
              )}
            </div>
          )}

          {packetError && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <span>{packetError}</span>
              <button
                className="shrink-0 rounded-full border border-amber-400/40 px-3 py-1 text-xs hover:border-amber-300/60 hover:text-amber-100"
                onClick={() => setPacketRetryKey((k) => k + 1)}
              >
                Retry
              </button>
            </div>
          )}

          <ExperienceLiquidRenderer
            experience={experience}
            packet={packet}
            personaId={resolvedPersonaId}
            canEdit={canEdit}
          />

          {!isEmbeddedPreview && canEdit && showPacket && (
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
