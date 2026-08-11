'use client';

/**
 * ConstitutionalInternetBridgeChooseSurface — the Constitutional Internet
 * Bridge's CHOOSE stage. A dynamic set of destinations, each an already-
 * evidenced act (book_interest demand signal, a share) or a deep link
 * elsewhere — never a single fact this journey gates on (see
 * constitutionalInternetBridgeJourney.ts's header).
 *
 * Reconstituted 2026-08-11 (integration pass) into a two-column layout
 * mirroring Orient's geometry — left: dominant visual; right: destination
 * actions in the existing restrained card grammar.
 *
 * Left visual: there is no real canonical "Constitutional Internet" book
 * cover anywhere in this repo (confirmed by search — canonicalPlateImages.ts's
 * own header already says "there is no verified Polity Papers cover image in
 * this repo yet. Do not repurpose a plate as a fake cover" for the Papers
 * series, and the same holds for a book cover). Per operator instruction,
 * this renders the real CIP-006 plate ("The Constitutional Internet") with
 * an explicit "Concept — not the final cover" badge, rather than silently
 * presenting a plate as canon or fabricating cover art.
 *
 * Embedding (integration pass): "Continue reading" and "Meet aigentMe" used
 * to be plain `<a href>` full-page navigations to `shell: 'viewer'` codex
 * URLs — the exact "leaves the Bridge" defect the embedding invariant
 * forbids. They now toggle the LEFT column between the book visual and an
 * embedded iframe of the chosen destination (`shell: 'embed'`), mirroring
 * ConstitutionalAgentFieldEntrySurface.tsx's MeetAigentMeEmbed recipe
 * verbatim for the aigentMe case — never a pop-out, never a mock UI.
 * "Join the research field"/"Build / partner" stay `mailto:` links (a
 * genuine external mail-client handoff, not a Bridge-internal navigation —
 * explicitly fine per the operator's "reserve book, sharing and application
 * actions remain appropriate").
 */

import React, { useState } from 'react';
import { BookMarked, Handshake, Mail, Share2, Sparkles, ArrowRight, X } from 'lucide-react';
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { buildCodexUrl } from '@/utils/codex-nav';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

const CONTACT_EMAIL = 'info@metame.com';
const BOOK_CONCEPT_PLATE = canonicalPlateImage('CIP-006');

type EmbedId = 'reading' | 'aigentme';

interface ConstitutionalInternetBridgeChooseSurfaceProps {
  personaId?: string;
}

function BookReserveOption() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const submit = async () => {
    if (!email.includes('@')) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/journey/constitutional-internet-bridge/choose/book-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => null);
      setStatus(json?.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-white"><BookMarked className="h-4 w-4 text-indigo-300" /> Thanks &mdash; we&rsquo;ll let you know.</p>
        <p className="mt-1 text-xs text-slate-400">This is a demand signal, not a payment &mdash; you haven&rsquo;t been charged.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white"><BookMarked className="h-4 w-4 text-indigo-300" /> Reserve The Constitutional Internet</p>
      <p className="mt-1 text-xs text-slate-400">Tell us you want a copy. This is a demand signal, not a paid preorder.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-400/50 focus:outline-none"
        />
        <button
          type="button"
          disabled={status === 'submitting' || !email.includes('@')}
          onClick={submit}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400 disabled:opacity-40"
        >
          Reserve
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-xs text-rose-400">Could not record your interest — please try again.</p>}
    </div>
  );
}

function DestinationButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition ${
        active ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/10 bg-slate-900/40 hover:border-indigo-400/30'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {label}</span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </button>
  );
}

export function ConstitutionalInternetBridgeChooseSurface({ personaId }: ConstitutionalInternetBridgeChooseSurfaceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [activeEmbed, setActiveEmbed] = useState<EmbedId | null>(null);

  const embedSrc =
    activeEmbed === 'reading'
      ? buildCodexUrl('polity-core', { tab: 'commentary-constitutional-internet', personaId, shell: 'embed', suppressCopilot: true })
      : activeEmbed === 'aigentme'
        ? buildCodexUrl('metame-codex', { tab: 'aigent-me', personaId, shell: 'embed', suppressCopilot: true })
        : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — book concept visual, or the embedded destination once a
          Continue-reading/Meet-aigentMe card is chosen. */}
      <div className="relative flex h-[55vh] max-h-[65vh] min-h-[18rem] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        {embedSrc ? (
          <>
            <iframe src={embedSrc} title={activeEmbed === 'reading' ? 'Continue reading' : 'Meet aigentMe'} className="h-full w-full rounded-2xl border-0 bg-slate-950" />
            <button
              type="button"
              onClick={() => setActiveEmbed(null)}
              aria-label="Back to book concept"
              title="Back to book concept"
              className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            {BOOK_CONCEPT_PLATE && (
              <img src={BOOK_CONCEPT_PLATE.url} alt={BOOK_CONCEPT_PLATE.title} className="h-full w-full object-contain" />
            )}
            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-300 backdrop-blur-sm">
              Concept — not the final cover
            </span>
          </>
        )}
      </div>

      {/* RIGHT — destination actions, restrained card grammar (unchanged). */}
      <div className="space-y-3">
        <BookReserveOption />

        <DestinationButton
          icon={<BookMarked className="h-4 w-4 text-indigo-300" />}
          label="Continue reading"
          active={activeEmbed === 'reading'}
          onClick={() => setActiveEmbed('reading')}
        />

        <DestinationButton
          icon={<Sparkles className="h-4 w-4 text-indigo-300" />}
          label="Meet aigentMe"
          active={activeEmbed === 'aigentme'}
          onClick={() => setActiveEmbed('aigentme')}
        />

        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Internet — research field')}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><Mail className="h-4 w-4 text-indigo-300" /> Apply to join the IRL research programme</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>

        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Internet — build / partner')}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><Handshake className="h-4 w-4 text-indigo-300" /> Apply to partner with metaMe</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><Share2 className="h-4 w-4 text-indigo-300" /> Share the Bridge</span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <SocialSharingModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        article={{
          id: 'constitutional-internet-bridge',
          title: 'The Constitutional Internet Bridge',
          description: 'The Internet recognizes accounts. The Constitutional Internet recognizes persons.',
          url: typeof window !== 'undefined' ? `${window.location.origin}/bridge/ci` : undefined,
        }}
        personaId={personaId}
        campaignId={CI_BRIDGE_CAMPAIGN_ID}
      />
    </div>
  );
}

export default ConstitutionalInternetBridgeChooseSurface;
