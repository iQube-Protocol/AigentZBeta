'use client';

/**
 * KnytsBridgeChooseSurface — the CHOOSE stage's destinations for the KNYTS Bridge.
 *
 * Contextual-left-pane interaction model (2026-08-14, final Choose-surface
 * closure pass) — same model ConstitutionalInternetBridgeChooseSurface uses:
 * the left FullscreenableFrame shows whatever the most recently clicked
 * card's main body selected; a card that also carries a mailto CTA keeps
 * that CTA as a stopPropagation-guarded inline <a>, never a whole-card
 * mailto anchor (that would make the card unable to set the left view again
 * once clicked).
 *
 * Seven destinations (KNYTS Bridge campaign activation, 2026-08-16 —
 * `KNYT_BRIDGE_CAMPAIGN_IMPLEMENTATION_SPEC_CLAUDE_CODE.md`):
 *   1. "Get first access to the metaKnyt Kickstarter" — campaign
 *      pre-registration, still the shared BridgeReserveInterestCard
 *      (same component CI's reserve card uses), posting to the SAME
 *      knyts-bridge/choose/book-interest route (URL unchanged; only the
 *      route's behavior changed — see that file). An interest/notify
 *      signal, never a preorder or payment.
 *   1b. "Follow the Kickstarter" — always-available outbound CTA. Records
 *      `kickstarter_preview_clicked` (observed evidence only — a click is
 *      NEVER promoted into a confirmed follow) before opening the
 *      centralized Kickstarter URL in a new tab.
 *   2. "Explore the KNYT Store" — switches the left pane to the canonical
 *      embedded Store (knyt-codex/store-episodes, focused depth 1 so the
 *      Store's own Episodes|KNYT Cards|Bundles|Investor KNYT strip stays
 *      navigable, floating copilot suppressed) — no new commerce code.
 *   3. "Learn about the Constitutional Internet" — switches the left pane to
 *      an embedded /bridge/ci (the sibling bridge, same reciprocal pattern
 *      CI's own "Explore the Mythos" card uses for /bridge/knyts).
 *   4. "Apply to join the Constitutional Financial Services Pilot" — mailto
 *      interest action (unchanged; no separate Pilot codex/tab yet).
 *   5. "Ask Kn0w1" — opens the page-level KNYT CodexCopilotLayer via
 *      `onOpenKnytCopilot` (unchanged; never mounts a second copilot).
 *   6. "Share the Bridge & Earn $KNYT" — the existing SocialSharingModal,
 *      KNYTS_BRIDGE_CAMPAIGN_ID tracking and reward distribution. No new
 *      reward implementation: /api/social/track's threshold-based
 *      distribution only fires on real click/signup/conversion events, so
 *      opening (or even sharing from) this modal alone never grants a
 *      reward by itself.
 *
 * Left pane defaults to the admin-configured Choose video — section='choose'
 * in knytsBridgeEditorialConfig.ts, reusing the SAME videoUrl/posterUrl
 * fields HOME/ORIENT already carry (no schema change, no new admin
 * component — KnytsBridgeAdminPanel is already generic over `section`).
 * No admin video configured yet → falls back to the original "Where next?"
 * explainer, unchanged from before this pass.
 *
 * Never a single fact this journey could gate on, so CHOOSE carries no
 * completion evidence — exactly like KNYTS Bridge's own predecessor BUY stage.
 */

import React, { useEffect, useState } from 'react';
import { Mail, Sparkles, ArrowRight, Handshake, Compass, MessageCircle, Share2, Rocket } from 'lucide-react';
import { buildCodexUrl } from '@/utils/codex-nav';
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import { FullscreenableFrame } from '@/components/journey/FullscreenableFrame';
import { BridgeReserveInterestCard } from '@/components/journey/BridgeReserveInterestCard';
import {
  KNYTS_BRIDGE_SECTION_DEFAULTS,
  type KnytsBridgeEditorialSection,
} from '@/services/journey/knytsBridgeEditorialConfig';

const CONTACT_EMAIL = 'info@metame.com';
const SECTION = 'choose';

type LeftView = 'video' | 'store' | 'ci';

interface KnytsBridgeChooseSurfaceProps {
  personaId?: string;
  /** Opens the page-level KNYT CodexCopilotLayer — never a second, surface-local copilot instance. */
  onOpenKnytCopilot?: () => void;
}

/** Main click sets the contextual left view; an optional mailto CTA is an
 *  inline extra that stops propagation so it never also fires onClick. */
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
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition hover:opacity-80 ${
        active ? 'border-amber-400/40 bg-amber-500/10' : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {label}</span>
      {mailtoSubject && mailtoLabel && (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailtoSubject)}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200"
        >
          <Mail className="h-3 w-3" /> {mailtoLabel}
        </a>
      )}
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

/**
 * "Follow the Kickstarter" — always-available outbound CTA. Records
 * `kickstarter_preview_clicked` (observed evidence, never promoted to a
 * confirmed follow — spec §6) before opening the campaign's Kickstarter
 * project in a new tab. The URL is resolved server-side
 * (getKnytsBridgeKickstarterUrl) so it is centralized in one place rather
 * than hard-coded here.
 */
