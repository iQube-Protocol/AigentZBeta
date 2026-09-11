/**
 * SpecialistConsultModal — Home specialist-card direct-consultation surface
 * (Cartridge spec C-03 "Home | ... specialist access", specialist-surfaces
 * separation 2026-09-05, requirement 4). Wraps SpecialistWorkspace so an
 * operator can ask a question immediately from Home, without first
 * navigating to Activity or opening a case/assessment.
 *
 * "Expand to full panel" calls the SAME navigate() Home's specialist cards
 * already use (moneyPennyNavigation.tsx) and closes the modal — the
 * conversation itself is untouched (SpecialistWorkspace persists it by
 * personaId+specialistId+scopeId, identical on both sides), so expanding
 * preserves the thread rather than starting a new one.
 */

"use client";

import { X } from "lucide-react";
import { SpecialistWorkspace, type SpecialistWorkspaceProps } from "./SpecialistWorkspace";

export interface SpecialistConsultModalProps {
  open: boolean;
  onClose: () => void;
  onExpand: () => void;
  title: string;
  description: string;
  workspaceProps: Omit<SpecialistWorkspaceProps, "variant" | "onExpand">;
}

export function SpecialistConsultModal({ open, onClose, onExpand, title, description, workspaceProps }: SpecialistConsultModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SpecialistWorkspace {...workspaceProps} variant="modal" onExpand={onExpand} />
        </div>
      </div>
    </div>
  );
}

export default SpecialistConsultModal;
