'use client';

/**
 * WorldIdButton — production World ID verification entry point.
 *
 * Wraps @worldcoin/idkit's IDKitWidget to mount a real Worldcoin
 * verification modal. When the user completes orb or device
 * verification, the success callback receives a real proof bundle
 * (proof, merkle_root, nullifier_hash, verification_level) which the
 * caller forwards to POST /api/polity-passport/verify-worldid.
 *
 * The button degrades gracefully when NEXT_PUBLIC_WORLD_ID_APP_ID is
 * unset — it falls back to a dev-worldid-orb token that the server-side
 * verifyWorldIdProof accepts in dev mode. This keeps the demo path
 * working in local sandboxes that haven't been provisioned with a
 * Worldcoin app id yet.
 *
 * Per 2026-06-13 hackathon plan §Sprint 2 — production wiring.
 */

import React, { useCallback, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { IDKitWidget, type ISuccessResult, VerificationLevel } from '@worldcoin/idkit';

export interface WorldIdProofBundle {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level: 'orb' | 'device';
  /**
   * The signal the proof was generated against (2026-07-19 fix). When the
   * widget is given a `signal` prop, IDKit bakes hashToField(signal) into
   * the proof's public inputs — the server MUST send the matching
   * signal_hash to the Cloud Verifier or the proof is rejected. Threading
   * it through the bundle is what makes that possible.
   */
  signal?: string;
}

interface Props {
  /** Called with the verified proof bundle ready to POST to verify-worldid. */
  onProof: (proof: WorldIdProofBundle) => void | Promise<void>;
  /** Optional className override for the button. */
  className?: string;
  /** Override the IDKit action — defaults to NEXT_PUBLIC_WORLD_ID_ACTION_ID or 'polity-passport-verify'. */
  action?: string;
  /** Optional signal — opaque per-request data bound to the proof. */
  signal?: string;
  /** Display label override. */
  label?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Busy/loading state. */
  busy?: boolean;
  /**
   * Minimum verification level. `VerificationLevel.Device` (default) accepts a
   * device OR orb proof — device is the lower grade, orb the higher. Pass
   * `VerificationLevel.Orb` to require orb-only. The server records which level
   * the proof actually carried, so grade follows the proof.
   */
  minVerificationLevel?: VerificationLevel;
}

const PUBLIC_APP_ID = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID;
const PUBLIC_ACTION_ID = process.env.NEXT_PUBLIC_WORLD_ID_ACTION_ID ?? 'polity-passport-verify';

export function WorldIdButton({
  onProof,
  className,
  action,
  signal,
  label = 'Verify with World ID',
  disabled,
  busy,
  minVerificationLevel = VerificationLevel.Device,
}: Props) {
  const [internalBusy, setInternalBusy] = useState(false);
  const isBusy = busy || internalBusy;

  const handleDevFallback = useCallback(async () => {
    setInternalBusy(true);
    try {
      const devProof: WorldIdProofBundle = {
        proof: 'dev-worldid-orb',
        merkle_root: '0x0',
        nullifier_hash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64)}`,
        verification_level: 'orb',
        ...(signal ? { signal } : {}),
      };
      await onProof(devProof);
    } finally {
      setInternalBusy(false);
    }
  }, [onProof, signal]);

  const handleSuccess = useCallback(
    async (result: ISuccessResult) => {
      setInternalBusy(true);
      try {
        const proof: WorldIdProofBundle = {
          proof: result.proof,
          merkle_root: result.merkle_root,
          nullifier_hash: result.nullifier_hash,
          verification_level: result.verification_level === VerificationLevel.Orb ? 'orb' : 'device',
          ...(signal ? { signal } : {}),
        };
        await onProof(proof);
      } finally {
        setInternalBusy(false);
      }
    },
    [onProof, signal],
  );

  // Dev fallback path — no app id configured. Server-side verifyWorldIdProof
  // accepts dev-worldid-* tokens in this mode.
  if (!PUBLIC_APP_ID) {
    return (
      <button
        type="button"
        onClick={() => void handleDevFallback()}
        disabled={disabled || isBusy}
        className={
          className ??
          'flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-50'
        }
        title="Strongly verify this passport with World ID (dev fallback — set NEXT_PUBLIC_WORLD_ID_APP_ID for production)"
      >
        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
        {isBusy ? 'Verifying…' : label}
      </button>
    );
  }

  // Production path — mount the real IDKitWidget. Per @worldcoin/idkit docs,
  // the widget renders a render-prop child that exposes `open()` to trigger
  // the verification modal.
  return (
    <IDKitWidget
      app_id={PUBLIC_APP_ID as `app_${string}`}
      action={action ?? PUBLIC_ACTION_ID}
      signal={signal}
      verification_level={minVerificationLevel}
      onSuccess={handleSuccess}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={open}
          disabled={disabled || isBusy}
          className={
            className ??
            'flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-50'
          }
          title="Strongly verify this passport with World ID"
        >
          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          {isBusy ? 'Verifying…' : label}
        </button>
      )}
    </IDKitWidget>
  );
}
