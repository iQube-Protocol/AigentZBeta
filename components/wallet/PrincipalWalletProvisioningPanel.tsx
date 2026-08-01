'use client';

/**
 * PRINCIPAL_WALLET_PROVISIONING — the wallet surface that creates and proves a
 * first-party principal wallet.
 *
 * ── The boundary this component exists to hold (operator ruling, 2026-08-02) ─
 *
 *   Journey detects and explains the prerequisite
 *   → SmartWallet provisions and proves the wallet
 *   → Journey resumes the consequential act
 *
 *   > "Wallet creation and proof belong to the wallet. The Journey invokes
 *   >  them only when a consequential act requires them."
 *
 * So this is a WALLET SURFACE, mounted inside the drawer's surface-override
 * region beside PASSPORT_SIGN_IN — not a modal, and not a Register-stage
 * component. A Register-specific copy would be the second implementation of a
 * ceremony the wallet already owns (inv.engineering.037), and it would make
 * "provision a wallet" mean something different depending on where you started.
 *
 * ── Why the states are not merged ──────────────────────────────────────────
 *
 * NOT_CONFIGURED and AMBIGUOUS_DATA_DETECTED look identical from a distance —
 * both mean "you cannot sign yet". They have OPPOSITE remedies. The trace
 * (#121) found a persona row holding a real MetaMask address and a keyless
 * placeholder; superseding the wrong one severs a genuine binding. So the
 * ambiguous case shows what was found and what will happen to each address
 * before it offers the button.
 *
 * SIGNER_CONFIGURED and CONTROL_PROVEN are likewise distinct, and this is the
 * one the whole repair turns on: a stored envelope proves a row was written,
 * and only a signature that recovers proves a key exists. AWAITING_CONTROL_PROOF
 * is the state a wallet sits in when it looks finished and is not.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, KeyRound, AlertTriangle, Loader2, Ban, ArrowRight } from 'lucide-react';

import { personaFetch } from '@/utils/personaSpine';
import {
  provisionPrincipalWallet,
  proveExistingPrincipalWallet,
  type ProvisioningPhase,
} from '@/services/wallet/provisionPrincipalWalletClient';
import { announceWalletSurfaceCompletion } from '@/services/wallet/walletSurfaceRequest';

/** The ten states the operator specified, and nothing else. */
export type PrincipalProvisioningState =
  | 'NOT_CONFIGURED'
  | 'AMBIGUOUS_DATA_DETECTED'
  | 'READY_TO_PROVISION'
  | 'GENERATING'
  | 'ENCRYPTING'
  | 'PERSISTING'
  | 'AWAITING_CONTROL_PROOF'
  | 'CONTROL_PROVEN'
  | 'REFUSED'
  | 'QUARANTINED';

interface LinkedWalletView {
  address: string;
  provider: string;
  controlStatus: string;
  authorityRole: string;
  maySignPrincipalMandate: boolean;
}

interface StatusView {
  capability: string;
  address: string | null;
  detail: string;
  remediation: string | null;
  controlProven: boolean;
  supersededPlaceholder: Record<string, unknown> | null;
  linkedExternalWallets: LinkedWalletView[];
}

/**
 * Capability → surface state.
 *
 * `UNAVAILABLE` maps to REFUSED and NOT to NOT_CONFIGURED, deliberately: "we
 * could not check" is not "you have none", and offering provisioning on an
 * unknown answer invites a second wallet for a persona that already has one.
 * The refusal text says so and offers a retry rather than a remedy.
 */
export function surfaceStateFor(status: StatusView | null): PrincipalProvisioningState {
  if (!status) return 'REFUSED';
  switch (status.capability) {
    case 'SIGNER_CONFIGURED':
      return status.controlProven ? 'CONTROL_PROVEN' : 'AWAITING_CONTROL_PROOF';
    case 'ABSENT':
      return 'NOT_CONFIGURED';
    case 'AMBIGUOUS':
      return 'AMBIGUOUS_DATA_DETECTED';
    case 'ADDRESS_ONLY':
    case 'EXTERNAL_UNPROVEN':
    case 'EXTERNAL_PROVEN':
    case 'PRESENT_BUT_UNBOUND':
      return 'READY_TO_PROVISION';
    case 'LEGACY_EVIDENCE_ONLY':
    case 'COMPROMISED':
      return 'QUARANTINED';
    default:
      return 'REFUSED';
  }
}

const PHASE_STATE: Record<ProvisioningPhase, PrincipalProvisioningState> = {
  GENERATING: 'GENERATING',
  ENCRYPTING: 'ENCRYPTING',
  PERSISTING: 'PERSISTING',
  AWAITING_CONTROL_PROOF: 'AWAITING_CONTROL_PROOF',
};

