"use client";

type BrowserLaunchEntryProps = {
  active: boolean;
  onOpen: () => void;
};

export function BrowserLaunchEntry({ active, onOpen }: BrowserLaunchEntryProps) {
  return (
    <button type="button" className="browser-launch-entry" onClick={onOpen}>
      {active ? "Resume Browser" : "Open Browser"}
    </button>
  );
}
