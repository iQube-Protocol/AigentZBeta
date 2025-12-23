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
//# sourceMappingURL=types.d.ts.map