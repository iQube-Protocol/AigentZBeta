/**
 * GET /api/wallet/signing-requests
 *
 * The caller's own pending signing requests, for the wallet's Pending Actions
 * surface. Owner self-view: the spine resolves the persona and the route never
 * accepts one from the query string.
 *
 * ── What is deliberately NOT returned ──────────────────────────────────────
 *
 * `principalPersonaId` is T0. The store returns it because server-side
 * orchestration needs it, but it must not cross into browser JSON — so this
 * route projects each record to the fields a wallet actually renders and drops
 * it. The alternative (returning the record and trusting every component not
 * to render one field) is the kind of discipline that holds until it doesn't.
 *
 * ── Why the payload IS returned ────────────────────────────────────────────
 *
 * The operator has to see the exact text their key will sign. A wallet that
 * showed only a summary would be asking for a signature over something the
 * signer never read — which is the property that makes blind signing
 * dangerous everywhere it exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listPendingSigningRequestsForOperator } from '@/services/signing/signingRequestStore';
import { routeForAction } from '@/services/signing/pendingActionRouting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { ok: false, refusal: 'NOT_AUTHENTICATED', detail: 'No active persona could be resolved for this caller.' },
      { status: 401 },
    );
  }

  let records;
  try {
    records = await listPendingSigningRequestsForOperator(persona.personaId);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        refusal: 'UNAVAILABLE',
        detail: `Your pending actions could not be read (${(e as Error).message}). This is not the same as ` +
          'having none — nothing has been lost, and a retry may succeed.',
      },
      { status: 503 },
    );
  }

  const now = Date.now();

  // Read once, for the principal rows. Never per-row: one question, one read.
  let principalAddress: string | null = null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await sb.from('personas').select('evm_key').eq('id', persona.personaId).maybeSingle();
    const env = (data?.evm_key ?? null) as { address?: unknown } | null;
    principalAddress = typeof env?.address === 'string' ? env.address : null;
  } catch {
    // An unreadable address is shown as unknown, never as absent.
    principalAddress = null;
  }

  return NextResponse.json(
    {
      ok: true,
      requests: records.map((r) => {
        const route = routeForAction(r.actionKind, r.signerRole);
        return {
          id: r.id,
          actionKind: r.actionKind,
          signerRole: r.signerRole,
          /*
           * WHICH WALLET this act belongs to. The surface groups on it, and
           * the grouping is the point: a principal mandate and an agent
           * invocation are two signing domains with two keys and two kinds of
           * authority. One flat list would say they were the same act done
           * twice.
           */
          walletRef: r.walletRef,
          /*
           * Where the authority to perform this act comes from. Not decorative
           * — it is the difference between "you are exercising your own
           * constitutional authority" and "you are releasing a key held under
           * bounded custody, under a mandate you already signed".
           */
          authoritySource:
            r.signerRole === 'principal'
              ? 'Your own principal wallet — first-party custody, control proven'
              : 'Bounded agent custody, invoked under your signed principal mandate',
          authorityCredential: r.authorityCredential,
          status: r.status,
          subjectAgentRef: r.subjectAgentRef,
          subjectAigentQubeId: r.subjectAigentQubeId,
          network: r.network,
          // The exact text the key will cover. Never summarised away.
          payload: r.payload,
          payloadHash: r.payloadHash,
          consequence: r.consequence,
          expiresAt: r.expiresAt,
          expired: new Date(r.expiresAt).getTime() <= now,
          createdAt: r.createdAt,
          receiptDestination: r.receiptDestination,
          /*
           * The address the signature will come from — the principal wallet's
           * bound address for a principal act, and NULL for an agent act,
           * because the agent key is under bounded custody and its address is
           * not the operator's to present as theirs. Null renders as "held in
           * bounded custody", which is the true statement.
           */
          walletAddress: r.walletRef === 'principal' ? principalAddress : null,
          // Whether this wallet can complete it, and how — derived from the one
          // routing table, never guessed at by the component.
          completion: route?.completion ?? null,
          actionLabel: route?.label ?? null,
          actionSummary: route?.summary ?? null,
        };
      }),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
