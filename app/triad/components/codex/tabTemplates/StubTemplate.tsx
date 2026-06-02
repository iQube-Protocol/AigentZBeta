"use client";

/**
 * StubTemplate — placeholder for the 8 tab templates whose deep
 * implementation lands in Phase 5b+.
 *
 * Reachable via 8 thin factories below, one per templateId, so the
 * registry stays statically typed and each stub is greppable by id.
 * Each factory renders the same body — a labelled "coming soon" card.
 *
 * Phase plan for the stubs:
 *   experience-v1 — Phase 5b (cartridge Experience Matrix fork)
 *   wallet-v1     — Phase 9  (wallet primitives: send/receive/request/reward)
 *   ledger-v1     — Phase 10 (DVN receipt feed scoped to the cartridge)
 *   community-v1  — Phase 5b (community-content alias of PulseTemplate variant)
 *   members-v1    — Phase 7  (mirrors KNYT members + Experience Matrix
 *                              fork; owner-customizable per PRD §22)
 *   venture-v1    — Phase 5b (extracted from AlphaProgrammeTab with
 *                              workstream count parameterized)
 *   settings-v1   — Phase 7  (cartridge settings editor — gated to
 *                              owner-or-admin role)
 *   admin-v1      — Phase 7  (cartridge admin panel — gated to admin)
 */

import React from "react";
import type { TabTemplateProps } from "./types";
import type { CartridgeTabTemplateId } from "@/types/ventureQube";

interface StubProps extends TabTemplateProps {
  templateId: CartridgeTabTemplateId;
  /** Short note about which Phase wires the real implementation. */
  scheduledFor: string;
}

function StubBody({ templateId, cartridgeSlug, theme, scheduledFor }: StubProps) {
  const dark = theme === "dark";
  return (
    <div
      className={`p-6 rounded-lg border ${
        dark
          ? "bg-slate-900/50 border-slate-700 text-slate-200"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
          }`}
        >
          {cartridgeSlug}
        </span>
      </div>
      <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>
        This tab uses the <code className="font-mono">{templateId}</code>{" "}
        template. Implementation lands in {scheduledFor}.
      </p>
    </div>
  );
}

// One thin factory per stubbed templateId — keeps the registry types
// strict (each entry is a real React component) and each stub
// grep-discoverable by id.

export function ExperienceStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="experience-v1" scheduledFor="Phase 5b" />;
}
export function WalletStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="wallet-v1" scheduledFor="Phase 9" />;
}
export function LedgerStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="ledger-v1" scheduledFor="Phase 10" />;
}
export function CommunityStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="community-v1" scheduledFor="Phase 5b" />;
}
export function MembersStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="members-v1" scheduledFor="Phase 7" />;
}
export function VentureStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="venture-v1" scheduledFor="Phase 5b" />;
}
export function SettingsStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="settings-v1" scheduledFor="Phase 7" />;
}
export function AdminStub(p: TabTemplateProps) {
  return <StubBody {...p} templateId="admin-v1" scheduledFor="Phase 7" />;
}
