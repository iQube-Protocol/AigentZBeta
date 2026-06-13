/**
 * POST /api/polity-passport/verify/[type]
 *
 * Verifies a ProveKit ZK proof for one of the five attestation types.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 6. Public endpoint — external
 * counsel/partners verify without spine auth. Returns valid + decoded
 * commitment ref (T1-safe) on success; 401 + error otherwise.
 *
 * Phase B circuits (passport_standing, document_possession,
 * mobility_authorization) return notYetImplemented=true so the
 * end-to-end demo flow can show the shape even before the circuits
 * exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProveKitProof, type ProveKitCircuit } from '@/services/proof/provekit';

export const dynamic = 'force-dynamic';

const VALID_CIRCUITS: ReadonlySet<ProveKitCircuit> = new Set([
  'proof_of_personhood',
  'proof_of_delegation_authority',
  'proof_of_passport_standing',
  'proof_of_document_possession',
  'proof_of_mobility_authorization',
]);

interface RouteParams {
  params: Promise<{ type: string }>;
}

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;
    if (!VALID_CIRCUITS.has(type as ProveKitCircuit)) {
      return withCors(NextResponse.json({ ok: false, error: `Unknown circuit: ${type}` }, { status: 400 }));
    }
    const circuit = type as ProveKitCircuit;

    const body = (await req.json().catch(() => ({}))) as { proofToken?: string };
    if (!body.proofToken) {
      return withCors(NextResponse.json({ ok: false, error: 'proofToken required' }, { status: 400 }));
    }

    const verification = await verifyProveKitProof(circuit, body.proofToken);
    if (verification.notYetImplemented) {
      return withCors(
        NextResponse.json(
          {
            ok: true,
            valid: false,
            notYetImplemented: true,
            circuit,
            mode: verification.mode,
            note: `Circuit ${circuit} is Phase B — shape verification only. proof_of_personhood and proof_of_delegation_authority are the ZK-verified circuits in the demo cut.`,
          },
        ),
      );
    }

    if (!verification.valid) {
      return withCors(
        NextResponse.json(
          {
            ok: false,
            valid: false,
            circuit,
            mode: verification.mode,
            error: verification.error,
          },
          { status: 401 },
        ),
      );
    }

    return withCors(
      NextResponse.json({
        ok: true,
        valid: true,
        circuit,
        mode: verification.mode,
        commitmentRef: verification.commitmentRef,
      }),
    );
  } catch (e) {
    return withCors(
      NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'Verification failed' },
        { status: 500 },
      ),
    );
  }
}
