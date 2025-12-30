/**
 * Social Sharing Modal - Simple version without UI dependencies
 * Provides platform-specific sharing URLs and functionality
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function SocialSharingModal({ isOpen, onClose, article, personaId, onShare }) {
    const [copied, setCopied] = useState(false);
    if (!isOpen)
        return null;
    // Generate deep link with persona tracking
    const deepLink = `${window.location.origin}/article?id=${article.id}&title=${encodeURIComponent(article.title)}${personaId ? `&persona=${personaId}` : ''}${article.section ? `&section=${article.section}` : ''}`;
    const shareText = `Check out this article: ${article.title}${article.description ? ` - ${article.description}` : ''}`;
    // Social platforms configuration
    const socialPlatforms = [
        {
            name: 'Twitter',
            icon: '🐦',
            color: 'bg-blue-400 hover:bg-blue-500',
            getUrl: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${deepLink}`)}`
        },
        {
            name: 'LinkedIn',
            icon: '💼',
            color: 'bg-blue-700 hover:bg-blue-800',
            getUrl: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(deepLink)}`
        },
        {
            name: 'Facebook',
            icon: '📘',
            color: 'bg-blue-600 hover:bg-blue-700',
            getUrl: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepLink)}`
        },
        {
            name: 'WhatsApp',
            icon: '💬',
            color: 'bg-green-500 hover:bg-green-600',
            getUrl: () => `https://wa.me/?text=${encodeURIComponent(`${shareText} ${deepLink}`)}`
        },
        {
            name: 'Telegram',
            icon: '✈️',
            color: 'bg-blue-400 hover:bg-blue-500',
            getUrl: () => `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`
        },
        {
            name: 'Email',
            icon: '📧',
            color: 'bg-gray-600 hover:bg-gray-700',
            getUrl: () => `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`${shareText} ${deepLink}`)}`
        }
    ];
    const handleShare = (platform, url) => {
        if (onShare) {
            onShare(platform);
        }
        window.open(url, '_blank', 'width=600,height=400');
    };
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(deepLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy link:', err);
        }
    };
    const handleNativeShare = async () => {
        try {
            await navigator.share({
                title: article.title,
                text: shareText,
                url: deepLink,
            });
            if (onShare) {
                onShare('native');
            }
        }
        catch (err) {
            console.error('Native share failed:', err);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsx("div", { className: "p-6 border-b", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h2", { className: "text-xl font-bold", children: "Share Article" }), _jsx("button", { onClick: onClose, className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }) }), _jsxs("div", { className: "p-6 border-b", children: [_jsx("h3", { className: "font-medium mb-2", children: article.title }), article.description && (_jsx("p", { className: "text-sm text-gray-600 line-clamp-2", children: article.description })), personaId && (_jsx("div", { className: "mt-2", children: _jsxs("span", { className: "inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded", children: ["Shared via persona: ", personaId] }) }))] }), _jsxs("div", { className: "p-6", children: [_jsx("div", { className: "grid grid-cols-2 gap-3 mb-6", children: socialPlatforms.map((platform) => (_jsxs("button", { onClick: () => handleShare(platform.name, platform.getUrl()), className: `${platform.color} text-white p-3 rounded-lg flex flex-col items-center space-y-2 transition-colors`, children: [_jsx("span", { className: "text-2xl", children: platform.icon }), _jsx("span", { className: "text-sm font-medium", children: platform.name })] }, platform.name))) }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { className: "flex-1 border border-gray-300 p-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-50", onClick: handleCopyLink, children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsx("span", { className: "text-sm", children: copied ? 'Copied!' : 'Copy Link' })] }), typeof navigator.share === 'function' && (_jsx("button", { className: "border border-gray-300 p-3 rounded-lg flex items-center justify-center hover:bg-gray-50", onClick: handleNativeShare, children: _jsx("span", { children: "\uD83D\uDCF1" }) }))] }), _jsxs("div", { className: "mt-4 p-3 bg-gray-50 rounded-lg", children: [_jsx("p", { className: "text-xs text-gray-500 mb-1", children: "Deep Link:" }), _jsx("p", { className: "text-xs text-gray-700 break-all", children: deepLink })] })] })] }) }));
}
