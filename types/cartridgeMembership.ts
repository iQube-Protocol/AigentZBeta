/**
 * Cartridge membership types — shared across Phase 4a (DB layer), Phase 4b
 * (spine extension to getActivePersona / evaluateAccess), Phase 7 (operator
 * manager surface), and Phase 8 (Triad scoping).
 *
 * The runtime DB schema lives in
 *   supabase/migrations/20260602000000_mycartridge_phase4_config_and_roles.sql
 *
 * The CartridgeRole enum is re-exported from types/ventureQube.ts so the
 * v0.4 schema, Zod validator, DB rows, and the spine all reference the same
 * union. Do not redefine the role list anywhere else.
 *
 * PRD reference: codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md §23.
 */

import type { CartridgeRole } from "@/types/ventureQube";

export type { CartridgeRole };

/**
 * One row in `cartridge_memberships`. T0 — server-internal only.
 * `personaId` and `grantedBy` are server-internal; the spine projects to a
 * T1-safe `CartridgeMembershipsMap` (slug → role) at the boundary.
 */
export interface CartridgeMembership {
  cartridgeSlug: string;
  personaId: string;
  role: CartridgeRole;
  grantedAt: string;
  grantedBy?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * T1-safe projection of cartridge memberships for spine consumption.
 *
 * What the browser sees: slug → role only. Never the persona id, never the
 * granted_by, never the granted_at — those stay on the server side.
 *
 * Phase 4b will add this as a field on `ActivePersonaContext.cartridgeFlags`
 * alongside the existing `adminCartridges: string[]`. Until then, this type
 * is consumed only by server-side resolvers.
 */
export type CartridgeMembershipsMap = Record<string, CartridgeRole>;

/**
 * Role hierarchy (descending power). A persona holding `owner` satisfies
 * any `roleRequired` check; a persona holding `guest` satisfies only
 * `guest`-or-below. The PRD §23 ordering is:
 *
 *   owner > admin > editor > contributor > member > partner > franchisee > correspondent > guest
 *
 * This array is the canonical evaluation order — callers MUST NOT
 * reimplement role comparison elsewhere.
 */
export const CARTRIDGE_ROLE_HIERARCHY: readonly CartridgeRole[] = [
  "owner",
  "admin",
  "editor",
  "contributor",
  "member",
  "partner",
  "franchisee",
  "correspondent",
  "guest",
] as const;

/**
 * Returns true iff `held` is at least as powerful as `required` per the
 * PRD §23 hierarchy.
 *
 * Examples:
 *   meetsCartridgeRole('admin', 'editor')      → true   (admin > editor)
 *   meetsCartridgeRole('member', 'editor')     → false  (member < editor)
 *   meetsCartridgeRole('owner', 'guest')       → true
 *   meetsCartridgeRole('guest', 'guest')       → true
 *
 * Pure function — no spine dependency. Phase 4b's evaluateAccess extension
 * uses this to resolve `descriptor.cartridgeRole` checks.
 */
export function meetsCartridgeRole(
  held: CartridgeRole | undefined,
  required: CartridgeRole,
): boolean {
  if (!held) return false;
  const heldIdx = CARTRIDGE_ROLE_HIERARCHY.indexOf(held);
  const requiredIdx = CARTRIDGE_ROLE_HIERARCHY.indexOf(required);
  if (heldIdx === -1 || requiredIdx === -1) return false;
  // Lower index = more powerful (owner is index 0).
  return heldIdx <= requiredIdx;
}

/**
 * Shape of the gate flags Phase 4a adds to `codex_tabs`. The DB columns are
 * nullable / default-permissive; the TS type narrows them so the spine
 * resolver can pattern-match.
 *
 * Phase 4b's evaluateAccess extension consumes this descriptor to decide
 * whether a persona can render a tab.
 */
export interface CartridgeTabGateFlags {
  memberOnly: boolean;
  inviteOnly: boolean;
  tokenGated: { tokenId: string; minBalance: string } | null;
  roleRequired: CartridgeRole | null;
}
