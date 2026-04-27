"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link, Loader2, Network, Users, X } from "lucide-react";

// ─── Auth helper ──────────────────────────────────────────────────────────────

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

interface PersonaIdentity {
  fioHandle?: string | null;
  evmAddress?: string | null;
  btcAddress?: string | null;
  displayName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(addr: string | null | undefined, start = 6, end = 4): string {
  if (!addr) return "—";
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdentityRow({ label, value, color }: { label: string; value: string; color: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (value === "—") return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* ignore */ });
  };

  return (
    <div
      role={value !== "—" ? "button" : undefined}
      tabIndex={value !== "—" ? 0 : undefined}
      onClick={copy}
      onKeyDown={(e) => e.key === "Enter" && copy()}
      className={`flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 ${value !== "—" ? "cursor-pointer hover:bg-white/8 transition" : ""}`}
      title={value !== "—" ? "Click to copy" : undefined}
    >
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-xs font-mono ${color}`}>
        {copied ? "Copied!" : value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConnectionsIQubeDrawer({ open, onClose }: Props) {
  const [identity, setIdentity] = useState<PersonaIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/persona/active", { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { persona?: PersonaIdentity; data?: PersonaIdentity };
      setIdentity(data.persona ?? data.data ?? null);
    } catch (err) {
      // Non-fatal — fallback to localStorage persona hint
      const raw = typeof window !== "undefined" ? localStorage.getItem("activePersonaId") : null;
      setError(null);
      setIdentity(raw ? { displayName: raw } : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  if (!open) return null;

  const fioHandle = identity?.fioHandle || null;
  const evmAddress = identity?.evmAddress || null;
  const btcAddress = identity?.btcAddress || null;

  const identityRows: { label: string; raw: string | null; color: string }[] = [
    { label: "DID / FIO Handle", raw: fioHandle, color: "text-cyan-300" },
    { label: "EVM Address", raw: evmAddress, color: "text-indigo-300" },
    { label: "BTC Address", raw: btcAddress, color: "text-amber-300" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-[60] flex w-full max-w-sm flex-col bg-slate-950/95 border-r border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20">
              <Network className="h-4 w-4 text-cyan-400" />
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
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4">
          {/* Identity section */}
          <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
              <Link className="h-3.5 w-3.5 text-cyan-400" />
              Identity Connections
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {identityRows.map(({ label, raw, color }) => (
                  <IdentityRow
                    key={label}
                    label={label}
                    value={raw ? (label === "DID / FIO Handle" ? raw : truncate(raw)) : "—"}
                    color={color}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Network section */}
          <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              Network
            </div>
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/20">
                <Users className="h-6 w-6 text-emerald-400/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">Social graph coming soon</p>
                <p className="mt-1 text-xs text-slate-500">
                  Partner connections and your network will appear here.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
