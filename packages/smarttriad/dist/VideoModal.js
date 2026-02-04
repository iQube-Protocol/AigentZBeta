import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * VideoModal - Fullscreen video player with carousel navigation
 * Part of @agentiq/smarttriad system for estate-wide use
 */
import { useState, useRef, useEffect } from "react";
import { X, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
export function VideoModal({ isOpen, onClose, items, initialIndex = 0 }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const videoRef = useRef(null);
    const currentItem = items[currentIndex];
    useEffect(() => {
        if (isOpen)
            setCurrentIndex(initialIndex);
    }, [isOpen, initialIndex]);
    if (!isOpen || !currentItem)
        return null;
    const handlePrev = () => setCurrentIndex((p) => (p === 0 ? items.length - 1 : p - 1));
    const handleNext = () => setCurrentIndex((p) => (p === items.length - 1 ? 0 : p + 1));
    const handleReplay = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-[60] bg-black/95 backdrop-blur-2xl flex items-center justify-center", children: _jsxs("div", { className: "relative w-full h-full flex items-center justify-center", children: [_jsx("video", { ref: videoRef, src: currentItem.videoUrl, className: "max-w-full max-h-full object-contain", autoPlay: true, loop: true, controls: true }), _jsx("div", { className: "absolute bottom-8 left-1/2 -translate-x-1/2", children: _jsxs("span", { className: "text-cyan-400 text-sm", children: ["Duration: ", currentItem.duration || "0:00"] }) }), _jsxs("div", { className: "absolute top-4 right-4 flex flex-col gap-2 z-[70]", children: [_jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                onClose();
                            }, className: "w-10 h-10 rounded-full bg-black/50 border border-white/20 hover:bg-black/70 flex items-center justify-center text-white transition-colors", "aria-label": "Close video", children: _jsx(X, { className: "h-5 w-5" }) }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                handleReplay();
                            }, className: "w-10 h-10 rounded-full bg-black/50 border border-white/20 hover:bg-black/70 flex items-center justify-center text-white transition-colors", "aria-label": "Replay video", children: _jsx(RotateCcw, { className: "h-5 w-5" }) })] }), items.length > 1 && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                handlePrev();
                            }, className: "absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white transition-colors z-[210]", "aria-label": "Previous video", children: _jsx(ChevronLeft, { className: "h-6 w-6" }) }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                handleNext();
                            }, className: "absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-white transition-colors z-[210]", "aria-label": "Next video", children: _jsx(ChevronRight, { className: "h-6 w-6" }) })] }))] }) }));
}
