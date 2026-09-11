'use client';

/**
 * ActivePersonaControl — the shared "who is acting" chip (Journey Principal
 * Context correction, 2026-08-25).
 *
 * Extracted from the visual/behavioral contract CodexPanelDynamic's header
 * badge already establishes (app/triad/components/CodexPanelDynamic.tsx —
 * the `UserCircle2` + "Welcome, {persona}" control): canonical active-persona
 * resolution via `useActivePersona()` (T1 surface, never a UUID fallback),
 * a compact bordered chip, and a click that opens the EXISTING
 * `SmartWalletDrawer` (`variant="overlay"`, `initialTab="wallet"`) so the
 * operator can switch persona from the same wallet experience everywhere.
 *
 * This is a NEW, self-contained mount — not a refactor of CodexPanelDynamic
 * itself. CodexPanelDynamic's own badge/drawer wiring is intertwined with a
 * SECOND concern (wallet-surface deep-link requests sharing the same
 * `walletDrawerOpen` boolean) that a blind extraction would risk
 * destabilizing in a file CLAUDE.md already documents as having a history of
 * subtle regressions (the MS-* Companion Menu invariants). Composing this
 * component INTO CodexPanelDynamic is a follow-on, not bundled here — this
 * file reuses the same resolver and the same wallet component so there is
 * still only ONE persona resolver and ONE wallet implementation in the
 * system; only the chip's JSX has a second, small, deliberately parallel
 * mount for a host (JourneyRunSurface) that never had one before.
 *
 * Constitutional distinction (operator direction, 2026-08-25): the active
 * persona is always a fact we can show. "Principal" is an authority
 * relationship a Journey/authority projection must actually establish before
 * it is stated. This control's default copy is "Acting as {label}" — never
 * "Principal" — so callers opt into that stronger word only once they have
 * resolved it.
 *
 * MS-9 (a control that cannot act must not render): renders nothing when no
 * active persona is resolved, rather than an inert "Acting as —" chip.
 */

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { UserCircle2 } from 'lucide-react';
import { useActivePersona } from '@/app/hooks/useActivePersona';

const SmartWalletDrawer = dynamic(() => import('@/app/components/content/SmartWalletDrawer'), { ssr: false });

export interface ActivePersonaControlProps {
  /** Best-known personaId hint, threaded to the wallet drawer so it opens on the right persona context. */
  personaId?: string;
  /** Identifies the calling surface to the wallet's "set as default for this cartridge/journey" option. */
  cartridgeSlug: string;
  /** Copy prefix before the resolved label. Defaults to the Journey-grammar phrasing; never "Principal" by default. */
  labelPrefix?: string;
  /**
   * Fired with the new personaId after the wallet reports a persona switch.
   * The caller is responsible for propagating it into its own effective-
   * persona state (and, where relevant, the existing PersonaContext seam) —
   * this control never mutates anything outside itself.
   */
  onPersonaChange?: (newPersonaId: string) => void;
  /** Tighter padding for compact/one-row Journey headers. Defaults to false (Refresh/Evidence/Full screen's own sizing). */
  compact?: boolean;
}

export function ActivePersonaControl({
  personaId,
  cartridgeSlug,
  labelPrefix = 'Acting as',
  onPersonaChange,
  compact = false,
}: ActivePersonaControlProps) {
  // Canonical T1 surface — same source CodexPanelDynamic's header badge
  // reads (displayLabel, then own FIO handle, never a UUID fallback).
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const label =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    null;

  const [walletOpen, setWalletOpen] = useState(false);

  const handlePersonaChange = useCallback(
    (newPersonaId: string) => {
      onPersonaChange?.(newPersonaId);
    },
    [onPersonaChange],
  );

  // MS-9 — no active persona resolved yet (or ever) means no inert badge.
  if (!label) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setWalletOpen(true)}
        title="Active persona — open wallet to switch persona"
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-slate-200 ${
          compact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
        } text-[11px]`}
      >
        <UserCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[40vw] truncate md:max-w-[16rem]">
          {labelPrefix} {label}
        </span>
      </button>
      {walletOpen && (
        <SmartWalletDrawer
          open={walletOpen}
          onClose={() => setWalletOpen(false)}
          variant="overlay"
          initialTab="wallet"
          personaId={personaId}
          onPersonaChange={handlePersonaChange}
          cartridgeSlug={cartridgeSlug}
          agent={{ id: personaId ?? cartridgeSlug, name: label }}
        />
      )}
    </>
  );
}

export default ActivePersonaControl;
