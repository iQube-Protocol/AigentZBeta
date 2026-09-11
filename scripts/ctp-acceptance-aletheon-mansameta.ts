/**
 * CTP-001A Phase 1 — live two-channel acceptance rehearsal (2026-09-01).
 *
 * Creates TWO fresh, isolated "acceptance/rehearsal" reciprocal exchanges,
 * each ending in exactly one pending-principal-attestation artifact, so the
 * bound principal can clear one via the web channel and the other via MCP —
 * the cross-channel implementation-singularity proof CTP-001A Phase 1
 * requires (`ctp.exchange.artifact.confirm`, registered in
 * services/ctp/primitives/exchangeArtifactConfirm.ts). Every write below
 * goes through the EXISTING, UNMODIFIED canonical service functions in
 * services/research/reciprocalExchange.ts — nothing here reimplements
 * admission, deposit, invitation, or operator-assisted registration logic.
 *
 * Identity resolution (operator's explicit instruction, 2026-09-01):
 *   - Bound principal on BOTH exchanges: Mansa Meta's existing PersonaQube
 *     persona (`personas.type = 'PersonaQube'`).
 *   - Registering operator on BOTH operator-assisted registrations:
 *     Aletheon's existing AigentMe persona PROJECTION
 *     (`personas.type = 'AigentMe'`, `app_origin = 'aigent-me'`,
 *     `root_did = agent_root_identity.did_uri` for the 'aletheon'
 *     agent_card_slug — the exact join `services/agents/
 *     provisionAgentWalletPersona.ts` already uses as its idempotency key).
 *     This is NOT Aletheon's `agent_root_identity.id` — a different
 *     identifier vocabulary entirely (`types/constitutionalContext.ts`,
 *     `services/agents/agentIdentifiers.ts`) that
 *     `registerArtifactOperatorAssisted`'s `registeringOperatorPersonaId`
 *     does not accept.
 *
 * Both persona ids are resolved LIVE from the identity spine — never
 * hardcoded. Before any write, this script proves — through the REAL,
 * unmodified `getActivePersona()` / `isCartridgeAdmin()` the platform's own
 * routes call — that:
 *   1. getActivePersona() resolves the operator's session with Aletheon's
 *      AigentMe persona explicitly active, via the same `x-persona-id`
 *      explicit-selection mechanism the platform's own routes accept
 *      (services/identity/getActivePersona.ts, source priority #2);
 *   2. isCartridgeAdmin(context, 'irl-cartridge') === true for that context;
 *   3. Aletheon's persona id differs from Mansa Meta's persona id.
 * A failure in any of these three is reported as an IDENTITY-SPINE DEFECT
 * and the script stops before any write — no new persona is ever created,
 * and no identifier is substituted, to route around it.
 *
 * Usage:
 *   npx tsx scripts/ctp-acceptance-aletheon-mansameta.ts \
 *     --operator-email=<the shared auth profile's email> \
 *     --artifact-file="/path/to/OCSGA Constitutional Master v1.3.docx"
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { NextRequest } from 'next/server';
import { getActivePersona } from '../services/identity/getActivePersona';
import { isCartridgeAdmin } from '../services/access/requireCartridgeAdmin';
import {
  createExchange,
  depositArtifact,
  inviteCounterparty,
  joinExchange,
  registerArtifactOperatorAssisted,
  loadExchange,
} from '../services/research/reciprocalExchange';

const EXPECTED_SHA256 = '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331';
const EXPECTED_SIZE_BYTES = 33337;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CARTRIDGE_SLUG = 'irl-cartridge';

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

// ── Identity resolution — every id read live, never hardcoded ─────────────

async function resolveOperatorAuthProfileId(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin
    .from('crm_auth_profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`crm_auth_profiles lookup failed: ${error.message}`);
  if (!data?.id) throw new Error(`No crm_auth_profiles row for email ${email}`);
  return String(data.id);
}

/** The exact join services/agents/provisionAgentWalletPersona.ts uses as its
 *  idempotency key — reused here read-only, never reimplemented. */
