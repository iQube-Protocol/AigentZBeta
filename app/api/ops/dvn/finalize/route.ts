import { NextResponse } from 'next/server';
import { finalizeReadyReceipts } from '@/services/dvn/receiptFinalizationService';

export async function POST() {
  try {
    const result = await finalizeReadyReceipts();
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'finalization error' }, { status: 500 });
  }
}
