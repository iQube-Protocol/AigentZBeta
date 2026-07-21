"use client";

/**
 * QubeTalk Peer Exchange — inbox surface + "Share via QubeTalk" affordance
 * (Phase 1 Increment 4, the minimal UI over the peer-channel API).
 *
 * Personhood-bound peer messaging between two INDEPENDENT principals, each
 * addressed by their Polity Public Reference (T2-safe, 16-hex). This surface:
 *   • shows the caller's OWN reference (the handle a counterparty needs),
 *   • opens a channel with a counterparty by their reference,
 *   • lists channels, messages, and shared artifacts,
 *   • posts human messages, opens shared artifacts, and — when the sharer
 *     granted `copyToLocker` — materialises a shared artifact into the locker.
 *
 * Every call goes through `personaFetch` (spine-authed); no raw fetch. The
 * caller's persona UUID never leaves the server — the surface only ever handles
 * public references + commitments.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  FolderInput,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

// ── Client transport ─────────────────────────────────────────────────────────

async function jf<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await personaFetch(url, { cache: "no-store", ...init });
  const text = await res.text();
  const data = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok || data.ok !== true) {
    throw new Error((typeof data.error === "string" && data.error) || `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Shapes (mirror the service return types) ─────────────────────────────────

interface PeerChannel {
  id: string;
  counterpartyRef: string;
  createdByRef: string;
  status: "active" | "revoked";
  createdAt: string;
  /** The caller's own private nickname for this channel (never leaves their side). */
  counterpartyLabel: string | null;
}
interface PeerMessage {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  mine: boolean;
}
interface RightsEnvelope {
  view: boolean;
  download: boolean;
  copyToLocker: boolean;
  annotate: boolean;
  revise: boolean;
  reshare: boolean;
  agentInference: boolean;
  confidentialNda: boolean;
}
interface SharedArtifact {
  id: string;
  artifactType: string;
  artifactId: string;
  title: string;
  relationship: string;
  rights: RightsEnvelope;
  createdAt: string;
  openedAt: string | null;
  copiedToLockerAt: string | null;
  mine: boolean;
}

const REF_RE = /^([0-9a-f]{16}|prf_[0-9a-f]{8,})$/;

function shortRef(ref: string): string {
  return ref.length > 10 ? `${ref.slice(0, 6)}…${ref.slice(-4)}` : ref;
}

/** Display name for a channel: the caller's nickname if set, else the short ref. */
function channelName(c: PeerChannel): string {
  return c.counterpartyLabel || shortRef(c.counterpartyRef);
}

// ── My-reference chip (the handle a counterparty needs) ──────────────────────

