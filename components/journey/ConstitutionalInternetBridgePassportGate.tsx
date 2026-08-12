'use client';

/**
 * ConstitutionalInternetBridgePassportGate — CI's indigo preset of the
 * bridge-neutral BridgePassportGate (extracted 2026-08-12, KNYTS↔CI parity
 * pass). This file exists only so CI's existing import path and visible
 * output (indigo accent, the original CI copy) stay byte-for-byte
 * unchanged — all actual rendering lives in BridgePassportGate.tsx, which
 * KNYTS's page now also mounts directly with `accent="amber"` and its own
 * Remix/Stand-appropriate copy.
 */

import React from 'react';
import { BridgePassportGate } from '@/components/journey/BridgePassportGate';

interface ConstitutionalInternetBridgePassportGateProps {
  isOpen: boolean;
  onDismiss: () => void;
  onProceedToPassport: () => void;
  dismissLabel?: string;
}

export function ConstitutionalInternetBridgePassportGate(props: ConstitutionalInternetBridgePassportGateProps) {
  return <BridgePassportGate {...props} accent="indigo" />;
}

export default ConstitutionalInternetBridgePassportGate;
