/**
 * One-off: bind a target principal to the OCSGA boundary-research exchange
 * as Party B, through the exact same canonical service the newly-deployed
 * admin route (app/api/admin/exchanges/operator-assisted-admission) calls —
 * `ensureBoundaryResearchExchangeMembershipOperatorAssisted`. No admission
 * logic is reimplemented here; this script only resolves a REAL,
 * database-verified operator identity (never a fabricated one) so the
 * function's own `isCartridgeAdmin` check is answering honestly, then
 * invokes the unmodified function.
 *
 * Usage:
 *   npx tsx scripts/bind-ian-ocsga-counterparty.ts --operator-email=<real admin email> [--target-persona-id=<uuid>]
 *
 * --operator-email MUST be the email of a real account that already holds
 * an active admin grant on 'irl-cartridge' (or global admin) in
 * crm_admin_roles. The script refuses (matching the route's own behavior)
 * if that grant does not resolve for real.
 *
 * --target-persona-id defaults to Ian's canonical persona id, confirmed
 * live this session (29d22f83-a3cc-49d9-90be-a39391e9d8ae).
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getCartridgeAdminGrants } from '../services/access/cartridgeAdminGrants';
import {
  ensureBoundaryResearchExchangeMembershipOperatorAssisted,
  OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
} from '../services/journey/boundaryResearchExchangeAdmission';
import type { ActivePersonaContext } from '../types/access';

const IAN_PERSONA_ID_DEFAULT = '29d22f83-a3cc-49d9-90be-a39391e9d8ae';

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

async function main() {
  const operatorEmail = argValue('operator-email');
  const targetPersonaId = argValue('target-persona-id') ?? IAN_PERSONA_ID_DEFAULT;

  if (!operatorEmail) {
    console.error('Usage: npx tsx scripts/bind-ian-ocsga-counterparty.ts --operator-email=<real admin email>');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // 1. Resolve the operator's REAL auth profile + persona from a verifiable
  //    handle (email) — never accept an id typed directly.
  const emailNorm = operatorEmail.trim().toLowerCase();
  const { data: authProfile, error: authProfileErr } = await admin
    .from('crm_auth_profiles')
    .select('id, email')
    .eq('email', emailNorm)
    .maybeSingle();
  if (authProfileErr) {
    console.error('❌ auth profile lookup failed:', authProfileErr.message);
    process.exit(1);
  }
  if (!authProfile?.id) {
    console.error(`❌ No crm_auth_profiles row for ${emailNorm} — cannot resolve a real operator identity.`);
    process.exit(1);
  }
  const operatorAuthProfileId = String(authProfile.id);

  const { data: operatorPersonaRow, error: operatorPersonaErr } = await admin
    .from('personas')
    .select('id')
    .eq('auth_profile_id', operatorAuthProfileId)
    .maybeSingle();
  if (operatorPersonaErr) {
    console.error('❌ operator persona lookup failed:', operatorPersonaErr.message);
    process.exit(1);
  }
  if (!operatorPersonaRow?.id) {
    console.error(`❌ No persona found with auth_profile_id=${operatorAuthProfileId} for ${emailNorm}.`);
    process.exit(1);
  }
  const operatorPersonaId = String(operatorPersonaRow.id);

  // 2. Resolve REAL admin grants via the EXISTING, unmodified resolver —
  //    never re-derive this query. Refuses (fails closed) exactly as the
  //    live admin route would if this account is not actually an admin.
  const grants = await getCartridgeAdminGrants(operatorAuthProfileId, [], emailNorm);
  console.log('Operator admin grants:', grants);
  if (!grants.isGlobalAdmin && !grants.cartridgeSlugs.includes('irl-cartridge')) {
    console.error(
      `❌ ${emailNorm} does not hold an active 'irl-cartridge' admin grant (or global admin) in crm_admin_roles. Refusing — this mirrors exactly what the live HTTP route would do.`,
    );
    process.exit(1);
  }

  const operatorContext: ActivePersonaContext = {
    personaId: operatorPersonaId,
    authProfileId: operatorAuthProfileId,
    identifiability: 'identifiable',
    cartridgeFlags: {
      isAdmin: grants.isGlobalAdmin,
      isPartner: false,
      adminCartridges: grants.cartridgeSlugs,
      cartridgeMemberships: {},
    },
    cohortMemberships: [],
    fioHandle: null,
    source: 'api-key',
  };

  // 3. Resolve the target the same way the admin route does — a genuine
  //    server-side lookup, personaId re-verified for real inside the
  //    canonical service's own Passport + research-lab-grant checks.
  const { data: targetPersona, error: targetErr } = await admin
    .from('personas')
    .select('id, auth_profile_id')
    .eq('id', targetPersonaId)
    .maybeSingle();
  if (targetErr) {
    console.error('❌ target persona lookup failed:', targetErr.message);
    process.exit(1);
  }
  if (!targetPersona?.id) {
    console.error(`❌ No persona ${targetPersonaId} found.`);
    process.exit(1);
  }

  console.log(`\nBinding ${targetPersonaId} to workspace '${OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID}' as operator ${emailNorm} (persona ${operatorPersonaId})...\n`);

  const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(admin, {
    operatorContext,
    targetPersonaId: String(targetPersona.id),
    targetAuthProfileId: targetPersona.auth_profile_id ? String(targetPersona.auth_profile_id) : null,
    workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