async function resolveAletheonAigentMePersonaId(admin: SupabaseClient, operatorAuthProfileId: string): Promise<string> {
  const { data: agentRoot, error: agentRootErr } = await admin
    .from('agent_root_identity')
    .select('id, did_uri')
    .eq('agent_card_slug', 'aletheon')
    .maybeSingle();
  if (agentRootErr) throw new Error(`agent_root_identity lookup failed: ${agentRootErr.message}`);
  if (!agentRoot?.did_uri) throw new Error("No agent_root_identity row with agent_card_slug='aletheon'");

  const { data: personaRows, error: personaErr } = await admin
    .from('personas')
    .select('id, type, app_origin, status, display_name')
    .eq('auth_profile_id', operatorAuthProfileId)
    .eq('app_origin', 'aigent-me')
    .eq('root_did', agentRoot.did_uri)
    .eq('status', 'active');
  if (personaErr) throw new Error(`personas lookup (Aletheon) failed: ${personaErr.message}`);
  const rows = personaRows ?? [];
  if (rows.length === 0) {
    throw new Error(
      `No active personas row with app_origin='aigent-me' and root_did='${agentRoot.did_uri}' owned by auth profile ${operatorAuthProfileId} — Aletheon's AigentMe persona projection does not exist for this operator.`,
    );
  }
  if (rows.length > 1) {
    throw new Error(
      `Ambiguous: ${rows.length} active AigentMe personas bound to root_did='${agentRoot.did_uri}' under auth profile ${operatorAuthProfileId}. Refusing to guess which is Aletheon's.`,
    );
  }
  if (rows[0].type !== 'AigentMe') {
    throw new Error(`Resolved persona ${rows[0].id} has type='${rows[0].type}', not 'AigentMe' — refusing.`);
  }
  return String(rows[0].id);
}

async function resolveMansaMetaPrincipalPersonaId(admin: SupabaseClient, operatorAuthProfileId: string): Promise<string> {
  const { data: personaRows, error } = await admin
    .from('personas')
    .select('id, type, display_name, status')
    .eq('auth_profile_id', operatorAuthProfileId)
    .eq('type', 'PersonaQube')
    .eq('status', 'active')
    .ilike('display_name', '%Mansa Meta%');
  if (error) throw new Error(`personas lookup (Mansa Meta) failed: ${error.message}`);
  const rows = personaRows ?? [];
  if (rows.length === 0) {
    throw new Error(
      `No active PersonaQube persona with display_name matching 'Mansa Meta' owned by auth profile ${operatorAuthProfileId}.`,
    );
  }
  if (rows.length > 1) {
    throw new Error(`Ambiguous: ${rows.length} active PersonaQube personas match 'Mansa Meta'. Refusing to guess.`);
  }
  return String(rows[0].id);
}

// ── Phase 1 — prove the identity-spine path for real, before any write ────

async function proveIdentitySpine(operatorAuthProfileId: string, aletheonPersonaId: string, mansaMetaPersonaId: string) {
  console.log('\n=== PHASE 1: identity-spine proof (via the real, unmodified route path) ===\n');

  if (aletheonPersonaId === mansaMetaPersonaId) {
    throw new Error(
      `IDENTITY-SPINE DEFECT: Aletheon's resolved persona id equals Mansa Meta's (${aletheonPersonaId}) — these must be distinct personas.`,
    );
  }
  console.log(`✓ Check 3 passed live: Aletheon persona (${aletheonPersonaId}) !== Mansa Meta persona (${mansaMetaPersonaId})`);

  // Construct a real NextRequest carrying the SAME two caller-identity
  // signals the platform's own server-to-server / script callers use
  // (services/wallet/personaRepo.ts's x-auth-profile-id path, and
  // getActivePersona's own x-persona-id explicit-selection source #2) —
  // never a mock, never a reimplementation of getActivePersona's logic.
  const request = new NextRequest('https://dev-beta.aigentz.me/api/research/exchanges/_probe/actions', {
    method: 'POST',
    headers: {
      'x-auth-profile-id': operatorAuthProfileId,
      'x-persona-id': aletheonPersonaId,
    },
  });

  const context = await getActivePersona(request);
  if (!context) {
    throw new Error('IDENTITY-SPINE DEFECT: getActivePersona(request) returned null for the operator auth profile with x-persona-id set to Aletheon.');
  }
  if (context.personaId !== aletheonPersonaId) {
    throw new Error(
      `IDENTITY-SPINE DEFECT: getActivePersona() resolved personaId='${context.personaId}' (source='${context.source}'), not Aletheon's persona id '${aletheonPersonaId}' despite the row being owned and active. Not substituting — reporting per instruction.`,
    );
  }
  console.log(`✓ Check 1 passed live: getActivePersona() resolved Aletheon explicitly active (source='${context.source}')`);

  const admin = isCartridgeAdmin(context, CARTRIDGE_SLUG);
  if (!admin) {
    throw new Error(
      `IDENTITY-SPINE DEFECT: isCartridgeAdmin(context, '${CARTRIDGE_SLUG}') === false for the resolved Aletheon context. cartridgeFlags=${JSON.stringify(context.cartridgeFlags)}`,
    );
  }
  console.log(`✓ Check 2 passed live: isCartridgeAdmin(context, '${CARTRIDGE_SLUG}') === true`);

  console.log('\nAll three pre-flight checks passed against the real code path. Proceeding to Phase 2.\n');
}

