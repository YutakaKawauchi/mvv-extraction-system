/**
 * 汎用非同期タスクサービス (Phase ε.1)
 * Background Functions連携、ポーリング管理、エラーハンドリング
 */

import type {
  AsyncTask,
  AsyncTaskCreateRequest,
  AsyncTaskUpdateRequest,
  AsyncTaskType,
  BackgroundTaskResponse,
  TaskExecutionContext
} from '../types/asyncTask';
import { AsyncTaskError } from '../types/asyncTask';
import { asyncTaskStorageService } from './asyncTaskStorage';
import { apiLoggerService } from './apiLogger';

export class AsyncTaskService {
  private pollingTasks = new Map<string, NodeJS.Timeout>();
  private readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  private readonly API_SECRET = import.meta.env.VITE_API_SECRET;

  constructor() {
    this.setupPageVisibilityHandling();
    // 初期化時の自動再開を無効化（手動で開始するまで待機）
    // this.resumeActiveTasks();
  }

  /**
   * 非同期タスクを開始
   */
  async startTask(request: AsyncTaskCreateRequest): Promise<AsyncTask> {
    try {
      // 1. ローカルタスクを作成
      const task = await asyncTaskStorageService.createTask(request);
      
      // 2. 実行コンテキストを構築
      const context = this.buildExecutionContext(task.id);
      
      // 3. APIログを開始
      const apiLogId = await this.startApiLogging(task, context);
      
      // 4. タスクにAPIログIDを紐づけ
      await asyncTaskStorageService.updateTask({
        id: task.id,
        metadata: {
          ...task.metadata,
          apiLogId
        }
      });

      // 5. Background Functionを呼び出し
      const backgroundResult = await this.callBackgroundFunction(task, context);
      
      // 6. Background Function開始結果を記録
      await asyncTaskStorageService.updateTask({
        id: task.id,
        status: 'processing',
        progress: {
          percentage: 5,
          currentStep: 'バックグラウンド処理を開始しました...'
        },
        metadata: {
          ...task.metadata,
          backgroundFunctionUrl: backgroundResult.metadata?.backgroundFunctionId
        }
      });

      // 7. ポーリング開始
      this.startPolling(task.id);

      // 8. 最新の更新されたタスクを取得して返す
      const updatedTask = await asyncTaskStorageService.getTask(task.id);
      if (import.meta.env.DEV) {
        console.log(`Async task started: ${task.id} (${task.type})`);
      }
      
      return updatedTask || task;
    } catch (error) {
      console.error('Failed to start async task:', error);
      throw new AsyncTaskError(
        'タスクの開始に失敗しました',
        'TASK_START_FAILED',
        request.type,
        true,
        error
      );
    }
  }

