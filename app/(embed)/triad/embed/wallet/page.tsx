/**
 * SmartWallet Embed Page
 * 
 * Full-panel SmartWallet for iframe embedding.
 * Query params:
 * - theme: 'light' | 'dark' (optional)
 * - density: 'narrow' | 'wide' (optional)
 */

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SmartWalletPanel from "../../../../triad/components/SmartWalletPanel";

function SmartWalletContent() {
  const searchParams = useSearchParams();
  const theme = (searchParams.get('theme') as 'light' | 'dark') || 'dark';
  const density = (searchParams.get('density') as 'narrow' | 'wide') || 'wide';

  return <SmartWalletPanel theme={theme} density={density} />;
}

export default function WalletEmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="text-white">Loading SmartWallet...</div>
      </div>
    }>
      <SmartWalletContent />
    </Suspense>
  );
}
