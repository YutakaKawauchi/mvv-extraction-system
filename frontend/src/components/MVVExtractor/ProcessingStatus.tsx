import React, { useState, useEffect } from 'react';
import { ProgressBar } from '../common';
import { useProcessingStore } from '../../stores/processingStore';
import { useCompanyStore } from '../../stores/companyStore';
import { formatDuration, formatDate } from '../../utils/formatters';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  Zap,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

export const ProcessingStatus: React.FC = () => {
  const { batchStatus, currentlyProcessing } = useProcessingStore();
  const { companies } = useCompanyStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for real-time calculations
  useEffect(() => {
    if (batchStatus.inProgress) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [batchStatus.inProgress]);

  // Get currently processing companies
  const processingCompanies = currentlyProcessing
    .map(id => companies.find(c => c.id === id))
    .filter((company): company is NonNullable<typeof company> => company !== undefined);

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

    const elapsedTime = currentTime.getTime() - batchStatus.startTime.getTime();
    const averageTimePerItem = elapsedTime / batchStatus.processed;
    const remainingItems = batchStatus.total - batchStatus.processed;
    
    return remainingItems * averageTimePerItem;
  })();

  // Calculate processing efficiency
  const efficiency = (() => {
    if (!batchStatus.startTime || batchStatus.processed === 0) return null;
    
    const elapsedTime = currentTime.getTime() - batchStatus.startTime.getTime();
    const elapsedMinutes = elapsedTime / (1000 * 60);
    return {
      itemsPerMinute: (batchStatus.processed / elapsedMinutes).toFixed(1),
      averageTimePerItem: elapsedTime / batchStatus.processed
    };
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

      {/* Currently Processing */}
      {processingCompanies.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
            <Zap className="w-4 h-4 mr-2 text-blue-600" />
            現在処理中 ({processingCompanies.length}件)
          </h4>
          <div className="space-y-2">
            {processingCompanies.slice(0, 3).map(company => (
              <div 
                key={company.id} 
                className="flex items-center justify-between bg-blue-50 p-2 rounded text-sm"
              >
                <span className="font-medium text-blue-900">{company.name}</span>
                <div className="flex items-center text-blue-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></div>
                  処理中...
                </div>
              </div>
            ))}
            {processingCompanies.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                他 {processingCompanies.length - 3} 件...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Efficiency & Performance Insights */}
      {efficiency && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
            効率性指標
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-green-700">
                {efficiency.itemsPerMinute}
              </div>
              <div className="text-green-600">件/分</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-700">
                {formatDuration(efficiency.averageTimePerItem)}
              </div>
              <div className="text-blue-600">平均処理時間</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <div className={`text-lg font-bold ${
                successRate >= 90 ? 'text-green-700' : 
                successRate >= 80 ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {successRate.toFixed(1)}%
              </div>
              <div className="text-purple-600">成功率</div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {batchStatus.failed > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">
                パフォーマンス推奨事項
              </h4>
              <div className="text-sm text-yellow-700 space-y-1">
                {successRate < 80 && (
                  <div>• エラー率が高いです。ネットワーク接続を確認してください</div>
                )}
                {batchStatus.failed >= 3 && (
                  <div>• 複数のエラーが発生しています。バッチサイズを小さくすることをお勧めします</div>
                )}
                {efficiency && efficiency.averageTimePerItem > 30000 && (
                  <div>• 処理時間が長めです。同時実行数を調整することをお勧めします</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  (batchStatus.endTime || currentTime).getTime() - 
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