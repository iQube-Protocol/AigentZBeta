/**
 * Individual Receipt API
 * GET /api/receipts/[id] - Get specific receipt
 * POST /api/receipts/[id]/verify - Verify receipt integrity
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Receipt ID is required',
      }, { status: 400 });
    }

    const receipt = await receiptService.getReceipt(id);

    if (!receipt) {
      return NextResponse.json({
        success: false,
        error: 'Receipt not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      receipt,
    });

  } catch (error: any) {
    console.error('Receipt detail API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve receipt',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Receipt ID is required',
      }, { status: 400 });
    }

    if (action === 'verify') {
      const isValid = await receiptService.verifyReceipt(id);
      
      return NextResponse.json({
        success: true,
        receiptId: id,
        verified: isValid,
        verifiedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unsupported action. Use: { "action": "verify" }',
    }, { status: 400 });

  } catch (error: any) {
    console.error('Receipt verify API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to verify receipt',
    }, { status: 500 });
  }
}
