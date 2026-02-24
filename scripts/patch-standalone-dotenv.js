/**
 * Patch Next.js standalone server.js to load .env.production at runtime
 * This ensures environment variables are available to API routes in Amplify SSR
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), '.next/standalone/server.js');

if (!fs.existsSync(serverPath)) {
  console.log('ℹ️  No .next/standalone/server.js found; skipping patch');
  process.exit(0);
}

let serverCode = fs.readFileSync(serverPath, 'utf8');

// Check if already patched
if (serverCode.startsWith("require('dotenv')")) {
  console.log('ℹ️  server.js already patched');
  process.exit(0);
}

// Inject dotenv config at the very top
const dotenvInject = "require('dotenv').config({ path: __dirname + '/.env.production' });\n";
serverCode = dotenvInject + serverCode;

fs.writeFileSync(serverPath, serverCode, 'utf8');
console.log('✅ Patched server.js to load .env.production at runtime');
