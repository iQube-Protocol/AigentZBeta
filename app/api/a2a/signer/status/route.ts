import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId') || 'aigent-z'
    const tokenAddress = (searchParams.get('tokenAddress') || '').toLowerCase()

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Missing Supabase envs' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })

    const { data: agentKeys, error } = await supabase
      .from('agent_keys')
      .select('evm_address')
      .eq('agent_id', agentId)
      .single()

    if (error || !agentKeys?.evm_address) {
      return NextResponse.json({ ok: false, error: 'Agent address not found', details: error?.message }, { status: 404 })
    }

    const address = agentKeys.evm_address.toLowerCase()

    const { ethers } = await import('ethers')
    const rpcs = {
      base: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA,
      polygon: process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
    }

    const chains = [
      { name: 'BASE_SEPOLIA', chainId: 84532, rpc: rpcs.base },
      { name: 'POLYGON_AMOY', chainId: 80002, rpc: rpcs.polygon },
    ]

    const results: any = { address, balances: {} }

    for (const c of chains) {
      if (!c.rpc) { results.balances[c.name] = { ok: false, error: 'Missing RPC' }; continue }
      try {
        const provider = new ethers.JsonRpcProvider(c.rpc)
        const native = await provider.getBalance(address)
        let tokenBal: string | null = null
        if (tokenAddress) {
          const erc20 = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"], provider)
          const [bal] = await Promise.all([
            erc20.balanceOf(address),
          ])
          tokenBal = bal.toString()
        }
        results.balances[c.name] = {
          ok: true,
          nativeWei: native.toString(),
          tokenAddress: tokenAddress || null,
          tokenWei: tokenBal,
          rpc: c.rpc?.slice(0, 40) + '...'
        }
      } catch (e: any) {
        results.balances[c.name] = { ok: false, error: e?.message }
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'status failed' }, { status: 500 })
  }
}
