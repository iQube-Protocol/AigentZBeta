/**
 * DIAGNOSTIC VIEWER ONLY — this is NOT Ian's real collaboration UI.
 *
 * Raw, developer-facing dump of `/api/journey/ian/state` +
 * `/api/journey/ian/surfaces` — stage ids, evidence field names, receipt
 * refs. For debugging the resolver and evidence wiring only.
 *
 * Ian's real experience is /bridge/ocsga (app/bridge/ocsga/page.tsx),
 * rendered via IanJourneyTab / JourneyRunSurface with plain-language
 * stepper, capability surfaces, and Companion guidance — no raw stage ids
 * or developer terminology there.
 *
 * Access: /admin/journey/ian (admin-only, subject to role checks)
 */

import { IanJourneyViewer } from '@/components/journey/IanJourneyViewer';

export const metadata = {
  title: 'Ian Journey — Diagnostic Viewer',
  description: 'Developer diagnostic dump of Journey Spine state resolution. Not the participant experience.',
};

export default function IanJourneyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b bg-amber-50 px-6 py-4">
        <h1 className="text-xl font-bold">Ian Boundary Research Journey — Diagnostic Viewer</h1>
        <p className="text-sm text-gray-600 mt-1">
          Raw developer view of resolved Journey Spine state. This is NOT the participant
          experience — that lives at{' '}
          <a href="/bridge/ocsga" className="underline text-violet-700">
            /bridge/ocsga
          </a>
          .
        </p>
      </div>
      <IanJourneyViewer />
    </div>
  );
}
