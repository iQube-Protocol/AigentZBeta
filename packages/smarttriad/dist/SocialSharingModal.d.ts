/**
 * Social Sharing Modal - Simple version without UI dependencies
 * Provides platform-specific sharing URLs and functionality
 */
interface SocialSharingModalProps {
    isOpen: boolean;
    onClose: () => void;
    article: {
        id: string;
        title: string;
        description?: string;
        section?: string;
        type?: 'text' | 'video';
    };
    personaId?: string;
    onShare?: (platform: string) => void;
}
export declare function SocialSharingModal({ isOpen, onClose, article, personaId, onShare }: SocialSharingModalProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=SocialSharingModal.d.ts.map