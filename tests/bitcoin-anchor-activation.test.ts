/**
 * Permanent activation canary for the PoS/BTC constitutional leg.
 *
 * A4 provenance and CAP-1 are independent gates. Provenance is now closed for
 * the newly deployed v2 canisters, but CAP-1 is parked at an external substrate
 * blocker. The submission switch must therefore remain dark even though A4 is
 * green.
 */

import { describe, it, expect } from 'vitest';
import { POS_LEG_SUBMISSION_ENABLED } from '@/services/dvn/activityReceiptDvnPipeline';
import {
  CAP1_ACTIVATION_EVIDENCE,
  bitcoinAnchorActivationBlockers,
  bitcoinAnchorActivationReady,
} from '@/services/ops/bitcoinAnchorActivation';
import {
  activationProvenanceBlockers,
  canisterSourceFor,
} from '@/services/ops/canisterSourceManifest';

describe('Bitcoin anchor activation gate', () => {
  it('closes A4 provenance for the CAP-1 v2 deployment', () => {
    expect(activationProvenanceBlockers()).toEqual([]);

    const pos = canisterSourceFor('cz7nu-zyaaa-aaaao-qqavq-cai');
    const signer = canisterSourceFor('c66la-uaaaa-aaaao-qqava-cai');
    expect(pos?.name).toBe('proof_of_state_v2');
    expect(signer?.name).toBe('btc_signer_psbt');
    expect(pos?.moduleHashVerifiedAgainstSource).toBe(pos?.deployedModuleHash);
    expect(pos?.deploymentArtifactHashVerified).toBe(pos?.deployedModuleHash);
    expect(signer?.moduleHashVerifiedAgainstSource).toBe(signer?.deployedModuleHash);
    expect(signer?.deploymentArtifactHashVerified).toBe(signer?.deployedModuleHash);
  });

  it('keeps CAP-1 explicitly blocked on the stale IC Bitcoin Testnet evidence horizon', () => {
    expect(CAP1_ACTIVATION_EVIDENCE.status).toBe('blocked_external_substrate');
    expect(CAP1_ACTIVATION_EVIDENCE.anchorTxid).toBeNull();
    expect(CAP1_ACTIVATION_EVIDENCE.anchorBlockHeight).toBeNull();
    expect(CAP1_ACTIVATION_EVIDENCE.lastObservedIcBitcoinTip).toBeLessThan(
      CAP1_ACTIVATION_EVIDENCE.fundingBlockHeight,
    );
    expect(CAP1_ACTIVATION_EVIDENCE.lastObservedExternalTip).toBeGreaterThanOrEqual(
      CAP1_ACTIVATION_EVIDENCE.fundingBlockHeight,
    );
    expect(CAP1_ACTIVATION_EVIDENCE.rootHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not permit the submission switch to outrun the complete activation gate', () => {
    expect(bitcoinAnchorActivationBlockers()).toEqual(['cap1:blocked_external_substrate']);
    expect(bitcoinAnchorActivationReady()).toBe(false);
    if (!bitcoinAnchorActivationReady()) {
      expect(
        POS_LEG_SUBMISSION_ENABLED,
        'PoS submission is enabled before CAP-1 has independently proven H → Merkle root → real Bitcoin tx → confirmed block.',
      ).toBe(false);
    }
  });
});