// ── Phase 2 — one fresh, isolated acceptance exchange per channel ─────────

async function buildAcceptanceExchange(
  admin: SupabaseClient,
  channel: 'web' | 'mcp',
  aletheonPersonaId: string,
  mansaMetaPersonaId: string,
  artifactBytes: Buffer,
  contentHash: string,
  artifactFileName: string,
) {
  console.log(`\n=== Building ${channel}-channel acceptance/rehearsal exchange ===\n`);

  const created = await createExchange(admin, {
    initiatorPersonaId: aletheonPersonaId,
    title: `CTP-001A Phase 1 acceptance rehearsal — ${channel} channel`,
    purpose:
      'CTP-001A Phase 1 cross-channel implementation-singularity acceptance rehearsal. Not a substantive research exchange — created solely to exercise ctp.exchange.artifact.confirm live.',
    permittedPurpose: 'ctp-acceptance-rehearsal',
  });
  if (!created.ok) throw new Error(`createExchange (${channel}) failed: ${created.error}`);
  const exchangeId = created.exchange.id;
  console.log(`✓ createExchange (${channel}): ${exchangeId}`);

  const deposited = await depositArtifact(admin, {
    exchangeId,
    personaId: aletheonPersonaId,
    title: `Acceptance rehearsal — Party A placeholder (${channel})`,
    artifactClass: 'acceptance-rehearsal',
    description: 'Placeholder Party A deposit required to open the exchange for invitation. Carries no research content.',
    sourceType: 'immutable-reference',
    sourceReference: `ctp-acceptance-rehearsal:party-a-placeholder:${channel}`,
    contentHash: createHash('sha256').update(`ctp-acceptance-rehearsal-party-a-${channel}`).digest('hex'),
    ownershipDeclaration: 'Placeholder rehearsal artifact; confers no rights.',
    rightsForExchange: 'Rehearsal only.',
  });
  if (!deposited.ok) throw new Error(`depositArtifact (${channel}) failed: ${deposited.error}`);
  console.log(`✓ depositArtifact (${channel}): Party A artifact ${deposited.artifact.id}`);

  const invited = await inviteCounterparty(admin, { exchangeId, personaId: aletheonPersonaId });
  if (!invited.ok) throw new Error(`inviteCounterparty (${channel}) failed: ${invited.error}`);
  console.log(`✓ inviteCounterparty (${channel})`);

  const joined = await joinExchange(admin, { exchangeId, rawCode: invited.rawCode, personaId: mansaMetaPersonaId });
  if (!joined.ok) throw new Error(`joinExchange (${channel}) failed: ${joined.error}`);
  console.log(`✓ joinExchange (${channel}): Mansa Meta joined as Party B`);

  const authorityBasis =
    `Principal (Mansa Meta, persona ${mansaMetaPersonaId}) supplied this artifact and explicitly authorized ` +
    `operator-assisted registration, performed by Aletheon (AigentMe persona ${aletheonPersonaId}) acting as ` +
    `Mansa Meta's assigned aigentMe, on the CTP-001A Phase 1 acceptance rehearsal exchange (${exchangeId}, ${channel} channel). ` +
    `Confirmation, freeze, and signature remain reserved exclusively to the principal.`;

  const registered = await registerArtifactOperatorAssisted(admin, {
    exchangeId,
    boundPrincipalPersonaId: mansaMetaPersonaId,
    registeringOperatorPersonaId: aletheonPersonaId,
    authorityBasis,
    title: 'OCSGA Constitutional Master Authoring Template v1.3',
    artifactClass: 'architecture-map',
    description: `CTP-001A Phase 1 acceptance rehearsal (${channel} channel). Architecture represented: OCSGA Enterprise Reference Architecture & Governance Framework v1.0. Baseline label: OCSGA Constitutional Master v1.3.`,
    sourceType: 'immutable-reference',
    sourceReference: `operator-assisted-registration:${channel}:${artifactFileName}`,
    contentHash,
    mimeType: DOCX_MIME_TYPE,
    ownershipDeclaration:
      'This artifact remains owned and governed by the bound principal (Mansa Meta); recording this exchange confers no ownership transfer to the registering operator (Aletheon) or to Party A.',
    rightsForExchange:
      "Registered under the principal's explicit authorization via her assigned aigentMe (Aletheon), confirmed via canonical exchange membership as Party B on this reciprocal exchange.",
  });
  if (!registered.ok) throw new Error(`registerArtifactOperatorAssisted (${channel}) failed: ${registered.error}`);
  console.log(`✓ registerArtifactOperatorAssisted (${channel}): artifact ${registered.artifact.id}, pendingPrincipalAttestation=${registered.artifact.pendingPrincipalAttestation}`);

  return { exchangeId, artifactId: registered.artifact.id };
}

