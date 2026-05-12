"use client";

/**
 * ComposeMarketaEmailModal — Aigent Me Phase 6.b Part 3.
 *
 * Same chief-of-staff pattern as the Gmail compose modal but the drafter
 * is Marketa-tuned (campaign / partner-outreach voice) and the artifact
 * sends via Mailjet rather than Gmail. Approval is required on send —
 * SecondTierApprovalCard fires automatically through the existing
 * /api/connectors/execute flow.
 */

import React, { useState, useCallback } from "react";
import { Loader2, X, Send, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    to: string;
    subject: string;
    bodyText: string;
    cc?: string;
    bcc?: string;
    fromName?: string;
  }) => Promise<void>;
  onDraftWithAigentMe: (prompt: string) => Promise<{
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    bodyText: string;
    rationale: string;
    source: 'llm' | 'template';
  }>;
  theme?: "light" | "dark";
}

export function ComposeMarketaEmailModal({ open, onClose, onCreate, onDraftWithAigentMe, theme = "dark" }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [fromName, setFromName] = useState("");
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

  const handleDraft = useCallback(async () => {
    setError(null);
    if (!aiPrompt.trim()) {
      setError('Tell aigentMe what the outreach is for.');
      return;
    }
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(aiPrompt.trim());
      setTo(draft.to ?? "");
      setCc(draft.cc ?? "");
      setBcc(draft.bcc ?? "");
      setSubject(draft.subject ?? "");
      setBodyText(draft.bodyText ?? "");
      setAiRationale(draft.rationale ?? null);
      setAiSource(draft.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiDrafting(false);
    }
  }, [aiPrompt, onDraftWithAigentMe]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!to.trim() || !subject.trim() || !bodyText.trim()) {
      setError('To, Subject and Body are all required.');
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
        ...(fromName.trim() ? { fromName: fromName.trim() } : {}),
      });
      setAiPrompt(""); setAiRationale(null); setAiSource(null);
      setTo(""); setSubject(""); setBodyText(""); setCc(""); setBcc(""); setFromName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [to, subject, bodyText, cc, bcc, fromName, onCreate, onClose]);

  if (!open) return null;

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <form onSubmit={handleSubmit} className={`rounded-lg p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl ${panelClass}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold">Compose Marketa email</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`mb-3 p-3 rounded border ${isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'}`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the outreach for? <span className="opacity-60">(Marketa, via aigentMe, will draft it)</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. invite alice@example.com to partner on the Q1 metaMe activation; tone: warm, value-led"
                className={`flex-1 px-3 py-2 rounded ${inputClass}`}
                disabled={aiDrafting || submitting}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleDraft(); } }}
              />
              <button
                type="button"
                onClick={handleDraft}
                disabled={aiDrafting || submitting || !aiPrompt.trim()}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}
              >
                {aiDrafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiDrafting ? 'Drafting…' : 'Draft for me'}
              </button>
            </div>
          </label>
          {aiRationale && (
            <p className={`text-[11px] mt-2 ${labelClass}`}>
              <span className="font-medium">Marketa:</span> {aiRationale}
              {aiSource === 'template' && <span className="opacity-60"> (template fallback)</span>}
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>To</span>
            <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Cc (optional)</span>
              <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Bcc (optional)</span>
              <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
          </div>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Body</span>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={7} className={`w-full px-3 py-2 rounded font-sans ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>From name override (optional)</span>
            <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="defaults to MAILJET_FROM_NAME" className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">{error}</div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          The email is queued as a draft artifact. Sending via Mailjet requires a second-tier approval.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={submitting} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}>Cancel</button>
          <button type="submit" disabled={submitting} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Drafting…' : 'Draft email'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComposeMarketaEmailModal;
