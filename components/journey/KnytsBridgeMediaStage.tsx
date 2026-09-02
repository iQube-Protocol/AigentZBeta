'use client';

/**
 * KnytsBridgeMediaStage — the KNYTS Bridge's HOME surface (2026-08-12,
 * KNYTS↔CI parity pass). ORIENT was split out into its own
 * `KnytsBridgeOrientIntro` (a thin wrapper over the bridge-neutral
 * `BridgeOrientSurface`) — this component is HOME-only now, a thin
 * amber-preset wrapper over the SAME generic `BridgeMediaStage` CI's own
 * `ConstitutionalInternetBridgeMediaStage` already uses
 * (`layout="cinematic"`), including its overlay fade-in/fade-out state
 * machine. Do not create a second cinematic hero or fade implementation —
 * extend `BridgeMediaStage` if HOME ever needs a capability it lacks.
 *
 * Copy/video/poster stay admin-editable via the same
 * /api/journey/knyts-bridge/editorial-config `home` row this component
 * always read. The Crossing-of-the-Week teaser (KNYTS-only, CI's HOME has
 * no equivalent) now renders as `BridgeMediaStage`'s secondary CTA rather
 * than a bespoke trophy button — same destination (`selectStage('view')`),
 * same admin-sourced title, projected through the shared shell.
 */

import { useEffect, useState } from 'react';
import { BridgeMediaStage } from '@/components/journey/BridgeMediaStage';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { KNYTS_BRIDGE_SECTION_DEFAULTS } from '@/services/journey/knytsBridgeEditorialConfig';

interface CrossingOfTheWeek {
  weekStart: string;
  communityContentId: string;
  title: string;
  score: number;
}

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

const SECTION = 'home';

interface Props {
  /** Which stage the primary CTA advances to. */
  ctaStageId: string;
  /** Show the reward callout + Crossing of the Week teaser. */
  showCampaignExtras?: boolean;
}

export function KnytsBridgeMediaStage({ ctaStageId, showCampaignExtras = false }: Props) {
  const defaults = KNYTS_BRIDGE_SECTION_DEFAULTS[SECTION];
  const [config, setConfig] = useState<KnytsBridgeEditorialSection>(defaults);
  const [crossingOfTheWeek, setCrossingOfTheWeek] = useState<CrossingOfTheWeek | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/journey/knyts-bridge/editorial-config?section=${SECTION}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok?: boolean; config?: KnytsBridgeEditorialSection }) => {
        if (!cancelled && json.ok && json.config) setConfig(json.config);
      })
      .catch(() => {
        /* non-fatal — the shipped defaults still render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCampaignExtras) return;
    let cancelled = false;
    fetch('/api/journey/knyts-bridge/crossing-of-the-week', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { ok?: boolean; crossing?: CrossingOfTheWeek | null }) => {
        if (!cancelled && json.ok && json.crossing) setCrossingOfTheWeek(json.crossing);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [showCampaignExtras]);

  const paragraphs = (config.shortCopy ?? defaults.shortCopy ?? '').split('\n\n').filter(Boolean);
  const rewardCopy = showCampaignExtras ? config.rewardCopy ?? undefined : undefined;

  return (
    <BridgeMediaStage
      eyebrow="The KNYTS Bridge"
      headline={config.headline ?? defaults.headline ?? ''}
      paragraphs={paragraphs}
      highlightLine={rewardCopy}
      primaryCtaLabel={config.campaignCta ?? defaults.campaignCta ?? 'Continue'}
      onPrimaryCta={() => selectStage(ctaStageId)}
      secondaryCtaLabel={
        showCampaignExtras && crossingOfTheWeek ? `Crossing of the Week: ${crossingOfTheWeek.title}` : undefined
      }
      onSecondaryCta={showCampaignExtras && crossingOfTheWeek ? () => selectStage('view') : undefined}
      accent="amber"
      videoUrl={config.videoUrl ?? undefined}
      posterUrl={config.posterUrl ?? undefined}
      infographicUrl={config.infographicUrl ?? undefined}
      layout="cinematic"
    />
  );
}

export default KnytsBridgeMediaStage;
