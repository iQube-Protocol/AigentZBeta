"use client";

/**
 * LaunchSpecForm — item 4 of the Bankr atomic-surface set. An actual
 * operator FORM: every field starts empty; nothing here pre-fills or
 * invents a token name, ticker, description, utility claim, URL, fee
 * recipient, paired asset or vesting choice (Phase 5's own hard constraint,
 * restated in the manifest's `boundaries`). Submitting calls
 * `prepareLaunch` on the controller hook, unchanged — this component holds
 * only the draft form state, never the launch itself.
 */

import { useState } from "react";
import type { LaunchSpecInput } from "@/services/factor/useBankrTokenLaunch";
import { BankrSection, BankrActionButton, BankrErrorNote } from "./bankrSurfaceKit";

const EMPTY_FORM = {
  chain: "",
  tokenName: "",
  tokenSymbol: "",
  description: "",
  imageUrl: "",
  metadataUrl: "",
  websiteUrl: "",
  feeRecipient: "",
  pairedAsset: "",
};

interface Props {
  onSubmit: (spec: LaunchSpecInput) => Promise<boolean> | boolean;
  busy: boolean;
  error: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
}

function inputClass() {
  return "rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none";
}

export function LaunchSpecForm({ onSubmit, busy, error, disabled, disabledReason }: Props) {
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const canSubmit = form.chain.trim() && form.tokenName.trim() && form.tokenSymbol.trim();

  return (
    <BankrSection title="Launch-spec proposal">
      <p className="text-xs text-slate-500">
        Every field below is an explicit operator decision — nothing is pre-filled or suggested by Factor. Chain, token name and token symbol are
        required to prepare a proposal.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Chain
          <input value={form.chain} onChange={(e) => set("chain", e.target.value)} placeholder="e.g. base" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Token name
          <input value={form.tokenName} onChange={(e) => set("tokenName", e.target.value)} placeholder="e.g. Example Token" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Token symbol
          <input value={form.tokenSymbol} onChange={(e) => set("tokenSymbol", e.target.value)} placeholder="e.g. EXTK" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Paired asset
          <input value={form.pairedAsset} onChange={(e) => set("pairedAsset", e.target.value)} placeholder="e.g. WETH" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300 sm:col-span-2">
          Description
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="What is this token for?" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Image URL
          <input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Metadata URL
          <input value={form.metadataUrl} onChange={(e) => set("metadataUrl", e.target.value)} placeholder="https://…" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Website URL
          <input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://…" className={inputClass()} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Fee recipient
          <input value={form.feeRecipient} onChange={(e) => set("feeRecipient", e.target.value)} placeholder="0x… or wallet ref" className={inputClass()} />
        </label>
      </div>
      {disabled && disabledReason && <p className="text-xs text-amber-300">{disabledReason}</p>}
      <BankrActionButton
        label="Prepare launch proposal"
        tone="primary"
        busy={busy}
        disabled={disabled || !canSubmit}
        onClick={() =>
          void onSubmit({
            chain: form.chain.trim(),
            tokenName: form.tokenName.trim(),
            tokenSymbol: form.tokenSymbol.trim(),
            description: form.description.trim() || null,
            imageUrl: form.imageUrl.trim() || null,
            metadataUrl: form.metadataUrl.trim() || null,
            websiteUrl: form.websiteUrl.trim() || null,
            feeRecipient: form.feeRecipient.trim() || null,
            pairedAsset: form.pairedAsset.trim() || null,
          })
        }
      />
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
