import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminCheckMethod = 'aa-api' | 'legacy' | null;

export interface AdminStatus {
  isAdmin: boolean;
  loading: boolean;
  method: AdminCheckMethod;
  did?: string;
}

export function useIsAdminAA(): AdminStatus {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<AdminCheckMethod>(null);
  const [did, setDid] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user:', userError);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Call the new AA-API enabled admin check edge function
        const { data, error } = await supabase.functions.invoke('check-admin-aa');

        if (error) {
          console.error('Error calling check-admin-aa function:', error);
          setIsAdmin(false);
          setMethod(null);
        } else {
          setIsAdmin(Boolean(data?.isAdmin));
          setMethod(data?.method || null);
          setDid(data?.did);
          
          console.log('[useIsAdminAA] Admin check result:', {
            isAdmin: data?.isAdmin,
            method: data?.method,
            did: data?.did,
          });
        }
      } catch (error) {
        console.error('Unexpected error checking admin status:', error);
        setIsAdmin(false);
        setMethod(null);
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, []);

  return { isAdmin, loading, method, did };
}
