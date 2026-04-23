import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const POLYGON_AMOY_PARAMS = {
  chainId: '0x13882',
  chainName: 'Polygon Amoy',
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  blockExplorerUrls: ['https://amoy.polygonscan.com'],
}

type WalletContextValue = {
  address: string | null
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

function getEthereum(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, handler: (...args: unknown[]) => void) => void } | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, handler: (...args: unknown[]) => void) => void } }).ethereum : undefined
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const connect = useCallback(async () => {
    const ethereum = getEthereum()
    if (!ethereum) {
      alert('Please install MetaMask or another Web3 wallet.')
      return
    }
    setIsConnecting(true)
    try {
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
        params: [],
      })) as string[]
      if (accounts.length > 0) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: POLYGON_AMOY_PARAMS.chainId }],
          })
        } catch (switchErr: unknown) {
          const err = switchErr as { code?: number }
          if (err.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [POLYGON_AMOY_PARAMS],
            })
          } else {
            throw switchErr
          }
        }
        setAddress(accounts[0])
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
  }, [])

  useEffect(() => {
    const ethereum = getEthereum()
    if (!ethereum?.on) return
    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      setAddress(list.length > 0 ? list[0] : null)
    }
    ethereum.on('accountsChanged', handleAccountsChanged)
  }, [])

  useEffect(() => {
    const ethereum = getEthereum()
    if (!ethereum) return
    ethereum
      .request({ method: 'eth_accounts', params: [] })
      .then((accounts) => {
        const list = accounts as string[]
        if (list.length > 0) setAddress(list[0])
      })
      .catch(() => {})
  }, [])

  const value: WalletContextValue = {
    address,
    isConnecting,
    connect,
    disconnect,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
