/**
 * 非同期タスク永続化ストレージ (Phase ε.1)
 * IndexedDBを使用した汎用非同期タスク管理
 */

import Dexie, { type Table } from 'dexie';
import type {
  AsyncTask,
  AsyncTaskCreateRequest,
  AsyncTaskUpdateRequest,
  AsyncTaskFilters,
  AsyncTaskStatistics,
  AsyncTaskStatus,
  AsyncTaskType
} from '../types/asyncTask';
import { AsyncTaskError } from '../types/asyncTask';

class AsyncTaskDatabase extends Dexie {
  asyncTasks!: Table<AsyncTask>;

  constructor() {
    super('AsyncTaskStorage');
    
    this.version(1).stores({
      asyncTasks: '++id, type, status, metadata.companyId, metadata.ideaId, metadata.userId, timestamps.createdAt, timestamps.completedAt, metadata.priority'
    });

    // フック設定
    this.asyncTasks.hook('creating', (_, obj) => {
      const now = Date.now();
      if (!obj.id) {
        obj.id = this.generateTaskId();
      }
      obj.timestamps.createdAt = now;
      obj.timestamps.lastUpdatedAt = now;
    });

    this.asyncTasks.hook('updating', (modifications, _, obj) => {
      (modifications as any).timestamps = {
        ...obj.timestamps,
        lastUpdatedAt: Date.now()
      };
    });
  }

