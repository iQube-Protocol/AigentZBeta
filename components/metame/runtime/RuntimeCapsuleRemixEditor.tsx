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
  sourceExperienceId: string;
  initialTitle: string;
  initialPrompt: string;
  /** Called when an unauthenticated user clicks the sign-in CTA. Host should
      open the wallet drawer (or whatever sign-in surface is appropriate). */
  onSignInRequest?: () => void;
}

export function RuntimeCapsuleRemixEditor({
  personaId,
  sourceExperienceId,
  initialTitle,
  initialPrompt,
  onSignInRequest,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-amber-400/25 bg-slate-900/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">Community</div>
          <div className="text-sm font-medium text-white">Remix as article or story</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/20"
          title={open ? "Close the remix editor" : "Remix this experience as your own article or story"}
        >
          {open ? <XIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {open ? "Close editor" : "Remix"}
        </button>
      </div>

      {open ? (
        <RemixDialog
          variant="inline"
          open={true}
          personaId={personaId}
          sourceExperienceId={sourceExperienceId}
          initialTitle={initialTitle}
          initialPrompt={initialPrompt}
          onClose={() => setOpen(false)}
          onSignInRequest={onSignInRequest}
        />
      ) : null}
    </div>
  );
}

export default RuntimeCapsuleRemixEditor;
