/**
 * LoreTab - Displays lore documents and background content
 * Supports multiple display modes: pdf, image, video, text_extract
 */

import { useState, useEffect } from 'react';
import { Loader2, FileText, BookOpen, Scroll, Image, Video, Sparkles } from 'lucide-react';
import { PDFViewer } from '../PDFViewer';
import { LoreTextReader } from '../LoreTextReader';

type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';

interface LoreAsset {
  id: string;
  title: string;
  asset_kind: string;
  auto_drive_cid: string;
  episode_number: number | null;
  display_mode: DisplayMode | null;
  extracted_text: string | null;
  created_at: string;
}

export function LoreTab() {
  const [loreAssets, setLoreAssets] = useState<LoreAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [textReaderOpen, setTextReaderOpen] = useState(false);
  const [currentPdf, setCurrentPdf] = useState<{ cid: string; title: string } | null>(null);
  const [currentText, setCurrentText] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    async function fetchLore() {
      try {
        setLoading(true);
        const apiBase = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiBase}/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`);
        if (res.ok) {
          const data = await res.json();
          setLoreAssets(data.assets || []);
        }
      } catch (err) {
        console.error('[LoreTab] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLore();
  }, []);

  const openDocument = (asset: LoreAsset) => {
    const mode = asset.display_mode || 'pdf';
    
    if (mode === 'text_extract' && asset.extracted_text) {
      setCurrentText({ title: asset.title, content: asset.extracted_text });
      setTextReaderOpen(true);
    } else {
      // Default to PDF viewer for pdf mode or if no extracted text
      setCurrentPdf({ cid: asset.auto_drive_cid, title: asset.title });
      setPdfOpen(true);
    }
  };

  const getDisplayModeIcon = (mode: DisplayMode | null) => {
    switch (mode) {
      case 'text_extract':
        return <Sparkles className="w-3 h-3 text-cyan-400" />;
      case 'image':
        return <Image className="w-3 h-3 text-purple-400" />;
      case 'video':
        return <Video className="w-3 h-3 text-pink-400" />;
      default:
        return <FileText className="w-3 h-3 text-blue-400" />;
    }
  };

  const getDisplayModeLabel = (mode: DisplayMode | null) => {
    switch (mode) {
      case 'text_extract':
        return 'Copilot Ready';
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      default:
        return 'PDF';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-white/70">Loading Lore...</span>
      </div>
    );
  }

  return (
    <>
      {pdfOpen && currentPdf && (
        <PDFViewer
          pdfUrl={`${import.meta.env.VITE_API_URL || ''}/api/content/pdf/${currentPdf.cid}`}
          title={currentPdf.title}
          onClose={() => { setPdfOpen(false); setCurrentPdf(null); }}
        />
      )}

      {textReaderOpen && currentText && (
        <LoreTextReader
          title={currentText.title}
          content={currentText.content}
          onClose={() => { setTextReaderOpen(false); setCurrentText(null); }}
        />
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Scroll className="w-5 h-5 text-cyan-400" />
            Lore & Legends
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Ancient texts, background lore, and the foundational myths of the metaKnyts universe
          </p>
        </div>

        {loreAssets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loreAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => openDocument(asset)}
                className="group p-4 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-lg border border-white/10 hover:border-cyan-400/50 cursor-pointer transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <FileText className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                      {asset.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-white/50">
                        {asset.episode_number ? `Episode #${asset.episode_number - 1}` : 'Series-wide'}
                      </p>
                      <span className="text-white/20">•</span>
                      <span className="flex items-center gap-1 text-xs text-white/50">
                        {getDisplayModeIcon(asset.display_mode)}
                        {getDisplayModeLabel(asset.display_mode)}
                      </span>
                    </div>
                  </div>
                  <BookOpen className="w-4 h-4 text-white/30 group-hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-lg border border-white/10">
            <Scroll className="w-12 h-12 mx-auto mb-4 text-cyan-400/50" />
            <h4 className="text-lg font-medium text-white mb-2">The Ancient Texts Await</h4>
            <p className="text-sm text-white/60 max-w-md mx-auto">
              Lore documents reveal the deep history and mythology of the metaKnyts universe. 
              Background stories, character origins, and the secrets of the 21 Sats will be unveiled here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
