"use client";

import React from "react";
import { Globe, Lock } from "lucide-react";

/**
 * Participant private/public publication toggle for the Experiment Lab runners.
 *
 * Admins publish straight to the canon, so this control is only rendered for
 * reviewers/participants (`canRequestPublish`). A participant saves results
 * PRIVATELY by default; ticking this asks a steward to approve public
 * publication before the result joins the published canon — mirroring the
 * myCanvas publish-approval pattern. The runner passes the checked value as
 * `requestPublish` in the /api/experiments/results body.
 */
export function RequestPublishControl({
  requestPublish,
  onChange,
  disabled,
}: {
  requestPublish: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-[11px] text-slate-300">
      <input
        type="checkbox"
        checked={requestPublish}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-emerald-500"
      />
      <span className="flex items-center gap-1.5">
        {requestPublish ? (
          <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        ) : (
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <span>
          {requestPublish
            ? "Request public publication — a steward reviews before it joins the published canon."
            : "Saved privately to your record. Tick to request public publication (steward-approved)."}
        </span>
      </span>
    </label>
  );
}

export default RequestPublishControl;
