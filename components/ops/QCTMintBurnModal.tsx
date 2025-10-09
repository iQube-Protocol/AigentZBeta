"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface QCTMintBurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'mint' | 'burn';
  chainId: number;
  walletAddress: string | null;
}

export default function QCTMintBurnModal({
  isOpen,
  onClose,
  mode,
  chainId,
  walletAddress
}: QCTMintBurnModalProps) {
  const [usdcAmount, setUsdcAmount] = useState('');
  const [qctAmount, setQctAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [qctBalance, setQctBalance] = useState('0');
  const [reserveRatio, setReserveRatio] = useState('100');

  const MINT_RATIO = 100; // 1 USDC = 100 QCT
  const MINT_FEE = 0.001; // 0.1%
  const BURN_FEE = 0.001; // 0.1%

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchBalances();
      fetchReserveRatio();
    }
  }, [isOpen, walletAddress, chainId]);

  const fetchBalances = async () => {
    try {
      // TODO: Implement actual balance fetching
      // For now, using placeholder
      setUsdcBalance('1000.00');
      setQctBalance('50000.00');
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  };

  const fetchReserveRatio = async () => {
    try {
      // TODO: Implement actual reserve ratio fetching
      setReserveRatio('100.00');
    } catch (err) {
      console.error('Error fetching reserve ratio:', err);
    }
  };

  const handleUsdcChange = (value: string) => {
    setUsdcAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      const usdc = parseFloat(value);
      if (mode === 'mint') {
        const fee = usdc * MINT_FEE;
        const netUsdc = usdc - fee;
        const qct = netUsdc * MINT_RATIO;
        setQctAmount(qct.toFixed(2));
      } else {
        const qct = usdc * MINT_RATIO;
        setQctAmount(qct.toFixed(2));
      }
    } else {
      setQctAmount('');
    }
  };

  const handleQctChange = (value: string) => {
    setQctAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      const qct = parseFloat(value);
      if (mode === 'mint') {
        const netUsdc = qct / MINT_RATIO;
        const fee = netUsdc * MINT_FEE;
        const totalUsdc = netUsdc + fee;
        setUsdcAmount(totalUsdc.toFixed(6));
      } else {
        const grossUsdc = qct / MINT_RATIO;
        const fee = grossUsdc * BURN_FEE;
        const netUsdc = grossUsdc - fee;
        setUsdcAmount(netUsdc.toFixed(6));
      }
    } else {
      setUsdcAmount('');
    }
  };

  const handleMaxUsdc = () => {
    handleUsdcChange(usdcBalance);
  };

  const handleMaxQct = () => {
    handleQctChange(qctBalance);
  };

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet');
      return;
    }

    if (!usdcAmount || !qctAmount) {
      setError('Please enter an amount');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'mint') {
        await mintQCT();
      } else {
        await burnQCT();
      }
      
      // Refresh balances
      await fetchBalances();
      await fetchReserveRatio();
      
      // Reset form
      setUsdcAmount('');
      setQctAmount('');
      
      // Show success (you can add a toast notification here)
      alert(`Successfully ${mode === 'mint' ? 'minted' : 'burned'} QCT!`);
      
    } catch (err: any) {
      console.error(`Error ${mode}ing QCT:`, err);
      setError(err.message || `Failed to ${mode} QCT`);
    } finally {
      setIsLoading(false);
    }
  };

  const mintQCT = async () => {
    // TODO: Implement actual minting
    // 1. Approve USDC spending
    // 2. Call reserve.mint(usdcAmount)
    console.log('Minting QCT:', { usdcAmount, qctAmount });
    
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const burnQCT = async () => {
    // TODO: Implement actual burning
    // 1. Approve QCT spending
    // 2. Call reserve.burn(qctAmount)
    console.log('Burning QCT:', { qctAmount, usdcAmount });
    
    // Simulate transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {mode === 'mint' ? '🪙 Mint QCT' : '🔥 Burn QCT'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Reserve Status */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Reserve Ratio</span>
            <span className={`font-bold ${
              parseFloat(reserveRatio) >= 100 ? 'text-green-400' : 'text-red-400'
            }`}>
              {reserveRatio}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Peg Status</span>
            <span className="text-green-400 font-bold">STABLE ✅</span>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">USDC Balance</div>
            <div className="text-white font-bold">{parseFloat(usdcBalance).toLocaleString()}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">QCT Balance</div>
            <div className="text-white font-bold">{parseFloat(qctBalance).toLocaleString()}</div>
          </div>
        </div>

        {/* Input Section */}
        <div className="space-y-4 mb-6">
          {/* USDC Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400 text-sm">
                {mode === 'mint' ? 'You Pay' : 'You Receive'}
              </label>
              {mode === 'mint' && (
                <button
                  onClick={handleMaxUsdc}
                  className="text-blue-400 text-xs hover:text-blue-300"
                >
                  MAX
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                value={usdcAmount}
                onChange={(e) => handleUsdcChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                USDC
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="text-gray-400 text-2xl">
              {mode === 'mint' ? '↓' : '↑'}
            </div>
          </div>

          {/* QCT Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400 text-sm">
                {mode === 'mint' ? 'You Receive' : 'You Pay'}
              </label>
              {mode === 'burn' && (
                <button
                  onClick={handleMaxQct}
                  className="text-blue-400 text-xs hover:text-blue-300"
                >
                  MAX
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                value={qctAmount}
                onChange={(e) => handleQctChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                QCT
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Rate Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Exchange Rate</span>
            <span className="text-white">1 USDC = 100 QCT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fee</span>
            <span className="text-white">{mode === 'mint' ? MINT_FEE * 100 : BURN_FEE * 100}%</span>
          </div>
          {usdcAmount && qctAmount && (
            <div className="flex justify-between">
              <span className="text-gray-400">USD Value</span>
              <span className="text-white">
                ${(parseFloat(qctAmount) * 0.01).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !usdcAmount || !qctAmount}
          className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
            isLoading || !usdcAmount || !qctAmount
              ? 'bg-gray-700 cursor-not-allowed'
              : mode === 'mint'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isLoading
            ? `${mode === 'mint' ? 'Minting' : 'Burning'}...`
            : mode === 'mint'
            ? '🪙 Mint QCT'
            : '🔥 Burn QCT'}
        </button>

        {/* Info Text */}
        <p className="text-gray-400 text-xs text-center mt-4">
          {mode === 'mint'
            ? 'Deposit USDC to mint QCT at a fixed rate of 100 QCT per 1 USDC'
            : 'Burn QCT to redeem USDC at a fixed rate of 1 USDC per 100 QCT'}
        </p>
      </div>
    </div>
  );
}
