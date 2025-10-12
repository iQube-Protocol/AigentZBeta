import React, { useState, useEffect } from 'react';
import { Coins, Globe, TrendingUp, Activity, ExternalLink, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface QCTDashboardProps {
  title: string;
  className?: string;
}

function Card({ title, children, actions, className }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

export function QCTDashboard({ title, className }: QCTDashboardProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Qc Contract addresses from our deployment
  const contracts = {
    bitcoin: {
      name: 'Bitcoin Testnet',
      establishmentTx: 'caaabee2695d173d718f012b065514f1b313fcad767dc3d836056cdb74de1903',
      address: 'tb1qywewf6kshzgvq9awzr46awhylu40v68tr8acm2',
      explorer: 'https://mempool.space/testnet/tx/caaabee2695d173d718f012b065514f1b313fcad767dc3d836056cdb74de1903',
      supply: '100,000,000',
      decimals: 8,
      icon: '₿',
      color: 'text-orange-400'
    },
    solana: {
      name: 'Solana Testnet',
      mintAddress: 'H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT',
      explorer: 'https://explorer.solana.com/address/H9FwtJbadVob3rpAwrjbw5dcfBM9VtbXHbM3UaDNKWBT?cluster=testnet',
      supply: '50,000,000',
      decimals: 9,
      icon: '◎',
      color: 'text-green-400'
    },
    ethereum: {
      name: 'Ethereum Sepolia',
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.etherscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      supply: '50,000,000',
      decimals: 18,
      icon: '⟠',
      color: 'text-blue-400'
    },
    polygon: {
      name: 'Polygon Amoy',
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://amoy.polygonscan.com/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      supply: '50,000,000',
      decimals: 18,
      icon: '⬟',
      color: 'text-purple-400'
    },
    arbitrum: {
      name: 'Arbitrum Sepolia',
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.arbiscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      supply: '50,000,000',
      decimals: 18,
      icon: '◆',
      color: 'text-cyan-400'
    },
    base: {
      name: 'Base Sepolia',
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia.basescan.org/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      supply: '50,000,000',
      decimals: 18,
      icon: '◎',
      color: 'text-blue-300'
    },
    optimism: {
      name: 'Optimism Sepolia',
      address: '0x4C4f1aD931589449962bB675bcb8e95672349d09',
      explorer: 'https://sepolia-optimism.etherscan.io/address/0x4C4f1aD931589449962bB675bcb8e95672349d09',
      supply: '50,000,000',
      decimals: 18,
      icon: '◉',
      color: 'text-red-400'
    }
  };

  // Copy address to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(label);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  // Calculate total supply
  const totalSupply = Object.values(contracts).reduce((total, contract) => {
    return total + parseInt(contract.supply.replace(/,/g, ''));
  }, 0);

  return (
    <Card 
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-blue-400" />
            <span>{title}</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>
      }
      className={className}
    >
      {isCollapsed && (
        <div className="text-sm text-slate-400 mt-2">
          7 chains • {(totalSupply / 1000000000).toFixed(1)}B Q¢ total supply • All chains live
        </div>
      )}
      {!isCollapsed && (
        <div className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Total Chains</span>
            </div>
            <div className="text-lg font-semibold text-blue-300">7</div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Total Supply</span>
            </div>
            <div className="text-lg font-semibold text-emerald-300">
              {(totalSupply / 1000000000).toFixed(1)}B
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-400">QCT Rate</span>
            </div>
            <div className="text-lg font-semibold text-amber-300">$0.01</div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">Status</span>
            </div>
            <div className="text-lg font-semibold text-emerald-300">Live</div>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Deployed Contracts
          </h3>
          
          <div className="space-y-2">
            {Object.entries(contracts).map(([key, contract]) => (
              <div key={key} className="bg-slate-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${contract.color}`}>{contract.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{contract.name}</div>
                      <div className="text-xs text-slate-400">
                        Supply: {contract.supply} Q¢ • Decimals: {contract.decimals}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => window.open(contract.explorer, '_blank')}
                      className="p-1 text-slate-400 hover:text-blue-300 transition-colors"
                      title="View on Explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded px-2 py-1">
                    <div className="text-xs text-slate-400 mb-1">
                      {key === 'bitcoin' ? 'Establishment TX' : key === 'solana' ? 'Mint Address' : 'Contract Address'}
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      {truncateAddress(
                        key === 'bitcoin' ? (contract as any).establishmentTx : 
                        key === 'solana' ? (contract as any).mintAddress : 
                        (contract as any).address
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => copyToClipboard(
                      key === 'bitcoin' ? (contract as any).establishmentTx : 
                      key === 'solana' ? (contract as any).mintAddress : 
                      (contract as any).address,
                      contract.name
                    )}
                    className="p-2 text-slate-400 hover:text-emerald-300 transition-colors"
                    title="Copy Address"
                  >
                    {copiedAddress === contract.name ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <div className="space-y-3 border-t border-slate-700 pt-4">
          <h3 className="text-sm font-medium text-slate-300">Key Features</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              Cross-chain P2P transfers
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              USDC treasury backing
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              Multi-wallet support
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
              Real-time event monitoring
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              Unified EVM address
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              Bitcoin integration
            </div>
          </div>
        </div>

        {/* Treasury Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-blue-300 text-sm font-medium mb-2">Treasury-Backed Token</div>
          <div className="text-blue-200 text-xs leading-relaxed">
            Q¢ is backed by USDC treasury reserves with a fixed rate of <strong>100 Q¢ = $1</strong>. 
            This provides price stability and enables seamless cross-chain value transfer across all 7 supported networks.
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs border-t border-slate-700 pt-3">
          <span className="text-slate-400">Deployment Status:</span>
          <span className="text-emerald-400 font-medium">✅ All 7 Chains Live</span>
        </div>
        </div>
      )}
    </Card>
  );
}
