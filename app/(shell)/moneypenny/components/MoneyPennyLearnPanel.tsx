/**
 * MoneyPennyLearnPanel — MoneyPenny Cartridge C-15/A3 "related chip opens
 * structured right-pane content" (2026-09-02). Reads the SAME published
 * placement the inline video block (SmartTriadInferenceRenderer.tsx) reads,
 * via GET /api/moneypenny/learn-content -> services/journey/
 * moneyPennyEducationalMedia.ts. One source of truth, two presentations —
 * never a second content store.
 *
 * Unauthenticated read (matches the route's own posture — public/preview
 * educational content, not gated per CLAUDE.md's Gated Content rules), so a
 * plain fetch is correct here, not personaFetch.
 */

"use client";

import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";

interface MoneyPennyLearnContent {
  title: string;
  description: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
}

export function MoneyPennyLearnPanel() {
  const [content, setContent] = useState<MoneyPennyLearnContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/moneypenny/learn-content")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) setContent(data.content);
        else setError(data?.detail ?? "Could not load learn content.");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }

  if (!content || !content.videoUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white/50">
        <BookOpen className="h-6 w-6" />
        <p className="text-sm">No educational video has been published yet.</p>
        <p className="text-xs text-white/30">
          Published through native Qriptopian Bridges admin (Bridges tab, section &quot;moneypenny-financial-basics&quot;).
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/50">
        <BookOpen className="h-4 w-4" />
        Financial Sovereignty basics
      </div>
      <h2 className="text-lg font-semibold text-white">{content.title}</h2>
      {content.description && (
        <p className="whitespace-pre-line text-sm text-white/70">{content.description}</p>
      )}
      {/* Public/non-gated educational content — plain <video>, matching
       * BridgeMediaStage.tsx's established pattern for public bridge media
       * (CLAUDE.md's VideoPlayer rule applies only to purchased/entitled
       * content). */}
      <video
        controls
        poster={content.posterUrl ?? undefined}
        src={content.videoUrl}
        className="w-full rounded-lg border border-white/10"
      />
    </div>
  );
}

export default MoneyPennyLearnPanel;
