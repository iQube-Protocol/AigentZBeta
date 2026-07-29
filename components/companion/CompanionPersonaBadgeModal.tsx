/**
 * CompanionPersonaBadgeModal — the Companion header badge's compact persona
 * switcher (2026-07-29, operator-directed).
 *
 * REUSE, NOT REINVENTION: this mounts the SAME data hooks the wallet's own
 * persona chooser (`SmartWalletDrawer`'s header dropdown) already uses —
 * `useSupabaseSessionPersonas` for the persona list and `PersonaEditModal`
 * for editing — so there is one authoritative persona list and one editor,
 * never a second implementation (CLAUDE.md "Extend, Don't Duplicate" /
 * inv.engineering.036-037). It does NOT import or modify
 * `app/components/content/SmartWalletDrawer.tsx` — that file is scoped to a
 * concurrent session's balance/currency work this pass must not touch.
 *
 * ICON CONVENTION — matches SmartWalletDrawer's persona row EXACTLY: amber
 * Bot for agent personas, cyan User for human personas, and the same amber
 * Star + "aigentMe" pill for the citizen's delegated agent persona
 * (`appOrigin === 'aigent-me'`). Repeating a different color pair here would
 * break the one visual convention the operator asked to carry over.
 *
 * SCOPE: this is a SLICE of the wallet's chooser — the persona list +
 * edit-active-persona affordance — not the full wallet. Selecting a persona
 * only reports the choice upward (`onSelectPersona`); the host (the
 * Companion embed page) is the one place that actually flips the active
 * persona (localStorage/PersonaContext/dispatch), exactly as
 * `SmartWalletDrawer`'s own `switchToPersona`/`engageAigentMe` do, so every
 * surface listening for that change (spine reads, other embeds) agrees.
 *
 * Styling: canonical SLATE house style for this NEW chrome — `border-slate-800`
 * / `bg-slate-900/40` panels, no white hairlines, no white inset highlight
 * (CLAUDE.md "Canonical Surface Styling").
 */

"use client";

import { useMemo, useState } from "react";
import { Bot, User, Star, X, Settings, Loader2, Check } from "lucide-react";

import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";
import { PersonaEditModal } from "@/app/components/wallet/PersonaEditModal";
import type { PersonaState } from "@/types/smartWallet";

export interface CompanionPersonaBadgeModalProps {
  open: boolean;
  onClose: () => void;
  /** The Companion's currently active persona id, if resolved. */
  activePersonaId: string | null;
  /** Fires when the citizen picks a row. The host owns the actual switch. */
  onSelectPersona: (persona: PersonaState) => void;
}

export function CompanionPersonaBadgeModal({
  open,
  onClose,
  activePersonaId,
  onSelectPersona,
}: CompanionPersonaBadgeModalProps) {
  const { sessionEmail, sessionPersonas, isLoading, refreshPersonas } = useSupabaseSessionPersonas();
  const [editingPersona, setEditingPersona] = useState<PersonaState | null>(null);

  const activePersona = useMemo(
    () => sessionPersonas.find((p) => p.id === activePersonaId) ?? null,
    [sessionPersonas, activePersonaId],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-xs overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-label="Switch persona"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Switch persona
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
          ) : !sessionEmail || sessionPersonas.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-500">
              No personas found for this account yet.
            </div>
          ) : (
            sessionPersonas.map((persona) => {
              const isAigentMePersona = persona.appOrigin === "aigent-me";
              const isActive = activePersonaId === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onSelectPersona(persona)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-slate-800/60" : "hover:bg-slate-800/40"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      persona.isAgent ? "bg-amber-500/20" : "bg-cyan-500/20"
                    }`}
                  >
                    {persona.isAgent ? (
                      <Bot className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm text-slate-100">
                      <span className="truncate">{persona.displayName || "Persona"}</span>
                      {isAigentMePersona && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-medium text-amber-300">
                          <Star className="h-2.5 w-2.5" aria-hidden="true" /> aigentMe
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {isAigentMePersona
                        ? isActive
                          ? "Delegate · engaged"
                          : "Your delegate · tap to engage"
                        : persona.fioHandle || "No handle"}
                    </span>
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>

        {activePersona ? (
          <div className="border-t border-slate-800 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setEditingPersona(activePersona)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-cyan-400 transition-colors hover:bg-slate-800/40"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Edit persona
            </button>
          </div>
        ) : null}
      </div>

      {editingPersona && (
        <PersonaEditModal
          isOpen
          onClose={() => setEditingPersona(null)}
          persona={{
            id: editingPersona.id,
            fioHandle: editingPersona.fioHandle,
            displayName: editingPersona.displayName,
            reputationScore: editingPersona.reputationScore,
          }}
          onSave={() => {
            setEditingPersona(null);
            void refreshPersonas();
          }}
        />
      )}
    </div>
  );
}

export default CompanionPersonaBadgeModal;
