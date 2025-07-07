import React from 'react';
import { ProgressBar } from '../common';
import { useProcessingStore } from '../../stores/processingStore';
import { formatDuration, formatDate } from '../../utils/formatters';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  Zap
} from 'lucide-react';

export const ProcessingStatus: React.FC = () => {
  const { batchStatus } = useProcessingStore();

  if (batchStatus.total === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">処理ステータス</h3>
        <p className="text-gray-600">
          バッチ処理が開始されると、ここに詳細な進捗情報が表示されます。
        </p>
      </div>
    );
  }

  const progressPercentage = batchStatus.total > 0 ? 
    (batchStatus.processed / batchStatus.total) * 100 : 0;

  const successRate = batchStatus.processed > 0 ? 
    (batchStatus.succeeded / batchStatus.processed) * 100 : 0;

  const estimatedTimeRemaining = (() => {
    if (!batchStatus.startTime || !batchStatus.inProgress || batchStatus.processed === 0) {
      return null;
    }

    const elapsedTime = Date.now() - batchStatus.startTime.getTime();
    const averageTimePerItem = elapsedTime / batchStatus.processed;
    const remainingItems = batchStatus.total - batchStatus.processed;
    
    return remainingItems * averageTimePerItem;
  })();

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">処理ステータス</h3>
          <div className="flex items-center text-sm text-gray-600">
            {batchStatus.inProgress ? (
              <>
                <Zap className="w-4 h-4 mr-1 text-blue-600" />
                処理中
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                完了
              </>
            )}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">全体進捗</span>
            <span className="text-sm text-gray-600">
              {batchStatus.processed} / {batchStatus.total}
            </span>
          </div>
          <ProgressBar
            value={progressPercentage}
            max={100}
            size="lg"
            color={batchStatus.inProgress ? 'blue' : 'green'}
            showPercentage
          />
        </div>

        {/* Success Rate */}
        {batchStatus.processed > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">成功率</span>
              <span className="text-sm text-gray-600">
                {batchStatus.succeeded} / {batchStatus.processed}
              </span>
            </div>
            <ProgressBar
              value={successRate}
              max={100}
              size="md"
              color={successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red'}
              showPercentage
            />
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {batchStatus.total}
            </div>
            <div className="text-sm text-gray-600">総数</div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {batchStatus.processed}
            </div>
            <div className="text-sm text-gray-600">処理済み</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {batchStatus.succeeded}
            </div>
            <div className="text-sm text-gray-600">成功</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {batchStatus.failed}
            </div>
            <div className="text-sm text-gray-600">失敗</div>
          </div>
        </div>
      </div>

      {/* Time Information */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          時間情報
        </h4>
        
        <div className="space-y-2 text-sm">
          {batchStatus.startTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">開始時刻:</span>
              <span className="text-gray-900 font-medium">
                {formatDate(batchStatus.startTime)}
              </span>
            </div>
          )}
          
          {batchStatus.endTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">終了時刻:</span>
              <span className="text-gray-900 font-medium">
                {formatDate(batchStatus.endTime)}
              </span>
            </div>
          )}
          
          {batchStatus.startTime && (
            <div className="flex justify-between">
              <span className="text-gray-600">経過時間:</span>
              <span className="text-gray-900 font-medium">
                {formatDuration(
                  (batchStatus.endTime || new Date()).getTime() - 
                  batchStatus.startTime.getTime()
                )}
              </span>
            </div>
          )}
          
          {estimatedTimeRemaining && batchStatus.inProgress && (
            <div className="flex justify-between">
              <span className="text-gray-600">予想残り時間:</span>
              <span className="text-blue-600 font-medium">
                {formatDuration(estimatedTimeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      {batchStatus.processed > 0 && batchStatus.startTime && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            パフォーマンス
          </h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">平均処理時間:</span>
              <span className="text-gray-900 font-medium">
                {(() => {
                  const elapsedTime = (batchStatus.endTime || new Date()).getTime() - 
                    batchStatus.startTime.getTime();
                  const averageTime = elapsedTime / batchStatus.processed;
                  return formatDuration(averageTime);
                })()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">処理速度:</span>
              <span className="text-gray-900 font-medium">
                {(() => {
                  const elapsedTime = (batchStatus.endTime || new Date()).getTime() - 
                    batchStatus.startTime.getTime();
                  const rate = (batchStatus.processed / (elapsedTime / 1000 / 60)).toFixed(1);
                  return `${rate} 件/分`;
                })()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">成功率:</span>
              <span className={`font-medium ${
                successRate >= 80 ? 'text-green-600' : 
                successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {successRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};