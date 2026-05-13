/**
 * Create .env.production from process.env
 * This works because Node.js can access Amplify env vars even when shell cannot
 */

const fs = require('fs');

const envVars = [
  'PAYPAL_MODE',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'CODEX_MASTER_KEY',
  'AUTONOMYS_API_KEY',
  'NEXTAUTH_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_IMAGE_MODEL',
  'VENICE_API_KEY',
  'VENICE_MODEL',
  'VENICE_IMAGE_MODEL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  // ── Phase 6.b — Google Workspace OAuth (Aigent Me connectors) ────────
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_OAUTH_STATE_HMAC_KEY',
  'GOOGLE_OAUTH_RETURN_URL',
  // ── Phase 5 — Aigent Me specialist router LLM model override ─────────
  'SPECIALIST_LLM_MODEL',
  // ── Phase 2 — ExperienceQube DB timeout tuning ──────────────────────
  'EXPERIENCE_QUBE_DB_TIMEOUT_MS',
  'CHAINGPT_API_KEY',
  'CHAIN_GPT_API_KEY',
  'CHAINGPT_API_SECRET',
  'CHAIN_GPT_API_SECRET',
  'CHAINGPT_MODEL',
  'FIO_API_ENDPOINT',
  'FIO_CHAIN_ID',
  'FIO_SYSTEM_PUBLIC_KEY',
  'FIO_SYSTEM_PRIVATE_KEY',
  'FIO_MOCK_MODE',
  'AGENT_KEY_ENCRYPTION_SECRET',
  'CONTENT_ENCRYPTION_MASTER_KEY',
  'COHORT_ESCROW_SECRET',
  'COHORT_ALIAS_EPOCH',
  'ACCESS_SPINE_ENFORCE',
  'ACCESS_DEBUG_OPEN',
  'FIO_API_ENDPOINT_DEDICATED',
  'TREASURY_PRIVATE_KEY',
  'DISCORD_BOT_TOKEN',
  'DISCORD_METAKNYTS_CHANNEL_ID',
  'AA_JWT_SECRET',
  'SUPABASE_JWT_SECRET',
  // Persona session token HMAC signing key — used by
  // services/identity/personaSessionToken.ts to sign T1 opaque tokens
  // returned by /api/wallet/active-persona. Must be >=32 chars; falls
  // back to NEXTAUTH_SECRET if absent.
  'PERSONA_SESSION_TOKEN_HMAC_KEY',
  'NEXTAUTH_SECRET',
  'BROWSERBASE_API_KEY',
  'BROWSERBASE_PROJECT_ID',
  'BROWSERBASE_API_BASE_URL',
  'BROWSERBASE_REGION',
  'BROWSERBASE_CONTEXT_ID',
  'BROWSERBASE_KEEP_ALIVE',
  'BROWSERBASE_PROXIES',
  'BROWSERBASE_SESSION_TIMEOUT_SECONDS',
  // Mailjet email adapter
  'MAILJET_API_KEY',
  'MAILJET_SECRET_KEY',
  'MAILJET_FROM_EMAIL',
  'MAILJET_FROM_NAME',
  'MAILJET_TEMPLATE_TOP_SHELF',
  'MAILJET_TEMPLATE_ZERO_KNYT',
  'MAILJET_TEMPLATE_REACTIVATION',
  'MAILJET_TEMPLATE_GENERAL',
  'MAILJET_BCC_EMAIL',
  // Campaign tracking
  'KICKSTARTER_CAMPAIGN_URL',
  'KNYT_WHEEL_TOTAL_SLOTS',
  'KNYT_WHEEL_WEBHOOK_URL',
  'MAKE_KNYT_WEBHOOK_URL',
  // Make.com workflow adapter
  'MAKE_API_TOKEN',
  'MAKE_TEAM_ID',
  'MAKE_API_BASE_URL',
  // Admin monitor — receives every campaign email as first recipient
  'CAMPAIGN_ADMIN_EMAIL',
  // Marketa portal
  'MARKETA_CREATOR_DID',
  'MARKETA_SYSTEM_AGENT_ID',
  'SEQUENCE_DISPATCH_SECRET',
  'LVB_BRIDGE_DEFAULT_PERSONA_ID',
  // iQubeNFT — ERC721 on-chain anchor
  'IQUBE_NFT_CONTRACT_ADDRESS',
  'IQUBE_NFT_CHAIN_ID',
  'IQUBE_NFT_RPC_URL',
  'EVM_DEPLOYER_KEY',
  // ContentQube Phase 7B — Base TokenQube minting
  'BASE_MINTER_PRIVATE_KEY',
  'CONTENT_QUBE_ERC1155_ADDRESS',
  'CONTENT_QUBE_ERC721_ADDRESS',
  'BASE_RPC_URL',
  // BTC / ICP custody
  'BTC_CUSTODY_ENABLED',
  'BTC_NETWORK',
  'BTC_CUSTODIAN_KEY_REF',
  'BTC_SIGNER_CANISTER_ID',
  // Wallet alias privacy refactor (2026-04-29)
  'WALLET_ALIAS_HMAC_KEY',
  'WALLET_ALIAS_CHALLENGE_DOMAIN',
  'ESCROW_CANISTER_ID',
  'ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE',
  // Operator ops bearer for backstop tools (paypal/recover, etc.).
  // Set to any random ≥32-char string. Generate locally with:
  //   openssl rand -hex 32
  'ADMIN_OPS_TOKEN',
  // KNYT rep/rewards/tasks v2 — referral share-link HMAC secret.
  // Used by /api/wallet/tasks/share-link to derive deterministic per-persona
  // referral codes for Bring-a-Knight + Herald. Falls back to NEXTAUTH_SECRET
  // when unset; rotation via REFERRAL_SHARE_EPOCH (default 'v1').
  'REFERRAL_SHARE_SECRET',
  'REFERRAL_SHARE_EPOCH',
];

let content = '';

// Write explicit vars
for (const key of envVars) {
  const value = process.env[key] || '';
  content += `${key}=${value}\n`;
}

// Add all NEXT_PUBLIC_ vars
for (const key in process.env) {
  if (key.startsWith('NEXT_PUBLIC_')) {
    content += `${key}=${process.env[key]}\n`;
  }
}

fs.writeFileSync('.env.production', content, 'utf8');
console.log('✅ Created .env.production with', content.split('\n').filter(Boolean).length, 'variables');
