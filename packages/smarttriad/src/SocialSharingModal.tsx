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
    type?: 'text' | 'video';
    url?: string;
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
  const [shareId] = useState(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `share_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  });

  if (!isOpen) return null;

  // Build the canonical content landing URL
  const contentUrl = new URL(`${window.location.origin}/article`);
  contentUrl.searchParams.set('id', article.id);
  contentUrl.searchParams.set('title', article.title);
  if (article.section) contentUrl.searchParams.set('section', article.section);
  if (article.type) contentUrl.searchParams.set('type', article.type);
  if (personaId) contentUrl.searchParams.set('persona', personaId);
  if (shareId) contentUrl.searchParams.set('shareId', shareId);

  // Route through the social track redirect so clicks are recorded server-side
  const trackUrl = new URL(`${window.location.origin}/api/social/track`);
  trackUrl.searchParams.set('s', shareId);
  trackUrl.searchParams.set('r', contentUrl.toString());

  const deepLink = trackUrl.toString();
  
  const shareText = `Check out this article: ${article.title}${article.description ? ` - ${article.description}` : ''}`;

  // Social platforms configuration with SVG logos
  const socialPlatforms = [
    {
      name: 'X',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'bg-black hover:bg-gray-900',
      getUrl: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(deepLink)}`
    },
    {
      name: 'LinkedIn',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      color: 'bg-[#0077b5] hover:bg-[#006399]',
      getUrl: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(deepLink)}`
    },
    {
      name: 'Facebook',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: 'bg-[#1877f2] hover:bg-[#166fe5]',
      getUrl: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepLink)}`
    },
    {
      name: 'WhatsApp',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      ),
      color: 'bg-[#25d366] hover:bg-[#20bd5a]',
      getUrl: () => `https://wa.me/?text=${encodeURIComponent(`${shareText} ${deepLink}`)}`
    },
    {
      name: 'Telegram',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      color: 'bg-[#0088cc] hover:bg-[#0077b3]',
      getUrl: () => `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Discord',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.369A19.791 19.791 0 0 0 15.949 3a14.033 14.033 0 0 0-.699 1.442 18.688 18.688 0 0 0-5.5 0A14.4 14.4 0 0 0 9.05 3a19.736 19.736 0 0 0-4.37 1.37C1.884 8.446 1.052 12.417 1.39 16.34A19.962 19.962 0 0 0 7.5 19.5a14.35 14.35 0 0 0 1.233-2.02 12.979 12.979 0 0 1-1.942-.938c.164-.118.324-.241.478-.37a13.725 13.725 0 0 0 9.462 0c.156.13.316.253.482.372a12.926 12.926 0 0 1-1.946.936 14.36 14.36 0 0 0 1.233 2.02 19.94 19.94 0 0 0 6.11-3.16c.413-4.523-.74-8.463-2.293-11.971zM8.02 14.34c-1.183 0-2.156-1.085-2.156-2.42 0-1.336.952-2.42 2.156-2.42 1.21 0 2.17 1.094 2.156 2.42 0 1.335-.952 2.42-2.156 2.42zm7.965 0c-1.183 0-2.156-1.085-2.156-2.42 0-1.336.952-2.42 2.156-2.42 1.21 0 2.17 1.094 2.156 2.42 0 1.335-.946 2.42-2.156 2.42z"/>
        </svg>
      ),
      color: 'bg-[#5865F2] hover:bg-[#4c59d9]',
      getUrl: () => `https://discord.com/channels/@me?message=${encodeURIComponent(`${shareText} ${deepLink}`)}`
    },
    {
      name: 'TikTok',
      logo: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.706 5.998a4.862 4.862 0 0 1-1.302-3.483h-2.922v12.22a2.59 2.59 0 1 1-2.598-2.59c.25 0 .487.038.712.108V9.33a5.447 5.447 0 0 0-.712-.046 5.512 5.512 0 1 0 5.52 5.512V8.916a7.646 7.646 0 0 0 4.24 1.28V7.31a4.88 4.88 0 0 1-2.938-1.312z"/>
        </svg>
      ),
      color: 'bg-[#010101] hover:bg-[#111111]',
      getUrl: () => `https://www.tiktok.com/share?url=${encodeURIComponent(deepLink)}&title=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Instagram',
      logo: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 3C4.794 3 3 4.794 3 7v10c0 2.206 1.794 4 4 4h10c2.206 0 4-1.794 4-4V7c0-2.206-1.794-4-4-4H7zm10 2c1.103 0 2 .897 2 2v10c0 1.103-.897 2-2 2H7c-1.103 0-2-.897-2-2V7c0-1.103.897-2 2-2h10zm-5 2.5A4.5 4.5 0 1 0 16.5 12 4.505 4.505 0 0 0 12 7.5zm0 2A2.5 2.5 0 1 1 9.5 12 2.503 2.503 0 0 1 12 9.5zM17.5 6.5A1 1 0 1 0 18.5 7.5 1 1 0 0 0 17.5 6.5z"/>
        </svg>
      ),
      color: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#515bd4]',
      getUrl: () => `https://www.instagram.com/?url=${encodeURIComponent(deepLink)}`
    },
    {
      name: 'Email',
      logo: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-gray-600 hover:bg-gray-700',
      getUrl: () => `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`${shareText}\n\n${deepLink}`)}`
    }
  ];

  const handleShare = (platform: string, url: string) => {
    if (onShare) {
      onShare(platform);
    }

    if (shareId) {
      fetch('/api/social/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId,
          personaId,
          contentId: article.id,
          platform,
          eventType: 'create',
        }),
      }).catch(() => {});
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
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[60] p-4">
      <div className="bg-[#050f1f] border border-[#1e2b40] rounded-none md:rounded-xl w-full h-full md:h-auto md:max-w-[896px] md:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-[#1e2b40]">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">Q</span>
              </div>
              <h2 className="text-xl font-bold text-white">Share Article</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/50 border border-white/20 text-gray-300 hover:text-white hover:bg-black/70 transition-colors flex items-center justify-center"
              aria-label="Close sharing modal"
            >
              ×
            </button>
          </div>
        </div>

        {/* Article Preview */}
        <div className="p-4 md:p-6 border-b border-[#1e2b40]">
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
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-3 gap-2 mb-6">
            {socialPlatforms.map((platform) => (
              <button
                key={platform.name}
                onClick={() => handleShare(platform.name, platform.getUrl())}
                className={`${platform.color} text-white p-3 rounded-lg flex flex-col items-center space-y-1 transition-all transform hover:scale-105 hover:shadow-lg`}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {platform.logo}
                </div>
                <span className="text-xs font-medium">{platform.name}</span>
              </button>
            ))}
          </div>

          {/* Copy Link and Native Share */}
          <div className="flex gap-2">
            <button
              className="flex-1 bg-[#071327] border border-[#1e2b40] p-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#0a1a2f] transition-colors"
              onClick={handleCopyLink}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-300">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            
            {typeof navigator.share === 'function' && (
              <button
                className="bg-[#071327] border border-[#1e2b40] p-3 rounded-lg flex items-center justify-center hover:bg-[#0a1a2f] transition-colors"
                onClick={handleNativeShare}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
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
