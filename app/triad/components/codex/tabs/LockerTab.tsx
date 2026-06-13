'use client';

/**
 * LockerTab — Polity Passport Locker UI (Sprint 4).
 *
 * Holder-owned encrypted vault. Citizens upload documents, declarations,
 * and evidence; the system encrypts client-side, stores on Walrus, and
 * registers an access-policy object on Sui. Holders can grant per-item
 * read or read_download access to their bound agents (sponsored via
 * the Apply tab's Genesis flow).
 *
 * Upload UI repurposes the same file-input pattern as CodexUploadModal
 * (the canonical aigentMe/aigentZ upload modal); we keep the surface
 * inline rather than modal here so it integrates with the locker list.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 4. Sui+Walrus rail only —
 * AutoDrive flows untouched.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Loader2, Upload, ShieldCheck, Eye, Download, AlertCircle, Bot, X } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface LockerItem {
  itemId: string;
  displayName: string;
  contentType: string;
  sizeBytes: number | null;
  walrusBlobId: string;
  suiObjectId: string | null;
  downloadable: boolean;
  storageMode: 'stub' | 'sui-walrus';
  createdAt: string;
}

interface LockerGrant {
  grantId: string;
  itemId: string;
  delegatedAgentRootId: string | null;
  scope: 'read' | 'read_download';
  grantedAt: string;
  expiresAt: string | null;
}

interface SponsoredAgent {
  agentRootId: string;
  displayName: string;
  didUri: string;
  agentClass: string;
}

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function formatBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function LockerTab() {
  const [items, setItems] = useState<LockerItem[]>([]);
  const [grants, setGrants] = useState<LockerGrant[]>([]);
  const [agents, setAgents] = useState<SponsoredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadDownloadable, setUploadDownloadable] = useState(true);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [grantTarget, setGrantTarget] = useState<{ itemId: string; agentRootId: string; scope: 'read' | 'read_download' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lockerRes, agentRes] = await Promise.all([
        personaFetch('/api/polity-passport/locker', { cache: 'no-store' }),
        personaFetch('/api/persona/sponsored-agents', { cache: 'no-store' }),
      ]);
      if (lockerRes.ok) {
        const data = await lockerRes.json();
        if (data?.ok) {
          setItems(data.items ?? []);
          setGrants(data.grants ?? []);
          if (data.migrationPending) {
            setError(`Pending migration: ${data.migrationPending}`);
          }
        } else if (data?.error) {
          setError(data.error);
        }
      }
      if (agentRes.ok) {
        const data = await agentRes.json();
        if (data?.ok) {
          setAgents(
            (data.agents ?? []).map((a: { agentRootId: string; displayName: string; didUri: string; agentClass: string }) => ({
              agentRootId: a.agentRootId,
              displayName: a.displayName,
              didUri: a.didUri,
              agentClass: a.agentClass,
            })),
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Locker load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!uploadDisplayName.trim()) {
        setError('Provide a display name before uploading');
        return;
      }
      setUploadBusy(true);
      setError(null);
      setNotice(null);
      try {
        const payloadBase64 = await fileToBase64(file);
        const res = await personaFetch('/api/polity-passport/locker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: uploadDisplayName.trim(),
            contentType: file.type || 'application/octet-stream',
            payloadBase64,
            downloadable: uploadDownloadable,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setError(data?.error ?? 'Upload failed');
          return;
        }
        setNotice(`Uploaded ${data.item.displayName} → ${data.item.walrusBlobId.slice(0, 40)}…`);
        setUploadDisplayName('');
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploadBusy(false);
      }
    },
    [uploadDisplayName, uploadDownloadable, load],
  );

  const handleGrant = useCallback(async () => {
    if (!grantTarget) return;
    setError(null);
    setNotice(null);
    try {
      const res = await personaFetch('/api/polity-passport/locker/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: grantTarget.itemId,
          delegatedAgentRootId: grantTarget.agentRootId,
          scope: grantTarget.scope,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Grant failed');
        return;
      }

      // Also bind the QubeTalk channel (idempotent — does nothing if one exists).
      await personaFetch('/api/qubetalk/channels/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegatedAgentRootId: grantTarget.agentRootId, delegationGrantId: data.grant.grantId }),
      }).catch(() => {});

      setNotice(`Granted ${grantTarget.scope} access to agent`);
      setGrantTarget(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant failed');
    }
  }, [grantTarget, load]);

  const handleRevoke = useCallback(
    async (grantId: string) => {
      setError(null);
      try {
        const res = await personaFetch(`/api/polity-passport/locker/grant?grantId=${grantId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setError(data?.error ?? 'Revoke failed');
          return;
        }
        setNotice('Grant revoked');
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Revoke failed');
      }
    },
    [load],
  );

  const grantsByItem = grants.reduce<Record<string, LockerGrant[]>>((acc, g) => {
    (acc[g.itemId] ||= []).push(g);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Lock className="h-7 w-7 text-violet-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Polity Passport Locker</h2>
          <p className="text-sm text-slate-400">
            Holder-owned encrypted vault. Items publish to Walrus; Sui carries the access policy.
            Grant read or read+download access to your bound agents.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Upload */}
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Upload className="h-4 w-4 text-violet-400" />
          Upload to locker
        </div>
        <input
          value={uploadDisplayName}
          onChange={(e) => setUploadDisplayName(e.target.value)}
          placeholder="Item label (e.g. 'Birth certificate', 'Asylum letter')"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={uploadDownloadable}
            onChange={(e) => setUploadDownloadable(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800"
          />
          Allow delegated agents to download bytes (uncheck for view-only)
        </label>
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
          disabled={uploadBusy || !uploadDisplayName.trim()}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-xs file:font-medium file:text-white disabled:opacity-50"
        />
        {uploadBusy && (
          <p className="flex items-center gap-1.5 text-xs text-violet-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Encrypting + publishing…
          </p>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Your locker items</h3>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
            No items in your locker yet. Upload one above.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.itemId} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-sm text-slate-100 truncate">{item.displayName}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(item.sizeBytes)}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                <span>{item.contentType}</span>
                <span>·</span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                {item.downloadable ? (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">downloadable</span>
                ) : (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">view-only</span>
                )}
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5">{item.storageMode}</span>
              </div>
              <code className="block text-[10px] text-slate-500 font-mono break-all">
                walrus: {item.walrusBlobId}
              </code>
              {item.suiObjectId && (
                <code className="block text-[10px] text-slate-500 font-mono break-all">
                  sui: {item.suiObjectId}
                </code>
              )}

              {/* Existing grants */}
              {(grantsByItem[item.itemId] || []).map((g) => {
                const agent = agents.find((a) => a.agentRootId === g.delegatedAgentRootId);
                return (
                  <div
                    key={g.grantId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-violet-700/40 bg-violet-900/10 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-violet-400" />
                      <span className="text-violet-200">{agent?.displayName ?? 'Bound agent'}</span>
                      <span className="rounded-full bg-violet-900/60 px-2 py-0.5 text-[10px] text-violet-300">
                        {g.scope === 'read_download' ? <Download className="inline h-3 w-3 mr-0.5" /> : <Eye className="inline h-3 w-3 mr-0.5" />}
                        {g.scope}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleRevoke(g.grantId)}
                      className="flex items-center gap-1 rounded bg-rose-900/40 px-2 py-1 text-rose-300 hover:bg-rose-900/60"
                    >
                      <X className="h-3 w-3" />
                      Revoke
                    </button>
                  </div>
                );
              })}

              {/* Grant action */}
              {agents.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500">Grant to:</span>
                  {agents.map((agent) => (
                    <div key={agent.agentRootId} className="flex gap-1">
                      <button
                        onClick={() =>
                          setGrantTarget({
                            itemId: item.itemId,
                            agentRootId: agent.agentRootId,
                            scope: 'read',
                          })
                        }
                        className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                      >
                        <Eye className="h-3 w-3" />
                        {agent.displayName} · read
                      </button>
                      {item.downloadable && (
                        <button
                          onClick={() =>
                            setGrantTarget({
                              itemId: item.itemId,
                              agentRootId: agent.agentRootId,
                              scope: 'read_download',
                            })
                          }
                          className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                        >
                          <Download className="h-3 w-3" />
                          {agent.displayName} · read+dl
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Grant confirm */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGrantTarget(null)}>
          <div className="rounded-xl border border-violet-700 bg-slate-900 p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Confirm grant</h3>
            <p className="text-sm text-slate-400">
              Grant {grantTarget.scope === 'read_download' ? 'read + download' : 'read-only'} access to{' '}
              <span className="text-violet-300">{agents.find((a) => a.agentRootId === grantTarget.agentRootId)?.displayName}</span>?
              The agent will see this item in their QubeTalk channel with you.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGrantTarget(null)} className={cls('rounded px-3 py-1.5 text-sm bg-slate-800 text-slate-300 hover:bg-slate-700')}>
                Cancel
              </button>
              <button onClick={() => void handleGrant()} className={cls('rounded px-3 py-1.5 text-sm bg-violet-600 text-white hover:bg-violet-500')}>
                Grant access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
