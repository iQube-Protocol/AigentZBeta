/**
 * Individual Delegation API
 * GET /api/qubetalk/delegations/[id] - Get specific delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireChannelAccess } from '@/app/api/qubetalk/_lib/requireChannelAccess';

// NOTE ON THIS ROUTE'S STATE. `delegations` is a module-local Map that nothing
// ever writes to — the comment claims to "import the mock storage from parent
// route" but no such import exists, so every GET returns 404. It is inert.
//
// It is gated anyway. An inert route that returns delegation CONTENT the moment
// someone wires the store up is a leak with a commit's delay on it, and the
// cost of the gate is one line. (CB-1: a mechanism that cannot fire today is
// not the same as one that is safe.)
const delegations = new Map();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        error: 'Delegation ID is required',
        code: 'MISSING_ID'
      }, { status: 400 });
    }

    const gate = await requireChannelAccess(
      request,
      new URL(request.url).searchParams.get('tenant_id'),
    );
    if (!gate.ok) return gate.response;

    const delegation = delegations.get(id);

    if (!delegation) {
      return NextResponse.json({
        error: 'Delegation not found',
        code: 'NOT_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json(delegation);

  } catch (error: any) {
    console.error('QubeTalk delegation detail error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to retrieve delegation',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
