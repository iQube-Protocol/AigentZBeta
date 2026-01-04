/**
 * CRM Personas Pending Activation API
 *
 * POST /api/crm/personas/pending
 * Body: { tenantId: string; dryRun?: boolean }
 *
 * Marks all personas for a tenant as pending (invited).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body?.tenantId as string | undefined;
    const dryRun = body?.dryRun !== false;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const client = getCrmClient();

    const { count: totalCount, error: countError } = await client
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) throw countError;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          dryRun: true,
          totalPersonas: totalCount ?? 0,
          updated: 0,
        },
      });
    }

    const { data, error } = await client
      .from('personas')
      .update({ status: 'pending' })
      .eq('tenant_id', tenantId)
      .select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        dryRun: false,
        totalPersonas: totalCount ?? 0,
        updated: (data || []).length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] POST /personas/pending error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update personas to pending' },
      { status: 500 }
    );
  }
}
