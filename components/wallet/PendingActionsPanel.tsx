'use client';

/**
 * PENDING_ACTIONS — the wallet surface where the operator's own key acts.
 *
 * ── What this closes (Signing Phase 2) ─────────────────────────────────────
 *
 * The Register stage has been preparing real principal mandates and then
 * saying, honestly, that "the wallet surface for signing pending actions is
 * not built yet". The requests were real, recorded, and unreachable. This is
 * that surface.
 *
 * ── The two completions are not the same act ───────────────────────────────
 *
 * A PRINCIPAL request is completed by a signature this browser produces: the
 * envelope is decrypted locally with the wallet password, the exact payload is
 * signed, and only the signature is submitted. The server recovers and
 * compares it against the bound address — the same discipline as the control
 * proof, for the same reason.
 *
 * An AGENT request is completed by an approval. No signature comes from here,
 * because the agent's key is under bounded custody and approving IS the
 * trigger. Presenting that as "sign" would tell the operator they are doing
 * something they are not, and would blur the one distinction the Wallet
 * Signing Topology ruling exists to draw.
 *
 * ── Never a raw-message signer ─────────────────────────────────────────────
 *
 * This surface signs only what a prepared, purpose-bound request contains. It
 * has no field for arbitrary text and no path that would produce one. The
 * exact payload is shown before the password is asked for: a wallet that
 * signed something the signer never read would be blind signing with extra
 * steps.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, PenLine, ShieldCheck } from 'lucide-react';

import { personaFetch } from '@/utils/personaSpine';
import { decryptPrivateKey } from '@/services/wallet/keyService';
import { NO_COMPLETION_ROUTE_YET, routeForAction } from '@/services/signing/pendingActionRouting';
import { announceWalletSurfaceCompletion } from '@/services/wallet/walletSurfaceRequest';

interface PendingRequestView {
  id: string;
  actionKind: string;
  signerRole: string;
  /** Which signing DOMAIN this act belongs to: 'principal' or a runtimeAgentId. */
  walletRef: string;
  authoritySource: string;
  authorityCredential: string | null;
  status: string;
  subjectAgentRef: string | null;
  subjectAigentQubeId: string | null;
  network: string;
  payload: string;
  payloadHash: string;
  consequence: string;
  expiresAt: string;
  expired: boolean;
  receiptDestination: string;
  walletAddress: string | null;
  completion: 'principal-signature' | 'agent-approval' | null;
  actionLabel: string | null;
  actionSummary: string | null;
}

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">{children}</section>
);

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-1">
    <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/35">{label}</span>
    <span className="min-w-0 text-right text-[11px] text-white/70">{value}</span>
  </div>
);

/**
 * The two signing domains, named.
 *
 *   > "One SmartWallet shell, multiple sovereign wallets. Not: one merged
 *   >  wallet with shared custody."
 *
 * Grouping on `walletRef` is what keeps that true on screen. A flat list of
 * "things to click" would present a principal mandate and an agent-key
 * invocation as the same act done twice — which is exactly the collapse the
 * architecture exists to prevent.
 */
function walletGroupLabel(walletRef: string): { title: string; role: string } {
  if (walletRef === 'principal') {
    return {
      title: 'Principal Wallet',
      role: 'Authority and mandate — your own key, first-party custody',
    };
  }
  return {
    title: `${walletRef.replace(/^aigent-/, 'Aigent ').replace(/\b\w/g, (c) => c.toUpperCase())} Wallet`,
    role: 'Agent control and execution — bounded custody, invoked under your mandate',
  };
}

function relativeExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `expires in ${mins} min`;
  const hours = Math.round(mins / 60);
  return `expires in ${hours} h`;
}

export interface PendingActionsPanelProps {
  personaId: string;
  /** Announced back to whoever is waiting, once an action completes. */
  onCompleted?: (request: PendingRequestView) => void;
}

