/**
 * CodexUploadModal - Admin interface for uploading content to Autonomys
 * 
 * Tabs:
 * - KNYT Codex: Upload metaKnyts episodes, covers, characters, lore
 * - Qriptopian Codex: Upload Qriptopian-specific content (future)
 * 
 * Features:
 * - Multi-file upload with progress
 * - Episode selection
 * - Asset type selection
 * - Cover variant configuration (rarity, edition limits)
 */

import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  X,
  Upload,
  FileText,
  Image,
  Video,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Users,
  Gamepad2,
  Share2,
  Sparkles,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type CodexTab = 'knyt' | 'qriptopian';

type MasterContentType = 'episode_still' | 'episode_motion' | 'episode_print';

type EditionTier = 'rare' | 'epic' | 'legendary';

type CodexAssetKind =
  | 'character_poster'
  | 'powers_sheet'
  | 'background_lore_doc'
  | 'game_concept_doc'
  | 'game_still'
  | 'game_video'
  | 'twenty_one_sats_concept'
  | 'social_campaign_video'
  | 'social_campaign_image'
  | 'cover_pdf'
  | 'cover_image';

type UploadCategory = 'master' | 'print' | 'cover' | 'character' | 'lore' | 'game' | 'social';

type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';

interface UploadItem {
  id: string;
  file: File;
  category: UploadCategory;
  assetKind?: CodexAssetKind;
  masterType?: MasterContentType;
  episodeNumber?: number | null;  // null = Series/Saga-wide content
  title: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: {
    id: string;
    cid: string;
  };
  // Cover-specific
  variantName?: string;
  rarityTier?: 'legendary' | 'rare' | 'common';
  editionMax?: number;
  // Print edition-specific
  editionTier?: EditionTier;
  // Lore-specific: how to display this content
  displayMode?: DisplayMode;
}

interface CodexUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Episodes use lore-based numbering: Episode #0 is the first episode
// DB stores 1-based (episode_number=1), display shows #0 (lore number)
// episode_number=0 or null = Series/Saga-wide content (not tied to specific episode)
const EPISODES: { number: number | null; title: string }[] = [
  { number: null, title: '📚 Series/Saga (All Episodes)' },
  ...Array.from({ length: 13 }, (_, i) => ({
    number: i + 1,  // DB episode_number (1-based)
    title: `Episode #${i}`,  // Lore-based display (#0 = first)
  })),
];

const ASSET_CATEGORIES: {
  id: UploadCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
  assetKinds: { value: CodexAssetKind | MasterContentType; label: string; accept: string }[];
}[] = [
  {
    id: 'print',
    label: 'Print Editions',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'Complete print comic PDFs (Rare, Epic, Legendary editions have different pages)',
    assetKinds: [
      { value: 'episode_print', label: 'Print Edition PDF', accept: '.pdf' },
    ],
  },
  {
    id: 'master',
    label: 'Motion Comics',
    icon: <Video className="w-5 h-5" />,
    description: 'Motion comic videos (covers are uploaded separately)',
    assetKinds: [
      { value: 'episode_motion', label: 'Motion Comic (Video)', accept: '.mp4,.webm,.mov' },
    ],
  },
  {
    id: 'cover',
    label: 'Covers',
    icon: <Image className="w-5 h-5" />,
    description: 'Limited edition cover variants',
    assetKinds: [
      { value: 'cover_pdf', label: 'Cover PDF', accept: '.pdf' },
      { value: 'cover_image', label: 'Cover Image', accept: '.png,.jpg,.jpeg,.webp' },
    ],
  },
  {
    id: 'character',
    label: 'Characters',
    icon: <Users className="w-5 h-5" />,
    description: 'Character posters and power sheets',
    assetKinds: [
      { value: 'character_poster', label: 'Character Poster', accept: '.png,.jpg,.jpeg,.webp,.pdf' },
      { value: 'powers_sheet', label: 'Powers Sheet', accept: '.pdf,.png,.jpg,.jpeg' },
    ],
  },
  {
    id: 'lore',
    label: 'Lore & Docs',
    icon: <FileText className="w-5 h-5" />,
    description: 'Background lore and concept documents. Choose "Extract Text" to make content available to copilot.',
    assetKinds: [
      { value: 'background_lore_doc', label: 'Background Lore', accept: '.pdf,.txt,.md' },
      { value: 'twenty_one_sats_concept', label: '21 Sats Concept', accept: '.pdf,.txt,.md' },
    ],
  },
  {
    id: 'game',
    label: 'Game Assets',
    icon: <Gamepad2 className="w-5 h-5" />,
    description: 'Game concepts, stills, and videos',
    assetKinds: [
      { value: 'game_concept_doc', label: 'Game Concept Doc', accept: '.pdf,.txt,.md' },
      { value: 'game_still', label: 'Game Still', accept: '.png,.jpg,.jpeg,.webp' },
      { value: 'game_video', label: 'Game Video', accept: '.mp4,.webm' },
    ],
  },
  {
    id: 'social',
    label: 'Social Media',
    icon: <Share2 className="w-5 h-5" />,
    description: 'Campaign images and videos for social sharing',
    assetKinds: [
      { value: 'social_campaign_image', label: 'Campaign Image', accept: '.png,.jpg,.jpeg,.webp,.gif' },
      { value: 'social_campaign_video', label: 'Campaign Video', accept: '.mp4,.webm' },
    ],
  },
];

