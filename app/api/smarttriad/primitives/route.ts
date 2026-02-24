import { NextResponse } from 'next/server';
import {
  listFirstClassIQubeMcpPrimitives,
  listSmartTriadPrimitives,
} from '@/services/smarttriad/primitiveRegistry';

export const runtime = 'nodejs';

export async function GET() {
  const primitives = listSmartTriadPrimitives();
  const iqubeMcpApps = listFirstClassIQubeMcpPrimitives();

  return NextResponse.json({
    success: true,
    primitives,
    iqubeMcpApps,
    summary: {
      total: primitives.length,
      firstClassMcpApps: iqubeMcpApps.length,
    },
  });
}
