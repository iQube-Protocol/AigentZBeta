/**
 * Smart Layout System - Core Types
 * 
 * Defines drawer sizes, menu behaviors, and layout primitives
 * for the Smart Triad orchestration system.
 */

import { ReactNode } from "react";

/**
 * Drawer size variants
 * 
 * Six layout modes for different interaction contexts:
 * 
 * @wallet-narrow - ~360px slim right panel for quick wallet glances
 * @wallet-wide - ~640px wider panel for wallet + Copilot/SmartTriad  
 * @panel-3q - ~75vw right-anchored content canvas (Qriptopian Scrolls, Kn0wdZ)
 *            Menu remains visible on the right
 * @immersive-3q - Hero + feed layout (metaKnyts episodes with carousel underneath)
 * @modal-centered - Centered 3/4 overlay that sits ABOVE menu (MoneyPenny Portfolio, MetaVatar)
 *                  Menu hidden behind for immersive focus
 * @full-immersive - Fullscreen overlay (cinema, motion comics, gaming)
 */
export type DrawerSize =
  | "wallet-narrow"
  | "wallet-wide"
  | "panel-3q"
  | "immersive-3q"
  | "modal-centered"
  | "full-immersive";

/**
 * Smart Menu behavior modes
 * 
 * @fixed-rail - Always visible vertical rail (Qriptopian default)
 * @floating-rail - Floats above content with glassmorphism
 * @collapsed-pill - Single icon that expands on hover/tap
 * @auto-hide - Hides after inactivity, reappears on edge hover
 */
export type MenuMode =
  | "fixed-rail"
  | "floating-rail"
  | "collapsed-pill"
  | "auto-hide";

/**
 * Smart Menu behavior configuration
 */
export interface SmartMenuBehavior {
  /** Display mode */
  mode: MenuMode;
  
  /** Side placement (metaKnyts=left, Qriptopian/MoneyPenny=right) */
  side?: "left" | "right";
  
  /** Auto-hide delay in milliseconds */
  autoHideAfterMs?: number;
  
  /** Show when cursor approaches edge */
  showOnMoveEdge?: boolean;
  
  /** Mobile-specific placement */
  mobilePlacement?: "bottom" | "right" | "hidden-until-tap";
}

/**
 * Smart Menu item definition
 */
export interface SmartMenuItem {
  id: string;
  icon: ReactNode;
  label: string;
  tooltip?: string;
  badge?: string | number;
  disabled?: boolean;
}

/**
 * Z-index constants for proper layering
 */
export const SMART_LAYOUT_Z_INDEX = {
  /** Top header */
  HEADER: 40,
  
  /** Backdrop for drawers */
  BACKDROP: 40,
  
  /** Standard drawers (wallet, panel-3q, immersive-3q) */
  DRAWER: 50,
  
  /** Menu rail (sits above standard drawers) */
  MENU_RAIL: 50,
  
  /** Mobile nav backdrop */
  MOBILE_BACKDROP: 60,
  
  /** Centered modals (above menu) */
  MODAL_CENTERED: 60,
  
  /** Mobile nav */
  MOBILE_NAV: 70,
  
  /** Fullscreen overlays (cinema, metaAvatar) */
  FULL_IMMERSIVE: 100,
} as const;

/**
 * Responsive breakpoints (Tailwind defaults)
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,   // md:
  desktop: 1024, // lg:
} as const;
