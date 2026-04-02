"use client";

/**
 * KnytRemixButton
 *
 * Inline remix entry point for a Living Canon publication.
 * Calls /api/codex/knyt/living-canon/remix to create a seeded draft,
 * then opens KnytSubmissionShell pre-populated with the source attribution.
 *
 * Constraints enforced server-side (client shows helpful error if violated):
 *   - Source must be in canon / approved / canon_eligible state
 *   - Remix depth capped at 3
 *   - Remix always targets 'community' branch
 *
 * Usage:
 *   <KnytRemixButton
 *     publicationId="..."
 *     sourceLabel="The Fractured Signal"
 *     personaId="..."
 *     entitlements={['knyt:contributor']}
 *     onRemixCreated={(pubId) => void}
 *   />
 */

import React, { useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { KnytSubmissionShell } from "@/components/metame/KnytSubmissionShell";
import { useToast } from "@/hooks/use-toast";

export interface KnytRemixButtonProps {
  publicationId: string;
  sourceLabel: string;
  personaId: string;
  entitlements: string[];
  /** Schema slug for the remix contribution (default: knyt:community_submission) */
  taskSlug?: string;
  onRemixCreated?: (publicationId: string) => void;
}

export function KnytRemixButton({
  publicationId,
  sourceLabel,
  personaId,
  entitlements,
  taskSlug = "knyt:community_submission",
  onRemixCreated,
}: KnytRemixButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [remixPubId, setRemixPubId] = useState<string | null>(null);
  const [remixContribId, setRemixContribId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleRemix = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/codex/knyt/living-canon/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_publication_id: publicationId,
          persona_id: personaId,
          task_slug: taskSlug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error((data as Record<string, unknown>).error as string || "Remix failed.");
      }

      setRemixPubId((data as Record<string, unknown>).publication_id as string);
      setRemixContribId((data as Record<string, unknown>).contribution_id as string);
      setOpen(true);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Remix failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (open && remixPubId) {
    return (
      <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-cyan-300/70">
          <GitBranch className="h-3 w-3" />
          Remixing: <span className="text-cyan-200 font-medium truncate max-w-[180px]">{sourceLabel}</span>
        </div>
        <KnytSubmissionShell
          schemaSlug={taskSlug}
          personaId={personaId}
          entitlements={entitlements}
          onSubmitted={(submissionId) => {
            setOpen(false);
            onRemixCreated?.(remixPubId);
            toast("Remix submitted for review.", "success");
          }}
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setRemixPubId(null); }}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition"
        >
          Cancel remix
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleRemix()}
      disabled={loading}
      title={`Remix "${sourceLabel}" as a community submission`}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400 transition hover:text-cyan-300 hover:border-cyan-400/30 hover:bg-cyan-500/5 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <GitBranch className="h-3 w-3" />
      )}
      Remix
    </button>
  );
}
