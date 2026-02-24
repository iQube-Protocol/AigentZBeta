'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Upload, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
};

type Category = 'master_motion' | 'master_print' | 'cover' | 'character' | 'lore';

type QueueItem = {
  id: string;
  file: File;
  title: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

const CATEGORY_CONFIG: Record<Category, { label: string; accept: string }> = {
  master_motion: { label: 'Episode Motion Master', accept: '.mp4,.webm,.mov' },
  master_print: { label: 'Episode Print Master', accept: '.pdf' },
  cover: { label: 'Cover Asset', accept: '.pdf,.png,.jpg,.jpeg,.webp' },
  character: { label: 'Character Asset', accept: '.pdf,.png,.jpg,.jpeg,.webp' },
  lore: { label: 'Lore Document', accept: '.pdf,.txt,.md' },
};

const EPISODES = [
  { number: '', label: 'Series / Saga' },
  ...Array.from({ length: 13 }, (_, index) => ({ number: String(index + 1), label: `Episode ${index + 1}` })),
];

function getAccessTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.includes('auth-token')) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token as string;
    }
  } catch {
    return null;
  }
  return null;
}

export function CodexUploadModal({ isOpen, onClose, onUploadComplete }: Props) {
  const [category, setCategory] = useState<Category>('master_motion');
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(() => queue.filter((item) => item.status === 'pending').length, [queue]);

  const reset = () => {
    setQueue([]);
    setMessage(null);
    setError(null);
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: QueueItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...items]);
    setMessage(null);
    setError(null);
  };

  const updateTitle = (id: string, title: string) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const buildRequest = (item: QueueItem) => {
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('title', item.title || item.file.name);
    formData.append('series', 'metaKnyts');
    if (episodeNumber) formData.append('episodeNumber', episodeNumber);

    if (category === 'master_motion') {
      formData.append('contentType', 'episode_motion');
      return { endpoint: '/api/admin/codex/upload-master', formData };
    }
    if (category === 'master_print') {
      formData.append('contentType', 'episode_print');
      formData.append('editionTier', 'rare');
      return { endpoint: '/api/admin/codex/upload-master', formData };
    }

    const assetKind = category === 'cover'
      ? 'cover_image'
      : category === 'character'
        ? 'character_poster'
        : 'background_lore_doc';
    formData.append('assetKind', assetKind);
    return { endpoint: '/api/admin/codex/upload-asset', formData };
  };

  const uploadAll = async () => {
    const pending = queue.filter((item) => item.status === 'pending');
    if (pending.length === 0) return;

    const requiresEpisode = category === 'master_motion' || category === 'master_print' || category === 'cover';
    if (requiresEpisode && !episodeNumber) {
      setError('Episode selection is required for this category.');
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setError(null);

    const token = getAccessTokenFromStorage();
    let hasFailure = false;

    for (const item of pending) {
      setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading', error: undefined } : x)));
      try {
        const { endpoint, formData } = buildRequest(item);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Upload failed');
        setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'success' } : x)));
      } catch (e) {
        hasFailure = true;
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'error', error: msg } : x)));
      }
    }

    setIsUploading(false);
    if (hasFailure) {
      setError('Some uploads failed. Review errors in the queue.');
    } else {
      setMessage('All uploads completed successfully.');
      onUploadComplete?.();
    }
  };

  const closeModal = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Codex Upload</h2>
            <p className="text-xs text-slate-400">Upload master content and codex assets</p>
          </div>
          <button className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={closeModal}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-300">Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                disabled={isUploading}
              >
                {(Object.keys(CATEGORY_CONFIG) as Category[]).map((key) => (
                  <option key={key} value={key}>{CATEGORY_CONFIG[key].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">Episode</label>
              <select
                value={episodeNumber}
                onChange={(event) => setEpisodeNumber(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                disabled={isUploading}
              >
                {EPISODES.map((episode) => (
                  <option key={episode.label} value={episode.number}>{episode.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300">Add files</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
                <Upload className="h-4 w-4" />
                Choose files
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept={CATEGORY_CONFIG[category].accept}
                  onChange={(event) => {
                    onFilesSelected(event.target.files);
                    event.currentTarget.value = '';
                  }}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {message && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-950/40 p-2">
            {queue.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">No files selected yet.</p>
            ) : (
              queue.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/80 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        value={item.title}
                        onChange={(event) => updateTitle(item.id, event.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white"
                        disabled={isUploading || item.status === 'uploading'}
                      />
                      <p className="mt-1 truncate text-xs text-slate-400">{item.file.name}</p>
                      {item.error && <p className="mt-1 text-xs text-red-400">{item.error}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{item.status}</span>
                      {item.status !== 'uploading' && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-300"
                          disabled={isUploading}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <p className="text-xs text-slate-400">{pendingCount} pending</p>
            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                disabled={isUploading || queue.length === 0}
              >
                Clear
              </button>
              <button
                onClick={uploadAll}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading || pendingCount === 0}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploading ? 'Uploading...' : `Upload ${pendingCount}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
