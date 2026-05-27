'use client';

import { useCallback, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/utils/supabaseBrowser';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle,
  FileText,
  Gamepad2,
  Image,
  Loader2,
  Package,
  Share2,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type CodexTab = 'knyt' | 'qriptopian';
type UploadCategory = 'master' | 'still' | 'print' | 'cover' | 'motion-covers' | 'character' | 'lore' | 'game' | 'social' | 'bundle' | 'rabadges';
type MasterContentType = 'episode_still' | 'episode_motion' | 'episode_print';
type EditionTier = 'rare' | 'epic' | 'legendary' | 'common';
type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';
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
  | 'cover_image'
  | 'cover_motion'
  | 'bundle_pack'
  | 'ra_badge';

interface UploadItem {
  id: string;
  file: File;
  category: UploadCategory;
  assetKind?: CodexAssetKind;
  masterType?: MasterContentType;
  episodeNumber?: number | null;
  title: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: { id: string; cid: string };
  variantName?: string;
  rarityTier?: 'legendary' | 'epic' | 'rare' | 'common';
  editionMax?: number;
  editionTier?: EditionTier;
  displayMode?: DisplayMode;
  // ── Qriptopian-only fields ─────────────────────────────────────────────
  // Stamped by handleQriptoFileSelect so the queue row can branch its
  // dropdown UI without re-reading activeTab. `seriesMode='part-of-series'`
  // surfaces the partNumber + partTotal number inputs (X of Y).
  cartridge?: 'knyt' | 'qriptopian';
  seriesMode?: 'standalone' | 'part-of-series';
  partNumber?: number;
  partTotal?: number;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EPISODES: { number: number | null; title: string }[] = [
  { number: null, title: 'Series/Saga (All Episodes)' },
  { number: 0, title: 'Episode #-1 (Graphic Novel)' },
  ...Array.from({ length: 13 }, (_, i) => ({
    number: i + 1,
    title: `Episode #${i}`,
  })),
];

// ── Qriptopian series dropdown ───────────────────────────────────────────────
// Qriptopian content is organised by series rather than episodes. Two groups:
//   - Papers: long-form thesis pieces grouped by series (Protocols, The
//     Polity, COYN Thesis, Experience Sovereignty, The Polity and the
//     Plutocracy).
//   - Magazines: numbered issues of The Qriptopian (#0, #1, ...).
// Series scope flows into Supabase storage paths as `papers-<sub>` or
// `magazines-<issue>` (see /api/admin/codex/storage/sign).
const QRIPTO_SERIES: { value: string; label: string; group: 'papers' | 'magazines' }[] = [
  { value: 'papers/protocols',                  label: 'Papers · Protocols',                       group: 'papers' },
  { value: 'papers/polity',                     label: 'Papers · The Polity',                      group: 'papers' },
  { value: 'papers/coyn-thesis',                label: 'Papers · COYN Thesis',                     group: 'papers' },
  { value: 'papers/experience-sovereignty',     label: 'Papers · Experience Sovereignty',          group: 'papers' },
  { value: 'papers/polity-plutocracy',          label: 'Papers · The Polity and the Plutocracy',   group: 'papers' },
  { value: 'magazines/0',                       label: 'Magazines · #0',                           group: 'magazines' },
  { value: 'magazines/1',                       label: 'Magazines · #1',                           group: 'magazines' },
  { value: 'magazines/2',                       label: 'Magazines · #2',                           group: 'magazines' },
  { value: 'magazines/3',                       label: 'Magazines · #3',                           group: 'magazines' },
];

// ── Qriptopian content type categories ───────────────────────────────────────
// Replaces the KNYT ASSET_CATEGORIES for the qriptopian tab. White-papers
// are scoped to the Papers series; the rest are valid for both Papers and
// Magazines.
type QriptoCategoryId = 'white-paper' | 'article' | 'video' | 'audio' | 'image' | 'infographic';
const QRIPTO_CATEGORIES: {
  id: QriptoCategoryId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  accept: string;
}[] = [
  { id: 'white-paper', label: 'White-papers',  icon: FileText, description: 'Long-form thesis PDFs (Papers series)',           accept: '.pdf' },
  { id: 'article',     label: 'Articles',      icon: FileText, description: 'Magazine articles (markdown / Word / PDF)',       accept: '.md,.docx,.pdf,.txt' },
  { id: 'video',       label: 'Video',         icon: Video,    description: 'Video pieces (interviews, explainers, reels)',    accept: '.mp4,.webm,.mov' },
  { id: 'audio',       label: 'Audio',         icon: Video,    description: 'Audio essays, podcasts, interview cuts',          accept: '.mp3,.wav,.m4a,.ogg' },
  { id: 'image',       label: 'Images',        icon: Image,    description: 'Editorial photography, illustrations, covers',    accept: '.png,.jpg,.jpeg,.webp,.gif' },
  { id: 'infographic', label: 'Infographics',  icon: Image,    description: 'Diagrams + visual explainers (SVG / PNG / PDF)',  accept: '.svg,.png,.jpg,.pdf' },
];

const ASSET_CATEGORIES: {
  id: UploadCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  assetKinds: { value: CodexAssetKind | MasterContentType; label: string; accept: string }[];
}[] = [
  {
    id: 'print',
    label: 'Print Editions',
    icon: BookOpen,
    description: 'Complete print comic PDFs (Rare, Epic, Legendary editions)',
    assetKinds: [{ value: 'episode_print', label: 'Print Edition PDF', accept: '.pdf' }],
  },
  {
    id: 'master',
    label: 'Motion Episodes',
    icon: Video,
    description: 'Motion comic videos',
    assetKinds: [{ value: 'episode_motion', label: 'Motion Comic (Video)', accept: '.mp4,.webm,.mov' }],
  },
  {
    id: 'still',
    label: 'Still Episodes',
    icon: FileText,
    description: 'Still episode comics / pages (PDF or image)',
    assetKinds: [{ value: 'episode_still', label: 'Still Episode (PDF / Image)', accept: '.pdf,.png,.jpg,.jpeg,.webp' }],
  },
  {
    id: 'cover',
    label: 'Covers',
    icon: Image,
    description: 'Limited edition still cover variants (PDF or image)',
    assetKinds: [
      { value: 'cover_pdf', label: 'Cover PDF', accept: '.pdf' },
      { value: 'cover_image', label: 'Cover Image', accept: '.png,.jpg,.jpeg,.webp' },
    ],
  },
  {
    id: 'motion-covers',
    label: 'Motion Covers',
    icon: Video,
    description: 'Animated / motion cover variants (video)',
    assetKinds: [{ value: 'cover_motion', label: 'Motion Cover (Video)', accept: '.mp4,.webm,.mov' }],
  },
  {
    id: 'character',
    label: 'Characters',
    icon: Users,
    description: 'Character posters and power sheets',
    assetKinds: [
      { value: 'character_poster', label: 'Character Poster', accept: '.png,.jpg,.jpeg,.webp,.pdf' },
      { value: 'powers_sheet', label: 'Powers Sheet', accept: '.pdf,.png,.jpg,.jpeg' },
    ],
  },
  {
    id: 'lore',
    label: 'Lore & Docs',
    icon: FileText,
    description: 'Background lore and concept documents. Choose "Extract Text" to enable copilot.',
    assetKinds: [
      { value: 'background_lore_doc', label: 'Background Lore', accept: '.pdf,.txt,.md' },
      { value: 'twenty_one_sats_concept', label: '21 Sats Concept', accept: '.pdf,.txt,.md' },
    ],
  },
  {
    id: 'game',
    label: 'Game Assets',
    icon: Gamepad2,
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
    icon: Share2,
    description: 'Campaign images and videos for social sharing',
    assetKinds: [
      { value: 'social_campaign_image', label: 'Campaign Image', accept: '.png,.jpg,.jpeg,.webp,.gif' },
      { value: 'social_campaign_video', label: 'Campaign Video', accept: '.mp4,.webm' },
    ],
  },
  {
    id: 'bundle',
    label: 'Bundles',
    icon: Package,
    description: 'Bundle packs combining multiple assets (cover or hero artwork)',
    assetKinds: [{ value: 'bundle_pack', label: 'Bundle Pack', accept: '.png,.jpg,.jpeg,.webp,.pdf' }],
  },
  {
    id: 'rabadges',
    label: 'RaBadges',
    icon: Award,
    description: 'Rarity badges (Common / Rare / Epic / Legendary)',
    assetKinds: [{ value: 'ra_badge', label: 'RaBadge', accept: '.png,.jpg,.jpeg,.webp,.svg' }],
  },
];

const RARITY_TIERS = [
  { value: 'legendary' as const, label: 'Legendary', color: 'text-yellow-400' },
  { value: 'epic' as const,      label: 'Epic',      color: 'text-purple-400' },
  { value: 'rare' as const,      label: 'Rare',      color: 'text-blue-400'   },
  { value: 'common' as const,    label: 'Common',    color: 'text-gray-400'   },
];

const EDITION_TIERS = [
  { value: 'common' as EditionTier, label: 'Common', color: 'text-gray-400' },
  { value: 'rare' as EditionTier, label: 'Rare', color: 'text-blue-400' },
  { value: 'epic' as EditionTier, label: 'Epic', color: 'text-purple-400' },
  { value: 'legendary' as EditionTier, label: 'Legendary', color: 'text-amber-400' },
];

const DISPLAY_MODES = [
  { value: 'text_extract' as DisplayMode, label: 'Extract Text', description: 'Extract text for copilot & formatted display' },
  { value: 'pdf' as DisplayMode, label: 'PDF Viewer', description: 'Display as PDF' },
  { value: 'image' as DisplayMode, label: 'Image', description: 'Display as image' },
  { value: 'video' as DisplayMode, label: 'Video', description: 'Display as video' },
];


// ── FileIcon ─────────────────────────────────────────────────────────────────

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-purple-400" />;
  if (mimeType.startsWith('video/')) return <Video className="h-5 w-5 text-blue-400" />;
  return <FileText className="h-5 w-5 text-gray-400" />;
}

// ── UploadQueueItem ───────────────────────────────────────────────────────────

interface QueueItemProps {
  item: UploadItem;
  category: typeof ASSET_CATEGORIES[0];
  onUpdate: (updates: Partial<UploadItem>) => void;
  onRemove: () => void;
}

function UploadQueueItem({ item, category, onUpdate, onRemove }: QueueItemProps) {
  const isQripto = item.cartridge === 'qriptopian';
  const isCover = item.category === 'cover';
  const isMaster = item.category === 'master' || item.category === 'still';
  const isPrint = item.category === 'print';
  const isLore = item.category === 'lore' && !isQripto;
  const isCharacter = item.category === 'character';
  const isRaBadge = item.category === 'rabadges';
  // Motion Comics (master), Print, Characters and RaBadges all expose the same
  // Common/Rare/Epic/Legendary tier dropdown so the operator can flag the
  // upload's edition/rarity tier alongside the asset. Qripto rows opt out —
  // they use a Standalone | Part-of-series picker instead.
  const showEditionTier = !isQripto && (isPrint || isMaster || isCharacter || isRaBadge);

  const borderColor =
    item.status === 'success' ? 'border-green-500/30 bg-green-500/10' :
    item.status === 'error'   ? 'border-red-500/30 bg-red-500/10' :
    item.status === 'uploading' ? 'border-cyan-500/30 bg-cyan-500/10' :
    'border-gray-700 bg-gray-800';

  return (
    <div className={`rounded-lg border p-3 ${borderColor}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {item.status === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : item.status === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-400" />
          ) : item.status === 'uploading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          ) : (
            <FileIcon mimeType={item.file.type} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={item.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            disabled={item.status !== 'pending'}
            className="w-full bg-transparent font-medium text-white focus:outline-none disabled:opacity-50"
          />

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
            <span>{item.episodeNumber == null ? 'Series' : item.episodeNumber === -1 ? 'GN' : `Ep. #${item.episodeNumber}`}</span>

            {item.status === 'pending' && !isPrint && !isQripto && (
              <select
                value={isMaster ? item.masterType : item.assetKind}
                onChange={(e) => {
                  if (isMaster) onUpdate({ masterType: e.target.value as MasterContentType });
                  else onUpdate({ assetKind: e.target.value as CodexAssetKind });
                }}
                className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-gray-300"
              >
                {category.assetKinds.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            )}

            {item.status === 'pending' && isQripto && (
              <>
                <select
                  value={item.seriesMode ?? 'standalone'}
                  onChange={(e) => {
                    const mode = e.target.value as 'standalone' | 'part-of-series';
                    onUpdate(
                      mode === 'part-of-series'
                        ? { seriesMode: mode, partNumber: item.partNumber ?? 1, partTotal: item.partTotal ?? 1 }
                        : { seriesMode: mode, partNumber: undefined, partTotal: undefined },
                    );
                  }}
                  className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-gray-300"
                  title="Series mode"
                >
                  <option value="standalone">Standalone</option>
                  <option value="part-of-series">Part of a series</option>
                </select>
                {item.seriesMode === 'part-of-series' && (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={item.partNumber ?? 1}
                      onChange={(e) => onUpdate({ partNumber: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-12 rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-gray-300"
                      title="Part number"
                    />
                    <span className="text-gray-500">of</span>
                    <input
                      type="number"
                      min={1}
                      value={item.partTotal ?? 1}
                      onChange={(e) => onUpdate({ partTotal: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-12 rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-gray-300"
                      title="Total parts"
                    />
                  </span>
                )}
              </>
            )}

            {item.status === 'pending' && showEditionTier && (
              <select
                value={item.editionTier ?? (isPrint ? 'rare' : 'common')}
                onChange={(e) => onUpdate({ editionTier: e.target.value as EditionTier })}
                className="rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-gray-300"
                title="Edition tier"
              >
                {EDITION_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            )}
          </div>

          {isCover && item.status === 'pending' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={item.variantName ?? ''}
                onChange={(e) => onUpdate({ variantName: e.target.value })}
                placeholder="Variant name"
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
              />
              <select
                value={item.rarityTier ?? 'common'}
                onChange={(e) => onUpdate({ rarityTier: e.target.value as 'legendary' | 'epic' | 'rare' | 'common' })}
                className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
              >
                {RARITY_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="number"
                value={item.editionMax ?? ''}
                onChange={(e) => onUpdate({ editionMax: Number(e.target.value) || undefined })}
                placeholder="Max"
                className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
              />
            </div>
          )}

          {isLore && item.status === 'pending' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">Display as:</span>
              <select
                value={item.displayMode ?? 'text_extract'}
                onChange={(e) => onUpdate({ displayMode: e.target.value as DisplayMode })}
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
              >
                {DISPLAY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {(item.displayMode === 'text_extract' || !item.displayMode) && (
                <span className="text-xs text-cyan-400">Copilot enabled</span>
              )}
            </div>
          )}

          {item.status === 'error' && item.error && (
            <p className="mt-1 text-xs text-red-400">{item.error}</p>
          )}
          {item.status === 'success' && item.result && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-500 shrink-0">CID:</span>
                <a
                  href={`/api/content/cover/${item.result.cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-[10px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 max-w-[180px]"
                  title={item.result.cid}
                >
                  {item.result.cid}
                </a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.result!.cid)}
                  className="text-[9px] rounded border border-gray-600 bg-gray-700 px-1 py-0.5 text-gray-400 hover:text-white transition-colors shrink-0"
                >
                  copy
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500 shrink-0">ID:</span>
                <span className="font-mono text-[10px] text-green-400">{item.result.id}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.result!.id)}
                  className="text-[9px] rounded border border-gray-600 bg-gray-700 px-1 py-0.5 text-gray-400 hover:text-white transition-colors shrink-0"
                >
                  copy
                </button>
              </div>
              <a
                href={`/api/content/cover/${item.result.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Image className="h-3 w-3" /> Preview asset →
              </a>
            </div>
          )}
          {item.status === 'uploading' && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
        </div>

        {item.status === 'pending' && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 transition-colors hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CodexUploadModal({ isOpen, onClose, onUploadComplete }: Props) {
  const [activeTab, setActiveTab] = useState<CodexTab>('knyt');
  const [selectedCategory, setSelectedCategory] = useState<UploadCategory>('master');
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(1);
  // Qriptopian-side state — series scope (e.g. 'papers/protocols') and
  // content type. Independent of KNYT's selectedCategory / selectedEpisode
  // so switching tabs doesn't clobber the other side's selection.
  const [selectedQriptoSeries, setSelectedQriptoSeries] = useState<string>(QRIPTO_SERIES[0].value);
  const [selectedQriptoCategory, setSelectedQriptoCategory] = useState<QriptoCategoryId>('white-paper');
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [storageProvider, setStorageProvider] = useState<'auto-drive' | 'supabase'>('auto-drive');
  const qriptoFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCategory = ASSET_CATEGORIES.find((c) => c.id === selectedCategory)!;
  const currentQriptoCategory = QRIPTO_CATEGORIES.find((c) => c.id === selectedQriptoCategory)!;

  // Series string passed to backend uploads. KNYT = 'metaKnyts',
  // Qripto = 'qriptopian'. Used in storage paths + master_content_qubes /
  // codex_media_assets rows so the two cartridges don't collide.
  const seriesForUpload = activeTab === 'knyt' ? 'metaKnyts' : 'qriptopian';

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const isMaster = selectedCategory === 'master' || selectedCategory === 'still';
      const isPrint = selectedCategory === 'print';
      const isCover = selectedCategory === 'cover';
      const isLore = selectedCategory === 'lore';
      const isCharacter = selectedCategory === 'character';
      const isRaBadge = selectedCategory === 'rabadges';
      const defaultKind = currentCategory.assetKinds[0];

      const newItems: UploadItem[] = files.map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        category: selectedCategory,
        assetKind: isMaster || isPrint ? undefined : (defaultKind.value as CodexAssetKind),
        masterType: isMaster || isPrint ? (defaultKind.value as MasterContentType) : undefined,
        episodeNumber: selectedEpisode,
        title: file.name.replace(/\.[^/.]+$/, ''),
        status: 'pending' as const,
        progress: 0,
        ...(isCover && { variantName: '', rarityTier: 'common' as const, editionMax: 100 }),
        ...(isPrint && { editionTier: 'rare' as EditionTier }),
        ...((isMaster || isCharacter || isRaBadge) && { editionTier: 'common' as EditionTier }),
        ...(isLore && { displayMode: 'text_extract' as DisplayMode }),
      }));

      setUploadQueue((prev) => [...prev, ...newItems]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [selectedCategory, selectedEpisode, currentCategory],
  );

  // Qripto file picker — slimmer than the KNYT version because qripto
  // doesn't have edition tiers, rarity, or display-mode complexity.
  // Maps every qripto content type onto category='lore' (the generic
  // document/asset bucket) and stamps the assetKind so storage paths
  // route per type. The seriesScope ('papers/protocols', 'magazines/2'
  // etc.) flows separately into buildPath via the upload request body.
  const handleQriptoFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const assetKindByCategory: Record<QriptoCategoryId, CodexAssetKind> = {
        'white-paper': 'background_lore_doc',
        'article':     'background_lore_doc',
        'video':       'game_video',
        'audio':       'background_lore_doc',
        'image':       'social_campaign_image',
        'infographic': 'social_campaign_image',
      };
      const newItems: UploadItem[] = files.map((file, idx) => ({
        id: `${Date.now()}-q-${idx}`,
        file,
        category: 'lore',
        assetKind: assetKindByCategory[selectedQriptoCategory],
        episodeNumber: null,
        title: file.name.replace(/\.[^/.]+$/, ''),
        status: 'pending' as const,
        progress: 0,
        displayMode: 'pdf' as DisplayMode,
        cartridge: 'qriptopian' as const,
        seriesMode: 'standalone' as const,
      }));
      setUploadQueue((prev) => [...prev, ...newItems]);
      if (qriptoFileInputRef.current) qriptoFileInputRef.current.value = '';
    },
    [selectedQriptoCategory],
  );

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploadQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCompleted = () => {
    setUploadQueue((prev) => prev.filter((item) => item.status !== 'success'));
  };

  const uploadItem = async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading', progress: 10 });
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;

      // ── Supabase Storage path (browser → Supabase direct, no Lambda size limit) ──
      if (storageProvider === 'supabase') {
        const isMaster = item.category === 'master' || item.category === 'still' || item.category === 'print';
        const contentType = item.masterType ?? (item.category === 'still' ? 'episode_still' : item.category === 'print' ? 'episode_print' : 'episode_motion');

        // Step 1: get signed upload URL
        let signRes: Response;
        try {
          signRes = await fetch('/api/admin/codex/storage/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              category: item.category,
              series: seriesForUpload,
              // For Qripto uploads, seriesScope (e.g. 'papers/protocols')
              // overrides the episode-based path segment in buildPath.
              seriesScope: activeTab === 'qriptopian' ? selectedQriptoSeries : undefined,
              episodeNumber: item.episodeNumber ?? 0,
              assetKind: item.assetKind,
              contentType: isMaster ? contentType : undefined,
              fileName: item.file.name,
              mimeType: item.file.type || undefined,
            }),
          });
        } catch (netErr) {
          throw new Error(`Step 1/3 — sign request failed: ${(netErr as Error).message || 'network error'}`);
        }
        if (!signRes.ok) {
          const e = await signRes.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error(`Step 1/3 — sign failed (${signRes.status}): ${(e.error as string) || signRes.statusText}`);
        }
        const { signedUrl, path, bucket } = await signRes.json() as { signedUrl: string; path: string; bucket: string };
        updateItem(item.id, { progress: 5 });

        // Step 2: upload directly to Supabase Storage via XHR (gives upload
        // progress events and clearer network-error reporting for large files)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrl, true);
          xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              // Map 0-100% of the upload to 5-80% of the queue item's progress bar
              const pct = 5 + Math.floor((ev.loaded / ev.total) * 75);
              updateItem(item.id, { progress: pct });
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Step 2/3 — storage upload rejected (${xhr.status}): ${xhr.responseText?.slice(0, 200) || xhr.statusText}`));
            }
          };
          xhr.onerror = () => reject(new Error('Step 2/3 — network error during upload (connection dropped, VPN, or bucket size limit). Retry on a stable connection; if it persists, raise the bucket file_size_limit.'));
          xhr.ontimeout = () => reject(new Error('Step 2/3 — upload timed out. File may be too large for the current connection; try again or split the upload.'));
          xhr.send(item.file);
        });
        updateItem(item.id, { progress: 85 });

        // Step 3: register metadata in DB
        const registerBody: Record<string, unknown> = {
          path, bucket,
          category: item.category,
          title: item.title,
          series: seriesForUpload,
          seriesScope: activeTab === 'qriptopian' ? selectedQriptoSeries : undefined,
          episodeNumber: item.episodeNumber ?? 0,
          mimeType: item.file.type || undefined,
          fileSize: item.file.size,
        };
        if (isMaster) {
          registerBody.contentType = contentType;
          if (item.editionTier) registerBody.editionTier = item.editionTier;
        } else {
          registerBody.assetKind = item.assetKind;
          if (item.variantName) registerBody.variantName = item.variantName;
          if (item.rarityTier) registerBody.rarityTier = item.rarityTier;
          if (item.editionMax) registerBody.editionMax = item.editionMax;
          if ((item.category === 'character' || item.category === 'rabadges') && item.editionTier) registerBody.rarityTier = item.editionTier;
          if (item.category === 'lore' && item.displayMode) registerBody.displayMode = item.displayMode;
        }
        if (item.cartridge === 'qriptopian') {
          registerBody.cartridge = 'qriptopian';
          registerBody.seriesMode = item.seriesMode ?? 'standalone';
          if (item.seriesMode === 'part-of-series') {
            registerBody.partNumber = item.partNumber ?? 1;
            registerBody.partTotal = item.partTotal ?? 1;
          }
        }

        let regRes: Response;
        try {
          regRes = await fetch('/api/admin/codex/storage/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(registerBody),
          });
        } catch (netErr) {
          throw new Error(`Step 3/3 — register request failed: ${(netErr as Error).message || 'network error'} (the file uploaded successfully — DB insert failed, retrying the queue item will create a duplicate row)`);
        }
        const regData = await regRes.json().catch(() => ({})) as Record<string, unknown>;
        if (!regRes.ok) throw new Error(`Step 3/3 — register failed (${regRes.status}): ${(regData.error as string) || regRes.statusText}`);

        updateItem(item.id, { status: 'success', progress: 100, result: { id: regData.id as string, cid: regData.storageUrl as string } });
        return;
      }

      // ── Auto-Drive path (existing flow) ──────────────────────────────────────
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('title', item.title);
      formData.append('episodeNumber', String(item.episodeNumber ?? 0));
      formData.append('series', seriesForUpload);
      if (activeTab === 'qriptopian') {
        formData.append('seriesScope', selectedQriptoSeries);
      }

      let endpoint: string;
      if (item.category === 'master' || item.category === 'still' || item.category === 'print') {
        endpoint = '/api/admin/codex/upload-master';
        formData.append('contentType', item.masterType ?? (item.category === 'still' ? 'episode_still' : 'episode_motion'));
        if (item.editionTier) {
          formData.append('editionTier', item.editionTier);
        }
      } else {
        endpoint = '/api/admin/codex/upload-asset';
        formData.append('assetKind', item.assetKind ?? 'character_poster');
        if (item.category === 'cover') {
          if (item.variantName) formData.append('variantName', item.variantName);
          if (item.rarityTier) formData.append('rarityTier', item.rarityTier);
          if (item.editionMax) formData.append('editionMax', String(item.editionMax));
        }
        if ((item.category === 'character' || item.category === 'rabadges') && item.editionTier) {
          formData.append('rarityTier', item.editionTier);
        }
        if (item.category === 'lore' && item.displayMode) {
          formData.append('displayMode', item.displayMode);
        }
      }
      if (item.cartridge === 'qriptopian') {
        formData.append('cartridge', 'qriptopian');
        formData.append('seriesMode', item.seriesMode ?? 'standalone');
        if (item.seriesMode === 'part-of-series') {
          formData.append('partNumber', String(item.partNumber ?? 1));
          formData.append('partTotal', String(item.partTotal ?? 1));
        }
      }

      updateItem(item.id, { progress: 30 });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      updateItem(item.id, { progress: 80 });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 413 ? 'Upload rejected by server (413) — this may be a temporary limit. Try again; if it persists, contact support.' :
          res.status === 401 ? 'Unauthorized — please sign in and try again' :
          !res.ok ? `Server error (${res.status}) — upload failed, please try again` :
          'Server returned an unexpected response'
        );
      }
      if (!res.ok) throw new Error((data?.error as string) ?? 'Upload failed');

      updateItem(item.id, { status: 'success', progress: 100, result: { id: data.id as string, cid: data.cid as string } });
    } catch (err) {
      updateItem(item.id, { status: 'error', progress: 0, error: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const uploadAll = async () => {
    setIsUploading(true);
    for (const item of uploadQueue.filter((i) => i.status === 'pending')) {
      await uploadItem(item);
    }
    setIsUploading(false);
    onUploadComplete?.();
  };

  if (!isOpen) return null;

  const pendingCount = uploadQueue.filter((i) => i.status === 'pending').length;
  const successCount = uploadQueue.filter((i) => i.status === 'success').length;
  const errorCount = uploadQueue.filter((i) => i.status === 'error').length;
  const CategoryIcon = currentCategory.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Codex Upload</h2>
          </div>
          {/* Storage destination toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => setStorageProvider('auto-drive')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${storageProvider === 'auto-drive' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Auto-Drive
            </button>
            <button
              type="button"
              onClick={() => setStorageProvider('supabase')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${storageProvider === 'supabase' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Supabase
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['knyt', 'qriptopian'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? tab === 'knyt'
                    ? 'border-b-2 border-cyan-400 bg-cyan-400/5 text-cyan-400'
                    : 'border-b-2 border-purple-400 bg-purple-400/5 text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'knyt' ? 'KNYT Codex' : 'Qriptopian Codex'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'knyt' ? (
            <div className="space-y-5">
              {/* Episode + Category selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Episode / Scope</label>
                  <select
                    value={selectedEpisode ?? 'saga'}
                    onChange={(e) => setSelectedEpisode(e.target.value === 'saga' ? null : Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {EPISODES.map((ep) => (
                      <option key={ep.number ?? 'saga'} value={ep.number ?? 'saga'}>{ep.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Asset Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as UploadCategory)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {ASSET_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category description */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <CategoryIcon className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="font-medium text-white">{currentCategory.label}</p>
                  <p className="text-sm text-gray-400">{currentCategory.description}</p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-600 p-8 text-center transition-colors hover:border-cyan-400 hover:bg-cyan-400/5"
              >
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-2 font-medium text-white">Click to select files or drag and drop</p>
                <p className="text-sm text-gray-400">
                  Accepted: {currentCategory.assetKinds.map((k) => k.accept).join(', ')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={currentCategory.assetKinds.map((k) => k.accept).join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Queue */}
              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-300">Upload Queue ({uploadQueue.length})</h3>
                    {successCount > 0 && (
                      <button type="button" onClick={clearCompleted} className="text-sm text-gray-400 hover:text-white">
                        Clear completed
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {uploadQueue.map((item) => (
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
            // ── Qriptopian tab — Series + Content Type pickers ──────────
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Series — Papers (sub-series) + Magazines (issues) */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Series</label>
                  <select
                    value={selectedQriptoSeries}
                    onChange={(e) => setSelectedQriptoSeries(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <optgroup label="Papers">
                      {QRIPTO_SERIES.filter((s) => s.group === 'papers').map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Magazines">
                      {QRIPTO_SERIES.filter((s) => s.group === 'magazines').map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {/* Content Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Content Type</label>
                  <select
                    value={selectedQriptoCategory}
                    onChange={(e) => setSelectedQriptoCategory(e.target.value as QriptoCategoryId)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    {QRIPTO_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category description */}
              <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                <p className="text-xs text-purple-200">
                  <strong>{currentQriptoCategory.label}:</strong>{' '}
                  {currentQriptoCategory.description}{' '}
                  <span className="text-gray-400">· Accepted: {currentQriptoCategory.accept}</span>
                </p>
              </div>

              {/* Drag-drop zone */}
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/30 py-8 transition hover:border-purple-500/50 hover:bg-purple-500/5"
                onClick={() => qriptoFileInputRef.current?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-white">Click to select files or drag and drop</p>
                <p className="mt-1 text-xs text-gray-500">Accepted: {currentQriptoCategory.accept}</p>
                <input
                  ref={qriptoFileInputRef}
                  type="file"
                  multiple
                  accept={currentQriptoCategory.accept}
                  onChange={handleQriptoFileSelect}
                  className="hidden"
                />
              </div>

              {/* Upload queue — reuses the existing KNYT UploadQueueItem.
                  Qripto items carry category='lore' (catchall) so the row
                  renders the title + status without KNYT-specific
                  controls (edition tier, rarity, display mode). The
                  seriesScope flows through uploadItem() separately. */}
              {uploadQueue.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-300">
                    Upload Queue ({uploadQueue.length})
                  </h4>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {uploadQueue.map((item) => (
                      <UploadQueueItem
                        key={item.id}
                        item={item}
                        category={ASSET_CATEGORIES.find((c) => c.id === 'lore')!}
                        onUpdate={(updates) => updateItem(item.id, updates)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {uploadQueue.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-700 bg-gray-800/50 px-6 py-4">
            <div className="flex items-center gap-4 text-sm">
              {pendingCount > 0 && <span className="text-gray-400">{pendingCount} pending</span>}
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle className="h-4 w-4" /> {successCount} uploaded
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="h-4 w-4" /> {errorCount} failed
                </span>
              )}
            </div>
            {pendingCount > 0 || isUploading ? (
              <button
                type="button"
                onClick={uploadAll}
                disabled={isUploading || pendingCount === 0}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2 font-medium text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-gray-600"
              >
                {isUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Upload All ({pendingCount})</>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2 font-medium text-white transition-colors hover:bg-cyan-600"
              >
                <CheckCircle className="h-4 w-4" /> Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CodexUploadModal;
