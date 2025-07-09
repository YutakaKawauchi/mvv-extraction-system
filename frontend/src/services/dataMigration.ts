/**
 * Data migration utilities for transitioning from old schema to new schema
 * Extended to support CompanyInfo migration
 */

import { companyStorage, mvvStorage, db } from './storage';
import { apiClient } from './apiClient';
import { generateCategoryFromIndustryClassification } from '../types/companyInfo';
import type { Company, CompanyInfo, CompanyInfoExtractionRequest } from '../types';

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

// ========================================
// Company Info Migration System
// ========================================

/**
 * Company info migration result interface
 */
export interface CompanyInfoMigrationResult {
  totalCompanies: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    companyId: string;
    companyName: string;
    error: string;
  }>;
}

/**
 * Company Info Migration Service
 */
export class CompanyInfoMigrationService {
  private static instance: CompanyInfoMigrationService;
  
  public static getInstance(): CompanyInfoMigrationService {
    if (!CompanyInfoMigrationService.instance) {
      CompanyInfoMigrationService.instance = new CompanyInfoMigrationService();
    }
    return CompanyInfoMigrationService.instance;
  }

  /**
   * 企業情報が不足している企業を取得
   */
  async getCompaniesNeedingInfo(): Promise<Company[]> {
    try {
      const companies = await companyStorage.getAll();
      const companiesNeedingInfo: Company[] = [];

      for (const company of companies) {
        // 企業情報が存在するかチェック
        const existingInfo = await db.companyInfo
          .where('companyId')
          .equals(company.id)
          .first();

        if (!existingInfo) {
          companiesNeedingInfo.push(company);
        }
      }

      return companiesNeedingInfo;
    } catch (error) {
      console.error('Error getting companies needing info:', error);
      return [];
    }
  }

  /**
   * 企業情報を取得して保存
   */
  async extractAndSaveCompanyInfo(company: Company): Promise<void> {
    const request: CompanyInfoExtractionRequest = {
      companyId: company.id,
      companyName: company.name,
      companyWebsite: company.website,
      includeFinancials: true,
      includeESG: true,
      includeCompetitors: true
    };

    try {
      const response = await apiClient.extractCompanyInfo(request);
      
      // APIレスポンスの検証
      if (!response) {
        throw new Error('No data received from API');
      }
      
      // レスポンスをCompanyInfo形式に変換
      const companyInfo: CompanyInfo = {
        companyId: company.id,
        foundedYear: response.founded_year || undefined,
        employeeCount: response.employee_count || undefined,
        headquartersLocation: response.headquarters_location || undefined,
        prefecture: response.prefecture || undefined,
        city: response.city || undefined,
        postalCode: response.postal_code || undefined,
        
        // 財務情報
        revenue: response.financial_data?.revenue || undefined,
        revenueYear: response.financial_data?.revenue_year || undefined,
        operatingProfit: response.financial_data?.operating_profit || undefined,
        netProfit: response.financial_data?.net_profit || undefined,
        marketCap: response.financial_data?.market_cap || undefined,
        
        // 事業構造
        businessSegments: response.business_structure?.segments || undefined,
        mainProducts: response.business_structure?.main_products || undefined,
        marketShare: response.business_structure?.market_share || undefined,
        overseasRevenueRatio: response.business_structure?.overseas_revenue_ratio || undefined,
        
        // 上場情報
        listingStatus: response.listing_info?.status || 'unknown',
        stockCode: response.listing_info?.stock_code || undefined,
        stockExchange: response.listing_info?.exchange || undefined,
        
        // 産業分類
        industryClassification: {
          jsicMajorCategory: response.industry_classification?.jsic_major_category || undefined,
          jsicMajorName: response.industry_classification?.jsic_major_name || undefined,
          jsicMiddleCategory: response.industry_classification?.jsic_middle_category || undefined,
          jsicMiddleName: response.industry_classification?.jsic_middle_name || undefined,
          jsicMinorCategory: response.industry_classification?.jsic_minor_category || undefined,
          jsicMinorName: response.industry_classification?.jsic_minor_name || undefined,
          primaryIndustry: response.industry_classification?.primary_industry || undefined,
          businessType: response.industry_classification?.business_type || undefined,
        },
        
        // 組織情報
        averageAge: response.organization_info?.average_age || undefined,
        averageTenure: response.organization_info?.average_tenure || undefined,
        femaleManagerRatio: response.organization_info?.female_manager_ratio || undefined,
        newGraduateHires: response.organization_info?.new_graduate_hires || undefined,
        
        // ESG情報
        esgScore: response.esg_info?.score || undefined,
        co2ReductionTarget: response.esg_info?.co2_target || undefined,
        socialContribution: response.esg_info?.social_activities || undefined,
        
        // 競合情報
        mainCompetitors: response.competitive_info?.main_competitors || undefined,
        industryPosition: response.competitive_info?.industry_position || undefined,
        competitiveAdvantages: response.competitive_info?.advantages || undefined,
        
        // メタ情報
        dataSourceUrls: response.metadata?.sources || [],
        lastUpdated: new Date(),
        dataConfidenceScore: response.metadata?.confidence_score || 0
      };

      // 企業情報を保存
      await db.companyInfo.add({
        ...companyInfo,
        lastUpdated: companyInfo.lastUpdated.getTime()
      });

      // 企業のカテゴリーを自動更新
      const generatedCategory = generateCategoryFromIndustryClassification(companyInfo.industryClassification);
      
      await companyStorage.update(company.id, {
        category: generatedCategory
      });

      console.log(`✅ Successfully extracted info for ${company.name}`);
    } catch (error) {
      console.error(`❌ Failed to extract info for ${company.name}:`, error);
      throw error;
    }
  }

  /**
   * バッチ処理で企業情報を取得
   */
  async batchExtractCompanyInfo(
    companies: Company[],
    onProgress?: (progress: { current: number; total: number; company: Company }) => void
  ): Promise<CompanyInfoMigrationResult> {
    const result: CompanyInfoMigrationResult = {
      totalCompanies: companies.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    console.log(`🚀 Starting batch extraction for ${companies.length} companies`);

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      
      try {
        onProgress?.({
          current: i + 1,
          total: companies.length,
          company
        });

        await this.extractAndSaveCompanyInfo(company);
        result.succeeded++;
        
        // API制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          companyId: company.id,
          companyName: company.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      result.processed++;
    }

    console.log('🎉 Batch extraction completed:', result);
    return result;
  }

  /**
   * 企業情報の統計を取得
   */
  async getCompanyInfoStats(): Promise<{
    totalCompanies: number;
    companiesWithInfo: number;
    companiesWithoutInfo: number;
    completionRate: number;
  }> {
    try {
      const totalCompanies = await db.companies.count();
      const companiesWithInfo = await db.companyInfo.count();
      const companiesWithoutInfo = totalCompanies - companiesWithInfo;
      const completionRate = totalCompanies > 0 ? (companiesWithInfo / totalCompanies) * 100 : 0;

      return {
        totalCompanies,
        companiesWithInfo,
        companiesWithoutInfo,
        completionRate
      };
    } catch (error) {
      console.error('Error getting company info stats:', error);
      return {
        totalCompanies: 0,
        companiesWithInfo: 0,
        companiesWithoutInfo: 0,
        completionRate: 0
      };
    }
  }

  /**
   * 企業情報をリセット（開発用）
   */
  async resetCompanyInfo(): Promise<void> {
    try {
      await db.companyInfo.clear();
      console.log('🗑️ Company info cleared');
    } catch (error) {
      console.error('Error clearing company info:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const companyInfoMigrationService = CompanyInfoMigrationService.getInstance();