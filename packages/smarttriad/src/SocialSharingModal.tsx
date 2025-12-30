/**
 * Social Sharing Modal - Simple version without UI dependencies
 * Provides platform-specific sharing URLs and functionality
 */

'use client';

import React, { useState } from 'react';

interface SocialSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    id: string;
    title: string;
    description?: string;
    section?: string;
  };
  personaId?: string;
  onShare?: (platform: string) => void;
}

export function SocialSharingModal({ 
  isOpen, 
  onClose, 
  article, 
  personaId, 
  onShare 
}: SocialSharingModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

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

  const handleShare = (platform: string, url: string) => {
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
    } catch (err) {
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
    } catch (err) {
      console.error('Native share failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Share Article</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Article Preview */}
        <div className="p-6 border-b">
          <h3 className="font-medium mb-2">{article.title}</h3>
          {article.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{article.description}</p>
          )}
          {personaId && (
            <div className="mt-2">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                Shared via persona: {personaId}
              </span>
            </div>
          )}
        </div>

        {/* Social Platforms */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {socialPlatforms.map((platform) => (
              <button
                key={platform.name}
                onClick={() => handleShare(platform.name, platform.getUrl())}
                className={`${platform.color} text-white p-3 rounded-lg flex flex-col items-center space-y-2 transition-colors`}
              >
                <span className="text-2xl">{platform.icon}</span>
                <span className="text-sm font-medium">{platform.name}</span>
              </button>
            ))}
          </div>

          {/* Copy Link and Native Share */}
          <div className="flex gap-2">
            <button
              className="flex-1 border border-gray-300 p-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-50"
              onClick={handleCopyLink}
            >
              <span>📋</span>
              <span className="text-sm">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            
            {typeof navigator.share === 'function' && (
              <button
                className="border border-gray-300 p-3 rounded-lg flex items-center justify-center hover:bg-gray-50"
                onClick={handleNativeShare}
              >
                <span>📱</span>
              </button>
            )}
          </div>

          {/* Deep Link Preview */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Deep Link:</p>
            <p className="text-xs text-gray-700 break-all">{deepLink}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
