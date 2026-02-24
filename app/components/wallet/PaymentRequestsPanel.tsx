'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface PaymentRequest {
  id: string;
  amount: number;
  asset: string;
  chain_id: number;
  memo?: string;
  requester_id: string;
  requester_fio?: string;
  requester_address: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  payment_request_id?: string;
  tx_hash?: string;
  amount?: number;
  asset?: string;
  from_id?: string;
  from_fio?: string;
  created_at: string;
}

interface PaymentRequestsPanelProps {
  agentId: string;
  fioHandle?: string;
  walletAddress?: string;
  onPaymentExecuted?: (txHash: string, requestId: string) => void;
}

export function PaymentRequestsPanel({
  agentId,
  fioHandle,
  walletAddress,
  onPaymentExecuted,
}: PaymentRequestsPanelProps) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const identifier = fioHandle || agentId;

  // Fetch pending requests and notifications
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch incoming payment requests
      const reqRes = await fetch(`/api/wallet/payment-requests?agentId=${encodeURIComponent(identifier)}&type=incoming`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData.requests || []);
      }

      // Fetch notifications
      const notifRes = await fetch(`/api/wallet/notifications?agentId=${encodeURIComponent(identifier)}`);
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (err) {
      setError('Failed to fetch payment requests');
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    fetchData();
    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Accept payment request
  const handleAccept = async (request: PaymentRequest) => {
    setProcessingId(request.id);
    try {
      // First accept the request
      const acceptRes = await fetch('/api/wallet/payment-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action: 'accept',
          agentId: identifier,
        }),
      });

      if (!acceptRes.ok) {
        throw new Error('Failed to accept request');
      }

      // Then execute the payment
      const transferRes = await fetch('/api/a2a/signer/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: identifier,
          to: request.requester_address,
          amount: (request.amount * 1e18).toString(), // Convert to wei
          chainId: request.chain_id,
          asset: request.asset,
        }),
      });

      if (!transferRes.ok) {
        throw new Error('Failed to execute payment');
      }

      const transferData = await transferRes.json();
      
      // Mark as paid
      await fetch('/api/wallet/payment-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action: 'paid',
          agentId: identifier,
          txHash: transferData.txHash,
        }),
      });

      onPaymentExecuted?.(transferData.txHash, request.id);
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject payment request
  const handleReject = async (requestId: string, reason?: string) => {
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/wallet/payment-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'reject',
          agentId: identifier,
          reason: reason || 'Declined by recipient',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to reject request');
      }

      // Refresh data
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  // Mark notifications as read
  const markNotificationsRead = async () => {
    if (notifications.length === 0) return;
    
    try {
      await fetch('/api/wallet/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: identifier,
        }),
      });
      setNotifications([]);
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const totalPending = requests.length;
  const totalNotifications = notifications.length;

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-center gap-2 text-white/60">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (totalPending === 0 && totalNotifications === 0) {
    return null; // Don't show panel if nothing to display
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">
            Payment Requests
          </span>
          {(totalPending > 0 || totalNotifications > 0) && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
              {totalPending + totalNotifications}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">Notifications</span>
                <button
                  onClick={markNotificationsRead}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2 rounded-lg text-xs ${
                      notif.type === 'request_paid' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : notif.type === 'request_rejected'
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {notif.type === 'request_paid' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : notif.type === 'request_rejected' ? (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Bell className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-medium text-white">{notif.title}</div>
                        <div className="text-white/60 mt-0.5">{notif.message}</div>
                        {notif.tx_hash && (
                          <div className="mt-1 font-mono text-cyan-400 truncate">
                            TX: {notif.tx_hash.slice(0, 10)}...{notif.tx_hash.slice(-8)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {requests.length > 0 && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">Pending Requests</span>
                <button
                  onClick={fetchData}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <RefreshCw className="w-3 h-3 text-white/40" />
                </button>
              </div>
              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                          <span className="font-medium text-white">
                            {request.amount} {request.asset}
                          </span>
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          From: {request.requester_fio || request.requester_id}
                        </div>
                        {request.memo && (
                          <div className="text-xs text-white/40 mt-1 italic">
                            "{request.memo}"
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/40">
                        <Clock className="w-3 h-3" />
                        {new Date(request.expires_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAccept(request)}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Pay
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
