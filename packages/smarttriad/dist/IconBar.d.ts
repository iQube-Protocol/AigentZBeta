/**
 * IconBar - Left sidebar navigation with domain icons
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */
import type { Domain } from './types';
export interface IconBarProps {
    /** Primary navigation domains */
    domains: Domain[];
    /** System items (profile, settings, etc.) */
    systemItems?: Domain[];
    /** Currently active domain */
    activeDomain: string | null;
    /** Domain click handler */
    onDomainClick: (domainId: string) => void;
    /** Logo click handler */
    onLogoClick?: () => void;
    /** Custom logo element */
    logo?: React.ReactNode;
    /** Custom class names */
    className?: string;
}
export declare function IconBar({ domains, systemItems, activeDomain, onDomainClick, onLogoClick, logo, className, }: IconBarProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=IconBar.d.ts.map