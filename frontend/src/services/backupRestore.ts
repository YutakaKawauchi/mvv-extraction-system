/**
 * Backup and Restore functionality for MVV extraction system
 */

import { companyStorage, mvvStorage, db } from './storage';
import type { Company, MVVData, CompanyInfo } from '../types';

export interface BackupData {
  version: string;
  timestamp: string;
  companies: Company[];
  mvvData: MVVData[];
  companyInfo: CompanyInfo[]; // 企業情報を追加
  stats: {
    totalCompanies: number;
    companiesWithMVV: number;
    companiesWithEmbeddings: number;
    companiesWithInfo: number; // 企業情報数を追加
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
  // 詳細統計
  details: {
    companies: { total: number; updated: number; created: number; };
    mvvData: { total: number; updated: number; created: number; };
    companyInfo: { total: number; updated: number; created: number; }; // 企業情報統計
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
    
    const [companies, mvvData, companyInfoData] = await Promise.all([
      companyStorage.getAll(),
      mvvStorage.getAll(),
      db.companyInfo.toArray() // 企業情報を追加
    ]);
    
    // CompanyInfoを正しい形式に変換
    const companyInfo: CompanyInfo[] = companyInfoData.map(info => ({
      ...info,
      lastUpdated: new Date(info.lastUpdated)
    }));
    
    // Calculate statistics
    const companiesWithMVV = companies.filter(c => c.mission || c.vision || c.values).length;
    const companiesWithEmbeddings = companies.filter(c => c.embeddings && c.embeddings.length > 0).length;
    const companiesWithInfo = companyInfo.length; // 企業情報統計を追加
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
      companiesWithInfo,
      fullyCompleted,
      statusBreakdown
    });
    
    const backup: BackupData = {
      version: '2.0.0', // 企業情報対応のためバージョンアップ
      timestamp: new Date().toISOString(),
      companies,
      mvvData,
      companyInfo, // 企業情報を追加
      stats: {
        totalCompanies: companies.length,
        companiesWithMVV,
        companiesWithEmbeddings,
        companiesWithInfo, // 企業情報統計を追加
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
        total: backupData.companies.length + (backupData.companyInfo?.length || 0),
        updated: 0,
        created: 0,
        skipped: 0,
        errors: 0
      },
      details: {
        companies: { total: backupData.companies.length, updated: 0, created: 0 },
        mvvData: { total: backupData.mvvData.length, updated: 0, created: 0 },
        companyInfo: { total: backupData.companyInfo?.length || 0, updated: 0, created: 0 }
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
          result.details.companies.updated++;
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
          result.details.companies.created++;
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
    
    // Restore Company Info data (if available)
    if (backupData.companyInfo && backupData.companyInfo.length > 0) {
      console.log('Restoring company info data...');
      const existingCompanyInfoData = await db.companyInfo.toArray();
      const existingCompanyInfoMap = new Map(existingCompanyInfoData.map(info => 
        [info.companyId, info]
      ));
      
      for (const backupInfo of backupData.companyInfo) {
        try {
          const existingInfo = existingCompanyInfoMap.get(backupInfo.companyId);
          
          if (existingInfo) {
            // Update existing company info
            await db.companyInfo.update(existingInfo.id!, {
              ...backupInfo,
              id: existingInfo.id,
              lastUpdated: new Date(backupInfo.lastUpdated).getTime()
            });
            result.details.companyInfo.updated++;
          } else {
            // Create new company info
            await db.companyInfo.add({
              ...backupInfo,
              lastUpdated: new Date(backupInfo.lastUpdated).getTime()
            });
            result.details.companyInfo.created++;
          }
        } catch (error) {
          console.error(`Failed to restore company info for company ${backupInfo.companyId}:`, error);
          result.stats.errors++;
        }
      }
    }
    
    console.log('Restore completed:', result.stats);
    console.log('Details:', result.details);
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
      details: {
        companies: { total: 0, updated: 0, created: 0 },
        mvvData: { total: 0, updated: 0, created: 0 },
        companyInfo: { total: 0, updated: 0, created: 0 }
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
    const isValid = (
      typeof data === 'object' &&
      data !== null &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'string' &&
      Array.isArray(data.companies) &&
      Array.isArray(data.mvvData) &&
      typeof data.stats === 'object' &&
      typeof data.stats.totalCompanies === 'number'
    );
    
    // 後方互換性: companyInfoがない古いフォーマットも受け入れる
    if (isValid && !data.companyInfo) {
      console.warn('Legacy backup format detected. CompanyInfo will be empty.');
      data.companyInfo = []; // 空の配列で初期化
    }
    
    return isValid;
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