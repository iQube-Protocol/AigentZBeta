"use client";

import React, { useEffect, useState } from 'react';
import { Key, Copy, ExternalLink, CheckCircle, Clock } from 'lucide-react';

interface FIOInfo {
  fio_handle: string;
  fio_public_key: string;
  fio_tx_id: string;
  fio_handle_expiration: string;
  fio_registration_status: string;
  fio_registered_at: string;
}

interface FIOInfoCardProps {
  personaId: string;
}

export function FIOInfoCard({ personaId }: FIOInfoCardProps) {
  const [fioInfo, setFioInfo] = useState<FIOInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) return;

    const fetchFIOInfo = async () => {
      try {
        const response = await fetch(`/api/identity/persona?id=${personaId}`);
        const data = await response.json();
        
        if (data.ok && data.data?.fio_handle) {
          setFioInfo({
            fio_handle: data.data.fio_handle,
            fio_public_key: data.data.fio_public_key,
            fio_tx_id: data.data.fio_tx_id,
            fio_handle_expiration: data.data.fio_handle_expiration,
            fio_registration_status: data.data.fio_registration_status,
            fio_registered_at: data.data.fio_registered_at
          });
        }
      } catch (error) {
        console.error('Failed to fetch FIO info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFIOInfo();
  }, [personaId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      case 'expired':
        return 'text-orange-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!fioInfo) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
        <div className="flex items-center gap-3 mb-2">
          <Key className="text-slate-500" size={20} />
          <h3 className="text-lg font-semibold text-slate-300">FIO Handle</h3>
        </div>
        <p className="text-sm text-slate-500">No FIO handle registered for this persona</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-700/50 bg-gradient-to-br from-slate-900/80 to-indigo-950/40 shadow-lg backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Key className="text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">FIO Handle</h3>
            <p className="text-xs text-slate-400">Blockchain Identity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${fioInfo.fio_registration_status === 'confirmed' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
          <span className={`text-xs font-medium ${getStatusColor(fioInfo.fio_registration_status)}`}>
            {getStatusLabel(fioInfo.fio_registration_status)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* FIO Handle */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase">Handle</p>
            <button
              onClick={() => copyToClipboard(fioInfo.fio_handle, 'handle')}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy handle"
            >
              {copied === 'handle' ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
          <p className="text-lg font-bold text-green-400">{fioInfo.fio_handle}</p>
        </div>

        {/* Public Key */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase">Public Key</p>
            <button
              onClick={() => copyToClipboard(fioInfo.fio_public_key, 'key')}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Copy public key"
            >
              {copied === 'key' ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-300 font-mono break-all">{fioInfo.fio_public_key}</p>
        </div>

        {/* Transaction ID */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase">Transaction ID</p>
            <div className="flex gap-1">
              <button
                onClick={() => copyToClipboard(fioInfo.fio_tx_id, 'tx')}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy transaction ID"
              >
                {copied === 'tx' ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              {!fioInfo.fio_tx_id.startsWith('mock_') && !fioInfo.fio_tx_id.startsWith('fallback_') && (
                <a
                  href={`https://fio-test.bloks.io/transaction/${fioInfo.fio_tx_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  title="View on blockchain explorer"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-300 font-mono break-all">{fioInfo.fio_tx_id}</p>
        </div>

        {/* Registration & Expiration Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} className="text-slate-500" />
              <p className="text-xs font-medium text-slate-500 uppercase">Registered</p>
            </div>
            <p className="text-sm text-slate-300">{formatDate(fioInfo.fio_registered_at)}</p>
          </div>
          <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={12} className="text-slate-500" />
              <p className="text-xs font-medium text-slate-500 uppercase">Expires</p>
            </div>
            <p className="text-sm text-slate-300">{formatDate(fioInfo.fio_handle_expiration)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
