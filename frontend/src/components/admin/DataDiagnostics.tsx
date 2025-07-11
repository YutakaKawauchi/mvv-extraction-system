/**
 * データ診断コンポーネント
 * 企業情報・MVVデータの整合性チェック
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, XCircle, Database, Users } from 'lucide-react';
import { Button, LoadingSpinner } from '../common';
import { companyInfoAnalyzer, type CompanyInfoAnalytics } from '../../services/companyInfoAnalyzer';
import { useNotification } from '../../hooks/useNotification';

export const DataDiagnostics: React.FC = () => {
  const [analytics, setAnalytics] = useState<CompanyInfoAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { success, error } = useNotification();

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const result = await companyInfoAnalyzer.analyzeCompanyInfoStatus();
      setAnalytics(result);
      setLastUpdated(new Date());
      success('データ診断が完了しました');
    } catch (err) {
      console.error('診断エラー:', err);
      error('データ診断に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初期化時に診断実行
  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusColor = (count: number, total: number) => {
    if (count === 0) return 'text-green-600 bg-green-50 border-green-200';
    if (count < total * 0.1) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusIcon = (count: number) => {
    if (count === 0) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (count > 0) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Database className="mr-3 h-6 w-6 text-blue-500" />
            データ整合性診断
          </h3>
          <p className="text-gray-600 mt-1">
            企業データの完全性とMVV情報の整合性をチェックします
          </p>
        </div>
        <Button
          onClick={runDiagnostics}
          disabled={isLoading}
          className="flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          診断実行
        </Button>
      </div>

      {/* 診断中表示 */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="flex flex-col items-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">データ診断中...</h4>
            <p className="text-gray-600 text-center">
              企業データとMVV情報の整合性をチェックしています
            </p>
          </div>
        </div>
      )}

      {/* 診断結果 */}
      {analytics && !isLoading && (
        <div className="space-y-6">
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">総企業数</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className={`rounded-lg shadow-sm border p-6 ${getStatusColor(analytics.complete, analytics.total)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">完全データ</p>
                  <p className="text-2xl font-bold">{analytics.complete}</p>
                  <p className="text-xs">({Math.round((analytics.complete / analytics.total) * 100)}%)</p>
                </div>
                {getStatusIcon(analytics.total - analytics.complete)}
              </div>
            </div>

            <div className={`rounded-lg shadow-sm border p-6 ${getStatusColor(analytics.missingCompanyInfo, analytics.total)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">企業情報欠損</p>
                  <p className="text-2xl font-bold">{analytics.missingCompanyInfo}</p>
                  <p className="text-xs">リカバリ対象</p>
                </div>
                {getStatusIcon(analytics.missingCompanyInfo)}
              </div>
            </div>

            <div className={`rounded-lg shadow-sm border p-6 ${getStatusColor(analytics.missingMVV, analytics.total)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">MVV欠損</p>
                  <p className="text-2xl font-bold">{analytics.missingMVV}</p>
                  <p className="text-xs">要MVV抽出</p>
                </div>
                {getStatusIcon(analytics.missingMVV)}
              </div>
            </div>
          </div>

          {/* 詳細分析 */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">詳細分析結果</h4>
            </div>
            <div className="p-6 space-y-4">
              {/* リカバリ対象 */}
              {analytics.readyForCompanyInfoExtraction.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                    <h5 className="font-medium text-yellow-800">企業情報抽出が必要</h5>
                  </div>
                  <p className="text-sm text-yellow-700 mb-3">
                    以下の{analytics.readyForCompanyInfoExtraction.length}社はMVVデータは完了していますが、企業情報が不足しています
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {analytics.readyForCompanyInfoExtraction.slice(0, 10).map((company, index) => (
                      <div key={company.id} className="text-sm text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
                        {index + 1}. {company.name} ({company.category || '未分類'})
                      </div>
                    ))}
                    {analytics.readyForCompanyInfoExtraction.length > 10 && (
                      <div className="text-sm text-yellow-700 italic">
                        ...他{analytics.readyForCompanyInfoExtraction.length - 10}社
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 全データ完了 */}
              {analytics.readyForCompanyInfoExtraction.length === 0 && analytics.missingMVV === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <h5 className="font-medium text-green-800">全データ完了</h5>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    すべての企業データが完全です。リカバリの必要はありません。
                  </p>
                </div>
              )}

              {/* データ品質指標 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((analytics.complete / analytics.total) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">データ完全性</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.complete + analytics.missingCompanyInfo}
                  </div>
                  <div className="text-sm text-gray-600">MVV取得済み</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.complete + analytics.missingMVV}
                  </div>
                  <div className="text-sm text-gray-600">企業情報取得済み</div>
                </div>
              </div>
            </div>
          </div>

          {/* 最終更新時刻 */}
          {lastUpdated && (
            <div className="text-center text-sm text-gray-500">
              最終診断: {lastUpdated.toLocaleString('ja-JP')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};