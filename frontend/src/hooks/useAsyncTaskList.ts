/**
 * 非同期タスクリスト管理Hook (Phase ε.1.2)
 * 複数タスクの監視、フィルタリング、統計情報取得
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AsyncTask,
  AsyncTaskFilters,
  AsyncTaskStatistics,
  AsyncTaskStatus,
  AsyncTaskType
} from '../types/asyncTask';
import { asyncTaskStorageService } from '../services/asyncTaskStorage';

export interface UseAsyncTaskListOptions {
  filters?: AsyncTaskFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableStatistics?: boolean;
  maxTasks?: number;
}

export interface UseAsyncTaskListReturn {
  // タスクリスト
  tasks: AsyncTask[];
  filteredTasks: AsyncTask[];
  activeTasks: AsyncTask[];
  
  // 統計情報
  statistics: AsyncTaskStatistics | null;
  
  // 状態
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // アクション
  refreshTasks: () => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  exportTasks: (filters?: AsyncTaskFilters) => Promise<string>;
  
  // フィルタリング
  updateFilters: (newFilters: Partial<AsyncTaskFilters>) => void;
  clearFilters: () => void;
  
  // ユーティリティ
  getTasksByType: (type: AsyncTaskType) => AsyncTask[];
  getTasksByStatus: (status: AsyncTaskStatus) => AsyncTask[];
  getTasksByCompany: (companyId: string) => AsyncTask[];
}

const DEFAULT_OPTIONS: Required<UseAsyncTaskListOptions> = {
  filters: {},
  autoRefresh: true,
  refreshInterval: 5000, // 5秒
  enableStatistics: true,
  maxTasks: 100
};

export const useAsyncTaskList = (
  options: Partial<UseAsyncTaskListOptions> = {}
): UseAsyncTaskListReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [tasks, setTasks] = useState<AsyncTask[]>([]);
  const [statistics, setStatistics] = useState<AsyncTaskStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [currentFilters, setCurrentFilters] = useState<AsyncTaskFilters>(opts.filters);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // 初期データロードと自動リフレッシュの設定
  useEffect(() => {
    refreshTasks();

    if (opts.autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        refreshTasks();
      }, opts.refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [opts.autoRefresh, opts.refreshInterval, currentFilters]);

  /**
   * タスクリストの更新
   */
  const refreshTasks = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // タスクリストの取得
      const taskList = await asyncTaskStorageService.getTasks(currentFilters);
      
      // 最大タスク数の制限
      const limitedTasks = taskList.slice(0, opts.maxTasks);

      if (mountedRef.current) {
        setTasks(limitedTasks);
        setLastUpdated(Date.now());
      }

      // 統計情報の取得
      if (opts.enableStatistics) {
        const stats = await asyncTaskStorageService.getStatistics();
        if (mountedRef.current) {
          setStatistics(stats);
        }
      }

    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラー';
        setError(errorMessage);
        console.error('Failed to refresh tasks:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentFilters, opts.maxTasks, opts.enableStatistics]);

  /**
   * タスクの削除
   */
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      await asyncTaskStorageService.deleteTask(taskId);
      
      // ローカル状態から即座に削除
      setTasks(prev => prev.filter(task => task.id !== taskId));
      
      // 統計情報を更新
      if (opts.enableStatistics) {
        const stats = await asyncTaskStorageService.getStatistics();
        setStatistics(stats);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'タスクの削除に失敗しました';
      setError(errorMessage);
      throw err;
    }
  }, [opts.enableStatistics]);

  /**
   * タスクのキャンセル
   */
  const cancelTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      await asyncTaskStorageService.cancelTask(taskId);
      
      // ローカル状態を即座に更新
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'cancelled' as AsyncTaskStatus,
              progress: {
                ...task.progress,
                currentStep: 'キャンセルされました'
              }
            }
          : task
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'タスクのキャンセルに失敗しました';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * 全タスクのクリア
   */
  const clearAll = useCallback(async (): Promise<void> => {
    try {
      await asyncTaskStorageService.clearAll();
      setTasks([]);
      setStatistics(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'タスクのクリアに失敗しました';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * タスクのエクスポート
   */
  const exportTasks = useCallback(async (exportFilters?: AsyncTaskFilters): Promise<string> => {
    try {
      return await asyncTaskStorageService.exportToJSON(exportFilters || currentFilters);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エクスポートに失敗しました';
      setError(errorMessage);
      throw err;
    }
  }, [currentFilters]);

  /**
   * フィルターの更新
   */
  const updateFilters = useCallback((newFilters: Partial<AsyncTaskFilters>) => {
    setCurrentFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * フィルターのクリア
   */
  const clearFilters = useCallback(() => {
    setCurrentFilters({});
  }, []);

  /**
   * タイプ別タスク取得
   */
  const getTasksByType = useCallback((type: AsyncTaskType): AsyncTask[] => {
    return tasks.filter(task => task.type === type);
  }, [tasks]);

  /**
   * ステータス別タスク取得
   */
  const getTasksByStatus = useCallback((status: AsyncTaskStatus): AsyncTask[] => {
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  /**
   * 企業別タスク取得
   */
  const getTasksByCompany = useCallback((companyId: string): AsyncTask[] => {
    return tasks.filter(task => task.metadata.companyId === companyId);
  }, [tasks]);

  // 派生状態の計算
  const filteredTasks = tasks; // フィルターは既にサーバーサイドで適用済み
  const activeTasks = tasks.filter(task => 
    task.status === 'queued' || task.status === 'processing'
  );

  return {
    // タスクリスト
    tasks,
    filteredTasks,
    activeTasks,
    
    // 統計情報
    statistics,
    
    // 状態
    isLoading,
    error,
    lastUpdated,
    
    // アクション
    refreshTasks,
    deleteTask,
    cancelTask,
    clearAll,
    exportTasks,
    
    // フィルタリング
    updateFilters,
    clearFilters,
    
    // ユーティリティ
    getTasksByType,
    getTasksByStatus,
    getTasksByCompany
  };
};