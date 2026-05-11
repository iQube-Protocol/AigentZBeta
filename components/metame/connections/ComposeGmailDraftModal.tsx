"use client";

/**
 * ComposeGmailDraftModal — Aigent Me Phase 6.b Part 2.5b.
 *
 * A small overlay that lets the user originate a Gmail draft from the
 * Aigent Me welcome surface (no curl, no specialist round-trip required).
 *
 * Flow:
 *   To / Subject / Body fields → POST /api/assistant/create-artifact with
 *   destination='gmail' → the route eager-creates a real Gmail draft via
 *   the gmail.draft connector, returns an ArtifactCardData carrying
 *   actionConnectorId='google.gmail.send' so the welcome surface's
 *   SecondTierApprovalCard gates the actual send.
 *
 * Presentational + thin orchestration. Persists nothing locally; the
 * artifact returned by the API gets pushed into the welcome surface's
 * artifacts list by the parent.
 */

import React, { useState, useCallback } from "react";
import { Loader2, X, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Fires the create-artifact POST. Resolves with the new artifact when
   * the route returns ok; throws otherwise so the modal can render the
   * inline error without closing.
   */
  onCreate: (input: {
    to: string;
    subject: string;
    bodyText: string;
    cc?: string;
    bcc?: string;
  }) => Promise<void>;
  theme?: "light" | "dark";
}

export function ComposeGmailDraftModal({ open, onClose, onCreate, theme = "dark" }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === "dark";
  const overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4";
  const panelClass = isDark
    ? "bg-slate-900 border border-slate-700 text-slate-100"
    : "bg-white border border-slate-200 text-slate-900";
  const labelClass = isDark ? "text-slate-300" : "text-slate-700";
  const inputClass = isDark
    ? "bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400";
  const submitBtn = isDark
    ? "bg-violet-500 hover:bg-violet-400 text-white"
    : "bg-violet-600 hover:bg-violet-700 text-white";
  const ghostBtn = isDark
    ? "border border-slate-700 text-slate-300 hover:border-slate-500"
    : "border border-slate-300 text-slate-700 hover:border-slate-500";

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!to.trim() || !subject.trim() || !bodyText.trim()) {
      setError("To, Subject and Body are all required.");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        to: to.trim(),
        subject: subject.trim(),
        bodyText,
        ...(cc.trim() ? { cc: cc.trim() } : {}),
        ...(bcc.trim() ? { bcc: bcc.trim() } : {}),
      });
      // Reset on success so the modal is clean next time.
      setTo("");
      setSubject("");
      setBodyText("");
      setCc("");
      setBcc("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [to, subject, bodyText, cc, bcc, onCreate, onClose]);

  if (!open) return null;

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-gmail-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={`rounded-lg p-5 w-full max-w-lg shadow-xl ${panelClass}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-violet-400" />
            <h3 id="compose-gmail-heading" className="font-semibold">
              Compose Gmail draft
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded hover:bg-slate-800/40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className={`w-full px-3 py-2 rounded ${inputClass}`}
              disabled={submitting}
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Cc (optional)</span>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className={`w-full px-3 py-2 rounded ${inputClass}`}
                disabled={submitting}
              />
            </label>
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Bcc (optional)</span>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className={`w-full px-3 py-2 rounded ${inputClass}`}
                disabled={submitting}
              />
            </label>
          </div>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={`w-full px-3 py-2 rounded ${inputClass}`}
              disabled={submitting}
            />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Body</span>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={6}
              className={`w-full px-3 py-2 rounded font-sans ${inputClass}`}
              disabled={submitting}
            />
          </label>
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">
            {error}
          </div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          The draft is created in your Gmail account. Sending requires a second-tier approval.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Creating draft…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComposeGmailDraftModal;
