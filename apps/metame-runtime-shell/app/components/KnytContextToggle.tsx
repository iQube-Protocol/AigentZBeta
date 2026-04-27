"use client";

type KnytContextToggleProps = {
  context: "metame" | "knyt";
  onToggle: (next: "metame" | "knyt") => void;
  disabled?: boolean;
};

export function KnytContextToggle({ context, onToggle, disabled = false }: KnytContextToggleProps) {
  const isKnyt = context === "knyt";
  return (
    <button
      type="button"
      onClick={() => onToggle(isKnyt ? "metame" : "knyt")}
      disabled={disabled}
      aria-pressed={isKnyt}
      className={`context-toggle${isKnyt ? " context-toggle--active" : ""}`}
      title={isKnyt ? "Switch to metaMe" : "Switch to KNYT"}
    >
      <span className="context-toggle-label">{isKnyt ? "KNYT" : "metaMe"}</span>
      <span className="context-toggle-pip" aria-hidden="true" />
    </button>
  );
}
