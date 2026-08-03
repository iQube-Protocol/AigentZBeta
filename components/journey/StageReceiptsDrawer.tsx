'use client';

/**
 * StageReceiptsDrawer — Guided Journey Runtime evidence chain (deferred
 * item from PRD-GJR-001's Register/Verify/Claim rows, built 2026-07-31 now
 * that all three stages write real receipts). Collapsed by default so the
 * stage viewport isn't dominated by receipt chrome; fetches on first
 * expand, never eagerly for every stage on every render.
 *
 * Reuses ActivityReceiptCard (components/metame/cards/ActivityReceiptCard.tsx)
 * exactly — the same render contract every other receipt surface in the
 * platform uses, never a second receipt-rendering component.
 */

import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Receipt as ReceiptIcon, Loader2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { ActivityReceiptCard, type ActivityReceiptData } from '@/components/metame/cards/ActivityReceiptCard';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';

interface StageReceiptsDrawerProps {
  receiptTypes: readonly string[];
}

export function StageReceiptsDrawer({ receiptTypes }: StageReceiptsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [receipts, setReceipts] = useState<ActivityReceiptData[]>([]);
  const [personaLabel, setPersonaLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (receiptTypes.length === 0) return;
    setLoading(true);
    try {
      const res = await personaFetch(
        `/api/assistant/receipts?actionType=${encodeURIComponent(receiptTypes.join(','))}&limit=20`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await readJsonOrExplain(res, 'journey/receipts');
        setReceipts(Array.isArray(json.receipts) ? json.receipts : []);
        setPersonaLabel(json.personaDisplayLabel ?? null);
      }
    } catch {
      // Soft-fail — the drawer still opens, showing "no receipts" honestly.
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [receiptTypes]);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
    if (!loaded) void load();
  }, [loaded, load]);

  if (receiptTypes.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-400 transition-colors hover:text-slate-200"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <ReceiptIcon className="h-3.5 w-3.5" />
        Evidence receipts{loaded && receipts.length > 0 ? ` (${receipts.length})` : ''}
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-800 p-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading receipts…
            </div>
          ) : receipts.length === 0 ? (
            <p className="text-xs text-slate-500">No receipts recorded for this stage yet.</p>
          ) : (
            receipts.map((r) => <ActivityReceiptCard key={r.id} data={r} personaDisplayLabel={personaLabel} theme="dark" />)
          )}
        </div>
      )}
    </div>
  );
}

export default StageReceiptsDrawer;
