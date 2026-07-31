"use client";

/**
 * QriptoAffiliatesPartnersTab — Qriptopian Store › Affiliates and Partners.
 *
 * Phase 1: renders the existing KNYT Store Bundles surface as the first
 * partner inside the Qriptopian Store. Future partners stack alongside
 * KNYT at the same tier (no tier-3 nesting) — the host below is the
 * single insertion point for new partner sections.
 *
 * Component re-use only: KnytStoreBundlesTab handles its own data
 * fetching, persona resolution, and rendering. We just compose it
 * inside a partner-sectioned shell.
 */

import React from "react";
import { Handshake } from "lucide-react";
import { KnytStoreBundlesTab } from "./KnytStoreBundlesTab";

interface QriptoAffiliatesPartnersTabProps {
  theme?: "light" | "dark";
  personaId?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  isInvestor?: boolean;
}

export function QriptoAffiliatesPartnersTab(props: QriptoAffiliatesPartnersTabProps) {
  const { theme = "dark" } = props;
  const isDark = theme === "dark";

  return (
    <div className="space-y-6 p-4">
      <header className="flex items-center gap-3">
        <Handshake className={`h-5 w-5 ${isDark ? "text-indigo-300" : "text-indigo-600"}`} />
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            Affiliates &amp; Partners
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Cross-cartridge collaborations and bundled offerings — KNYT today, more partners coming.
          </p>
        </div>
      </header>

      {/* KNYT partner section — renders the canonical KNYT Bundles surface
          (component re-use, no duplicated logic). Future partners get
          added as additional sections below. */}
      <section className={`rounded-lg border ${isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
        <header className={`px-4 py-3 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <h3 className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            KNYT — Bundles
          </h3>
          <p className={`text-[11px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            From the metaKnyts cartridge — episodes, cards, and bundle deals.
          </p>
        </header>
        <div className="p-2">
          <KnytStoreBundlesTab {...props} />
        </div>
      </section>

      {/* Future partner sections render here at the same tier — no tier-3
          nesting per the v3 restructure brief. To add: drop another
          <section> with the partner's component below. */}
    </div>
  );
}
