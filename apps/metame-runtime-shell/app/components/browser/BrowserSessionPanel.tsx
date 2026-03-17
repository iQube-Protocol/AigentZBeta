"use client";

import type { BrowserBadgeState, BrowserErrorPayload, BrowserMountPayload, BrowserStepState, BrowserSurfaceState } from "@metame/browser-contracts";

type BrowserSessionPanelProps = {
  mountPayload: BrowserMountPayload;
  surfaceState: BrowserSurfaceState;
  badges?: BrowserBadgeState;
  step?: BrowserStepState;
  error?: BrowserErrorPayload | null;
  actionStatus?: {
    tone: "idle" | "running" | "success" | "error";
    message: string;
  } | null;
  historyCount: number;
  artifactCount: number;
  receiptCount: number;
  drawerOpen: boolean;
  controlsBusy?: boolean;
  onToggleDrawer: () => void;
  onExtract: () => void;
  onSave: () => void;
  onTakeover: () => void;
  onResume: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
};

export function BrowserSessionPanel({
  mountPayload,
  surfaceState,
  badges,
  step,
  error,
  actionStatus,
  historyCount,
  artifactCount,
  receiptCount,
  drawerOpen,
  controlsBusy = false,
  onToggleDrawer,
  onExtract,
  onSave,
  onTakeover,
  onResume,
  onMinimize,
  onExpand,
  onClose,
}: BrowserSessionPanelProps) {
  return (
    <aside className="browser-session-panel" aria-label="Browser session details">
      <div className="browser-session-panel-top">
        <div>
          <strong>{mountPayload.chrome.title}</strong>
          <div className="browser-session-panel-subtitle">
            {badges?.domain || mountPayload.chrome.domain || "Runtime controlled"}
          </div>
        </div>
        <div className="browser-session-panel-actions">
          <button type="button" onClick={onToggleDrawer}>
            {drawerOpen ? "Hide Drawer" : "Show Drawer"}
          </button>
          <button type="button" onClick={onExtract} disabled={controlsBusy}>
            Extract
          </button>
          <button type="button" onClick={onSave} disabled={controlsBusy}>
            Save
          </button>
          <button type="button" onClick={surfaceState.takeoverActive ? onResume : onTakeover}>
            {surfaceState.takeoverActive ? "Resume Agent" : "Take Over"}
          </button>
          <button type="button" onClick={surfaceState.shellSurfaceState === "minimized" ? onExpand : onMinimize}>
            {surfaceState.shellSurfaceState === "minimized" ? "Expand" : "Minimize"}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <dl className="browser-session-grid">
        <div>
          <dt>Provider</dt>
          <dd>{mountPayload.provider}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{mountPayload.chrome.executionMode}</dd>
        </div>
        <div>
          <dt>Privacy</dt>
          <dd>{mountPayload.chrome.privacyMode}</dd>
        </div>
        <div>
          <dt>Trust</dt>
          <dd>{mountPayload.chrome.trustMode}</dd>
        </div>
        <div>
          <dt>Surface</dt>
          <dd>{surfaceState.shellSurfaceState}</dd>
        </div>
        <div>
          <dt>Takeover</dt>
          <dd>{surfaceState.takeoverActive ? "active" : "agent"}</dd>
        </div>
        <div>
          <dt>History</dt>
          <dd>{historyCount}</dd>
        </div>
        <div>
          <dt>Artifacts</dt>
          <dd>{artifactCount}</dd>
        </div>
        <div>
          <dt>Receipts</dt>
          <dd>{receiptCount}</dd>
        </div>
      </dl>

      {step ? (
        <div className="browser-session-step">
          <strong>{step.label}</strong>
          <span>{step.message || step.status}</span>
        </div>
      ) : null}

      {actionStatus ? (
        <div className={`browser-session-status browser-session-status-${actionStatus.tone}`}>
          {actionStatus.message}
        </div>
      ) : null}

      {error ? <div className="browser-session-error">{error.message}</div> : null}
    </aside>
  );
}
