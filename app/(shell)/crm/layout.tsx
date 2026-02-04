'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TenantSwitcher } from '@/components/crm/TenantSwitcher';
import { CrmProvider, useCrmContext } from './CrmContext';

const NAV_ITEMS = [
  { href: '/crm', label: 'Dashboard', icon: '📊' },
  { href: '/crm/tasks', label: 'Tasks', icon: '✅' },
  { href: '/crm/personas', label: 'Personas', icon: '👤' },
  { href: '/crm/rewards', label: 'Rewards', icon: '🎁' },
  { href: '/crm/segments', label: 'Segments', icon: '🎯' },
];

function CrmLayoutContent({ children }: { children: React.ReactNode }) {
  const { currentTenantId, setCurrentTenant } = useCrmContext();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Logo/Title */}
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white">AgentiQ</span>
                <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs ring-1 ring-fuchsia-500/30">
                  CRM
                </span>
              </div>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/crm' && !!pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="mr-1.5">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <TenantSwitcher 
                currentTenantId={currentTenantId}
                onTenantChange={setCurrentTenant}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
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
