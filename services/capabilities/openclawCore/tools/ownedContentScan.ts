/**
 * owned-content-scan tool — real implementation.
 *
 * Calls `getOwnedAssetIds(personaId, series)` and returns a summary of
 * what the persona owns. Needs T0 (`personaId`) so declares
 * `needsServerContext: true` — the adapter refuses to dispatch if
 * the side-channel is missing (e.g. a future sidecar adapter).
 *
 * Input:
 *   { series?: string }   default 'metaKnyts'
 *
 * Output summary example:
 *   'owned-content-scan: 12 direct + 28 expanded across 3 SKU(s) in metaKnyts'
 */

import { getOwnedAssetIds } from '@/services/rewards/assetOwnership';
import { registerTool } from '../registry';
import type { OpenClawToolResult } from '../types';

registerTool({
  name: 'owned-content-scan',
  description: 'Scan owned content for the active persona via the entitlements spine.',
  needsServerContext: true,
  handler: async (input, serverContext): Promise<OpenClawToolResult> => {
    if (!serverContext?.personaId) {
      return {
        ok: false,
        reason: 'server-context-required',
        detail: 'owned-content-scan needs T0 personaId via serverContext — not available out-of-process',
      };
    }
    const series = typeof input.series === 'string' && input.series.trim() ? input.series.trim() : 'metaKnyts';

    try {
      const owned = await getOwnedAssetIds(serverContext.personaId, series);
      // Receipt-safe summary: counts only, no asset ids. The full
      // payload goes into data for callers that genuinely need it.
      const summary =
        `owned-content-scan: ${owned.direct.length} direct + ${owned.expanded.length} expanded` +
        ` across ${owned.ownedSkus.length} SKU(s) in ${series}`;
      return {
        ok: true,
        data: {
          series,
          counts: {
            direct: owned.direct.length,
            expanded: owned.expanded.length,
            skus: owned.ownedSkus.length,
            expectedSlots: owned.expectedSlots.length,
          },
          // Cap the visible arrays so a wide-asset persona doesn't
          // produce a 200KB receipt. Callers needing the full list can
          // re-query the entitlements service directly.
          sampled: {
            direct: owned.direct.slice(0, 20),
            expanded: owned.expanded.slice(0, 20),
            ownedSkus: owned.ownedSkus.slice(0, 20),
          },
        },
        summary,
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'scan-failed',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
