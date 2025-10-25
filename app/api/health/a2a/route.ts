import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const enc = process.env.AGENT_KEY_ENCRYPTION_SECRET

  const rpc = {
    sepolia: process.env.NEXT_PUBLIC_RPC_SEPOLIA,
    arb: process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA,
    base: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA,
    opt: process.env.NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA,
    polygon: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
  }

  return NextResponse.json({
    ok: true,
    envPresence: {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey,
      AGENT_KEY_ENCRYPTION_SECRET: !!enc,
      NEXT_PUBLIC_RPC_SEPOLIA: !!rpc.sepolia,
      NEXT_PUBLIC_RPC_ARB_SEPOLIA: !!rpc.arb,
      NEXT_PUBLIC_RPC_BASE_SEPOLIA: !!rpc.base,
      NEXT_PUBLIC_RPC_OPTIMISM_SEPOLIA: !!rpc.opt,
      NEXT_PUBLIC_RPC_POLYGON_AMOY: !!rpc.polygon,
    },
    samples: {
      supabaseUrl: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : null,
      rpcBase: rpc.base ? `${rpc.base.slice(0, 40)}...` : null,
      rpcPolygon: rpc.polygon ? `${rpc.polygon.slice(0, 40)}...` : null,
    }
  })
}
