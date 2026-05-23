"use client";

/**
 * InviteModal — canonical "invite a persona to this entity" surface.
 *
 * Replaces the inline InviteBar in MyCanvasTab (which was lifted-state
 * + raw input) with a self-contained, reusable modal that:
 *
 *   • Accepts T1 identifiers (handles, FIO handles, did:iq, persona
 *     UUIDs, EVM addresses) — server-side resolution to persona_id
 *     happens in the endpoint so persona_id never travels in browser
 *     JSON.
 *   • Lets the inviter pick a role (viewer / commenter).
 *   • Styled to match aigentMe + remix modal chrome (slate-900/95,
 *     border-white/10, amber accent on primary actions).
 *
 * Endpoint contract (POSTed via personaFetch):
 *   body: { invitedHandle: string, role: 'viewer' | 'commenter' }
 *   200:  { invite: { id, ... } }
 *   404:  { error: '... couldn\'t resolve ...' }   — show inline
 *   401:  { error: 'unauthenticated' }              — sign-in needed
 *
 * Wired to SmartContentActionContext.executeAction('invite', item) in
 * Step 4 of the share/invite consolidation. Direct callers can mount
 * it themselves with isOpen / onClose state.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

export interface InviteModalEntity {
  /** Stable id used for display only; the endpoint path encodes the
      target id, so this is just so the user knows what they're
      inviting to. */
  id: string;
  title: string;
  /** Free-form label shown above the title — 'Canvas entry',
      'Remix', 'Article' etc. */
  kind?: string;
}

export interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: InviteModalEntity;
  /** POST endpoint that accepts `{ invitedHandle, role }`. */
  endpointPath: string;
  /** personaIdHint forwarded to personaFetch for the request hint chain. */
  personaId?: string | null;
  /** Fired after a successful invite — host can refresh its own UI. */
  onInvited?: (invite: { id: string; role: string }) => void;
}

export function InviteModal({
  isOpen,
  onClose,
  entity,
  endpointPath,
  personaId,
  onInvited,
}: InviteModalProps) {
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"viewer" | "commenter">("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setHandle("");
    setRole("viewer");
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  }, [isOpen]);

  const submit = useCallback(async () => {
    const trimmed = handle.trim();
    if (!trimmed) {
      setError("Enter a handle, FIO address, did:iq:<id>, persona UUID, or 0x address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await personaFetch(endpointPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitedHandle: trimmed, role }),
        personaIdHint: personaId ?? undefined,
      });
      let body: { invite?: { id: string }; error?: string };
      try { body = (await res.json()) as typeof body; }
      catch { body = {}; }
      if (!res.ok) {
        setError(body.error || `Invite failed (${res.status})`);
        return;
      }
      setSuccess(`Invited as ${role}.`);
      onInvited?.({ id: body.invite?.id ?? "", role });
      setHandle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  }, [endpointPath, handle, role, personaId, onInvited]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
        {/* Header — same chrome as RemixDialog modal variant */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <UserPlus className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 truncate">
              Invite to {entity.kind ? `${entity.kind} · ` : ""}{entity.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Invitee
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) { e.preventDefault(); void submit(); }
              }}
              placeholder="@handle · name@fio-domain · did:iq:… · 0x… · persona UUID"
              disabled={submitting}
              className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-400/40 focus:outline-none disabled:opacity-60"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Persona is resolved server-side — their UUID never travels through your browser.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
              Role
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setRole("viewer")}
                disabled={submitting}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  role === "viewer"
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                Viewer
              </button>
              <button
                type="button"
                onClick={() => setRole("commenter")}
                disabled={submitting}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  role === "commenter"
                    ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                Commenter
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-4 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {success ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !handle.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
          >
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Inviting…</>
            ) : (
              <><UserPlus className="h-3.5 w-3.5" /> Send invite</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteModal;
