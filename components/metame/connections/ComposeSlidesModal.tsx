"use client";

/**
 * ComposeSlidesModal — aigentMe Phase 6.b Part 2.5c.
 *
 * Drafter strip + form. POSTs /api/assistant/create-artifact with
 * destination='drive' + artifactType='slide-outline'. Deck is created
 * privately via google.slides.create — no second-tier needed.
 */

import React, { useState, useCallback } from "react";
import { Loader2, X, Presentation, Sparkles } from "lucide-react";

interface SlideSection {
  title: string;
  bullets: string[];
  diagramConcept?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    outline: string[];
    sections?: SlideSection[];
  }) => Promise<void>;
  onDraftWithAigentMe: (prompt: string) => Promise<{
    title: string;
    outline: string[];
    sections: SlideSection[];
    rationale: string;
    source: 'llm' | 'template';
  }>;
  theme?: "light" | "dark";
}

export function ComposeSlidesModal({ open, onClose, onCreate, onDraftWithAigentMe, theme = "dark" }: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [title, setTitle] = useState("");
  const [outlineText, setOutlineText] = useState("");
  // Phase 6.b 2.5c v2 — full per-slide structure (bullets + diagram concept)
  // returned by the drafter. The textarea above stays as the simple manual
  // override path; when the user clicks Draft for me we keep both in sync.
  const [sections, setSections] = useState<SlideSection[]>([]);
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
      setError('Tell aigentMe what the deck is for.');
      return;
    }
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(aiPrompt.trim());
      setTitle(draft.title ?? "");
      setOutlineText((draft.outline ?? []).join("\n"));
      setSections(Array.isArray(draft.sections) ? draft.sections : []);
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
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const outline = outlineText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // If the user edited the outline textarea we trust those titles. We
    // still forward sections (bullets + diagram concepts) as long as they
    // align positionally with the manual outline — otherwise the textarea
    // is the override and sections become empty so the connector renders
    // title-only slides.
    const alignedSections =
      sections.length > 0 &&
      outline.length === sections.length &&
      outline.every((t, i) => t === sections[i].title)
        ? sections
        : undefined;
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), outline, sections: alignedSections });
      setAiPrompt(""); setAiRationale(null); setAiSource(null);
      setTitle(""); setOutlineText(""); setSections([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [title, outlineText, onCreate, onClose]);

  if (!open) return null;

  return (
    <div className={overlayClass} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <form onSubmit={handleSubmit} className={`rounded-lg p-5 w-full max-w-lg shadow-xl ${panelClass}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Presentation className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold">Compose Slides deck</h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-slate-800/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`mb-3 p-3 rounded border ${isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'}`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the deck for? <span className="opacity-60">(aigentMe will draft the outline)</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. a 5-slide investor update on the metaMe Q1 alpha launch"
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
              <span className="font-medium">aigentMe:</span> {aiRationale}
              {aiSource === 'template' && <span className="opacity-60"> (template fallback)</span>}
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Deck title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-3 py-2 rounded ${inputClass}`} disabled={submitting} />
          </label>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>Slide outline (one slide title per line)</span>
            <textarea
              value={outlineText}
              onChange={(e) => setOutlineText(e.target.value)}
              rows={6}
              placeholder="Cover&#10;Context&#10;What we tried&#10;What we learned&#10;Next steps"
              className={`w-full px-3 py-2 rounded font-sans ${inputClass}`}
              disabled={submitting}
            />
          </label>
          {sections.length > 0 && (
            <div className={`rounded border ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} p-3`}>
              <p className={`text-[11px] mb-2 ${labelClass}`}>
                <span className="font-medium">aigentMe drafted bullets + visuals.</span> Reviewed on the slides once created — edit the outline above to drop sections.
              </p>
              <ul className="space-y-2 text-xs">
                {sections.map((s, i) => (
                  <li key={`${i}-${s.title}`}>
                    <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{i + 1}. {s.title}</div>
                    {s.bullets.length > 0 && (
                      <ul className={`mt-1 pl-4 list-disc ${labelClass}`}>
                        {s.bullets.slice(0, 5).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {s.diagramConcept && (
                      <p className={`mt-1 pl-4 italic ${labelClass}`}>
                        Visual concept: {s.diagramConcept}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 mt-3">{error}</div>
        )}

        <p className={`text-[11px] mt-3 ${labelClass}`}>
          The deck is created privately in your Drive. Sharing happens from Drive itself.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={submitting} className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${ghostBtn}`}>Cancel</button>
          <button type="submit" disabled={submitting} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Creating…' : 'Create deck'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ComposeSlidesModal;
