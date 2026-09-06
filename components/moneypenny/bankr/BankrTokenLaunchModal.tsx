"use client";

/**
 * BankrTokenLaunchModal — the modal host context for BankrTokenLaunchCapsule
 * (Factor + Aegis Bankr PRD, Phase 6 frontend half). Reuses the existing
 * Dialog primitive (components/ui/dialog.tsx) rather than inventing a new
 * modal mechanism (File and Component Discipline, CLAUDE.md). Mounts the
 * capsule at `panel` depth with its own toggle hidden — the modal's own
 * open/close IS the presentation control here, not the capsule's internal
 * compact/expanded toggle.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BankrTokenLaunchCapsule, type BankrTokenLaunchCapsuleProps } from "./BankrTokenLaunchCapsule";

interface Props extends BankrTokenLaunchCapsuleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankrTokenLaunchModal({ open, onOpenChange, ...capsuleProps }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Bankr tokenization</DialogTitle>
        </DialogHeader>
        <BankrTokenLaunchCapsule {...capsuleProps} initialPresentation="panel" hideToggle />
      </DialogContent>
    </Dialog>
  );
}

export default BankrTokenLaunchModal;
