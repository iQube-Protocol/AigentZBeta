'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { loadImageWithQueue } from '@/app/utils/image-loader';

interface CoverImageProps {
  cid: string;
  alt: string;
  loadedImages: Map<string, string>;
  setLoadedImages: React.Dispatch<React.SetStateAction<Map<string, string>>>;
}

export function CoverImage({ cid, alt, loadedImages, setLoadedImages }: CoverImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (loadedImages.has(cid)) {
        if (imgRef.current) {
          imgRef.current.src = loadedImages.get(cid)!;
          setLoading(false);
        }
        return;
      }

      try {
        if (cid.startsWith('http')) {
          if (!cancelled && imgRef.current) {
            imgRef.current.src = cid;
            setLoadedImages((prev) => new Map(prev).set(cid, cid));
            setLoading(false);
          }
          return;
        }

        const url = `/api/content/cover/${cid}?variant=thumb`;
        const objectUrl = await loadImageWithQueue(url);

        if (!cancelled) {
          setLoadedImages((prev) => new Map(prev).set(cid, objectUrl));
          if (imgRef.current) {
            imgRef.current.src = objectUrl;
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`[CoverImage] Failed to load ${cid}:`, err);
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [cid, loadedImages, setLoadedImages]);

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
      )}
      <img
        ref={imgRef}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover object-top"
        style={{ display: loading || error ? 'none' : 'block' }}
      />
    </>
  );
}

export default CoverImage;
