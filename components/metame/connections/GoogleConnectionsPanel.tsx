"use client";

/**
 * GoogleConnectionsPanel — Aigent Me Phase 6.b Part 2.
 *
 * Renders the user-facing Google Workspace connection state per source.
 * Each source (Gmail / Calendar / Drive / Docs / Slides) is opt-in
 * separately per the locked decision Q3.
 *
 * Pre-config admin view:
 *   - When `/api/assistant/google-status` returns `configured: false`,
 *     surfaces the operator-action diagnostic listing the missing env
 *     vars. Users see a single neutral notice ("Workspace connection
 *     coming soon"); admins see the action list.
 *
 * Connected user view:
 *   - When `configured: true`, renders 5 source cards.
 *   - Connect button → POST /api/assistant/connect-google { source } →
 *     follow the returned consentUrl in the same window. Google redirects
 *     back to the callback route; the runtime reloads showing the new
 *     connection.
 *   - Disconnect button → POST /api/assistant/disconnect-google { source }
 *     → revoke + delete; refresh local state.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Calendar,
  HardDrive,
  FileText,
  Presentation,
  Sheet,
  ListTodo,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plug,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

// ─────────────────────────────────────────────────────────────────────────
// Types — match the shape returned by GET /api/assistant/google-status.
// ─────────────────────────────────────────────────────────────────────────

type GoogleSource = "gmail" | "calendar" | "drive" | "docs" | "slides" | "sheets" | "tasks" | "contacts";

interface GoogleConnectionStatus {
  source: GoogleSource;
  connected: boolean;
  scopes: string[];
  expiresAt: string | null;
  accountEmail: string | null;
}

interface StatusResponse {
  configured: boolean;
  missing: string[];
  statuses: GoogleConnectionStatus[];
}

interface Props {
  /** True when the active persona has admin role flags. When false, hides
   *  the operator-facing "not configured" diagnostic and shows the
   *  user-facing "coming soon" copy. */
  isAdmin?: boolean;
  theme?: "light" | "dark";
}

const SOURCE_META: Record<
  GoogleSource,
  { label: string; description: string; icon: React.ReactNode }
> = {
  gmail:    { label: "Gmail",    description: "Draft + send messages",                  icon: <Mail className="w-4 h-4" /> },
  calendar: { label: "Calendar", description: "Create events + invite",                 icon: <Calendar className="w-4 h-4" /> },
  drive:    { label: "Drive",    description: "Create + share docs",                    icon: <HardDrive className="w-4 h-4" /> },
  docs:     { label: "Docs",     description: "Edit + append documents",                icon: <FileText className="w-4 h-4" /> },
  slides:   { label: "Slides",   description: "Create + edit presentations",            icon: <Presentation className="w-4 h-4" /> },
  sheets:   { label: "Sheets",   description: "Create + populate spreadsheets",         icon: <Sheet className="w-4 h-4" /> },
  tasks:    { label: "Tasks",    description: "Read your to-do list (read-only)",       icon: <ListTodo className="w-4 h-4" /> },
  contacts: { label: "Contacts", description: "Import address book for aigentMe",       icon: <Users className="w-4 h-4" /> },
};

