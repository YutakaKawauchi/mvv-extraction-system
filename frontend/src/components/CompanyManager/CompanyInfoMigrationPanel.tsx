import React, { useState, useEffect } from 'react';
import { Button, LoadingSpinner, StatusBadge } from '../common';
import { companyInfoMigrationService } from '../../services/dataMigration';
import type { Company } from '../../types';
import type { CompanyInfoMigrationResult } from '../../services/dataMigration';
import { Database, Download, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface MigrationStats {
  totalCompanies: number;
  companiesWithInfo: number;
  companiesWithoutInfo: number;
  completionRate: number;
}

interface MigrationProgress {
  current: number;
  total: number;
  company: Company;
}

export const CompanyInfoMigrationPanel: React.FC = () => {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [companiesNeedingInfo, setCompaniesNeedingInfo] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<CompanyInfoMigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [statsData, companiesData] = await Promise.all([
        companyInfoMigrationService.getCompanyInfoStats(),
        companyInfoMigrationService.getCompaniesNeedingInfo()
      ]);
      
      setStats(statsData);
      setCompaniesNeedingInfo(companiesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load migration stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMigration = async () => {
    if (companiesNeedingInfo.length === 0) return;
    
    setIsMigrating(true);
    setMigrationProgress(null);
    setMigrationResult(null);
    setError(null);

    try {
      const result = await companyInfoMigrationService.batchExtractCompanyInfo(
        companiesNeedingInfo,
        (progress) => {
          setMigrationProgress(progress);
        }
      );
      
      setMigrationResult(result);
      
      // 統計を更新
      await loadStats();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  };

  const handleResetCompanyInfo = async () => {
    if (!confirm('全ての企業情報を削除しますか？この操作は取り消せません。')) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await companyInfoMigrationService.resetCompanyInfo();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset company info');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (isLoading && !stats) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
          <span className="ml-2 text-gray-600">統計を読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">企業情報移行パネル</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStats}
          disabled={isLoading}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          更新
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* 統計情報 */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCompanies}</div>
            <div className="text-sm text-blue-700">総企業数</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.companiesWithInfo}</div>
            <div className="text-sm text-green-700">情報取得済み</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.companiesWithoutInfo}</div>
            <div className="text-sm text-yellow-700">情報未取得</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.completionRate.toFixed(1)}%</div>
            <div className="text-sm text-purple-700">完了率</div>
          </div>
        </div>
      )}

      {/* 進行状況 */}
      {isMigrating && migrationProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">移行進行状況</span>
            <span className="text-sm text-blue-600">
              {migrationProgress.current} / {migrationProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-sm text-blue-700">
            処理中: {migrationProgress.company.name}
          </div>
        </div>
      )}

      {/* 移行結果 */}
      {migrationResult && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">移行完了</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{migrationResult.totalCompanies}</div>
              <div className="text-sm text-gray-600">総数</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{migrationResult.succeeded}</div>
              <div className="text-sm text-gray-600">成功</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{migrationResult.failed}</div>
              <div className="text-sm text-gray-600">失敗</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {migrationResult.totalCompanies > 0 
                  ? ((migrationResult.succeeded / migrationResult.totalCompanies) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-sm text-gray-600">成功率</div>
            </div>
          </div>
          
          {migrationResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-700 mb-2">エラー詳細:</h4>
              <div className="max-h-32 overflow-y-auto">
                {migrationResult.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 mb-1">
                    • {error.companyName}: {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 企業情報が不足している企業一覧 */}
      {companiesNeedingInfo.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            企業情報が不足している企業 ({companiesNeedingInfo.length}社)
          </h3>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            {companiesNeedingInfo.map((company) => (
              <div key={company.id} className="p-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{company.name}</div>
                    <div className="text-sm text-gray-600">{company.website}</div>
                  </div>
                  <StatusBadge status={company.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-3">
          <Button
            variant="primary"
            onClick={handleStartMigration}
            disabled={isMigrating || companiesNeedingInfo.length === 0}
          >
            {isMigrating ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">移行中...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                企業情報を一括取得 ({companiesNeedingInfo.length}社)
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={loadStats}
            disabled={isLoading || isMigrating}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            統計更新
          </Button>
        </div>

        {/* 開発用リセットボタン */}
        <Button
          variant="danger"
          size="sm"
          onClick={handleResetCompanyInfo}
          disabled={isLoading || isMigrating}
        >
          <AlertCircle className="w-4 h-4 mr-1" />
          全削除
        </Button>
      </div>

      {/* 注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <strong>注意:</strong> 企業情報の一括取得には時間がかかります。
            各企業につき約2秒の間隔でAPIを呼び出し、産業分類と詳細情報を自動取得します。
          </div>
        </div>
      </div>
    </div>
  );
};