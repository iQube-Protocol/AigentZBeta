/**
 * CodexManagerEmbed - Codex Manager only for embedding
 * 
 * Renders just the Codex Manager with Autonomys upload functionality.
 * Route: /triad/admin/codex?codex=knyt|qriptopian
 */

import React from 'react';
import { EmbedLayout } from '../embed/EmbedLayout';
import CodexManager from '@/pages/admin/content/CodexManager';
import { useIsAdminAA } from '@/hooks/useIsAdminAA';

export default function CodexManagerEmbed() {
  const { isAdmin, loading } = useIsAdminAA();

  if (loading) {
    return (
      <EmbedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-white/50">Loading codex manager...</div>
        </div>
      </EmbedLayout>
    );
  }

  if (!isAdmin) {
    return (
      <EmbedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-red-400">Access denied. Admin privileges required.</div>
        </div>
      </EmbedLayout>
    );
  }

  return (
    <EmbedLayout>
      <div className="h-full overflow-auto">
        <CodexManager />
      </div>
    </EmbedLayout>
  );
}
