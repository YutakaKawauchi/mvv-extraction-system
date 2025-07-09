import React, { useState, useCallback } from 'react';
import type { Company } from '../../types';
import { Button, ProgressBar } from '../common';
import { useCompanyStore } from '../../stores/companyStore';
import { useProcessingStore } from '../../stores/processingStore';
import { useNotification } from '../../hooks/useNotification';
import { generateEmbeddings } from '../../services/openai';
import { mvvStorage } from '../../services/storage';
import { formatDuration } from '../../utils/formatters';
import { Play, Pause, Square, RotateCcw, Sparkles } from 'lucide-react';

interface EmbeddingsBatchProcessorProps {
  selectedCompanies: Company[];
  onComplete?: () => void;
}

export const EmbeddingsBatchProcessor: React.FC<EmbeddingsBatchProcessorProps> = ({
  selectedCompanies,
  onComplete
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  
  const { updateCompany } = useCompanyStore();
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

  // Filter companies that have MVV extracted but no embeddings
  // Include both mvv_extracted and embeddings_generation_error status
  const mvvExtractedCompanies = selectedCompanies.filter(company => 
    (company.status === 'mvv_extracted' || company.status === 'embeddings_generation_error') && 
    (!company.embeddings || company.embeddings.length === 0)
  );

  const processCompanyEmbeddings = useCallback(async (company: Company, currentShouldStop: () => boolean) => {
    try {
      // Check if stop was requested
      if (currentShouldStop()) {
        return { success: false, error: 'Processing stopped by user' };
      }

      // Mark company as processing
      await updateCompany(company.id, { 
        status: 'processing',
        lastProcessed: new Date()
      });

      // Check again after async operation
      if (currentShouldStop()) {
        // Revert status if stopped
        await updateCompany(company.id, { status: 'mvv_extracted' });
        return { success: false, error: 'Processing stopped by user' };
      }

      // Try to get MVV data from company first, then from MVV storage
      let mvvText = '';
      
      if (company.mission || company.vision || company.values) {
        // Use company-stored MVV data
        mvvText = [
          company.mission ? `Mission: ${company.mission}` : '',
          company.vision ? `Vision: ${company.vision}` : '',
          company.values ? `Values: ${company.values}` : ''
        ].filter(Boolean).join('\n');
      } else {
        // Fallback: get MVV data from storage
        const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
        if (mvvData) {
          mvvText = [
            mvvData.mission ? `Mission: ${mvvData.mission}` : '',
            mvvData.vision ? `Vision: ${mvvData.vision}` : '',
            mvvData.values ? `Values: ${Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values}` : ''
          ].filter(Boolean).join('\n');
          
          // Update company with MVV data for future use
          await updateCompany(company.id, {
            mission: mvvData.mission || undefined,
            vision: mvvData.vision || undefined,
            values: Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values || undefined
          });
        }
      }

      if (!mvvText) {
        throw new Error('MVV data not found for embeddings generation');
      }

      // Check if stop was requested before expensive operation
      if (currentShouldStop()) {
        await updateCompany(company.id, { status: 'mvv_extracted' });
        return { success: false, error: 'Processing stopped by user' };
      }

      // Generate embeddings
      const embeddings = await generateEmbeddings(mvvText);

      // Check if stop was requested after expensive operation
      if (currentShouldStop()) {
        await updateCompany(company.id, { status: 'mvv_extracted' });
        return { success: false, error: 'Processing stopped by user' };
      }

      // Update company with embeddings and mark as fully completed
      await updateCompany(company.id, { 
        status: 'fully_completed',
        embeddings,
        errorMessage: undefined
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Embeddings generation failed';
      
      // Mark company as Phase 2 error (Embeddings generation error)
      // Keep MVV data intact - only mark embeddings generation as failed
      await updateCompany(company.id, { 
        status: 'embeddings_generation_error',
        errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }, [updateCompany, mvvStorage]);

  const startProcessing = useCallback(async () => {
    if (mvvExtractedCompanies.length === 0) {
      showError('エラー', 'MVV抽出済み企業が選択されていません');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setShouldStop(false);
    
    startBatchProcessing(mvvExtractedCompanies.map(c => c.id));
    
    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      // Process companies sequentially to avoid rate limiting
      for (const company of mvvExtractedCompanies) {
        if (shouldStop) break;
        
        // Wait if paused
        while (isPaused && !shouldStop) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (shouldStop) break;

        addToProcessing(company.id);
        
        try {
          const result = await processCompanyEmbeddings(company, () => shouldStop);
          processed++;
          
          if (result.success) {
            succeeded++;
            markCompleted(company.id);
          } else {
            failed++;
            markFailed(company.id);
          }
        } catch (error) {
          processed++;
          failed++;
          markFailed(company.id);
        } finally {
          removeFromProcessing(company.id);
        }

        updateProgress(processed, succeeded, failed);

        // Small delay between requests to avoid overwhelming the API
        if (!shouldStop && processed < mvvExtractedCompanies.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      completeBatchProcessing();

      if (!shouldStop) {
        success(
          'Embeddings処理完了',
          `${succeeded}件成功、${failed}件失敗 (処理時間: ${formatDuration(duration)})`
        );
        onComplete?.();
      }

    } catch (error) {
      showError('処理エラー', 'Embeddings生成中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      setShouldStop(false);
    }
  }, [
    mvvExtractedCompanies,
    shouldStop,
    isPaused,
    processCompanyEmbeddings,
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
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
              Embeddings生成 (Phase 2)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {mvvExtractedCompanies.length}件のMVV抽出済み企業が選択されています
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex space-x-2">
            {!isProcessing ? (
              <Button
                onClick={startProcessing}
                disabled={mvvExtractedCompanies.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Embeddings生成開始
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
              label="Embeddings生成進捗"
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
                <div className="text-2xl font-bold text-purple-600">
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
              {isProcessing && !isPaused && 'OpenAI Embeddingsを生成中...'}
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
      {mvvExtractedCompanies.length === 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
          <p className="text-sm text-purple-700">
            MVV抽出済み（Phase 1完了）の企業を選択してから、Embeddings生成を開始してください。
            この処理により、OpenAI Embeddingsが生成され、MVV類似度分析が可能になります。
          </p>
        </div>
      )}
    </div>
  );
};