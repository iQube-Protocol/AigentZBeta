'use client';

/**
 * ConstitutionalInternetBridgeChooseSurface — the Constitutional Internet
 * Bridge's CHOOSE stage. A dynamic set of destinations, each an already-
 * evidenced act (book_interest demand signal, a share) or a deep link
 * elsewhere — never a single fact this journey gates on (see
 * constitutionalInternetBridgeJourney.ts's header).
 *
 * Two-column geometry (integration pass, 2026-08-11): left dominant visual,
 * right destination cards, mirroring Orient.
 *
 * Left viewport is CONTEXTUAL (targeted correction pass, 2026-08-11) —
 * every destination selection swaps what the left panel shows, always
 * inside the same warm parchment museum-matte View mounts its plates in
 * (ArtifactMattedFrame), with the same in-viewport fullscreen control
 * (FullscreenableFrame) View uses, never a pop-out:
 *
 *   Reserve / idle        → the CIP-006 concept visual (explicitly labeled
 *                            "Concept — not the final cover"; no real
 *                            canonical book cover exists in this repo —
 *                            confirmed by search, never silently presented
 *                            as canon)
 *   Continue reading       → the real polity-core commentary tab, embedded
 *   Meet aigentMe           → opens the existing aigentMe Copilot drawer
 *                            (the page's own `CodexCopilotLayer`, via
 *                            `onOpenAigentMeCopilot`) and shows an honest
 *                            TEXT explainer of the person↔aigentMe
 *                            relationship — no canonical plate exists for
 *                            this yet, so this deliberately renders as
 *                            typography with a "Canonical plate — pending"
 *                            badge, never a fabricated image standing in
 *                            for one
 *   Join the IRL research
 *   programme               → same pending-plate text explainer for the
 *                            Invariant Research Lab
 *   Partner with metaMe    → same pending-plate text explainer for the
 *                            metaMe Venture Lab
 *
 * "Meet aigentMe" no longer embeds the metaMe cartridge in the left
 * viewport (the prior pass's `buildCodexUrl('metame-codex', {tab:'aigent-
 * me',...})` iframe) — the operator wants the ALREADY-MOUNTED aigentMe
 * Copilot drawer opened instead, with Choose staying in place. That drawer
 * is `app/bridge/ci/page.tsx`'s own `CodexCopilotLayer` (`copilotOpen`
 * state) — threaded down as `onOpenAigentMeCopilot` via `resolveSurfaceProps`
 * exactly the way `personaId` already is for other stages.
 */

import React, { useState, useEffect } from 'react';
import { BookMarked, Compass, Handshake, Mail, Share2, Sparkles, ArrowRight } from 'lucide-react';
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { buildCodexUrl } from '@/utils/codex-nav';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';

const CONTACT_EMAIL = 'info@metame.com';
const BOOK_CONCEPT_PLATE = canonicalPlateImage('CIP-006');

type LeftView = 'book' | 'reading' | 'aigentme' | 'irl' | 'partner';

