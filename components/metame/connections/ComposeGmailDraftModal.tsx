"use client";

/**
 * ComposeGmailDraftModal — aigentMe Phase 6.b Part 2.5b.
 *
 * A small overlay that lets the user originate a Gmail draft from the
 * aigentMe welcome surface (no curl, no specialist round-trip required).
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

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, X, Mail, Sparkles } from "lucide-react";
import { MicButton } from "@/components/ui/MicButton";
import { UploadAttachmentPicker } from "@/components/metame/uploads/UploadAttachmentPicker";
import { transformEmailDictation } from "@/hooks/useSpeechRecognition";

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
    /** Persona upload ids — picker mounts inline; Phase 2 wires the
     *  Gmail multipart MIME builder so attachments ride with the
     *  draft. Until then they round-trip as actionInput metadata so
     *  the artifact record remembers the operator's selections. */
    attachmentUploadIds?: string[];
  }) => Promise<void>;
  /**
   * Phase 6.b Part 2.5b — aigentMe drafts a full email from a one-liner
   * about what the user wants to achieve. Returns the suggestion so the
   * modal can populate its fields (user can still edit before sending).
   */
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
  /**
   * Phase 2 Slice 4 migration: when true, renders the form *inline* with
   * no overlay / dialog chrome so it can host inside ComposerLayout's
   * right-pane body. The caller manages dismissal (typically via the
   * layout's header X). `open` is ignored in inline mode — the form
   * always renders when the layout mounts it.
   */
  inline?: boolean;
  /** See ComposeGoogleDocModal — auto-fires draft on mount when set. */
  initialPrompt?: string;
  /**
   * When set, pre-populates all fields directly without calling the draft-email
   * API. Used for "send it again" / resend flows where the email was already
   * drafted in a prior turn. Takes precedence over initialPrompt.
   */
  prefill?: { to: string; cc?: string; bcc?: string; subject: string; bodyText: string } | null;
  /** Active persona — required by UploadAttachmentPicker so it fetches
   *  the operator's uploads (not the spine's default persona). Without
   *  this prop the picker falls back to localStorage-based persona
   *  resolution and can render an empty / wrong-persona list, leaving
   *  attachmentUploadIds silently empty at submit time. */
  personaId?: string;
  /**
   * Case A — seed the local attachmentUploadIds on first mount from
   * the parent's chat-attachment escrow (what the operator paperclip-
   * attached to the chat copilot's last successful turn). Only seeds
   * when the current state is empty — the picker UI remains the
   * source of truth once the operator interacts with it. Optional;
   * omitting it preserves the legacy empty-init behaviour.
   */
  initialAttachmentUploadIds?: string[];
}

