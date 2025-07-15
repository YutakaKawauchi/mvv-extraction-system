/**
 * 非同期タスク進捗表示コンポーネント (Phase ε.1.2)
 * リアルタイム進捗、詳細ステップ、エラー表示
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  X
} from 'lucide-react';
import type { AsyncTask, AsyncTaskStatus } from '../../types/asyncTask';

export interface AsyncTaskProgressProps {
  task: AsyncTask | null;
  showDetailedSteps?: boolean;
  showElapsedTime?: boolean;
  showEstimatedTime?: boolean;
  showControls?: boolean;
  compact?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const AsyncTaskProgress: React.FC<AsyncTaskProgressProps> = ({
  task,
  showDetailedSteps = true,
  showElapsedTime = true,
  showEstimatedTime = true,
  showControls = true,
  compact = false,
  onCancel,
  onRetry,
  className = ''
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // 経過時間の更新
  useEffect(() => {
    if (!task || !task.timestamps.startedAt || ['completed', 'failed', 'cancelled'].includes(task.status)) {
      return;
    }

    const updateElapsedTime = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - task.timestamps.startedAt!) / 1000);
      setElapsedTime(elapsed);
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [task]);

  if (!task) {
    return null;
  }

  const getStatusIcon = (status: AsyncTaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-500" />;
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: AsyncTaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'processing':
        return 'bg-blue-500';
      case 'queued':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status: AsyncTaskStatus) => {
    switch (status) {
      case 'completed':
        return '完了';
      case 'failed':
        return '失敗';
      case 'cancelled':
        return 'キャンセル';
      case 'processing':
        return '処理中';
      case 'queued':
        return '待機中';
      default:
        return '不明';
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  };

  const formatEstimatedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    return formatTime(seconds);
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {getStatusIcon(task.status)}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">
              {task.type}
            </span>
            <span className="text-xs text-gray-500">
              {task.progress.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(task.status)}`}
              style={{ width: `${task.progress.percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon(task.status)}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {task.type}
            </h3>
            <p className="text-sm text-gray-600">
              {getStatusText(task.status)}
            </p>
          </div>
        </div>
        
        {showControls && (
          <div className="flex items-center space-x-2">
            {task.status === 'processing' && onCancel && (
              <button
                onClick={onCancel}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="キャンセル"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {task.status === 'failed' && onRetry && (
              <button
                onClick={onRetry}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="リトライ"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 進捗バー */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            進捗
          </span>
          <span className="text-sm text-gray-600">
            {task.progress.percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getStatusColor(task.status)}`}
            style={{ width: `${task.progress.percentage}%` }}
          />
        </div>
      </div>

      {/* 現在のステップ */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">現在のステップ:</p>
        <p className="text-sm font-medium text-gray-900">
          {task.progress.currentStep}
        </p>
      </div>

      {/* 詳細ステップ */}
      {showDetailedSteps && task.progress.detailedSteps && task.progress.detailedSteps.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">詳細ステップ:</p>
          <div className="space-y-2">
            {task.progress.detailedSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  step.status === 'completed' ? 'bg-green-500' :
                  step.status === 'processing' ? 'bg-blue-500' :
                  step.status === 'failed' ? 'bg-red-500' :
                  'bg-gray-300'
                }`} />
                <span className={`text-sm ${
                  step.status === 'completed' ? 'text-green-700' :
                  step.status === 'processing' ? 'text-blue-700' :
                  step.status === 'failed' ? 'text-red-700' :
                  'text-gray-600'
                }`}>
                  {step.stepName}
                </span>
                {step.duration && (
                  <span className="text-xs text-gray-500">
                    ({formatTime(step.duration / 1000)})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 時間情報 */}
      {(showElapsedTime || showEstimatedTime) && (
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          {showElapsedTime && task.timestamps.startedAt && (
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>経過時間: {formatTime(elapsedTime)}</span>
            </div>
          )}
          
          {showEstimatedTime && task.progress.estimatedTimeRemaining && task.status === 'processing' && (
            <div className="flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4" />
              <span>推定残り時間: {formatEstimatedTime(task.progress.estimatedTimeRemaining)}</span>
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {task.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 mb-1">
                エラーが発生しました
              </h4>
              <p className="text-sm text-red-700">
                {task.error.message}
              </p>
              {task.error.retryable && (
                <p className="text-xs text-red-600 mt-2">
                  このエラーはリトライ可能です
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* メタデータ */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="font-medium">作成日時:</span><br />
            {new Date(task.timestamps.createdAt).toLocaleString('ja-JP')}
          </div>
          {task.timestamps.completedAt && (
            <div>
              <span className="font-medium">完了日時:</span><br />
              {new Date(task.timestamps.completedAt).toLocaleString('ja-JP')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};