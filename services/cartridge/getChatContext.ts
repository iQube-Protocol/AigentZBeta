/**
 * getCartridgeChatContext — server-side helper that loads the chat-relevant
 * slice of a cartridge's configuration so `/api/codex/chat` can scope the
 * system prompt + KB filter + specialist handoff list.
 *
 * Phase 8 of the myCartridge PRD §16. Reads from `codex_configs`
 * (extended by Phase 4a) — every wizard-created cartridge populates the
 * fields this helper consumes.
 *
 * Returns null when:
 *   - slug is empty or doesn't match a row
 *   - row exists but has no Phase 4a fields populated (legacy hand-curated
 *     cartridges in CODEX_DEFINITIONS — they didn't go through the
 *     wizard, so they don't carry an owner_persona_id / smart_triad_config)
 *
 * The result is T1-safe — we surface the cartridge title, slug, purpose,
 * available specialists, copilot prompt context, and owner persona id.
 * Owner persona id is server-side only and the chat route uses it to
 * decide whether to swap the aigentMe persona (Phase 8b future); the
 * route MUST NOT echo it back to the browser.
 */

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export interface CartridgeChatContext {
  /** Slug — T1-safe. */
  cartridgeSlug: string;
  /** Display title — T1-safe. */
  cartridgeTitle: string;
  /** Operator-authored purpose (feeds copilot system prompt per PRD §16). */
  purpose: string | null;
  /** Category from wizard step 1. */
  category: string | null;
  /** Public/private/invite-only/member-only. */
  visibility: string | null;
  /** Up to 3 specialist ids — surface so the model can suggest handoffs. */
  availableSpecialists: string[];
  /** Copilot prompt context from smart_triad_config (wizard step 5). */
  copilotPromptContext: string | null;
  /** Copilot source — 'aigentMe' / 'specialist' / 'cartridge-copilot'.
   *  MVP only handles 'aigentMe'; the other two are typed but unwired. */
  copilotSource: string | null;
  /**
   * Cartridge owner's persona id (T0 — server-only). Phase 8 MVP uses
   * this only for logging context; Phase 8b will swap the aigentMe
   * persona to render as the owner's regent per PRD §16.
   */
  ownerPersonaId: string | null;
}

export async function getCartridgeChatContext(
  cartridgeSlug: string | undefined | null,
): Promise<CartridgeChatContext | null> {
  if (!cartridgeSlug || typeof cartridgeSlug !== "string") return null;

  const db = getSupabaseServer();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("codex_configs")
      .select(
        "slug,name,metadata,owner_persona_id,available_specialists,smart_triad_config",
      )
      .eq("slug", cartridgeSlug)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as {
      slug: string;
      name: string;
      metadata: Record<string, unknown> | null;
      owner_persona_id: string | null;
      available_specialists: string[] | null;
      smart_triad_config: Record<string, unknown> | null;
    };

    const meta = row.metadata ?? {};
    const triad = (row.smart_triad_config ?? {}) as Record<string, unknown>;
    const copilot = (triad.copilot ?? {}) as Record<string, unknown>;

    // If the cartridge has no Phase 4a fields populated AND no purpose
    // metadata, treat it as a legacy hand-curated cartridge that the chat
    // route shouldn't try to scope to (it'd just produce empty blocks).
    const hasAnyPhase4aSignal =
      row.owner_persona_id !== null ||
      (row.available_specialists && row.available_specialists.length > 0) ||
      row.smart_triad_config !== null ||
      typeof meta.purpose === "string";
    if (!hasAnyPhase4aSignal) return null;

    return {
      cartridgeSlug: row.slug,
      cartridgeTitle: row.name,
      purpose: typeof meta.purpose === "string" ? (meta.purpose as string) : null,
      category: typeof meta.category === "string" ? (meta.category as string) : null,
      visibility: typeof meta.visibility === "string" ? (meta.visibility as string) : null,
      availableSpecialists: row.available_specialists ?? [],
      copilotPromptContext:
        typeof copilot.promptContext === "string"
          ? (copilot.promptContext as string)
          : null,
      copilotSource: typeof copilot.source === "string" ? (copilot.source as string) : null,
      ownerPersonaId: row.owner_persona_id,
    };
  } catch (err) {
    console.warn("[getCartridgeChatContext] lookup failed", err);
    return null;
  }
}
