/**
 * Ian Boundary Research Journey — Admin Test Page
 *
 * Stage 4 integration test page. Displays the current state of Ian journey
 * for an authenticated persona, using the `/api/journey/ian/*` routes.
 *
 * Access: /admin/journey/ian (admin-only, subject to role checks)
 */

import { IanJourneyViewer } from '@/components/journey/IanJourneyViewer';

export const metadata = {
  title: 'Ian Journey Test',
  description: 'Journey Spine integration test — Ian Boundary Research crossing',
};

export default function IanJourneyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-slate-50 px-6 py-4">
        <h1 className="text-xl font-bold">Ian Boundary Research Journey</h1>
        <p className="text-sm text-gray-600 mt-1">
          Stage 4 Integration Test — Journey Spine state resolver
        </p>
      </div>
      <IanJourneyViewer />
    </div>
  );
}
