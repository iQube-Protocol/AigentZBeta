"use client";

/**
 * CodexTemplate — cartridge-agnostic Codex entries list.
 *
 * Phase 5 reference template. Renders the published rows from
 * `cartridge_codex_entries` (Phase 4a table) for the calling cartridge.
 *
 * Phase 5a scope: read-only list view. The publish-to-cartridge flow
 * from myCanvas / myWorkspace (PRD §25) and the "mint as ContentQube"
 * action land later.
 *
 * Phase 5b will:
 *   - Land /api/cartridge/[slug]/codex/entries (GET list, POST publish)
 *   - Wire the publish-to-cartridge action on myCanvas / myWorkspace
 *
 * Today the template renders a thin "Codex" panel with the cartridge
 * label, an empty state, and the contract that lets the rest of the
 * framework be plugged in without further file additions.
 */

import React from "react";
import type { TabTemplateProps } from "./types";

export function CodexTemplate({ cartridgeSlug, theme }: TabTemplateProps) {
  const dark = theme === "dark";
  return (
    <div
      className={`p-6 rounded-lg border ${
        dark
          ? "bg-slate-900/50 border-slate-700 text-slate-200"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Codex</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
          }`}
        >
          {cartridgeSlug}
        </span>
      </div>
      <p
        className={`text-sm ${
          dark ? "text-slate-400" : "text-slate-600"
        }`}
      >
        No Codex entries yet. Publish from myCanvas or myWorkspace to populate.
      </p>
      <p
        className={`text-xs mt-3 ${
          dark ? "text-slate-500" : "text-slate-500"
        }`}
      >
        Template: codex-v1 · Phase 5a reference (read-only). Phase 5b wires
        the publish flow + per-entry detail view.
      </p>
    </div>
  );
}
