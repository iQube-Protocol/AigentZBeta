/**
 * DigiTerraTab - Game-related assets, myths, and Lunapunk content
 */

import { useState, useEffect } from 'react';
import { Loader2, Gamepad2, Sparkles, Play, Image } from 'lucide-react';

interface GameAsset {
  id: string;
  title: string;
  asset_kind: string;
  auto_drive_cid: string;
  episode_number: number | null;
}

export function DigiTerraTab() {
  const [gameAssets, setGameAssets] = useState<GameAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssets() {
      try {
        setLoading(true);
        const apiBase = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiBase}/api/content/assets?kinds=game_concept_doc,game_still,game_video`);
        if (res.ok) {
          const data = await res.json();
          setGameAssets(data.assets || []);
        }
      } catch (err) {
        console.error('[DigiTerraTab] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAssets();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-white/70">Loading DigiTerra...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
          DigiTerra
        </h3>
        <p className="text-sm text-white/60 mt-1">
          The digital realm where myths come alive and Lunapunk dreams take form
        </p>
      </div>

      {gameAssets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {gameAssets.map((asset) => (
            <div
              key={asset.id}
              className="group relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-white/10 hover:border-purple-400/50 cursor-pointer transition-all"
            >
              {asset.asset_kind === 'game_still' && (
                <img
                  src={`/api/content/image/${asset.auto_drive_cid}`}
                  alt={asset.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-sm font-medium text-white">{asset.title}</p>
                <p className="text-xs text-purple-400">{asset.asset_kind.replace(/_/g, ' ')}</p>
              </div>
              {asset.asset_kind === 'game_video' && (
                <div className="absolute top-2 right-2">
                  <Play className="w-4 h-4 text-purple-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-lg border border-white/10">
          <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-purple-400/50" />
          <h4 className="text-lg font-medium text-white mb-2">Welcome to DigiTerra</h4>
          <p className="text-sm text-white/60 max-w-md mx-auto mb-4">
            DigiTerra is the digital realm where the myths of metaKnyts come alive. 
            Here you'll find game concepts, interactive experiences, and the Lunapunk aesthetic 
            that defines our vision of a decentralized future.
          </p>
          <div className="flex justify-center gap-4 text-xs text-white/40">
            <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> Games</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Lunapunk</span>
            <span className="flex items-center gap-1"><Image className="w-3 h-3" /> Concept Art</span>
          </div>
        </div>
      )}
    </div>
  );
}