async function main() {
  const operatorEmail = argValue('operator-email');
  const artifactFile = argValue('artifact-file');
  if (!operatorEmail || !artifactFile) {
    console.error(
      'Usage: npx tsx scripts/ctp-acceptance-aletheon-mansameta.ts --operator-email=<email> --artifact-file="<path to OCSGA v1.3 docx>"',
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

  // ── Verify the artifact bytes BEFORE anything else, exactly as the prior
  //    one-off script did — never trust a filename or a prior run's claim.
  const resolvedPath = path.resolve(artifactFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(resolvedPath);
  if (bytes.length !== EXPECTED_SIZE_BYTES) {
    console.error(`❌ Size mismatch. Expected ${EXPECTED_SIZE_BYTES} bytes, got ${bytes.length}. Refusing.`);
    process.exit(1);
  }
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  if (contentHash !== EXPECTED_SHA256) {
    console.error(`❌ SHA-256 mismatch. Expected ${EXPECTED_SHA256}, computed ${contentHash}. Refusing.`);
    process.exit(1);
  }
  console.log(`✓ File verified: ${bytes.length} bytes, SHA-256 ${contentHash}`);

  // ── Resolve every identity LIVE — never hardcoded.
  const operatorAuthProfileId = await resolveOperatorAuthProfileId(admin, operatorEmail);
  console.log(`✓ Resolved operator auth profile: ${operatorAuthProfileId}`);
  const aletheonPersonaId = await resolveAletheonAigentMePersonaId(admin, operatorAuthProfileId);
  console.log(`✓ Resolved Aletheon's AigentMe persona projection: ${aletheonPersonaId}`);
  const mansaMetaPersonaId = await resolveMansaMetaPrincipalPersonaId(admin, operatorAuthProfileId);
  console.log(`✓ Resolved Mansa Meta's PersonaQube principal persona: ${mansaMetaPersonaId}`);

  // ── Phase 1: prove the real code path before writing anything.
  await proveIdentitySpine(operatorAuthProfileId, aletheonPersonaId, mansaMetaPersonaId);

  // ── Phase 2: two fresh, isolated exchanges — one per channel.
  const webResult = await buildAcceptanceExchange(
    admin,
    'web',
    aletheonPersonaId,
    mansaMetaPersonaId,
    bytes,
    contentHash,
    path.basename(resolvedPath),
  );
  const mcpResult = await buildAcceptanceExchange(
    admin,
    'mcp',
    aletheonPersonaId,
    mansaMetaPersonaId,
    bytes,
    contentHash,
    path.basename(resolvedPath),
  );

  console.log('\n=== READY FOR LIVE TWO-CHANNEL CONFIRMATION ===\n');
  console.log(`Bound principal for both: Mansa Meta (${mansaMetaPersonaId})`);
  console.log(`Registering operator for both: Aletheon / AigentMe persona (${aletheonPersonaId})\n`);
  console.log('WEB channel — authenticate the live app as Mansa Meta, then:');
  console.log(`  POST /api/research/exchanges/${webResult.exchangeId}/actions`);
  console.log('  body: { "action": "confirm" }\n');
  console.log('MCP channel — as an authenticated Mansa Meta MCP session, call tool:');
  console.log('  confirm_operator_assisted_artifact');
  console.log(`  (scoped to exchange ${mcpResult.exchangeId} via the session's own active-exchange resolution)`);
  console.log('  args: { "declarationConfirmed": true }\n');
  console.log('After both confirmations, compare the two ctp_transition_evidence SUCCESS rows per the prior acceptance checklist.');

  // Read-only final sanity check — confirms both exchanges are in the state
  // this script claims, no different than the prior one-off script's own
  // closing readback.
  const webFinal = await loadExchange(admin, webResult.exchangeId);
  const mcpFinal = await loadExchange(admin, mcpResult.exchangeId);
  console.log(`\nweb exchange status: ${webFinal.ok ? webFinal.exchange.status : `<lookup failed: ${webFinal.error}>`}`);
  console.log(`mcp exchange status: ${mcpFinal.ok ? mcpFinal.exchange.status : `<lookup failed: ${mcpFinal.error}>`}`);
}

const isRunDirectly = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isRunDirectly) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
