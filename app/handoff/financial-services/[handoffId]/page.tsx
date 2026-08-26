/**
 * /handoff/financial-services/[handoffId] — the Differ × Financial Services
 * Bridge pilot, part 5: the native metaMe handoff landing route.
 *
 * Thin route wrapper (same pattern as app/bridge/fs/page.tsx) — all logic
 * lives in components/journey/FinancialServicesHandoffLanding.tsx.
 */

import { FinancialServicesHandoffLanding } from '@/components/journey/FinancialServicesHandoffLanding';

export default async function FinancialServicesHandoffPage({
  params,
}: {
  params: Promise<{ handoffId: string }>;
}) {
  const { handoffId } = await params;
  return <FinancialServicesHandoffLanding handoffId={handoffId} />;
}
