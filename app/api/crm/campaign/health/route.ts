/**
 * GET /api/crm/campaign/health
 *
 * Returns the KNYT Wheel campaign tracking instrumentation health snapshot:
 *   - which env vars are configured (GA4, Meta, KS URL, webhook)
 *   - active link count in the registry
 *   - clicks today and all-time
 *   - timestamp of the last tracked click
 */

import { NextResponse } from 'next/server';
import { getHealth } from '@/services/campaign/knytTrackingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getHealth();
  return NextResponse.json({ health, as_of: new Date().toISOString() });
}
