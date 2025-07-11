/**
 * 一括企業情報抽出サービス
 * MVV抽出済みの企業に対して企業情報を一括で抽出し、リカバリを支援
 */

import { companyInfoMigrationService } from './dataMigration';
import { companyInfoAnalyzer } from './companyInfoAnalyzer';
import type { Company } from '../types';

export interface BulkExtractionProgress {
  currentIndex: number;
  total: number;
  currentCompany: Company;
  status: 'processing' | 'success' | 'error' | 'completed';
  message: string;
  errors: Array<{ company: Company; error: string }>;
  successCount: number;
  errorCount: number;
}

export interface BulkExtractionResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ companyName: string; error: string }>;
  processingTime: number;
}

export class BulkCompanyInfoExtractor {
  private isRunning = false;
  private shouldStop = false;

  /**
   * 企業情報未抽出の企業を一括処理
   */
  async extractMissingCompanyInfo(
    onProgress?: (progress: BulkExtractionProgress) => void
  ): Promise<BulkExtractionResult> {
    if (this.isRunning) {
      throw new Error('一括抽出が既に実行中です');
    }

    console.log('🚀 一括企業情報抽出を開始...');
    const startTime = performance.now();
    
    this.isRunning = true;
    this.shouldStop = false;

    const result: BulkExtractionResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      processingTime: 0
    };

