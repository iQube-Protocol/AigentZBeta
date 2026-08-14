'use client';

/**
 * ConstitutionalInternetBridgeChooseSurface — the Constitutional Internet
 * Bridge's CHOOSE stage. A dynamic set of destinations, each an already-
 * evidenced act (book_interest demand signal, a share) or a deep link
 * elsewhere — never a single fact this journey gates on (see
 * constitutionalInternetBridgeJourney.ts's header).
 *
 * "Continue reading" and "Meet aigentMe" deep-link to real, already-
 * registered codex tabs (polity-core's commentary-constitutional-internet
 * tab; the metame codex) — never a guessed URL. "Join the research field"
 * and "Build / partner" reuse the same info@metame.com contact address
 * already used elsewhere in this codebase (KnytStoreInvestorTab's default)
 * rather than inventing a new one. "Share the Bridge" reuses the generic
 * SocialSharingModal with an explicit destination URL and this journey's
 * own campaignId.
 */

import React, { useState } from 'react';
import { BookMarked, Handshake, Mail, Share2, Sparkles, ArrowRight } from 'lucide-react';
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { buildCodexUrl } from '@/utils/codex-nav';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

const CONTACT_EMAIL = 'info@metame.com';

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

export function ConstitutionalInternetBridgeChooseSurface({ personaId }: ConstitutionalInternetBridgeChooseSurfaceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const readingUrl = buildCodexUrl('qripto', { tab: 'papers', personaId, shell: 'viewer' });
  const aigentMeUrl = buildCodexUrl('metame', { personaId, shell: 'viewer' });
  const knytsMythosUrl = typeof window !== 'undefined' ? `${window.location.origin}/bridge/knyts` : '/bridge/knyts';

  return (
    <div className="space-y-3">
      <BookReserveOption />

      <a
        href={readingUrl}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><BookMarked className="h-4 w-4 text-indigo-300" /> Continue reading</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      <a
        href={aigentMeUrl}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-indigo-300" /> Meet aigentMe</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      <a
        href={knytsMythosUrl}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-indigo-300" /> Explore the Mythos</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Internet — research field')}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Mail className="h-4 w-4 text-indigo-300" /> Join the research field</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Internet — build / partner')}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Handshake className="h-4 w-4 text-indigo-300" /> Build / partner</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </a>

      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Constitutional Financial Services Pilot — interest')}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3.5 hover:border-indigo-400/30 transition"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white"><Handshake className="h-4 w-4 text-indigo-300" /> Apply to join the Constitutional Financial Services Pilot</span>
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
