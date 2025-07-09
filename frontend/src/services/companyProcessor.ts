/**
 * 新規企業登録時の自動連携処理
 * MVV抽出 → 企業情報抽出 → カテゴリー自動更新
 */

import { apiClient } from './apiClient';
import { companyStorage, mvvStorage, db } from './storage';
import { companyInfoMigrationService } from './dataMigration';
import { generateCategoryFromIndustryClassification } from '../types/companyInfo';
import type { Company, CompanyFormData, MVVExtractionRequest } from '../types';

export interface CompanyProcessingResult {
  success: boolean;
  company: Company;
  steps: {
    companyCreated: boolean;
    mvvExtracted: boolean;
    companyInfoExtracted: boolean;
    categoryUpdated: boolean;
  };
  errors: string[];
}

export interface CompanyProcessingProgress {
  currentStep: 'creating' | 'extracting_mvv' | 'extracting_info' | 'updating_category' | 'completed';
  currentStepName: string;
  progress: number; // 0-100
  company: Company;
}

/**
 * 新規企業の完全自動処理
 */
export class CompanyProcessor {
  private static instance: CompanyProcessor;
  
  public static getInstance(): CompanyProcessor {
    if (!CompanyProcessor.instance) {
      CompanyProcessor.instance = new CompanyProcessor();
    }
    return CompanyProcessor.instance;
  }

