/**
 * DrawerLayer - Base drawer component for domain content
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */
import type { DrawerTab, DrawerColumns } from './types';
export interface DrawerLayerProps {
    /** Whether drawer is open */
    isOpen: boolean;
    /** Close handler */
    onClose: () => void;
    /** Drawer title */
    title: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Column layout (1, 2, or 3) */
    columns?: DrawerColumns;
    /** Optional tabs */
    tabs?: DrawerTab[];
    /** Active tab ID (controlled) */
    activeTabId?: string;
    /** Tab change handler */
    onTabChange?: (tabId: string) => void;
    /** Drawer content */
    children: React.ReactNode;
    /** Custom class names */
    className?: string;
}
export declare function DrawerLayer({ isOpen, onClose, title, subtitle, columns, tabs, activeTabId, onTabChange, children, className, }: DrawerLayerProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=DrawerLayer.d.ts.map