import { useEffect, useState } from 'react';
import type { ReadingProgressProps } from './types';

export function ReadingProgress({ progress, color = '#5eead4' }: ReadingProgressProps) {
  return (
    <div 
      className="fixed top-0 left-0 right-0 h-1 bg-black/20 z-[10001]"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div 
        className="h-full transition-all duration-150 ease-out"
        style={{ 
          width: `${progress}%`,
          backgroundColor: color
        }}
      />
    </div>
  );
}

export function useReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = height > 0 ? (scrolled / height) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, scrollProgress)));
    };

    handleScroll(); // Initial calculation
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}