  /**
   * 新規企業の完全自動処理
   */
  async processNewCompany(
    formData: CompanyFormData,
    onProgress?: (progress: CompanyProcessingProgress) => void
  ): Promise<CompanyProcessingResult> {
    const result: CompanyProcessingResult = {
      success: false,
      company: {} as Company,
      steps: {
        companyCreated: false,
        mvvExtracted: false,
        companyInfoExtracted: false,
        categoryUpdated: false
      },
      errors: []
    };

    try {
      // Step 1: 企業を作成
      onProgress?.({
        currentStep: 'creating',
        currentStepName: '企業を登録中...',
        progress: 10,
        company: {} as Company
      });

      const companyId = await companyStorage.create({
        id: crypto.randomUUID(),
        name: formData.name,
        website: formData.website,
        category: formData.category,
        notes: formData.notes,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const company = await companyStorage.getById(companyId);
      if (!company) {
        throw new Error('企業の作成に失敗しました');
      }

      result.company = company;
      result.steps.companyCreated = true;

      // Step 2: MVV抽出
      onProgress?.({
        currentStep: 'extracting_mvv',
        currentStepName: 'MVV情報を抽出中...',
        progress: 30,
        company
      });

      await this.extractMVV(company);
      result.steps.mvvExtracted = true;

      // Step 3: 企業情報抽出
      onProgress?.({
        currentStep: 'extracting_info',
        currentStepName: '企業情報を抽出中...',
        progress: 60,
        company
      });

      await this.extractCompanyInfo(company);
      result.steps.companyInfoExtracted = true;

      // Step 4: カテゴリー自動更新
      onProgress?.({
        currentStep: 'updating_category',
        currentStepName: 'カテゴリーを更新中...',
        progress: 80,
        company
      });

      await this.updateCategoryFromIndustryClassification(company);
      result.steps.categoryUpdated = true;

      // 完了
      const updatedCompany = await companyStorage.getById(company.id);
      if (updatedCompany) {
        result.company = updatedCompany;
      }

      onProgress?.({
        currentStep: 'completed',
        currentStepName: '処理完了',
        progress: 100,
        company: result.company
      });

      result.success = true;
      console.log('✅ Company processing completed successfully:', result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      console.error('❌ Company processing failed:', error);
      
      // 失敗時は企業のステータスをエラーに更新
      if (result.company.id) {
        await companyStorage.update(result.company.id, {
          status: 'error',
          errorMessage: errorMessage
        });
      }
    }

    return result;
  }

  /**
   * MVV抽出処理
   */
  private async extractMVV(company: Company): Promise<void> {
    try {
      // ステータスを処理中に更新
      await companyStorage.update(company.id, { status: 'processing' });

      const mvvRequest: MVVExtractionRequest = {
        companyId: company.id,
        companyName: company.name,
        companyWebsite: company.website
      };

      // Perplexity APIを使用（高速・高品質）
      const mvvData = await apiClient.extractMVVPerplexity(mvvRequest);

      if (!mvvData) {
        throw new Error('MVVデータの取得に失敗しました');
      }

      // MVVデータを保存
      await mvvStorage.create({
        companyId: company.id,
        version: 1,
        mission: mvvData.mission || null,
        vision: mvvData.vision || null,
        values: mvvData.values,
        confidenceScores: mvvData.confidence_scores,
        source: 'perplexity',
        extractedFrom: mvvData.extracted_from,
        extractedAt: new Date(),
        isActive: true
      });

      // 企業レコードにMVV情報をコピー（高速アクセス用）
      await companyStorage.update(company.id, {
        status: 'mvv_extracted',
        mission: mvvData.mission || undefined,
        vision: mvvData.vision || undefined,
        values: Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values,
        lastProcessed: new Date(),
        errorMessage: undefined // エラーをクリア
      });

      console.log(`✅ MVV extracted for ${company.name}`);

    } catch (error) {
      console.error(`❌ MVV extraction failed for ${company.name}:`, error);
      await companyStorage.update(company.id, {
        status: 'mvv_extraction_error',
        errorMessage: error instanceof Error ? error.message : 'MVV抽出エラー'
      });
      throw error;
    }
  }

  /**
   * 企業情報抽出処理
   */
  private async extractCompanyInfo(company: Company): Promise<void> {
    try {
      await companyInfoMigrationService.extractAndSaveCompanyInfo(company);
      console.log(`✅ Company info extracted for ${company.name}`);

    } catch (error) {
      console.error(`❌ Company info extraction failed for ${company.name}:`, error);
      // 企業情報抽出の失敗は致命的ではないので、ログに残すだけ
      // MVV抽出が成功していればmvv_extractedのまま
      throw error;
    }
  }

  /**
   * 産業分類からカテゴリーを自動更新
   */
  private async updateCategoryFromIndustryClassification(company: Company): Promise<void> {
    try {
      // 企業情報から産業分類を取得
      const companyInfo = await db.companyInfo
        .where('companyId')
        .equals(company.id)
        .first();

      if (companyInfo?.industryClassification) {
        const autoGeneratedCategory = generateCategoryFromIndustryClassification(
          companyInfo.industryClassification
        );

        // 自動生成されたカテゴリーで更新
        await companyStorage.update(company.id, {
          category: autoGeneratedCategory
        });

        console.log(`✅ Category updated for ${company.name}: ${autoGeneratedCategory}`);
      }

    } catch (error) {
      console.error(`❌ Category update failed for ${company.name}:`, error);
      // カテゴリー更新の失敗は致命的ではないので、ログに残すだけ
      throw error;
    }
  }

  /**
   * 単体でMVV抽出のみ実行（既存企業用）
   */
  async extractMVVOnly(
    company: Company,
    onProgress?: (progress: { message: string; progress: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.({ message: 'MVV情報を抽出中...', progress: 50 });
      await this.extractMVV(company);
      onProgress?.({ message: '完了', progress: 100 });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'MVV抽出に失敗しました' 
      };
    }
  }

  /**
   * 単体で企業情報抽出のみ実行（既存企業用）
   */
  async extractCompanyInfoOnly(
    company: Company,
    onProgress?: (progress: { message: string; progress: number }) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.({ message: '企業情報を抽出中...', progress: 50 });
      await this.extractCompanyInfo(company);
      await this.updateCategoryFromIndustryClassification(company);
      onProgress?.({ message: '完了', progress: 100 });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '企業情報抽出に失敗しました' 
      };
    }
  }
}

// シングルトンインスタンスをエクスポート
export const companyProcessor = CompanyProcessor.getInstance();