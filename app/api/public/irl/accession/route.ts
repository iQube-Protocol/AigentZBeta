/**
 * GET /api/public/irl/accession?code=<invitation code>
 *
 * The machine-readable twin of an accession invitation (operator + Aletheon,
 * 2026-07-19). Humans read the /invite/<code> page; AGENTS read this — the
 * "For AI agents" endpoint the page links. Same constitutional object, two
 * representations. The workflow it describes is executed through the
 * platform; this object is the agent's instruction set for administering
 * its principal's onboarding (administrative work only — acceptance,
 * claiming, and delegation remain human constitutional acts, and the
 * object says so explicitly).
 *
 * Trust model: capability URL — the code is unguessable and was privately
 * delivered; knowing it reveals the invitation's own metadata (role,
 * programme, status) and nothing about any other party. No persona
 * identifiers of any tier appear here.
 *
 * Supports both invitation kinds:
 *   pinv-… — Constitutional Access Service invitation (role grant)
 *   x409-… — agreement invitation (contract claim into the locker)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { DOMAIN_LABELS, type AccessDomain } from '@/services/passport/participationAccess';
import { publicOrigin } from '@/utils/publicOrigin';

export const dynamic = 'force-dynamic';

const CONSTITUTIONAL_BOUNDARY =
  'The agent may prepare, explain, fetch, and administer. Accepting terms, claiming the invitation, and delegating authority are HUMAN constitutional acts performed by the signed-in principal.';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.trim();
  if (!code) return NextResponse.json({ ok: false, error: 'code is required' }, { status: 400 });

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const origin = publicOrigin(req);
  const beginUrl = `${origin}/triad/embed/codex/irl-os-cartridge?tab=irl-os-passport-locker&${code.startsWith('x409-') ? 'x409' : 'invite'}=${code}`;

  const resources = {
    invitationPage: `${origin}/invite/${code}`,
    dashboard: `${origin}/triad/embed/codex/irl-os-cartridge`,
    participationOverview: `${origin}/triad/embed/codex/irl-os-cartridge?tab=irl-os-participation-overview`,
    passportApply: `${origin}/triad/embed/codex/irl-os-cartridge?tab=irl-os-passport-apply`,
    delegation: `${origin}/triad/embed/codex/irl-os-cartridge?tab=irl-os-passport-delegation`,
    locker: beginUrl,
    protocolDoc: `${origin}/api/public/irl/doc?path=foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md`,
    agreementApi: `${origin}/api/public/irl/agreement`,
    resultsSubmitApi: `${origin}/api/public/irl/experiments/submit`,
    publishedReports: `${origin}/api/public/irl/reports`,
  };

  if (code.startsWith('pinv-')) {
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { data: inv, error } = await admin
      .from('access_invitations')
      .select('access_domain, role, label, status, uses, max_uses, expires_at, created_at')
      .eq('code_hash', codeHash)
      .maybeSingle();
    if (error || !inv) return NextResponse.json({ ok: false, error: 'Invitation not found' }, { status: 404 });

    const claimed = inv.status !== 'active';
    return NextResponse.json(
      {
        ok: true,
        schema: 'irl-accession/v1',
        kind: 'access-invitation',
        role: inv.role,
        accessDomain: inv.access_domain,
        programme: inv.label ?? DOMAIN_LABELS[inv.access_domain as AccessDomain] ?? inv.access_domain,
        status: inv.status,
        onboarded: claimed,
        expiresAt: inv.expires_at,
        constitutionalBoundary: CONSTITUTIONAL_BOUNDARY,
        workflow: claimed
          ? [
              'Onboarding complete — do not repeat it',
              'Open the dashboard and review current experiments',
              'Fetch the experimental protocol',
              'Execute experiments with your principal',
              'Submit receipted results via the submission API',
              'Review published reports and prepare your independent review',
            ]
          : [
              'Read this accession object fully before acting',
              'Walk your principal through creating an account and persona (dashboard link)',
              'Guide your principal to the invitation page and the Begin action',
              'HUMAN ACT: your principal signs in and claims the invitation code in the Locker',
              'Guide your principal through the Passport Apply flow (weak proof of humanity suffices for this programme)',
              'HUMAN ACT: your principal grants you bounded delegation (Delegation tab)',
              'Fetch the experimental protocol and invariant materials',
              'Execute experiments; submit results via the submission API under your delegation',
            ],
        resources,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (code.startsWith('x409-')) {
    const { data: inv, error } = await admin
      .from('x409_invitations')
      .select('label, status, created_at, claimed_at')
      .eq('code', code)
      .maybeSingle();
    if (error || !inv) return NextResponse.json({ ok: false, error: 'Invitation not found' }, { status: 404 });

    const claimed = inv.status === 'claimed';
    return NextResponse.json(
      {
        ok: true,
        schema: 'irl-accession/v1',
        kind: 'agreement-invitation',
        role: 'Independent Reviewer',
        programme: inv.label ?? 'Constitutional Agreement',
        status: inv.status,
        onboarded: claimed,
        constitutionalBoundary: CONSTITUTIONAL_BOUNDARY,
        workflow: claimed
          ? [
              'The agreement is in your principal\'s Locker — review its lifecycle state there',
              'If terms are not yet accepted: review them, then accept AS THE NAMED AGENT via the agreement API',
              'Await operator authorization (Principal–Delegate Separation)',
              'Once authorized, execute the programme: fetch protocol, run experiments, submit results',
            ]
          : [
              'Read this accession object fully before acting',
              'Guide your principal to the invitation page and the Begin action',
              'HUMAN ACT: your principal signs in and claims this code in the Locker — the agreement lands there as a contract',
              'Review the agreement terms from the locker item',
              'Accept the terms AS THE NAMED AGENT via the agreement API (acceptance binds only the pre-named agent)',
              'Await operator authorization, then execute the programme',
            ],
        resources,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ ok: false, error: 'Unrecognised invitation code format' }, { status: 400 });
}
