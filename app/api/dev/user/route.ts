import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const raw = process.env.DEV_USER_ID || '';
  const hasEnv = !!raw;
  const validUuid = UUID_RE.test(raw);
  const masked = raw ? `${raw.slice(0, 8)}…${raw.slice(-4)}` : '';
  return NextResponse.json({
    devUserId: raw,
    maskedDevUserId: masked,
    hasEnv,
    validUuid,
  });
}
