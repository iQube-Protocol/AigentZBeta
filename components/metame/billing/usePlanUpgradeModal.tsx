'use client';

/**
 * usePlanUpgradeModal — a one-line, reusable upgrade-modal trigger.
 *
 * Upgrade moments appear across many journeys (Founder Office locked state,
 * the Activations catalogue, Standing tab, experience-model caps, and inline
 * chips). Rather than each surface re-implementing modal state, this hook
 * owns the open/close state and renders the modal, exposing a single
 * `openUpgrade()` trigger any button or chip can call.
 *
 * Usage:
 *   const { openUpgrade, upgradeModal } = usePlanUpgradeModal({ personaId });
 *   // somewhere in JSX (rendered once): {upgradeModal}
 *   // any trigger: <button onClick={() => openUpgrade()}>Upgrade</button>
 *   // tier-scoped:  openUpgrade({ tiers: ['venture_lite'], defaultTierKey: 'venture_lite' })
 */

import { useCallback, useMemo, useState } from 'react';
import { PlanUpgradeModal, type PlanTierKey } from './PlanUpgradeModal';

export interface OpenUpgradeOptions {
  tiers?: PlanTierKey[];
  defaultTierKey?: PlanTierKey;
}

export interface UsePlanUpgradeModalArgs {
  personaId?: string;
  onUpgraded?: (tierKey: PlanTierKey) => void;
}

export function usePlanUpgradeModal({ personaId, onUpgraded }: UsePlanUpgradeModalArgs) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<OpenUpgradeOptions>({});

  const openUpgrade = useCallback((next?: OpenUpgradeOptions) => {
    setOpts(next ?? {});
    setOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => setOpen(false), []);

  const upgradeModal = useMemo(
    () => (
      <PlanUpgradeModal
        open={open}
        personaId={personaId}
        tiers={opts.tiers}
        defaultTierKey={opts.defaultTierKey}
        onClose={closeUpgrade}
        onUpgraded={(tierKey) => {
          setOpen(false);
          onUpgraded?.(tierKey);
        }}
      />
    ),
    [open, personaId, opts, closeUpgrade, onUpgraded],
  );

  return { openUpgrade, closeUpgrade, upgradeModal, isUpgradeOpen: open };
}
