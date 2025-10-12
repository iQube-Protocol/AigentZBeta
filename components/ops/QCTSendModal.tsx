import React, { useState, useEffect } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { getMetaMaskWallet } from '@/services/wallet/metamask';
import { getPhantomWallet } from '@/services/wallet/phantom';
import { getUnisatWallet } from '@/services/wallet/unisat';

interface QCTSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromChain: string;
  fromChainType: 'evm' | 'solana' | 'btc';
  walletAddress: string | null;
  balance: string;
}

const chainConfigs: Record<string, { name: string; symbol: string; type: 'evm' | 'solana' | 'btc' }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC', type: 'btc' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', type: 'evm' },
  polygon: { name: 'Polygon', symbol: 'POL', type: 'evm' },
  arbitrum: { name: 'Arbitrum', symbol: 'ARB', type: 'evm' },
  optimism: { name: 'Optimism', symbol: 'OP', type: 'evm' },
  base: { name: 'Base', symbol: 'BASE', type: 'evm' },
  solana: { name: 'Solana', symbol: 'SOL', type: 'solana' },
};

export default function QCTSendModal({
  isOpen,
  onClose,
  fromChain,
  fromChainType,
  walletAddress,
  balance,
}: QCTSendModalProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState('0.0001');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setRecipientAddress('');
      setAmount('');
      setError(null);
    }
  }, [isOpen]);

  // Validate recipient address format
  const validateAddress = (address: string): boolean => {
    if (!address) return false;
    
    if (fromChainType === 'evm') {
      // EVM address validation (0x + 40 hex chars)
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    } else if (fromChainType === 'solana') {
      // Solana address validation (base58, 32-44 chars)
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    } else if (fromChainType === 'btc') {
      // Bitcoin address validation (basic check for testnet/mainnet formats)
      return /^(bc1|tb1|[13]|[mn2])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address);
    }
    
    return false;
  };

  // Handle send transaction
  const handleSend = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      if (!recipientAddress) {
        throw new Error('Please enter recipient address');
      }

      if (!validateAddress(recipientAddress)) {
        throw new Error(`Invalid ${chainConfigs[fromChain]?.name} address format`);
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (parseFloat(amount) > parseFloat(balance)) {
        throw new Error('Insufficient balance');
      }

      // Execute send based on chain type
      let txHash: string;

      if (fromChainType === 'evm') {
        txHash = await sendEVM();
      } else if (fromChainType === 'solana') {
        txHash = await sendSolana();
      } else if (fromChainType === 'btc') {
        txHash = await sendBitcoin();
      } else {
        throw new Error('Unsupported chain type');
      }

      // Submit to DVN monitoring
      await submitToDVN(txHash);

      // Issue PoS receipt
      await issuePoSReceipt(txHash);

      alert(`QCT sent successfully!\n\nTransaction: ${txHash}\n\nMonitoring via DVN...`);
      onClose();
    } catch (err) {
      console.error('Send error:', err);
      setError((err as Error).message || 'Failed to send QCT');
    } finally {
      setLoading(false);
    }
  };

  // Send QCT on EVM chains
  const sendEVM = async (): Promise<string> => {
    const metamask = getMetaMaskWallet();
    
    if (!metamask.isInstalled()) {
      throw new Error('MetaMask not installed');
    }

    // Get QCT contract address for chain
    const contractAddress = await getQCTContractAddress(fromChain);
    
    // ERC20 transfer function signature
    const transferData = encodeERC20Transfer(recipientAddress, amount);

    // Send transaction
    const accounts = await metamask.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No wallet account found');
    }
    
    const txHash = await metamask.sendTransaction({
      from: accounts[0],
      to: contractAddress,
      data: transferData,
      value: '0x0',
    });

    return txHash;
  };

  // Send QCT on Solana
  const sendSolana = async (): Promise<string> => {
    const phantom = getPhantomWallet();
    
    if (!phantom.isInstalled()) {
      throw new Error('Phantom wallet not installed');
    }

    // TODO: Implement Solana SPL token transfer
    // This requires @solana/web3.js and @solana/spl-token
    throw new Error('Solana QCT transfers coming soon');
  };

  // Send QCT on Bitcoin (Runes)
  const sendBitcoin = async (): Promise<string> => {
    const unisat = getUnisatWallet();
    
    if (!unisat.isInstalled()) {
      throw new Error('Unisat wallet not installed');
    }

    // TODO: Implement Bitcoin Runes transfer
    throw new Error('Bitcoin QCT transfers coming soon');
  };

  // Submit transaction to DVN monitoring
  const submitToDVN = async (txHash: string) => {
    try {
      const response = await fetch('/api/ops/dvn/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          sourceChain: fromChain,
          targetChain: fromChain, // Same chain for send
          amount,
          operation: 'qct_send',
          timestamp: Date.now(),
          fromAddress: walletAddress,
          toAddress: recipientAddress,
        }),
      });

      if (!response.ok) {
        console.warn('DVN monitoring submission failed:', await response.text());
      }
    } catch (err) {
      console.warn('DVN monitoring error:', err);
      // Don't throw - DVN is monitoring only, shouldn't block send
    }
  };

  // Issue PoS receipt
  const issuePoSReceipt = async (txHash: string) => {
    try {
      const response = await fetch('/api/ops/pos/issue-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataHash: `qct_send_${txHash}_${Date.now()}`,
          source: `qct_${fromChain}_send`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('PoS receipt issued:', result.receiptId);
      }
    } catch (err) {
      console.warn('PoS receipt error:', err);
      // Don't throw - PoS is optional
    }
  };

  // Get QCT contract address for chain
  const getQCTContractAddress = async (chain: string): Promise<string> => {
    // TODO: Load from config/qct-contracts.ts
    const addresses: Record<string, string> = {
      ethereum: '0x...', // Sepolia testnet
      polygon: '0x...',  // Amoy testnet
      arbitrum: '0x...', // Arbitrum Sepolia
      optimism: '0x...', // Optimism Sepolia
      base: '0x...',     // Base Sepolia
    };
    
    return addresses[chain] || '';
  };

  // Encode ERC20 transfer function call
  const encodeERC20Transfer = (to: string, amountStr: string): string => {
    // transfer(address to, uint256 amount)
    // Function signature: 0xa9059cbb
    const functionSig = '0xa9059cbb';
    
    // Pad address to 32 bytes
    const paddedAddress = to.slice(2).padStart(64, '0');
    
    // Convert amount to wei (18 decimals) and pad to 32 bytes
    const amountWei = (parseFloat(amountStr) * 1e18).toString(16).padStart(64, '0');
    
    return functionSig + paddedAddress + amountWei;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Send QCT</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Chain Info */}
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">From Chain:</span>
              <span className="text-white font-medium">{chainConfigs[fromChain]?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">From Address:</span>
              <span className="text-white font-mono text-xs">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available Balance:</span>
              <span className="text-emerald-400 font-medium">{balance} QCT</span>
            </div>
          </div>

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder={`Enter ${chainConfigs[fromChain]?.name} address`}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            {recipientAddress && !validateAddress(recipientAddress) && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Invalid address format
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount (QCT)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0000"
                step="0.0001"
                min="0"
                max={balance}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setAmount(balance)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
              >
                Max
              </button>
            </div>
            {amount && parseFloat(amount) > parseFloat(balance) && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Insufficient balance
              </p>
            )}
          </div>

          {/* Fee Estimate */}
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Network Fee:</span>
              <span className="text-white">~{estimatedFee} {chainConfigs[fromChain]?.symbol}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={
                loading ||
                !recipientAddress ||
                !validateAddress(recipientAddress) ||
                !amount ||
                parseFloat(amount) <= 0 ||
                parseFloat(amount) > parseFloat(balance)
              }
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send QCT
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
