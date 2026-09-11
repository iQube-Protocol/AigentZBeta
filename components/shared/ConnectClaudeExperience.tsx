'use client';

/**
 * ConnectClaudeExperience — the shared "Connect Claude" content, factored
 * out of MyCanvasTab.tsx's `ConnectClaudeModal` (2026-09-11) so the
 * Constitutional Internet Bridge and KNYTs Bridge Choose surfaces can reuse
 * the exact same copy, steps and connected-state behavior instead of a
 * second implementation.
 *
 * Two presentations of the SAME body:
 *   - `variant="modal"` — MyCanvas's existing floating centered overlay
 *     (same grammar as RemixDialog/SocialSharingModal/InviteModal: fixed
 *     inset-0 backdrop, bordered card, header with a close X).
 *   - `variant="pane"` — mounted inline in a bridge's left pane (no overlay,
 *     no backdrop, no close button — the pane IS the content).
 *
 * COPY FIX (2026-09-11): the connector instructions now show the exact,
 * visible, copyable Name + URL — `PASTE_STEP` below — rather than only
 * telling the visitor to "paste the metaMe MCP URL below" without ever
 * displaying it. `ActivateClaudeChip` still owns the actual copy-to-
 * clipboard control and connected/not-connected state; this component owns
 * only the surrounding explanation and numbered steps.
 */

import { Bot, X } from 'lucide-react';
import { ActivateClaudeChip, type ActivateClaudeChipProps } from '@/components/shared/ActivateClaudeChip';

const CONNECTOR_NAME = 'metaMe Threshold';
const CONNECTOR_URL = 'https://dev-beta.aigentz.me/api/threshold/mcp';

type ChipProps = Pick<ActivateClaudeChipProps, 'checkConnected' | 'recordConnected' | 'context'>;

function ConnectClaudeBody({ checkConnected, recordConnected, context }: ChipProps) {
  return (
    <>
      <p className="mb-3 text-xs font-medium text-amber-200">
        Connection grants context/read-query access. It is not delegation — Claude cannot act, transact, or represent you.
      </p>
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-xs text-slate-300">
        <li>In Claude, open <span className="text-slate-100">Settings</span></li>
        <li>Go to <span className="text-slate-100">Add / Manage Connections</span></li>
        <li>Choose <span className="text-slate-100">Add custom MCP</span></li>
        <li>
          <span className="text-slate-100">Add custom connector</span>
          <div className="mt-1.5 select-all rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
            Name: {CONNECTOR_NAME}
            <br />
            URL: {CONNECTOR_URL}
          </div>
        </li>
        <li>Sign in</li>
        <li>Authorize the connection</li>
        <li>Return to this Bridge</li>
      </ol>
      <ActivateClaudeChip checkConnected={checkConnected} recordConnected={recordConnected} context={context} />
    </>
  );
}

interface ConnectClaudeExperienceProps extends ChipProps {
  variant: 'modal' | 'pane';
  /** Required for variant="modal" — the modal's close (X + backdrop click). Ignored for "pane". */
  onClose?: () => void;
}

export function ConnectClaudeExperience({ variant, onClose, ...chipProps }: ConnectClaudeExperienceProps) {
  if (variant === 'pane') {
    return (
      <div className="h-full w-full overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Bot className="h-4 w-4 text-amber-300" /> Connect Claude
        </div>
        <ConnectClaudeBody {...chipProps} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-amber-300" /> Connect Claude
          </span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ConnectClaudeBody {...chipProps} />
        </div>
      </div>
    </div>
  );
}

export default ConnectClaudeExperience;
