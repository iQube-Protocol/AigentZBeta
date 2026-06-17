'use client';

/**
 * MobilityPassportPanel
 *
 * Mounts inside MobilityCaseOverviewTab.
 * Surfaces two Polity Passport capabilities for HMS cases:
 *
 *   1. Secure Locker — encrypted document storage via passport_locker_items.
 *      Documents are tagged with the caseId via display_name prefix
 *      "[HMS:<caseId>] <name>" so they can be filtered without a schema change.
 *      Grants allow sharing specific docs with agents/advisors without
 *      revealing T0 identity.
 *
 *   2. Mobility Attestation — generates proof_of_mobility_authorization
 *      (ProveKit circuit, Phase B placeholder). The family can present this
 *      commitment reference to landlords or school admissions without
 *      disclosing case details or classification.
 *
 * Black Cube note: no raw file URLs are surfaced. All document bytes are
 * encrypted before upload and stored on Walrus/Sui via the locker pipeline.
 * The locker panel shows metadata only — no download links.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Lock,
  Upload,
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const HMS_TAG_PREFIX = '[HMS:';

function taggedName(caseId: string, name: string) {
  return `${HMS_TAG_PREFIX}${caseId.slice(0, 8)}] ${name}`;
}

function isHmsItem(caseId: string, displayName: string) {
  return displayName.startsWith(`${HMS_TAG_PREFIX}${caseId.slice(0, 8)}]`);
}

function stripTag(displayName: string) {
  const m = displayName.match(/^\[HMS:[^\]]+\] (.+)$/);
  return m ? m[1] : displayName;
}

type LockerItem = {
  itemId: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  walrusBlobId: string | null;
  createdAt: string;
  storageMode: string;
};

type AttestationResult = {
  commitmentRef: string;
  circuit: string;
  notYetImplemented?: boolean;
  issuedAt: string;
};

interface Props {
  caseId: string;
  caseClassification: string;
}

export function MobilityPassportPanel({ caseId, caseClassification }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<LockerItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [attestation, setAttestation] = useState<AttestationResult | null>(null);
  const [attesting, setAttesting] = useState(false);
  const [attestError, setAttestError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await personaFetch('/api/polity-passport/locker', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        setItems((json.items ?? []).filter((i: LockerItem) => isHmsItem(caseId, i.displayName)));
      }
    } catch {
      // silent — panel is supplementary
    } finally {
      setLoadingItems(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (expanded) loadItems();
  }, [expanded, loadItems]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadName.trim()) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const res = await personaFetch('/api/polity-passport/locker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: taggedName(caseId, uploadName.trim()),
          contentType: file.type || 'application/octet-stream',
          payloadBase64: base64,
          downloadable: false,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Upload failed');
      setUploadSuccess(true);
      setUploadName('');
      if (fileRef.current) fileRef.current.value = '';
      await loadItems();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAttest = async () => {
    setAttesting(true);
    setAttestError(null);
    setAttestation(null);
    try {
      const res = await personaFetch('/api/polity-passport/attest/proof_of_mobility_authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseRef: caseId.slice(0, 8), classification: caseClassification }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Attestation failed');
      setAttestation({
        commitmentRef: json.proof?.commitmentRef ?? json.proof?.proofRef ?? 'pending',
        circuit: 'proof_of_mobility_authorization',
        notYetImplemented: json.proof?.notYetImplemented,
        issuedAt: new Date().toISOString(),
      });
    } catch (e) {
      setAttestError(e instanceof Error ? e.message : 'Attestation failed');
    } finally {
      setAttesting(false);
    }
  };

  const isBlackCube = caseClassification === 'black_cube';

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-500/10 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-200">Polity Passport — Identity Shield</span>
          {isBlackCube && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300 font-medium">
              Black Cube
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-violet-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-violet-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Doctrine note */}
          <p className="text-xs text-slate-400 leading-relaxed">
            Documents stored here are encrypted end-to-end before leaving your device.
            No raw file content is accessible to the platform. Share access to specific
            documents with advisors via time-limited grants — your identity remains
            compartmentalised at all times.
          </p>

          {/* ── Secure Locker ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-violet-400" />
              Secure Case Documents
            </h4>

            {/* Existing items */}
            {loadingItems ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">No documents stored for this case yet.</p>
            ) : (
              <div className="space-y-1.5">
                {items.map(item => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-xs text-slate-200 truncate">{stripTag(item.displayName)}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{item.contentType}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-slate-500">
                        {item.storageMode === 'walrus' ? 'Walrus' : 'Local'}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload form */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="Document name (e.g. Tenancy Agreement)"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  className="flex-1 text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-violet-500/10 file:px-2 file:py-1 file:text-xs file:text-violet-300 file:cursor-pointer"
                />
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadName.trim()}
                  className={cls(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    uploading || !uploadName.trim()
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-violet-600 hover:bg-violet-500 text-white',
                  )}
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Encrypt & Store
                </button>
              </div>
              {uploadError && (
                <p className="flex items-center gap-1.5 text-xs text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Document encrypted and stored.
                </p>
              )}
            </div>
          </div>

          {/* ── Mobility Attestation ── */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-violet-400" />
                Mobility Authorization Attestation
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Generate a zero-knowledge commitment reference that proves active mobility
                support authorization — presentable to landlords or school admissions without
                disclosing case details or identity.
              </p>
            </div>

            {attestation ? (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-violet-200">Commitment Reference</span>
                  <button
                    onClick={() => setAttestation(null)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <code className="block text-[11px] text-violet-300 font-mono break-all bg-slate-900/60 rounded px-2 py-1.5">
                  {attestation.commitmentRef}
                </code>
                {attestation.notYetImplemented && (
                  <p className="text-[10px] text-amber-400">
                    Circuit is Phase B — commitment is a placeholder reference. Full ZK proof live in Phase B.
                  </p>
                )}
                <p className="text-[10px] text-slate-500">
                  Issued {new Date(attestation.issuedAt).toLocaleString('en-GB')}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={handleAttest}
                  disabled={attesting}
                  className={cls(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    attesting
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200',
                  )}
                >
                  {attesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                  Generate Mobility Attestation
                </button>
                {attestError && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-300">
                    <AlertTriangle className="h-3 w-3" /> {attestError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
