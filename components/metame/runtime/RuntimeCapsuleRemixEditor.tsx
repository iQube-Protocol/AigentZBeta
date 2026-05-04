"use client";

/**
 * RuntimeCapsuleRemixEditor — consumer-facing remix banner that mirrors
 * RuntimeCapsuleAdminEditor's shape. Thin amber-tinted banner with a
 * Sparkles + Remix toggle on the right; expands inline (no popout) when
 * opened to render the full RemixDialog content.
 *
 * Sits in the same slot the admin editor uses on each capsule chip — admins
 * see RuntimeCapsuleAdminEditor; non-admins see this.
 */
import React, { useState } from "react";
import { Sparkles, X as XIcon } from "lucide-react";
import { RemixDialog } from "@/components/metame/runtime/RemixDialog";

interface Props {
  personaId: string | null;
  /** While true, persona resolution is still in progress. The sign-in banner
      is suppressed so signed-in users don't see a flash of "please sign in". */
  personaResolving?: boolean;
  sourceExperienceId: string;
  initialTitle: string;
  initialPrompt: string;
  /** Called when an unauthenticated user clicks the sign-in CTA. Host should
      open the wallet drawer (or whatever sign-in surface is appropriate). */
  onSignInRequest?: () => void;
}

export function RuntimeCapsuleRemixEditor({
  personaId,
  personaResolving = false,
  sourceExperienceId,
  initialTitle,
  initialPrompt,
  onSignInRequest,
}: Props) {
  const [open, setOpen] = useState(false);

  // Whole-banner click toggles open. The chip on the right is a visual
  // cue and stays clickable on its own (with stopPropagation to avoid
  // the parent click also firing). When the dialog is open, clicks
  // inside the body shouldn't toggle the banner closed — only the chip
  // (now an X) does that.
  const toggle = () => setOpen((v) => !v);

  return (
    <div
      role={!open ? "button" : undefined}
      tabIndex={!open ? 0 : -1}
      onClick={!open ? toggle : undefined}
      onKeyDown={!open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } } : undefined}
      className={`rounded-xl border bg-gradient-to-br from-amber-500/[0.07] to-slate-900/80 p-3 space-y-3 transition ${
        open
          ? "border-amber-400/40"
          : "border-amber-400/30 hover:border-amber-300/50 hover:from-amber-500/[0.10] cursor-pointer"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Community</div>
          <div className="text-sm font-medium text-white">Remix as article or story</div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/25 hover:border-amber-300/60"
          title={open ? "Close the remix editor" : "Remix this experience as your own article or story"}
        >
          {open ? <XIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {open ? "Close editor" : "Remix"}
        </button>
      </div>

      {open ? (
        <div onClick={(e) => e.stopPropagation()}>
          <RemixDialog
            variant="inline"
            open={true}
            personaId={personaId}
            personaResolving={personaResolving}
            sourceExperienceId={sourceExperienceId}
            initialTitle={initialTitle}
            initialPrompt={initialPrompt}
            onClose={() => setOpen(false)}
            onSignInRequest={onSignInRequest}
          />
        </div>
      ) : null}
    </div>
  );
}

export default RuntimeCapsuleRemixEditor;
