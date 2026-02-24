/**
 * VideoModal - Fullscreen video player with carousel navigation
 * Part of @agentiq/smarttriad system for estate-wide use
 */
export interface VideoItem {
    id: string;
    title: string;
    videoUrl: string;
    duration?: string;
}
export interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: VideoItem[];
    initialIndex?: number;
}
export declare function VideoModal({ isOpen, onClose, items, initialIndex }: VideoModalProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=VideoModal.d.ts.map