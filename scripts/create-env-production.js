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
  'CODEX_MASTER_KEY',
  'AUTONOMYS_API_KEY',
  'NEXTAUTH_URL',
  'OPENAI_API_KEY',
  'FIO_API_ENDPOINT',
  'FIO_CHAIN_ID',
  'FIO_SYSTEM_PUBLIC_KEY',
  'FIO_SYSTEM_PRIVATE_KEY',
  'FIO_MOCK_MODE',
  'AGENT_KEY_ENCRYPTION_SECRET',
  'TREASURY_PRIVATE_KEY',
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
