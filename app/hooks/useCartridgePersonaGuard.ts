"use client";

/**
 * useCartridgePersonaGuard
 *
 * Compares the currently active persona against the user's saved default for a
 * given cartridge slug.  When they differ, returns mismatch=true so the caller
 * can render a lightweight prompt.
 *
 * Dismissal is session-scoped (sessionStorage) so the prompt doesn't reappear
 * on every tab switch within the same browser session.
 */

import { useCallback, useEffect, useState } from "react";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";

interface CartridgePersonaGuardResult {
  /** True when there is a saved default that differs from the active persona. */
  mismatch: boolean;
  /** The personaId the user previously set as default for this cartridge. */
  suggestedPersonaId: string | null;
  /** Display label for the suggested persona (from registry, or truncated ID). */
  suggestedLabel: string | null;
  /** Display label for the currently active persona. */
  activeLabel: string | null;
  /** Switch to the suggested persona and clear the mismatch. */
  acceptSwitch: () => void;
  /** Dismiss the prompt for this browser session without switching. */
  dismiss: () => void;
}

function sessionKey(slug: string) {
  return `persona_guard_dismissed_${slug}`;
}

export function useCartridgePersonaGuard(
  cartridgeSlug: string | undefined
): CartridgePersonaGuardResult {
  const {
    activePersonaId,
    setActivePersonaId,
    getCartridgeDefault,
    personaDisplayNames,
  } = usePersonaSafe();

  const [dismissed, setDismissed] = useState(false);

  // Re-check sessionStorage on slug change (handles navigating between cartridges)
  useEffect(() => {
    if (!cartridgeSlug) {
      setDismissed(false);
      return;
    }
    setDismissed(!!sessionStorage.getItem(sessionKey(cartridgeSlug)));
  }, [cartridgeSlug]);

  const suggestedPersonaId = cartridgeSlug ? getCartridgeDefault(cartridgeSlug) : null;

  const mismatch =
    !dismissed &&
    !!suggestedPersonaId &&
    !!activePersonaId &&
    suggestedPersonaId !== activePersonaId;

  const labelFor = (id: string | null) => {
    if (!id) return null;
    return personaDisplayNames[id] || id.slice(0, 8) + "…";
  };

  const acceptSwitch = useCallback(() => {
    if (suggestedPersonaId) setActivePersonaId(suggestedPersonaId);
    setDismissed(true);
    if (cartridgeSlug) sessionStorage.setItem(sessionKey(cartridgeSlug), "1");
  }, [suggestedPersonaId, setActivePersonaId, cartridgeSlug]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (cartridgeSlug) sessionStorage.setItem(sessionKey(cartridgeSlug), "1");
  }, [cartridgeSlug]);

  return {
    mismatch,
    suggestedPersonaId,
    suggestedLabel: labelFor(suggestedPersonaId),
    activeLabel: labelFor(activePersonaId),
    acceptSwitch,
    dismiss,
  };
}
