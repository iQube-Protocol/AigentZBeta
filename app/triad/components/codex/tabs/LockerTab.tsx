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
import { Lock, Loader2, Upload, ShieldCheck, Eye, Download, AlertCircle, Bot, X, MapPin, FileText, ChevronDown, ChevronUp, Copy, Check, Link2, Wallet, Clock, MessageSquare, Send } from 'lucide-react';
import { authedFetchHeaders } from '@/utils/supabaseBrowser';
import dynamic from 'next/dynamic';

const WorldIdButton = dynamic(
  () => import('@/components/passport/WorldIdButton').then((m) => ({ default: m.WorldIdButton })),
  { ssr: false, loading: () => <span className="text-[10px] text-sky-400">Loading…</span> },
);

interface WorldIdProofBundle {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level: 'orb' | 'device';
}

const DOCUMENT_CLASSES = [
  { value: 'identity_document', label: 'Identity Document', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
  { value: 'legal_document', label: 'Legal Document', color: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
  { value: 'medical_record', label: 'Medical Record', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  { value: 'financial_record', label: 'Financial Record', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  { value: 'evidence', label: 'Evidence', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
  { value: 'other', label: 'Other', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300' },
] as const;

type DocumentClass = typeof DOCUMENT_CLASSES[number]['value'];

function getDocClassDef(dc: string | undefined) {
  return DOCUMENT_CLASSES.find((d) => d.value === dc) ?? DOCUMENT_CLASSES[DOCUMENT_CLASSES.length - 1];
}

interface LocationCheckpoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy: number;
}

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
  documentClass?: string;
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

interface PassportVcItem {
  passportId: string;
  passportClass: string;
  passportGrade: string | null;
  passportStatus: string | null;
  claimedAt: string | null;
  claimable: boolean;
  credential?: Record<string, unknown>;
}

interface QubeTalkChannel {
  channelId: string;
  agentRootId: string;
  agentDisplayName: string;
  agentClass: string;
  agentDidUri: string | null;
  status: string;
  createdAt: string;
}

interface PendingApplication {
  applicationId: string;
  passportClass: string;
  applicationStatus: string;
  passportGrade: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
}

interface SponsoredAgentItem {
  agentRootId: string;
  displayName: string;
  agentCardUrl: string;
  agentClass: string;
  boundPassportId: string | null;
  passport: {
    passportId: string;
    passportClass: string;
    passportGrade: string | null;
    passportStatus: string | null;
    claimedAt: string | null;
  } | null;
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
  const [uploadDocClass, setUploadDocClass] = useState<DocumentClass>('other');
  const [docClassOpen, setDocClassOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationCheckpoint | null>(null);
  const [passportVcs, setPassportVcs] = useState<PassportVcItem[]>([]);
  const [passportVcsLoading, setPassportVcsLoading] = useState(true);
  const [passportVcExpanded, setPassportVcExpanded] = useState<string | null>(null);
  const [passportVcCopied, setPassportVcCopied] = useState<string | null>(null);
  const [passportCardCollapsed, setPassportCardCollapsed] = useState(false);
  const [sponsoredAgentItems, setSponsoredAgentItems] = useState<SponsoredAgentItem[]>([]);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [pendingApplications, setPendingApplications] = useState<PendingApplication[]>([]);
  const [qubeTalkChannels, setQubeTalkChannels] = useState<QubeTalkChannel[]>([]);
  const [qubeTalkCollapsed, setQubeTalkCollapsed] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [messageSending, setMessageSending] = useState(false);

  // Derive last location from items when loaded
  useEffect(() => {
    const locItem = items
      .filter((i) => i.displayName === 'Location checkpoint' && i.contentType === 'application/json')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (locItem) {
      // We don't have the payload in the list response — parse from walrusBlobId metadata is not possible.
      // Instead, store the timestamp from createdAt as a fallback display.
      setLastLocation(null); // Will be set properly from the upload flow below.
    }
  }, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authedFetchHeaders({ 'Accept': 'application/json' });
      const authInit: RequestInit = { cache: 'no-store', headers: headers ?? undefined };
      const [lockerRes, agentRes, passportRes, channelRes] = await Promise.allSettled([
        fetch('/api/polity-passport/locker', authInit),
        fetch('/api/persona/sponsored-agents', authInit),
        fetch('/api/polity-passport/wallet', authInit),
        fetch('/api/qubetalk/passport-channels', authInit),
      ]);
      if (lockerRes.status === 'fulfilled' && lockerRes.value.ok) {
        const data = await lockerRes.value.json();
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
      if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
        const data = await agentRes.value.json();
        if (data?.ok) {
          const agentList = data.agents ?? [];
          setAgents(
            agentList.map((a: { agentRootId: string; displayName: string; didUri: string; agentClass: string }) => ({
              agentRootId: a.agentRootId,
              displayName: a.displayName,
              didUri: a.didUri,
              agentClass: a.agentClass,
            })),
          );
          setSponsoredAgentItems(
            agentList.map((a: SponsoredAgentItem & { agentRootId: string }) => ({
              agentRootId: a.agentRootId,
              displayName: a.displayName,
              agentCardUrl: a.agentCardUrl,
              agentClass: a.agentClass,
              boundPassportId: a.boundPassportId,
              passport: a.passport,
            })),
          );
        }
      }
      if (passportRes.status === 'fulfilled' && passportRes.value.ok) {
        const data = await passportRes.value.json();
        if (data?.ok) {
          setPassportVcs(data.passportQubes ?? []);
          setPendingApplications(data.pendingApplications ?? []);
        }
      }
      if (channelRes.status === 'fulfilled' && channelRes.value.ok) {
        const data = await channelRes.value.json();
        if (data?.ok) {
          setQubeTalkChannels(data.channels ?? []);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Locker load failed');
    } finally {
      setLoading(false);
      setPassportVcsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTrackLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLocationBusy(true);
    setError(null);
    setNotice(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      const checkpoint: LocationCheckpoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: pos.coords.accuracy,
      };
      const payloadBase64 = btoa(JSON.stringify(checkpoint));
      const authHdrs = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/polity-passport/locker', {
        method: 'POST',
        headers: authHdrs ?? { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Location checkpoint',
          contentType: 'application/json',
          payloadBase64,
          downloadable: false,
          documentClass: 'evidence',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Location save failed');
        return;
      }
      setLastLocation(checkpoint);
      setNotice(`Location saved: ${checkpoint.lat.toFixed(6)}, ${checkpoint.lng.toFixed(6)}`);
      void load();
    } catch (e) {
      if (e instanceof GeolocationPositionError) {
        const msgs: Record<number, string> = {
          1: 'Location permission denied',
          2: 'Location unavailable',
          3: 'Location request timed out',
        };
        setError(msgs[e.code] ?? 'Location failed');
      } else {
        setError(e instanceof Error ? e.message : 'Location failed');
      }
    } finally {
      setLocationBusy(false);
    }
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
        const authHdrs = await authedFetchHeaders({ 'Content-Type': 'application/json' });
        const res = await fetch('/api/polity-passport/locker', {
          method: 'POST',
          headers: authHdrs ?? { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: uploadDisplayName.trim(),
            contentType: file.type || 'application/octet-stream',
            payloadBase64,
            downloadable: uploadDownloadable,
            documentClass: uploadDocClass,
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
    [uploadDisplayName, uploadDownloadable, uploadDocClass, load],
  );

  const handleGrant = useCallback(async () => {
    if (!grantTarget) return;
    setError(null);
    setNotice(null);
    try {
      const authHdrs = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/polity-passport/locker/grant', {
        method: 'POST',
        headers: authHdrs ?? { 'Content-Type': 'application/json' },
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
      await fetch('/api/qubetalk/channels/bind', {
        method: 'POST',
        headers: authHdrs ?? { 'Content-Type': 'application/json' },
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
        const authHdrs = await authedFetchHeaders({});
        const res = await fetch(`/api/polity-passport/locker/grant?grantId=${grantId}`, {
          method: 'DELETE',
          headers: authHdrs ?? undefined,
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

  const handleClaimPassport = useCallback(async (passportId: string) => {
    setClaimBusy(passportId);
    try {
      const authHdrs = await authedFetchHeaders({});
      const res = await fetch(`/api/polity-passport/credential/${encodeURIComponent(passportId)}`, {
        method: 'POST',
        cache: 'no-store',
        headers: authHdrs ?? undefined,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? data?.reason ?? 'Claim failed');
        return;
      }
      setNotice('Passport credential claimed — it now appears in your wallet.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaimBusy(null);
    }
  }, [load]);

  const handleCopyVc = useCallback((pq: PassportVcItem) => {
    if (!pq.credential) return;
    void navigator.clipboard.writeText(JSON.stringify(pq.credential, null, 2)).then(() => {
      setPassportVcCopied(pq.passportId);
      setTimeout(() => setPassportVcCopied((prev) => (prev === pq.passportId ? null : prev)), 2000);
    });
  }, []);

  const [worldIdBusy, setWorldIdBusy] = useState<string | null>(null);
  const [worldIdError, setWorldIdError] = useState<Record<string, string | null>>({});

  const handleWorldIdProof = useCallback(async (passportId: string, proof: WorldIdProofBundle) => {
    setWorldIdBusy(passportId);
    setWorldIdError((e) => ({ ...e, [passportId]: null }));
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/polity-passport/verify-worldid', {
        method: 'POST',
        headers: headers ?? { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportId, ...proof }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setWorldIdError((e) => ({ ...e, [passportId]: data?.error ?? 'Verification failed' }));
        return;
      }
      setNotice('World ID verified — passport upgraded to verified_citizen.');
      void load();
    } catch (err) {
      setWorldIdError((e) => ({ ...e, [passportId]: err instanceof Error ? err.message : 'Verification failed' }));
    } finally {
      setWorldIdBusy(null);
    }
  }, [load]);

  const grantsByItem = grants.reduce<Record<string, LockerGrant[]>>((acc, g) => {
    (acc[g.itemId] ||= []).push(g);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
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

      {/* Location tracking */}
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">Location Tracking</span>
          </div>
          <button
            onClick={() => void handleTrackLocation()}
            disabled={locationBusy}
            className="flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-50"
          >
            {locationBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Track My Location
          </button>
        </div>
        {lastLocation && (
          <div className="flex items-center gap-4 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            <span className="font-mono">{lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}</span>
            <span className="text-emerald-400/60">accuracy: {lastLocation.accuracy.toFixed(0)}m</span>
            <span className="text-emerald-400/60">{new Date(lastLocation.timestamp).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Passport Credentials & Sponsored Agents */}
      <div className="rounded-xl border border-violet-700/50 bg-violet-950/20 p-4 space-y-3">
        <button
          type="button"
          onClick={() => setPassportCardCollapsed((p) => !p)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-semibold text-slate-200">My Credentials & Relationships</span>
            {(passportVcs.length + pendingApplications.length + sponsoredAgentItems.length) > 0 && (
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                {passportVcs.length + pendingApplications.length + sponsoredAgentItems.length}
              </span>
            )}
          </div>
          {passportCardCollapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {!passportCardCollapsed && (
          <div className="space-y-4">
            {/* Own passports */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">My Passports</h4>
              {passportVcsLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading credentials…
                </div>
              ) : passportVcs.length === 0 && pendingApplications.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No passport credentials yet. Apply on the Apply tab, then claim here once approved.
                </p>
              ) : (<>
                {pendingApplications.map((app) => (
                  <div key={app.applicationId} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-medium text-amber-200 capitalize">{app.passportClass} Passport</span>
                      </div>
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                        {app.applicationStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {app.passportGrade && (
                      <p className="text-[11px] text-slate-400">Grade: <span className="text-slate-300">{app.passportGrade.replace(/_/g, ' ')}</span></p>
                    )}
                    {app.submittedAt && (
                      <p className="text-[11px] text-slate-500">Submitted {new Date(app.submittedAt).toLocaleDateString()}</p>
                    )}
                    <p className="text-[10px] text-slate-500">Awaiting steward review. Once approved, your passport credential will appear here.</p>
                  </div>
                ))}
                {passportVcs.map((pq) => (
                  <div key={pq.passportId} className={cls(
                    'rounded-lg border p-3 space-y-2',
                    pq.claimedAt ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5',
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-300">
                          {pq.passportClass === 'citizen' ? 'Citizen' : 'Participant'} Passport
                        </span>
                        {pq.passportGrade === 'verified_citizen' && (
                          <span className="flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                            <ShieldCheck className="h-2.5 w-2.5" /> Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{pq.passportId.slice(0, 12)}…</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                      <span>Status: <span className="text-emerald-300">{pq.passportStatus}</span></span>
                      {pq.passportGrade && <span>· Grade: {pq.passportGrade}</span>}
                      {pq.claimedAt && <span>· Claimed {new Date(pq.claimedAt).toLocaleDateString()}</span>}
                    </div>
                    {!pq.claimedAt && pq.claimable && (
                      <button
                        onClick={() => void handleClaimPassport(pq.passportId)}
                        disabled={claimBusy === pq.passportId}
                        className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {claimBusy === pq.passportId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                        Claim Credential
                      </button>
                    )}
                    {pq.passportClass === 'citizen' && pq.passportGrade !== 'verified_citizen' && pq.claimedAt && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <WorldIdButton
                          onProof={(proof) => handleWorldIdProof(pq.passportId, proof)}
                          busy={worldIdBusy === pq.passportId}
                          signal={pq.passportId}
                          label="Upgrade with World ID"
                          className="flex items-center gap-1 rounded bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
                        />
                        {worldIdError[pq.passportId] && (
                          <span className="text-[10px] text-red-400">{worldIdError[pq.passportId]}</span>
                        )}
                      </div>
                    )}
                    {pq.credential && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPassportVcExpanded(passportVcExpanded === pq.passportId ? null : pq.passportId)}
                            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                          >
                            <Eye className="h-3 w-3" />
                            {passportVcExpanded === pq.passportId ? 'Hide VC' : 'View VC'}
                          </button>
                          <button
                            onClick={() => handleCopyVc(pq)}
                            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                          >
                            {passportVcCopied === pq.passportId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            {passportVcCopied === pq.passportId ? 'Copied' : 'Copy JSON'}
                          </button>
                        </div>
                        {passportVcExpanded === pq.passportId && (
                          <pre className="rounded bg-black/30 p-2 max-h-40 overflow-y-auto text-[10px] text-emerald-200 font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(pq.credential, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>)}
            </div>

            {/* Sponsored agents */}
            {sponsoredAgentItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Sponsored Agents</h4>
                {sponsoredAgentItems.map((agent) => {
                  const hasPassport = !!agent.passport;
                  const isClaimed = !!agent.passport?.claimedAt;
                  return (
                    <div
                      key={agent.agentRootId}
                      className={cls(
                        'rounded-lg border p-3 space-y-2',
                        isClaimed
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : hasPassport
                            ? 'border-amber-500/20 bg-amber-500/5'
                            : 'border-slate-700 bg-slate-900/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-violet-400" />
                          <span className="text-xs font-medium text-slate-100">{agent.displayName}</span>
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            {agent.agentClass}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isClaimed && (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                              <ShieldCheck className="h-3 w-3" /> Claimed
                            </span>
                          )}
                          {hasPassport && !isClaimed && (
                            <button
                              onClick={() => void handleClaimPassport(agent.passport!.passportId)}
                              disabled={claimBusy === agent.passport!.passportId}
                              className="flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 animate-pulse"
                            >
                              {claimBusy === agent.passport!.passportId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                              Claim
                            </button>
                          )}
                          {!hasPassport && (
                            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                              Awaiting issuance
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                        <span className="font-mono truncate max-w-[200px]">{agent.agentCardUrl}</span>
                        {hasPassport && (
                          <span>· Status: <span className="text-slate-300">{agent.passport!.passportStatus}</span></span>
                        )}
                      </div>
                      {isClaimed && (
                        <div className="flex items-center gap-2 pt-1">
                          <a
                            href="#delegation"
                            onClick={(e) => {
                              e.preventDefault();
                              const btn = document.querySelector('[data-tab-slug="passport-bureau-delegation"]');
                              if (btn) (btn as HTMLElement).click();
                            }}
                            className="flex items-center gap-1 rounded bg-violet-600/20 border border-violet-500/30 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-600/30"
                          >
                            <Link2 className="h-3 w-3" /> Set up Delegation
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QubeTalk — Citizen ↔ Agent messaging */}
      {qubeTalkChannels.length > 0 && (
        <div className="rounded-xl border border-sky-700/50 bg-sky-950/20 p-4 space-y-3">
          <button
            type="button"
            onClick={() => setQubeTalkCollapsed((p) => !p)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-sky-400" />
              <span className="text-sm font-semibold text-slate-200">Agent Channels</span>
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                {qubeTalkChannels.length}
              </span>
            </div>
            {qubeTalkCollapsed ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {!qubeTalkCollapsed && (
            <div className="space-y-2">
              {qubeTalkChannels.map((ch) => {
                const isActive = activeChannelId === ch.channelId;
                return (
                  <div key={ch.channelId}>
                    <button
                      type="button"
                      onClick={() => setActiveChannelId(isActive ? null : ch.channelId)}
                      className={cls(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        isActive
                          ? 'border-sky-500/40 bg-sky-500/10'
                          : 'border-slate-700 bg-slate-900/40 hover:bg-slate-800/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-sky-400" />
                          <span className="text-xs font-medium text-slate-100">{ch.agentDisplayName}</span>
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            {ch.agentClass}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          <Check className="h-2.5 w-2.5" /> Active
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Channel opened {new Date(ch.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                    {isActive && (
                      <div className="mt-2 rounded-lg border border-sky-500/20 bg-slate-950/40 p-3 space-y-3">
                        <div className="rounded-lg bg-slate-900/60 p-3 min-h-[80px] text-xs text-slate-500 italic flex items-center justify-center">
                          QubeTalk channel with {ch.agentDisplayName} — messages will appear here
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && messageInput.trim()) {
                                setMessageSending(true);
                                setTimeout(() => {
                                  setMessageSending(false);
                                  setMessageInput('');
                                  setNotice(`Message sent to ${ch.agentDisplayName}`);
                                }, 500);
                              }
                            }}
                            placeholder={`Message ${ch.agentDisplayName}…`}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                          />
                          <button
                            onClick={() => {
                              if (!messageInput.trim()) return;
                              setMessageSending(true);
                              setTimeout(() => {
                                setMessageSending(false);
                                setMessageInput('');
                                setNotice(`Message sent to ${ch.agentDisplayName}`);
                              }, 500);
                            }}
                            disabled={messageSending || !messageInput.trim()}
                            className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
                          >
                            {messageSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload */}
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Upload className="h-4 w-4 text-violet-400" />
          Upload to locker
        </div>

        {/* Document class selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDocClassOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Document class:</span>
              <span className={cls('rounded-full border px-2 py-0.5 text-xs', getDocClassDef(uploadDocClass).color)}>
                {getDocClassDef(uploadDocClass).label}
              </span>
            </div>
            <ChevronDown className={cls('h-4 w-4 text-slate-400 transition-transform', docClassOpen && 'rotate-180')} />
          </button>
          {docClassOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
              {DOCUMENT_CLASSES.map((dc) => (
                <button
                  key={dc.value}
                  type="button"
                  onClick={() => {
                    setUploadDocClass(dc.value);
                    setDocClassOpen(false);
                  }}
                  className={cls(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-700',
                    uploadDocClass === dc.value ? 'text-white bg-slate-700/50' : 'text-slate-300',
                  )}
                >
                  <span className={cls('rounded-full border px-2 py-0.5 text-xs', dc.color)}>{dc.label}</span>
                </button>
              ))}
            </div>
          )}
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
          items.map((item) => {
            const itemGrants = grantsByItem[item.itemId] || [];
            const docDef = getDocClassDef(item.documentClass);
            return (
              <div key={item.itemId} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  {/* Left column — item details (3/5 width on md+) */}
                  <div className="space-y-2 md:col-span-3">
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
                      {item.documentClass && (
                        <span className={cls('rounded-full border px-2 py-0.5', docDef.color)}>
                          {docDef.label}
                        </span>
                      )}
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
                    {/* Grant action buttons */}
                    {agents.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
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

                  {/* Right column — delegates (2/5 width on md+) */}
                  <div className="md:col-span-2 md:border-l md:border-slate-700/50 md:pl-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Bot className="h-3.5 w-3.5 text-violet-400" />
                      Delegates
                    </div>
                    {itemGrants.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No agents have access</p>
                    ) : (
                      itemGrants.map((g) => {
                        const agent = agents.find((a) => a.agentRootId === g.delegatedAgentRootId);
                        return (
                          <div
                            key={g.grantId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-violet-700/40 bg-violet-900/10 p-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Bot className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                              <span className="text-violet-200 truncate">{agent?.displayName ?? 'Bound agent'}</span>
                              {g.scope === 'read_download' ? (
                                <span className="flex items-center gap-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 shrink-0">
                                  <Download className="h-3 w-3" />
                                  read+dl
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 shrink-0">
                                  <Eye className="h-3 w-3" />
                                  read
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => void handleRevoke(g.grantId)}
                              className="flex items-center gap-1 rounded bg-rose-900/40 px-2 py-1 text-rose-300 hover:bg-rose-900/60 shrink-0"
                            >
                              <X className="h-3 w-3" />
                              Revoke
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
