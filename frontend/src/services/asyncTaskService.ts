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
      console.log(`Async task started: ${task.id} (${task.type})`);
      
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
          return;
        }

        // 完了状態チェック
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
          this.stopPolling(taskId);
          return;
        }

        // Background Functionのステータスをチェック
        const statusUpdate = await this.checkBackgroundTaskStatus(taskId);
        
        if (statusUpdate) {
          await this.updateTaskFromBackground(taskId, statusUpdate);
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
   * Background Task ステータスチェック
   */
  private async checkBackgroundTaskStatus(taskId: string): Promise<BackgroundTaskResponse | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/task-status?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.API_SECRET
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // タスクが見つからない場合は処理中と判断
          return null;
        }
        throw new Error(`Status check failed: ${response.status}`);
      }

      const responseData = await response.json();
      // レスポンスがネストされている場合は展開
      return responseData.data || responseData;
    } catch (error) {
      console.error(`Status check error for task ${taskId}:`, error);
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
      update.progress = backgroundResult.progress;
    }

    if (backgroundResult.result) {
      update.result = backgroundResult.result;
      console.log('📊 Task result received:', backgroundResult.result);
      console.log('📊 Task result keys:', Object.keys(backgroundResult.result));
      console.log('📊 Task result metadata:', backgroundResult.result.metadata);
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

    // 完了時のAPIログ更新
    if (['completed', 'failed', 'cancelled'].includes(backgroundResult.status)) {
      console.log(`✅ Task ${taskId} ${backgroundResult.status}. Stopping polling.`);
      await this.logFinalTaskResult(taskId, backgroundResult);
      this.stopPolling(taskId);
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