"use client";

/**
 * QriptoPulseTab — Qriptopia › Qriptopian Pulse.
 *
 * Thin wrapper over KnytCommunityContentTab passing cartridge='qripto'
 * so the list endpoint scopes to Qriptopian rows. Same UI, same
 * reactions, same share affordances — different data source per the
 * cartridge column on community_generated_content.
 *
 * Once the cartridge-parameterized Living Canon refactor lands (see
 * 2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md item 2)
 * the qripto-side reactions land too; today they hit the KNYT reaction
 * routes because KnytReactionBar is hardcoded. That doesn't break
 * anything — reactions just attribute under the knyt cartridge
 * namespace until the refactor.
 */

import React from "react";
import { KnytCommunityContentTab } from "./KnytCommunityContentTab";

interface Props {
  personaId?: string;
  isAdmin?: boolean;
  theme?: "light" | "dark";
}

export function QriptoPulseTab(props: Props) {
  return <KnytCommunityContentTab {...props} cartridge="qripto" />;
}
