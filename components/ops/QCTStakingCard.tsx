import React, { useState, useEffect } from 'react';
import { Coins, TrendingUp, Clock, DollarSign } from 'lucide-react';

interface QCTStakingCardProps {
  title: string;
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

function IconRefresh({ onClick, disabled, className }: { onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      aria-label="Refresh"
    >
      <svg className={`w-4 h-4 ${disabled ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );
}

export function QCTStakingCard({ title }: QCTStakingCardProps) {
  const [stakingInfo, setStakingInfo] = useState({
    stakedAmount: '0',
    pendingRewards: '0',
    totalStaked: '0',
    apy: '12.5',
    lockPeriod: '30 days'
  });

  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState('1');
  const [loading, setLoading] = useState(false);

  // Mock staking data - replace with real API calls
  useEffect(() => {
    loadStakingInfo();
  }, []);

  const loadStakingInfo = async () => {
    try {
      // TODO: Replace with real staking API call
      const mockData = {
        stakedAmount: '1000',
        pendingRewards: '25.5',
        totalStaked: '50000',
        apy: '12.5',
        lockPeriod: '30 days'
      };
      setStakingInfo(mockData);
    } catch (err) {
      console.error('Failed to load staking info:', err);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      alert('Please enter a valid stake amount');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/qct/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stake',
          poolId: selectedPool,
          amount: stakeAmount
        })
      });

      const result = await response.json();

      if (result.ok) {
        alert(`Successfully staked ${stakeAmount} QCT!`);
        setStakeAmount('');
        await loadStakingInfo();
      } else {
        alert(`Staking failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Staking error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/qct/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unstake',
          poolId: selectedPool,
          amount: stakingInfo.stakedAmount
        })
      });

      const result = await response.json();

      if (result.ok) {
        alert('Successfully unstaked tokens!');
        await loadStakingInfo();
      } else {
        alert(`Unstaking failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Unstaking error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/qct/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_rewards'
        })
      });

      const result = await response.json();

      if (result.ok) {
        alert(`Successfully claimed ${stakingInfo.pendingRewards} QCT in rewards!`);
        await loadStakingInfo();
      } else {
        alert(`Claim failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Claim error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={title} actions={
      <IconRefresh
        onClick={loadStakingInfo}
        disabled={loading}
        className={loading ? 'animate-spin' : ''}
      />
    }>
      <div className="space-y-4">
        {/* Staking Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Coins size={16} className="text-blue-400" />
              <span className="text-xs text-slate-400">Staked</span>
            </div>
            <div className="text-lg font-semibold text-slate-200">
              {parseFloat(stakingInfo.stakedAmount).toLocaleString()} QCT
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-xs text-slate-400">Pending Rewards</span>
            </div>
            <div className="text-lg font-semibold text-green-400">
              {parseFloat(stakingInfo.pendingRewards).toFixed(2)} QCT
            </div>
          </div>
        </div>

        {/* Pool Information */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">APY:</span>
              <span className="ml-2 font-semibold text-green-400">{stakingInfo.apy}%</span>
            </div>
            <div>
              <span className="text-slate-400">Lock Period:</span>
              <span className="ml-2 text-slate-300">{stakingInfo.lockPeriod}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">Total Staked:</span>
              <span className="ml-2 text-slate-300">{parseFloat(stakingInfo.totalStaked).toLocaleString()} QCT</span>
            </div>
          </div>
        </div>

        {/* Staking Actions */}
        <div className="space-y-3 border-t border-slate-700 pt-4">
          {/* Stake Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-2">Stake QCT Tokens</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300"
                disabled={loading}
              />
              <button
                onClick={() => setStakeAmount('1000')} // Mock max stake
                className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 disabled:opacity-50"
                disabled={loading}
              >
                Max
              </button>
            </div>
          </div>

          {/* Pool Selection */}
          <div>
            <label className="text-xs text-slate-400 block mb-2">Staking Pool</label>
            <select
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300"
              disabled={loading}
            >
              <option value="1">Standard Pool (12.5% APY, 30 days)</option>
              <option value="2">Premium Pool (18.5% APY, 90 days)</option>
              <option value="3">Diamond Pool (25% APY, 180 days)</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleStake}
              disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
              className="px-3 py-2 bg-blue-500/10 text-blue-300 rounded hover:bg-blue-500/20 border border-blue-500/30 text-xs disabled:opacity-50"
            >
              Stake
            </button>

            <button
              onClick={handleUnstake}
              disabled={loading || parseFloat(stakingInfo.stakedAmount) <= 0}
              className="px-3 py-2 bg-orange-500/10 text-orange-300 rounded hover:bg-orange-500/20 border border-orange-500/30 text-xs disabled:opacity-50"
            >
              Unstake
            </button>

            <button
              onClick={handleClaimRewards}
              disabled={loading || parseFloat(stakingInfo.pendingRewards) <= 0}
              className="px-3 py-2 bg-green-500/10 text-green-300 rounded hover:bg-green-500/20 border border-green-500/30 text-xs disabled:opacity-50"
            >
              Claim
            </button>
          </div>
        </div>

        {/* Staking Benefits */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-500/20">
          <div className="text-xs font-medium text-slate-300 mb-2">Staking Benefits</div>
          <div className="space-y-1 text-xs text-slate-400">
            <div>• Earn up to 25% APY on staked QCT</div>
            <div>• Participate in QCT governance</div>
            <div>• Access to exclusive liquidity pools</div>
            <div>• Reduced trading fees</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
