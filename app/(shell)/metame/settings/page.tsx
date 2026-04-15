"use client";

import { SlidersHorizontal } from "lucide-react";
import { MetaMeSettingsPanel } from "@/components/metame/MetaMeSettingsPanel";

export default function MetaMeSettingsPage() {
  return (
    <div className="max-w-sm mx-auto py-6">
      <div className="flex items-center gap-2 px-4 pb-3 border-b border-gray-100 dark:border-slate-800">
        <SlidersHorizontal className="h-4 w-4 text-gray-400 dark:text-slate-400" />
        <h1 className="text-sm font-semibold text-gray-900 dark:text-slate-100">metaMe Settings</h1>
      </div>
      <MetaMeSettingsPanel />
    </div>
  );
}
