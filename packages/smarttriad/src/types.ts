/**
 * SmartTriad Types
 * Domain-driven navigation primitives for AgentiQ franchises
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Domain definition for IconBar navigation
 */
export interface Domain {
  /** Unique identifier for the domain */
  id: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display label */
  label: string;
  /** Theme color (tailwind color name) */
  color?: string;
}

/**
 * Drawer tab configuration
 */
export interface DrawerTab {
  /** Tab identifier */
  id: string;
  /** Tab label */
  label: string;
}

/**
 * Drawer layout column options
 */
export type DrawerColumns = 1 | 2 | 3;

/**
 * IconBar configuration
 */
export interface IconBarConfig {
  /** Primary domains for main navigation */
  domains: Domain[];
  /** System items (profile, settings, etc.) */
  systemItems?: Domain[];
  /** Active domain ID */
  activeDomain: string | null;
  /** Domain click handler */
  onDomainClick: (domainId: string) => void;
  /** Logo click handler */
  onLogoClick?: () => void;
}

/**
 * DrawerLayer configuration
 */
export interface DrawerLayerConfig {
  /** Whether drawer is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Drawer title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Column layout */
  columns?: DrawerColumns;
  /** Optional tabs */
  tabs?: DrawerTab[];
  /** Drawer content */
  children: ReactNode;
}

// ========================================
// SmartContent Types (Ported from Netlify)
// ========================================

/**
 * ContentModalities - Defines available content consumption modes
 * Each modality should only be present if the content actually supports it
 */
export interface ContentModalities {
  read?: { 
    text?: string; 
    available?: boolean; 
    cid?: string; 
    duration?: string;
    html?: string;
  };
  watch?: { 
    video_url?: string; 
    available?: boolean; 
    cid?: string; 
    duration?: string; 
    thumbnail?: string; 
    type?: string;
  };
  listen?: { 
    audio_url: string; 
    duration?: string; 
    cover_image?: string;
  };
  link?: { 
    url: string; 
    allow_embed?: boolean;
  };
  view?: { 
    image_url?: string;
  };
}

export type ActionType = 'read' | 'watch' | 'listen' | 'link' | 'view' | 'expand' | 'share' | 'buy';

/**
 * ContentContext - Determines which actions are contextually appropriate
 */
export type ContentContext = 'thumbnail' | 'hero' | 'card' | 'fullscreen' | 'drawer';

/**
 * SmartContentItem - Core content item interface
 */
export interface SmartContentItem {
  id: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  modalities?: ContentModalities | null;
  section?: string;
  // PDF support
  pdf_cid?: string;
  pdf_master_id?: string;
  // Additional metadata
  type?: string;
  created_at?: string;
  updated_at?: string;
  // Payment support
  price?: {
    amount: number;        // Price in Q¢ (QriptoCENT)
    currency: 'Q¢';       // Always QriptoCENT
    paymentType: 'one-time' | 'subscription';
  };
  paymentMetadata?: {
    productId?: string;
    tenantId?: string;
    revenueShare?: number;
    paymentSurface?: 'liquid' | 'embedded' | 'overlay'; // Preferred payment surface
  };
}