    try {
      // 企業情報未抽出の企業を取得
      const companiesNeedingInfo = await companyInfoAnalyzer.getCompaniesNeedingCompanyInfo();
      
      if (companiesNeedingInfo.length === 0) {
        console.log('✅ 企業情報抽出が必要な企業はありません');
        onProgress?.({
          currentIndex: 0,
          total: 0,
          currentCompany: {} as Company,
          status: 'completed',
          message: '企業情報抽出が必要な企業はありません',
          errors: [],
          successCount: 0,
          errorCount: 0
        });
        result.success = true;
        return result;
      }

      console.log(`📋 ${companiesNeedingInfo.length}社の企業情報を抽出します...`);
      
      const errors: Array<{ company: Company; error: string }> = [];

      // 各企業を順次処理
      for (let i = 0; i < companiesNeedingInfo.length; i++) {
        if (this.shouldStop) {
          console.log('⏹️ 一括抽出が停止されました');
          break;
        }

        const company = companiesNeedingInfo[i];
        
        onProgress?.({
          currentIndex: i + 1,
          total: companiesNeedingInfo.length,
          currentCompany: company,
          status: 'processing',
          message: `${company.name}の企業情報を抽出中...`,
          errors,
          successCount: result.successCount,
          errorCount: result.errorCount
        });

        try {
          await this.extractSingleCompanyInfo(company);
          result.successCount++;
          
          console.log(`✅ ${company.name}: 企業情報抽出完了 (${i + 1}/${companiesNeedingInfo.length})`);
          
          // 成功時の進捗通知
          onProgress?.({
            currentIndex: i + 1,
            total: companiesNeedingInfo.length,
            currentCompany: company,
            status: 'success',
            message: `${company.name}: 抽出完了`,
            errors,
            successCount: result.successCount,
            errorCount: result.errorCount
          });

          // レート制限を考慮した待機（Perplexity APIの制限対策）
          if (i < companiesNeedingInfo.length - 1) {
            await this.delay(2000); // 2秒待機
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          errors.push({ company, error: errorMessage });
          result.errorCount++;
          
          console.error(`❌ ${company.name}: 企業情報抽出エラー -`, errorMessage);
          
          onProgress?.({
            currentIndex: i + 1,
            total: companiesNeedingInfo.length,
            currentCompany: company,
            status: 'error',
            message: `${company.name}: エラー - ${errorMessage}`,
            errors,
            successCount: result.successCount,
            errorCount: result.errorCount
          });
        }

        result.totalProcessed++;
      }

      // 完了処理
      result.errors = errors.map(e => ({
        companyName: e.company.name,
        error: e.error
      }));
      
      const endTime = performance.now();
      result.processingTime = endTime - startTime;
      result.success = result.errorCount < result.totalProcessed; // 部分成功も許可

      console.log('📊 一括企業情報抽出完了:', {
        処理数: result.totalProcessed,
        成功: result.successCount,
        エラー: result.errorCount,
        処理時間: `${Math.round(result.processingTime)}ms`
      });

      onProgress?.({
        currentIndex: result.totalProcessed,
        total: companiesNeedingInfo.length,
        currentCompany: {} as Company,
        status: 'completed',
        message: `完了: ${result.successCount}件成功、${result.errorCount}件エラー`,
        errors,
        successCount: result.successCount,
        errorCount: result.errorCount
      });

    } catch (error) {
      console.error('❌ 一括企業情報抽出でエラー:', error);
      result.errors.push({
        companyName: '一括処理',
        error: error instanceof Error ? error.message : '不明なエラー'
      });
      
      onProgress?.({
        currentIndex: 0,
        total: 0,
        currentCompany: {} as Company,
        status: 'error',
        message: `処理エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        errors: [],
        successCount: 0,
        errorCount: 1
      });
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * 単一企業の企業情報抽出
   */
  private async extractSingleCompanyInfo(company: Company): Promise<void> {
    try {
      // APIを1回だけ呼び出し - dataMigrationサービスを使用して重複を避ける
      await companyInfoMigrationService.extractAndSaveCompanyInfo(company);

      console.log(`✅ ${company.name}: 企業情報を保存しました`);

    } catch (error) {
      console.error(`❌ ${company.name}: 企業情報抽出エラー:`, error);
      throw error;
    }
  }

  /**
   * 一括抽出を停止
   */
  stop(): void {
    if (this.isRunning) {
      this.shouldStop = true;
      console.log('⏹️ 一括企業情報抽出の停止を要求しました...');
    }
  }

  /**
   * 実行状態を確認
   */
  isProcessing(): boolean {
    return this.isRunning;
  }

  /**
   * 待機処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 特定の企業リストに対する一括抽出
   */
  async extractForCompanies(
    companies: Company[],
    onProgress?: (progress: BulkExtractionProgress) => void
  ): Promise<BulkExtractionResult> {
    if (this.isRunning) {
      throw new Error('一括抽出が既に実行中です');
    }

    console.log(`🚀 指定された${companies.length}社の企業情報抽出を開始...`);
    const startTime = performance.now();
    
    this.isRunning = true;
    this.shouldStop = false;

    const result: BulkExtractionResult = {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      processingTime: 0
    };

    try {
      const errors: Array<{ company: Company; error: string }> = [];

      for (let i = 0; i < companies.length; i++) {
        if (this.shouldStop) break;

        const company = companies[i];
        
        onProgress?.({
          currentIndex: i + 1,
          total: companies.length,
          currentCompany: company,
          status: 'processing',
          message: `${company.name}の企業情報を抽出中...`,
          errors,
          successCount: result.successCount,
          errorCount: result.errorCount
        });

        try {
          await this.extractSingleCompanyInfo(company);
          result.successCount++;
          
          onProgress?.({
            currentIndex: i + 1,
            total: companies.length,
            currentCompany: company,
            status: 'success',
            message: `${company.name}: 抽出完了`,
            errors,
            successCount: result.successCount,
            errorCount: result.errorCount
          });

          if (i < companies.length - 1) {
            await this.delay(2000);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          errors.push({ company, error: errorMessage });
          result.errorCount++;
          
          onProgress?.({
            currentIndex: i + 1,
            total: companies.length,
            currentCompany: company,
            status: 'error',
            message: `${company.name}: エラー - ${errorMessage}`,
            errors,
            successCount: result.successCount,
            errorCount: result.errorCount
          });
        }

        result.totalProcessed++;
      }

      result.errors = errors.map(e => ({
        companyName: e.company.name,
        error: e.error
      }));
      
      const endTime = performance.now();
      result.processingTime = endTime - startTime;
      result.success = result.errorCount < result.totalProcessed;

      onProgress?.({
        currentIndex: result.totalProcessed,
        total: companies.length,
        currentCompany: {} as Company,
        status: 'completed',
        message: `完了: ${result.successCount}件成功、${result.errorCount}件エラー`,
        errors,
        successCount: result.successCount,
        errorCount: result.errorCount
      });

    } catch (error) {
      console.error('❌ 指定企業の一括抽出でエラー:', error);
      result.errors.push({
        companyName: '一括処理',
        error: error instanceof Error ? error.message : '不明なエラー'
      });
    } finally {
      this.isRunning = false;
    }

    return result;
  }
}

// シングルトンインスタンス
export const bulkCompanyInfoExtractor = new BulkCompanyInfoExtractor();