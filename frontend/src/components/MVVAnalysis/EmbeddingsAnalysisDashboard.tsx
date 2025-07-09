/**
 * Embeddings-based Analysis Dashboard
 * Real-time analysis using embeddings data from IndexedDB
 */

import React, { useEffect, useState } from 'react';
import { useEmbeddingsAnalysisStore } from '../../stores/embeddingsAnalysisStore';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner, ErrorBoundary } from '../common';
import { Search, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import EmbeddingsSimilarCompanyFinder from './EmbeddingsSimilarCompanyFinder';
import SimilarityOverview from './SimilarityOverview';
import IndustryAnalysis from './IndustryAnalysis';

type TabType = 'overview' | 'finder' | 'industry' | 'insights';

export const EmbeddingsAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('finder');
  
  const { 
    data, 
    isLoading, 
    error, 
    loadAnalysisData, 
    clearError 
  } = useEmbeddingsAnalysisStore();
  
  const { loadCompanies } = useCompanyStore();

  useEffect(() => {
    loadAnalysisData();
    loadCompanies(); // Load company management data as well
  }, [loadAnalysisData, loadCompanies]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Embeddings分析データを読み込み中...
          </h2>
          <p className="text-gray-600">
            リアルタイムでMVV類似性データを処理しています
          </p>
          <div className="mt-4 text-sm text-blue-600 flex items-center justify-center">
            <Sparkles className="mr-2 h-4 w-4" />
            OpenAI Embeddings による高精度分析
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <AlertCircle className="mx-auto w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              データ読み込みエラー
            </h2>
            <p className="text-gray-600 mb-4">
              {error}
            </p>
            <button
              onClick={() => {
                clearError();
                loadAnalysisData();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const tabs = [
    { id: 'finder', name: '類似企業検索', icon: Search, description: 'リアルタイム類似企業検索' },
    // 概要・業界分析は静的データ用コンポーネントのため一時的に無効化
    // TODO: リアルタイム版の実装後に有効化予定
    // { id: 'overview', name: '概要', icon: BarChart3, description: '類似度の全体概要' },
    // { id: 'industry', name: '業界分析', icon: Network, description: '業界別の類似度分析' },
    { id: 'insights', name: 'インサイト', icon: TrendingUp, description: 'AI生成の分析洞察' }
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'finder':
        return <EmbeddingsSimilarCompanyFinder />;
      case 'overview':
        return <SimilarityOverview />;
      case 'industry':
        return <IndustryAnalysis />;
      case 'insights':
        return (
          <div className="text-center py-12">
            <TrendingUp className="mx-auto w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              AI インサイト機能
            </h3>
            <p className="text-gray-600">
              この機能はPhase 2で実装予定です。<br />
              GPT-4o-miniによる分析洞察を提供します。
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const hasValidEmbeddings = data.summary.companiesWithEmbeddings > 0;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Sparkles className="mr-2 h-6 w-6 text-blue-500" />
                  MVV類似性分析 (Embeddings版)
                </h1>
              </div>
              
            </div>
          </div>
        </div>

        {/* Embeddings Status Warning */}
        {!hasValidEmbeddings && (
          <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Embeddingsデータが不足しています
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    類似度分析を行うには、企業のMVV抽出とEmbeddings生成を完了してください。
                    現在 {data.summary.totalCompanies} 社中 {data.summary.companiesWithEmbeddings} 社でEmbeddingsが生成済みです。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDisabled = !hasValidEmbeddings && tab.id === 'finder';
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id as TabType)}
                    disabled={isDisabled}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : isDisabled
                        ? 'border-transparent text-gray-400 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${
                      isActive 
                        ? 'text-blue-500' 
                        : isDisabled
                        ? 'text-gray-400'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {tab.name}
                    {tab.id === 'finder' && (
                      <span title="リアルタイム計算">
                        <Sparkles className="ml-1 h-4 w-4 text-green-500" />
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            
            {/* 一時的な注意書き */}
            <div className="py-2 px-4 bg-blue-50 border-b border-blue-200">
              <p className="text-sm text-blue-700">
                <span className="font-medium">注意:</span> 現在は「類似企業検索」のみ利用可能です。概要・業界分析機能はリアルタイム版実装中のため一時的に無効化されています。
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {hasValidEmbeddings ? (
            renderTabContent()
          ) : (
            <div className="text-center py-12">
              <Sparkles className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Embeddings分析の準備
              </h3>
              <p className="text-gray-600 mb-4">
                AI分析を開始するには、まず企業のMVV抽出とEmbeddings生成を完了してください。
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <div>✅ 総企業数: {data.summary.totalCompanies}社</div>
                <div>🔄 Embeddings生成済み: {data.summary.companiesWithEmbeddings}社</div>
                <div>📊 分析に必要な最小企業数: 2社</div>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => window.location.hash = '#/extraction'}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  MVV抽出とEmbeddings生成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};