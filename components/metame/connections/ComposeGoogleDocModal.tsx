"use client";

/**
 * ComposeGoogleDocModal — Aigent Me Phase 6.b Part 2.5c.
 *
 * Same chief-of-staff pattern: drafter strip on top, editable fields
 * below. POSTs /api/assistant/create-artifact with destination='drive'
 * + artifactType='google-doc'. Doc is created privately; if the drafter
 * surfaced a share suggestion, the artifact card carries a Share button
 * gated by the second-tier ApprovalCard.
 */

import React, { useState, useCallback } from "react";
import { Loader2, X, FileText, Sparkles } from "lucide-react";

interface ShareSuggestion {
  email: string;
  role: 'reader' | 'commenter' | 'writer';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    bodyText: string;
    shareSuggestions: ShareSuggestion[];
  }) => Promise<void>;
  onDraftWithAigentMe: (prompt: string) => Promise<{
    title: string;
    bodyText: string;
    shareSuggestions: ShareSuggestion[];
    rationale: string;
    source: 'llm' | 'template';
  }>;
  theme?: "light" | "dark";
}

export function ComposeGoogleDocModal({ open, onClose, onCreate, onDraftWithAigentMe, theme = "dark" }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<'reader' | 'commenter' | 'writer'>('commenter');
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
      setError('Tell Aigent Me what the doc is for.');
      return;
    }
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(aiPrompt.trim());
      setTitle(draft.title ?? "");
      setBodyText(draft.bodyText ?? "");
      const firstShare = (draft.shareSuggestions ?? [])[0];
      if (firstShare) {
        setShareEmail(firstShare.email);
        setShareRole(firstShare.role);
      } else {
        setShareEmail("");
      }
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
    if (!title.trim() || !bodyText.trim()) {
      setError("Title and body are required.");
      return;
    }
    const shareSuggestions: ShareSuggestion[] =
      shareEmail.trim() && /@/.test(shareEmail.trim())
        ? [{ email: shareEmail.trim(), role: shareRole }]
        : [];
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), bodyText, shareSuggestions });
      setAiPrompt(""); setAiRationale(null); setAiSource(null);
      setTitle(""); setBodyText(""); setShareEmail(""); setShareRole('commenter');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [title, bodyText, shareEmail, shareRole, onCreate, onClose]);

  if (!open) return null;

  return (
    <div className={overlayClass} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <form onSubmit={handleSubmit} className={`rounded-lg p-5 w-full max-w-lg shadow-xl ${panelClass}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold">Compose Google Doc</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`mb-3 p-3 rounded border ${isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'}`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the doc for? <span className="opacity-60">(Aigent Me will draft it)</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. a one-page brief on the metaMe Q1 alpha for the partner team, share with alice@example.com as commenter"
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
              <span className="font-medium">Aigent Me:</span> {aiRationale}
              {aiSource === 'template' && <span className="opacity-60"> (template fallback)</span>}
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Body</span>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={8} className={`w-full px-3 py-2 rounded font-sans ${inputClass}`} disabled={submitting} />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block col-span-2">
              <span className={`block text-xs mb-1 ${labelClass}`}>Share with (optional)</span>
              <input type="text" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="alice@example.com" className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
            </label>
            <label className="block">
              <span className={`block text-xs mb-1 ${labelClass}`}>Role</span>
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'reader' | 'commenter' | 'writer')}
                className={`w-full px-3 py-2 rounded ${inputClass}`}
                disabled={submitting}
              >
                <option value="reader">Reader</option>
                <option value="commenter">Commenter</option>
                <option value="writer">Writer</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">{error}</div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          The doc is created privately in your Drive. If you add a recipient, sharing happens only after a second-tier approval.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={submitting} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}>Cancel</button>
          <button type="submit" disabled={submitting} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Creating…' : 'Create doc'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComposeGoogleDocModal;