  /**
   * Background Function呼び出し（start-async-task経由）
   */
  private async callBackgroundFunction(
    task: AsyncTask, 
    context: TaskExecutionContext
  ): Promise<BackgroundTaskResponse> {
    const endpoint = `${this.API_BASE_URL}/start-async-task`;
    const requestStart = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.API_SECRET,
          'X-Task-ID': task.id,
          'X-Request-ID': context.requestId || ''
        },
        body: JSON.stringify({
          taskType: task.type,
          taskData: task.inputData,
          priority: 'medium',
          metadata: {
            ...task.metadata,
            clientContext: context
          }
        })
      });

      const responseData = await response.json();

      // APIログに記録
      if (task.metadata.apiLogId) {
        await apiLoggerService.logResponse(
          task.metadata.apiLogId,
          response.status,
          response.statusText,
          Object.fromEntries(response.headers),
          responseData,
          requestStart
        );
      }

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}`);
      }

      return responseData;
    } catch (error) {
      // エラーもAPIログに記録
      if (task.metadata.apiLogId) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await apiLoggerService.logResponse(
          task.metadata.apiLogId,
          500,
          'Background Function Error',
          {},
          { error: errorMessage },
          requestStart,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      throw error;
    }
  }


  /**
   * ポーリング開始
   */
  private startPolling(taskId: string): void {
    let pollCount = 0;
    const maxPolls = 180; // 最大15分間（5秒間隔で180回、指数バックオフ考慮）

    const poll = async () => {
      try {
        const task = await asyncTaskStorageService.getTask(taskId);
        if (!task) {
          console.warn(`Task not found for polling: ${taskId}`);
          this.stopPolling(taskId);
          return;
        }

        // 完了状態チェック（最優先）
        if (['completed', 'failed', 'cancelled', 'consumed'].includes(task.status)) {
          if (import.meta.env.DEV) {
            console.log(`🔄 Stopping polling for ${taskId}: status is ${task.status}`);
          }
          this.stopPolling(taskId);
          return;
        }

        // Background Functionのステータスをチェック
        const statusUpdate = await this.checkBackgroundTaskStatus(taskId);
        
        if (statusUpdate) {
          await this.updateTaskFromBackground(taskId, statusUpdate);
          
          // 更新後に再度完了チェック
          const updatedTask = await asyncTaskStorageService.getTask(taskId);
          if (updatedTask && ['completed', 'failed', 'cancelled'].includes(updatedTask.status)) {
            if (import.meta.env.DEV) {
              console.log(`🔄 Task ${taskId} completed after update. Stopping polling.`);
            }
            this.stopPolling(taskId);
            return;
          }
        }

        // 次のポーリング間隔を計算（指数バックオフ）
        pollCount++;
        const nextInterval = Math.min(
          task.config.pollIntervalMs * Math.pow(1.2, Math.floor(pollCount / 10)),
          30000 // 最大30秒
        );

        // 最大ポーリング回数チェック
        if (pollCount >= maxPolls) {
          console.warn(`Polling timeout for task: ${taskId}`);
          await asyncTaskStorageService.updateTask({
            id: taskId,
            status: 'failed',
            error: {
              message: 'ポーリングタイムアウト',
              code: 'POLLING_TIMEOUT',
              retryable: false
            }
          });
          this.stopPolling(taskId);
          return;
        }

        // 次のポーリングをスケジュール
        const timeoutId = setTimeout(poll, nextInterval);
        this.pollingTasks.set(taskId, timeoutId);

      } catch (error) {
        console.error(`Polling error for task ${taskId}:`, error);
        
        // 400エラー（Bad Request）の場合はタスクを停止
        if (error instanceof Error && error.message.includes('400')) {
          console.warn(`Stopping polling for task ${taskId} due to 400 error`);
          await asyncTaskStorageService.updateTask({
            id: taskId,
            status: 'failed',
            error: {
              message: 'ポーリングエラー（Bad Request）',
              code: 'POLLING_BAD_REQUEST',
              retryable: false
            }
          });
          this.stopPolling(taskId);
          return;
        }
        
        // その他のエラーの場合は継続（ネットワーク障害等）
        const retryInterval = 10000; // 10秒後にリトライ
        const timeoutId = setTimeout(poll, retryInterval);
        this.pollingTasks.set(taskId, timeoutId);
      }
    };

    // 初回ポーリング
    poll();
  }

  /**
   * Background Task ステータスチェック（進捗情報付き）
   */
  private async checkBackgroundTaskStatus(taskId: string): Promise<BackgroundTaskResponse | null> {
    try {
      // ローカルタスクの状態を事前チェック
      const localTask = await asyncTaskStorageService.getTask(taskId);
      if (!localTask) {
        console.warn(`Local task not found: ${taskId}`);
        return null;
      }

      // ローカルタスクが既に完了している場合は、リモートチェックをスキップ
      if (['completed', 'failed', 'cancelled', 'consumed'].includes(localTask.status)) {
        console.log(`🔄 Task ${taskId} already ${localTask.status} locally. Skipping remote check.`);
        return null;
      }

      // Phase 1: 実行監視フェーズ - progress blob を監視
      if (import.meta.env.DEV) {
        console.log(`🔍 Phase 1: Monitoring progress for task ${taskId}`);
      }
      const progressResponse = await this.checkTaskProgress(taskId);
      
      // Phase 2: 完了検知フェーズ - result blob の存在確認
      if (import.meta.env.DEV) {
        console.log(`🔍 Phase 2: Checking for completion of task ${taskId}`);
      }
      const resultResponse = await this.checkTaskCompletion(taskId);
      
      if (resultResponse) {
        // Phase 3: 結果取得・表示フェーズ
        console.log(`✅ Phase 3: Task ${taskId} completed, result available`);
        return {
          success: true,
          taskId,
          status: 'completed',
          progress: progressResponse,
          data: resultResponse.result,
          result: resultResponse.result,
          metadata: {
            completedViaPulling: true,
            finalProgress: progressResponse,
            resultSource: 'resultBlob',
            retrievedAt: Date.now()
          }
        };
      }

      // まだ実行中の場合
      if (progressResponse) {
        console.log(`⏳ Task ${taskId} still running - progress: ${progressResponse.percentage}%`);
        return {
          success: true,
          taskId,
          status: 'processing',
          progress: progressResponse,
          data: null,
          result: null,
          metadata: {
            completedViaPulling: false,
            currentProgress: progressResponse
          }
        };
      }

      // progress blob も result blob もない場合（タスクが存在しないか、まだ開始されていない）
      console.log(`❓ Task ${taskId} - no progress or result found`);
      return null;

    } catch (error) {
      console.error(`❌ Background task status check failed for ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Phase 2: タスク完了検知（result blob の存在確認）
   * 洗練された設計 v2.0
   */
  private async checkTaskCompletion(taskId: string): Promise<{ result: any } | null> {
    try {
      const resultResponse = await fetch(`${this.API_BASE_URL}/task-result?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.API_SECRET
        }
      });

      if (resultResponse.ok) {
        const resultData = await resultResponse.json();
        if (import.meta.env.DEV) {
          console.log(`📦 Result blob found for ${taskId}:`, {
            hasResult: !!resultData.result,
            resultKeys: resultData.result ? Object.keys(resultData.result) : 'null',
            status: resultData.status
          });
        }
        return resultData;
      } else if (resultResponse.status === 404) {
        // 404は「result blob がまだ存在しない」（実行中）の明確な意味
        console.log(`📋 Task ${taskId} result not yet available (still running)`);
        return null;
      } else {
        console.warn(`❌ Unexpected response for task ${taskId}:`, resultResponse.status);
        return null;
      }
    } catch (error) {
      console.warn(`❌ Error checking task completion for ${taskId}:`, error);
      return null;
    }
  }

  /**
   * タスク進捗情報取得
   */
  private async checkTaskProgress(taskId: string): Promise<any | null> {
    try {
      // task-progressエンドポイントを使用して進捗情報を取得
      const response = await fetch(`${this.API_BASE_URL}/task-progress?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.API_SECRET
        }
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          // 進捗情報が見つからない場合は正常（まだ進捗が保存されていない）
          return null;
        }
        throw new Error(`Progress check failed: ${response.status}`);
      }

      const responseData = await response.json();
      if (responseData.success && responseData.progress) {
        if (import.meta.env.DEV) {
          console.log(`📈 Progress update for task ${taskId}:`, {
            percentage: responseData.progress.percentage,
            currentStep: responseData.progress.currentStep,
            detailedSteps: responseData.progress.detailedSteps?.length || 0,
            updatedAt: responseData.progress.updatedAt
          });
        }
        return responseData.progress;
      }

      return null;
    } catch (error) {
      // CORSエラーやネットワークエラーの場合は警告のみでエラーを投げない
      if (error instanceof Error && error.message.includes('CORS')) {
        console.warn(`Progress check skipped due to CORS for task ${taskId}`);
        return null;
      }
      console.error(`Progress check error for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Background Function結果でタスクを更新
   */
  private async updateTaskFromBackground(
    taskId: string, 
    backgroundResult: BackgroundTaskResponse
  ): Promise<void> {
    const update: AsyncTaskUpdateRequest = {
      id: taskId,
      status: backgroundResult.status
    };

    if (backgroundResult.progress) {
      // 新しい進捗形式に対応
      if (backgroundResult.progress.percentage !== undefined) {
        update.progress = {
          percentage: backgroundResult.progress.percentage,
          currentStep: backgroundResult.progress.currentStep || '処理中...',
          detailedSteps: backgroundResult.progress.detailedSteps || [],
          updatedAt: backgroundResult.progress.updatedAt || Date.now()
        };
        
        if (import.meta.env.DEV) {
          console.log(`📈 Progress update for task ${taskId}:`, {
            percentage: update.progress.percentage,
            currentStep: update.progress.currentStep,
            detailedStepsCount: update.progress.detailedSteps?.length || 0
          });
        }
      } else {
        // 従来の進捗形式にも対応
        update.progress = backgroundResult.progress;
      }
    }

    if (backgroundResult.result) {
      update.result = backgroundResult.result;
      if (import.meta.env.DEV) {
        console.log('📊 Task result received:', backgroundResult.result);
        console.log('📊 Task result keys:', Object.keys(backgroundResult.result));
        console.log('📊 Task result metadata:', backgroundResult.result.metadata);
      }
    }

    if (backgroundResult.error) {
      update.error = {
        message: backgroundResult.error,
        code: 'BACKGROUND_FUNCTION_ERROR',
        retryable: false
      };
    }

    await asyncTaskStorageService.updateTask(update);
    console.log(`🔄 Task ${taskId} updated in storage with status: ${backgroundResult.status}`);

    // 完了時のAPIログ更新とクリーンアップ
    if (['completed', 'failed', 'cancelled'].includes(backgroundResult.status)) {
      console.log(`✅ Task ${taskId} ${backgroundResult.status}. Stopping polling.`);
      await this.logFinalTaskResult(taskId, backgroundResult);
      this.stopPolling(taskId);
      
      // タスクブロブのクリーンアップ（結果＋進捗）
      await this.cleanupTaskBlobs(taskId);
    }
  }

  /**
   * タスクブロブの統一クリーンアップ（結果＋進捗）
   */
  private async cleanupTaskBlobs(taskId: string, cleanup: 'all' | 'result' | 'progress' = 'all'): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/cleanup-task-blob`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.API_SECRET
        },
        body: JSON.stringify({
          taskId,
          cleanup
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`🧹 Task blob cleanup successful:`, {
          taskId,
          cleanup,
          totalDeleted: result.summary?.totalDeleted || 0,
          totalSize: result.summary?.totalSize || 0,
          deletedBlobs: Object.keys(result.deleted || {}).filter(key => result.deleted[key]?.deleted)
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`Task blob cleanup failed:`, {
          taskId,
          cleanup,
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error(`Task blob cleanup error for ${taskId}:`, error);
      // クリーンアップエラーは非致命的なので、処理を継続
    }
  }

  /**
   * タスク完了時の最終ログ記録
   */
  private async logFinalTaskResult(taskId: string, backgroundResult: BackgroundTaskResponse): Promise<void> {
    try {
      const task = await asyncTaskStorageService.getTask(taskId);
      if (!task || !task.metadata.apiLogId) {
        console.warn(`No API log ID found for task ${taskId}`);
        return;
      }

      // 最終結果をAPIログに記録
      await apiLoggerService.logResponse(
        task.metadata.apiLogId,
        backgroundResult.status === 'completed' ? 200 : 500,
        backgroundResult.status === 'completed' ? 'OK' : 'Task Failed',
        {
          'Content-Type': 'application/json',
          'X-Task-Status': backgroundResult.status
        },
        {
          success: backgroundResult.status === 'completed',
          taskId,
          data: backgroundResult.result,
          error: backgroundResult.error,
          metadata: {
            finalResult: true,
            processingTime: task.timestamps.completedAt ? 
              (task.timestamps.completedAt - task.timestamps.createdAt) : null,
            resultSize: backgroundResult.result ? 
              JSON.stringify(backgroundResult.result).length : 0
          }
        },
        task.timestamps.createdAt
      );

      console.log(`📝 Final result logged for task ${taskId} (API Log ID: ${task.metadata.apiLogId})`);
    } catch (error) {
      console.error(`Failed to log final result for task ${taskId}:`, error);
    }
  }

  /**
   * ポーリング停止
   */
  private stopPolling(taskId: string): void {
    const timeoutId = this.pollingTasks.get(taskId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pollingTasks.delete(taskId);
      console.log(`Polling stopped for task: ${taskId}`);
    }
  }

  /**
   * タスクキャンセル
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      // ローカルタスクをキャンセル
      await asyncTaskStorageService.cancelTask(taskId);
      
      // ポーリング停止
      this.stopPolling(taskId);
      
      // Background Functionにキャンセル通知（ベストエフォート）
      try {
        await fetch(`${this.API_BASE_URL}/cancel-task`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.API_SECRET
          },
          body: JSON.stringify({ taskId })
        });
      } catch (cancelError) {
        console.warn('Failed to notify background function of cancellation:', cancelError);
      }

      console.log(`Task cancelled: ${taskId}`);
    } catch (error) {
      console.error('Failed to cancel task:', error);
      throw new AsyncTaskError(
        'タスクのキャンセルに失敗しました',
        'TASK_CANCEL_FAILED',
        taskId,
        true,
        error
      );
    }
  }

  /**
   * APIログ開始
   */
  private async startApiLogging(
    task: AsyncTask, 
    context: TaskExecutionContext
  ): Promise<string> {
    return await apiLoggerService.logRequest(
      task.type,
      'POST',
      `${this.API_BASE_URL}/start-async-task`,
      {
        'Content-Type': 'application/json',
        'X-API-Key': '[REDACTED]',
        'X-Task-ID': task.id
      },
      {
        taskType: task.type,
        taskData: task.inputData,
        priority: 'medium',
        metadata: {
          ...task.metadata,
          clientContext: context
        }
      },
      {
        companyId: task.metadata.companyId,
        ideaId: task.metadata.ideaId,
        operationType: this.mapTaskTypeToOperation(task.type)
      }
    );
  }

  /**
   * タスクタイプをオペレーションタイプにマッピング
   */
  private mapTaskTypeToOperation(taskType: AsyncTaskType): 'generate-ideas' | 'verify-ideas' | 'extract-mvv' | 'extract-company-info' | 'other' {
    const mapping: Record<AsyncTaskType, 'generate-ideas' | 'verify-ideas' | 'extract-mvv' | 'extract-company-info' | 'other'> = {
      'verify-business-idea': 'verify-ideas',
      'generate-business-ideas': 'generate-ideas',
      'extract-mvv': 'extract-mvv',
      'extract-company-info': 'extract-company-info',
      'analyze-competition': 'other',
      'other': 'other'
    };
    return mapping[taskType];
  }

  /**
   * 実行コンテキスト構築
   */
  private buildExecutionContext(taskId: string): TaskExecutionContext {
    return {
      taskId,
      userId: 'anonymous', // TODO: 認証システムと統合
      sessionId: `session_${Date.now()}`,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      apiVersion: 'v1',
      clientInfo: {
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language
      }
    };
  }

  /**
   * Page Visibility API でポーリング制御
   */
  private setupPageVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // ページが非表示になったらポーリング間隔を延長
        console.log('Page hidden - extending polling intervals');
      } else {
        // ページが表示されたらポーリング間隔を通常に戻す
        console.log('Page visible - resuming normal polling');
        this.resumeActiveTasks();
      }
    });
  }

  /**
   * アクティブなタスクのポーリング再開
   */
  private async resumeActiveTasks(): Promise<void> {
    try {
      const activeTasks = await asyncTaskStorageService.getActiveTasks();
      
      // 古いタスクをフィルタリング（24時間以上前のタスクは停止）
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const task of activeTasks) {
        // 古いタスクは自動的にキャンセル
        if (task.timestamps.createdAt < cutoffTime) {
          console.warn(`Cancelling old task: ${task.id} (age: ${Date.now() - task.timestamps.createdAt}ms)`);
          await asyncTaskStorageService.cancelTask(task.id);
          continue;
        }
        
        if (!this.pollingTasks.has(task.id)) {
          console.log(`Resuming polling for task: ${task.id}`);
          this.startPolling(task.id);
        }
      }
    } catch (error) {
      console.error('Failed to resume active tasks:', error);
    }
  }

  /**
   * 全ポーリング停止（クリーンアップ用）
   */
  public cleanup(): void {
    this.pollingTasks.forEach((timeoutId, taskId) => {
      clearTimeout(timeoutId);
      console.log(`Polling cleaned up for task: ${taskId}`);
    });
    this.pollingTasks.clear();
  }

  /**
   * 強制的に全ての古いタスクをクリーンアップ
   */
  public async forceCleanup(): Promise<void> {
    console.log('🧹 Force cleanup: stopping all polling and cleaning old tasks');
    
    // 全ポーリング停止
    this.cleanup();
    
    // 古いタスクを全てキャンセル
    try {
      const activeTasks = await asyncTaskStorageService.getActiveTasks();
      for (const task of activeTasks) {
        console.log(`Cancelling task: ${task.id}`);
        await asyncTaskStorageService.cancelTask(task.id);
      }
      console.log('✅ Force cleanup completed');
    } catch (error) {
      console.error('❌ Force cleanup failed:', error);
    }
  }
}

// シングルトンインスタンス
export const asyncTaskService = new AsyncTaskService();