const RARITY_TIERS = [
  { value: 'legendary', label: 'Legendary', weight: 1, color: 'text-yellow-400' },
  { value: 'rare', label: 'Rare', weight: 3, color: 'text-purple-400' },
  { value: 'common', label: 'Common', weight: 10, color: 'text-gray-400' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function CodexUploadModal({ isOpen, onClose, onUploadComplete }: CodexUploadModalProps) {
  const [activeTab, setActiveTab] = useState<CodexTab>('knyt');
  const [selectedCategory, setSelectedCategory] = useState<UploadCategory>('master');
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(1);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current category config
  const currentCategory = ASSET_CATEGORIES.find(c => c.id === selectedCategory)!;

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: UploadItem[] = files.map((file, index) => {
      const defaultAssetKind = currentCategory.assetKinds[0];
      const isMaster = selectedCategory === 'master';
      const isPrint = selectedCategory === 'print';
      const isCover = selectedCategory === 'cover';
      const isLore = selectedCategory === 'lore';

      return {
        id: `${Date.now()}-${index}`,
        file,
        category: selectedCategory,
        assetKind: (isMaster || isPrint) ? undefined : defaultAssetKind.value as CodexAssetKind,
        masterType: (isMaster || isPrint) ? defaultAssetKind.value as MasterContentType : undefined,
        episodeNumber: selectedEpisode,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        status: 'pending',
        progress: 0,
        // Cover defaults
        ...(isCover && {
          variantName: '',
          rarityTier: 'common' as const,
          editionMax: 100,
        }),
        // Print edition defaults
        ...(isPrint && {
          editionTier: 'rare' as EditionTier,
        }),
        // Lore defaults - default to text_extract for copilot integration
        ...(isLore && {
          displayMode: 'text_extract' as DisplayMode,
        }),
      };
    });

    setUploadQueue(prev => [...prev, ...newItems]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedCategory, selectedEpisode, currentCategory]);

  // Update upload item
  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // Remove item from queue
  const removeItem = useCallback((id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  // Upload single item
  const uploadItem = async (item: UploadItem): Promise<void> => {
    updateItem(item.id, { status: 'uploading', progress: 10 });

    try {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('title', item.title);
      formData.append('episodeNumber', String(item.episodeNumber || 0));
      formData.append('series', 'metaKnyts');

      let endpoint: string;

      if (item.category === 'master' || item.category === 'print') {
        endpoint = '/api/admin/codex/upload-master';
        formData.append('contentType', item.masterType || 'episode_motion');
        
        // Print edition-specific fields
        if (item.category === 'print' && item.editionTier) {
          formData.append('editionTier', item.editionTier);
        }
      } else {
        endpoint = '/api/admin/codex/upload-asset';
        formData.append('assetKind', item.assetKind || 'character_poster');
        
        // Cover-specific fields
        if (item.category === 'cover') {
          if (item.variantName) formData.append('variantName', item.variantName);
          if (item.rarityTier) formData.append('rarityTier', item.rarityTier);
          if (item.editionMax) formData.append('editionMax', String(item.editionMax));
        }
        
        // Lore-specific fields
        if (item.category === 'lore' && item.displayMode) {
          formData.append('displayMode', item.displayMode);
        }
      }

      updateItem(item.id, { progress: 30 });

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error('Unauthorized: please sign in again');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      updateItem(item.id, { progress: 80 });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      updateItem(item.id, {
        status: 'success',
        progress: 100,
        result: {
          id: result.id,
          cid: result.cid,
        },
      });
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  // Upload all pending items
  const uploadAll = async () => {
    setIsUploading(true);
    
    const pendingItems = uploadQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      await uploadItem(item);
    }
    
    setIsUploading(false);
    onUploadComplete?.();
  };

  // Clear completed items
  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(item => item.status !== 'success'));
  };

  if (!isOpen) return null;

  const pendingCount = uploadQueue.filter(i => i.status === 'pending').length;
  const successCount = uploadQueue.filter(i => i.status === 'success').length;
  const errorCount = uploadQueue.filter(i => i.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Codex Upload</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('knyt')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'knyt'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            KNYT Codex
          </button>
          <button
            onClick={() => setActiveTab('qriptopian')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'qriptopian'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Qriptopian Codex
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'knyt' ? (
            <div className="space-y-6">
              {/* Episode & Category Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Episode Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Episode / Scope
                  </label>
                  <select
                    value={selectedEpisode ?? 'saga'}
                    onChange={(e) => setSelectedEpisode(e.target.value === 'saga' ? null : Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {EPISODES.map(ep => (
                      <option key={ep.number ?? 'saga'} value={ep.number ?? 'saga'}>
                        {ep.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Asset Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as UploadCategory)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {ASSET_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category Description */}
              <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                {currentCategory.icon}
                <div>
                  <p className="text-white font-medium">{currentCategory.label}</p>
                  <p className="text-sm text-gray-400">{currentCategory.description}</p>
                </div>
              </div>

              {/* File Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-400/5 transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">
                  Click to select files or drag and drop
                </p>
                <p className="text-sm text-gray-400">
                  Accepted: {currentCategory.assetKinds.map(k => k.accept).join(', ')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={currentCategory.assetKinds.map(k => k.accept).join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Upload Queue */}
              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-300">
                      Upload Queue ({uploadQueue.length})
                    </h3>
                    {successCount > 0 && (
                      <button
                        onClick={clearCompleted}
                        className="text-sm text-gray-400 hover:text-white"
                      >
                        Clear completed
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {uploadQueue.map(item => (
                      <UploadQueueItem
                        key={item.id}
                        item={item}
                        category={currentCategory}
                        onUpdate={(updates) => updateItem(item.id, updates)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Qriptopian Codex Coming Soon
              </h3>
              <p className="text-gray-400 max-w-md">
                The Qriptopian Codex will support uploading Qriptopian-specific content, 
                including world-building documents, character profiles, and interactive experiences.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'knyt' && uploadQueue.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center gap-4 text-sm">
              {pendingCount > 0 && (
                <span className="text-gray-400">{pendingCount} pending</span>
              )}
              {successCount > 0 && (
                <span className="text-green-400">{successCount} uploaded</span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400">{errorCount} failed</span>
              )}
            </div>
            <button
              onClick={uploadAll}
              disabled={isUploading || pendingCount === 0}
              className="flex items-center gap-2 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload All ({pendingCount})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// UPLOAD QUEUE ITEM
// =============================================================================

interface UploadQueueItemProps {
  item: UploadItem;
  category: typeof ASSET_CATEGORIES[0];
  onUpdate: (updates: Partial<UploadItem>) => void;
  onRemove: () => void;
}

const EDITION_TIERS: { value: EditionTier; label: string; color: string }[] = [
  { value: 'rare', label: 'Rare', color: 'text-blue-400' },
  { value: 'epic', label: 'Epic', color: 'text-purple-400' },
  { value: 'legendary', label: 'Legendary', color: 'text-amber-400' },
];

const DISPLAY_MODES: { value: DisplayMode; label: string; description: string }[] = [
  { value: 'text_extract', label: 'Extract Text', description: 'Extract text for copilot & display as formatted text' },
  { value: 'pdf', label: 'PDF Viewer', description: 'Display as PDF document' },
  { value: 'image', label: 'Image', description: 'Display as image' },
  { value: 'video', label: 'Video', description: 'Display as video' },
];

function UploadQueueItem({ item, category, onUpdate, onRemove }: UploadQueueItemProps) {
  const isCover = item.category === 'cover';
  const isMaster = item.category === 'master';
  const isPrint = item.category === 'print';
  const isLore = item.category === 'lore';

  return (
    <div className={`p-4 rounded-lg border ${
      item.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
      item.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
      item.status === 'uploading' ? 'bg-cyan-500/10 border-cyan-500/30' :
      'bg-gray-800 border-gray-700'
    }`}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="mt-1">
          {item.status === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : item.status === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : item.status === 'uploading' ? (
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          ) : (
            <FileIcon mimeType={item.file.type} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Input */}
          <input
            type="text"
            value={item.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            disabled={item.status !== 'pending'}
            className="w-full bg-transparent text-white font-medium focus:outline-none disabled:opacity-50"
            placeholder="Enter title..."
          />
          
          <div className="flex items-center gap-4 mt-2 text-sm">
            {/* File info */}
            <span className="text-gray-400">
              {(item.file.size / 1024 / 1024).toFixed(2)} MB
            </span>
            
            {/* Episode - show lore-based number (#0 = first) or Series/Saga */}
            <span className="text-gray-400">
              {item.episodeNumber ? `Ep. #${item.episodeNumber - 1}` : '📚 Series'}
            </span>

            {/* Asset Type Selector (for non-print categories) */}
            {item.status === 'pending' && !isPrint && (
              <select
                value={isMaster ? item.masterType : item.assetKind}
                onChange={(e) => {
                  if (isMaster) {
                    onUpdate({ masterType: e.target.value as MasterContentType });
                  } else {
                    onUpdate({ assetKind: e.target.value as CodexAssetKind });
                  }
                }}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300 text-xs"
              >
                {category.assetKinds.map(kind => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            )}
            
            {/* Edition Tier Selector (for print editions) */}
            {item.status === 'pending' && isPrint && (
              <select
                value={item.editionTier || 'rare'}
                onChange={(e) => onUpdate({ editionTier: e.target.value as EditionTier })}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-300 text-xs"
              >
                {EDITION_TIERS.map(tier => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cover-specific fields */}
          {isCover && item.status === 'pending' && (
            <div className="flex items-center gap-3 mt-3">
              <input
                type="text"
                value={item.variantName || ''}
                onChange={(e) => onUpdate({ variantName: e.target.value })}
                placeholder="Variant name"
                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
              <select
                value={item.rarityTier}
                onChange={(e) => onUpdate({ rarityTier: e.target.value as 'legendary' | 'rare' | 'common' })}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                {RARITY_TIERS.map(tier => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={item.editionMax || ''}
                onChange={(e) => onUpdate({ editionMax: Number(e.target.value) || undefined })}
                placeholder="Max"
                className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          )}

          {/* Lore-specific fields - Display Mode */}
          {isLore && item.status === 'pending' && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-gray-400">Display as:</span>
              <select
                value={item.displayMode || 'text_extract'}
                onChange={(e) => onUpdate({ displayMode: e.target.value as DisplayMode })}
                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                {DISPLAY_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              {item.displayMode === 'text_extract' && (
                <span className="text-xs text-cyan-400">✓ Copilot enabled</span>
              )}
            </div>
          )}

          {/* Error message */}
          {item.status === 'error' && item.error && (
            <p className="text-red-400 text-sm mt-2">{item.error}</p>
          )}

          {/* Success info */}
          {item.status === 'success' && item.result && (
            <p className="text-green-400 text-sm mt-2 font-mono truncate">
              CID: {item.result.cid}
            </p>
          )}

          {/* Progress bar */}
          {item.status === 'uploading' && (
            <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Remove button */}
        {item.status === 'pending' && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FILE ICON
// =============================================================================

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) {
    return <Image className="w-5 h-5 text-purple-400" />;
  }
  if (mimeType.startsWith('video/')) {
    return <Video className="w-5 h-5 text-blue-400" />;
  }
  return <FileText className="w-5 h-5 text-gray-400" />;
}

export default CodexUploadModal;
