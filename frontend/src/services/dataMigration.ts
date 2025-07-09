/**
 * Data migration utilities for transitioning from old schema to new schema
 */

import { companyStorage, mvvStorage } from './storage';
import type { Company } from '../types';

/**
 * Migration result interface
 */
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  details: {
    pendingCount: number;
    mvvExtractedCount: number;
    fullyCompletedCount: number;
    errorCount: number;
  };
}

/**
 * Migrate existing company data from old status system to new Phase-based system
 */
export async function migrateCompanyStatuses(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    errors: [],
    details: {
      pendingCount: 0,
      mvvExtractedCount: 0,
      fullyCompletedCount: 0,
      errorCount: 0
    }
  };

  try {
    console.log('Starting company status migration...');
    
    // Get all companies
    const companies = await companyStorage.getAll();
    console.log(`Found ${companies.length} companies to migrate`);

    for (const company of companies) {
      try {
        // Skip if already using new status system
        if (company.status === 'mvv_extracted' || company.status === 'fully_completed') {
          console.log(`Company ${company.name} already migrated, skipping`);
          continue;
        }

        let newStatus: Company['status'] = company.status;
        let needsUpdate = false;

        // Handle old "completed" status
        if (company.status === 'completed' as any) {
          needsUpdate = true;
          
          // Check if company has MVV data
          const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
          
          if (mvvData) {
            // Has MVV data - check if has embeddings
            if (company.embeddings && company.embeddings.length > 0) {
              newStatus = 'fully_completed';
              result.details.fullyCompletedCount++;
            } else {
              newStatus = 'mvv_extracted';
              result.details.mvvExtractedCount++;
              
              // Always copy MVV data to company fields for easier access
              await companyStorage.update(company.id, {
                mission: mvvData.mission || undefined,
                vision: mvvData.vision || undefined,
                values: Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values || undefined
              });
            }
          } else {
            // No MVV data but marked as completed - likely needs re-processing
            newStatus = 'pending';
            result.details.pendingCount++;
          }
        } else {
          // Handle other statuses
          switch (company.status) {
            case 'pending':
              result.details.pendingCount++;
              break;
            case 'error':
              result.details.errorCount++;
              break;
            default:
              // Unknown status - set to pending for safety
              newStatus = 'pending';
              needsUpdate = true;
              result.details.pendingCount++;
          }
        }

        // Update company status if needed
        if (needsUpdate) {
          await companyStorage.update(company.id, { status: newStatus });
          result.migratedCount++;
          console.log(`Migrated company ${company.name}: ${company.status} → ${newStatus}`);
        }

      } catch (error) {
        const errorMessage = `Failed to migrate company ${company.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);
      }
    }

    result.success = result.errors.length === 0;
    
    console.log('Migration completed:', {
      migratedCount: result.migratedCount,
      details: result.details,
      errors: result.errors.length
    });

    return result;

  } catch (error) {
    const errorMessage = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    const companies = await companyStorage.getAll();
    
    // Check if any company has old "completed" status
    const hasOldStatus = companies.some(company => 
      company.status === 'completed' as any
    );
    
    return hasOldStatus;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}

/**
 * Clean up orphaned data and optimize database
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    console.log('Starting database cleanup...');
    
    // Get all companies and MVV data
    const companies = await companyStorage.getAll();
    const allMvvData = await mvvStorage.getAll(false); // Get all, including inactive
    
    // Find orphaned MVV data (MVV data without corresponding company)
    const companyIds = new Set(companies.map(c => c.id));
    const orphanedMvvData = allMvvData.filter(mvv => !companyIds.has(mvv.companyId));
    
    if (orphanedMvvData.length > 0) {
      console.log(`Found ${orphanedMvvData.length} orphaned MVV records`);
      // Note: Would need to implement deletion in storage service
      // await mvvStorage.deleteOrphaned(orphanedMvvData.map(mvv => mvv.id));
    }
    
    console.log('Database cleanup completed');
  } catch (error) {
    console.error('Database cleanup failed:', error);
  }
}

/**
 * Get migration status report
 */
export async function getMigrationReport(): Promise<{
  needsMigration: boolean;
  companyCount: number;
  statusDistribution: Record<string, number>;
}> {
  try {
    const companies = await companyStorage.getAll();
    const statusDistribution: Record<string, number> = {};
    
    companies.forEach(company => {
      statusDistribution[company.status] = (statusDistribution[company.status] || 0) + 1;
    });
    
    const needsMigration = await isMigrationNeeded();
    
    return {
      needsMigration,
      companyCount: companies.length,
      statusDistribution
    };
  } catch (error) {
    console.error('Failed to generate migration report:', error);
    return {
      needsMigration: false,
      companyCount: 0,
      statusDistribution: {}
    };
  }
}