"use client";

type BrowserLiveViewFrameProps = {
  title: string;
  src: string;
  onFocusChange: (focused: boolean) => void;
};

export function BrowserLiveViewFrame({ title, src, onFocusChange }: BrowserLiveViewFrameProps) {
  return (
    <iframe
      title={title}
      src={src}
      className="browser-live-frame"
      allow="clipboard-read; clipboard-write; fullscreen"
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
    />
  );
}
