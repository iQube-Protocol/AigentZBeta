#!/usr/bin/env node
// @agentiq/agentiq-sdk — CLI
// Requires Node.js 18+ (native fetch)
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '0.1.0';
const PKG = '@agentiq/agentiq-sdk';

// ── output helpers ────────────────────────────────────────────────────────────

const ok  = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const err = (msg) => console.error(`\x1b[31m✗\x1b[0m ${msg}`);
const dim = (msg) => console.log(`\x1b[2m${msg}\x1b[0m`);
const bold = (msg) => console.log(`\x1b[1m${msg}\x1b[0m`);

function write(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  ok(filePath.replace(process.cwd() + path.sep, ''));
}

// ── agentiq init <name> ───────────────────────────────────────────────────────

function cmdInit(name) {
  if (!name) {
    err('Name required. Usage: agentiq init <name>');
    process.exit(1);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const root = path.resolve(process.cwd(), slug);

  if (fs.existsSync(root)) {
    err(`Directory already exists: ${root}`);
    process.exit(1);
  }

  console.log(`\nScaffolding AgentiQ OS cartridge: \x1b[1m${slug}\x1b[0m\n`);

  // codexes/packs/<slug>/meta.json
  write(
    path.join(root, 'codexes', 'packs', slug, 'meta.json'),
    JSON.stringify({
      pack_id: `pack_${slug.replace(/-/g, '_')}_v0`,
      name,
      description: `${name} cartridge`,
      version: '0.1.0',
      visibility: 'public',
      orientation: 'developer',
      tags: [slug],
      owner: 'your-org',
      created_at: new Date().toISOString(),
    }, null, 2),
  );

  // codexes/packs/<slug>/collections.json
  write(
    path.join(root, 'codexes', 'packs', slug, 'collections.json'),
    JSON.stringify({
      collections: [
        {
          id: 'col_start_here',
          title: 'Start Here',
          description: 'Introduction and quick-start',
          items: ['items/start-here.md'],
        },
        {
          id: 'col_docs',
          title: 'Docs',
          description: 'Reference documentation',
          items: [],
        },
      ],
    }, null, 2),
  );

  // codexes/packs/<slug>/items/start-here.md
  write(
    path.join(root, 'codexes', 'packs', slug, 'items', 'start-here.md'),
    `# Welcome to ${name}\n\nThis is your cartridge start-here guide.\n\nEdit this file to describe your cartridge and what developers should do first.\n\n## What This Cartridge Does\n\nDescribe your cartridge here.\n\n## Quick Start\n\n1. Read the docs in this cartridge\n2. Create your developer persona (Persona tab)\n3. Grant bounded delegation (Delegation tab)\n4. Build and submit your first asset (Registry tab)\n`,
  );

  // agentiq.config.js
  write(
    path.join(root, 'agentiq.config.js'),
    `// AgentiQ OS Cartridge Configuration
// https://github.com/iQube-Protocol/AgentiQ-OS

module.exports = {
  slug: '${slug}',
  packPath: 'codexes/packs/${slug}',
  trustBand: 'L1_EXPERIMENTAL',

  // Set your AgentiQ OS instance URL.
  // Can also be set via AGENTIQ_API_URL environment variable.
  // apiUrl: 'http://localhost:3000',
};
`,
  );

  // package.json
  write(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: slug,
      version: '0.1.0',
      description: `${name} AgentiQ OS cartridge`,
      private: true,
      devDependencies: {
        '@agentiq/agentiq-sdk': `^${VERSION}`,
      },
    }, null, 2),
  );

  // .env.example
  write(
    path.join(root, '.env.example'),
    `# AgentiQ OS instance URL (required for publish and SDK calls)
AGENTIQ_API_URL=http://localhost:3000

# Your developer persona ID (optional — can be passed per-call)
# AGENTIQ_PERSONA_ID=

# SDK key (if required by your instance)
# AGENTIQ_SDK_KEY=
`,
  );

  console.log(`\n\x1b[1mCartridge created at ./${slug}\x1b[0m\n`);
  console.log('Next steps:');
  dim(`  cd ${slug}`);
  dim('  npm install');
  dim(`  # Edit codexes/packs/${slug}/meta.json and items/start-here.md`);
  dim('  # Set AGENTIQ_API_URL in .env or agentiq.config.js');
  dim('  npx @agentiq/agentiq-sdk publish\n');
}

// ── agentiq publish ───────────────────────────────────────────────────────────

