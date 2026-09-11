"use client";

/**
 * QriptoPulseAdminTab — Qriptopian Admin › Pulse moderation queue.
 *
 * Thin wrapper over KnytCommunityContentAdminTab passing
 * cartridge='qripto' so the queue scopes to Qriptopian Pulse rows
 * only. Inherits the Promote / Reject / Delete actions and the
 * Q¢ pricing block.
 *
 * Delete fires DELETE /api/community-content/[id], which reads
 * row.cartridge and removes the matching publication-state mirror
 * automatically (qripto_publication_states for Qripto rows).
 */

import React from "react";
import { KnytCommunityContentAdminTab } from "./KnytCommunityContentAdminTab";

interface Props {
  isAdmin?: boolean;
  personaId?: string;
}

export function QriptoPulseAdminTab(props: Props) {
  return <KnytCommunityContentAdminTab {...props} cartridge="qripto" />;
}
