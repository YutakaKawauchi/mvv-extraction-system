/**
 * API Request/Response Logging System (Phase δ.2)
 * APIリクエスト・レスポンスの永続化ログシステム
 */

import Dexie, { type Table } from 'dexie';

export interface ApiLogEntry {
  id: string;
  timestamp: number;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestData: {
    url: string;
    headers: Record<string, string>;
    body: any;
    parameters?: Record<string, any>;
  };
  responseData: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    timing: {
      requestStart: number;
      responseEnd: number;
      duration: number;
    };
  };
  metadata: {
    userAgent: string;
    sessionId?: string;
    companyId?: string;
    ideaId?: string; // 単一アイデア用（後方互換性）
    ideaIds?: string[]; // 複数アイデア用（アイデア生成API用）
    operationType: 'generate-ideas' | 'verify-ideas' | 'extract-mvv' | 'extract-company-info' | 'other';
    costTracking?: {
      estimatedCost: number;
      tokensUsed: number;
      model: string;
    };
  };
  error?: {
    message: string;
    stack?: string;
    type: string;
  };
  tags: string[];
  archived: boolean;
}

export interface ApiLogFilters {
  endpoint?: string;
  method?: string;
  operationType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: number[];
  hasError?: boolean;
  companyId?: string;
  archived?: boolean;
}

export interface ApiLogStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalCost: number;
  byEndpoint: Record<string, number>;
  byStatus: Record<number, number>;
  byOperationType: Record<string, number>;
  dailyStats: Array<{
    date: string;
    requests: number;
    cost: number;
    averageTime: number;
  }>;
}

class ApiLogDatabase extends Dexie {
  logs!: Table<ApiLogEntry>;

  constructor() {
    super('ApiLogStorage');
    
    this.version(1).stores({
      logs: '++id, timestamp, endpoint, method, operationType, companyId, ideaId, archived, tags'
    });

    // 自動ID生成
    this.logs.hook('creating', (_, obj) => {
      if (!obj.id) {
        obj.id = this.generateId();
      }
    });
  }

  private generateId(): string {
    return `api_log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export class ApiLoggerService {
  private db: ApiLogDatabase;
  private readonly MAX_BODY_SIZE = 100 * 1024; // 100KB max body size

  constructor() {
    this.db = new ApiLogDatabase();
    // 自動クリーンアップは無効化 - 管理者パネルから手動削除予定
    // this.setupCleanupJob();
  }

  /**
   * APIリクエスト開始をログ
   */
  async logRequest(
    endpoint: string,
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    metadata: Partial<ApiLogEntry['metadata']> = {}
  ): Promise<string> {
    const logId = `api_log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const requestStart = Date.now();
    
    try {
      // Request bodyのサイズ制限
      const serializedBody = JSON.stringify(body);
      const truncatedBody = serializedBody.length > this.MAX_BODY_SIZE 
        ? { 
            _truncated: true, 
            _originalSize: serializedBody.length,
            _data: serializedBody.substring(0, this.MAX_BODY_SIZE) + '...[truncated]'
          }
        : body;

      const logEntry: Partial<ApiLogEntry> = {
        id: logId,
        timestamp: requestStart,
        endpoint: this.normalizeEndpoint(endpoint),
        method: method as any,
        requestData: {
          url,
          headers: this.sanitizeHeaders(headers),
          body: truncatedBody
        },
        metadata: {
          userAgent: navigator.userAgent,
          operationType: this.determineOperationType(endpoint),
          ...metadata
        },
        tags: [],
        archived: false
      };

      // テンポラリーエントリを保存（レスポンス待ち）
      await this.db.logs.add(logEntry as ApiLogEntry);
      
      return logId;
    } catch (error) {
      console.error('Failed to log API request:', error);
      return logId; // IDは返してレスポンスログを試行
    }
  }

