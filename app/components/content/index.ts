"use client";

/**
 * Smart Content UI Components
 * 
 * Components for displaying and interacting with SmartContentQubes:
 * - SmartContentCard: Content cards in various layouts
 * - ContentViewer: Multi-modality content viewer
 * - LibraryShelf: User library management
 * - SmartWalletDrawer: Enhanced wallet with content context
 * - SmartTriadProvider: Context coordinating Content + Wallet + Menu
 */

export { default as SmartContentCard } from './SmartContentCard';
export { default as ContentViewer } from './ContentViewer';
export { default as LibraryShelf } from './LibraryShelf';
export { default as SmartWalletDrawer } from './SmartWalletDrawer';
export { SmartTriadSurfaces } from './SmartTriadSurfaces';
export {
  SmartTriadProvider,
  useSmartTriad,
  useOptionalSmartTriad,
  useTriadContent,
  useTriadWallet,
  useTriadMenu,
  useTriadPurchase,
  useTriadLibrary,
  useTriadShare,
} from './SmartTriadProvider';
export type { ShareItem } from './SmartTriadProvider';
export { default as ContentCopilotPanel } from './ContentCopilotPanel';
export { ContentActionIcons } from './ContentActionIcons';
export type { ContentActionIconsProps, ContentModalityState, IconStyle } from './ContentActionIcons';
