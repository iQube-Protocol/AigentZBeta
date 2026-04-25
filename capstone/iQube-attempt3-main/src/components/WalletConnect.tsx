import { useWallet } from '../context/WalletContext'

export default function WalletConnect() {
  const { address, isConnecting, connect, disconnect } = useWallet()

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 truncate max-w-[140px]" title={address}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 border border-slate-300 hover:bg-slate-100 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={isConnecting}
      className="h-9 px-4 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
    >
      {isConnecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  )
}
