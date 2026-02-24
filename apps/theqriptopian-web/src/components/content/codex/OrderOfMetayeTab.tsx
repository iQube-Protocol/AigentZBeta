/**
 * OrderOfMetayeTab - Membership, rewards, and social utilities
 */

import { Crown, Gift, Users, Star, Shield } from 'lucide-react';

export function OrderOfMetayeTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          Order of Metayé
        </h3>
        <p className="text-sm text-white/60 mt-1">
          The sacred fellowship of metaKnyts guardians
        </p>
      </div>

      <div className="text-center py-12 bg-gradient-to-br from-yellow-900/20 to-amber-900/20 rounded-lg border border-white/10">
        <Shield className="w-12 h-12 mx-auto mb-4 text-yellow-400/50" />
        <h4 className="text-lg font-medium text-white mb-2">Welcome to the Order</h4>
        <p className="text-sm text-white/60 max-w-lg mx-auto mb-6">
          The Order of Metayé is an exclusive fellowship for dedicated guardians of the metaKnyts universe. 
          Members gain access to exclusive rewards, social utilities, and the power to shape the future of our saga.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
          <div className="p-4 bg-white/5 rounded-lg">
            <Crown className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Membership Tiers</h5>
            <p className="text-xs text-white/50 mt-1">Initiate, Guardian, Elder, and Archon ranks</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <Gift className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Exclusive Rewards</h5>
            <p className="text-xs text-white/50 mt-1">Airdrops, early access, and limited editions</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <Users className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <h5 className="text-sm font-medium text-white">Social Utilities</h5>
            <p className="text-xs text-white/50 mt-1">Community governance and social assets</p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 max-w-md mx-auto">
          <Star className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-yellow-200/80">
            Membership opens soon. Collect Digital Scrolls to qualify for early access.
          </p>
        </div>
      </div>
    </div>
  );
}