export function GoogleConnectionsPanel({ isAdmin = false, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<GoogleSource | null>(null);

  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-emerald-300" : "text-emerald-700";
  const cardClass = isDark
    ? "bg-slate-800/40 border-slate-700"
    : "bg-slate-50 border-slate-200";
  const connectBtn = isDark
    ? "bg-emerald-500 hover:bg-emerald-400 text-white"
    : "bg-emerald-600 hover:bg-emerald-700 text-white";
  const disconnectBtn = isDark
    ? "border-slate-700 text-slate-300 hover:border-rose-500/60 hover:text-rose-200"
    : "border-slate-300 text-slate-700 hover:border-rose-500 hover:text-rose-700";

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/assistant/google-status");
      if (!res.ok) throw new Error(`google-status failed (${res.status})`);
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleConnect = useCallback(async (source: GoogleSource) => {
    setBusy(source);
    try {
      // Capture the current thin-client URL so the callback can return
      // the user to whichever origin they started from (metame.live /
      // metame.dev / runtime.metame.com). The route validates against
      // the metame embed allowlist before signing it into state.
      const returnUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const res = await personaFetch("/api/assistant/connect-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, ...(returnUrl ? { returnUrl } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { detail?: string; error?: string }));
        throw new Error(body?.detail || body?.error || `connect failed (${res.status})`);
      }
      const json = (await res.json()) as { consentUrl: string };
      // Break out of the iframe before redirecting to Google. The metame
      // thin clients embed the platform in an iframe, and accounts.google.com
      // sets X-Frame-Options: DENY on its OAuth pages — so setting
      // window.location inside the iframe results in a generic 403 from
      // Google. Targeting window.top puts the consent flow in the top-level
      // browsing context where Google renders it correctly. The callback's
      // signed-state returnUrl already brings the user back to whichever
      // thin client they started from.
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = json.consentUrl;
        } else {
          window.location.href = json.consentUrl;
        }
      } catch {
        // Cross-origin access on window.top can throw — fall back to
        // navigating the current frame so we at least attempt OAuth.
        window.location.href = json.consentUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }, []);

  const handleDisconnect = useCallback(async (source: GoogleSource) => {
    setBusy(source);
    try {
      const res = await personaFetch("/api/assistant/disconnect-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { detail?: string; error?: string }));
        throw new Error(body?.detail || body?.error || `disconnect failed (${res.status})`);
      }
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [refreshStatus]);

  // ── Loading ──
  if (loading && !data) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className={`text-sm ${mutedClass}`}>Loading Google Workspace status…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error && !data) {
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Could not load Google Workspace status</h3>
            <p className={`text-sm ${mutedClass}`}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Not configured (operator action needed) ──
  if (!data.configured) {
    if (!isAdmin) {
      return (
        <div className={`rounded-lg border p-5 ${surfaceClass}`}>
          <div className="flex items-start gap-3">
            <Plug className={`w-5 h-5 ${accentClass} mt-0.5`} />
            <div>
              <h3 className="font-semibold mb-1">Google Workspace connections — coming soon</h3>
              <p className={`text-sm ${mutedClass}`}>
                aigentMe will be able to coordinate Gmail, Calendar, and Drive
                actions once your operator finishes the connection setup.
                Each source is opt-in separately.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`rounded-lg border p-5 ${surfaceClass}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Operator action — Google Workspace not configured</h3>
            <p className={`text-sm mb-2 ${mutedClass}`}>
              Set the following env vars in Amplify, then refresh:
            </p>
            <ul className={`text-xs font-mono space-y-1 ${mutedClass}`}>
              {data.missing.map((v) => (
                <li key={v}>· {v}</li>
              ))}
            </ul>
            <p className={`text-xs mt-3 ${mutedClass}`}>
              See <span className="font-mono">codexes/packs/agentiq/updates/2026-05-12_aigent-me-phase-6b-part1-foundation.md</span> for the full setup checklist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Configured — render per-source cards ──
  return (
    <div className={`rounded-lg border p-5 ${surfaceClass}`}>
      <div className="flex items-center gap-2 mb-4">
        <Plug className={`w-4 h-4 ${accentClass}`} />
        <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
          Google Workspace · opt-in per source
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {data.statuses.map((s) => {
          const meta = SOURCE_META[s.source];
          if (!meta) return null; // unknown/newer source the client doesn't render yet
          const isBusy = busy === s.source;
          return (
            <div key={s.source} className={`rounded-md border p-3 ${cardClass}`}>
              <div className="flex items-start gap-2">
                <div className={`shrink-0 mt-0.5 ${accentClass}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{meta.label}</span>
                    {s.connected && (
                      <CheckCircle2 className={`w-3.5 h-3.5 ${accentClass}`} />
                    )}
                  </div>
                  <div className={`text-[11px] ${mutedClass}`}>{meta.description}</div>
                  {s.connected && s.accountEmail && (
                    <div className={`text-[11px] mt-1 truncate ${mutedClass}`} title={s.accountEmail}>
                      {s.accountEmail}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {s.connected ? (
                  <button
                    onClick={() => handleDisconnect(s.source)}
                    disabled={isBusy}
                    className={`flex-1 px-2 py-1 rounded-md border text-[11px] font-medium transition disabled:opacity-50 ${disconnectBtn}`}
                  >
                    {isBusy ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(s.source)}
                    disabled={isBusy}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition disabled:opacity-50 ${connectBtn}`}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ExternalLink className="w-3 h-3" />
                    )}
                    {isBusy ? "Opening…" : "Connect"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

export default GoogleConnectionsPanel;