export function ComposeGmailDraftModal({
  open,
  onClose,
  onCreate,
  onDraftWithAigentMe,
  theme = "dark",
  inline = false,
  initialPrompt,
  prefill,
  personaId,
  initialAttachmentUploadIds,
}: Props) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'llm' | 'template' | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [attachmentUploadIds, setAttachmentUploadIds] = useState<string[]>(
    () => (Array.isArray(initialAttachmentUploadIds) ? [...initialAttachmentUploadIds] : []),
  );
  // Case A — re-seed from the parent's chat-attachment escrow ONLY
  // when the local picker is still empty. After the operator touches
  // the picker, the local state owns the truth; escrow changes from
  // the parent never overwrite operator edits.
  useEffect(() => {
    if (!Array.isArray(initialAttachmentUploadIds) || initialAttachmentUploadIds.length === 0) return;
    setAttachmentUploadIds((prev) => (prev.length > 0 ? prev : [...initialAttachmentUploadIds]));
  }, [initialAttachmentUploadIds]);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftWithPrompt = useCallback(async (promptToUse: string) => {
    const trimmed = promptToUse.trim();
    if (!trimmed) return;
    setError(null);
    setAiDrafting(true);
    try {
      const draft = await onDraftWithAigentMe(trimmed);
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
  }, [onDraftWithAigentMe]);

  const handleDraft = useCallback(() => {
    if (!aiPrompt.trim()) {
      setError('Tell aigentMe what the email is for (one sentence).');
      return;
    }
    void draftWithPrompt(aiPrompt);
  }, [aiPrompt, draftWithPrompt]);

  // Prefill — when a prior draft is available (e.g. "send it again" resend flow),
  // populate fields directly without calling the draft-email API. Takes
  // precedence: if prefill is set on mount, skip the initialPrompt auto-draft.
  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (!prefill || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    setTo(prefill.to ?? '');
    setCc(prefill.cc ?? '');
    setBcc(prefill.bcc ?? '');
    setSubject(prefill.subject ?? '');
    setBodyText(prefill.bodyText ?? '');
  }, [prefill]);

  // Mount-fire from initialPrompt — see ComposeGoogleDocModal. Skipped when
  // prefill is set so the resend path doesn't overwrite the restored content.
  const lastInitialPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (prefill) return; // prefill path takes precedence
    if (!initialPrompt || !initialPrompt.trim()) return;
    if (lastInitialPromptRef.current === initialPrompt) return;
    lastInitialPromptRef.current = initialPrompt;
    setAiPrompt(initialPrompt);
    void draftWithPrompt(initialPrompt);
  }, [initialPrompt, prefill, draftWithPrompt]);

  const isDark = theme === "dark";
  const overlayClass = "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4";
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
    // Specific error per missing field — the previous one-message-for-all
    // confused users when they'd drafted Subject + Body but only To was
    // empty (or vice versa). Lists exactly what's missing.
    const missing: string[] = [];
    if (!to.trim())       missing.push("To");
    if (!subject.trim())  missing.push("Subject");
    if (!bodyText.trim()) missing.push("Body");
    if (missing.length > 0) {
      setError(
        missing.length === 1
          ? `${missing[0]} is required.`
          : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]} are required.`,
      );
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
        ...(attachmentUploadIds.length > 0 ? { attachmentUploadIds } : {}),
      });
      // Reset on success so the modal is clean next time.
      setAiPrompt("");
      setAiRationale(null);
      setAiSource(null);
      setTo("");
      setSubject("");
      setBodyText("");
      setCc("");
      setBcc("");
      setAttachmentUploadIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [to, subject, bodyText, cc, bcc, onCreate, onClose]);

  if (!inline && !open) return null;

  // Form body — identical between inline (ComposerLayout host) and modal
  // (legacy dialog) renderings. The only difference between the two is
  // the chrome wrapping it.
  const formBody = (
      <form
        onSubmit={handleSubmit}
        className={
          inline
            ? "w-full"
            : `rounded-lg p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl ${panelClass}`
        }
      >
        {!inline && (
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
        )}

        {/* aigentMe drafter — one-line prompt + Sparkle button. The
            response auto-fills the To / Cc / Bcc / Subject / Body fields
            below; the user can still edit anything before sending. */}
        <div className={`mb-3 p-3 rounded border ${
          isDark ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'
        }`}>
          <label className="block">
            <span className={`block text-xs mb-1 ${labelClass}`}>
              What&apos;s the email for? <span className="opacity-60">(aigentMe will draft it)</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                name="aigentme-prompt"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. thank Alice (alice@example.com) for yesterday's call and propose a follow-up next week"
                className={`flex-1 px-3 py-2 rounded ${inputClass}`}
                disabled={aiDrafting || submitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleDraft();
                  }
                }}
              />
              <MicButton
                onTranscript={(text) =>
                  setAiPrompt((prev) => (prev ? `${prev.trimEnd()} ${text}` : text))
                }
                transform={transformEmailDictation}
                disabled={aiDrafting || submitting}
                theme={theme}
              />
              <button
                type="button"
                onClick={handleDraft}
                disabled={aiDrafting || submitting || !aiPrompt.trim()}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn}`}
              >
                {aiDrafting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {aiDrafting ? 'Drafting…' : 'Draft for me'}
              </button>
            </div>
          </label>
          {aiRationale && (
            <p className={`text-[11px] mt-2 ${labelClass}`}>
              <span className="font-medium">aigentMe:</span> {aiRationale}
              {aiSource === 'template' && (
                <span className="opacity-60"> (template fallback — no LLM key set)</span>
              )}
            </p>
          )}
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
          {/* Attachment picker — Phase 1 surfaces the affordance and
              persists the upload ids onto the artifact actionInput.
              Phase 2 wires the Gmail multipart MIME builder to send
              the bytes as draft attachments. */}
          <UploadAttachmentPicker
            personaId={personaId}
            value={attachmentUploadIds}
            onChange={setAttachmentUploadIds}
            theme={theme}
          />
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
  );

  // Inline mode: caller (ComposerLayout) owns the wrapper. Skip dialog
  // chrome entirely — header X / dismiss live on the layout itself.
  if (inline) return formBody;

  // Legacy modal mode: overlay + dialog chrome wrap the same form body.
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
      {formBody}
    </div>
  );
}

export default ComposeGmailDraftModal;
