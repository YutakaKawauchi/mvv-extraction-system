import React, { useEffect, useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner, ErrorBoundary } from '../common';
import { BarChart3, Network, Search, AlertCircle, RefreshCw, Star, Hash, Target, Award } from 'lucide-react';
import SimilarityOverview from './SimilarityOverview';
import SimilarCompanyFinder from './SimilarCompanyFinder';
import IndustryAnalysis from './IndustryAnalysis';
import { UniquenessScoreDashboard } from './UniquenessScoreDashboard';
import { MVVTrendAnalysis } from './MVVTrendAnalysis';
import { CompetitivePositioningMap } from './CompetitivePositioningMap';
import { MVVQualityAssessment } from './MVVQualityAssessment';

type TabType = 'overview' | 'finder' | 'industry' | 'uniqueness' | 'trends' | 'positioning' | 'quality';

export const MVVAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  const { 
    data, 
    isLoading, 
    error, 
    loadAnalysisData, 
    clearError 
  } = useAnalysisStore();
  
  const { loadCompanies } = useCompanyStore();

  useEffect(() => {
    loadAnalysisData();
    loadCompanies(); // 企業管理データも読み込み
  }, [loadAnalysisData, loadCompanies]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            MVV分析データを読み込み中...
          </h2>
          <p className="text-gray-600">
            {data?.companies?.length || 0}社のMVV類似性データを処理しています
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
    { id: 'overview', name: '概要', icon: BarChart3, description: 'リアルタイム統計と全体概要' },
    { id: 'finder', name: '類似企業検索', icon: Search, description: '特定企業の類似企業をリアルタイム検索' },
    { id: 'industry', name: '業界分析', icon: Network, description: '業界別のリアルタイム類似度分析' },
    { id: 'uniqueness', name: '独自性分析', icon: Star, description: 'リアルタイム企業独自性スコア分析' },
    { id: 'trends', name: 'トレンド分析', icon: Hash, description: 'MVVキーワードトレンド分析' },
    { id: 'positioning', name: 'ポジショニング', icon: Target, description: '競合ポジショニングマップ' },
    { id: 'quality', name: '品質評価', icon: Award, description: 'MVV品質評価システム' }
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SimilarityOverview />;
      case 'finder':
        return <SimilarCompanyFinder />;
      case 'industry':
        return <IndustryAnalysis />;
      case 'uniqueness':
        return <UniquenessScoreDashboard />;
      case 'trends':
        return <MVVTrendAnalysis />;
      case 'positioning':
        return <CompetitivePositioningMap />;
      case 'quality':
        return <MVVQualityAssessment />;
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
                  MVVリアルタイム分析ダッシュボード
                </h1>
                <p className="text-sm text-gray-600">
                  IndexedDBから{data.companies?.length || 0}社の企業データをリアルタイム分析
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  埋め込み有: <span className="font-semibold">{data.companies?.filter(c => c.embeddings && Array.isArray(c.embeddings) && c.embeddings.length > 0).length || 0}社</span>
                </div>
                <div className="text-sm text-gray-600">
                  データソース: <span className="font-semibold">IndexedDB</span>
                </div>
                
                {/* データ再読み込みボタン */}
                <button
                  onClick={() => {
                    loadAnalysisData(true);
                    loadCompanies();
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  更新
                </button>
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