const PHASE_LABEL: Record<ProvisioningPhase, string> = {
  GENERATING: 'Generating a key pair in this browser…',
  ENCRYPTING: 'Encrypting the private key with your wallet password…',
  PERSISTING: 'Storing the ciphertext envelope and its address…',
  AWAITING_CONTROL_PROOF: 'Signing a fresh nonce locally and verifying the recovery…',
};

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">{children}</section>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-[11px] text-white/40">{label}</span>
    <span className="text-right text-[11px] text-white/80">{value}</span>
  </div>
);

export interface PrincipalWalletProvisioningPanelProps {
  personaId: string;
  /** Serializable identifier of whoever asked for this surface. Never a callback. */
  returnTarget?: string | null;
  /**
   * Where the Journey left off, if a Journey sent the operator here. Present
   * only when a consequential act was blocked — the wallet never invents a
   * destination it was not given.
   */
  returnTo?: { label: string; onReturn: () => void } | null;
}

export const PrincipalWalletProvisioningPanel: React.FC<PrincipalWalletProvisioningPanelProps> = ({
  personaId,
  returnTarget,
  returnTo,
}) => {
  const [status, setStatus] = useState<StatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadRefusal, setLoadRefusal] = useState<{ refusal: string; detail: string } | null>(null);
  const [phase, setPhase] = useState<ProvisioningPhase | null>(null);
  const [running, setRunning] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [outcomeRefusal, setOutcomeRefusal] = useState<{ refusal: string; detail: string } | null>(null);

  const load = useCallback(async (): Promise<StatusView | null> => {
    setLoading(true);
    setLoadRefusal(null);
    try {
      const res = await personaFetch('/api/wallet/principal/status', { cache: 'no-store', personaIdHint: personaId });
      const j = (await res.json()) as Partial<StatusView> & { ok?: boolean; refusal?: string; detail?: string };
      if (!res.ok || !j.ok) {
        // A status code is never an explanation — carry the server's reason.
        setLoadRefusal({
          refusal: j.refusal ?? `HTTP_${res.status}`,
          detail: j.detail ?? `The wallet status could not be read (HTTP ${res.status}).`,
        });
        setStatus(null);
      } else {
        const next: StatusView = {
          capability: String(j.capability),
          address: (j.address as string | null) ?? null,
          detail: String(j.detail ?? ''),
          remediation: (j.remediation as string | null) ?? null,
          controlProven: Boolean(j.controlProven),
          supersededPlaceholder: (j.supersededPlaceholder as Record<string, unknown> | null) ?? null,
          linkedExternalWallets: (j.linkedExternalWallets as LinkedWalletView[]) ?? [],
        };
        setStatus(next);
        return next;
      }
    } catch (e) {
      setLoadRefusal({ refusal: 'UNREACHABLE', detail: `The wallet status could not be read (${(e as Error).message}).` });
      setStatus(null);
    } finally {
      setLoading(false);
    }
    return null;
  }, [personaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const baseState = useMemo(() => (loadRefusal ? 'REFUSED' : surfaceStateFor(status)), [status, loadRefusal]);
  // A running phase outranks the loaded state — but only while it is running.
  const state: PrincipalProvisioningState = phase ? PHASE_STATE[phase] : baseState;

  const needsAcknowledgement = baseState === 'AMBIGUOUS_DATA_DETECTED';
  const passwordsAgree = password.length > 0 && password === confirm;
  const canRun =
    !running &&
    passwordsAgree &&
    (!needsAcknowledgement || acknowledged) &&
    ['NOT_CONFIGURED', 'AMBIGUOUS_DATA_DETECTED', 'READY_TO_PROVISION'].includes(baseState);

  /**
   * Announce what happened, serializably.
   *
   * `CONTROL_PROVEN` is the ONLY outcome that lets the originating act resume
   * — the governing rule is that a provisioning write is not completion. A
   * configured-but-unproven wallet announces itself as exactly that, so
   * Register can re-render its prerequisite honestly instead of being told the
   * work is done.
   */
  const announce = useCallback(
    (outcome: 'CONTROL_PROVEN' | 'SIGNER_CONFIGURED_AWAITING_PROOF' | 'REFUSED', refusal?: string) => {
      announceWalletSurfaceCompletion({
        surface: 'PRINCIPAL_WALLET_PROVISIONING',
        outcome,
        ...(returnTarget ? { returnTarget } : {}),
        ...(refusal ? { refusal } : {}),
      });
    },
    [returnTarget],
  );

  const finish = useCallback(
    async (outcome: Awaited<ReturnType<typeof provisionPrincipalWallet>>) => {
      if (!outcome.ok) {
        setOutcomeRefusal({ refusal: outcome.refusal ?? 'REFUSED', detail: outcome.detail });
        announce(
          outcome.stage === 'SIGNER_CONFIGURED' ? 'SIGNER_CONFIGURED_AWAITING_PROOF' : 'REFUSED',
          outcome.refusal ?? undefined,
        );
      }
      setRunning(false);
      setPhase(null);
      // Clear the password from component state the moment the ceremony ends —
      // it was only ever needed locally, and a React state field outlives the
      // call that used it.
      setPassword('');
      setConfirm('');
      // Reread AUTHORITATIVELY before announcing success: the ceremony's own
      // return value is a report of what it did, and the status route is what
      // the rest of the platform will actually see. Announcing CONTROL_PROVEN
      // on the strength of the former would let a write that did not land read
      // as a completed one.
      const confirmed = await load();
      if (outcome.ok && confirmed?.capability === 'SIGNER_CONFIGURED' && confirmed.controlProven) {
        announce('CONTROL_PROVEN');
      } else if (outcome.ok) {
        setOutcomeRefusal({
          refusal: 'PROOF_NOT_CONFIRMED_BY_STATUS',
          detail:
            'The ceremony reported success but a fresh read of the wallet status does not show a proven ' +
            'principal wallet. Nothing was regenerated. Retry the control proof.',
        });
        announce('SIGNER_CONFIGURED_AWAITING_PROOF');
      }
    },
    [announce, load],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setOutcomeRefusal(null);
    await finish(
      await provisionPrincipalWallet({
        personaId,
        password,
        requestId: `prov_${personaId}_${Date.now()}`,
        onPhase: setPhase,
      }),
    );
  }, [personaId, password, finish]);

  /**
   * Prove the wallet that already exists. Creates nothing.
   *
   *   > "Never regenerate the wallet in this state."
   */
  const retryProof = useCallback(async () => {
    setRunning(true);
    setOutcomeRefusal(null);
    await finish(await proveExistingPrincipalWallet({ personaId, password, onPhase: setPhase }));
  }, [personaId, password, finish]);

  if (loading) {
    return (
      <Section>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Reading this persona&apos;s wallet state…
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-3" data-surface="PRINCIPAL_WALLET_PROVISIONING" data-state={state}>
      <Section>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-violet-300" aria-hidden="true" />
          <h3 className="text-sm font-medium text-white">Principal wallet</h3>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
          Your principal wallet is held under first-party custody: the key is generated and encrypted in this
          browser, and the platform stores only ciphertext. It is the wallet that signs constitutional authority —
          a connected external wallet never can.
        </p>
      </Section>

      {/* ── QUARANTINED ─────────────────────────────────────────────────── */}
      {state === 'QUARANTINED' && (
        <Section>
          <div className="flex items-center gap-2 text-amber-200">
            <Ban className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">Quarantined — cannot become a principal wallet</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{status?.detail}</p>
          {status?.remediation && <p className="mt-1.5 text-[11px] text-amber-200/70">{status.remediation}</p>}
        </Section>
      )}

      {/* ── REFUSED ─────────────────────────────────────────────────────── */}
      {state === 'REFUSED' && (
        <Section>
          <div className="flex items-center gap-2 text-rose-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">{loadRefusal?.refusal ?? status?.capability ?? 'Refused'}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
            {loadRefusal?.detail ?? status?.detail}
          </p>
          {/* "Could not check" is not "you have none" — the remedy is a retry,
              never a second wallet. */}
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-white/70 hover:bg-slate-900"
          >
            Check again
          </button>
        </Section>
      )}

      {/* ── The repair, shown explicitly before it is offered ────────────── */}
      {baseState === 'AMBIGUOUS_DATA_DETECTED' && !phase && (
        <Section>
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">Two addresses on file — neither can sign</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{status?.detail}</p>

          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-cyan-200">Preserved</div>
              <p className="mt-1 text-[11px] text-white/60">
                Your connected MetaMask address is recorded as a linked external wallet —
                <span className="text-white/80"> EXTERNAL_UNPROVEN</span>, an execution instrument. It keeps its
                relationship to this persona and may never sign a principal mandate.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-amber-200">Superseded</div>
              <p className="mt-1 text-[11px] text-white/60">
                The keyless placeholder address is marked
                <span className="text-white/80"> ADDRESS_ONLY / superseded / non-signing</span> and kept in audit
                history. It is never deleted and never reinstated.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-violet-200">Provisioned</div>
              <p className="mt-1 text-[11px] text-white/60">
                A new first-party principal wallet is created beside them, and becomes the principal signer only
                after its control is freshly proven.
              </p>
            </div>
          </div>

          <label className="mt-3 flex items-start gap-2 text-[11px] text-white/60">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read what happens to each address. Proceed with the repair for this persona only.
            </span>
          </label>
        </Section>
      )}

      {/* ── The ceremony form ───────────────────────────────────────────── */}
      {['NOT_CONFIGURED', 'AMBIGUOUS_DATA_DETECTED', 'READY_TO_PROVISION'].includes(baseState) && !phase && (
        <Section>
          <div className="text-xs font-medium text-white/80">
            {baseState === 'NOT_CONFIGURED' ? 'Create your principal wallet' : 'Provision a new principal wallet'}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            Your wallet password encrypts the key in this browser. It is never sent to the server, and neither is
            the key it protects. If you lose it, the wallet cannot be recovered.
          </p>
          <div className="mt-3 space-y-2">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet password"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-white/30"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm wallet password"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-white/30"
            />
            {confirm.length > 0 && !passwordsAgree && (
              <p className="text-[11px] text-rose-300">The two passwords do not match.</p>
            )}
          </div>
          <button
            type="button"
            disabled={!canRun}
            onClick={() => void run()}
            className="mt-3 w-full rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 px-3 py-2 text-xs text-white transition-colors hover:from-violet-500/30 hover:to-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create and prove principal wallet
          </button>
        </Section>
      )}

      {/* ── In flight ───────────────────────────────────────────────────── */}
      {phase && (
        <Section>
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" aria-hidden="true" />
            {PHASE_LABEL[phase]}
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            Provisioning is not finished when the envelope is stored. It completes when a signature recovers to the
            new address.
          </p>
        </Section>
      )}

      {/* ── Configured but unproven — the state that looks finished ────────
          This is the state the browser run landed in. The recovery offered
          here is RETRY, never CREATE: a second keypair would abandon a key
          the operator may already hold. */}
      {state === 'AWAITING_CONTROL_PROOF' && !phase && (
        <Section>
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">Principal wallet configured · Control proof incomplete</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
            An encrypted envelope and its address are stored for this persona, which establishes SIGNER_CONFIGURED
            and nothing more. Until a fresh nonce is signed and recovers to this address, nothing has demonstrated
            that a usable key sits behind it.
          </p>
          <div className="mt-2 break-all font-mono text-[10px] text-white/40">{status?.address}</div>
          <p className="mt-2.5 text-[11px] text-white/45">
            Your wallet is intact. Enter the password you set when it was created — this proves the existing
            wallet and creates nothing.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Wallet password"
            className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-white/30"
          />
          <button
            type="button"
            disabled={running || password.length === 0}
            onClick={() => void retryProof()}
            className="mt-2 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Retry control proof
          </button>
        </Section>
      )}

      {/* ── Done ────────────────────────────────────────────────────────── */}
      {state === 'CONTROL_PROVEN' && (
        <Section>
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">Principal wallet ready</span>
          </div>
          <div className="mt-2 divide-y divide-slate-800">
            <Row label="Address" value={<span className="break-all font-mono text-[10px]">{status?.address}</span>} />
            <Row label="Custody" value="First-party — encrypted in your browser" />
            <Row label="Control" value={<span className="text-emerald-300">Proven</span>} />
            <Row
              label="Linked external wallet"
              value={
                status && status.linkedExternalWallets.length > 0 ? (
                  <span>
                    {status.linkedExternalWallets[0].provider} ·{' '}
                    {status.linkedExternalWallets[0].controlStatus === 'proven' ? 'proven' : 'unproven'} · never signs
                    a principal mandate
                  </span>
                ) : (
                  'None linked'
                )
              }
            />
          </div>
          {status?.supersededPlaceholder && (
            <p className="mt-2 text-[10px] text-white/35">
              A keyless placeholder address was superseded and retained in audit history as non-signing.
            </p>
          )}
          {returnTo && (
            <button
              type="button"
              onClick={returnTo.onReturn}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 px-3 py-2 text-xs text-white transition-colors hover:from-violet-500/30 hover:to-cyan-500/30"
            >
              {returnTo.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </Section>
      )}

      {/* ── A refusal from the ceremony itself ──────────────────────────── */}
      {outcomeRefusal && (
        <Section>
          <div className="flex items-center gap-2 text-rose-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">{outcomeRefusal.refusal}</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{outcomeRefusal.detail}</p>
        </Section>
      )}
    </div>
  );
};

export default PrincipalWalletProvisioningPanel;
