'use client';

import { PreviewFrame } from "@/components/preview/PreviewFrame";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Runtime</h1>
        <p className="text-slate-300">metaMe Runtime defaults to the Smart Offer flow with device previews.</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Runtime Preview</h2>
            <p className="text-sm text-slate-400">Switch between mobile, tablet, and desktop.</p>
          </div>
        </div>
        <div className="mt-4 h-[720px]">
          <PreviewFrame
            src="/metame/runtime/offer?embed=1&stub=1"
            defaultDevice="mobile"
            chromeless
            fallback={<div className="w-full h-full bg-slate-950 text-slate-200 flex items-center justify-center text-sm">Runtime preview unavailable.</div>}
          />
        </div>
      </div>
    </div>
  );
}
