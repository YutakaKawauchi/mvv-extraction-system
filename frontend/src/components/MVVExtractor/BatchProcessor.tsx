import React, { useState, useCallback } from 'react';
import type { Company, MVVExtractionRequest, MVVData } from '../../types';
import { Button, ProgressBar } from '../common';
import { useApiClient } from '../../hooks/useApiClient';
import { useCompanyStore } from '../../stores/companyStore';
import { useProcessingStore } from '../../stores/processingStore';
import { useMVVStore } from '../../stores/mvvStore';
import { useNotification } from '../../hooks/useNotification';
import { companyInfoMigrationService } from '../../services/dataMigration';
import { db } from '../../services/storage';
import { generateCategoryFromIndustryClassification } from '../../types/companyInfo';
import { CONSTANTS } from '../../utils/constants';
import { chunk, delay } from '../../utils/helpers';
import { formatDuration } from '../../utils/formatters';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

interface BatchProcessorProps {
  selectedCompanies: Company[];
  onComplete?: () => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  selectedCompanies,
  onComplete
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  
  const { extractMVVPerplexity, extractCompanyInfo } = useApiClient();
  const { updateCompany } = useCompanyStore();
  const { addMVVData } = useMVVStore();
  const { success, error: showError } = useNotification();
  
  const {
    batchStatus,
    startBatchProcessing,
    updateProgress,
    addToProcessing,
    removeFromProcessing,
    markCompleted,
    markFailed,
    completeBatchProcessing,
    resetProcessing
  } = useProcessingStore();

