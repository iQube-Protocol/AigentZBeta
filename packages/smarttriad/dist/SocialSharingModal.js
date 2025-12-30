/**
 * Social Sharing Modal Component
 * Provides comprehensive social media sharing options
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Twitter, Linkedin, Facebook, MessageCircle, Send, Mail } from 'lucide-react';
export function SocialSharingModal({ isOpen, onClose, article, personaId, onShare }) {
    const [copied, setCopied] = useState(false);
    const deepLink = generateArticleDeepLink(article, personaId);
    const shareText = article.description || article.excerpt || `Check out this article from Qriptopian`;
    const socialPlatforms = [
        {
            name: 'Twitter',
            icon: Twitter,
            color: 'bg-blue-500 hover:bg-blue-600',
            getUrl: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(deepLink)}`
        },
        {
            name: 'LinkedIn',
            icon: Linkedin,
            color: 'bg-blue-700 hover:bg-blue-800',
            getUrl: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(deepLink)}`
        },
        {
            name: 'Facebook',
            icon: Facebook,
            color: 'bg-blue-600 hover:bg-blue-700',
            getUrl: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepLink)}`
        },
        {
            name: 'WhatsApp',
            icon: MessageCircle,
            color: 'bg-green-500 hover:bg-green-600',
            getUrl: () => `https://wa.me/?text=${encodeURIComponent(`${shareText} ${deepLink}`)}`
        },
        {
            name: 'Telegram',
            icon: Send,
            color: 'bg-blue-400 hover:bg-blue-500',
            getUrl: () => `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`
        },
        {
            name: 'Email',
            icon: Mail,
            color: 'bg-gray-600 hover:bg-gray-700',
            getUrl: () => `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`${shareText}\n\n${deepLink}`)}`
        }
    ];
    const handleSocialShare = (platform, url) => {
        // Track the share
        onShare(platform);
        // Open the share URL
        window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
    };
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(deepLink);
            setCopied(true);
            onShare('clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
        catch (error) {
            console.error('Failed to copy link:', error);
        }
    };
    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: article.title,
                    text: shareText,
                    url: deepLink,
                });
                onShare('native');
                onClose();
            }
            catch (error) {
                if (error.name !== 'AbortError') {
                    console.warn('Native share failed:', error);
                }
            }
        }
    };
    return (_jsx(Dialog, { open: isOpen, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "sm:max-w-md", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "flex items-center gap-2", children: [_jsx(Share2, { className: "h-5 w-5" }), "Share this article"] }) }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "p-3 bg-gray-50 rounded-lg", children: [_jsx("h4", { className: "font-medium text-sm line-clamp-2", children: article.title }), _jsx("p", { className: "text-xs text-gray-600 mt-1 line-clamp-2", children: shareText }), personaId && (_jsxs(Badge, { variant: "secondary", className: "mt-2 text-xs", children: ["Persona: ", personaId] }))] }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: socialPlatforms.map((platform) => {
                                const Icon = platform.icon;
                                return (_jsxs(Button, { variant: "outline", className: `justify-start gap-2 ${platform.color} text-white border-none`, onClick: () => handleSocialShare(platform.name, platform.getUrl()), children: [_jsx(Icon, { className: "h-4 w-4" }), platform.name] }, platform.name));
                            }) }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", className: "flex-1", onClick: handleCopyLink, children: [_jsx(Copy, { className: "h-4 w-4 mr-2" }), copied ? 'Copied!' : 'Copy Link'] }), navigator.share && (_jsx(Button, { variant: "outline", onClick: handleNativeShare, children: _jsx(Share2, { className: "h-4 w-4" }) }))] }), _jsxs("div", { className: "p-2 bg-gray-100 rounded text-xs", children: [_jsx("p", { className: "font-medium mb-1", children: "Deep Link:" }), _jsx("p", { className: "text-gray-600 break-all", children: deepLink })] })] })] }) }));
}
function generateArticleDeepLink(article, personaId) {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
        id: article.id,
        title: article.title,
        section: article.section || 'unknown',
    });
    if (personaId) {
        params.append('persona', personaId);
    }
    return `${baseUrl}/article?${params.toString()}`;
}