async function cmdPublish(args) {
  const flag = (name) => {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : null;
  };

  let packPath = flag('--pack');
  const trustBandArg = flag('--trust-band');
  const personaIdArg = flag('--persona-id');

  // Load config
  const configPath = path.resolve(process.cwd(), 'agentiq.config.js');
  let config = {};
  if (fs.existsSync(configPath)) {
    try { config = require(configPath); } catch (e) {
      err(`Failed to load agentiq.config.js: ${e.message}`);
    }
  }

  // Resolve pack path
  if (!packPath) packPath = config.packPath ?? null;
  if (!packPath) {
    const packsDir = path.resolve(process.cwd(), 'codexes', 'packs');
    if (fs.existsSync(packsDir)) {
      const packs = fs.readdirSync(packsDir).filter(
        (f) => fs.statSync(path.join(packsDir, f)).isDirectory(),
      );
      if (packs.length === 1) {
        packPath = path.join('codexes', 'packs', packs[0]);
      } else if (packs.length > 1) {
        err(`Multiple packs found. Specify with --pack <path>: ${packs.join(', ')}`);
        process.exit(1);
      }
    }
  }
  if (!packPath) {
    err('No pack found. Run from your cartridge root or use --pack <path>');
    process.exit(1);
  }

  const metaPath = path.resolve(process.cwd(), packPath, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    err(`meta.json not found at: ${metaPath}`);
    process.exit(1);
  }

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (e) {
    err(`Failed to read meta.json: ${e.message}`);
    process.exit(1);
  }

  const apiUrl = (config.apiUrl ?? process.env.AGENTIQ_API_URL ?? '').replace(/\/$/, '');
  if (!apiUrl) {
    err('API URL required. Set AGENTIQ_API_URL or add apiUrl to agentiq.config.js');
    process.exit(1);
  }

  const trustBand = trustBandArg ?? config.trustBand ?? meta.trust_band ?? 'L1_EXPERIMENTAL';
  const personaId = personaIdArg ?? config.personaId ?? process.env.AGENTIQ_PERSONA_ID ?? undefined;

  let collectionsData = { collections: [] };
  const collectionsPath = path.resolve(process.cwd(), packPath, 'collections.json');
  if (fs.existsSync(collectionsPath)) {
    try { collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8')); } catch {}
  }

  const name = meta.name ?? meta.pack_id ?? path.basename(packPath);
  console.log(`\nPublishing \x1b[1m${name}\x1b[0m as ${trustBand} to ${apiUrl}\n`);

  let res, data;
  try {
    res = await fetch(`${apiUrl}/api/codex/agentiq-os/registry-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: personaId,
        qube_type: meta.qube_type ?? 'SkillQube',
        name,
        description: meta.description ?? '',
        tags: meta.tags ?? [],
        trust_band: trustBand,
        metadata: {
          pack_id: meta.pack_id,
          version: meta.version,
          collections: (collectionsData.collections ?? []).length,
        },
      }),
    });
    data = await res.json();
  } catch (e) {
    err(`Request failed: ${e.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    err(`Publish failed (HTTP ${res.status}): ${data.error ?? 'Unknown error'}`);
    process.exit(1);
  }

  ok(`Draft created: ${data.draft?.id ?? data.event_id ?? 'ok'}`);
  ok(`Qube type: ${data.qube_type}`);

  if (data.instructions?.length) {
    console.log('\nNext steps:');
    data.instructions.forEach((i) => dim(`  • ${i}`));
  }
  console.log('');
}

// ── help ──────────────────────────────────────────────────────────────────────

function showHelp() {
  bold(`\n${PKG} v${VERSION} — AgentiQ OS Developer CLI\n`);
  console.log('Usage:\n');
  console.log('  agentiq init <name>                    Scaffold a new AgentiQ OS cartridge');
  console.log('  agentiq publish                        Submit cartridge pack to the Registry');
  console.log('  agentiq publish --pack <path>          Specify pack directory explicitly');
  console.log('  agentiq publish --trust-band <band>    Override trust band');
  console.log('  agentiq publish --persona-id <id>      Set persona ID for submission');
  console.log('  agentiq --version                      Print version');
  console.log('  agentiq --help                         Show this help\n');
  console.log('Environment variables:\n');
  console.log('  AGENTIQ_API_URL       Your AgentiQ OS instance URL (required for publish)');
  console.log('  AGENTIQ_SDK_KEY       SDK API key if required by your instance');
  console.log('  AGENTIQ_PERSONA_ID    Default persona ID for submissions\n');
  console.log('Trust bands:\n');
  console.log('  L1_EXPERIMENTAL          Open — anyone can submit');
  console.log('  L2_VERIFIED_COMMUNITY    Community review required');
  console.log('  L3_PRODUCTION_CANDIDATE  Registry candidate');
  console.log('  L4_PRODUCTION_APPROVED   Production approved\n');
  console.log('Examples:\n');
  dim('  agentiq init my-skill-cartridge');
  dim('  AGENTIQ_API_URL=http://localhost:3000 agentiq publish');
  dim('  agentiq publish --trust-band L2_VERIFIED_COMMUNITY');
  dim('  agentiq publish --pack codexes/packs/my-pack --persona-id abc123\n');
  console.log('Docs: https://github.com/iQube-Protocol/AgentiQ-OS\n');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') { showHelp(); return; }
  if (cmd === '--version' || cmd === '-v') { console.log(`${PKG} v${VERSION}`); return; }
  if (cmd === 'init') { cmdInit(args[1]); return; }
  if (cmd === 'publish') { await cmdPublish(args.slice(1)); return; }

  err(`Unknown command: ${cmd}`);
  console.log('Run `agentiq --help` for usage.');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message ?? String(e));
  process.exit(1);
});
