import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    CROSS_CHAIN_SERVICE_CANISTER_ID: process.env.CROSS_CHAIN_SERVICE_CANISTER_ID,
    NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID: process.env.NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID,
    CANISTER_ID_CROSS_CHAIN_SERVICE: process.env.CANISTER_ID_CROSS_CHAIN_SERVICE,
    NODE_ENV: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('CHAIN') || key.includes('CANISTER'))
  });
}
