'use client';

/**
 * /bridge/knyts — The KNYTS Bridge public front door: Threshold Guide.
 *
 * Reconstituted (2026-08-09) onto the shared Guided Journey Runtime runner
 * (components/journey/JourneyRunSurface.tsx) — the SAME Posit Spine grammar
 * Horizen and the Validation Programme use, themed amber/gold via the
 * runner's `accent` prop and projected in Mythos language rather than
 * evidentiary/technical language. One Posit Spine, one active stage, one
 * live surface underneath — never seven sections stacked on a page.
 *
 * HOME and VIEW are deliberately browsable without a session (see
 * knytsBridgeCrossingJourney.ts and the /state route's own headers).
 * ORIENT/PASSPORT/REMIX/STAND happen inline on the spine; BUY deep-links to
 * the existing KNYT Store via an embed surface — no new commerce code here.
 *
 * This page hosts Passport sign-in itself (usePassportSignInHost +
 * PassportConnectPanel, the same surface /invite/[code]/page.tsx uses
 * directly) because a bare page has no SmartWalletDrawer anywhere in its
 * tree to answer a PASSPORT_SIGN_IN request otherwise — the proven
 * interrupt/resume mechanism (RemixCrossingButton's usePassportSignInGate,
 * KnytCommunityContentTab.tsx) is unchanged; only the Posit Spine's active
 * stage is now kept in step with it, so the spine never shows a stage the
 * visitor has already moved past.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { JourneyRunSurface, type JourneyRunSurfaceProps } from '@/components/journey/JourneyRunSurface';
import { KNYTS_BRIDGE_CROSSING_JOURNEY, KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import { KnytsBridgeHomeSurface } from '@/components/journey/KnytsBridgeHomeSurface';
import { KnytsBridgeOrientationCard } from '@/components/journey/KnytsBridgeOrientationCard';
import { KnytCommunityContentTab } from '@/app/triad/components/codex/tabs/KnytCommunityContentTab';
import { MyCanvasTab } from '@/app/triad/components/codex/tabs/MyCanvasTab';
import { KnytsBridgeStandPanel } from '@/components/journey/KnytsBridgeStandPanel';
import { PassportBureauApplyTab } from '@/app/triad/components/codex/tabs/PassportBureauApplyTab';
import { PassportConnectPanel } from '@/components/companion/PassportConnectPanel';
import { usePassportSignInHost } from '@/app/hooks/usePassportSignInHost';

/** KNYT visual projection — amber/gold, never a change to JourneyRunSurface's
 *  own default (purple), which every other journey keeps. */
const KNYT_ACCENT = {
  node: 'border-amber-400 bg-amber-500/20 text-amber-200',
  label: 'text-amber-200',
  chip: 'bg-amber-500/20 text-amber-200',
};

const KNYTS_BRIDGE_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  KnytsBridgeHomeSurface,
  KnytCommunityContentTab,
  KnytsBridgeOrientationCard,
  PassportBureauApplyTab,
  MyCanvasTab,
  KnytsBridgeStandPanel,
};

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

export default function KnytsBridgePage() {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);

  // Same pinned-persona read every top-level surface uses as its baseline
  // (personaFetch's own fallback, MetaMeRuntimeClient's resolver).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('currentPersonaId');
      if (stored) setPersonaId(stored);
    } catch {
      /* storage unavailable — stays signed-out */
    }
  }, []);

  // Resume an interrupted Remix intent: RemixCrossingButton (inside this
  // page's VIEW stage) targets `/bridge/knyts?remix=<payload>` when already
  // on this page, so landing here with that param present means "put the
  // spine on REMIX" — MyCanvasTab's own remix= param seeding effect then
  // resumes the draft from there.
  useEffect(() => {
    try {
      if (new URL(window.location.href).searchParams.has('remix')) {
        selectStage('remix');
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const { showPassportSignIn, completeSignIn, dismissSignIn } = usePassportSignInHost('KnytsBridgeFrontDoor');

  // Keep the spine's active stage in step with the interrupt modal, so it
  // never shows a stage the visitor has already moved past.
  useEffect(() => {
    if (showPassportSignIn) selectStage('passport');
  }, [showPassportSignIn]);

  const resolveSurfaceProps = useCallback(
    ({ surfaceRef }: Parameters<NonNullable<JourneyRunSurfaceProps['resolveSurfaceProps']>>[0]) => {
      if (surfaceRef.ref === 'knyts-bridge-view-pulse') {
        return { cartridge: 'knyt', campaignTag: KNYTS_BRIDGE_CAMPAIGN_ID };
      }
      return {};
    },
    [],
  );

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <JourneyRunSurface
        journey={KNYTS_BRIDGE_CROSSING_JOURNEY}
        stateUrl="/api/journey/knyts-bridge/state"
        personaId={personaId}
        documentTitle="The KNYTS Bridge — Threshold Guide"
        components={KNYTS_BRIDGE_COMPONENTS}
        resolveSurfaceProps={resolveSurfaceProps}
        accent={KNYT_ACCENT}
        headerLabel={
          <>
            <span className="shrink-0 font-semibold text-slate-100">KNYTS Bridge</span>
            <span className="shrink-0 text-slate-600">·</span>
            <span className="truncate text-amber-300">Threshold Guide</span>
          </>
        }
      />

      {/* PASSPORT — hosted inline for the Remix-without-Passport interrupt */}
      {showPassportSignIn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl overflow-hidden">
            <PassportConnectPanel
              world="application"
              embedded
              onConnected={() => {
                try {
                  const stored = window.localStorage.getItem('currentPersonaId');
                  if (stored) setPersonaId(stored);
                } catch {
                  /* ignore */
                }
                completeSignIn();
                selectStage('remix');
              }}
            />
            <button
              type="button"
              onClick={dismissSignIn}
              className="w-full border-t border-white/10 px-4 py-2.5 text-[12px] text-slate-400 hover:text-slate-200"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
