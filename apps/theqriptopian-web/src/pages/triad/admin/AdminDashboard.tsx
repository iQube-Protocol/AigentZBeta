/**
 * AdminDashboard - Full admin content management dashboard for embedding
 * 
 * Renders the complete admin dashboard with all content management cards.
 * Route: /triad/admin
 */

import React from 'react';
import { EmbedLayout } from '../embed/EmbedLayout';
import Dashboard from '@/pages/admin/Dashboard';
import { useIsAdminAA } from '@/hooks/useIsAdminAA';

export default function AdminDashboard() {
  const { isAdmin, loading } = useIsAdminAA();

  if (loading) {
    return (
      <EmbedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-white/50">Loading admin dashboard...</div>
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
      <Dashboard />
    </EmbedLayout>
  );
}
