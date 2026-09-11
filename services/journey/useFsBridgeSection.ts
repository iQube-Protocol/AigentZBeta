'use client';

/**
 * useFsBridgeSection — client hook reading one CFS stage's admin-editable
 * headline/shortCopy/infographicUrl via the EXISTING, already-public GET
 * /api/journey/knyts-bridge/editorial-config route (same plain `fetch`
 * pattern KnytsBridgeMediaStage.tsx already uses for `home`/`orient` — GET
 * is deliberately unauthenticated so a visitor's first paint never blocks on
 * a session). Never a second reader path — `fsBridgeSectionKey` is the same
 * helper the admin panel and the allow-list both use, so this can never ask
 * for a section the backend doesn't recognise.
 */

import { useEffect, useState } from 'react';
import { fsBridgeSectionKey, fsLearnPlateSectionKey, type FsStageId } from '@/services/journey/knytsBridgeEditorialConfig';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';

export function useFsBridgeSection(bridge: 'ci' | 'knyts', stage: FsStageId): KnytsBridgeEditorialSection | null {
  return useBridgeEditorialSection(fsBridgeSectionKey(bridge, stage));
}

/** Learn's three plates — plateIndex 0 reuses the plain fs-learn section, 1/2 use their own extra sections. */
export function useFsLearnPlateSection(bridge: 'ci' | 'knyts', plateIndex: 0 | 1 | 2): KnytsBridgeEditorialSection | null {
  return useBridgeEditorialSection(fsLearnPlateSectionKey(bridge, plateIndex));
}

function useBridgeEditorialSection(section: string): KnytsBridgeEditorialSection | null {
  const [config, setConfig] = useState<KnytsBridgeEditorialSection | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${encodeURIComponent(section)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.ok) setConfig(json.config as KnytsBridgeEditorialSection);
      })
      .catch(() => {
        /* non-fatal — the calling component falls back to its own static copy */
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  return config;
}
