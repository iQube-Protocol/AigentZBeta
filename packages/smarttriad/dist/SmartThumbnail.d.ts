/**
 * SmartThumbnail - Reusable thumbnail component for SmartTriad content
 * Provides consistent thumbnail rendering with optional action overlay
 */
import type { ReactNode } from 'react';
export interface SmartThumbnailProps {
    /** Unique identifier */
    id: string;
    /** Thumbnail image URL */
    image: string;
    /** Alt text for image */
    title: string;
    /** Optional badge text */
    badge?: string;
    /** Badge color class (default: cyan) */
    badgeColor?: string;
    /** Aspect ratio class (default: aspect-video) */
    aspectRatio?: string;
    /** Whether this thumbnail is selected/active */
    isSelected?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Optional actions overlay (render prop for SmartContentActions) */
    actions?: ReactNode;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Custom class names */
    className?: string;
    /** Show title overlay */
    showTitle?: boolean;
}
export declare function SmartThumbnail({ id, image, title, badge, badgeColor, aspectRatio, isSelected, onClick, actions, size, className, showTitle, }: SmartThumbnailProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=SmartThumbnail.d.ts.map