function KickstarterFollowCard({ personaId }: { personaId?: string }) {
  const [pending, setPending] = useState(false);

  const handleFollow = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch('/api/journey/knyts-bridge/choose/kickstarter-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as { kickstarterUrl?: string } | null;
      const url = json?.kickstarterUrl;
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Non-fatal — the click is decorative telemetry; the visitor's ability
      // to reach Kickstarter must not depend on it.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleFollow()}
      disabled={pending}
      data-persona-id={personaId}
      className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3.5 text-left transition hover:border-amber-400/50 disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        <Rocket className="h-4 w-4 text-amber-300" />
        Follow the Kickstarter
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

/** A pure interest action with no contextual left view of its own — Reserve
 *  and the CFS Pilot are link-only, so a plain mailto anchor is correct
 *  (nothing to guard propagation against). */
function MailtoCard({ icon, label, mailtoSubject }: { icon: React.ReactNode; label: string; mailtoSubject: string }) {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(mailtoSubject)}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 transition hover:border-amber-400/30"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </a>
  );
}

export function KnytsBridgeChooseSurface({ personaId, onOpenKnytCopilot }: KnytsBridgeChooseSurfaceProps) {
  const [leftView, setLeftView] = useState<LeftView>('video');
  const [shareOpen, setShareOpen] = useState(false);
  const defaults = KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION];
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(defaults);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${SECTION}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok?: boolean; config?: KnytsBridgeEditorialSection }) => {
        if (!cancelled && json.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* non-fatal — the "Where next?" fallback still renders */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const storeUrl = buildCodexUrl('knyt-codex', {
    tab: 'store-episodes',
    personaId,
    shell: 'embed',
    suppressCopilot: true,
    focused: true,
    focusedNavDepth: 1,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* LEFT — contextual visual, same interaction model as CI Choose. */}
      <FullscreenableFrame className="h-[55vh] max-h-[65vh] min-h-[18rem] w-full bg-slate-900/40" title="Choose">
        {leftView === 'store' ? (
          <iframe src={storeUrl} title="Explore the KNYT Store" className="h-full w-full border-0" />
        ) : leftView === 'ci' ? (
          <iframe src="/bridge/ci" title="The Constitutional Internet Bridge" className="h-full w-full border-0" />
        ) : config.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="h-full w-full object-cover"
            controls
            poster={config.posterUrl ?? undefined}
            src={config.videoUrl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
            <Compass className="h-16 w-16 text-amber-300" />
            <div>
              <h3 className="text-lg font-semibold text-white">Where next?</h3>
              <p className="mt-2 text-sm text-slate-300">
                Your crossing is published. Choose how to continue in the Polity.
              </p>
            </div>
          </div>
        )}
      </FullscreenableFrame>

      {/* RIGHT — destination cards */}
      <div className="flex flex-col gap-3">
        <BridgeReserveInterestCard
          title="Get first access to the metaKnyt Kickstarter"
          description="Pre-register for the campaign, then follow the Kickstarter preview so you're notified when we launch."
          submitUrl="/api/journey/knyts-bridge/choose/book-interest"
          successTitle="You're on the list. Now follow the Kickstarter."
          successDescription="This is an interest signal, not a payment — you haven't been charged."
        />

        <KickstarterFollowCard personaId={personaId} />

        <DestinationCard
          icon={<Sparkles className="h-4 w-4 text-amber-300" />}
          label="Explore the KNYT Store"
          active={leftView === 'store'}
          onClick={() => setLeftView('store')}
        />

        <DestinationCard
          icon={<Compass className="h-4 w-4 text-amber-300" />}
          label="Learn about the Constitutional Internet"
          active={leftView === 'ci'}
          onClick={() => setLeftView('ci')}
        />

        <MailtoCard
          icon={<Handshake className="h-4 w-4 text-amber-300" />}
          label="Apply to join the Constitutional Financial Services Pilot"
          mailtoSubject="Constitutional Financial Services Pilot — interest"
        />

        {/* Ask Kn0w1 — opens the page-level KNYT CodexCopilotLayer (the ONE
            conversational partner for this bridge, MS-1); never mounts a
            second copilot instance here. */}
        <button
          type="button"
          onClick={() => onOpenKnytCopilot?.()}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 text-left transition hover:border-amber-400/30"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4 text-amber-300" />
            Ask Kn0w1
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 text-left transition hover:border-amber-400/30"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Share2 className="h-4 w-4 text-amber-300" />
            Share the Bridge &amp; Earn $KNYT
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>

      <SocialSharingModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        article={{
          id: KNYTS_BRIDGE_CAMPAIGN_ID,
          title: 'The KNYTS Bridge',
          description: 'Cross the Threshold. Come home.',
          url: typeof window !== 'undefined' ? `${window.location.origin}/bridge/knyts` : undefined,
        }}
        personaId={personaId}
        campaignId={KNYTS_BRIDGE_CAMPAIGN_ID}
      />
    </div>
  );
}

export default KnytsBridgeChooseSurface;
