/**
 * 非同期タスク管理Hook (Phase ε.1.2)
 * AsyncTaskServiceとReact状態管理の統合
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AsyncTask,
  AsyncTaskCreateRequest
} from '../types/asyncTask';
import { asyncTaskService } from '../services/asyncTaskService';
import { asyncTaskStorageService } from '../services/asyncTaskStorage';

export interface UseAsyncTaskOptions {
  autoStart?: boolean;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number, step: string) => void;
  enablePersistence?: boolean;
}

export interface UseAsyncTaskReturn {
  // タスク状態
  task: AsyncTask | null;
  isRunning: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  progress: number;
  currentStep: string;
  result: any;
  error: string | null;

  // タスク制御
  startTask: (request: AsyncTaskCreateRequest) => Promise<AsyncTask>;
  cancelTask: () => Promise<void>;
  retryTask: () => Promise<void>;
  reset: () => void;

  // ユーティリティ
  getElapsedTime: () => number;
  getEstimatedTimeRemaining: () => number | null;
}

export const useAsyncTask = (
  taskId?: string,
  options: UseAsyncTaskOptions = {}
): UseAsyncTaskReturn => {
  const [task, setTask] = useState<AsyncTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTaskRequestRef = useRef<AsyncTaskCreateRequest | null>(null);
  const mountedRef = useRef(true);
  const completedTasksRef = useRef<Set<string>>(new Set());
  const initializationRef = useRef(false);

  const {
    onComplete,
    onError,
    onProgress,
    enablePersistence = true
  } = options;

  // React Strict Mode対応: マウント状態の初期化と管理
  useEffect(() => {
    // Strict Modeでの二重実行を検知
    if (initializationRef.current) {
    }
    
    initializationRef.current = true;
    mountedRef.current = true;
    
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 既存タスクの読み込み
  useEffect(() => {
    if (taskId && enablePersistence) {
      loadTask(taskId);
    }
  }, [taskId, enablePersistence]);

  // タスク状態の監視
  useEffect(() => {
    if (!task) {
      return;
    }

    // 完了/失敗時のコールバック（重複実行防止）
    if (task.status === 'completed' && onComplete && !completedTasksRef.current.has(task.id)) {
      completedTasksRef.current.add(task.id);
      onComplete(task.result);
      
      // 結果表示後にconsumed状態に変更
      asyncTaskStorageService.markTaskAsConsumed(task.id).catch(err => 
        console.error(`Failed to mark task ${task.id} as consumed:`, err)
      );

      // Blob削除API呼び出し（サイレント）
      cleanupTaskBlob(task.id).catch(err => 
        console.warn(`Failed to cleanup blob for task ${task.id}:`, err)
      );
    } else if (task.status === 'failed' && onError && task.error && !completedTasksRef.current.has(task.id)) {
      completedTasksRef.current.add(task.id);
      onError(new Error(task.error.message));
    }

    // 進捗更新時のコールバック
    if (onProgress && task.progress) {
      onProgress(task.progress.percentage, task.progress.currentStep);
    }
  }, [task, onComplete, onError, onProgress, task?.status, task?.result, task?.timestamps?.lastUpdatedAt]);

  // アクティブなタスクの定期チェック
  useEffect(() => {
    if (!task || !['queued', 'processing'].includes(task.status)) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedTask = await asyncTaskStorageService.getTask(task.id);
        if (updatedTask && mountedRef.current) {
          // ステータスが変更された場合、またはタイムスタンプが更新された場合に更新
          if (updatedTask.timestamps.lastUpdatedAt >= task.timestamps.lastUpdatedAt || 
              task.status !== updatedTask.status) {
            setTask(updatedTask);
            
            // completedまたはfailedの場合はポーリングを停止
            if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
              clearInterval(pollInterval);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll task status:', err);
      }
    }, 2000); // 2秒間隔でチェック

    return () => {
      clearInterval(pollInterval);
    };
  }, [task?.id, task?.status, task?.timestamps?.lastUpdatedAt]);

  // フォールバックタスク検知メカニズム
  useEffect(() => {
    if (task) {
      return;
    }

    const fallbackInterval = setInterval(async () => {
      if (!mountedRef.current) {
        return;
      }

      try {
        // 最近5分以内に作成された未処理タスクを検索
        const recentTasks = await asyncTaskStorageService.getRecentTasks(5 * 60 * 1000); // 5分
        
        if (recentTasks.length > 0) {
          // 最新のアクティブタスクを取得
          const activeTask = recentTasks.find(t => 
            ['queued', 'processing'].includes(t.status)
          ) || recentTasks.find(t => 
            ['completed', 'failed'].includes(t.status) && !completedTasksRef.current.has(t.id)
          );

          if (activeTask && mountedRef.current) {
            setTask(activeTask);
          }
        }
      } catch (err) {
        console.error('Fallback task detection error:', err);
      }
    }, 5000); // 5秒間隔でチェック

    // 30秒後にフォールバック検知を停止
    const timeoutId = setTimeout(() => {
      clearInterval(fallbackInterval);
    }, 30000);

    return () => {
      clearInterval(fallbackInterval);
      clearTimeout(timeoutId);
    };
  }, [task]); // taskが変更されたときに再実行

  /**
   * 既存タスクの読み込み
   */
  const loadTask = useCallback(async (id: string) => {
    try {
      const existingTask = await asyncTaskStorageService.getTask(id);
      if (existingTask && mountedRef.current) {
        setTask(existingTask);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : '不明なエラー');
      }
    }
  }, []);

  /**
   * タスクの開始
   */
  const startTask = useCallback(async (request: AsyncTaskCreateRequest) => {
    try {
      setError(null);
      lastTaskRequestRef.current = request;
      const newTask = await asyncTaskService.startTask(request);
      
      if (mountedRef.current) {
        setTask(newTask);
      }
      return newTask;
    } catch (err) {
      console.error('Failed to start task:', err);
      
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラー';
        setError(errorMessage);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      }
      throw err;
    }
  }, [onError, task?.id]);

  /**
   * タスクのキャンセル
   */
  const cancelTask = useCallback(async () => {
    if (!task) return;

    try {
      await asyncTaskService.cancelTask(task.id);
      if (mountedRef.current) {
        // ローカル状態を即座に更新
        setTask(prev => prev ? {
          ...prev,
          status: 'cancelled',
          progress: {
            ...prev.progress,
            currentStep: 'キャンセルされました'
          }
        } : null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'キャンセルに失敗しました');
      }
    }
  }, [task]);

  /**
   * タスクのリトライ
   */
  const retryTask = useCallback(async () => {
    if (!lastTaskRequestRef.current) {
      setError('リトライするタスクがありません');
      return;
    }

    try {
      setError(null);
      const retryRequest = {
        ...lastTaskRequestRef.current,
        metadata: {
          ...lastTaskRequestRef.current.metadata,
          currentRetry: (task?.metadata.currentRetry || 0) + 1
        }
      };

      const newTask = await asyncTaskService.startTask(retryRequest);
      if (mountedRef.current) {
        setTask(newTask);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'リトライに失敗しました';
        setError(errorMessage);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    }
  }, [task, onError]);

  /**
   * 状態のリセット
   */
  const reset = useCallback(() => {
    setTask(null);
    setError(null);
    lastTaskRequestRef.current = null;
  }, []);

  /**
   * 経過時間の計算
   */
  const getElapsedTime = useCallback((): number => {
    if (!task || !task.timestamps.startedAt) return 0;
    
    const endTime = task.timestamps.completedAt || Date.now();
    return endTime - task.timestamps.startedAt;
  }, [task]);

  /**
   * 推定残り時間の計算
   */
  const getEstimatedTimeRemaining = useCallback((): number | null => {
    if (!task || !task.timestamps.startedAt || task.progress.percentage <= 0) {
      return null;
    }

    if (task.progress.estimatedTimeRemaining) {
      return task.progress.estimatedTimeRemaining;
    }

    // 進捗率から推定
    const elapsedTime = getElapsedTime();
    const progressRate = task.progress.percentage / 100;
    
    if (progressRate >= 1) return 0;
    
    const estimatedTotal = elapsedTime / progressRate;
    return Math.max(0, estimatedTotal - elapsedTime);
  }, [task, getElapsedTime]);

  // 派生状態
  const isRunning = task?.status === 'processing' || task?.status === 'queued';
  const isCompleted = task?.status === 'completed';
  const isFailed = task?.status === 'failed';
  const progress = task?.progress.percentage || 0;
  const currentStep = task?.progress.currentStep || '';
  const result = task?.result;

  return {
    // タスク状態
    task,
    isRunning,
    isCompleted,
    isFailed,
    progress,
    currentStep,
    result,
    error,

    // タスク制御
    startTask,
    cancelTask,
    retryTask,
    reset,

    // ユーティリティ
    getElapsedTime,
    getEstimatedTimeRemaining
  };
};

/**
 * Blob削除API呼び出し関数
 */
async function cleanupTaskBlob(taskId: string): Promise<void> {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888/.netlify/functions';
    const apiSecret = import.meta.env.VITE_API_SECRET;
    
    if (!apiSecret) {
      console.warn('API secret not configured, skipping blob cleanup');
      return;
    }

    console.log('🗑️ Cleaning up blob for task:', taskId);
    
    const response = await fetch(`${apiBaseUrl}/cleanup-task-blob?taskId=${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiSecret
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Blob cleanup successful:', {
        taskId,
        deleted: result.deleted,
        originalDataSize: result.data?.originalDataSize
      });
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      console.warn('⚠️ Blob cleanup failed:', {
        taskId,
        status: response.status,
        error: errorData.error
      });
    }
  } catch (error) {
    console.warn('⚠️ Blob cleanup request failed:', {
      taskId,
      error: error instanceof Error ? error.message : String(error)
    });
    // エラーは投げない（サイレント失敗）
  }
}