  /**
   * APIレスポンス完了をログ
   */
  async logResponse(
    logId: string,
    status: number,
    statusText: string,
    responseHeaders: Record<string, string>,
    responseBody: any,
    requestStart: number,
    error?: Error
  ): Promise<void> {
    const responseEnd = Date.now();
    const duration = responseEnd - requestStart;

    try {
      // Response bodyのサイズ制限
      const serializedBody = JSON.stringify(responseBody);
      const truncatedBody = serializedBody.length > this.MAX_BODY_SIZE
        ? {
            _truncated: true,
            _originalSize: serializedBody.length,
            _data: serializedBody.substring(0, this.MAX_BODY_SIZE) + '...[truncated]'
          }
        : responseBody;

      const updates: Partial<ApiLogEntry> = {
        responseData: {
          status,
          statusText,
          headers: this.sanitizeHeaders(responseHeaders),
          body: truncatedBody,
          timing: {
            requestStart,
            responseEnd,
            duration
          }
        }
      };

      // エラー情報があれば追加
      if (error) {
        updates.error = {
          message: error.message,
          stack: error.stack,
          type: error.constructor.name
        };
      }

      // コスト情報を抽出（既存のmetadataとマージ）
      if (responseBody?.data?.metadata) {
        const metadata = responseBody.data.metadata;
        if (metadata.estimatedCost || metadata.totalCost) {
          const existingLog = await this.db.logs.get(logId);
          if (existingLog) {
            updates.metadata = {
              ...existingLog.metadata,
              costTracking: {
                estimatedCost: metadata.estimatedCost || metadata.totalCost || 0,
                tokensUsed: metadata.tokensUsed || metadata.totalTokens || 0,
                model: metadata.model || 'unknown'
              }
            };
          }
        }
      }

      await this.db.logs.update(logId, updates);
    } catch (updateError) {
      console.error('Failed to log API response:', updateError);
    }
  }

