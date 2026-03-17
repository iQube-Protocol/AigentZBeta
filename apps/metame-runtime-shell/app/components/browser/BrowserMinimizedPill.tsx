"use client";

type BrowserMinimizedPillProps = {
  title: string;
  onRestore: () => void;
};

export function BrowserMinimizedPill({ title, onRestore }: BrowserMinimizedPillProps) {
  return (
    <button type="button" className="browser-minimized-pill" onClick={onRestore}>
      {title}
    </button>
  );
}