  public generateTaskId(): string {
    return `async_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export class AsyncTaskStorageService {
  private db: AsyncTaskDatabase;

  constructor() {
    this.db = new AsyncTaskDatabase();
    this.setupCleanupJob();
  }

  /**
   * 新しい非同期タスクを作成
   */
  async createTask(request: AsyncTaskCreateRequest): Promise<AsyncTask> {
    try {
      const now = Date.now();
      const task: AsyncTask = {
        id: this.db.generateTaskId(),
        type: request.type,
        status: 'queued',
        progress: {
          percentage: 0,
          currentStep: 'タスクを初期化中...',
          detailedSteps: []
        },
        inputData: request.inputData,
        metadata: {
          priority: 'normal',
          maxRetries: 3,
          currentRetry: 0,
          ...request.metadata
        },
        timestamps: {
          createdAt: now,
          lastUpdatedAt: now
        },
        config: {
          timeoutMs: 15 * 60 * 1000, // 15分デフォルト
          pollIntervalMs: 5000,       // 5秒デフォルト（サーバー負荷軽減）
          persistResult: true,
          autoCleanup: true,
          cleanupPolicy: 'delayed',   // デフォルトは遅延削除
          ...request.config
        }
      };

      await this.db.asyncTasks.add(task);
      console.log('Async task created:', task.id);
      return task;
    } catch (error) {
      console.error('Failed to create async task:', error);
      throw new AsyncTaskError(
        'タスクの作成に失敗しました',
        'TASK_CREATE_FAILED',
        '',
        true,
        error
      );
    }
  }

  /**
   * タスクの更新
   */
  async updateTask(update: AsyncTaskUpdateRequest): Promise<void> {
    try {
      const existingTask = await this.db.asyncTasks.get(update.id);
      if (!existingTask) {
        throw new AsyncTaskError(
          'タスクが見つかりません',
          'TASK_NOT_FOUND',
          update.id,
          false
        );
      }

      const updates: Partial<AsyncTask> = {};

      if (update.status !== undefined) {
        updates.status = update.status;
        
        // ステータス変更時のタイムスタンプ更新
        if (update.status === 'processing' && !existingTask.timestamps.startedAt) {
          updates.timestamps = {
            ...existingTask.timestamps,
            startedAt: Date.now()
          };
        } else if (['completed', 'failed', 'cancelled'].includes(update.status)) {
          updates.timestamps = {
            ...existingTask.timestamps,
            completedAt: Date.now()
          };
        }
      }

      if (update.progress !== undefined) {
        updates.progress = {
          ...existingTask.progress,
          ...update.progress
        };
      }

      if (update.result !== undefined) {
        updates.result = update.result;
      }

      if (update.error !== undefined) {
        updates.error = update.error;
      }

      if (update.metadata !== undefined) {
        updates.metadata = {
          ...existingTask.metadata,
          ...update.metadata
        };
      }

      await this.db.asyncTasks.update(update.id, updates);
      console.log('Async task updated:', update.id);
    } catch (error) {
      if (error instanceof AsyncTaskError) {
        throw error;
      }
      console.error('Failed to update async task:', error);
      throw new AsyncTaskError(
        'タスクの更新に失敗しました',
        'TASK_UPDATE_FAILED',
        update.id,
        true,
        error
      );
    }
  }

  /**
   * タスクの取得
   */
  async getTask(taskId: string): Promise<AsyncTask | undefined> {
    try {
      return await this.db.asyncTasks.get(taskId);
    } catch (error) {
      console.error('Failed to get async task:', error);
      throw new AsyncTaskError(
        'タスクの取得に失敗しました',
        'TASK_GET_FAILED',
        taskId,
        true,
        error
      );
    }
  }

  /**
   * タスク一覧の取得（フィルタ付き）
   */
  async getTasks(filters?: AsyncTaskFilters): Promise<AsyncTask[]> {
    try {
      let query = this.db.asyncTasks.orderBy('timestamps.createdAt').reverse();

      if (filters) {
        if (filters.type) {
          query = query.filter(task => task.type === filters.type);
        }

        if (filters.status) {
          const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
          query = query.filter(task => statusArray.includes(task.status));
        }

        if (filters.companyId) {
          query = query.filter(task => task.metadata.companyId === filters.companyId);
        }

        if (filters.ideaId) {
          query = query.filter(task => task.metadata.ideaId === filters.ideaId);
        }

        if (filters.userId) {
          query = query.filter(task => task.metadata.userId === filters.userId);
        }

        if (filters.priority) {
          query = query.filter(task => task.metadata.priority === filters.priority);
        }

        if (filters.dateRange) {
          const start = filters.dateRange.start.getTime();
          const end = filters.dateRange.end.getTime();
          query = query.filter(task => 
            task.timestamps.createdAt >= start && task.timestamps.createdAt <= end
          );
        }
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to get async tasks:', error);
      throw new AsyncTaskError(
        'タスク一覧の取得に失敗しました',
        'TASKS_GET_FAILED',
        '',
        true,
        error
      );
    }
  }

  /**
   * アクティブなタスクの取得
   */
  async getActiveTasks(): Promise<AsyncTask[]> {
    return this.getTasks({
      status: ['queued', 'processing']
    });
  }


  /**
   * タスクを消費済み状態に変更（結果表示後）
   */
  async markTaskAsConsumed(taskId: string): Promise<void> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new AsyncTaskError(
          'タスクが見つかりません',
          'TASK_NOT_FOUND',
          taskId,
          false
        );
      }

      if (task.status !== 'completed') {
        console.warn(`Task ${taskId} is not completed, cannot mark as consumed`);
        return;
      }

      await this.updateTask({
        id: taskId,
        status: 'consumed'
      });

      console.log(`Task ${taskId} marked as consumed`);

      // 即座削除ポリシーの場合は削除
      if (task.config.cleanupPolicy === 'immediate') {
        setTimeout(() => {
          this.deleteTask(taskId).catch(err => 
            console.error(`Failed to delete task ${taskId}:`, err)
          );
        }, 1000); // 1秒後に削除（ログ確認用）
      }
    } catch (error) {
      console.error('Failed to mark task as consumed:', error);
      throw new AsyncTaskError(
        'タスクの消費済み状態への変更に失敗しました',
        'MARK_CONSUMED_FAILED',
        taskId,
        true,
        error
      );
    }
  }

  /**
   * タスクの削除
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.db.asyncTasks.delete(taskId);
      console.log(`Task ${taskId} deleted from storage`);
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      throw new AsyncTaskError(
        'タスクの削除に失敗しました',
        'TASK_DELETE_FAILED',
        taskId,
        true,
        error
      );
    }
  }

  /**
   * タスクのキャンセル
   */
  async cancelTask(taskId: string): Promise<void> {
    try {
      await this.updateTask({
        id: taskId,
        status: 'cancelled',
        progress: {
          currentStep: 'タスクがキャンセルされました'
        }
      });
    } catch (error) {
      console.error('Failed to cancel async task:', error);
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
   * 統計情報の取得
   */
  async getStatistics(): Promise<AsyncTaskStatistics> {
    try {
      const allTasks = await this.db.asyncTasks.toArray();
      
      const byStatus = allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<AsyncTaskStatus, number>);

      const byType = allTasks.reduce((acc, task) => {
        acc[task.type] = (acc[task.type] || 0) + 1;
        return acc;
      }, {} as Record<AsyncTaskType, number>);

      const completedTasks = allTasks.filter(task => 
        task.status === 'completed' && 
        task.timestamps.startedAt && 
        task.timestamps.completedAt
      );

      const averageExecutionTime = completedTasks.length > 0
        ? completedTasks.reduce((sum, task) => 
            sum + (task.timestamps.completedAt! - task.timestamps.startedAt!), 0
          ) / completedTasks.length
        : 0;

      const successfulTasks = allTasks.filter(task => task.status === 'completed').length;
      const failedTasks = allTasks.filter(task => task.status === 'failed').length;
      const totalProcessed = successfulTasks + failedTasks;

      const successRate = totalProcessed > 0 ? (successfulTasks / totalProcessed) * 100 : 0;
      const failureRate = totalProcessed > 0 ? (failedTasks / totalProcessed) * 100 : 0;

      // コスト計算（結果から推定）
      const totalCost = completedTasks.reduce((sum, task) => {
        const metadata = task.result?.metadata;
        return sum + (metadata?.totalCost || metadata?.estimatedCost || 0);
      }, 0);

      const averageCost = completedTasks.length > 0 ? totalCost / completedTasks.length : 0;

      // 最近のタスク（過去10件）
      const recentTasks = allTasks
        .sort((a, b) => b.timestamps.createdAt - a.timestamps.createdAt)
        .slice(0, 10);

      return {
        total: allTasks.length,
        byStatus,
        byType,
        averageExecutionTime,
        successRate,
        failureRate,
        totalCost,
        averageCost,
        recentTasks
      };
    } catch (error) {
      console.error('Failed to get async task statistics:', error);
      throw new AsyncTaskError(
        '統計情報の取得に失敗しました',
        'STATISTICS_GET_FAILED',
        '',
        true,
        error
      );
    }
  }

  /**
   * 古いタスクの自動クリーンアップ
   */
  async cleanupOldTasks(olderThanDays = 7): Promise<number> {
    try {
      const now = Date.now();
      const cutoffDate = now - (olderThanDays * 24 * 60 * 60 * 1000);
      const consumedCutoff = now - (60 * 60 * 1000); // consumed状態は1時間後に削除
      
      // 1. consumed状態のタスクを1時間後に削除
      const consumedTasks = await this.db.asyncTasks
        .where('status')
        .equals('consumed')
        .and(task => 
          task.timestamps.lastUpdatedAt < consumedCutoff &&
          task.config.autoCleanup
        )
        .toArray();

      // 2. 古い完了タスクを削除（7日後）
      const oldTasks = await this.db.asyncTasks
        .where('timestamps.createdAt')
        .below(cutoffDate)
        .and(task => 
          ['completed', 'failed', 'cancelled'].includes(task.status) &&
          task.config.autoCleanup
        )
        .toArray();

      const totalDeleted = consumedTasks.length + oldTasks.length;
      
      if (totalDeleted > 0) {
        // consumed状態のタスクを削除
        if (consumedTasks.length > 0) {
          const consumedIds = consumedTasks.map(t => t.id);
          await this.db.asyncTasks.bulkDelete(consumedIds);
          console.log(`Cleaned up ${consumedTasks.length} consumed tasks (1h+ old)`);
        }

        // 古いタスクを削除
        if (oldTasks.length > 0) {
          await this.db.asyncTasks
            .where('timestamps.createdAt')
            .below(cutoffDate)
            .delete();
          console.log(`Cleaned up ${oldTasks.length} old tasks (${olderThanDays}+ days old)`);
        }
      }

      return totalDeleted;
    } catch (error) {
      console.error('Failed to cleanup old tasks:', error);
      return 0;
    }
  }

  /**
   * 全データのJSONエクスポート
   */
  async exportToJSON(filters?: AsyncTaskFilters): Promise<string> {
    try {
      const tasks = await this.getTasks(filters);
      return JSON.stringify(tasks, null, 2);
    } catch (error) {
      console.error('Failed to export async tasks:', error);
      throw new AsyncTaskError(
        'タスクのエクスポートに失敗しました',
        'EXPORT_FAILED',
        '',
        true,
        error
      );
    }
  }

  /**
   * 全データのクリア
   */
  async clearAll(): Promise<void> {
    try {
      await this.db.asyncTasks.clear();
      console.log('All async tasks cleared');
    } catch (error) {
      console.error('Failed to clear async tasks:', error);
      throw new AsyncTaskError(
        'タスクのクリアに失敗しました',
        'CLEAR_FAILED',
        '',
        true,
        error
      );
    }
  }

  /**
   * 定期クリーンアップジョブのセットアップ
   */
  private setupCleanupJob(): void {
    // 1時間ごとにクリーンアップを実行
    setInterval(() => {
      this.cleanupOldTasks();
    }, 60 * 60 * 1000);
  }
}

// シングルトンインスタンス
export const asyncTaskStorageService = new AsyncTaskStorageService();

// デバッグ用グローバルヘルパー
if (typeof window !== 'undefined') {
  (window as any).debugAsyncTasks = {
    getTask: (id: string) => asyncTaskStorageService.getTask(id),
    getAllTasks: () => (asyncTaskStorageService as any).db.asyncTasks.toArray(),
    getCompletedTasks: () => (asyncTaskStorageService as any).db.asyncTasks.where('status').equals('completed').toArray(),
    getConsumedTasks: () => (asyncTaskStorageService as any).db.asyncTasks.where('status').equals('consumed').toArray(),
    clearAllTasks: () => asyncTaskStorageService.clearAll(),
    // タスク状態遷移
    markAsConsumed: (id: string) => asyncTaskStorageService.markTaskAsConsumed(id),
    deleteTask: (id: string) => asyncTaskStorageService.deleteTask(id),
    // 強制的にタスクを再更新（コールバックトリガー用）
    refreshTask: async (id: string) => {
      const task = await asyncTaskStorageService.getTask(id);
      if (task) {
        // タイムスタンプを更新して強制的に変更をトリガー
        await asyncTaskStorageService.updateTask({
          id: task.id,
          timestamps: {
            ...task.timestamps,
            lastUpdatedAt: Date.now()
          }
        });
      }
    },
    // ストレージ統計
    getStats: async () => {
      const all = await (asyncTaskStorageService as any).db.asyncTasks.toArray();
      const stats = {
        total: all.length,
        byStatus: {} as Record<string, number>,
        totalSize: JSON.stringify(all).length,
        oldestTask: all.length > 0 ? Math.min(...all.map((t: AsyncTask) => t.timestamps.createdAt)) : null,
        newestTask: all.length > 0 ? Math.max(...all.map((t: AsyncTask) => t.timestamps.createdAt)) : null
      };
      
      all.forEach((task: AsyncTask) => {
        stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      });
      
      return stats;
    }
  };
}