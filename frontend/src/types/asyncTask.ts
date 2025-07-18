/**
 * 汎用非同期タスクシステム型定義 (Phase ε.1)
 * 長時間実行APIの非同期処理対応
 */

export type AsyncTaskType = 
  | 'verify-business-idea'
  | 'generate-business-ideas'
  | 'extract-mvv'
  | 'extract-company-info'
  | 'analyze-competition'
  | 'other';

export type AsyncTaskStatus = 
  | 'queued'      // キューに追加済み
  | 'processing'  // 処理中
  | 'completed'   // 完了
  | 'consumed'    // 完了済み（結果を表示済み）
  | 'failed'      // 失敗
  | 'cancelled';  // キャンセル

export interface AsyncTaskProgress {
  percentage: number;           // 0-100の進捗率
  currentStep: string;         // 現在の処理ステップ
  estimatedTimeRemaining?: number; // 推定残り時間（秒）
  updatedAt?: number;          // 最終更新時刻
  detailedSteps?: {
    stepName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    duration?: number;
    startTime?: number;        // ステップ開始時刻
  }[];
}

export interface AsyncTask {
  // 基本情報
  id: string;                   // タスクID
  type: AsyncTaskType;          // タスクタイプ
  status: AsyncTaskStatus;      // 現在のステータス
  
  // 進捗情報
  progress: AsyncTaskProgress;
  
  // 実行データ
  inputData: any;               // 入力データ
  result?: any;                 // 実行結果
  error?: {
    message: string;
    code?: string;
    details?: any;
    retryable: boolean;
  };
  
  // メタデータ
  metadata: {
    userId?: string;
    sessionId?: string;
    companyId?: string;
    ideaId?: string;
    apiLogId?: string;          // APIログとの紐づけ
    priority: 'low' | 'normal' | 'high' | 'urgent';
    maxRetries: number;
    currentRetry: number;
    backgroundFunctionUrl?: string; // Background Function URL
  };
  
  // タイムスタンプ
  timestamps: {
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    lastUpdatedAt: number;
  };
  
  // 設定
  config: {
    timeoutMs: number;          // タイムアウト時間
    pollIntervalMs: number;     // ポーリング間隔
    enableRealtime?: boolean;   // リアルタイム更新
    persistResult: boolean;     // 結果の永続化
    autoCleanup: boolean;       // 自動クリーンアップ
    cleanupPolicy?: 'immediate' | 'delayed' | 'manual'; // クリーンアップポリシー
  };
}

export interface AsyncTaskCreateRequest {
  type: AsyncTaskType;
  inputData: any;
  metadata?: Partial<AsyncTask['metadata']>;
  config?: Partial<AsyncTask['config']>;
}

export interface AsyncTaskUpdateRequest {
  id: string;
  status?: AsyncTaskStatus;
  progress?: Partial<AsyncTaskProgress>;
  result?: any;
  error?: AsyncTask['error'];
  metadata?: Partial<AsyncTask['metadata']>;
  timestamps?: Partial<AsyncTask['timestamps']>;
}

export interface AsyncTaskFilters {
  type?: AsyncTaskType;
  status?: AsyncTaskStatus | AsyncTaskStatus[];
  companyId?: string;
  ideaId?: string;
  userId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  priority?: AsyncTask['metadata']['priority'];
}

export interface AsyncTaskStatistics {
  total: number;
  byStatus: Record<AsyncTaskStatus, number>;
  byType: Record<AsyncTaskType, number>;
  averageExecutionTime: number;
  successRate: number;
  failureRate: number;
  totalCost: number;
  averageCost: number;
  recentTasks: AsyncTask[];
}

// Background Function レスポンス型
export interface BackgroundTaskResponse {
  success: boolean;
  taskId: string;
  status: AsyncTaskStatus;
  progress?: AsyncTaskProgress;
  result?: any;
  data?: any;                    // API レスポンス用データ
  error?: string;
  metadata?: {
    backgroundFunctionId?: string;
    processingTime?: number;
    cost?: number;
    completedViaPulling?: boolean;      // 404エラーで完了判定した場合のフラグ
    finalProgress?: AsyncTaskProgress;  // 最終進捗情報
    resultSource?: string;              // 結果の取得元 ('resultBlob', 'unavailable' など)
    retrievedAt?: number;               // 結果取得時刻
    currentProgress?: AsyncTaskProgress; // 現在の進捗情報（実行中）
  };
}

// タスク実行結果型（型別特化）
export interface BusinessIdeaVerificationResult {
  industryAnalysis: any;
  marketValidation: any;
  businessModelValidation: any;
  competitiveAnalysis: any;
  improvementSuggestions: any;
  overallAssessment: any;
  metadata: {
    verificationLevel: string;
    totalTokens: number;
    totalCost: number;
    model: string;
    confidence: number;
    version: string;
  };
}

export interface BusinessIdeaGenerationResult {
  ideas: any[];
  metadata: {
    model: string;
    tokensUsed: number;
    estimatedCost: number;
    confidence: number;
    version: string;
    cacheLevel?: number;
  };
}

export interface MVVExtractionResult {
  mission: string;
  vision: string;
  values: string[];
  confidence_scores: {
    mission: number;
    vision: number;
    values: number;
  };
  extracted_from: string;
  metadata: {
    processingTime: number;
    timestamp: string;
    source: string;
  };
}

// エラータイプ
export class AsyncTaskError extends Error {
  public code: string;
  public taskId: string;
  public retryable: boolean;
  public details?: any;

  constructor(
    message: string,
    code: string,
    taskId: string,
    retryable: boolean = false,
    details?: any
  ) {
    super(message);
    this.name = 'AsyncTaskError';
    this.code = code;
    this.taskId = taskId;
    this.retryable = retryable;
    this.details = details;
  }
}

// タスク実行コンテキスト
export interface TaskExecutionContext {
  taskId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  apiVersion: string;
  clientInfo: {
    userAgent: string;
    timezone: string;
    locale: string;
  };
}