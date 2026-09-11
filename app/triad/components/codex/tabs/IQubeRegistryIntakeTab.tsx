'use client';

/**
 * IQubeRegistryIntakeTab — cartridge mount for the Ingestion Factory.
 *
 * Phase C C4. The Ingestion Factory previously lived only on the legacy
 * /registry page (rendered by RegistryHome via the Factory tab). Lift
 * pattern (same as C1 modal lift): host the canonical surface in the
 * cartridge so both /registry and the cartridge Intake tab mount the
 * SAME IngestionFactoryPanel component. Legacy mount stays during the
 * Phase C observation window for parity; retirement is C5 cleanup.
 *
 * Authority: passes through — the panel reads its own canonical APIs.
 */

import React from 'react';
import { Factory } from 'lucide-react';
import { IngestionFactoryPanel } from '@/components/registry/IngestionFactoryPanel';

export function IQubeRegistryIntakeTab() {
  return (
    <div className="p-6 space-y-4">
      <header>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Factory className="w-5 h-5 text-violet-400" />
          Ingestion Factory
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Canonical intake surface. Submitted records land in
          {' '}
          <code className="text-violet-300">iqube_id_map</code>
          {' '}
          and progress through the canonization queue (Stage 3).
        </p>
      </header>
      <IngestionFactoryPanel />
    </div>
  );
}
