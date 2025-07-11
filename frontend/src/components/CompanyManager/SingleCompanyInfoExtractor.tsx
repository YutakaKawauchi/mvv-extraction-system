/**
 * 個別企業情報抽出コンポーネント（1件テスト用）
 * 料金を抑えて1社ずつテストできる機能
 */

import React, { useState } from 'react';
import { Button, LoadingSpinner } from '../common';
import { Play, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { bulkCompanyInfoExtractor, type BulkExtractionProgress, type BulkExtractionResult } from '../../services/bulkCompanyInfoExtractor';
import { companyInfoAnalyzer } from '../../services/companyInfoAnalyzer';
import { useNotification } from '../../hooks/useNotification';
import type { Company } from '../../types';

interface SingleCompanyInfoExtractorProps {
  company?: Company;
  onComplete?: (success: boolean) => void;
}

export const SingleCompanyInfoExtractor: React.FC<SingleCompanyInfoExtractorProps> = ({
  company: initialCompany,
  onComplete
}) => {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(initialCompany || null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<BulkExtractionProgress | null>(null);
  const [result, setResult] = useState<BulkExtractionResult | null>(null);
  const [readyCompanies, setReadyCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  const { success, error, info } = useNotification();

  // 企業情報抽出可能な企業を取得
  const loadReadyCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const readyList = await companyInfoAnalyzer.getCompaniesNeedingCompanyInfo();
      setReadyCompanies(readyList);
      
      if (readyList.length === 0) {
        info('企業情報抽出が必要な企業がありません');
      }
    } catch (err) {
      console.error('企業リスト取得エラー:', err);
      error('企業リストの取得に失敗しました');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  // 初期化時に企業リストを取得
  React.useEffect(() => {
    if (!initialCompany) {
      loadReadyCompanies();
    }
  }, [initialCompany]);

  const startSingleExtraction = async () => {
    if (!selectedCompany) {
      error('企業が選択されていません');
      return;
    }

    setIsExtracting(true);
    setResult(null);
    setProgress(null);

    try {
      const extractionResult = await bulkCompanyInfoExtractor.extractForCompanies(
        [selectedCompany],
        (progressData) => {
          setProgress(progressData);
        }
      );

      setResult(extractionResult);
      
      if (extractionResult.success && extractionResult.errorCount === 0) {
        success(`✅ ${selectedCompany.name}の企業情報抽出が完了しました！`);
        onComplete?.(true);
      } else {
        error(`❌ ${selectedCompany.name}の企業情報抽出に失敗しました`);
        onComplete?.(false);
      }

    } catch (err) {
      console.error('個別抽出エラー:', err);
      error('企業情報抽出を開始できませんでした');
      onComplete?.(false);
    } finally {
      setIsExtracting(false);
    }
  };

  const stopExtraction = () => {
    bulkCompanyInfoExtractor.stop();
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

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <DollarSign className="mr-3 h-6 w-6 text-green-500" />
              1件テスト実行（料金節約モード）
            </h3>
            <p className="text-gray-600 mt-1">
              選択した1社のみで企業情報抽出をテスト実行します
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-green-600 font-medium">
              💰 約1.5円/企業
            </div>
            <div className="text-xs text-gray-500">
              Perplexity API料金
            </div>
          </div>
        </div>
      </div>

      {/* 企業選択 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">企業選択</h4>
        
        {initialCompany ? (
          // 初期企業が指定されている場合
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-blue-900">{initialCompany.name}</h5>
                <p className="text-sm text-blue-700 mt-1">
                  URL: {initialCompany.website || '未設定'}
                </p>
              </div>
              <div className="text-sm text-blue-600">
                事前選択済み
              </div>
            </div>
          </div>
        ) : (
          // 企業選択UI
          <div>
            {isLoadingCompanies ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" className="mb-4" />
                <p className="text-gray-600">企業リストを読み込み中...</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <Button
                    onClick={loadReadyCompanies}
                    variant="outline"
                    size="sm"
                    disabled={isLoadingCompanies || isExtracting}
                  >
                    企業リスト更新
                  </Button>
                  <span className="ml-2 text-sm text-gray-600">
                    対象: {readyCompanies.length}社
                  </span>
                </div>

                {readyCompanies.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {readyCompanies.map((company) => (
                      <div
                        key={company.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedCompany?.id === company.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedCompany(company)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h6 className="font-medium text-gray-900">{company.name}</h6>
                            <p className="text-sm text-gray-600">
                              {company.website || '未設定'} • {company.category || '未分類'}
                            </p>
                          </div>
                          {selectedCompany?.id === company.id && (
                            <div className="text-blue-500">
                              <CheckCircle className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    企業情報抽出が必要な企業がありません
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 実行ボタン */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">テスト実行</h4>
            <p className="text-sm text-gray-600 mt-1">
              選択した企業で 3段階処理（MVV → 企業情報 → カテゴリ分類）をテスト
            </p>
          </div>
          
          <div className="flex space-x-2">
            {selectedCompany && !isExtracting && (
              <Button
                onClick={startSingleExtraction}
                disabled={!selectedCompany}
              >
                <Play className="h-4 w-4 mr-2" />
                テスト実行
              </Button>
            )}
            
            {isExtracting && (
              <Button
                onClick={stopExtraction}
                variant="danger"
              >
                停止
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 進捗表示 */}
      {isExtracting && progress && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">実行進捗</h4>
          
          <div className={`flex items-center mb-4 ${getStatusColor(progress.status)}`}>
            {getStatusIcon(progress.status)}
            <span className="ml-2">{progress.message}</span>
          </div>

          {progress.currentCompany.name && (
            <div className="bg-gray-50 rounded-lg p-3">
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
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">テスト結果</h4>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
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
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              💰 約{Math.round(result.totalProcessed * 1.5)}円
            </div>
            <div className="text-sm text-gray-600">実際の料金（重複修正済み）</div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <h5 className="font-medium text-red-800 mb-2">エラー詳細:</h5>
              {result.errors.map((error, index) => (
                <div key={index} className="text-sm text-red-700">
                  <strong>{error.companyName}:</strong> {error.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};