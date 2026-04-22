/**
 * Seed KNYT Persona and Qripto Persona iQube templates.
 *
 * Idempotent — checks for existing templates by name before inserting.
 *
 * Run with:
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-persona-iqube-templates.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

// ─── Field definitions ────────────────────────────────────────────────────────

type FieldSource = "user" | "wallet" | "chain" | "oauth" | "csv" | "system" | "admin";

interface BlakQubeField {
  key: string;
  label: string;
  type: "text" | "text[]" | "boolean" | "timestamptz";
  editable: boolean;    // user can write this field
  locked_after_set?: boolean; // editable until first non-empty value
  admin_only?: boolean; // hidden from user, visible to admin
  source: FieldSource;
  wallet_connect?: "evm" | "btc" | "solana";  // optional wallet connect button
  section: string;
}

const KNYT_BLAKQUBE_FIELDS: BlakQubeField[] = [
  // ── Identity ──────────────────────────────────────────────────────────────
  { key: "First-Name",        label: "First Name",       type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Last-Name",         label: "Last Name",        type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Email",             label: "Email",            type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Phone-Number",      label: "Phone Number",     type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Age",               label: "Age",              type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Address",           label: "Address",          type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Profession",        label: "Profession",       type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "Local-City",        label: "City",             type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "profile_image_url", label: "Profile Image",    type: "text", editable: true,  source: "user",   section: "Identity" },
  { key: "KNYT-ID",           label: "KNYT ID",          type: "text", editable: false, source: "admin",  section: "Identity" },

  // ── DIDQube Handles ───────────────────────────────────────────────────────
  { key: "fio_handle",        label: "FIO Handle",       type: "text", editable: false, locked_after_set: true, source: "wallet", section: "Handles" },
  { key: "knyt_handle",       label: "KNYT Handle",      type: "text", editable: false, locked_after_set: true, source: "wallet", section: "Handles" },

  // ── Crypto / Wallet (user-editable or wallet-connect) ────────────────────
  { key: "EVM-Public-Key",          label: "EVM Address",          type: "text",   editable: true, source: "user", wallet_connect: "evm",     section: "Crypto Wallet" },
  { key: "BTC-Public-Key",          label: "BTC Address",          type: "text",   editable: true, source: "user", wallet_connect: "btc",     section: "Crypto Wallet" },
  { key: "Solana-Public-Key",       label: "Solana Address",       type: "text",   editable: true, source: "user", wallet_connect: "solana",  section: "Crypto Wallet" },
  { key: "ThirdWeb-Public-Key",     label: "ThirdWeb Key",         type: "text",   editable: false, source: "wallet", section: "Crypto Wallet" },
  { key: "MetaKeep-Public-Key",     label: "MetaKeep Key",         type: "text",   editable: false, source: "wallet", section: "Crypto Wallet" },
  { key: "Chain-IDs",               label: "Chain IDs",            type: "text[]", editable: false, source: "chain",  section: "Crypto Wallet" },
  { key: "Wallets-of-Interest",     label: "Wallets of Interest",  type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },
  { key: "Tokens-of-Interest",      label: "Tokens of Interest",   type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },
  { key: "Web3-Interests",          label: "Web3 Interests",       type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },

  // ── Social Handles ────────────────────────────────────────────────────────
  { key: "LinkedIn-ID",          label: "LinkedIn ID",          type: "text", editable: false, source: "oauth",  section: "Social" },
  { key: "LinkedIn-Profile-URL", label: "LinkedIn Profile URL", type: "text", editable: false, source: "oauth",  section: "Social" },
  { key: "Twitter-Handle",       label: "X (Twitter) Handle",  type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "Telegram-Handle",      label: "Telegram Handle",     type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "Discord-Handle",       label: "Discord Handle",      type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "Instagram-Handle",     label: "Instagram Handle",    type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "YouTube-ID",           label: "YouTube ID",          type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "Facebook-ID",          label: "Facebook ID",         type: "text", editable: true,  source: "user",   section: "Social" },
  { key: "TikTok-Handle",        label: "TikTok Handle",       type: "text", editable: true,  source: "user",   section: "Social" },

  // ── Membership (CSV/admin-derived, locked) ────────────────────────────────
  { key: "OM-Member-Since",       label: "OM Member Since",       type: "text", editable: false, source: "csv",  section: "Membership" },
  { key: "OM-Tier-Status",        label: "OM Tier Status",        type: "text", editable: false, source: "admin", section: "Membership" },
  { key: "Metaiye-Shares-Owned",  label: "Metaiye Shares Owned",  type: "text", editable: false, source: "csv",  section: "Membership" },
  { key: "Total-Invested",        label: "Total Invested (USD)",  type: "text", editable: false, source: "csv",  section: "Membership" },

  // ── Crypto KNYT Holdings (chain-read, locked) ─────────────────────────────
  { key: "KNYT-COYN-Owned",         label: "KNYT COYN (EVM Mainnet)", type: "text", editable: false, source: "chain", section: "Crypto KNYT Holdings" },
  { key: "KNYT-COYN-Qripto-Owned",  label: "KNYT COYN (Qripto)",      type: "text", editable: false, source: "chain", section: "Crypto KNYT Holdings" },
  { key: "metaknyts_iqubes_owned",   label: "metaKnyts iQubes Owned",  type: "text", editable: false, source: "chain", section: "Crypto KNYT Holdings" },

  // ── Non-Crypto KNYT Holdings (user-editable) ──────────────────────────────
  { key: "Motion-Comics-Owned",  label: "Motion Comics Owned",  type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "Print-Comics-Owned",   label: "Print Comics Owned",   type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "Digital-Comics-Owned", label: "Digital Comics Owned", type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "KNYT-Posters-Owned",   label: "Posters Owned",        type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "Print-Cards-Owned",    label: "Print Cards Owned",    type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "Digital-Cards-Owned",  label: "Digital Cards Owned",  type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "Characters-Owned",     label: "Characters Owned",     type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },
  { key: "print_episodes_owned", label: "Print Episodes Owned", type: "text", editable: true, source: "user", section: "Non-Crypto KNYT Holdings" },

  // ── Investment History (CSV, locked) ─────────────────────────────────────
  { key: "csv_investment_status",    label: "Investment Status",     type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_first_committed_date", label: "First Committed Date",  type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_last_disbursed_date",  label: "Last Disbursed Date",   type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_transfer_methods",     label: "Transfer Methods",      type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_transaction_count",    label: "Transaction Count",     type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_metaknyt_nfts",        label: "metaKnyt NFTs (CSV)",   type: "text",    editable: false, source: "csv", section: "Investment History" },
  { key: "csv_other_nfts",           label: "Other NFTs (CSV)",      type: "text",    editable: false, source: "csv", section: "Investment History" },

  // ── Preferences (user-editable) ───────────────────────────────────────────
  { key: "preferred_channel_primary",   label: "Preferred Channel (Primary)",   type: "text", editable: true,  source: "user",   section: "Preferences" },
  { key: "preferred_channel_secondary", label: "Preferred Channel (Secondary)", type: "text", editable: true,  source: "user",   section: "Preferences" },
  { key: "investment_amount_band",      label: "Investment Band",               type: "text", editable: false, source: "system", section: "Preferences" },

  // ── Platform ──────────────────────────────────────────────────────────────
  { key: "platform_activated_at", label: "Platform Activated",     type: "timestamptz", editable: false, source: "system", section: "Platform" },

  // ── Admin Only (hidden from users) ────────────────────────────────────────
  { key: "platform_auth_profile_id", label: "Auth Profile ID",        type: "text", editable: false, admin_only: true, source: "system", section: "Admin" },
  { key: "campaign_cohort",          label: "Campaign Cohort",         type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "campaign_state",           label: "Campaign State",          type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "offer_fit",                label: "Offer Fit",               type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "message_angle",            label: "Message Angle",           type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "reactivation_potential",   label: "Reactivation Potential",  type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "investor_priority_band",   label: "Priority Band",           type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "kickstarter_clicked_at",   label: "KS Clicked At",           type: "timestamptz", editable: false, admin_only: true, source: "system", section: "Admin" },
  { key: "kickstarter_backed_at",    label: "KS Backed At",            type: "timestamptz", editable: false, admin_only: true, source: "system", section: "Admin" },
  { key: "last_campaign_sent_at",    label: "Last Campaign Sent",      type: "timestamptz", editable: false, admin_only: true, source: "system", section: "Admin" },
  { key: "last_campaign_sequence",   label: "Last Campaign Sequence",  type: "text", editable: false, admin_only: true, source: "system", section: "Admin" },
  { key: "campaign_notes",           label: "Campaign Notes",          type: "text", editable: true,  admin_only: true, source: "admin",  section: "Admin" },
  { key: "campaign_tags",            label: "Campaign Tags",           type: "text[]", editable: true, admin_only: true, source: "admin",  section: "Admin" },
];

const QRIPTO_BLAKQUBE_FIELDS: BlakQubeField[] = [
  // Identity
  { key: "First-Name",        label: "First Name",      type: "text", editable: true,  source: "user",  section: "Identity" },
  { key: "Last-Name",         label: "Last Name",       type: "text", editable: true,  source: "user",  section: "Identity" },
  { key: "Email",             label: "Email",           type: "text", editable: true,  source: "user",  section: "Identity" },
  { key: "Qripto-ID",        label: "Qripto ID",       type: "text", editable: false, source: "admin", section: "Identity" },
  { key: "Profession",        label: "Profession",      type: "text", editable: true,  source: "user",  section: "Identity" },
  { key: "Local-City",        label: "City",            type: "text", editable: true,  source: "user",  section: "Identity" },
  { key: "profile_image_url", label: "Profile Image",   type: "text", editable: true,  source: "user",  section: "Identity" },
  // Handles
  { key: "fio_handle",   label: "FIO Handle",   type: "text", editable: false, locked_after_set: true, source: "wallet", section: "Handles" },
  { key: "knyt_handle",  label: "KNYT Handle",  type: "text", editable: false, locked_after_set: true, source: "wallet", section: "Handles" },
  // Crypto
  { key: "EVM-Public-Key",      label: "EVM Address",     type: "text",   editable: true,  source: "user", wallet_connect: "evm",    section: "Crypto Wallet" },
  { key: "BTC-Public-Key",      label: "BTC Address",     type: "text",   editable: true,  source: "user", wallet_connect: "btc",    section: "Crypto Wallet" },
  { key: "Solana-Public-Key",   label: "Solana Address",  type: "text",   editable: true,  source: "user", wallet_connect: "solana", section: "Crypto Wallet" },
  { key: "Chain-IDs",           label: "Chain IDs",       type: "text[]", editable: false, source: "chain",  section: "Crypto Wallet" },
  { key: "Wallets-of-Interest", label: "Wallets",         type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },
  { key: "Tokens-of-Interest",  label: "Tokens",          type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },
  { key: "Web3-Interests",      label: "Web3 Interests",  type: "text[]", editable: true,  source: "user",   section: "Crypto Wallet" },
  // Social
  { key: "LinkedIn-ID",          label: "LinkedIn ID",          type: "text", editable: false, source: "oauth", section: "Social" },
  { key: "LinkedIn-Profile-URL", label: "LinkedIn Profile URL", type: "text", editable: false, source: "oauth", section: "Social" },
  { key: "Twitter-Handle",       label: "X (Twitter) Handle",   type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "Telegram-Handle",      label: "Telegram Handle",      type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "Discord-Handle",       label: "Discord Handle",       type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "Instagram-Handle",     label: "Instagram Handle",     type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "GitHub-Handle",        label: "GitHub Handle",        type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "YouTube-ID",           label: "YouTube ID",           type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "Facebook-ID",          label: "Facebook ID",          type: "text", editable: true,  source: "user",  section: "Social" },
  { key: "TikTok-Handle",        label: "TikTok Handle",        type: "text", editable: true,  source: "user",  section: "Social" },
  // Platform
  { key: "platform_activated_at",    label: "Platform Activated", type: "timestamptz", editable: false, source: "system", section: "Platform" },
  { key: "platform_auth_profile_id", label: "Auth Profile ID",    type: "text",        editable: false, admin_only: true, source: "system", section: "Admin" },
  // Preferences
  { key: "preferred_channel_primary",   label: "Preferred Channel (Primary)",   type: "text", editable: true,  source: "user",   section: "Preferences" },
  { key: "preferred_channel_secondary", label: "Preferred Channel (Secondary)", type: "text", editable: true,  source: "user",   section: "Preferences" },
];

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: "KNYT Persona iQube",
    description: "KNYT ecosystem persona — investment history, asset holdings, wallet identity, and membership status.",
    iQubeType: "DataQube",
    iQubeInstanceType: "template",
    sensitivityScore: 7,
    verifiabilityScore: 8,
    accuracyScore: 8,
    riskScore: 6.5,
    fields: KNYT_BLAKQUBE_FIELDS,
    metaExtras: [
      { key: "iQube-Designer",     value: "KNYT Ecosystem" },
      { key: "Owner-Type",         value: "Person" },
      { key: "Owner-Identifiability", value: "Semi-Identifiable" },
      { key: "Related-iQubes",     value: ["QriptoPersona", "MetisQube", "EcosystemQube"] },
      { key: "persona_type",       value: "knyt" },
    ],
  },
  {
    name: "Qripto Persona iQube",
    description: "Qriptopian ecosystem persona — crypto-native wallet identity, social presence, and Web3 interests.",
    iQubeType: "DataQube",
    iQubeInstanceType: "template",
    sensitivityScore: 6,
    verifiabilityScore: 7,
    accuracyScore: 8,
    riskScore: 5,
    fields: QRIPTO_BLAKQUBE_FIELDS,
    metaExtras: [
      { key: "iQube-Designer",        value: "Aigent" },
      { key: "Owner-Type",            value: "Person" },
      { key: "Owner-Identifiability", value: "Semi-Identifiable" },
      { key: "Related-iQubes",        value: ["MetisQube", "VeniceQube", "WalletQube"] },
      { key: "persona_type",          value: "qripto" },
    ],
  },
];

// ─── Upsert logic ─────────────────────────────────────────────────────────────

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY!}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePost(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY!}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  for (const tpl of TEMPLATES) {
    // Check if template already exists by name
    const existing = await supabaseGet(
      `iqube_templates?name=eq.${encodeURIComponent(tpl.name)}&select=id,name&limit=1`
    );
    if (existing.length > 0) {
      console.log(`✓ Template already exists: "${tpl.name}" (${existing[0].id})`);
      continue;
    }

    const record = {
      name: tpl.name,
      description: tpl.description,
      iqube_type: tpl.iQubeType,
      instance_type: tpl.iQubeInstanceType,
      sensitivity_score: Math.round(tpl.sensitivityScore),
      verifiability_score: Math.round(tpl.verifiabilityScore),
      accuracy_score: Math.round(tpl.accuracyScore),
      risk_score: Math.round(tpl.riskScore),
      blakqube_labels: tpl.fields,
      metaqube_extras: tpl.metaExtras,
      provenance: 0,
      visibility: "private",
      created_at: new Date().toISOString(),
    };

    const [created] = await supabasePost("iqube_templates", record);
    console.log(`✅ Created template: "${tpl.name}" (${created.id})`);
  }

  console.log("\nDone. Persona iQube templates are ready.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
