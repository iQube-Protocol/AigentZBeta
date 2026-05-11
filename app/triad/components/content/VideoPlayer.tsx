import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Loader2, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from 'lucide-react';

export interface VideoSegment {
  id: string;
  segment_number: number;
  title: string | null;
  auto_drive_cid: string;
  is_preview: boolean;
}

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  onClose: () => void;
  segments?: VideoSegment[];
  currentSegmentIndex?: number;
  onSegmentChange?: (index: number) => void;
  streamMode?: 'blob' | 'direct';
  /**
   * Phase 3.x — fires once when the user reaches the end of the
   * content. For multi-segment videos, only fires when the LAST
   * segment ends. The caller decides what to do (typically POSTs to
   * /api/engagement/episode-progress { episodeId, eventType: 'completed' }).
   * The viewer never knows the episode-id format — that's the caller's
   * concern. See KnytTab for the canonical wiring.
   */
  onComplete?: () => void;
}

// Global cache for preloaded video blobs - persists across component renders
const videoCache = new Map<string, string>();

export function VideoPlayer({
  videoUrl,
  title,
  onClose,
  segments = [],
  currentSegmentIndex = 0,
  onSegmentChange,
  streamMode = 'blob',
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const completionFiredRef = useRef<boolean>(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null);
  const preloadingRef = useRef<Set<string>>(new Set());

  const hasMultipleSegments = segments.length > 1;
  const currentSegment = segments[currentSegmentIndex];
  const canGoPrev = currentSegmentIndex > 0;
  const canGoNext = currentSegmentIndex < segments.length - 1;

  const goToSegment = (index: number) => {
    if (index >= 0 && index < segments.length && onSegmentChange) {
      onSegmentChange(index);
    }
  };

  // Preload video as blob and cache it (blob mode only)
  const preloadVideo = async (url: string) => {
    if (streamMode !== 'blob') return;
    if (videoCache.has(url) || preloadingRef.current.has(url)) return;
    preloadingRef.current.add(url);

    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        videoCache.set(url, blobUrl);
      }
    } catch {
      // Non-blocking preload failure
    }
  };

  // Load current video (from cache or fetch)
  useEffect(() => {
    if (streamMode !== 'blob') {
      setCurrentBlobUrl(null);
      return;
    }
    let cancelled = false;

    const loadCurrentVideo = async () => {
      if (videoCache.has(videoUrl)) {
        setCurrentBlobUrl(videoCache.get(videoUrl)!);
        return;
      }

      try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Failed to fetch video');
        const blob = await response.blob();
        if (cancelled) return;

        const blobUrl = URL.createObjectURL(blob);
        videoCache.set(videoUrl, blobUrl);
        setCurrentBlobUrl(blobUrl);
      } catch {
        if (!cancelled) setError('Failed to load video');
      }
    };

    setCurrentBlobUrl(null);
    loadCurrentVideo();

    return () => {
      cancelled = true;
    };
  }, [streamMode, videoUrl]);

  // Preload adjacent segments when current video starts playing
  useEffect(() => {
    if (streamMode !== 'blob') return;
    if (segments.length <= 1 || !currentBlobUrl) return;

    if (currentSegmentIndex < segments.length - 1) {
      const nextCid = segments[currentSegmentIndex + 1].auto_drive_cid;
      preloadVideo(`/api/content/video/${nextCid}`);
    }

    if (currentSegmentIndex > 0) {
      setTimeout(() => {
        const prevCid = segments[currentSegmentIndex - 1].auto_drive_cid;
        preloadVideo(`/api/content/video/${prevCid}`);
      }, 2000);
    }
  }, [currentSegmentIndex, segments, currentBlobUrl, streamMode]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
  }, [videoUrl, currentBlobUrl, streamMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => video.duration && setProgress((video.currentTime / video.duration) * 100);
    const onEnded = () => {
      if (canGoNext) {
        goToSegment(currentSegmentIndex + 1);
      } else if (onComplete && !completionFiredRef.current) {
        // Last segment ended (or single-segment video) — fire once.
        completionFiredRef.current = true;
        onComplete();
      }
    };
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
    };
  }, [currentSegmentIndex, canGoNext, onComplete]);

  // Reset completion-fired guard when the source video changes.
  useEffect(() => {
    completionFiredRef.current = false;
  }, [videoUrl]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowLeft' && canGoPrev) goToSegment(currentSegmentIndex - 1);
      if (e.key === 'ArrowRight' && canGoNext) goToSegment(currentSegmentIndex + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, currentSegmentIndex, canGoPrev, canGoNext]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      return;
    }
    v.pause();
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (v) {
      v.muted = !v.muted;
      setIsMuted(v.muted);
    }
  };
  const rewind = (seconds: number = 10) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime - seconds);
  };
  const fastForward = (seconds: number = 10) => {
    const v = videoRef.current;
    if (v && v.duration) v.currentTime = Math.min(v.duration, v.currentTime + seconds);
  };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  };

  const effectiveVideoSrc = streamMode === 'direct' ? videoUrl : currentBlobUrl;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="relative w-full max-w-5xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {hasMultipleSegments && currentSegment && (
              <p className="text-sm text-cyan-400">
                {currentSegment.title || `Part ${currentSegment.segment_number}`} ({currentSegmentIndex + 1}/{segments.length})
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
          {isLoading && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          {effectiveVideoSrc && (
            <video
              ref={videoRef}
              src={effectiveVideoSrc}
              className="w-full h-full"
              playsInline
              controls={false}
              onLoadedData={() => setIsLoading(false)}
              onCanPlay={() => setIsLoading(false)}
              onPlay={() => {
                setIsPlaying(true);
                setIsLoading(false);
              }}
              onPause={() => setIsPlaying(false)}
              onError={() => {
                setError('Failed to load video');
                setIsLoading(false);
              }}
            />
          )}

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
              <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer" onClick={handleSeek}>
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                    {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                  </button>
                  <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                    {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                  </button>
                  <button onClick={() => rewind()} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => fastForward()} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                    <RotateCw className="w-5 h-5 text-white" />
                  </button>
                </div>
                {hasMultipleSegments && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToSegment(currentSegmentIndex - 1)}
                      disabled={!canGoPrev}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => goToSegment(currentSegmentIndex + 1)}
                      disabled={!canGoNext}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
