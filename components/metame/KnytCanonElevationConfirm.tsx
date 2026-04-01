"use client";

/**
 * KnytCanonElevationConfirm
 *
 * Confirmation chip + dialog for elevating a canon_eligible publication to 'canon'.
 * Calls /api/codex/knyt/canon-elevation and writes an Autodrive CID.
 *
 * Usage:
 *   <KnytCanonElevationConfirm
 *     publicationId="..."
 *     publicationLabel="The Fractured Signal — Community"
 *     actorPersonaId="..."
 *     onElevated={(cid) => void}
 *   />
 *
 * Only renders when state === 'canon_eligible'. Caller is responsible for
 * only mounting this when the item is ready for elevation.
 */

import React, { useState } from "react";
import { Star, Loader2, CheckCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";

export interface KnytCanonElevationConfirmProps {
  publicationId: string;
  publicationLabel: string;
  actorPersonaId: string;
  /** Called after successful elevation with the Autodrive CID (may be null) */
  onElevated?: (autodriveCid: string | null) => void;
}

export function KnytCanonElevationConfirm({
  publicationId,
  publicationLabel,
  actorPersonaId,
  onElevated,
}: KnytCanonElevationConfirmProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elevated, setElevated] = useState(false);

  const handleElevate = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const res = await fetch("/api/codex/knyt/canon-elevation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: publicationId,
          actor_persona_id: actorPersonaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error((data as Record<string, unknown>).error as string || "Elevation failed.");
      }

      setElevated(true);
      const cid = (data as Record<string, unknown>).autodrive_cid as string | null;
      const warning = (data as Record<string, unknown>).autodrive_warning as string | null;

      toast(
        warning
          ? `Elevated to Canon. ${warning}`
          : `Elevated to Canon — on-chain record written.`,
        warning ? "warn" : "success"
      );

      onElevated?.(cid);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Elevation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (elevated) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200">
        <CheckCircle className="h-3 w-3 text-violet-400" />
        Canon
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Star className="h-3 w-3 text-amber-400" />
        )}
        Elevate to Canon
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Elevate to Canon"
        confirmText="Elevate"
        cancelText="Cancel"
        confirmClassName="bg-violet-600 text-white hover:bg-violet-500"
        onConfirm={handleElevate}
        onCancel={() => setConfirmOpen(false)}
      >
        <p className="text-sm text-slate-300 mb-3">
          You are about to elevate this submission to <span className="text-violet-300 font-medium">Canon</span>.
          This writes a permanent, publicly-auditable record to Autonomys Auto-Drive.
        </p>
        <div className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white truncate">
          {publicationLabel}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          This action cannot be undone from this interface. Canon elevation is final.
        </p>
      </ConfirmDialog>
    </>
  );
}
