/**
 * One-off: operator-assisted registration of Ian's OCSGA v1.3 artifact as
 * Party B on the OCSGA Boundary Research exchange, through the exact same
 * canonical `registerArtifactOperatorAssisted` implementation
 * (services/research/reciprocalExchange.ts) the admin route
 * (app/api/admin/exchanges/[exchangeId]/register-counterparty-artifact)
 * calls. No registration logic is reimplemented here — this script only
 * reads the real file bytes, verifies them against the expected fingerprint
 * and size, and invokes the unmodified function.
 *
 * Party B membership must ALREADY exist (bound via
 * scripts/bind-ian-ocsga-counterparty.ts / the operator-assisted admission
 * route) — this script does not touch admission and refuses to proceed
 * unless the exchange's current Party B is exactly Ian's persona.
 *
 * Usage:
 *   npx tsx scripts/register-ian-ocsga-artifact.ts \
 *     --operator-persona-id=<uuid of the persona performing this registration> \
 *     --artifact-file="/path/to/OCSGA Constitutional Master v1.3.docx"
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { registerArtifactOperatorAssisted, loadExchange } from '../services/research/reciprocalExchange';

const OCSGA_EXCHANGE_ID = '0b4134a6-6246-48a8-98f6-e3a22fcd18b3';
const IAN_PERSONA_ID = '29d22f83-a3cc-49d9-90be-a39391e9d8ae';
const EXPECTED_SHA256 = '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331';
const EXPECTED_SIZE_BYTES = 33337;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

async function main() {
  const operatorPersonaId = argValue('operator-persona-id');
  const artifactFile = argValue('artifact-file');

  if (!operatorPersonaId || !artifactFile) {
    console.error(
      'Usage: npx tsx scripts/register-ian-ocsga-artifact.ts --operator-persona-id=<uuid> --artifact-file="<path to OCSGA v1.3 docx>"',
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ── 1. Read the real bytes and verify size + SHA-256 BEFORE anything else.
  const resolvedPath = path.resolve(artifactFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(resolvedPath);

  if (bytes.length !== EXPECTED_SIZE_BYTES) {
    console.error(`❌ Size mismatch. Expected ${EXPECTED_SIZE_BYTES} bytes, got ${bytes.length}. Refusing to register.`);
    process.exit(1);
  }

  const contentHash = createHash('sha256').update(bytes).digest('hex');
  if (contentHash !== EXPECTED_SHA256) {
    console.error(`❌ SHA-256 mismatch. Expected ${EXPECTED_SHA256}, computed ${contentHash}. Refusing to register.`);
    process.exit(1);
  }
  console.log(`✓ File verified: ${bytes.length} bytes, SHA-256 ${contentHash}`);

  // ── 2. Confirm the exchange's CURRENT Party B is exactly Ian's persona —
  //    an out-of-band, read-only check before touching anything.
  const loaded = await loadExchange(admin, OCSGA_EXCHANGE_ID);
  if (!loaded.ok) {
    console.error(`❌ Could not load exchange ${OCSGA_EXCHANGE_ID}: ${loaded.error}`);
    process.exit(1);
  }
  if (loaded.exchange.counterpartyPersonaId !== IAN_PERSONA_ID) {
    console.error(
      `❌ Exchange ${OCSGA_EXCHANGE_ID}'s counterparty_persona_id is ${loaded.exchange.counterpartyPersonaId ?? 'NULL'}, not Ian's persona ${IAN_PERSONA_ID}. Admission is not in the expected state — refusing.`,
    );
    process.exit(1);
  }
  console.log(`✓ Confirmed live: exchange ${OCSGA_EXCHANGE_ID} counterparty_persona_id (Party B) = ${IAN_PERSONA_ID}`);

  // ── 3. Live proof the service itself rejects a bound principal that is
  //    NOT the exchange's current Party B — a synthetic, guaranteed-unbound
  //    persona id. registerArtifactOperatorAssisted returns 'not-a-party'
  //    before any write, so this call is side-effect-free.
  const NEVER_BOUND_PERSONA_ID = '00000000-0000-0000-0000-000000000000';
  const negativeProbe = await registerArtifactOperatorAssisted(admin, {
    exchangeId: OCSGA_EXCHANGE_ID,
    boundPrincipalPersonaId: NEVER_BOUND_PERSONA_ID,
    registeringOperatorPersonaId: operatorPersonaId,
    authorityBasis: 'pre-flight invariant probe — must be refused, never written',
    title: 'INVARIANT PROBE — must be refused',
    artifactClass: 'probe',
    sourceType: 'immutable-reference',
    sourceReference: 'invariant-probe',
    contentHash: 'f'.repeat(64),
    ownershipDeclaration: 'probe',
    rightsForExchange: 'probe',
  });
  if (negativeProbe.ok) {
    console.error(
      '❌ CRITICAL: registerArtifactOperatorAssisted accepted a bound principal that is not a party on this exchange. Aborting — the invariant this whole repair exists to enforce is not holding.',
    );
    process.exit(1);
  }
  console.log(`✓ Invariant proof passed live: a non-member principal was refused (${negativeProbe.error})`);

  // ── 4. The real registration — exactly once.
  const architectureRepresented = 'OCSGA Enterprise Reference Architecture & Governance Framework v1.0';
  const baselineLabel = 'OCSGA Constitutional Master v1.3';
  const authorityBasis =
    `Principal (Ian, persona ${IAN_PERSONA_ID}) supplied this artifact and explicitly authorized ` +
    `operator-assisted registration on the OCSGA Boundary Research reciprocal exchange (${OCSGA_EXCHANGE_ID}). ` +
    `Confirmation, freeze, and signature remain reserved exclusively to the principal.`;

  console.log(`\nRegistering artifact for Party B (Ian, ${IAN_PERSONA_ID}) as operator ${operatorPersonaId}...\n`);

  const result = await registerArtifactOperatorAssisted(admin, {
    exchangeId: OCSGA_EXCHANGE_ID,
    boundPrincipalPersonaId: IAN_PERSONA_ID,
    registeringOperatorPersonaId: operatorPersonaId,
    authorityBasis,
    title: 'OCSGA Constitutional Master Authoring Template v1.3',
    artifactClass: 'architecture-map',
    description: `Architecture represented: ${architectureRepresented}. Baseline label: ${baselineLabel}.`,
    sourceType: 'immutable-reference',
    sourceReference: `operator-assisted-registration:${path.basename(resolvedPath)}`,
    contentHash,
    mimeType: DOCX_MIME_TYPE,
    ownershipDeclaration:
      'This artifact remains owned and governed by the bound principal (Ian); recording this exchange confers no ownership transfer to the registering operator or to Party A.',
    rightsForExchange:
      "Registered under the principal's explicit authorization and active research-lab grant, confirmed via canonical exchange membership as Party B on this reciprocal exchange.",
  });

  if (!result.ok) {
    console.error(`❌ Registration refused: ${result.error}`);
    process.exit(1);
  }

  const finalExchange = await loadExchange(admin, OCSGA_EXCHANGE_ID);

  console.log('\n=== REGISTRATION COMPLETE ===');
  console.log('exchange ID:', OCSGA_EXCHANGE_ID);
  console.log('artifact ID:', result.artifact.id);
  console.log('party:', result.artifact.party);
  console.log('bound principal (Party B):', IAN_PERSONA_ID);
  console.log('registering operator persona:', result.artifact.registeringOperatorPersonaId);
  console.log('content hash:', result.artifact.contentHash);
  console.log('MIME:', result.artifact.mimeType);
  console.log('origin channel:', result.artifact.originChannel);
  console.log('authority basis:', result.artifact.authorityBasis);
  console.log('pending principal attestation:', result.artifact.pendingPrincipalAttestation);
  console.log('resulting canonical exchange state:', finalExchange.ok ? finalExchange.exchange.status : `<lookup failed: ${finalExchange.error}>`);
  console.log('\nSTOPPED — no confirm, freeze, or sign performed. Party A untouched.');
}

const isRunDirectly = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isRunDirectly) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
