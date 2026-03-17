"use client";

import { useEffect, useRef } from "react";
import type { BrowserBadgeState, BrowserErrorPayload, BrowserMountPayload, BrowserStepState, BrowserSurfaceState } from "@metame/browser-contracts";
import { BrowserLiveViewFrame } from "./BrowserLiveViewFrame";
import { BrowserMinimizedPill } from "./BrowserMinimizedPill";
import { BrowserStatusRail } from "./BrowserStatusRail";
import { BrowserSurfaceChrome } from "./BrowserSurfaceChrome";

type BrowserSurfaceHostProps = {
  mountPayload: BrowserMountPayload;
  surfaceState: BrowserSurfaceState;
  badges?: BrowserBadgeState;
  step?: BrowserStepState;
  error?: BrowserErrorPayload | null;
  onTakeover: () => void;
  onResume: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onFocusChanged: (focused: boolean) => void;
  onBoundsChanged: (bounds: BrowserSurfaceState["bounds"]) => void;
};

export function BrowserSurfaceHost({
  mountPayload,
  surfaceState,
  badges,
  step,
  error,
  onTakeover,
  onResume,
  onClose,
  onMinimize,
  onExpand,
  onFocusChanged,
  onBoundsChanged,
}: BrowserSurfaceHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;

    let timeoutId: number | null = null;
    const emitBounds = () => {
      const rect = element.getBoundingClientRect();
      onBoundsChanged({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    const schedule = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(emitBounds, 120);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener("resize", schedule);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [onBoundsChanged]);

  if (!surfaceState.visible && surfaceState.shellSurfaceState !== "minimized") {
    return null;
  }

  if (surfaceState.shellSurfaceState === "minimized") {
    return <BrowserMinimizedPill title={mountPayload.chrome.title} onRestore={onExpand} />;
  }

  return (
    <div ref={hostRef} className="browser-surface-host">
      <BrowserSurfaceChrome
        mountPayload={mountPayload}
        surfaceState={surfaceState}
        badges={badges}
        onTakeover={onTakeover}
        onResume={onResume}
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
      />
      <BrowserStatusRail badges={badges} step={step} />
      {surfaceState.takeoverActive ? <div className="browser-takeover-banner">Human takeover active</div> : null}
      {error ? <div className="browser-error-banner">{error.message}</div> : null}
      <BrowserLiveViewFrame title={mountPayload.chrome.title} src={mountPayload.liveView.url} onFocusChange={onFocusChanged} />
    </div>
  );
}
