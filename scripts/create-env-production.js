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
  // ── Groq — third-tier STT fallback (Whisper-large-v3, OpenAI-compatible) ─
  'GROQ_API_KEY',
  // ── Cartesia — primary TTS provider (Sonic English, sounds better than OpenAI tts-1) ─
  'CARTESIA_API_KEY',
  'CARTESIA_VOICE_ID',
  'CARTESIA_MODEL',
  'CARTESIA_VERSION',
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
  // ── thirdweb Nebula — server-side inference (secret key via x-secret-key) ──
  // Only these reach the SSR runtime; a key set in Amplify but missing here
  // never reaches process.env (the GITHUB_TOKEN regression class).
  'THIRDWEB_SECRET_KEY',
  'THIRDWEB_CLIENT_ID',
  'THIRDWEB_NEBULA_URL',
  'THIRDWEB_MODEL',
  // ── xAI Grok (OpenAI-compatible) — both key spellings accepted by the adapter ──
  'XAI_API_KEY',
  'GROK_API_KEY',
  'XAI_MODEL',
  'GROK_MODEL',
  // ── Google Gemini (generateContent) — three key spellings accepted ──
  'GEMINI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GEMINI_MODEL',
  // ── Groq (OpenAI-compatible, open-weight Llama) — GROQ_API_KEY already above ──
  'GROQ_MODEL',
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
  // Mailjet webhooks (CRM event tracking + activation inbound replies)
  'MAILJET_WEBHOOK_SECRET',
  // Activation outreach Reply-To — parse-routed inbox for reply auto-flip
  'MARKETA_OUTREACH_REPLY_TO',
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
  // Activation engine scheduled discovery — JSON array of { kind, url } sources
  'MARKETA_DISCOVERY_SOURCES',
  // Polity Passport Bureau — credential HMAC signing (Phase A stub)
  'PASSPORT_BUREAU_CREDENTIAL_SECRET',
  // PersonaQube — Sui + Walrus mint rail (Polity Passport rail).
  // When unset, mintPersonaToSui falls back to stub mode (deterministic
  // fake IDs). Setting all three switches the route to real on-chain mint.
  'SUI_NETWORK',
  'SUI_PACKAGE_ID',
  'SUI_SPONSOR_KEY',
  'WALRUS_PUBLISHER_URL',
  'WALRUS_AGGREGATOR_URL',
  // PersonaQube descriptor encryption — AES-256-GCM. 64 hex chars = 32 bytes.
  'PERSONA_IQUBE_ENCRYPTION_KEY',
  // World ID strong-proof upgrade — Worldcoin Cloud Verifier.
  // When unset, verifyWorldIdProof accepts 'dev-worldid-*' tokens for
  // local testing; production requires both.
  'WORLD_ID_APP_ID',
  'WORLD_ID_ACTION_ID',
  // World ID — client-side IDKit widget needs the public app id.
  'NEXT_PUBLIC_WORLD_ID_APP_ID',
  'NEXT_PUBLIC_WORLD_ID_ACTION_ID',
  // AgentKit policy attestation layer — wraps bounded delegation grants
  // with a cryptographic attestation. Stub mode when unset.
  'AGENTKIT_API_KEY',
  'AGENTKIT_POLICY_ID',
  'AGENTKIT_ATTEST_URL',
  'AGENTKIT_STUB_KEY',
  // ProveKit ZK proof rail — proof_of_personhood +
  // proof_of_delegation_authority in the demo cut. Phase B circuits
  // return shaped placeholders. Stub mode when unset.
  'PROVEKIT_API_KEY',
  'PROVEKIT_CIRCUIT_REGISTRY',
  // ENS L2 subnames via Namestone (gasless). Stub mode when unset.
  'NAMESTONE_API_KEY',
  'NAMESTONE_API_BASE',
  'ENS_PARENT_NAME',
  // Polity Passport Bureau cryptographic issuer key — signs AgentKit
  // attestations + ProveKit proof commitments with EIP-191. Generate
  // once via `node -e "console.log(require('viem/accounts').generatePrivateKey())"`.
  // Public address surfaces at GET /api/polity-passport/issuer.
  'POLITY_ISSUER_PRIVATE_KEY',
  // Walrus HTTP publisher (defaults to mysten public testnet).
  'WALRUS_EPOCHS',
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
  // Polity Passport Bureau — CAPTCHA (Cloudflare Turnstile)
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  // Wallet alias privacy refactor (2026-04-29)
  'WALLET_ALIAS_HMAC_KEY',
  'WALLET_ALIAS_CHALLENGE_DOMAIN',
  'ESCROW_CANISTER_ID',
  'ALLOW_LEGACY_PLAINTEXT_WALLET_WRITE',
  // ICP canister ops — DFX identity PEM for cycle checks + top-ups,
  // wallet canister for sending cycles, canister IDs for cross-chain service
  'DFX_IDENTITY_PEM',
  'DFX_IDENTITY_PEM_PATH',
  'DFX_NETWORK',
  'WALLET_CANISTER_ID',
  'CROSS_CHAIN_SERVICE_CANISTER_ID',
  // Reputation Query Hub (rqh) + Reward Hub — a deployed canister pair
  // (canister_ids.json: rqh zdjf3-…, reward_hub lvo2w-…). Reward/reputation
  // reads in services/crm/taskCanisterService.ts fall back to the hardcoded
  // ids, but the ops health check, services/ops/icpService.ts, and the CDE
  // diagnostics read the env WITHOUT a fallback — so they render "not
  // configured" unless the id reaches the SSR runtime. Allowlisting the plain
  // server vars lets these be provisioned without a NEXT_PUBLIC_ exposure.
  'RQH_CANISTER_ID',
  'REWARD_HUB_CANISTER_ID',
  'CYCLES_PROXY_URL',
  'CYCLES_PROXY_KEY',
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
  // Ops anchor cron trigger token — auth for /api/ops/sync/cron-tick.
  // Server-side cron + K/T policy (2026-05-31). Generate with:
  //   openssl rand -hex 32
  'CRON_TRIGGER_TOKEN',
  // Intent Chain Orchestrator — server-to-server auth for the advancer's
  // dispatched RPC calls (advanceRpcStep → /api/marketa/propose + future
  // actor intakes). Same generation pattern as CRON_TRIGGER_TOKEN.
  // Spec: AGENTIQ_INTENT_CHAINS_SPEC.md §7 + advancer.ts.
  'ORCHESTRATOR_SERVICE_TOKEN',
  // Profile enrichment for the Standing Core wizard (auto-fetch experience/
  // education — LinkedIn OAuth no longer exposes them). Provider-agnostic +
  // OPTIONAL: when unset the wizard falls back to the manual profile-text paste.
  // RECOMMENDED provider is NinjaPear (nubela.co) — the Proxycurl founder's
  // successor; public-sourced, does NOT scrape LinkedIn; keyed on work email or
  // name+company. Set NINJAPEAR_API_KEY (and that's it). NINJAPEAR_BASE_URL is
  // optional (default https://nubela.co). Alternatively, a generic URL provider:
  // LINKEDIN_ENRICH_URL ({url} placeholder) + LINKEDIN_ENRICH_KEY (PROXYCURL_API_KEY
  // honoured as a key alias). Never expose any of these as NEXT_PUBLIC_.
  'NINJAPEAR_API_KEY',
  'NINJAPEAR_BASE_URL',
  'LINKEDIN_ENRICH_URL',
  'LINKEDIN_ENRICH_KEY',
  'PROXYCURL_API_KEY',
  // Dev Command Center (CFS-020 CDE) read-only tool viewports. Set in the
  // Amplify console but MUST be allowlisted here or they never reach the SSR
  // runtime (console vars are build-time only) — the GitHub/Linear panes then
  // read undefined and render "not configured" despite the console showing them.
  // GITHUB_REPOSITORY is optional (github.ts falls back to iQube-Protocol/AigentZBeta).
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
  'LINEAR_API_KEY',
  // Linear lifecycle mirror target team (e.g. 'ENG') — services/linear/lifecycleMirror.ts
  'LINEAR_TEAM_KEY',
];

let content = '';

// Write explicit vars — double-quote values that contain newlines,
// quotes, or PEM markers so dotenv parses them correctly.
function dotenvLine(key, value) {
  if (value.includes('\n') || value.includes('"') || value.includes('-----')) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `${key}="${escaped}"\n`;
  }
  return `${key}=${value}\n`;
}

for (const key of envVars) {
  const value = process.env[key] || '';
  content += dotenvLine(key, value);
}

// Add all NEXT_PUBLIC_ vars
for (const key in process.env) {
  if (key.startsWith('NEXT_PUBLIC_')) {
    content += dotenvLine(key, process.env[key]);
  }
}

fs.writeFileSync('.env.production', content, 'utf8');
console.log('✅ Created .env.production with', content.split('\n').filter(Boolean).length, 'variables');
