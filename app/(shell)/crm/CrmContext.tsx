'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CrmContextType {
  currentTenantId: string;
  currentFranchiseId: string;
  setCurrentTenant: (tenantId: string, franchiseId: string) => void;
}

const CrmContext = createContext<CrmContextType>({
  currentTenantId: 't1',
  currentFranchiseId: 'f1',
  setCurrentTenant: () => {},
});

export const useCrmContext = () => useContext(CrmContext);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [currentTenantId, setCurrentTenantId] = useState('t1');
  const [currentFranchiseId, setCurrentFranchiseId] = useState('f1');

  const setCurrentTenant = (tenantId: string, franchiseId: string) => {
    setCurrentTenantId(tenantId);
    setCurrentFranchiseId(franchiseId);
  };

  return (
    <CrmContext.Provider value={{ currentTenantId, currentFranchiseId, setCurrentTenant }}>
      {children}
    </CrmContext.Provider>
  );
}
