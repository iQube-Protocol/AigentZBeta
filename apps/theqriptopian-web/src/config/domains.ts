/**
 * The Qriptopian Domain Configuration - Published Issue #0
 * Maps content domains to SmartTriad navigation structure
 * 
 * CURRENT PUBLISHED STATE (v1.0):
 * - 3 active domains: PennyDrops, Scrolls, Kn0wdZ
 * - Hidden domains: Signals, StayBull (reserved for MoneyPenny franchise)
 */

import { Droplets, BookOpen, Code2, Zap, TrendingUp } from 'lucide-react';
import type { Domain } from '@agentiq/smarttriad';

/**
 * ACTIVE content domains for Issue #0
 * These appear in the published navigation menu
 */
export const PRIMARY_DOMAINS: Domain[] = [
  { 
    id: 'pennydrops', 
    icon: Droplets, 
    label: 'Penny Drops',
    color: 'cyan'
  },
  { 
    id: 'scrolls', 
    icon: BookOpen, 
    label: 'Scrolls',
    color: 'purple'
  },
  { 
    id: 'kn0wdz', 
    icon: Code2, 
    label: 'Kn0wdZ',
    color: 'blue'
  },
];

/**
 * HIDDEN domains (exist in code but filtered from menu)
 * These are available in admin but not published
 */
export const HIDDEN_DOMAINS: Domain[] = [
  { 
    id: 'signals', 
    icon: Zap, 
    label: 'Signals',
    color: 'yellow'
  },
  // Note: StayBull excluded entirely - reserved for MoneyPenny franchise
];

/**
 * All valid domain IDs for The Qriptopian Issue #0
 */
export type QriptopianDomain = 
  | 'pennydrops' 
  | 'scrolls' 
  | 'kn0wdz'
  | 'signals'; // exists but hidden
