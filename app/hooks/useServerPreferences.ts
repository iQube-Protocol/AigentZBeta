import { useState, useEffect, useCallback } from 'react';
import { useOptionalSmartTriad } from '../components/content';

interface ServerPreferencesOptions {
  category?: 'feature_flag' | 'ui_preference' | 'consent' | 'workflow';
  keys?: string[];
  autoSync?: boolean;
}

interface PreferenceState {
  [key: string]: any;
}

/**
 * useServerPreferences Hook
 * 
 * Replaces localStorage with server-driven state management
 * Integrates with SmartTriad for user identification
 */
export function useServerPreferences(options: ServerPreferencesOptions = {}) {
  const { category, keys, autoSync = true } = options;
  const triadContext = useOptionalSmartTriad();
  
  const [preferences, setPreferences] = useState<PreferenceState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Get user ID from SmartTriad or generate session-based ID
  const getUserId = useCallback(() => {
    // Try to get authenticated user ID first
    if (triadContext?.personaId) {
      return `persona_${triadContext.personaId}`;
    }
    
    // Fallback to session-based ID
    let sessionId = sessionStorage.getItem('server_prefs_session_id');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('server_prefs_session_id', sessionId);
    }
    
    return sessionId;
  }, [triadContext?.personaId]);

  // Load preferences from server
  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = getUserId();
      const params = new URLSearchParams({ userId });
      
      if (category) params.append('category', category);
      if (keys && keys.length > 0) params.append('keys', keys.join(','));
      
      const response = await fetch(`/api/ops/state/user-preferences?${params}`);
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to load preferences');
      }
      
      setPreferences(result.preferences || {});
    } catch (err: any) {
      console.error('Failed to load server preferences:', err);
      setError(err.message);
      
      // Fallback to localStorage for critical preferences during migration
      if (typeof window !== 'undefined') {
        const fallback: PreferenceState = {};
        keys?.forEach(key => {
          try {
            const value = localStorage.getItem(key);
            if (value !== null) {
              fallback[key] = value === 'true' ? true : value === 'false' ? false : value;
            }
          } catch {}
        });
        if (Object.keys(fallback).length > 0) {
          setPreferences(fallback);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [getUserId, category, keys]);

  // Save preferences to server
  const savePreferences = useCallback(async (newPreferences: Partial<PreferenceState>) => {
    try {
      setSaving(true);
      setError(null);
      
      const userId = getUserId();
      
      const response = await fetch('/api/ops/state/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          preferences: newPreferences,
        }),
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to save preferences');
      }
      
      // Update local state
      setPreferences(prev => ({ ...prev, ...newPreferences }));
      
      // Also update localStorage as backup during migration
      if (typeof window !== 'undefined') {
        Object.entries(newPreferences).forEach(([key, value]) => {
          try {
            if (value === null || value === undefined) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, String(value));
            }
          } catch {}
        });
      }
      
      return result;
    } catch (err: any) {
      console.error('Failed to save server preferences:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [getUserId]);

  // Set a single preference
  const setPreference = useCallback(async (key: string, value: any) => {
    await savePreferences({ [key]: value });
  }, [savePreferences]);

  // Get a single preference
  const getPreference = useCallback((key: string, defaultValue?: any) => {
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
  }, [preferences]);

  // Clear preferences
  const clearPreferences = useCallback(async (keys?: string[]) => {
    try {
      const userId = getUserId();
      const params = new URLSearchParams({ userId });
      
      if (keys && keys.length > 0) {
        params.append('keys', keys.join(','));
      }
      
      const response = await fetch(`/api/ops/state/user-preferences?${params}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to clear preferences');
      }
      
      // Update local state
      if (keys && keys.length > 0) {
        const newPrefs = { ...preferences };
        keys.forEach(key => delete newPrefs[key]);
        setPreferences(newPrefs);
      } else {
        setPreferences({});
      }
      
      // Also clear localStorage
      if (typeof window !== 'undefined') {
        keys?.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });
      }
      
      return result;
    } catch (err: any) {
      console.error('Failed to clear server preferences:', err);
      setError(err.message);
      throw err;
    }
  }, [getUserId, preferences]);

  // Load preferences on mount and when dependencies change
  useEffect(() => {
    if (autoSync) {
      loadPreferences();
    }
  }, [loadPreferences, autoSync]);

  return {
    preferences,
    loading,
    error,
    saving,
    loadPreferences,
    savePreferences,
    setPreference,
    getPreference,
    clearPreferences,
    userId: getUserId(),
  };
}

/**
 * Specific hooks for common preference types
 */
export function useFeatureFlags(featureNames?: string[]) {
  return useServerPreferences({
    category: 'feature_flag',
    keys: featureNames,
  });
}

export function useUIPreferences(keys?: string[]) {
  return useServerPreferences({
    category: 'ui_preference',
    keys,
  });
}

export function useConsentState() {
  const { preferences, setPreference, getPreference, ...rest } = useServerPreferences({
    category: 'consent',
    keys: ['x402_alias_consent'],
  });
  
  const aliasConsent = getPreference('x402_alias_consent', false);
  
  return {
    aliasConsent,
    setAliasConsent: (value: boolean) => setPreference('x402_alias_consent', value),
    preferences,
    setPreference,
    getPreference,
    ...rest,
  };
}
