/**
 * 一括企業情報抽出コンポーネント
 * MVV抽出済みだが企業情報未抽出の企業を一括で処理するリカバリ機能
 */

import React, { useState, useEffect } from 'react';
import { Button, ProgressBar, LoadingSpinner } from '../common';
import { Database, Download, AlertCircle, CheckCircle, Play, Square, RefreshCw } from 'lucide-react';
import { bulkCompanyInfoExtractor, type BulkExtractionProgress, type BulkExtractionResult } from '../../services/bulkCompanyInfoExtractor';
import { companyInfoAnalyzer, type CompanyInfoAnalytics } from '../../services/companyInfoAnalyzer';
import { useNotification } from '../../hooks/useNotification';

export const BulkCompanyInfoExtractor: React.FC = () => {
  const [analytics, setAnalytics] = useState<CompanyInfoAnalytics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<BulkExtractionProgress | null>(null);
  const [result, setResult] = useState<BulkExtractionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const { success, error, info } = useNotification();

  // 初期分析の実行
  useEffect(() => {
    analyzeData();
  }, []);

  const analyzeData = async () => {
    setIsAnalyzing(true);
    try {
      const data = await companyInfoAnalyzer.analyzeCompanyInfoStatus();
      setAnalytics(data);
      
      if (data.missingCompanyInfo > 0) {
        info(`${data.missingCompanyInfo}社で企業情報抽出が必要です`, 'info');
      } else {
        success('すべての企業で企業情報が抽出済みです');
      }
    } catch (err) {
      console.error('分析エラー:', err);
      error('データ分析中にエラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startBulkExtraction = async () => {
    if (!analytics || analytics.missingCompanyInfo === 0) {
      info('抽出が必要な企業がありません');
      return;
    }

    setIsExtracting(true);
    setResult(null);
    setProgress(null);

    try {
      const extractionResult = await bulkCompanyInfoExtractor.extractMissingCompanyInfo(
        (progressData) => {
          setProgress(progressData);
        }
      );

      setResult(extractionResult);
      
      if (extractionResult.success) {
        if (extractionResult.errorCount === 0) {
          success(`✅ 全${extractionResult.successCount}社の企業情報抽出が完了しました！`);
        } else {
          info(`部分完了: ${extractionResult.successCount}社成功、${extractionResult.errorCount}社エラー`);
        }
      } else {
        error('一括抽出中にエラーが発生しました');
      }

      // 分析データを更新
      await analyzeData();

    } catch (err) {
      console.error('一括抽出エラー:', err);
      error('一括抽出を開始できませんでした');
    } finally {
      setIsExtracting(false);
    }
  };

  const stopExtraction = () => {
    bulkCompanyInfoExtractor.stop();
  };

  const downloadReport = async () => {
    try {
      const report = await companyInfoAnalyzer.generateStatusReport();
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `企業情報抽出状況レポート_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      success('レポートをダウンロードしました');
    } catch (err) {
      console.error('レポート生成エラー:', err);
      error('レポートの生成に失敗しました');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <LoadingSpinner size="sm" className="text-blue-500" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return null;
    }
  };

  if (isAnalyzing) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mb-4" />
            <p className="text-gray-600">企業情報抽出状況を分析中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Database className="mr-3 h-8 w-8 text-blue-500" />
              一括企業情報抽出 (リカバリ機能)
            </h2>
            <p className="text-gray-600 mt-1">
              MVV抽出済みだが企業情報未抽出の企業を一括で処理します
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={analyzeData}
              variant="outline"
              size="sm"
              disabled={isAnalyzing || isExtracting}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              再分析
            </Button>
            <Button
              onClick={downloadReport}
              variant="outline"
              size="sm"
              disabled={!analytics}
            >
              <Download className="h-4 w-4 mr-2" />
              レポート
            </Button>
          </div>
        </div>
      </div>

      {/* 分析結果 */}
      {analytics && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">抽出状況サマリー</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{analytics.total}</div>
              <div className="text-sm text-gray-600">全企業数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analytics.complete}</div>
              <div className="text-sm text-gray-600">完了</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{analytics.missingCompanyInfo}</div>
              <div className="text-sm text-gray-600">企業情報未抽出</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analytics.missingMVV}</div>
              <div className="text-sm text-gray-600">MVV未抽出</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{analytics.missingAll}</div>
              <div className="text-sm text-gray-600">すべて未抽出</div>
            </div>
          </div>

          {analytics.missingCompanyInfo > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <div>
                  <h4 className="font-medium text-yellow-800">リカバリが必要です</h4>
                  <p className="text-yellow-700 text-sm mt-1">
                    {analytics.missingCompanyInfo}社でMVV抽出は完了していますが、企業情報が未抽出です。
                    一括抽出を実行してデータを完成させることができます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.readyForCompanyInfoExtraction.length > 0 && (
            <div className="mb-6">
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="outline"
                size="sm"
                className="mb-3"
              >
                対象企業一覧を{showDetails ? '隠す' : '表示'}
              </Button>
              
              {showDetails && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="text-sm text-gray-600 mb-2">
                    企業情報抽出対象 ({analytics.readyForCompanyInfoExtraction.length}社):
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {analytics.readyForCompanyInfoExtraction.map((company, index) => (
                      <div key={company.id} className="text-sm bg-white p-2 rounded border">
                        {index + 1}. {company.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center">
            {analytics.missingCompanyInfo > 0 ? (
              <Button
                onClick={isExtracting ? stopExtraction : startBulkExtraction}
                disabled={isAnalyzing}
                className={isExtracting ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
              >
                {isExtracting ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    停止
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    一括抽出開始 ({analytics.missingCompanyInfo}社)
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center text-green-600 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                すべての企業で企業情報抽出が完了しています
              </div>
            )}
          </div>
        </div>
      )}

      {/* 進捗表示 */}
      {isExtracting && progress && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">抽出進捗</h3>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>進捗: {progress.currentIndex} / {progress.total}</span>
              <span>{Math.round((progress.currentIndex / progress.total) * 100)}%</span>
            </div>
            <ProgressBar 
              value={(progress.currentIndex / progress.total) * 100} 
              className="mb-2"
            />
          </div>

          <div className={`flex items-center mb-4 ${getStatusColor(progress.status)}`}>
            {getStatusIcon(progress.status)}
            <span className="ml-2">{progress.message}</span>
          </div>

          {progress.currentCompany.name && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm">
                <strong>処理中:</strong> {progress.currentCompany.name}
              </div>
              {progress.currentCompany.website && (
                <div className="text-xs text-gray-600 mt-1">
                  URL: {progress.currentCompany.website}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 p-3 rounded">
              <div className="text-lg font-bold text-green-600">{progress.successCount}</div>
              <div className="text-sm text-gray-600">成功</div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="text-lg font-bold text-red-600">{progress.errorCount}</div>
              <div className="text-sm text-gray-600">エラー</div>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-lg font-bold text-blue-600">
                {progress.total - progress.currentIndex}
              </div>
              <div className="text-sm text-gray-600">残り</div>
            </div>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">抽出結果</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.totalProcessed}</div>
              <div className="text-sm text-gray-600">処理数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
              <div className="text-sm text-gray-600">成功</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.errorCount}</div>
              <div className="text-sm text-gray-600">エラー</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {Math.round(result.processingTime / 1000)}s
              </div>
              <div className="text-sm text-gray-600">処理時間</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">エラー詳細:</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-700">
                    <strong>{error.companyName}:</strong> {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};