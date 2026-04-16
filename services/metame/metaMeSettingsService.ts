/**
 * metaMe Settings Service — Venture Lab α
 *
 * Persists and retrieves the personal sovereignty template (metaMe alpha
 * controls) for a given persona. One row per persona in
 * persona_metame_settings; upserted on every save.
 *
 * Alpha defaults mirror METAME_ALPHA_DEFAULTS in
 * components/metame/MetaMeSettingsPanel.tsx and the posture defined in
 * docs/alpha/agentiq-knyt/09-metame-template-spec.md.
 */

import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";
import type {
  MetaMeSettings,
  BudgetPosture,
  LeadAgent,
} from "@/components/metame/MetaMeSettingsPanel";

// Re-export for consumers that only import from this service
export type { MetaMeSettings, BudgetPosture, LeadAgent };

// ─── Alpha defaults (mirrors METAME_ALPHA_DEFAULTS in the UI component) ──────

export const ALPHA_DEFAULTS: MetaMeSettings = {
  guardianMode:       true,
  leadAgent:          "aigent-kn0w1",
  budgetPosture:      "low",
  receiptVisibility:  true,
  curatedSkillsOnly:  true,
  explanationFirst:   true,
};

// ─── DB ↔ domain mapping ─────────────────────────────────────────────────────

function rowToSettings(row: Record<string, unknown>): MetaMeSettings {
  return {
    guardianMode:      Boolean(row.guardian_mode),
    leadAgent:         (row.lead_agent as LeadAgent) ?? ALPHA_DEFAULTS.leadAgent,
    budgetPosture:     (row.budget_posture as BudgetPosture) ?? ALPHA_DEFAULTS.budgetPosture,
    receiptVisibility: Boolean(row.receipt_visibility),
    curatedSkillsOnly: Boolean(row.curated_skills_only),
    explanationFirst:  Boolean(row.explanation_first),
  };
}

function settingsToRow(personaId: string, s: MetaMeSettings): Record<string, unknown> {
  return {
    persona_id:          personaId,
    guardian_mode:       s.guardianMode,
    lead_agent:          s.leadAgent,
    budget_posture:      s.budgetPosture,
    receipt_visibility:  s.receiptVisibility,
    curated_skills_only: s.curatedSkillsOnly,
    explanation_first:   s.explanationFirst,
    updated_at:          new Date().toISOString(),
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Retrieve the metaMe settings for a persona.
 * Returns alpha defaults gracefully when no row exists or the table isn't
 * present yet (pre-migration environments).
 */
export async function getMetaMeSettings(personaId: string): Promise<MetaMeSettings> {
  const supabase = getSupabaseServer();
  if (!supabase) return ALPHA_DEFAULTS;

  const { data, error } = await supabase
    .from("persona_metame_settings")
    .select("*")
    .eq("persona_id", personaId)
    .maybeSingle();

  if (error) {
    // Table may not exist in all environments yet — return defaults
    console.warn("[metaMeSettingsService] getMetaMeSettings:", error.message);
    return ALPHA_DEFAULTS;
  }

  if (!data) return ALPHA_DEFAULTS;
  return rowToSettings(data as Record<string, unknown>);
}

/**
 * Upsert the metaMe settings for a persona.
 * Returns the persisted settings (useful for confirming what was saved).
 */
export async function upsertMetaMeSettings(
  personaId: string,
  settings: MetaMeSettings
): Promise<MetaMeSettings> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("[metaMeSettingsService] Supabase unavailable");

  const row = settingsToRow(personaId, settings);

  const { data, error } = await supabase
    .from("persona_metame_settings")
    .upsert(row, { onConflict: "persona_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`[metaMeSettingsService] upsertMetaMeSettings failed: ${error.message}`);
  }

  return rowToSettings(data as Record<string, unknown>);
}
