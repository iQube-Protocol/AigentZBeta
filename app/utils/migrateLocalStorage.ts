import React from 'react';

/**
 * Client-Side Migration Helper: localStorage to Server-Driven State
 * 
 * Utility to help migrate existing localStorage data to server preferences
 */

export interface MigrationResult {
  success: boolean;
  migrated: string[];
  failed: Array<{ key: string; error: string }>;
  total: number;
}

export class LocalStorageMigrator {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Collect localStorage data for migration
   */
  collectLocalStorageData(): Record<string, any> {
    const data: Record<string, any> = {};
    
    // Common keys to migrate
    const keysToMigrate = [
      'x402_alias_consent',
      'theme',
      'density', 
      'copilot_open',
      'feature_solana_ops',
      'feature_tier3_batching',
      'agui_session_id',
      // DVN transaction hashes
      'last_tx_80002',
      'last_tx_11155111', 
      'last_tx_137', // Polygon
      'last_tx_43113', // Avalanche
      'last_tx_421614', // Arbitrum Sepolia
      'last_tx_84532', // Base Sepolia
      'amoy_last_tx',
    ];

    keysToMigrate.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      } catch (error) {
        console.warn(`Failed to read localStorage key ${key}:`, error);
      }
    });

    // Also collect any keys that match our patterns
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToMigrate.includes(key)) {
        // Include keys that might be preferences
        if (key.includes('consent') || 
            key.includes('feature_') || 
            key.includes('flag_') ||
            key.includes('theme') ||
            key.includes('layout') ||
            key.includes('drawer') ||
            key.includes('last_tx_')) {
          try {
            const value = localStorage.getItem(key);
            if (value !== null) {
              data[key] = value;
            }
          } catch (error) {
            console.warn(`Failed to read localStorage key ${key}:`, error);
          }
        }
      }
    }

    return data;
  }

  /**
   * Execute migration to server
   */
  async migrateToServer(): Promise<MigrationResult> {
    const localStorageData = this.collectLocalStorageData();
    
    if (Object.keys(localStorageData).length === 0) {
      return {
        success: true,
        migrated: [],
        failed: [],
        total: 0,
      };
    }

    try {
      const response = await fetch('/api/ops/state/migrate-local-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          localStorageData,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Migration failed');
      }

      return result.results;
    } catch (error: any) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    try {
      const response = await fetch(`/api/ops/state/migrate-local-storage?userId=${this.userId}`);
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Failed to get status');
      }

      return result;
    } catch (error: any) {
      console.error('Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Clean up localStorage after successful migration
   */
  cleanupLocalStorage(migratedKeys: string[]) {
    migratedKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key ${key}:`, error);
      }
    });
  }

  /**
   * Full migration process with cleanup
   */
  async fullMigration(): Promise<MigrationResult> {
    try {
      // Check status first
      const status = await this.getMigrationStatus();
      console.log('Migration status:', status.migrationStatus);

      // If nothing to migrate, return early
      if (status.migrationStatus.needsMigrationCount === 0) {
        return {
          success: true,
          migrated: [],
          failed: [],
          total: 0,
        };
      }

      // Execute migration
      const result = await this.migrateToServer();
      
      // Clean up successfully migrated keys
      if (result.success && result.migrated.length > 0) {
        this.cleanupLocalStorage(result.migrated);
        console.log(`Cleaned up ${result.migrated.length} localStorage keys`);
      }

      return result;
    } catch (error: any) {
      console.error('Full migration failed:', error);
      throw error;
    }
  }
}

/**
 * Hook for automatic migration
 */
export function useLocalStorageMigration(userId: string) {
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [migrationResult, setMigrationResult] = React.useState<MigrationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const migrate = React.useCallback(async () => {
    if (!userId) return;

    setIsMigrating(true);
    setError(null);

    try {
      const migrator = new LocalStorageMigrator(userId);
      const result = await migrator.fullMigration();
      setMigrationResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMigrating(false);
    }
  }, [userId]);

  return {
    migrate,
    isMigrating,
    migrationResult,
    error,
  };
}

// Export for use in components
export { LocalStorageMigrator as default };
