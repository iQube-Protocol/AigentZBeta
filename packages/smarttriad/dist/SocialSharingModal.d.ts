/**
 * Social Sharing Modal Component
 * Provides comprehensive social media sharing options
 */
interface SocialSharingModalProps {
    isOpen: boolean;
    onClose: () => void;
    article: {
        id: string;
        title: string;
        description?: string;
        excerpt?: string;
        section?: string;
    };
    personaId?: string;
    onShare: (platform: string) => void;
}
export declare function SocialSharingModal({ isOpen, onClose, article, personaId, onShare }: SocialSharingModalProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=SocialSharingModal.d.ts.map