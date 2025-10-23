import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const endpoint = process.env.FIO_API_ENDPOINT || 'unset'
  const chainId = process.env.FIO_CHAIN_ID || 'unset'
  const publicKey = process.env.FIO_SYSTEM_PUBLIC_KEY || 'unset'
  const mockMode = process.env.FIO_MOCK_MODE || 'unset'
  const nextPublicNetwork = process.env.NEXT_PUBLIC_FIO_NETWORK || 'unset'

  const redact = (v: string) => (v && v !== 'unset' ? v.slice(0, 12) + '...' : v)

  const result: any = {
    ok: true,
    config: {
      endpoint,
      chainId,
      mockMode,
      systemPublicKey: redact(publicKey),
      nextPublicNetwork,
    },
    probes: {
      get_info: null,
      balance: null,
      avail_check_fiotestnet: null,
    },
    envPresence: {
      FIO_API_ENDPOINT: !!process.env.FIO_API_ENDPOINT,
      FIO_CHAIN_ID: !!process.env.FIO_CHAIN_ID,
      FIO_SYSTEM_PUBLIC_KEY: !!process.env.FIO_SYSTEM_PUBLIC_KEY,
      FIO_SYSTEM_PRIVATE_KEY: !!process.env.FIO_SYSTEM_PRIVATE_KEY,
      FIO_MOCK_MODE: !!process.env.FIO_MOCK_MODE,
      NEXT_PUBLIC_FIO_NETWORK: !!process.env.NEXT_PUBLIC_FIO_NETWORK,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  }

  // Probe: get_info
  try {
    const r = await fetch(`${endpoint}chain/get_info`, { cache: 'no-store' })
    const j = await r.json()
    result.probes.get_info = { ok: r.ok, head_block_num: j.head_block_num, server_version: j.server_version }
  } catch (e: any) {
    result.probes.get_info = { ok: false, error: e?.message || String(e) }
  }

  // Probe: balance (only if we have a public key)
  if (publicKey && publicKey !== 'unset') {
    try {
      const r = await fetch(`${endpoint}chain/get_fio_balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fio_public_key: publicKey }),
      })
      const j = await r.json()
      result.probes.balance = { ok: r.ok, balance: j.balance }
    } catch (e: any) {
      result.probes.balance = { ok: false, error: e?.message || String(e) }
    }
  }

  // Probe: avail_check for a known testnet domain
  try {
    const r = await fetch(`${endpoint}chain/avail_check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fio_name: 'fiotestnet' }),
    })
    const j = await r.json()
    result.probes.avail_check_fiotestnet = { ok: r.ok, is_registered: j.is_registered }
  } catch (e: any) {
    result.probes.avail_check_fiotestnet = { ok: false, error: e?.message || String(e) }
  }

  return NextResponse.json(result)
}
