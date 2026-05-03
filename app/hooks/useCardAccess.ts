'use client';

/**
 * useCardAccess — client hook that pairs the cardAccess resolver with the
 * SmartTriadProvider's owned-assets and credentials state, plus a small
 * intent-preservation flow for the (A) anon → sign-in → purchase path.
 *
 * Usage in any cartridge surface (KnytTab, KnytStageTemplates, Qriptopian
 * tabs, metaMe experience qubes, Terra, community panels):
 *
 *   const { evaluate, handleCartClick } = useCardAccess({ personaId });
 *   const card = evaluate(content);
 *   if (card.showShoppingCart)
 *     <button onClick={() => handleCartClick(content, card)}>cart</button>
 *   if (card.showSmartActions) <SmartContentActions … />
 *   if (card.showOwnedBadge)   <OwnedBadge />
 *   if (card.showAccessibleBadge) <AccessibleBadge />
 *   if (card.showRestrictedBadge) <RestrictedBadge reason={card.restrictedReason!} />
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOwnedAssets } from './useOwnedAssets';
import { evaluateCardActions, type CardActions, type CardContent, type EvaluateOptions } from '@/services/rewards/cardAccess';

interface IntentEntry {
  contentId: string;
  contentTitle?: string;
  contentImage?: string;
  priceUsd?: number;
}

interface Options {
  personaId?: string | null;
  series?: string;
  /** Hook into the parent's purchase modal opener. */
  onOpenPurchase?: (intent: IntentEntry) => void;
  /** Hook into the parent's sign-in opener. */
  onOpenSignIn?: (postAuthIntent: IntentEntry) => void;
}

export function useCardAccess({ personaId, series = 'metaKnyts', onOpenPurchase, onOpenSignIn }: Options) {
  const { ownedSet, loading: ownedLoading, refresh: refreshOwned } = useOwnedAssets(personaId, series);

  // Pull credentials from /api/persona/credentials. Empty Set for anonymous.
  const [credentialList, setCredentialList] = useState<string[]>([]);
  useEffect(() => {
    if (!personaId) { setCredentialList([]); return; }
    let cancelled = false;
    fetch(`/api/persona/credentials?personaId=${encodeURIComponent(personaId)}`)
      .then((r) => r.ok ? r.json() : { credentials: [] })
      .then((d) => { if (!cancelled) setCredentialList(d.credentials ?? []); })
      .catch(() => { if (!cancelled) setCredentialList([]); });
    return () => { cancelled = true; };
  }, [personaId]);
  const credentials = useMemo(() => new Set(credentialList), [credentialList]);

  const evaluate = useCallback(
    (content: CardContent, options?: EvaluateOptions): CardActions => evaluateCardActions(content, {
      personaId: personaId ?? null,
      ownedAssets: ownedSet,
      credentials,
    }, options),
    [personaId, ownedSet, credentials],
  );

  const handleCartClick = useCallback(
    (content: CardContent, action: CardActions, intentExtra?: Partial<IntentEntry>) => {
      const intent: IntentEntry = {
        contentId: content.id,
        contentTitle: intentExtra?.contentTitle,
        contentImage: intentExtra?.contentImage,
        priceUsd: intentExtra?.priceUsd,
      };
      if (action.cartCtaTarget === 'sign-in') {
        // (A) intent preservation — pass the same intent through so the host
        // can re-open the purchase modal once the persona is created.
        onOpenSignIn?.(intent);
        return;
      }
      onOpenPurchase?.(intent);
    },
    [onOpenPurchase, onOpenSignIn],
  );

  return { evaluate, handleCartClick, ownedLoading, refreshOwned };
}
