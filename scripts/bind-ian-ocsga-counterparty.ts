/**
 * One-off: bind a target principal to the OCSGA boundary-research exchange
 * as Party B, through the exact same canonical service the newly-deployed
 * admin route (app/api/admin/exchanges/operator-assisted-admission) calls —
 * `ensureBoundaryResearchExchangeMembershipOperatorAssisted`. No admission
 * logic is reimplemented here; this script only resolves a REAL,
 * database-verified operator identity (never a fabricated one, and never
 * an inferred one) so the function's own `isCartridgeAdmin` check is
 * answering honestly, then invokes the unmodified function.
 *
 * IDENTITY RESOLUTION (2026-08-29 amendment): a single auth profile can own
 * MULTIPLE personas, and `default_persona_id` can be NULL — so an email
 * alone does not determine which persona is acting as operator. Both
 * --operator-email AND --operator-persona-id are required; the supplied
 * persona is REJECTED unless it is verified to belong to the resolved auth
 * profile. Never picks "the first persona" and never infers a persona from
 * email alone.
 *
 * Usage:
 *   npx tsx scripts/bind-ian-ocsga-counterparty.ts \
 *     --operator-email=<real admin email> \
 *     --operator-persona-id=<uuid of a persona owned by that auth profile> \
 *     [--target-persona-id=<uuid>]
 *
 * --target-persona-id defaults to Ian's canonical persona id, confirmed
 * live this session (29d22f83-a3cc-49d9-90be-a39391e9d8ae).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getCartridgeAdminGrants } from '../services/access/cartridgeAdminGrants';
import {
  ensureBoundaryResearchExchangeMembershipOperatorAssisted,
  OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
} from '../services/journey/boundaryResearchExchangeAdmission';
import type { ActivePersonaContext } from '../types/access';

export const IAN_PERSONA_ID_DEFAULT = '29d22f83-a3cc-49d9-90be-a39391e9d8ae';

export type ResolveVerifiedOperatorContextResult =
  | {
      ok: true;
      operatorContext: ActivePersonaContext;
      operatorAuthProfileId: string;
      operatorPersonaId: string;
    }
  | {
      ok: false;
      reason:
        | 'auth-profile-not-found'
        | 'persona-not-found'
        | 'persona-belongs-to-different-auth-profile'
        | 'not-authorized'
        | 'lookup-failed';
      error?: string;
    };

/**
 * Resolves a REAL, database-verified operator identity from an explicit
 * (email, personaId) pair — never from email alone, never by picking "the
 * first" persona an auth profile owns. Every step is a genuine server-side
 * lookup; admin authority is decided ONLY by the existing, unmodified
 * `getCartridgeAdminGrants` resolver (no parallel admin-check logic here).
 */
export async function resolveVerifiedOperatorContext(
  admin: SupabaseClient,
  input: { operatorEmail: string; operatorPersonaId: string },
): Promise<ResolveVerifiedOperatorContextResult> {
  const emailNorm = input.operatorEmail.trim().toLowerCase();
  const operatorPersonaId = input.operatorPersonaId.trim();

  // 1. Resolve the auth profile from the email.
  const { data: authProfile, error: authProfileErr } = await admin
    .from('crm_auth_profiles')
    .select('id, email')
    .eq('email', emailNorm)
    .maybeSingle();
  if (authProfileErr) return { ok: false, reason: 'lookup-failed', error: authProfileErr.message };
  if (!authProfile?.id) return { ok: false, reason: 'auth-profile-not-found' };
  const operatorAuthProfileId = String(authProfile.id);

  // 2. Resolve the SUPPLIED persona id — never infer, never pick "the first."
  const { data: personaRow, error: personaErr } = await admin
    .from('personas')
    .select('id, auth_profile_id')
    .eq('id', operatorPersonaId)
    .maybeSingle();
  if (personaErr) return { ok: false, reason: 'lookup-failed', error: personaErr.message };
  if (!personaRow?.id) return { ok: false, reason: 'persona-not-found' };

  // 3. The supplied persona MUST belong to the resolved auth profile.
  if (String(personaRow.auth_profile_id ?? '') !== operatorAuthProfileId) {
    return { ok: false, reason: 'persona-belongs-to-different-auth-profile' };
  }

  // 4-5. Admin authority decided ONLY by the existing canonical resolver.
  const grants = await getCartridgeAdminGrants(operatorAuthProfileId, [], emailNorm);
  if (!grants.isGlobalAdmin && !grants.cartridgeSlugs.includes('irl-cartridge')) {
    return { ok: false, reason: 'not-authorized' };
  }

  // 6. Construct the context from the explicitly supplied, verified persona.
  const operatorContext: ActivePersonaContext = {
    personaId: String(personaRow.id),
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

  return {
    ok: true,
    operatorContext,
    operatorAuthProfileId,
    operatorPersonaId: String(personaRow.id),
  };
}

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

async function main() {
  const operatorEmail = argValue('operator-email');
  const operatorPersonaId = argValue('operator-persona-id');
  const targetPersonaId = argValue('target-persona-id') ?? IAN_PERSONA_ID_DEFAULT;

  if (!operatorEmail || !operatorPersonaId) {
    console.error(
      'Usage: npx tsx scripts/bind-ian-ocsga-counterparty.ts --operator-email=<email> --operator-persona-id=<uuid> [--target-persona-id=<uuid>]',
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

  const resolved = await resolveVerifiedOperatorContext(admin, { operatorEmail, operatorPersonaId });
  if (!resolved.ok) {
    console.error(`❌ Operator identity resolution refused: ${resolved.reason}${resolved.error ? ` — ${resolved.error}` : ''}`);
    console.error(
      'This mirrors exactly what the live HTTP route / canonical service would refuse — not a bug to route around.',
    );
    process.exit(1);
  }

  console.log('Operator identity verified:');
  console.log('  operatorAuthProfileId:', resolved.operatorAuthProfileId);
  console.log('  operatorPersonaId:', resolved.operatorPersonaId);
  console.log('  cartridgeFlags:', resolved.operatorContext.cartridgeFlags);

  // Resolve the target the same way the admin route does — a genuine
  // server-side lookup, personaId re-verified for real inside the
  // canonical service's own Passport + research-lab-grant checks.
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

  console.log(
    `\nBinding ${targetPersonaId} to workspace '${OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID}' as operator persona ${resolved.operatorPersonaId}...\n`,
  );

  const result = await ensureBoundaryResearchExchangeMembershipOperatorAssisted(admin, {
    operatorContext: resolved.operatorContext,
    targetPersonaId: String(targetPersona.id),
    targetAuthProfileId: targetPersona.auth_profile_id ? String(targetPersona.auth_profile_id) : null,
    workspaceId: OCSGA_BOUNDARY_RESEARCH_WORKSPACE_ID,
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

// ESM-safe "run only when invoked directly" guard — never fires on import
// (e.g. from a test), unlike CommonJS's require.main === module, which
// this project's ESM-targeted tsconfig/tsx runtime doesn't reliably support.
const isRunDirectly = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isRunDirectly) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