function MyRefChip({ myRef }: { myRef: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!myRef) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-[11px] uppercase tracking-wide text-slate-500">Your reference</span>
      <code className="text-xs text-slate-200">{myRef}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(myRef);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="ml-1 inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
        title="Copy your Polity Public Reference — share it out of band so a counterparty can open a channel with you"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export default function QubeTalkInboxTab() {
  const [myRef, setMyRef] = useState<string | null>(null);
  const [channels, setChannels] = useState<PeerChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [newRef, setNewRef] = useState("");
  const [creating, setCreating] = useState(false);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jf<{ myRef: string; channels: PeerChannel[] }>("/api/qubetalk/peer-channels");
      setMyRef(data.myRef);
      setChannels(data.channels ?? []);
      // Auto-select the first channel only when nothing is selected yet
      // (functional update avoids a `selected`-dependency reload cycle).
      if (data.channels?.length) setSelected((prev) => prev ?? data.channels[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const createChannel = useCallback(async () => {
    const ref = newRef.trim();
    if (!REF_RE.test(ref)) {
      setError("Enter a valid Polity Public Reference (16 hex chars) — never a raw UUID");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const data = await jf<{ channel: PeerChannel }>("/api/qubetalk/peer-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyRef: ref }),
      });
      setNewRef("");
      await loadChannels();
      setSelected(data.channel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open channel");
    } finally {
      setCreating(false);
    }
  }, [newRef, loadChannels]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Personhood-bound peer exchange — message and share artifacts with another principal,
          addressed by their <span className="text-slate-200">Polity Public Reference</span>. Confidential,
          principal-to-principal; no public URLs.
        </p>
        <button
          onClick={loadChannels}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <MyRefChip myRef={myRef} />

      {/* Open a new channel */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Open channel</span>
        <input
          value={newRef}
          onChange={(e) => setNewRef(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createChannel()}
          placeholder="counterparty reference (16 hex)"
          className="min-w-[240px] flex-1 rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60 focus:outline-none"
        />
        <button
          onClick={createChannel}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Open
        </button>
      </div>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(200px,280px)_1fr]">
        {/* Channel list */}
        <div className="space-y-1.5">
          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
            </div>
          )}
          {!loading && channels.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-4 text-xs text-slate-500">
              <Inbox className="h-4 w-4" /> No channels yet — open one with a counterparty&apos;s reference.
            </div>
          )}
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
                selected === c.id
                  ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100"
                  : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="flex-1 min-w-0 truncate">
                {c.counterpartyLabel ? (
                  <>
                    <span className="text-slate-100">{c.counterpartyLabel}</span>
                    <code className="ml-1.5 text-[9px] text-slate-500">{shortRef(c.counterpartyRef)}</code>
                  </>
                ) : (
                  <code>{shortRef(c.counterpartyRef)}</code>
                )}
              </span>
              {c.status === "revoked" && <span className="text-[10px] text-rose-400">revoked</span>}
            </button>
          ))}
        </div>

        {/* Selected channel */}
        <div>
          {selected ? (
            <ChannelPane
              key={selected}
              channelId={selected}
              channel={channels.find((c) => c.id === selected) ?? null}
              onRenamed={loadChannels}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-slate-800 bg-slate-900/40 px-3 py-10 text-xs text-slate-500">
              Select a channel to view messages and shared artifacts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── One channel: messages + shared artifacts ─────────────────────────────────

function ChannelPane({ channelId, channel, onRenamed }: { channelId: string; channel: PeerChannel | null; onRenamed: () => void | Promise<void> }) {
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [artifacts, setArtifacts] = useState<SharedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [busyArtifact, setBusyArtifact] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const saveName = useCallback(async () => {
    setSavingName(true);
    try {
      await jf(`/api/qubetalk/peer-channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: nameDraft }),
      });
      setRenaming(false);
      await onRenamed();
    } catch {
      /* best-effort — a rename failure leaves the prior name */
    } finally {
      setSavingName(false);
    }
  }, [channelId, nameDraft, onRenamed]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, a] = await Promise.all([
        jf<{ messages: PeerMessage[] }>(`/api/qubetalk/peer-channels/${channelId}/messages`),
        jf<{ artifacts: SharedArtifact[] }>(`/api/qubetalk/peer-channels/${channelId}/artifacts`),
      ]);
      setMessages(m.messages ?? []);
      setArtifacts(a.artifacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channel");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await jf(`/api/qubetalk/peer-channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "message", body: text }),
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [body, channelId, load]);

  const act = useCallback(
    async (artifactId: string, action: "open" | "copy-to-locker") => {
      setBusyArtifact(`${artifactId}:${action}`);
      setError(null);
      try {
        await jf(`/api/qubetalk/peer-channels/${channelId}/artifacts/${artifactId}/${action}`, {
          method: "POST",
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setBusyArtifact(null);
      }
    },
    [channelId, load],
  );

  return (
    <div className="space-y-3 rounded-md border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setRenaming(false); }}
              placeholder="Name this channel (e.g. Austin)…"
              className="flex-1 rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60 focus:outline-none"
            />
            <button onClick={saveName} disabled={savingName} className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/15 px-1.5 py-1 text-[10px] text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-50">
              {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
            </button>
            <button onClick={() => setRenaming(false)} className="text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-slate-400">
            <span className="truncate">
              Channel with{" "}
              <span className="text-slate-100">{channel ? channelName(channel) : "—"}</span>
              {channel?.counterpartyLabel && (
                <code className="ml-1.5 text-[9px] text-slate-500">{shortRef(channel.counterpartyRef)}</code>
              )}
            </span>
            {channel && (
              <button
                onClick={() => { setNameDraft(channel.counterpartyLabel ?? ""); setRenaming(true); }}
                className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Name this channel — a private nickname only you see (never shared, never in receipts)"
              >
                {channel.counterpartyLabel ? "Rename" : "Name"}
              </button>
            )}
          </div>
        )}
        <button onClick={load} className="shrink-0 text-slate-500 hover:text-slate-300" title="Refresh channel">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      )}
      {error && <p className="text-xs text-amber-400">{error}</p>}

      {/* Shared artifacts */}
      {artifacts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Shared artifacts</div>
          {artifacts.map((a) => {
            const canCopy = !a.mine && a.rights.copyToLocker && !a.copiedToLockerAt;
            return (
              <div key={a.id} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-slate-200">
                      {a.title || a.artifactType}
                      <span className="ml-1.5 text-[10px] text-slate-500">· {a.artifactType}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{a.mine ? "shared by you" : "shared with you"}</span>
                      <span>·</span>
                      <span>
                        rights:{" "}
                        {(Object.keys(a.rights) as (keyof RightsEnvelope)[])
                          .filter((k) => a.rights[k])
                          .join(", ") || "view"}
                      </span>
                      {a.openedAt && <span className="text-emerald-500">· opened</span>}
                      {a.copiedToLockerAt && <span className="text-indigo-400">· in locker</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!a.mine && (
                      <button
                        onClick={() => act(a.id, "open")}
                        disabled={busyArtifact === `${a.id}:open` || Boolean(a.openedAt)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                        title={a.openedAt ? "Already opened" : "Mark as opened (records a receipt)"}
                      >
                        {busyArtifact === `${a.id}:open` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                        Open
                      </button>
                    )}
                    {canCopy && (
                      <button
                        onClick={() => act(a.id, "copy-to-locker")}
                        disabled={busyArtifact === `${a.id}:copy-to-locker`}
                        className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-40"
                        title="Copy this shared artifact into your locker (rights.copyToLocker granted)"
                      >
                        {busyArtifact === `${a.id}:copy-to-locker` ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderInput className="h-3 w-3" />}
                        Copy to locker
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Messages</div>
        {messages.length === 0 && !loading && (
          <p className="text-xs text-slate-600">No messages yet.</p>
        )}
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-md px-3 py-1.5 text-xs ${
                m.mine
                  ? "ml-auto border border-indigo-500/40 bg-indigo-500/10 text-slate-100"
                  : "border border-slate-800 bg-slate-950/50 text-slate-300"
              }`}
            >
              {m.type !== "message" && (
                <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-500">{m.type}</span>
              )}
              {m.body}
              <div className="mt-0.5 text-[9px] text-slate-600">{new Date(m.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
          placeholder="Write a message…"
          disabled={channel?.status === "revoked"}
          className="flex-1 rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={post}
          disabled={sending || !body.trim() || channel?.status === "revoked"}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send
        </button>
      </div>
    </div>
  );
}

// ── "Share via QubeTalk" affordance (embeddable on any artifact surface) ─────

export interface ShareViaQubeTalkProps {
  artifactType: string;
  artifactId: string;
  title: string;
  /** Optional confidential provenance note (no bytes, no URL — a reference). */
  locationRef?: string | null;
}

/**
 * A compact button that opens a popover to share the given artifact REFERENCE
 * into a peer channel (existing, or newly opened by counterparty reference),
 * with a minimal rights envelope. Reference-only — no bytes leave, honouring
 * the gated-content discipline.
 */
export function ShareViaQubeTalkButton({ artifactType, artifactId, title, locationRef }: ShareViaQubeTalkProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        title="Share this reference with a counterparty over a personhood-bound QubeTalk channel"
      >
        <Share2 className="h-3.5 w-3.5" /> Share via QubeTalk
      </button>
      {open && (
        <ShareDialog
          artifactType={artifactType}
          artifactId={artifactId}
          title={title}
          locationRef={locationRef ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareDialog({
  artifactType,
  artifactId,
  title,
  locationRef,
  onClose,
}: ShareViaQubeTalkProps & { onClose: () => void }) {
  const [channels, setChannels] = useState<PeerChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(""); // channelId or ""
  const [newRef, setNewRef] = useState("");
  const [copyToLocker, setCopyToLocker] = useState(false);
  const [download, setDownload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await jf<{ channels: PeerChannel[] }>("/api/qubetalk/peer-channels");
        setChannels(data.channels ?? []);
        if (data.channels?.length) setTarget(data.channels[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load channels");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const usingNew = target === "";

  const share = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      let channelId = target;
      if (usingNew) {
        const ref = newRef.trim();
        if (!REF_RE.test(ref)) throw new Error("Enter a valid counterparty reference (16 hex)");
        const created = await jf<{ channel: PeerChannel }>("/api/qubetalk/peer-channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counterpartyRef: ref }),
        });
        channelId = created.channel.id;
      }
      await jf(`/api/qubetalk/peer-channels/${channelId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType,
          artifactId,
          title,
          locationRef,
          relationship: "artifact_share",
          rights: { view: true, copyToLocker, download },
        }),
      });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setBusy(false);
    }
  }, [target, usingNew, newRef, artifactType, artifactId, title, locationRef, copyToLocker, download, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-3 rounded-lg border border-slate-800 bg-slate-900/95 p-4 shadow-lg shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
            <Share2 className="h-4 w-4" /> Share via QubeTalk
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          <div className="truncate">{title}</div>
          <div className="text-[10px] text-slate-500">reference-only · {artifactType} · no bytes leave the app</div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading channels…
          </div>
        ) : (
          <>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500">Channel</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500/60 focus:outline-none"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {channelName(c)}
                </option>
              ))}
              <option value="">+ new channel (enter reference)</option>
            </select>
            {usingNew && (
              <input
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                placeholder="counterparty reference (16 hex)"
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60 focus:outline-none"
              />
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wide text-slate-500">Rights granted</label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked disabled className="accent-indigo-500" /> View (always)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={copyToLocker}
                  onChange={(e) => setCopyToLocker(e.target.checked)}
                  className="accent-indigo-500"
                />
                Copy to their locker
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={download}
                  onChange={(e) => setDownload(e.target.checked)}
                  className="accent-indigo-500"
                />
                Allow download
              </label>
            </div>

            {error && <p className="text-xs text-amber-400">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={share}
                disabled={busy || done || (usingNew && !newRef.trim())}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1.5 text-xs text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                {done ? "Shared" : "Share"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
