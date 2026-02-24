/**
 * Admin Analytics Page
 * Social sharing analytics dashboard
 */

import { SocialAnalyticsDashboard } from '@/components/admin/SocialAnalyticsDashboard';

export default function AdminAnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SocialAnalyticsDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Social Analytics - Admin',
  description: 'Comprehensive social sharing analytics and insights',
};
