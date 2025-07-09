/**
 * Backup and Restore functionality for MVV extraction system
 */

import { companyStorage, mvvStorage } from './storage';
import type { Company, MVVData } from '../types';

export interface BackupData {
  version: string;
  timestamp: string;
  companies: Company[];
  mvvData: MVVData[];
  stats: {
    totalCompanies: number;
    companiesWithMVV: number;
    companiesWithEmbeddings: number;
    fullyCompleted: number;
    statusBreakdown: {
      pending: number;
      processing: number;
      mvv_extracted: number;
      fully_completed: number;
      mvv_extraction_error: number;
      embeddings_generation_error: number;
      error: number;
    };
  };
}

export interface RestoreResult {
  success: boolean;
  stats: {
    total: number;
    updated: number;
    created: number;
    skipped: number;
    errors: number;
  };
  errors: Array<{
    companyName: string;
    error: string;
  }>;
}

/**
 * Create a complete backup of all company and MVV data
 */
export async function createBackup(): Promise<BackupData> {
  try {
    console.log('Creating backup...');
    
    const [companies, mvvData] = await Promise.all([
      companyStorage.getAll(),
      mvvStorage.getAll()
    ]);
    
    // Calculate statistics
    const companiesWithMVV = companies.filter(c => c.mission || c.vision || c.values).length;
    const companiesWithEmbeddings = companies.filter(c => c.embeddings && c.embeddings.length > 0).length;
    const fullyCompleted = companies.filter(c => c.status === 'fully_completed').length;
    
    // Calculate detailed status breakdown
    const statusBreakdown = {
      pending: companies.filter(c => c.status === 'pending').length,
      processing: companies.filter(c => c.status === 'processing').length,
      mvv_extracted: companies.filter(c => c.status === 'mvv_extracted').length,
      fully_completed: companies.filter(c => c.status === 'fully_completed').length,
      mvv_extraction_error: companies.filter(c => c.status === 'mvv_extraction_error').length,
      embeddings_generation_error: companies.filter(c => c.status === 'embeddings_generation_error').length,
      error: companies.filter(c => c.status === 'error').length
    };
    
    console.log('Backup statistics:', {
      totalCompanies: companies.length,
      companiesWithMVV,
      companiesWithEmbeddings,
      fullyCompleted,
      statusBreakdown
    });
    
    const backup: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      companies,
      mvvData,
      stats: {
        totalCompanies: companies.length,
        companiesWithMVV,
        companiesWithEmbeddings,
        fullyCompleted,
        statusBreakdown
      }
    };
    
    console.log('Backup created successfully:', backup.stats);
    return backup;
    
  } catch (error) {
    console.error('Failed to create backup:', error);
    throw new Error(`Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export backup data as downloadable JSON file
 */
export async function exportBackup(): Promise<void> {
  try {
    const backup = await createBackup();
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mvv-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log('Backup exported successfully');
  } catch (error) {
    console.error('Failed to export backup:', error);
    throw error;
  }
}

/**
 * Restore data from backup with intelligent merging
 */
export async function restoreFromBackup(backupData: BackupData): Promise<RestoreResult> {
  try {
    console.log('Starting restore process...');
    
    const result: RestoreResult = {
      success: true,
      stats: {
        total: backupData.companies.length,
        updated: 0,
        created: 0,
        skipped: 0,
        errors: 0
      },
      errors: []
    };
    
    // Get existing companies for comparison
    const existingCompanies = await companyStorage.getAll();
    const existingMap = new Map(existingCompanies.map(c => 
      [`${c.name}|${c.website}`, c]
    ));
    
    // Process each company in the backup
    for (const backupCompany of backupData.companies) {
      try {
        const key = `${backupCompany.name}|${backupCompany.website}`;
        const existingCompany = existingMap.get(key);
        
        if (existingCompany) {
          // Update existing company with backup data
          const updateData = {
            ...backupCompany,
            id: existingCompany.id, // Keep original ID
            createdAt: existingCompany.createdAt, // Keep original creation date
            updatedAt: new Date() // Update timestamp
          };
          
          // Convert date fields that might be strings back to Date objects
          if (updateData.lastProcessed && typeof updateData.lastProcessed === 'string') {
            updateData.lastProcessed = new Date(updateData.lastProcessed);
          }
          
          await companyStorage.update(existingCompany.id, updateData);
          
          result.stats.updated++;
          console.log(`Updated: ${backupCompany.name}`);
        } else {
          // Create new company
          const createData = {
            ...backupCompany,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Convert date fields that might be strings back to Date objects
          if (createData.lastProcessed && typeof createData.lastProcessed === 'string') {
            createData.lastProcessed = new Date(createData.lastProcessed);
          }
          
          await companyStorage.create(createData);
          
          result.stats.created++;
          console.log(`Created: ${backupCompany.name}`);
        }
      } catch (error) {
        result.stats.errors++;
        result.errors.push({
          companyName: backupCompany.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Failed to restore ${backupCompany.name}:`, error);
      }
    }
    
    // Restore MVV data
    console.log('Restoring MVV data...');
    const existingMVVData = await mvvStorage.getAll();
    const existingMVVMap = new Map(existingMVVData.map(m => 
      [m.companyId, m]
    ));
    
    for (const backupMVV of backupData.mvvData) {
      try {
        const existingMVV = existingMVVMap.get(backupMVV.companyId);
        
        if (existingMVV) {
          // Update existing MVV data
          await mvvStorage.update(existingMVV.id!, {
            ...backupMVV,
            id: existingMVV.id,
            extractedAt: new Date(backupMVV.extractedAt)
          });
        } else {
          // Create new MVV data
          await mvvStorage.create({
            ...backupMVV,
            extractedAt: new Date(backupMVV.extractedAt)
          });
        }
      } catch (error) {
        console.error(`Failed to restore MVV data for company ${backupMVV.companyId}:`, error);
      }
    }
    
    console.log('Restore completed:', result.stats);
    return result;
    
  } catch (error) {
    console.error('Restore failed:', error);
    return {
      success: false,
      stats: {
        total: 0,
        updated: 0,
        created: 0,
        skipped: 0,
        errors: 1
      },
      errors: [{
        companyName: 'System',
        error: error instanceof Error ? error.message : 'Unknown error'
      }]
    };
  }
}

/**
 * Validate backup data structure
 */
export function validateBackupData(data: any): data is BackupData {
  try {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'string' &&
      Array.isArray(data.companies) &&
      Array.isArray(data.mvvData) &&
      typeof data.stats === 'object' &&
      typeof data.stats.totalCompanies === 'number'
    );
  } catch {
    return false;
  }
}

/**
 * Import backup from file
 */
export async function importBackupFromFile(file: File): Promise<RestoreResult> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!validateBackupData(data)) {
      throw new Error('Invalid backup file format');
    }
    
    return await restoreFromBackup(data);
    
  } catch (error) {
    console.error('Failed to import backup:', error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}