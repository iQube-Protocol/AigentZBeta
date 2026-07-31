'use client';

/**
 * usePlanUpgradeModal — unified upgrade-modal trigger with smart routing.
 *
 * Two modals live under this hook:
 *   CitizenLadderModal  — sovereign_citizen / steward (3-column comparison)
 *   PlanUpgradeModal    — venture_lite / venture_pro / venture_elite (FO)
 *
 * Smart routing: openUpgrade({ defaultTierKey: 'sovereign_citizen' }) routes to
 * the CitizenLadder automatically; FO tiers go to the FO modal. Callers that
 * know which modal they want can use openCitizenUpgrade() or openFoUpgrade()
 * directly.
 *
 * Usage:
 *   const { openUpgrade, upgradeModal } = usePlanUpgradeModal({ personaId });
 *   // rendered once in host: {upgradeModal}
 *   // trigger from any button: openUpgrade({ defaultTierKey: 'sovereign_citizen' })
 */

import { useCallback, useMemo, useState } from 'react';
import { PlanUpgradeModal, type PlanTierKey } from './PlanUpgradeModal';
import { CitizenLadderModal, type CitizenTierKey } from './CitizenLadderModal';

export interface OpenUpgradeOptions {
  tiers?: PlanTierKey[];
  defaultTierKey?: PlanTierKey;
}

export interface OpenCitizenUpgradeOptions {
  defaultTierKey?: CitizenTierKey;
}

const CITIZEN_TIERS = new Set<PlanTierKey>(['sovereign_citizen', 'steward']);

export interface UsePlanUpgradeModalArgs {
  personaId?: string;
  onUpgraded?: (tierKey: PlanTierKey) => void;
}

export function usePlanUpgradeModal({ personaId, onUpgraded }: UsePlanUpgradeModalArgs) {
  // Founder Office modal state
  const [foOpen, setFoOpen] = useState(false);
  const [foOpts, setFoOpts] = useState<OpenUpgradeOptions>({});

  // Citizen ladder modal state
  const [citizenOpen, setCitizenOpen] = useState(false);
  const [citizenOpts, setCitizenOpts] = useState<OpenCitizenUpgradeOptions>({});

  const openCitizenUpgrade = useCallback((next?: OpenCitizenUpgradeOptions) => {
    setCitizenOpts(next ?? {});
    setCitizenOpen(true);
  }, []);

  const openFoUpgrade = useCallback((next?: OpenUpgradeOptions) => {
    setFoOpts(next ?? {});
    setFoOpen(true);
  }, []);

  // Smart router: citizen tiers → CitizenLadderModal; FO tiers → FO modal.
  const openUpgrade = useCallback(
    (next?: OpenUpgradeOptions) => {
      const tier = next?.defaultTierKey ?? next?.tiers?.[0];
      if (tier && CITIZEN_TIERS.has(tier)) {
        openCitizenUpgrade({ defaultTierKey: tier as CitizenTierKey });
      } else {
        openFoUpgrade(next);
      }
    },
    [openCitizenUpgrade, openFoUpgrade],
  );

  const closeUpgrade = useCallback(() => {
    setFoOpen(false);
    setCitizenOpen(false);
  }, []);

  const handleUpgraded = useCallback(
    (tierKey: PlanTierKey) => {
      setFoOpen(false);
      setCitizenOpen(false);
      onUpgraded?.(tierKey);
    },
    [onUpgraded],
  );

  // Renders both modals — host just mounts {upgradeModal} once.
  const upgradeModal = useMemo(
    () => (
      <>
        <CitizenLadderModal
          open={citizenOpen}
          personaId={personaId}
          defaultTierKey={citizenOpts.defaultTierKey}
          onClose={() => setCitizenOpen(false)}
          onUpgraded={handleUpgraded}
        />
        <PlanUpgradeModal
          open={foOpen}
          personaId={personaId}
          tiers={foOpts.tiers}
          defaultTierKey={foOpts.defaultTierKey}
          onClose={() => setFoOpen(false)}
          onUpgraded={handleUpgraded}
        />
      </>
    ),
    [citizenOpen, foOpen, personaId, citizenOpts, foOpts, handleUpgraded],
  );

  return {
    openUpgrade,
    openCitizenUpgrade,
    openFoUpgrade,
    closeUpgrade,
    upgradeModal,
    isUpgradeOpen: foOpen || citizenOpen,
  };
}
