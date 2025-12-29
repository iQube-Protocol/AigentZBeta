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

// Placeholder - will be replaced with ported SmartWallet component
function SmartWalletPanel() {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';
  const density = searchParams.get('density') || 'wide';

  return (
    <div className="flex flex-col h-full w-full p-4">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">SmartWallet Embed</h1>
          <p className="text-slate-300">Theme: {theme} | Density: {density}</p>
          <p className="text-slate-400 text-sm">Component porting in progress...</p>
        </div>
      </div>
    </div>
  );
}

export default function WalletEmbedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <SmartWalletPanel />
    </Suspense>
  );
}
