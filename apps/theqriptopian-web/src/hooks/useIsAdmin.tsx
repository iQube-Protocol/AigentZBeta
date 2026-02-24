import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

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

        // Use the edge function to check admin status via Aigent Z roles
        const { data, error } = await supabase.functions.invoke('check-admin');

        if (error) {
          console.error('Error calling check-admin function:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(Boolean(data?.isAdmin));
        }
      } catch (error) {
        console.error('Unexpected error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, []);

  return { isAdmin, loading };
}
