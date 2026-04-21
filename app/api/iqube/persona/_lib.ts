/**
 * Shared logic for persona iQube API routes.
 * Handles DB access, field whitelists, shaping, and admin gate.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEvmKnytBalance } from "@/services/wallet/knyt/evmKnytService";

export type PersonaType = "knyt" | "qripto";

// ─── Supabase client ─────────────────────────────────────────────────────────

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration missing");
  return createClient(url, key);
}

// ─── Table names ─────────────────────────────────────────────────────────────

export function personaTable(type: PersonaType) {
  return type === "knyt"
    ? "nakamoto_knyt_personas"
    : "nakamoto_qripto_personas";
}

// ─── Admin check ─────────────────────────────────────────────────────────────

export async function isAdminEmail(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("crm_auth_profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) return false;

  const { data: role } = await supabase
    .from("crm_admin_roles")
    .select("id")
    .eq("auth_profile_id", profile.id)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  return Boolean(role);
}

// ─── User-editable field whitelists ──────────────────────────────────────────

const KNYT_USER_EDITABLE = new Set([
  "First-Name", "Last-Name", "Email", "Phone-Number", "Age", "Address",
  "Profession", "Local-City", "profile_image_url",
  "EVM-Public-Key", "BTC-Public-Key", "Solana-Public-Key",
  "Wallets-of-Interest", "Tokens-of-Interest", "Web3-Interests",
  "Twitter-Handle", "Telegram-Handle", "Discord-Handle", "Instagram-Handle",
  "YouTube-ID", "Facebook-ID", "TikTok-Handle",
  "Motion-Comics-Owned", "Print-Comics-Owned", "Digital-Comics-Owned",
  "KNYT-Posters-Owned", "Print-Cards-Owned", "Digital-Cards-Owned",
  "Characters-Owned", "print_episodes_owned",
  "preferred_channel_primary", "preferred_channel_secondary",
]);

const QRIPTO_USER_EDITABLE = new Set([
  "First-Name", "Last-Name", "Email", "Profession", "Local-City", "profile_image_url",
  "EVM-Public-Key", "BTC-Public-Key", "Solana-Public-Key",
  "Wallets-of-Interest", "Tokens-of-Interest", "Web3-Interests",
  "Twitter-Handle", "Telegram-Handle", "Discord-Handle", "Instagram-Handle",
  "GitHub-Handle", "YouTube-ID", "Facebook-ID", "TikTok-Handle",
  "preferred_channel_primary", "preferred_channel_secondary",
]);

const KNYT_ADMIN_EDITABLE = new Set([
  ...KNYT_USER_EDITABLE,
  "KNYT-ID", "OM-Member-Since", "OM-Tier-Status", "Metaiye-Shares-Owned",
  "Total-Invested", "investment_amount_band",
  "platform_auth_profile_id",
  "campaign_cohort", "campaign_state", "offer_fit", "message_angle",
  "reactivation_potential", "investor_priority_band",
  "campaign_notes", "campaign_tags",
]);

const QRIPTO_ADMIN_EDITABLE = new Set([
  ...QRIPTO_USER_EDITABLE,
  "Qripto-ID", "investment_amount_band",
  "platform_auth_profile_id",
]);

export function getUserEditableFields(type: PersonaType): Set<string> {
  return type === "knyt" ? KNYT_USER_EDITABLE : QRIPTO_USER_EDITABLE;
}

export function getAdminEditableFields(type: PersonaType): Set<string> {
  return type === "knyt" ? KNYT_ADMIN_EDITABLE : QRIPTO_ADMIN_EDITABLE;
}

// ─── Admin-only fields (never returned to users) ──────────────────────────────

const ADMIN_ONLY_FIELDS = new Set([
  "platform_auth_profile_id",
  "campaign_cohort", "campaign_state", "offer_fit", "message_angle",
  "reactivation_potential", "investor_priority_band",
  "kickstarter_clicked_at", "kickstarter_backed_at",
  "last_campaign_sent_at", "last_campaign_sequence",
  "campaign_notes", "campaign_tags",
]);

// ─── MetaQube scoring config ──────────────────────────────────────────────────

const META_SCORES: Record<PersonaType, {
  sensitivity: number; verifiability: number; accuracy: number; risk: number;
  designer: string; use: string; relatedIQubes: string[];
}> = {
  knyt: {
    sensitivity: 7, verifiability: 8, accuracy: 8, risk: 6.5,
    designer: "KNYT Ecosystem",
    use: "KNYT ecosystem profile management, reward tracking, and cartridge access gating",
    relatedIQubes: ["QriptoPersona", "MetisQube", "EcosystemQube"],
  },
  qripto: {
    sensitivity: 6, verifiability: 7, accuracy: 8, risk: 5,
    designer: "Aigent",
    use: "Personalized cryptocurrency recommendations, portfolio analysis, and cartridge access gating",
    relatedIQubes: ["MetisQube", "VeniceQube", "WalletQube"],
  },
};

// ─── Shape row into iQube subdivisions ───────────────────────────────────────

export function shapeAsIQube(
  row: Record<string, unknown>,
  type: PersonaType,
  forAdmin: boolean
) {
  const scores = META_SCORES[type];

  // metaQube — template structure + non-PII metadata (plaintext)
  const metaQube = {
    "iQube-Identifier": type === "knyt" ? "KNYT Persona iQube" : "Qripto Persona iQube",
    "iQube-Type": "DataQube",
    "iQube-Designer": scores.designer,
    "iQube-Use": scores.use,
    "Owner-Type": "Person",
    "Owner-Identifiability": "Semi-Identifiable",
    "Date-Minted": row.created_at ?? null,
    "Related-iQubes": scores.relatedIQubes,
    "Sensitivity-Score": scores.sensitivity,
    "Verifiability-Score": scores.verifiability,
    "Accuracy-Score": scores.accuracy,
    "Risk-Score": scores.risk,
    persona_type: type,
  };

  // blakQube — private payload; strip admin-only fields for non-admins
  const blakQube: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!forAdmin && ADMIN_ONLY_FIELDS.has(k)) continue;
    // Strip internal DB fields
    if (k === "id" || k === "user_id") continue;
    blakQube[k] = v;
  }

  // tokenQube — wallet binding + mint status
  const evmAddress =
    typeof row["EVM-Public-Key"] === "string" ? row["EVM-Public-Key"] : null;
  const tokenQube = {
    ownerType: "Person",
    settlementNetwork: "Base (chainId 8453)",
    walletRequired: !evmAddress,
    evmAddress,
    fioHandle: row.fio_handle ?? null,
    knytHandle: row.knyt_handle ?? null,
    mintStatus: row._mintStatus ?? "unminted",
  };

  return { metaQube, blakQube, tokenQube, _id: row.id };
}

// ─── KNYT balance refresh (side-effect, non-blocking) ────────────────────────

export async function refreshKnytBalance(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
  const evmAddress =
    typeof row["EVM-Public-Key"] === "string" && row["EVM-Public-Key"].trim()
      ? row["EVM-Public-Key"].trim()
      : null;
  if (!evmAddress || !row.id) return;

  try {
    const balance = await getEvmKnytBalance(evmAddress);
    if (!balance) return;
    await supabase
      .from("nakamoto_knyt_personas")
      .update({
        "KNYT-COYN-Owned": balance.balanceFormatted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id as string);
  } catch {
    // Non-fatal — balance will refresh on next load
  }
}

// ─── Filter a patch body to allowed keys ─────────────────────────────────────

export function filterPatch(
  body: Record<string, unknown>,
  allowed: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}
