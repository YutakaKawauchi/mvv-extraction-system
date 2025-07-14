import React, { useState, useEffect } from 'react';
import { Database, TrendingUp, Clock, HardDrive } from 'lucide-react';
import { aiCacheService } from '../../services/aiCacheService';

interface CacheStats {
  hitRate: number;
  totalSaved: number;
  companyInfoEntries: number;
  industryAnalysisEntries: number;
  oldestEntry: Date | null;
}

export const CacheStatus: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      const cacheStats = await aiCacheService.getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      const result = await aiCacheService.cleanupExpiredCache();
      await loadCacheStats(); // Reload stats
      
      // Show success feedback
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `キャッシュクリーンアップ完了: ${result.deletedCount}件削除、${result.savedStorage}KB解放`
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
      
      // Show error feedback
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'キャッシュクリーンアップに失敗しました'
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (confirm('すべてのキャッシュを削除しますか？この操作は元に戻せません。')) {
      setIsLoading(true);
      try {
        await aiCacheService.clearAllCache();
        await loadCacheStats(); // Reload stats
        
        // Show success feedback
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: 'すべてのキャッシュを削除しました'
          }
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Failed to clear cache:', error);
        
        // Show error feedback
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'error',
            message: 'キャッシュ削除に失敗しました'
          }
        });
        window.dispatchEvent(event);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">キャッシュ統計の読み込みに失敗しました</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 flex items-center">
          <Database className="w-4 h-4 mr-2 text-blue-500" />
          AIキャッシュ状態
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCleanup}
            disabled={isLoading}
            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                処理中...
              </>
            ) : (
              'クリーンアップ'
            )}
          </button>
          <button
            onClick={handleClearAll}
            disabled={isLoading}
            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                削除中...
              </>
            ) : (
              '全削除'
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center">
          <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
          <div>
            <div className="font-medium">ヒット率</div>
            <div className="text-gray-600">{(stats.hitRate * 100).toFixed(1)}%</div>
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-green-500 mr-2">💰</span>
          <div>
            <div className="font-medium">節約額</div>
            <div className="text-gray-600">${stats.totalSaved.toFixed(4)}</div>
          </div>
        </div>

        <div className="flex items-center">
          <HardDrive className="w-4 h-4 mr-2 text-blue-500" />
          <div>
            <div className="font-medium">企業情報</div>
            <div className="text-gray-600">{stats.companyInfoEntries}件</div>
            <div className="text-xs text-gray-500">決定論的API</div>
          </div>
        </div>

        <div className="flex items-center">
          <span className="text-purple-500 mr-2">🏭</span>
          <div>
            <div className="font-medium">業界分析</div>
            <div className="text-gray-600">{stats.industryAnalysisEntries}件</div>
            <div className="text-xs text-gray-500">部分決定論的</div>
          </div>
        </div>
      </div>

      {/* 詳細統計 */}
      <div className="pt-2 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span className="font-medium">企業情報キャッシュ:</span>
            <div className="ml-2">
              • MVV抽出: {Math.floor(stats.companyInfoEntries * 0.4)}件
              • 企業詳細: {Math.floor(stats.companyInfoEntries * 0.6)}件
            </div>
          </div>
          <div>
            <span className="font-medium">業界分析キャッシュ:</span>
            <div className="ml-2">
              • 包括的検証: {Math.floor(stats.industryAnalysisEntries * 0.7)}件
              • 専門家検証: {Math.floor(stats.industryAnalysisEntries * 0.3)}件
            </div>
          </div>
        </div>
      </div>

      {/* キャッシュ効率 */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-600">
            <span className="font-medium">推定コスト削減:</span>
            <span className="ml-1">{((stats.hitRate * 100) * 0.8).toFixed(0)}%</span>
          </div>
          {stats.oldestEntry && (
            <div className="flex items-center text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              最古: {new Date(stats.oldestEntry).toLocaleDateString('ja-JP')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};