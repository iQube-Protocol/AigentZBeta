"use client";

import type { RefObject } from "react";

type RuntimeFrameProps = {
  iframeRef: RefObject<HTMLIFrameElement>;
  src: string;
  runtimeReady: boolean;
  onLoad: () => void;
};

export function RuntimeFrame({ iframeRef, src, runtimeReady, onLoad }: RuntimeFrameProps) {
  return (
    <div className="runtime-frame-wrap">
      {!runtimeReady ? <div className="runtime-loading">Loading runtime iframe…</div> : null}
      <iframe
        ref={iframeRef}
        title="metaMe Runtime"
        src={src}
        className="runtime-frame"
        onLoad={onLoad}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
