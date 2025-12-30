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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#050f1f] border border-[#1e2b40] rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#1e2b40]">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">Q</span>
              </div>
              <h2 className="text-xl font-bold text-white">Share Article</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Article Preview */}
        <div className="p-6 border-b border-[#1e2b40]">
          <h3 className="font-medium text-white mb-2">{article.title}</h3>
          {article.description && (
            <p className="text-sm text-gray-300 line-clamp-2">{article.description}</p>
          )}
          {personaId && (
            <div className="mt-2">
              <span className="inline-block bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded border border-cyan-500/30">
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
                className={`${platform.color} text-white p-3 rounded-lg flex flex-col items-center space-y-2 transition-all transform hover:scale-105 hover:shadow-lg`}
              >
                <span className="text-2xl">{platform.icon}</span>
                <span className="text-sm font-medium">{platform.name}</span>
              </button>
            ))}
          </div>

          {/* Copy Link and Native Share */}
          <div className="flex gap-2">
            <button
              className="flex-1 bg-[#071327] border border-[#1e2b40] p-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#0a1a2f] transition-colors"
              onClick={handleCopyLink}
            >
              <span>📋</span>
              <span className="text-sm text-gray-300">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            
            {typeof navigator.share === 'function' && (
              <button
                className="bg-[#071327] border border-[#1e2b40] p-3 rounded-lg flex items-center justify-center hover:bg-[#0a1a2f] transition-colors"
                onClick={handleNativeShare}
              >
                <span>📱</span>
              </button>
            )}
          </div>

          {/* Deep Link Preview */}
          <div className="mt-4 p-3 bg-[#071327] border border-[#1e2b40] rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Deep Link:</p>
            <p className="text-xs text-gray-300 break-all">{deepLink}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
