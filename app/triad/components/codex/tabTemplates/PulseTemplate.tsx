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
 */

import React from "react";
import { KnytCommunityContentTab } from "../tabs/KnytCommunityContentTab";
import type { TabTemplateProps } from "./types";

export function PulseTemplate({
  cartridgeSlug,
  personaId,
  permissions,
  theme,
}: TabTemplateProps) {
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
      theme={theme}
    />
  );
}
