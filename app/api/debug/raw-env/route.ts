import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    CODEX_MASTER_KEY_raw: process.env.CODEX_MASTER_KEY || 'NOT_SET',
    AUTONOMYS_API_KEY_raw: process.env.AUTONOMYS_API_KEY || 'NOT_SET',
    all_env_keys: Object.keys(process.env).filter(k => 
      k.includes('CODEX') || k.includes('AUTONOMYS')
    ),
  });
}