export const PendingActionsPanel: React.FC<PendingActionsPanelProps> = ({ personaId, onCompleted }) => {
  const [requests, setRequests] = useState<PendingRequestView[] | null>(null);
  const [loadRefusal, setLoadRefusal] = useState<{ refusal: string; detail: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowRefusal, setRowRefusal] = useState<{ id: string; refusal: string; detail: string } | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  /** Which card is expanded. Collapsed by default — the row is a summary. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /*
   * Inline refusal, INSIDE the card.
   *
   *   > "Do not open a new refusal modal."
   *
   * A confirmation that leaves the card loses the thing being confirmed. The
   * operator should be able to read the consequence while deciding not to
   * accept it.
   */
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadRefusal(null);
    try {
      const res = await personaFetch('/api/wallet/signing-requests', {
        cache: 'no-store',
        personaIdHint: personaId,
      });
      const j = (await res.json()) as { ok?: boolean; requests?: PendingRequestView[]; refusal?: string; detail?: string };
      if (!res.ok || !j.ok) {
        // An unreadable list is NOT an empty one. Rendering "nothing pending"
        // here would tell the operator their mandate had gone away.
        setLoadRefusal({
          refusal: j.refusal ?? `HTTP_${res.status}`,
          detail: j.detail ?? `Your pending actions could not be read (HTTP ${res.status}).`,
        });
        setRequests(null);
      } else {
        setRequests(j.requests ?? []);
      }
    } catch (e) {
      setLoadRefusal({
        refusal: 'UNREACHABLE',
        detail: `Your pending actions could not be read (${(e as Error).message}). This is not the same as having none.`,
      });
      setRequests(null);
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Complete one request.
   *
   * The password is used ONLY on the principal branch, only locally, and is
   * cleared the moment the act ends. The agent branch never reads it — a
   * bounded-custody approval that asked for the operator's wallet password
   * would be collecting a secret it has no use for.
   */
  const act = useCallback(
    async (request: PendingRequestView) => {
      const route = routeForAction(request.actionKind, request.signerRole);
      if (!route) return;
      setBusyId(request.id);
      setRowRefusal(null);
      let plaintextKey = '';
      try {
        let body: Record<string, unknown> = { requestId: request.id };

        if (route.completion === 'principal-signature') {
          const envRes = await personaFetch('/api/wallet/principal/envelope', {
            cache: 'no-store',
            personaIdHint: personaId,
          });
          const env = (await envRes.json()) as { encryptedEnvelope?: unknown; detail?: string; refusal?: string };
          if (!envRes.ok || !env.encryptedEnvelope) {
            setRowRefusal({
              id: request.id,
              refusal: env.refusal ?? 'NO_CONFIGURED_SIGNER',
              detail: env.detail ?? 'Your principal wallet could not be read, so nothing was signed.',
            });
            return;
          }
          try {
            plaintextKey = await decryptPrivateKey(
              env.encryptedEnvelope as Parameters<typeof decryptPrivateKey>[0],
              password,
            );
          } catch {
            setRowRefusal({
              id: request.id,
              refusal: 'WRONG_WALLET_PASSWORD',
              detail: 'That password did not unlock your wallet. Nothing was signed and nothing was changed.',
            });
            return;
          }
          const ethers = await import('ethers');
          // Signs the request's EXACT payload — never a message assembled here.
          const signature = await new ethers.Wallet('0x' + plaintextKey).signMessage(request.payload);
          body = { requestId: request.id, signature };
        }

        const res = await personaFetch(route.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          personaIdHint: personaId,
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; refusalCode?: string; txHash?: string; ownerWalletAddress?: string; network?: string }
          | null;
        if (!res.ok || !j?.ok) {
          setRowRefusal({
            id: request.id,
            refusal: j?.refusalCode ?? `HTTP_${res.status}`,
            detail:
              j?.error ??
              `The server refused this action and gave no reason (HTTP ${res.status}). Nothing downstream ran.`,
          });
          return;
        }
        setCompleted((prev) => [...prev, request.id]);
        onCompleted?.(request);
        // Serializable, so a Journey in another realm learns the act is done
        // and re-reads its own state. REFUSED is announced by refuse() below.
        announceWalletSurfaceCompletion({
          surface: 'PENDING_ACTIONS',
          outcome: 'ACTION_COMPLETED',
          result: {
            actionKind: request.actionKind,
            walletRef: request.walletRef,
            subjectAgentRef: request.subjectAgentRef,
            // Present only on the invocation approval — the broadcast's own
            // facts, which Register needs to drive the Horizen confirmation.
            txHash: j?.txHash ?? null,
            ownerWalletAddress: j?.ownerWalletAddress ?? null,
            network: j?.network ?? null,
          },
        });
      } catch (e) {
        setRowRefusal({
          id: request.id,
          refusal: 'ACTION_THREW',
          detail: `This action stopped with an unexpected error: ${(e as Error).message}.`,
        });
      } finally {
        plaintextKey = '';
        setPassword('');
        setBusyId(null);
        await load();
      }
    },
    [personaId, password, load, onCompleted],
  );

  /**
   * Decline an act. Terminal by design — a refusal that could be un-refused
   * would let a declined mandate be revived without the operator deciding a
   * second time.
   */
  const refuse = useCallback(
    async (request: PendingRequestView) => {
      setBusyId(request.id);
      setRowRefusal(null);
      try {
        const res = await personaFetch(`/api/wallet/signing-requests/${encodeURIComponent(request.id)}/refuse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          personaIdHint: personaId,
          body: JSON.stringify({ reason: refuseReason.trim() || 'Declined in the wallet. No reason given.' }),
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; refusal?: string; detail?: string } | null;
        if (!res.ok || !j?.ok) {
          setRowRefusal({
            id: request.id,
            refusal: j?.refusal ?? `HTTP_${res.status}`,
            detail: j?.detail ?? `The decline could not be recorded (HTTP ${res.status}).`,
          });
          return;
        }
        announceWalletSurfaceCompletion({ surface: 'PENDING_ACTIONS', outcome: 'ACTION_REFUSED' });
      } finally {
        setBusyId(null);
        setRefusingId(null);
        setRefuseReason('');
        await load();
      }
    },
    [personaId, load, refuseReason],
  );

  if (loading) {
    return (
      <Section>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Reading your pending actions…
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-3" data-surface="PENDING_ACTIONS">
      <Section>
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-violet-300" aria-hidden="true" />
          <h3 className="text-sm font-medium text-white">Pending actions</h3>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
          Acts waiting on you. Each one shows the exact text your key would cover and the exact consequence of
          completing it. Nothing here signs anything until you say so, and nothing here signs anything other than
          what it shows you.
        </p>
      </Section>

      {loadRefusal && (
        <Section>
          <div className="flex items-center gap-2 text-rose-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">{loadRefusal.refusal}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{loadRefusal.detail}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-white/70 hover:bg-slate-900"
          >
            Check again
          </button>
        </Section>
      )}

      {requests && requests.filter((r) => !r.expired).length === 0 && (
        <Section>
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" aria-hidden="true" />
            Nothing is waiting on you.
          </div>
          {/* An expired request is not an act waiting on you — but saying
              nothing about five of them would leave the operator wondering
              where their attempts went. Named, and named as residue. */}
          {requests.length > 0 && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
              {requests.length} earlier {requests.length === 1 ? 'request' : 'requests'} expired before being
              completed. Start the act again from the Journey to prepare a fresh one.
            </p>
          )}
        </Section>
      )}

      {/*
        GROUPED BY WALLET. One shell, several sovereign wallets — the grouping
        is what keeps that visible rather than merely asserted.
      */}
      {Object.entries(
        (requests ?? []).reduce<Record<string, PendingRequestView[]>>((acc, r) => {
          (acc[r.walletRef] ??= []).push(r);
          return acc;
        }, {}),
      ).map(([walletRef, groupRows]) => {
        const group = walletGroupLabel(walletRef);
        /*
         * ACTIONABLE FIRST, EXPIRED BELOW A DIVIDER (operator, 2026-08-02).
         *
         * The store orders by created_at ASC and expired mandates are never
         * reaped, so the OLDEST dead rows led and the list grew monotonically.
         * After five attempts the one request the operator could actually sign
         * was the sixth card down, under five identical expired ones — every
         * retry made the live one harder to find. That is the mechanism that
         * turned a short TTL into "signing failed".
         *
         * Expired rows are kept — they are the record of what was attempted —
         * but they are not peers of a live act and they never lead.
         */
        const rows = groupRows.filter((r) => !r.expired);
        const expiredRows = groupRows.filter((r) => r.expired);
        return (
          <div key={walletRef} className="space-y-2">
            <div className="px-1">
              <div className="text-xs font-semibold text-slate-100">{group.title}</div>
              <div className="text-[10px] text-white/35">{group.role}</div>
            </div>

            {[...rows, ...expiredRows].map((r, rowIndex) => {
              const startsExpiredBlock = rowIndex === rows.length && expiredRows.length > 0;
              const isOpen = openId === r.id;
              const isExpanded = expandedId === r.id;
              const isDone = completed.includes(r.id);
              const busy = busyId === r.id;
              const refusalRow = rowRefusal?.id === r.id ? rowRefusal : null;
              return (
                <React.Fragment key={r.id}>
                {startsExpiredBlock && (
                  <div className="flex items-center gap-2 px-1 pt-1">
                    <span className="text-[10px] uppercase tracking-wide text-white/30">
                      {expiredRows.length} expired — no longer actionable
                    </span>
                    <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
                  </div>
                )}
                <Section>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs font-medium text-slate-100">
                      {r.actionKind.replace(/_/g, ' ')}
                    </div>
                    {isDone && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                        <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" /> Done
                      </span>
                    )}
                  </div>

                  {/* COLLAPSED SUMMARY — action, signer, consequence, expiry,
                      status. Enough to decide whether to look closer, never
                      enough to sign on. */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/40">
                    <span className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5">
                      {walletRef === 'principal' ? 'You' : group.title}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${r.expired ? 'text-rose-300' : ''}`}>
                      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                      {relativeExpiry(r.expiresAt)}
                    </span>
                    <span className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5">
                      {isDone ? 'completed' : r.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/70">{r.consequence}</p>

                  {/* REVIEW — expands IN PLACE. The exact text and the full
                      constitutional detail, before the password is asked for:
                      a signature over something the signer never read is blind
                      signing however good the summary above it was. */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="mt-2 text-[10px] uppercase tracking-wide text-white/40 hover:text-white/70"
                  >
                    {isExpanded ? 'Hide detail' : 'Review'}
                  </button>

                  {isExpanded && (
                    <>
                      <div className="mt-1.5 divide-y divide-slate-800/70">
                        <Field label="Signer" value={walletRef === 'principal' ? 'You' : group.title} />
                        <Field label="Signer role" value={r.signerRole} />
                        <Field label="Authority source" value={r.authoritySource} />
                        <Field label="Subject" value={r.subjectAgentRef ?? '—'} />
                        <Field label="AigentQube" value={r.subjectAigentQubeId ?? '—'} />
                        <Field label="Wallet ref" value={<span className="font-mono text-[10px]">{r.walletRef}</span>} />
                        <Field
                          label="Wallet address"
                          value={
                            r.walletAddress ? (
                              <span className="break-all font-mono text-[10px]">{r.walletAddress}</span>
                            ) : (
                              <span className="text-white/30">held in bounded custody</span>
                            )
                          }
                        />
                        <Field label="Network" value={r.network} />
                        <Field label="Receipt destination" value={r.receiptDestination} />
                        <Field
                          label="Request hash"
                          value={<span className="break-all font-mono text-[9px]">{r.payloadHash}</span>}
                        />
                      </div>
                      {r.actionSummary && (
                        <p className="mt-2 text-[11px] leading-relaxed text-white/40">{r.actionSummary}</p>
                      )}
                      <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-white/35">
                          Exact text your key would cover
                        </div>
                        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-white/70">
                          {r.payload}
                        </pre>
                      </div>
                    </>
                  )}

                  {r.expired ? (
                    <p className="mt-2 text-[11px] text-rose-300">
                      This request expired before it was completed. Start the act again to prepare a fresh one — an
                      expired request is never revived.
                    </p>
                  ) : !r.completion ? (
                    <p className="mt-2 text-[11px] text-amber-200/80">{NO_COMPLETION_ROUTE_YET}</p>
                  ) : isDone ? null : (
                    <div className="mt-2.5 space-y-2">
                      {r.completion === 'principal-signature' && isOpen && (
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Wallet password"
                          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-white/30"
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy || (r.completion === 'principal-signature' && isOpen && password.length === 0)}
                          onClick={() => {
                            if (r.completion === 'principal-signature' && !isOpen) {
                              setOpenId(r.id);
                              return;
                            }
                            void act(r);
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 px-3 py-2 text-xs text-white transition-colors hover:from-violet-500/30 hover:to-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                          {r.actionLabel}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRefusingId(refusingId === r.id ? null : r.id)}
                          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white/60 transition-colors hover:border-rose-500/30 hover:text-rose-200 disabled:opacity-40"
                        >
                          Refuse
                        </button>
                      </div>

                      {/* Inline, inside the card — never a modal. A
                          confirmation that leaves the card loses the thing
                          being confirmed. */}
                      {refusingId === r.id && (
                        <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-2.5">
                          <div className="text-[11px] font-medium text-rose-200">Refuse this request?</div>
                          <p className="mt-1 text-[10px] leading-relaxed text-white/50">
                            This is terminal. The request closes and will not be offered again — start the act
                            afresh if you change your mind. Nothing already completed is undone.
                          </p>
                          <input
                            type="text"
                            value={refuseReason}
                            onChange={(e) => setRefuseReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="mt-1.5 w-full rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30"
                          />
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRefusingId(null);
                                setRefuseReason('');
                              }}
                              className="flex-1 rounded border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-white/60 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void refuse(r)}
                              className="flex-1 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
                            >
                              Confirm refusal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {refusalRow && (
                    <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-2.5">
                      <div className="text-[11px] font-medium text-rose-200">{refusalRow.refusal}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/60">{refusalRow.detail}</p>
                    </div>
                  )}
                </Section>
                </React.Fragment>
              );
            })}
          </div>
        );
      })}

    </div>
  );
};

export default PendingActionsPanel;