  const processCompany = useCallback(async (company: Company) => {
    try {
      // Mark company as processing
      await updateCompany(company.id, { 
        status: 'processing',
        lastProcessed: new Date()
      });

      const request: MVVExtractionRequest = {
        companyId: company.id,
        companyName: company.name,
        companyWebsite: company.website,
        companyDescription: company.notes
      };

      const result = await extractMVVPerplexity(request);

      if (result) {
        // Create MVV data
        const mvvData: MVVData = {
          companyId: company.id,
          version: 1,
          mission: result.mission,
          vision: result.vision,
          values: result.values,
          confidenceScores: result.confidence_scores,
          extractedAt: new Date(),
          source: 'perplexity',
          isActive: true,
          extractedFrom: result.extracted_from
        };

        await addMVVData(mvvData);

        // Phase 1 completed (MVV extracted) - Update company
        await updateCompany(company.id, { 
          status: 'mvv_extracted',
          mission: result.mission || undefined,
          vision: result.vision || undefined,
          values: Array.isArray(result.values) ? result.values.join(', ') : result.values || undefined,
          errorMessage: undefined
        });

        // Phase 2: Automatically extract company information
        try {
          console.log(`🏢 ${company.name}: 企業情報抽出を開始...`);
          
          const companyInfoRequest = {
            companyId: company.id,
            companyName: company.name,
            companyWebsite: company.website || '',
            includeFinancials: true,
            includeESG: false,
            includeCompetitors: false
          };

          const companyInfoData = await extractCompanyInfo(companyInfoRequest);
          
          if (companyInfoData) {
            // Save company info to database using migration service
            await companyInfoMigrationService.extractAndSaveCompanyInfo(company);
            console.log(`✅ ${company.name}: 企業情報抽出完了`);

            // Phase 3: Category update (if company info extraction succeeded)
            try {
              console.log(`🏷️ ${company.name}: カテゴリ自動更新を開始...`);
              await updateCategoryFromIndustryClassification(company);
            } catch (categoryError) {
              // Log category update error but don't fail the overall process
              console.warn(`⚠️ ${company.name}: カテゴリ更新は失敗しましたが、他の処理は成功しました:`, categoryError);
            }
          }
          
        } catch (companyInfoError) {
          // Log company info extraction error but don't fail the MVV process
          console.warn(`⚠️ ${company.name}: 企業情報抽出は失敗しましたが、MVV抽出は成功しました:`, companyInfoError);
        }

        return { success: true };
      } else {
        throw new Error('No data returned from API');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Mark company as Phase 1 error (MVV extraction error)
      await updateCompany(company.id, { 
        status: 'mvv_extraction_error',
        errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }, [extractMVVPerplexity, updateCompany, addMVVData]);

  // カテゴリ自動更新関数
  const updateCategoryFromIndustryClassification = useCallback(async (company: Company): Promise<void> => {
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
        await updateCompany(company.id, {
          category: autoGeneratedCategory
        });

        console.log(`✅ ${company.name}: カテゴリ更新完了 - ${autoGeneratedCategory}`);
      } else {
        console.log(`ℹ️ ${company.name}: 産業分類情報が不足しているため、カテゴリ更新をスキップしました`);
      }

    } catch (error) {
      console.error(`❌ ${company.name}: カテゴリ更新エラー:`, error);
      // カテゴリー更新の失敗は致命的ではないので、ログに残すだけ
      throw error;
    }
  }, [updateCompany]);

  const startProcessing = useCallback(async () => {
    if (selectedCompanies.length === 0) {
      showError('エラー', '処理する企業が選択されていません');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setShouldStop(false);
    
    startBatchProcessing(selectedCompanies.map(c => c.id));
    
    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      // Process companies in batches
      const batches = chunk(selectedCompanies, CONSTANTS.BATCH_SIZE);
      
      for (const batch of batches) {
        if (shouldStop) break;
        
        // Wait if paused
        while (isPaused && !shouldStop) {
          await delay(1000);
        }
        
        if (shouldStop) break;

        // Process batch in parallel with staggered start
        const batchPromises = batch.map(async (company, index) => {
          if (shouldStop) return { success: false };
          
          // Stagger requests to reduce simultaneous load
          if (index > 0) {
            await delay(500 * index); // 500ms stagger between requests
          }
          
          addToProcessing(company.id);
          
          try {
            const result = await processCompany(company);
            return { companyId: company.id, ...result };
          } finally {
            removeFromProcessing(company.id);
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Update progress
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const company = batch[i];
          
          if (result.status === 'fulfilled') {
            const { success: isSuccess } = result.value;
            processed++;
            
            if (isSuccess) {
              succeeded++;
              markCompleted(company.id);
            } else {
              failed++;
              markFailed(company.id);
            }
          } else {
            processed++;
            failed++;
            markFailed(company.id);
          }
        }

        updateProgress(processed, succeeded, failed);

        // Delay between batches to avoid overwhelming the API
        if (!shouldStop && batches.indexOf(batch) < batches.length - 1) {
          await delay(CONSTANTS.PROCESSING_DELAY);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      completeBatchProcessing();

      if (!shouldStop) {
        success(
          '処理完了',
          `${succeeded}件成功、${failed}件失敗 (処理時間: ${formatDuration(duration)})`
        );
        onComplete?.();
      }

    } catch (error) {
      showError('処理エラー', 'バッチ処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      setShouldStop(false);
    }
  }, [
    selectedCompanies,
    shouldStop,
    isPaused,
    extractMVVPerplexity,
    processCompany,
    startBatchProcessing,
    updateProgress,
    addToProcessing,
    removeFromProcessing,
    markCompleted,
    markFailed,
    completeBatchProcessing,
    success,
    showError,
    onComplete
  ]);

  const pauseProcessing = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeProcessing = useCallback(() => {
    setIsPaused(false);
  }, []);

  const stopProcessing = useCallback(() => {
    setShouldStop(true);
    setIsPaused(false);
  }, []);

  const resetProgress = useCallback(() => {
    resetProcessing();
    setIsProcessing(false);
    setIsPaused(false);
    setShouldStop(false);
  }, [resetProcessing]);

  const progress = batchStatus.total > 0 ? 
    (batchStatus.processed / batchStatus.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">完全自動3段階バッチ処理</h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedCompanies.length}件の企業で MVV抽出 → 企業情報抽出 → カテゴリ自動分類 を連続実行
            </p>
            <p className="text-xs text-blue-600 mt-1">
              ✨ 完全自動化: Phase 1 (MVV) → Phase 2 (企業情報) → Phase 3 (分類)
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex space-x-2">
            {!isProcessing ? (
              <Button
                onClick={startProcessing}
                disabled={selectedCompanies.length === 0}
              >
                <Play className="w-4 h-4 mr-2" />
                開始
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button variant="secondary" onClick={pauseProcessing}>
                    <Pause className="w-4 h-4 mr-2" />
                    一時停止
                  </Button>
                ) : (
                  <Button onClick={resumeProcessing}>
                    <Play className="w-4 h-4 mr-2" />
                    再開
                  </Button>
                )}
                <Button variant="danger" onClick={stopProcessing}>
                  <Square className="w-4 h-4 mr-2" />
                  停止
                </Button>
              </>
            )}
            
            {batchStatus.processed > 0 && !isProcessing && (
              <Button variant="outline" onClick={resetProgress}>
                <RotateCcw className="w-4 h-4 mr-2" />
                リセット
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        {batchStatus.total > 0 && (
          <div className="space-y-3">
            <ProgressBar
              value={progress}
              max={100}
              size="lg"
              color={
                isPaused ? 'yellow' :
                isProcessing ? 'blue' :
                batchStatus.failed > 0 ? 'red' : 'green'
              }
              showPercentage
              label="全体進捗"
            />
            
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {batchStatus.total}
                </div>
                <div className="text-gray-600">総数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {batchStatus.processed}
                </div>
                <div className="text-gray-600">処理済み</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {batchStatus.succeeded}
                </div>
                <div className="text-gray-600">成功</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {batchStatus.failed}
                </div>
                <div className="text-gray-600">失敗</div>
              </div>
            </div>

            {/* Status Message */}
            <div className="text-center text-sm text-gray-600">
              {isPaused && '一時停止中...'}
              {isProcessing && !isPaused && 'MVV情報を抽出中...'}
              {!isProcessing && batchStatus.processed > 0 && '処理完了'}
              {!isProcessing && batchStatus.processed === 0 && '処理待機中'}
            </div>

            {/* Time Information */}
            {batchStatus.startTime && (
              <div className="text-center text-xs text-gray-500">
                開始時刻: {batchStatus.startTime.toLocaleString()}
                {batchStatus.endTime && (
                  <span className="ml-4">
                    処理時間: {formatDuration(
                      batchStatus.endTime.getTime() - batchStatus.startTime.getTime()
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      {selectedCompanies.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-sm text-yellow-700">
            企業管理画面で企業を選択してから、バッチ処理を開始してください。
            一度に最大{CONSTANTS.BATCH_SIZE}社ずつ並列処理されます。
          </p>
        </div>
      )}
    </div>
  );
};