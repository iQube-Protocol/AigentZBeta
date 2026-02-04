import { useState, useRef, useEffect } from "react";
import { X, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";

interface VideoItem { id: string; title: string; videoUrl: string; duration?: string; }
interface VideoModalProps { isOpen: boolean; onClose: () => void; items: VideoItem[]; initialIndex?: number; }

export function VideoModal({ isOpen, onClose, items, initialIndex = 0 }: VideoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentItem = items[currentIndex];

  useEffect(() => { if (isOpen) setCurrentIndex(initialIndex); }, [isOpen, initialIndex]);

  if (!isOpen || !currentItem) return null;

  const handlePrev = () => setCurrentIndex((p) => (p === 0 ? items.length - 1 : p - 1));
  const handleNext = () => setCurrentIndex((p) => (p === items.length - 1 ? 0 : p + 1));
  const handleReplay = () => { if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); } };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center">
        <video ref={videoRef} src={currentItem.videoUrl} className="max-w-full max-h-full object-contain" autoPlay controls />
        
        {/* Duration */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <span className="text-cyan-400 text-sm">Duration: {currentItem.duration || "0:00"}</span>
        </div>
        
        {/* Control Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white"><X className="h-5 w-5" /></button>
          <button onClick={handleReplay} className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white"><RotateCcw className="h-5 w-5" /></button>
          <button onClick={handleNext} className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white"><ChevronRight className="h-5 w-5" /></button>
          <button onClick={handlePrev} className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white"><ChevronLeft className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