  /**
   * ログエントリ一覧を取得
   */
  async getLogs(filters?: ApiLogFilters): Promise<ApiLogEntry[]> {
    try {
      let query = this.db.logs.orderBy('timestamp').reverse();

      if (filters) {
        if (filters.endpoint) {
          query = query.filter(log => log.endpoint.includes(filters.endpoint!));
        }
        
        if (filters.method) {
          query = query.filter(log => log.method === filters.method);
        }
        
        if (filters.operationType) {
          query = query.filter(log => log.metadata.operationType === filters.operationType);
        }
        
        if (filters.status && filters.status.length > 0) {
          query = query.filter(log => 
            log.responseData && filters.status!.includes(log.responseData.status)
          );
        }
        
        if (filters.hasError !== undefined) {
          query = query.filter(log => !!log.error === filters.hasError!);
        }
        
        if (filters.companyId) {
          query = query.filter(log => log.metadata.companyId === filters.companyId);
        }
        
        if (filters.archived !== undefined) {
          query = query.filter(log => log.archived === filters.archived);
        }
        
        if (filters.dateRange) {
          const start = filters.dateRange.start.getTime();
          const end = filters.dateRange.end.getTime();
          query = query.filter(log => log.timestamp >= start && log.timestamp <= end);
        }
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to get API logs:', error);
      throw new Error('APIログの取得に失敗しました');
    }
  }

  /**
   * ログ統計情報を取得
   */
  async getStatistics(): Promise<ApiLogStatistics> {
    try {
      const allLogs = await this.db.logs.toArray();
      const logsWithResponse = allLogs.filter(log => log.responseData);
      
      const successfulRequests = logsWithResponse.filter(
        log => log.responseData.status >= 200 && log.responseData.status < 300
      ).length;

      const totalCost = allLogs.reduce((sum, log) => {
        return sum + (log.metadata.costTracking?.estimatedCost || 0);
      }, 0);

      const averageResponseTime = logsWithResponse.length > 0
        ? logsWithResponse.reduce((sum, log) => sum + log.responseData.timing.duration, 0) / logsWithResponse.length
        : 0;

      // エンドポイント別統計
      const byEndpoint = allLogs.reduce((acc, log) => {
        acc[log.endpoint] = (acc[log.endpoint] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // ステータス別統計
      const byStatus = logsWithResponse.reduce((acc, log) => {
        acc[log.responseData.status] = (acc[log.responseData.status] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      // オペレーション別統計
      const byOperationType = allLogs.reduce((acc, log) => {
        const type = log.metadata.operationType;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 日別統計（過去30日）
      const dailyStats = this.calculateDailyStats(allLogs);

      return {
        totalRequests: allLogs.length,
        successfulRequests,
        failedRequests: logsWithResponse.length - successfulRequests,
        averageResponseTime,
        totalCost,
        byEndpoint,
        byStatus,
        byOperationType,
        dailyStats
      };
    } catch (error) {
      console.error('Failed to get API statistics:', error);
      throw new Error('API統計の取得に失敗しました');
    }
  }

  /**
   * ログを削除
   */
  async deleteLog(logId: string): Promise<void> {
    try {
      await this.db.logs.delete(logId);
    } catch (error) {
      console.error('Failed to delete API log:', error);
      throw new Error('APIログの削除に失敗しました');
    }
  }

  /**
   * ログをアーカイブ
   */
  async archiveLog(logId: string): Promise<void> {
    try {
      await this.db.logs.update(logId, { archived: true });
    } catch (error) {
      console.error('Failed to archive API log:', error);
      throw new Error('APIログのアーカイブに失敗しました');
    }
  }

  /**
   * APIログにアイデアIDを追加で記録（ドキュメント紐づけ強化）
   */
  async updateLogWithIdeaIds(logId: string, ideaIds: string[]): Promise<void> {
    try {
      const existingLog = await this.db.logs.get(logId);
      if (!existingLog) {
        throw new Error('APIログが見つかりません');
      }

      await this.db.logs.update(logId, {
        metadata: {
          ...existingLog.metadata,
          ideaIds: ideaIds,
          // 後方互換性のため、最初のアイデアIDを単一ideaIdにも設定
          ideaId: ideaIds.length > 0 ? ideaIds[0] : undefined
        }
      });

      console.log('API log updated with idea IDs:', { logId, ideaIds });
    } catch (error) {
      console.error('Failed to update API log with idea IDs:', error);
      throw new Error('APIログのアイデアID更新に失敗しました');
    }
  }

  /**
   * 特定のアイデアIDに関連するAPIログを取得
   */
  async getLogsByIdeaId(ideaId: string): Promise<ApiLogEntry[]> {
    try {
      const logs = await this.db.logs
        .filter(log => {
          return log.metadata.ideaId === ideaId || 
                 (log.metadata.ideaIds ? log.metadata.ideaIds.includes(ideaId) : false);
        })
        .reverse()
        .toArray();
      
      return logs;
    } catch (error) {
      console.error('Failed to get logs by idea ID:', error);
      throw new Error('アイデア関連APIログの取得に失敗しました');
    }
  }

  /**
   * 特定の企業IDに関連するAPIログを取得
   */
  async getLogsByCompanyId(companyId: string): Promise<ApiLogEntry[]> {
    try {
      const logs = await this.db.logs
        .filter(log => log.metadata.companyId === companyId)
        .reverse()
        .toArray();
      
      return logs;
    } catch (error) {
      console.error('Failed to get logs by company ID:', error);
      throw new Error('企業関連APIログの取得に失敗しました');
    }
  }

  /**
   * 古いログの自動クリーンアップ
   */
  async cleanupOldLogs(olderThanDays = 30): Promise<number> {
    try {
      const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const oldLogs = await this.db.logs
        .where('timestamp')
        .below(cutoffDate)
        .toArray();

      const deletedCount = oldLogs.length;
      
      if (deletedCount > 0) {
        await this.db.logs
          .where('timestamp')
          .below(cutoffDate)
          .delete();
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }

  /**
   * 全ログをJSONでエクスポート
   */
  async exportToJSON(filters?: ApiLogFilters): Promise<string> {
    try {
      const logs = await this.getLogs(filters);
      return JSON.stringify(logs, null, 2);
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw new Error('ログのエクスポートに失敗しました');
    }
  }

  /**
   * プライベートヘルパーメソッド
   */
  private normalizeEndpoint(endpoint: string): string {
    // URL から関数名を抽出
    const match = endpoint.match(/\/([^\/]+)$/);
    return match ? match[1] : endpoint;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // 機密情報をマスク
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
      if (sanitized[key.toLowerCase()]) {
        sanitized[key.toLowerCase()] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private determineOperationType(endpoint: string): ApiLogEntry['metadata']['operationType'] {
    if (endpoint.includes('generate-business-ideas')) return 'generate-ideas';
    if (endpoint.includes('verify-business-idea')) return 'verify-ideas';
    if (endpoint.includes('extract-mvv')) return 'extract-mvv';
    if (endpoint.includes('extract-company-info')) return 'extract-company-info';
    return 'other';
  }

  private calculateDailyStats(logs: ApiLogEntry[]): ApiLogStatistics['dailyStats'] {
    const dailyMap = new Map<string, { requests: number; cost: number; times: number[] }>();
    
    logs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { requests: 0, cost: 0, times: [] };
      
      existing.requests++;
      existing.cost += log.metadata.costTracking?.estimatedCost || 0;
      
      if (log.responseData?.timing?.duration) {
        existing.times.push(log.responseData.timing.duration);
      }
      
      dailyMap.set(date, existing);
    });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        requests: stats.requests,
        cost: stats.cost,
        averageTime: stats.times.length > 0 
          ? stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length 
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // 過去30日分
  }

  // 自動クリーンアップは無効化済み - 必要時のみ使用
  // private setupCleanupJob(): void {
  //   // 起動時とその後定期的にクリーンアップを実行
  //   this.cleanupOldLogs();
  //   
  //   // 1時間ごとにクリーンアップをチェック
  //   setInterval(() => {
  //     this.cleanupOldLogs();
  //   }, 60 * 60 * 1000);
  // }
}

// シングルトンインスタンス
export const apiLoggerService = new ApiLoggerService();