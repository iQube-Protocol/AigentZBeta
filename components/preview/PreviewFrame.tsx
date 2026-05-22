"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  DevicePreviewSwitcher,
  DeviceType,
  useDevicePreview,
  getDeviceWidth,
} from "@/components/preview/DevicePreviewSwitcher";

interface PreviewFrameProps {
  /** The content to preview (URL for iframe or React children) */
  src?: string;
  /** React children to render in the preview */
  children?: React.ReactNode;
  /** Initial device type */
  defaultDevice?: DeviceType;
  /** Container class name */
  className?: string;
  /** Whether to show the device switcher toolbar */
  showToolbar?: boolean;
  /** Custom toolbar position */
  toolbarPosition?: "top" | "bottom";
  /** Callback when device changes */
  onDeviceChange?: (device: DeviceType, width: number) => void;
  /** Remove chrome padding/background for full-bleed previews */
  chromeless?: boolean;
  /** Query param to sync device into iframe src */
  deviceQueryParam?: string;
  /** Fallback content if iframe fails to load */
  fallback?: React.ReactNode;
  /** Custom toolbar renderer */
  renderToolbar?: (device: DeviceType, onChange: (device: DeviceType) => void) => React.ReactNode;
}

/**
 * A complete preview frame with device switching capability.
 * Can render either an iframe (via src) or React children.
 */
export function PreviewFrame({
  src,
  children,
  defaultDevice = "desktop",
  className,
  showToolbar = true,
  toolbarPosition = "top",
  onDeviceChange,
  chromeless = false,
  deviceQueryParam = "device",
  fallback,
  renderToolbar,
}: PreviewFrameProps) {
  const { device, setDevice, width } = useDevicePreview(defaultDevice);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const paddingOffset = chromeless ? 0 : 32;
      const nextWidth = Math.max(0, containerRef.current.clientWidth - paddingOffset);
      setContainerWidth(nextWidth);
      if (device === "desktop") {
        setScale(1);
        return;
      }
      const newScale = width > 0 ? Math.min(1, nextWidth / width) : 1;
      setScale(newScale);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [width, chromeless, device]);

  const handleDeviceChange = (newDevice: DeviceType) => {
    setDevice(newDevice);
    onDeviceChange?.(newDevice, getDeviceWidth(newDevice));
  };

  const toolbar = showToolbar
    ? renderToolbar
      ? renderToolbar(device, handleDeviceChange)
      : (
        <div className="flex items-center justify-center py-2">
          <DevicePreviewSwitcher value={device} onChange={handleDeviceChange} />
        </div>
      )
    : null;

  const resolvedSrc = (() => {
    if (!src || typeof window === "undefined") return src;
    try {
      const url = new URL(src, window.location.origin);
      url.searchParams.set(deviceQueryParam, device);
      return url.pathname + url.search + url.hash;
    } catch {
      return src;
    }
  })();

  const targetWidth =
    device === "desktop" && containerWidth > 0 ? containerWidth : width;

  useEffect(() => {
    setIframeFailed(false);
    setIframeLoaded(false);
  }, [resolvedSrc, device]);

  useEffect(() => {
    if (!resolvedSrc || iframeFailed || iframeLoaded) return;
    const timer = window.setTimeout(() => {
      setIframeFailed(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [resolvedSrc, iframeFailed, iframeLoaded]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {toolbarPosition === "top" && toolbar}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex",
          chromeless ? "p-0 bg-transparent rounded-none overflow-hidden" : "bg-muted/30 rounded-lg p-4 overflow-auto",
          "items-start justify-center"
        )}
      >
        <div
          className={cn(
            "relative bg-background overflow-hidden transition-all duration-300 ease-out origin-top",
            chromeless ? "rounded-none shadow-none" : "rounded-lg shadow-lg"
          )}
          style={{
            width: `${targetWidth}px`,
            transform: device === "desktop" ? undefined : `scale(${scale})`,
            maxWidth: "100%",
            height: "100%",
            minHeight: "100%",
          }}
        >
          {resolvedSrc && !iframeFailed ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70 text-xs text-slate-300">
                  Loading preview...
                </div>
              )}
              <iframe
                src={resolvedSrc}
                className="w-full h-full min-h-[600px] border-0"
                title="Preview"
                allow="microphone; clipboard-read; clipboard-write"
                onLoad={() => setIframeLoaded(true)}
                onError={(e) => {
                  console.error("Preview iframe load error", e);
                  setIframeFailed(true);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full min-h-[600px] overflow-hidden">
              {fallback || children || (
                <div className="flex h-full w-full items-center justify-center bg-slate-950 text-sm text-slate-300">
                  Preview could not load.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {toolbarPosition === "bottom" && toolbar}
    </div>
  );
}
