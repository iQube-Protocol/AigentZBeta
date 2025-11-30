'use client';

import { TenantSwitcher } from '@/components/crm/TenantSwitcher';
import { CrmProvider, useCrmContext } from './CrmContext';

function CrmLayoutContent({ children }: { children: React.ReactNode }) {
  const { currentTenantId, setCurrentTenant } = useCrmContext();

  return (
    <div className="space-y-6">
      {/* CRM Header with Tenant Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <TenantSwitcher 
            currentTenantId={currentTenantId}
            onTenantChange={setCurrentTenant}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>AgentiQ CRM</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-xs">
            Phase 1
          </span>
        </div>
      </div>
      
      {/* Page Content */}
      {children}
    </div>
  );
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmProvider>
      <CrmLayoutContent>{children}</CrmLayoutContent>
    </CrmProvider>
  );
}
