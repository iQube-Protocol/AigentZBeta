"use client";

import type { RuntimeTrustSignal, SelectorOption } from "@metame/aa-client";

type RuntimeHeaderProps = {
  trustSignals: RuntimeTrustSignal[];
  aigentOptions: SelectorOption[];
  llmOptions: SelectorOption[];
  selectedAigentId: string;
  selectedLlmId: string;
  onAigentChange: (nextId: string) => void;
  onLlmChange: (nextId: string) => void;
  busy: boolean;
};

function trustStateClass(state: RuntimeTrustSignal["state"]): string {
  switch (state) {
    case "ok":
      return "trust-ok";
    case "warn":
      return "trust-warn";
    default:
      return "trust-fail";
  }
}

export function RuntimeHeader({
  trustSignals,
  aigentOptions,
  llmOptions,
  selectedAigentId,
  selectedLlmId,
  onAigentChange,
  onLlmChange,
  busy,
}: RuntimeHeaderProps) {
  return (
    <header className="runtime-header">
      <div className="runtime-header-top">
        <div className="trust-strip" aria-label="Trust indicators">
          {trustSignals.map((signal) => (
            <span key={signal.key} className="shell-chip">
              <span className={`trust-dot ${trustStateClass(signal.state)}`} aria-hidden="true" />
              {signal.label}
            </span>
          ))}
        </div>

        <details className="trust-mobile">
          <summary className="shell-chip">Trust</summary>
          <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.35rem" }}>
            {trustSignals.map((signal) => (
              <span key={signal.key} className="shell-chip">
                <span className={`trust-dot ${trustStateClass(signal.state)}`} aria-hidden="true" />
                {signal.label}
              </span>
            ))}
          </div>
        </details>
      </div>

      <div className="runtime-selectors">
        <label>
          Aigent
          <select
            aria-label="Aigent selector"
            value={selectedAigentId}
            onChange={(event) => onAigentChange(event.target.value)}
            disabled={busy}
          >
            {aigentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          LLM
          <select
            aria-label="LLM selector"
            value={selectedLlmId}
            onChange={(event) => onLlmChange(event.target.value)}
            disabled={busy}
          >
            {llmOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
