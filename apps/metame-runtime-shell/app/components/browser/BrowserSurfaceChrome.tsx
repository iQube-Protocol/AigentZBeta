"use client";

import type { BrowserBadgeState, BrowserMountPayload, BrowserSurfaceState } from "@metame/browser-contracts";

type BrowserSurfaceChromeProps = {
  mountPayload: BrowserMountPayload;
  surfaceState: BrowserSurfaceState;
  badges?: BrowserBadgeState;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
};

export function BrowserSurfaceChrome({
  mountPayload,
  surfaceState,
  badges,
  onClose,
  onMinimize,
  onExpand,
}: BrowserSurfaceChromeProps) {
  const minimized = surfaceState.shellSurfaceState === "minimized";

  return (
    <div className="browser-surface-chrome">
      <div className="browser-surface-meta">
        <div>
          <strong>{mountPayload.chrome.title}</strong>
          <div className="browser-surface-domain">{badges?.domain || mountPayload.chrome.domain || "Runtime controlled"}</div>
        </div>
        <div className="browser-surface-actions">
          <button type="button" onClick={minimized ? onExpand : onMinimize}>
            {minimized ? "Expand" : "Minimize"}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
