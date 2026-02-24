/**
 * Unified Receipt API
 * GET /api/receipts - List receipts with filters
 * POST /api/receipts - Create new receipt (internal use)
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/services/receipts/receiptService';
import type { AnyReceipt, ReceiptType, ReceiptStatus } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const tenantId = searchParams.get('tenantId') || undefined;
    const category = searchParams.get('category') as any;
    const subType = searchParams.get('subType') || undefined;
    const state = searchParams.get('state') as any;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filters
    const filters: any = {
      tenantId,
      limit,
      offset,
    };

    if (category && subType) {
      filters.type = { category, subType };
    }

    if (state) {
      filters.status = { state, verified: state === 'completed' };
    }

    const receipts = await receiptService.listReceipts(filters);

    return NextResponse.json({
      success: true,
      receipts,
      total: receipts.length,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('Receipt API GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve receipts',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...receiptData } = body;

    if (!type || !type.category || !type.subType) {
      return NextResponse.json({
        success: false,
        error: 'Receipt type with category and subType is required',
      }, { status: 400 });
    }

    let receipt: AnyReceipt;

    switch (type.category) {
      case 'pos':
        receipt = await receiptService.createPoSReceipt(receiptData);
        break;
      case 'purchase':
        receipt = await receiptService.createPurchaseReceipt(receiptData);
        break;
      case 'qubetalk':
        receipt = await receiptService.createQubeTalkReceipt(receiptData);
        break;
      case 'smarttriad':
        receipt = await receiptService.createSmartTriadReceipt(receiptData);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `Unsupported receipt category: ${type.category}`,
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      receipt,
    });

  } catch (error: any) {
    console.error('Receipt API POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create receipt',
    }, { status: 500 });
  }
}
