import React, { useState, useEffect } from 'react';
import { CompanyList } from '../CompanyManager';
import { BatchProcessor, EmbeddingsBatchProcessor, ExtractionQueue, ProcessingStatus, CompanySelector, AddCompanySection } from '../MVVExtractor';
import { ResultsTable, MVVDisplay } from '../ResultsViewer';
import { MVVAnalysisDashboard } from '../MVVAnalysis';
import { BackupRestorePanel } from '../BackupRestore';
import { Modal, Button } from '../common';
import { SessionStatus } from '../auth';
import { useCompanyStore } from '../../stores/companyStore';
import { useMVVStore } from '../../stores/mvvStore';
import { useCSVProcessor } from '../../hooks/useCSVProcessor';
import { useNotification } from '../../hooks/useNotification';
import type { Company, MVVData } from '../../types';
import { 
  Building2, 
  Brain, 
  BarChart3, 
  Zap,
  Network,
  Sparkles,
  Database
} from 'lucide-react';

type ActiveTab = 'companies' | 'extraction' | 'results' | 'analytics' | 'backup';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('companies');
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [viewingMVVData, setViewingMVVData] = useState<{
    company: Company;
    mvvData?: MVVData;
  } | null>(null);

  const { companies, loadCompanies } = useCompanyStore();
  const { mvvDataMap, loadMVVData } = useMVVStore();
  const { exportCombinedData } = useCSVProcessor();
  const { success } = useNotification();

  // Load companies and MVV data on component mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadCompanies(),
        loadMVVData()
      ]);
    };
    loadData();
  }, [loadCompanies, loadMVVData]);

  // Clear selections when switching tabs (except when coming from companies tab with pending items)
  useEffect(() => {
    if (activeTab === 'extraction') {
      // Only auto-select if no companies are currently selected
      if (selectedCompanies.length === 0) {
        const pendingCompanies = companies.filter(c => c.status === 'pending');
        if (pendingCompanies.length > 0) {
          setSelectedCompanies(pendingCompanies);
        }
      }
    } else {
      // Clear selections when not on extraction tab
      setSelectedCompanies([]);
    }
  }, [activeTab, companies]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };


  const handleProcessingComplete = () => {
    success('処理完了', 'MVV抽出が完了しました');
    // Reload data after processing
    loadCompanies();
    loadMVVData();
    setActiveTab('results');
  };

  const handleViewMVVDetails = (company: Company, mvvData?: MVVData) => {
    setViewingMVVData({ company, mvvData });
  };

  const handleExportResults = () => {
    exportCombinedData(companies, mvvDataMap);
  };

  const tabs = [
    {
      id: 'companies' as const,
      name: '企業管理',
      icon: Building2,
      description: '企業の追加・編集・削除'
    },
    {
      id: 'extraction' as const,
      name: 'MVV抽出',
      icon: Brain,
      description: 'AI による MVV 情報抽出'
    },
    {
      id: 'results' as const,
      name: '結果表示',
      icon: BarChart3,
      description: '抽出結果の確認・エクスポート'
    },
    {
      id: 'analytics' as const,
      name: 'AI分析',
      icon: Network,
      description: 'MVV類似度・業界分析'
    },
    {
      id: 'backup' as const,
      name: 'バックアップ',
      icon: Database,
      description: 'データの保護と復元'
    }
  ];

  const getTabStats = () => {
    const totalCompanies = companies.length;
    const pendingCompanies = companies.filter(c => c.status === 'pending').length;
    const processingCompanies = companies.filter(c => c.status === 'processing').length;
    const mvvExtractedCompanies = companies.filter(c => c.status === 'mvv_extracted').length;
    const fullyCompletedCompanies = companies.filter(c => c.status === 'fully_completed').length;
    const mvvErrorCompanies = companies.filter(c => c.status === 'mvv_extraction_error').length;
    const embeddingsErrorCompanies = companies.filter(c => c.status === 'embeddings_generation_error').length;
    const errorCompanies = companies.filter(c => c.status === 'error').length;

    return {
      totalCompanies,
      pendingCompanies,
      processingCompanies,
      mvvExtractedCompanies,
      fullyCompletedCompanies,
      mvvErrorCompanies,
      embeddingsErrorCompanies,
      errorCompanies,
      completionRate: totalCompanies > 0 ? (fullyCompletedCompanies / totalCompanies) * 100 : 0
    };
  };

  const stats = getTabStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                MVV抽出システム
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                日本ヘルスケア企業のMission・Vision・Values自動抽出
              </p>
            </div>
            
            {/* Session Status and Quick Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-6 mt-4 lg:mt-0">
              {/* Session Status */}
              <SessionStatus showDetails={false} />
              
              {/* Quick Stats */}
              <div className="hidden lg:flex space-x-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</div>
                  <div className="text-gray-600">総企業数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.mvvExtractedCompanies}</div>
                  <div className="text-gray-600">MVV抽出済み</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.fullyCompletedCompanies}</div>
                  <div className="text-gray-600">完全完了</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.processingCompanies}</div>
                  <div className="text-gray-600">処理中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.pendingCompanies}</div>
                  <div className="text-gray-600">待機中</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab?.icon;
              const isActive = activeTab === tab?.id;
              
              // タブまたはアイコンが存在しない場合はスキップ
              if (!tab || !Icon) {
                console.warn('Tab or icon is undefined:', tab);
                return null;
              }
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                  {tab.id === 'extraction' && selectedCompanies.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedCompanies.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'companies' && (
          <div>
            <CompanyList />
            {(companies.filter(c => c.status === 'pending').length > 0 || companies.filter(c => c.status === 'mvv_extracted').length > 0) && (
              <div className="mt-6 space-y-4">
                {companies.filter(c => c.status === 'pending').length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-blue-900">
                          MVV抽出を開始 (Phase 1)
                        </h3>
                        <p className="text-sm text-blue-700 mt-1">
                          {companies.filter(c => c.status === 'pending').length}件の企業が処理待ちです
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedCompanies(companies.filter(c => c.status === 'pending'));
                          setActiveTab('extraction');
                        }}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        MVV抽出開始
                      </Button>
                    </div>
                  </div>
                )}
                
                {(companies.filter(c => c.status === 'mvv_extracted').length > 0 || 
                  companies.filter(c => c.status === 'embeddings_generation_error').length > 0) && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-purple-900">
                          Embeddings生成を開始 (Phase 2)
                        </h3>
                        <p className="text-sm text-purple-700 mt-1">
                          {companies.filter(c => c.status === 'mvv_extracted').length}件の企業でEmbeddings生成が可能です
                          {companies.filter(c => c.status === 'embeddings_generation_error').length > 0 && (
                            <span className="block">
                              {companies.filter(c => c.status === 'embeddings_generation_error').length}件のEmbeddings生成エラーを再試行できます
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          const candidateCompanies = companies.filter(c => 
                            c.status === 'mvv_extracted' || c.status === 'embeddings_generation_error'
                          );
                          setSelectedCompanies(candidateCompanies);
                          setActiveTab('extraction');
                        }}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Embeddings生成開始
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'extraction' && (
          <div className="space-y-6">
            {/* Add New Company Section */}
            <AddCompanySection 
              onSuccess={(newCompany) => {
                // Refresh companies data and potentially select the new company
                loadCompanies();
                loadMVVData();
                success('企業追加完了', `${newCompany.name}が追加されました`);
              }}
            />
            
            {/* Company Selection */}
            <CompanySelector
              selectedCompanies={selectedCompanies}
              onSelectionChange={setSelectedCompanies}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <BatchProcessor 
                  selectedCompanies={selectedCompanies}
                  onComplete={handleProcessingComplete}
                />
                <EmbeddingsBatchProcessor 
                  selectedCompanies={selectedCompanies}
                  onComplete={handleProcessingComplete}
                />
              </div>
              <div>
                <ProcessingStatus />
              </div>
            </div>
            <div>
              <ExtractionQueue />
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            <ResultsTable
              companies={companies}
              mvvDataMap={mvvDataMap}
              onViewDetails={handleViewMVVDetails}
              onEdit={() => {
                setActiveTab('companies');
                // Note: This would need additional logic to pre-select the company for editing
              }}
              onExport={handleExportResults}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <MVVAnalysisDashboard />
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6">
            <BackupRestorePanel />
            
            {/* Debug Section (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-yellow-800 mb-4">
                  開発用: IndexedDBデバッグ
                </h3>
                <p className="text-sm text-yellow-700 mb-4">
                  現在のIndexedDBデータの詳細を確認できます。ブラウザのコンソールで結果を確認してください。
                </p>
                <Button
                  onClick={() => {
                    // 新しいデバッグ手順を案内
                    console.log('📦 デバッグ手順:');
                    console.log('1. fetch(\'/debug-category-status.js\').then(r => r.text()).then(code => eval(code));');
                    console.log('2. debugCategoryStatus();');
                    success('デバッグコード表示', 'コンソールで上記コードを実行してください');
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  IndexedDBデータを確認
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MVV Details Modal */}
      {viewingMVVData && (
        <Modal
          isOpen={!!viewingMVVData}
          onClose={() => setViewingMVVData(null)}
          title="MVV詳細"
          size="xl"
        >
          {viewingMVVData.mvvData ? (
            <MVVDisplay
              mvvData={viewingMVVData.mvvData}
              companyName={viewingMVVData.company.name}
              showMetadata={true}
            />
          ) : (
            <div className="text-center py-8">
              <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                MVVデータが見つかりません
              </h3>
              <p className="text-gray-600">
                この企業のMVV情報はまだ抽出されていません。
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};