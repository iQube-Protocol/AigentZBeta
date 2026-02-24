/**
 * Individual Delegation API
 * GET /api/qubetalk/delegations/[id] - Get specific delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/services/receipts/receiptService';

// Import the mock storage from parent route
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
