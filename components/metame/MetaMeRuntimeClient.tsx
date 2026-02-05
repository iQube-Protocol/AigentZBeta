"use client";

import React, { useEffect, useState } from "react";

export default function MetaMeRuntimeClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-4 py-6 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading metaMe Runtime…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">metaMe Runtime</h1>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Reading Sprint Experience</h2>
            <p className="text-slate-400 mb-4">Complete a focused reading sprint with wallet integration</p>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm">
                Reward: 40 Q¢
              </div>
              <div className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-sm">
                Duration: 25 min
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Start Experience
            </button>
            <button className="border border-slate-700 text-slate-300 hover:bg-slate-800 px-4 py-2 rounded-lg">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