interface ConstitutionalInternetBridgeChooseSurfaceProps {
  personaId?: string;
  /** Opens the page's existing aigentMe Copilot drawer (CodexCopilotLayer) —
   *  see header note. Undefined is handled gracefully (button still
   *  switches the left explainer; only the drawer-open side effect is
   *  skipped) so this component never hard-depends on the page wiring it. */
  onOpenAigentMeCopilot?: () => void;
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

function DestinationCard({
  icon,
  label,
  active,
  onClick,
  mailtoSubject,
  mailtoLabel,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  mailtoSubject?: string;
  mailtoLabel?: string;
}) {
  return (
    <div className={`rounded-xl border transition ${
      active ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/10 bg-slate-900/40'
    }`}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 hover:opacity-80"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {label}</span>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>
      {mailtoSubject && mailtoLabel && (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailtoSubject)}`}
          className="flex items-center gap-1.5 border-t border-white/5 px-4 py-2.5 text-[11px] font-medium text-indigo-300 hover:text-indigo-200"
        >
          <Mail className="h-3 w-3" /> {mailtoLabel}
        </a>
      )}
    </div>
  );
}


/** Honest placeholder for a canonical plate that does not exist yet —
 *  typography only, never a fabricated/repurposed image standing in for a
 *  real plate. The badge makes the non-canonical status explicit, same
 *  spirit as the book concept's "Concept — not the final cover" label. */
function PendingCanonicalPlateExplainer({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-3 overflow-y-auto p-6">
      <span className="rounded-full border border-[#8a6f4a]/40 bg-[#8a6f4a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#8a6f4a]">
        Canonical plate — pending
      </span>
      <h3 className="text-lg font-semibold text-[#3a2f22]">{title}</h3>
      <ul className="space-y-1.5 text-sm text-[#5a4a35]">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8a6f4a]" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CanonicalAsset {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  assetKind: string;
  seriesScope: string;
  publicUrl: string;
  cid?: string;
}

export function ConstitutionalInternetBridgeChooseSurface({ personaId, onOpenAigentMeCopilot }: ConstitutionalInternetBridgeChooseSurfaceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [leftView, setLeftView] = useState<LeftView>('book');
  const [canonicalAssets, setCanonicalAssets] = useState<Record<string, CanonicalAsset | null>>({
    aigentme: null,
    irl: null,
    partner: null,
  });

  // Fetch canonical plates on mount
  useEffect(() => {
    const fetchCanonicalAssets = async () => {
      try {
        const res = await fetch('/api/codex/qripto/canonical-assets?scope=canonical/constitutional-internet');
        if (!res.ok) return;
        const json = await res.json() as { assets: CanonicalAsset[] };
        const assets = json.assets || [];

        // Map by case-insensitive filename stem
        const resolved: Record<string, CanonicalAsset | null> = {
          aigentme: null,
          irl: null,
          partner: null,
        };

        for (const asset of assets) {
          const stem = asset.originalFilename.replace(/\.[^.]+$/, '').toLowerCase();

          if (stem === 'agentime_plate' || stem === 'agentmeplate') {
            resolved.aigentme = asset;
          } else if (stem === 'irl_plate' || stem === 'irlplate') {
            resolved.irl = asset;
          } else if (stem === 'metame_vl_plate' || stem === 'metame_vl_plate' || stem === 'metame_venture_lab_plate') {
            resolved.partner = asset;
          }
        }

        setCanonicalAssets(resolved);
      } catch (error) {
        console.error('[Canonical Assets]', error);
      }
    };

    fetchCanonicalAssets();
  }, []);

  const readingSrc = buildCodexUrl('polity-core-cartridge', {
    tab: 'commentary-constitutional-internet',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
  });

  const openAigentMe = () => {
    setLeftView('aigentme');
    onOpenAigentMeCopilot?.();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — contextual visual, always parchment-matted + fullscreen-capable. */}
      <FullscreenableFrame className="h-[55vh] max-h-[65vh] min-h-[18rem] w-full bg-slate-900/40" title="Choose">
        {leftView === 'reading' ? (
          <iframe src={readingSrc} title="Continue reading — The Constitutional Internet" className="h-full w-full border-0" />
        ) : leftView === 'aigentme' ? (
          <ArtifactMattedFrame>
            {canonicalAssets.aigentme ? (
              <div className="relative flex h-full w-full items-center justify-center">
                <img src={canonicalAssets.aigentme.publicUrl} alt={canonicalAssets.aigentme.title} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <PendingCanonicalPlateExplainer
                title="You and aigentMe"
                points={[
                  'You remain the principal — the constitutional subject.',
                  'aigentMe is a companion and delegate only within authority you grant.',
                  'Context crossing to aigentMe is not delegation.',
                  'Mandate and authority stay bounded — never open-ended.',
                ]}
              />
            )}
          </ArtifactMattedFrame>
        ) : leftView === 'irl' ? (
          <ArtifactMattedFrame>
            {canonicalAssets.irl ? (
              <div className="relative flex h-full w-full items-center justify-center">
                <img src={canonicalAssets.irl.publicUrl} alt={canonicalAssets.irl.title} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <PendingCanonicalPlateExplainer
                title="The Invariant Research Lab"
                points={[
                  'Invariants are reasoning compression — durable lessons carried forward.',
                  'Oriented around experiment and validation, not assertion.',
                  'A research programme in service of Constitutional Computing.',
                ]}
              />
            )}
          </ArtifactMattedFrame>
        ) : leftView === 'partner' ? (
          <ArtifactMattedFrame>
            {canonicalAssets.partner ? (
              <div className="relative flex h-full w-full items-center justify-center">
                <img src={canonicalAssets.partner.publicUrl} alt={canonicalAssets.partner.title} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <PendingCanonicalPlateExplainer
                title="metaMe Venture Lab"
                points={[
                  'A pathway to build and partner on the constitutional venture substrate.',
                  'Open to Builders and Founders as participants, not just customers.',
                  'Part of the wider metaMe ecosystem.',
                ]}
              />
            )}
          </ArtifactMattedFrame>
        ) : (
          <ArtifactMattedFrame>
            <div className="relative flex h-full w-full items-center justify-center">
              {BOOK_CONCEPT_PLATE && (
                <img src={BOOK_CONCEPT_PLATE.url} alt={BOOK_CONCEPT_PLATE.title} className="max-h-full max-w-full object-contain" />
              )}
              <span className="absolute left-0 top-0 rounded-full border border-[#8a6f4a]/40 bg-[#8a6f4a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#8a6f4a]">
                Concept — not the final cover
              </span>
            </div>
          </ArtifactMattedFrame>
        )}
      </FullscreenableFrame>

      {/* RIGHT — destination cards. */}
      <div className="space-y-3">
        <BookReserveOption />

        <DestinationCard
          icon={<BookMarked className="h-4 w-4 text-indigo-300" />}
          label="Continue reading"
          active={leftView === 'reading'}
          onClick={() => setLeftView('reading')}
        />

        <DestinationCard
          icon={<Sparkles className="h-4 w-4 text-indigo-300" />}
          label="Meet aigentMe"
          active={leftView === 'aigentme'}
          onClick={openAigentMe}
        />

        <DestinationCard
          icon={<Compass className="h-4 w-4 text-indigo-300" />}
          label="Join the IRL research programme"
          active={leftView === 'irl'}
          onClick={() => setLeftView('irl')}
          mailtoSubject="Constitutional Internet — research field"
          mailtoLabel="Email us to join"
        />

        <DestinationCard
          icon={<Handshake className="h-4 w-4 text-indigo-300" />}
          label="Apply to partner with metaMe"
          active={leftView === 'partner'}
          onClick={() => setLeftView('partner')}
          mailtoSubject="Constitutional Internet — build / partner"
          mailtoLabel="Email us to partner"
        />

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
