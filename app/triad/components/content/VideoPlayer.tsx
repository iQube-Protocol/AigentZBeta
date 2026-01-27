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
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Preload video as blob and cache it
  const preloadVideo = async (url: string) => {
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
  }, [videoUrl]);

  // Preload adjacent segments when current video starts playing
  useEffect(() => {
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
  }, [currentSegmentIndex, segments, currentBlobUrl]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
  }, [videoUrl, currentBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoad = () => setIsLoading(false);
    const onError = () => setError('Failed to load video');
    const onTime = () => video.duration && setProgress((video.currentTime / video.duration) * 100);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (canGoNext) goToSegment(currentSegmentIndex + 1);
    };
    video.addEventListener('loadeddata', onLoad);
    video.addEventListener('error', onError);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadeddata', onLoad);
      video.removeEventListener('error', onError);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [currentSegmentIndex, canGoNext]);

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
    if (v) (v.paused ? v.play() : v.pause());
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
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          {currentBlobUrl && (
            <video
              ref={videoRef}
              src={currentBlobUrl}
              className="w-full h-full"
              playsInline
              controls={false}
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

