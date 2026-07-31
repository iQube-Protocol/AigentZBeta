"use client";

// Next 15: next/dynamic with ssr:false is only allowed in a Client Component.
import dynamic from "next/dynamic";

const MetaMeRuntimeClient = dynamic(
  () => import("@/components/metame/MetaMeRuntimeClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-6 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading metaMe Runtime…</div>
      </div>
    ),
  }
);

export default function MetaMeRuntimePage() {
  return <MetaMeRuntimeClient />;
}
