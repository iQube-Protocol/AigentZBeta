/**
 * Permanent activation canary for the PoS/BTC constitutional leg.
 *
 * A4 provenance and CAP-1 are independent gates. A4's deployment-artifact
 * sub-claim is independently confirmed for the newly deployed v2 canisters,
 * but its source-rebuild sub-claim is not reproducible (see
 * canisterSourceManifest.ts's observedCaveats — no pinned toolchain in
 * iQubeBeta-Program). CAP-1 is separately parked at an external substrate
 * blocker. The submission switch must remain dark on either ground alone,
 * and both currently apply.
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
  it('confirms the deployment-artifact A4 sub-claim but not the source-rebuild sub-claim, for both CAP-1 v2 canisters', () => {
    expect(activationProvenanceBlockers().map((e) => e.name).sort()).toEqual([
      'btc_signer_psbt',
      'proof_of_state_v2',
    ]);

    const pos = canisterSourceFor('cz7nu-zyaaa-aaaao-qqavq-cai');
    const signer = canisterSourceFor('c66la-uaaaa-aaaao-qqava-cai');
    expect(pos?.name).toBe('proof_of_state_v2');
    expect(signer?.name).toBe('btc_signer_psbt');
    expect(pos?.deploymentArtifactHashVerified).toBe(pos?.deployedModuleHash);
    expect(pos?.moduleHashVerifiedAgainstSource).toBeNull();
    expect(signer?.deploymentArtifactHashVerified).toBe(signer?.deployedModuleHash);
    expect(signer?.moduleHashVerifiedAgainstSource).toBeNull();
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
    expect(bitcoinAnchorActivationBlockers()).toEqual([
      'provenance:proof_of_state_v2',
      'provenance:btc_signer_psbt',
      'cap1:blocked_external_substrate',
    ]);
    expect(bitcoinAnchorActivationReady()).toBe(false);
    if (!bitcoinAnchorActivationReady()) {
      expect(
        POS_LEG_SUBMISSION_ENABLED,
        'PoS submission is enabled before CAP-1 has independently proven H → Merkle root → real Bitcoin tx → confirmed block.',
      ).toBe(false);
    }
  });
});
