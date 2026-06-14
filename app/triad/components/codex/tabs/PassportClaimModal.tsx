'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  Download,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Wallet,
  Link2,
} from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
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

interface PassportClaimModalProps {
  open: boolean;
  onClose: () => void;
  passportId: string;
  passportClass: string;
  onClaimed?: () => void;
}

type ClaimState = 'idle' | 'loading' | 'preview' | 'claiming' | 'claimed' | 'error';

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function PassportClaimModal({
  open,
  onClose,
  passportId,
  passportClass,
  onClaimed,
}: PassportClaimModalProps) {
  const [state, setState] = useState<ClaimState>('idle');
  const [credential, setCredential] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setState('idle');
      setCredential(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !passportId || state !== 'idle') return;
    setState('loading');
    fetch(`/api/polity-passport/credential/${encodeURIComponent(passportId)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.reason || json.error || 'Could not load credential');
          setState('error');
          return;
        }
        setCredential(json.credential);
        setState(json.claimed ? 'claimed' : 'preview');
      })
      .catch(() => {
        setError('Network error loading credential');
        setState('error');
      });
  }, [open, passportId, state]);

  const handleClaim = useCallback(async () => {
    setState('claiming');
    setError(null);
    try {
      const res = await personaFetch(
        `/api/polity-passport/credential/${encodeURIComponent(passportId)}`,
        { method: 'POST', cache: 'no-store' },
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.reason || json.error || 'Claim failed');
        setState('error');
        return;
      }
      setCredential(json.credential);
      setState('claimed');
      onClaimed?.();
    } catch {
      setError('Network error during claim');
      setState('error');
    }
  }, [passportId, onClaimed]);

  const handleCopy = useCallback(() => {
    if (!credential) return;
    navigator.clipboard.writeText(JSON.stringify(credential, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [credential]);

  const handleDownload = useCallback(() => {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passport-${passportId}.vc.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [credential, passportId]);

  const [worldIdBusy, setWorldIdBusy] = useState(false);
  const [worldIdError, setWorldIdError] = useState<string | null>(null);
  const [worldIdDone, setWorldIdDone] = useState(false);

  const handleWorldIdProof = useCallback(async (proof: WorldIdProofBundle) => {
    setWorldIdBusy(true);
    setWorldIdError(null);
    try {
      const headers = await authedFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/polity-passport/verify-worldid', {
        method: 'POST',
        headers: headers ?? { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportId, ...proof }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setWorldIdError(data?.error ?? 'Verification failed');
        return;
      }
      setWorldIdDone(true);
      onClaimed?.();
    } catch (err) {
      setWorldIdError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setWorldIdBusy(false);
    }
  }, [passportId, onClaimed]);

  const isCitizen = passportClass === 'citizen';
  const typeLabel = isCitizen ? 'Citizen Passport' : 'Participant Passport';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Claim {typeLabel}
          </DialogTitle>
        </DialogHeader>

        {(state === 'loading' || state === 'idle') && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-800 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        )}

        {(state === 'preview' || state === 'claiming') && credential && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Your passport credential is ready to claim. Claiming stores it as
              a <strong className="text-emerald-300">PassportQube</strong> in your
              wallet&apos;s iQube section — a W3C Verifiable Credential you hold.
            </p>

            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(credential, null, 2)}
              </pre>
            </div>

            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 space-y-1">
              <p className="text-xs text-violet-300 font-medium">What happens when you claim:</p>
              <ul className="text-xs text-slate-400 space-y-0.5 list-disc list-inside">
                <li>The credential is marked as claimed on the Bureau ledger</li>
                <li>A PassportQube appears in your wallet&apos;s iQube tab</li>
                <li>You can download the VC JSON for external storage</li>
                {isCitizen && <li>Citizen passports are irrevocable — your credential cannot be revoked</li>}
              </ul>
            </div>

            <button
              onClick={handleClaim}
              disabled={state === 'claiming'}
              className={cls(
                'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {state === 'claiming' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</>
              ) : (
                <><Wallet className="h-4 w-4" /> Claim to Wallet</>
              )}
            </button>
          </div>
        )}

        {state === 'claimed' && credential && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <Check className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-300">PassportQube Claimed</p>
                <p className="text-xs text-slate-400">
                  Your credential is stored in your wallet&apos;s iQube section.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(credential, null, 2)}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy VC'}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>

            {isCitizen && !worldIdDone && (
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-2">
                <p className="text-xs text-sky-300 font-medium">Validate your passport with World ID</p>
                <p className="text-[11px] text-slate-400">
                  Upgrade to <strong className="text-sky-200">verified_citizen</strong> by proving your personhood.
                  This is optional but unlocks higher trust bands for agent delegation.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <WorldIdButton
                    onProof={handleWorldIdProof}
                    busy={worldIdBusy}
                    signal={passportId}
                    label="Verify with World ID"
                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
                  />
                  {worldIdError && (
                    <span className="text-[10px] text-red-400">{worldIdError}</span>
                  )}
                </div>
              </div>
            )}

            {worldIdDone && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                <ShieldCheck className="h-5 w-5 text-sky-400" />
                <div>
                  <p className="text-sm font-medium text-sky-300">World ID Verified</p>
                  <p className="text-xs text-slate-400">Passport upgraded to verified_citizen.</p>
                </div>
              </div>
            )}

            {!isCitizen && (
              <button
                onClick={() => {
                  onClose();
                  const tabButtons = document.querySelectorAll('[data-tab-slug="passport-bureau-delegation"]');
                  if (tabButtons.length > 0) {
                    (tabButtons[0] as HTMLElement).click();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Link2 className="h-4 w-4" />
                Set up Bounded Delegation
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-violet-600/20 border border-violet-500/30 py-2 text-sm text-violet-300 hover:bg-violet-600/30"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
