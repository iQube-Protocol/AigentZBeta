"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Copy, Check, Network, X } from "lucide-react";

// ─── Auth helper (same pattern as MemoryIQubeDrawer / IdentityIQubeDrawer) ───

function getAccessTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.includes("auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const token =
          parsed.access_token ??
          (parsed as Record<string, { access_token?: unknown }>).currentSession?.access_token;
        if (typeof token === "string" && token) return token;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const token = getAccessTokenFromStorage();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonaData {
  fio_handle?: string | null;
  evm_address?: string | null;
  btc_address?: string | null;
  [key: string]: unknown;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyableRow({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [value]);

  if (!value) return null;

  const display = value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 border border-white/6 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xs text-slate-300 font-mono truncate">{display}</p>
      </div>
      <button
        type="button"
        onClick={() => { void copy(); }}
        className="flex-shrink-0 rounded-md p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/10 transition"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConnectionsIQubeDrawer({ open, onClose }: Props) {
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/persona/active", { headers: authHeaders() })
      .then((r) => r.ok ? r.json() as Promise<PersonaData> : null)
      .then((data) => { if (data) setPersona(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-[60] flex w-full max-w-sm flex-col bg-slate-950/95 border-r border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/20">
              <Network className="h-4 w-4 text-green-400" />
            </div>
            <span className="text-sm font-semibold text-white">Connections</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {/* Identity section */}
          {(loading || persona) && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Identity</p>
              {loading && !persona ? (
                <div className="h-20 rounded-xl border border-white/8 bg-slate-900/40 animate-pulse" />
              ) : (
                <>
                  <CopyableRow label="FIO Handle" value={persona?.fio_handle} />
                  <CopyableRow label="EVM Address" value={persona?.evm_address} />
                  <CopyableRow label="BTC Address" value={persona?.btc_address} />
                </>
              )}
            </div>
          )}

          {/* Networks section */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">Networks</p>
            <div className="rounded-xl border border-green-500/20 bg-green-900/10 p-4 text-center">
              <Network className="h-6 w-6 text-green-400/50 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Network connections coming soon</p>
              <p className="mt-1 text-[10px] text-slate-600">Connect MetaMask and social accounts to expand your metaMe identity.</p>
            </div>
          </div>

          {/* Empty identity state */}
          {!loading && !persona && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/20">
                <Network className="h-6 w-6 text-green-400/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">No connections yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Your identity and network connections will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
