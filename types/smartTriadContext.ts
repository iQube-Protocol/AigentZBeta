/**
 * SmartTriadContext — the canonical context contract for the SmartTriad
 * copilot (PRD: SmartTriad Context-Aware Copilot §7, ratified 2026-07-19).
 *
 * Three knowledge layers travel with every copilot session:
 *   platform  — L1 shared constitutional knowledge (Phase 2: IRE-curated;
 *               Phase 1b carries the ontology version + principle refs only)
 *   cartridge — L2 the active cartridge + tab
 *   observer  — L3 the caller's live state, T1-SAFE ONLY (labels, booleans,
 *               slugs — NEVER personaId / authProfileId / any T0 identifier;
 *               see the Identity & Access Spine tiers in CLAUDE.md)
 *
 * deepLinks are the navigation affordances the copilot surfaces as
 * deterministic chips (same-cartridge via codex:navigate-tab; cross-cartridge
 * via buildCodexUrl).
 */

export interface SmartTriadDeepLink {
  label: string;
  /** Same-cartridge tab slug (dispatched via codex:navigate-tab). */
  tab?: string;
  /** Cross-cartridge target (navigated via buildCodexUrl). */
  codexSlug?: string;
  /** Tab within the cross-cartridge target. */
  codexTab?: string;
}

export interface SmartTriadObserverContext {
  authenticated?: boolean;
  /** 'issued' | 'claimed' | 'none' — the caller's passport posture. */
  passportState?: string;
  delegationActive?: boolean;
  /** Active access grants, as domain/role labels (T1-safe). */
  participation?: { domain: string; role: string }[];
  /** Platform admin (server-resolved; optimistic UI only — routes re-gate). */
  isAdmin?: boolean;
  /**
   * Currently active Constitutional Action Modes (Founder Office Action
   * Modes amendment, ratified 2026-07-22; `ConstitutionalActionMode` in
   * `services/iqube/experienceQube.ts`). Zero-to-many, session/runtime
   * state — NOT persisted profile data (amendment §6.1/§6.2). Seeded from
   * the persona's `operatorArchetype` via `ARCHETYPE_DEFAULT_ACTION_MODES`
   * (`services/iqube/actionModes.ts`) when no explicit selection exists yet.
   * T1-safe: bare mode-name strings only, never a T0 identifier.
   */
  activeActionModes?: string[];
}

/**
 * A copilot-invocable OPERATION (Phase 3 Actions): a deterministic, explicit
 * platform action the copilot surfaces as a chip. Always confirm-gated in the
 * UI and ALWAYS re-gated server-side (admin/entitlement) — the chip is a
 * convenience, never an authority.
 */
export interface SmartTriadOperation {
  id: string;
  label: string;
  route: string;
  method?: 'POST' | 'PATCH';
  body?: Record<string, unknown>;
  /** Confirmation copy shown before executing. */
  confirm: string;
}

/**
 * A previously-cited platform invariant carried across turns (Phase 3
 * constitutional memory v0). T2-safe: seed id + statement only.
 */
export interface SmartTriadCitedInvariant {
  seedId: string;
  statement: string;
}

export interface SmartTriadContext {
  /** Ground-context discriminator for the chat route. */
  surface: 'smart-triad';
  platform: { ontologyVersion: string };
  /** L2 — the active cartridge. corpusRefs name the cartridge's domain
   *  corpus surfaces (PRD §7) so the copilot knows WHAT it is grounded on. */
  cartridge: { id: string; name: string; tab: string; corpusRefs: string[] };
  observer: SmartTriadObserverContext;
  deepLinks: SmartTriadDeepLink[];
  /** Admin-only operational actions (empty for non-admins). */
  operations: SmartTriadOperation[];
  /** What this copilot can DO on this surface (PRD §7) — navigation,
   *  operations, guidance domains. Labels only. */
  capabilities: string[];
  /** Constitutional memory v0 — invariants the IRE resolved on EARLIER turns
   *  of this session (accumulated client-side from chat responses, merged
   *  server-side with the current turn's resolution, deduped by seedId). */
  sessionInvariants?: SmartTriadCitedInvariant[];
}
