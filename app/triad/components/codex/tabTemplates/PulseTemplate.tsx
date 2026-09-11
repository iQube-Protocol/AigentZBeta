"use client";

/**
 * PulseTemplate — cartridge-agnostic Pulse tab.
 *
 * Phase 5 reference template. Delegates to `KnytCommunityContentTab`
 * with the `cartridge` prop set to the calling cartridge slug — the
 * existing community-content surface is already cartridge-parameterized
 * via the `community_generated_content.cartridge` column, so no new
 * API surface is required for Phase 5a.
 *
 * Phase 5b will lift the hardcoded reactions endpoint (`KnytReactionBar`)
 * to a cartridge-parameterized route — the operator note on
 * `QriptoPulseTab` tracks that follow-up.
 *
 * `config.campaignTag` (optional) scopes the tab to a single campaign's
 * content — e.g. the KNYTS Bridge VIEW stage sets this to
 * 'knyts-bridge-crossing' when the wizard configures a campaign-only
 * Pulse tab. Omitted for every existing tab (unfiltered, back-compat).
 */

import React from "react";
import { KnytCommunityContentTab } from "../tabs/KnytCommunityContentTab";
import type { TabTemplateProps } from "./types";

export function PulseTemplate({
  cartridgeSlug,
  personaId,
  permissions,
  theme,
  config,
}: TabTemplateProps) {
  const campaignTag =
    typeof config?.campaignTag === "string" ? config.campaignTag : undefined;
  return (
    <KnytCommunityContentTab
      personaId={personaId}
      isAdmin={permissions?.isAdmin ?? false}
      // KnytCommunityContentTab narrows `cartridge` to "knyt" | "qripto"
      // today; widening that prop is a Phase 5b follow-up alongside the
      // cartridge-parameterized reactions endpoint. For Phase 5a the cast
      // preserves the existing call sites (KNYT, Qripto) and lets the
      // template render for any new cartridge once the prop widens.
      cartridge={cartridgeSlug as "knyt" | "qripto"}
      campaignTag={campaignTag}
      theme={theme}
    />
  );
}
