/**
 * cartridgeManageGuard — single helper used by every Phase 7 operator
 * manager route.
 *
 * The PRD §14 permission boundary: operator-tier writes are gated by
 * "the persona is owner-or-admin of the cartridge." Reads are gated by
 * "the persona is owner-or-admin OR is a platform-tier isAdmin." This
 * helper centralises both checks so the routes don't reimplement them.
 *
 * Resolution rules:
 *   - `isAdmin: true` (uber/platform-tier) satisfies any read OR write.
 *   - `adminCartridges.includes(slug)` (Phase 4b CRM grants) satisfies
 *     any read OR write on that slug.
 *   - `cartridgeMemberships[slug] === 'owner'` (Phase 4b cartridge_memberships
 *     projection) satisfies any read OR write.
 *   - `meetsCartridgeRole(cartridgeMemberships[slug], 'admin')` satisfies
 *     any read OR write (admin role, an `editor` role, etc. would NOT).
 *   - Any lower role (`editor`, `contributor`, …) satisfies READ but NOT write.
 *
 * Per CLAUDE.md PARAMOUNT, every gate flows through this helper rather
 * than open-coded in each route. Adding a new tier (e.g. a 'partner'
 * write-permission) means one edit here, not six.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getActivePersona,
} from "@/services/identity/getActivePersona";
import { meetsCartridgeRole } from "@/types/cartridgeMembership";
import type { ActivePersonaContext } from "@/types/access";

export interface CartridgeManageContext {
  persona: ActivePersonaContext;
  cartridgeSlug: string;
  /** True when the gate satisfied write permission. */
  canWrite: boolean;
  /** Why the gate allowed — useful for logs. */
  reason:
    | "uber-admin"
    | "cartridge-admin-grant"
    | "owner"
    | "admin-role"
    | "editor-role"
    | "contributor-role"
    | "member-role";
}

interface GuardOptions {
  /** When true, requires write permission (owner / admin / uber). */
  requireWrite: boolean;
}

/**
 * Centralised gate. Returns the persona context + write capability when
 * the caller is allowed; returns a NextResponse on deny so the route
 * can `return guard(...);` in one line.
 */
export async function cartridgeManageGuard(
  req: NextRequest,
  cartridgeSlug: string,
  opts: GuardOptions,
): Promise<CartridgeManageContext | NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!cartridgeSlug || typeof cartridgeSlug !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid-slug" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const flags = persona.cartridgeFlags;
  const memberships = flags.cartridgeMemberships ?? {};
  const role = memberships[cartridgeSlug];

  // Uber + CRM-tier admin override.
  if (flags.isAdmin) {
    return { persona, cartridgeSlug, canWrite: true, reason: "uber-admin" };
  }
  if (Array.isArray(flags.adminCartridges) && flags.adminCartridges.includes(cartridgeSlug)) {
    return {
      persona,
      cartridgeSlug,
      canWrite: true,
      reason: "cartridge-admin-grant",
    };
  }

  // Cartridge-membership tier — owner / admin grant write; editor /
  // contributor / member grant read only.
  if (role === "owner") {
    return { persona, cartridgeSlug, canWrite: true, reason: "owner" };
  }
  if (meetsCartridgeRole(role, "admin")) {
    return { persona, cartridgeSlug, canWrite: true, reason: "admin-role" };
  }
  if (meetsCartridgeRole(role, "editor")) {
    if (opts.requireWrite) {
      return NextResponse.json(
        { ok: false, error: "forbidden", detail: "editor role grants read only on Phase 7" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    return { persona, cartridgeSlug, canWrite: false, reason: "editor-role" };
  }
  if (meetsCartridgeRole(role, "contributor")) {
    if (opts.requireWrite) {
      return NextResponse.json(
        { ok: false, error: "forbidden", detail: "contributor role grants read only" },
        { status: 403 },
      );
    }
    return { persona, cartridgeSlug, canWrite: false, reason: "contributor-role" };
  }
  if (meetsCartridgeRole(role, "member")) {
    if (opts.requireWrite) {
      return NextResponse.json(
        { ok: false, error: "forbidden", detail: "member role grants read only" },
        { status: 403 },
      );
    }
    return { persona, cartridgeSlug, canWrite: false, reason: "member-role" };
  }

  // No role at all — deny.
  return NextResponse.json(
    { ok: false, error: "forbidden", detail: "no role on this cartridge" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
