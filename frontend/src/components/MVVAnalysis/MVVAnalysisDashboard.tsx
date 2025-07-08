import React, { useEffect, useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { LoadingSpinner, ErrorBoundary } from '../common';
import { BarChart3, Network, Search, TrendingUp, AlertCircle } from 'lucide-react';
import SimilarityOverview from './SimilarityOverview';
import SimilarCompanyFinder from './SimilarCompanyFinder';
import IndustryAnalysis from './IndustryAnalysis';

type TabType = 'overview' | 'finder' | 'industry' | 'insights';

export const MVVAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  const { 
    data, 
    isLoading, 
    error, 
    loadAnalysisData, 
    clearError 
  } = useAnalysisStore();

  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            MVV分析データを読み込み中...
          </h2>
          <p className="text-gray-600">
            62社のMVV類似性データを処理しています
          </p>
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
    { id: 'overview', name: '概要', icon: BarChart3, description: '類似度の全体概要' },
    { id: 'finder', name: '類似企業検索', icon: Search, description: '特定企業の類似企業を検索' },
    { id: 'industry', name: '業界分析', icon: Network, description: '業界別の類似度分析' },
    { id: 'insights', name: 'インサイト', icon: TrendingUp, description: 'AI生成の分析洞察' }
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SimilarityOverview />;
      case 'finder':
        return <SimilarCompanyFinder />;
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  MVV類似性分析
                </h1>
                <p className="text-sm text-gray-600">
                  {data.summary.totalCompanies}社のヘルスケア企業を分析
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  平均類似度: <span className="font-semibold">{data.summary.avgSimilarity.toFixed(3)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  最高類似度: <span className="font-semibold">{data.summary.maxSimilarity.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${
                      isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>


        {/* コンテンツ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderTabContent()}
        </div>
      </div>
    </ErrorBoundary>
  );
};