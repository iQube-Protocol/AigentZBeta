/**
 * TerraTab - Real-world assets and Solarpunk transformation
 */

import { Globe, Sun, Leaf, Heart } from 'lucide-react';

export function TerraTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-green-400" />
          Terra
        </h3>
        <p className="text-sm text-white/60 mt-1">
          Where digital dreams manifest in the physical world
        </p>
      </div>

      <div className="text-center py-12 bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-lg border border-white/10">
        <Sun className="w-12 h-12 mx-auto mb-4 text-yellow-400/50" />
        <h4 className="text-lg font-medium text-white mb-2">Welcome to Terra</h4>
        <p className="text-sm text-white/60 max-w-lg mx-auto mb-6">
          Terra bridges the digital and physical realms. Our mission is to transform the world 
          from its current dystopian metaTerror trajectory toward a Solarpunk metaTerran future—
          one where technology serves humanity and nature in harmony.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
          <div className="p-4 bg-white/5 rounded-lg">
            <Leaf className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Solarpunk Vision</h5>
            <p className="text-xs text-white/50 mt-1">Sustainable futures through regenerative technology</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <Globe className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Real World Impact</h5>
            <p className="text-xs text-white/50 mt-1">Physical events, merchandise, and community gatherings</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <Heart className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Liberation</h5>
            <p className="text-xs text-white/50 mt-1">Freeing DigiTerra to heal and transform Terra</p>
          </div>
        </div>
      </div>
    </div>
  );
}
