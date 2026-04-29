"use client";

/**
 * SubHeaderSlot — lets a tab template inject pill/sub-menu content into the
 * cartridge sub-header's left side (where group sub-tabs would go for
 * grouped tabs). Standalone tabs (no group) leave the slot empty by default.
 *
 * Usage:
 *   - CodexPanelDynamic provides the slot element via context.
 *   - Tab components render their pills via createPortal(..., slotEl).
 */
import { createContext } from "react";

export const SubHeaderSlotContext = createContext<HTMLElement | null>(null);
