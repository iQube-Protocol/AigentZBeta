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
import SmartWalletDrawer from "../../../../components/content/SmartWalletDrawer";

function SmartWalletContent() {
  const searchParams = useSearchParams();
  const theme = (searchParams.get('theme') as 'light' | 'dark') || 'dark';
  const density = (searchParams.get('density') as 'narrow' | 'wide') || 'wide';
  const personaId = searchParams.get('personaId') || undefined;

  // Sample agent data - in real embed this would come from context or params
  const agent = {
    id: "embed-agent",
    name: "Embed User",
    fioHandle: "embed@user",
  };

  return (
    <div className="h-full">
      <SmartWalletDrawer
        open={true}
        onClose={() => {}} // No-op in embedded mode
        variant="embedded"
        embeddedWidth={density === 'wide' ? 'fixed' : 'fill'}
        agent={agent}
        personaId={personaId}
        codexMode={false} // Regular embed mode, not Codex
      />
    </div>
  );
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
