"use client";

import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, HelpCircle, RefreshCw } from 'lucide-react';

interface FIOVerificationBadgeProps {
  status: 'verified' | 'unverified' | 'pending' | 'expired' | 'expiring_soon' | 'no_handle' | 'failed';
  handle?: string;
  expiration?: string;
  daysUntilExpiration?: number;
  onVerify?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function FIOVerificationBadge({
  status,
  handle,
  expiration,
  daysUntilExpiration,
  onVerify,
  size = 'md',
  showTooltip = true
}: FIOVerificationBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Get badge configuration based on status
  const getBadgeConfig = () => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          label: 'Verified',
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-700',
          description: 'FIO handle verified on blockchain'
        };
      case 'expiring_soon':
        return {
          icon: AlertTriangle,
          label: 'Expiring Soon',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-700',
          description: `Handle expires in ${daysUntilExpiration} days`
        };
      case 'expired':
        return {
          icon: XCircle,
          label: 'Expired',
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-700',
          description: 'FIO handle has expired'
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-700',
          description: 'Registration pending on blockchain'
        };
      case 'unverified':
        return {
          icon: AlertTriangle,
          label: 'Unverified',
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/20',
          borderColor: 'border-orange-700',
          description: 'FIO handle not verified'
        };
      case 'failed':
        return {
          icon: XCircle,
          label: 'Failed',
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-700',
          description: 'Registration failed'
        };
      case 'no_handle':
      default:
        return {
          icon: HelpCircle,
          label: 'No Handle',
          color: 'text-slate-500',
          bgColor: 'bg-slate-800/20',
          borderColor: 'border-slate-700',
          description: 'No FIO handle registered'
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 10,
          gap: 'gap-1'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 18,
          gap: 'gap-2'
        };
      case 'md':
      default:
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 14,
          gap: 'gap-1.5'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  // Handle verification
  const handleVerify = async () => {
    if (!onVerify) return;
    
    setVerifying(true);
    try {
      await onVerify();
    } finally {
      setVerifying(false);
    }
  };

  // Format expiration date
  const formatExpiration = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="relative inline-block">
      {/* Badge */}
      <div
        className={`inline-flex items-center ${sizeClasses.gap} ${sizeClasses.container} ${config.bgColor} ${config.color} border ${config.borderColor} rounded-md font-medium cursor-pointer transition-colors hover:opacity-80`}
        onMouseEnter={() => showTooltip && setShowDetails(true)}
        onMouseLeave={() => showTooltip && setShowDetails(false)}
      >
        <Icon size={sizeClasses.icon} />
        <span>{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && showDetails && (
        <div className="absolute z-50 left-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-md shadow-xl">
          <div className="space-y-2">
            {/* Status */}
            <div>
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <p className={`text-sm font-medium ${config.color}`}>
                {config.description}
              </p>
            </div>

            {/* Handle */}
            {handle && (
              <div>
                <p className="text-xs text-slate-500 mb-1">FIO Handle</p>
                <p className="text-sm text-slate-200 font-mono">{handle}</p>
              </div>
            )}

            {/* Expiration */}
            {expiration && status !== 'no_handle' && (
              <div>
                <p className="text-xs text-slate-500 mb-1">
                  {status === 'expired' ? 'Expired On' : 'Expires On'}
                </p>
                <p className="text-sm text-slate-200">
                  {formatExpiration(expiration)}
                </p>
                {daysUntilExpiration !== undefined && daysUntilExpiration > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {daysUntilExpiration} days remaining
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            {onVerify && (status === 'unverified' || status === 'expired' || status === 'failed') && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full mt-2 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {verifying ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    Verify Now
                  </>
                )}
              </button>
            )}

            {/* Renewal hint for expiring/expired */}
            {(status === 'expiring_soon' || status === 'expired') && (
              <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700">
                💡 Renew your FIO handle to maintain ownership
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact inline version for lists
export function FIOVerificationIcon({
  status,
  size = 12
}: {
  status: FIOVerificationBadgeProps['status'];
  size?: number;
}) {
  const getIcon = () => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={size} className="text-green-400" />;
      case 'expiring_soon':
        return <AlertTriangle size={size} className="text-yellow-400" />;
      case 'expired':
        return <XCircle size={size} className="text-red-400" />;
      case 'pending':
        return <Clock size={size} className="text-blue-400" />;
      case 'unverified':
        return <AlertTriangle size={size} className="text-orange-400" />;
      case 'failed':
        return <XCircle size={size} className="text-red-400" />;
      default:
        return <HelpCircle size={size} className="text-slate-500" />;
    }
  };

  return getIcon();
}
