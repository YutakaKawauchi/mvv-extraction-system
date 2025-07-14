import React, { useState, useEffect } from 'react';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner } from '../common';
import { useApiClient } from '../../services/apiClient';
import { 
  Lightbulb, 
  Zap, 
  Save, 
  AlertCircle,
  CheckCircle,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { ideaStorageService, type StoredBusinessIdea } from '../../services/ideaStorage';
import { IdeaExportWizard } from './IdeaExportWizard';
import { SavedIdeasPanel } from './SavedIdeasPanel';
import { IdeaDetailModal } from './IdeaDetailModal';
import { LeanCanvas } from './LeanCanvas';
import { IdeaGenerationDialog } from './IdeaGenerationDialog';

interface AnalysisParams {
  focusAreas: string[];
  businessModel: string;
  targetMarket: string;
  constraints: {
    budget?: string;
    timeframe?: string;
    resources?: string;
  };
  techPreferences: {
    preferred: string[];
    avoided: string[];
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  revenueExpectation: 'short-term' | 'medium-term' | 'long-term';
}

interface BusinessIdea {
  title: string;
  description: string;
  worldview: string;
  industryInsight: string;
  leanCanvas: {
    problem: string[];
    existingAlternatives?: string;
    solution: string;
    keyMetrics: string[];
    valueProposition: string;
    unfairAdvantage: string;
    channels: string[];
    targetCustomers: string[];
    earlyAdopters?: string;
    costStructure: string[];
    revenueStreams: string[];
  };
  feasibility: {
    mvvAlignment: number;
    mvvAlignmentReason: string;
    implementationScore: number;
    implementationReason: string;
    marketPotential: number;
    marketPotentialReason: string;
  };
  verification?: VerificationResult; // Beta v2: AI検証結果
}

interface VerificationResult {
  industryAnalysis: any;
  marketValidation: any;
  businessModelValidation: any;
  competitiveAnalysis: any;
  improvementSuggestions: any;
  overallAssessment: any;
  metadata: {
    verificationLevel: string;
    totalTokens: number;
    totalCost: number;
    model: string;
    confidence: number;
    version: string;
  };
}

interface GenerationResult {
  ideas: BusinessIdea[];
  metadata: {
    model: string;
    tokensUsed: number;
    estimatedCost: number;
    confidence: number;
    version: string;
    cacheLevel?: number;
  };
}

export const BusinessInnovationLab: React.FC = () => {
  const { companies, loadCompanies } = useCompanyStore();
  const { verifyBusinessIdea } = useApiClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>({
    focusAreas: [],
    businessModel: '',
    targetMarket: '',
    constraints: {},
    techPreferences: {
      preferred: [],
      avoided: []
    },
    riskTolerance: 'moderate',
    revenueExpectation: 'medium-term'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<StoredBusinessIdea[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [showSavedIdeasPanel, setShowSavedIdeasPanel] = useState(false);
  const [selectedIdeaForDetail, setSelectedIdeaForDetail] = useState<StoredBusinessIdea | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [savedIdeasRefreshKey, setSavedIdeasRefreshKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [maxIdeas] = useState(1); // デフォルト1案
  
  // Beta v2: AI検証機能のstate
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<{[ideaIndex: number]: VerificationResult}>({});
  const [selectedIdeaForVerification, setSelectedIdeaForVerification] = useState<number | null>(null);
  const [verificationLevel, setVerificationLevel] = useState<'basic' | 'comprehensive' | 'expert'>('basic');
  
  // Excel Export機能のstate
  const [showExportWizard, setShowExportWizard] = useState(false);

  useEffect(() => {
    loadCompanies();
    loadSavedIdeas();
  }, []); // 初回マウント時のみ実行

  // 保存済みアイデアの読み込み
  const loadSavedIdeas = async () => {
    setIsLoadingIdeas(true);
    try {
      const ideas = await ideaStorageService.getIdeas();
      setSavedIdeas(ideas);
    } catch (error) {
      console.error('Failed to load saved ideas:', error);
      setError('保存済みアイデアの読み込みに失敗しました');
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  // 統合ダイアログからの生成処理
  const handleGenerateFromDialog = async (companyId: string, params: AnalysisParams) => {
    // 状態を更新
    setSelectedCompanyId(companyId);
    setAnalysisParams(params);
    setShowGenerationDialog(false);
    
    // 企業情報を直接取得して生成実行
    const company = companies.find(c => c.id === companyId);
    if (!company) {
      setError('選択された企業が見つかりません');
      return;
    }
    
    // 直接生成処理を実行（状態更新を待たずに）
    await executeIdeaGeneration(company, params);
  };

  // アイデア生成の実際の処理（会社とパラメータを直接受け取る）
  const executeIdeaGeneration = async (company: any, params: AnalysisParams) => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    // プログレス更新
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90; // 90%で止める
        return prev + Math.random() * 15;
      });
    }, 1000);

    try {
      // API エンドポイントの準備（Phase α用）
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      
      const response = await fetch(`${API_BASE_URL}/generate-business-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_SECRET,
        },
        body: JSON.stringify({
          companyData: {
            id: company.id,
            name: company.name,
            industry: company.category,
            mvv: {
              mission: company.mission,
              vision: company.vision,
              values: company.values
            },
            profile: {
              foundedYear: 2020, // Default values since we don't have this in basic company data
              employeeCount: 100,
              capital: 100000000,
              location: "Japan"
            }
          },
          analysisParams: params,
          options: {
            maxIdeas: maxIdeas // ユーザー選択
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setProgress(100);
        setResults(result.data);
      } else {
        throw new Error(result.error || 'アイデア生成に失敗しました');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'アイデア生成中にエラーが発生しました');
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 2000); // 2秒後にプログレスをリセット
    }
  };

  // アイデア復元機能
  const handleRestoreIdea = async (idea: StoredBusinessIdea) => {
    try {
      // 1. 元のパラメータを復元（新しいパラメータのデフォルト値を含む）
      setSelectedCompanyId(idea.companyId);
      setAnalysisParams({
        ...idea.analysisParams,
        // 新しいパラメータのデフォルト値（既存のアイデアとの互換性）
        techPreferences: idea.analysisParams.techPreferences || {
          preferred: [],
          avoided: []
        },
        riskTolerance: idea.analysisParams.riskTolerance || 'moderate',
        revenueExpectation: idea.analysisParams.revenueExpectation || 'medium-term'
      });

      // 2. 生成結果を復元（元のアイデアを results に設定）
      const restoredResults: GenerationResult = {
        ideas: [{
          title: idea.title,
          description: idea.description,
          worldview: idea.worldview,
          industryInsight: idea.industryInsight,
          leanCanvas: idea.leanCanvas,
          feasibility: idea.feasibility,
          verification: idea.verification
        }],
        metadata: idea.generationMetadata
      };
      setResults(restoredResults);

      // 3. 検証結果がある場合は検証状態も復元
      if (idea.verification) {
        setVerificationResults({ 0: idea.verification });
      } else {
        setVerificationResults({});
      }

      // 4. UI状態をリセット
      setError(null);
      setProgress(0);
      setSelectedIdeaForVerification(null);
      
      // 5. パネルを閉じる
      setShowSavedIdeasPanel(false);

      console.log('Idea restored successfully:', idea.title);
      
      // 成功メッセージを一時表示
      const originalError = error;
      setError(`✅ アイデア「${idea.title}」を復元しました`);
      setTimeout(() => {
        setError(originalError);
      }, 3000);

    } catch (err) {
      console.error('Failed to restore idea:', err);
      setError('アイデアの復元に失敗しました');
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  


  const handleSaveIdea = async (idea: BusinessIdea, index: number) => {
    if (!selectedCompany) {
      setError('企業情報が不正です');
      return;
    }

    try {
      const verification = verificationResults[index];
      
      const savedIdea: Omit<StoredBusinessIdea, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        title: idea.title,
        description: idea.description,
        worldview: idea.worldview,
        industryInsight: idea.industryInsight,
        leanCanvas: idea.leanCanvas,
        feasibility: idea.feasibility,
        verification: verification ? {
          industryAnalysis: verification.industryAnalysis,
          marketValidation: verification.marketValidation,
          businessModelValidation: verification.businessModelValidation,
          competitiveAnalysis: verification.competitiveAnalysis,
          improvementSuggestions: verification.improvementSuggestions,
          overallAssessment: verification.overallAssessment,
          metadata: verification.metadata
        } : undefined,
        analysisParams,
        generationMetadata: results?.metadata || {
          model: 'unknown',
          tokensUsed: 0,
          estimatedCost: 0,
          confidence: 0,
          version: 'beta'
        },
        tags: [],
        status: verification ? 'verified' : 'draft',
        starred: false
      };

      const ideaId = await ideaStorageService.saveIdea(savedIdea);
      
      // UI更新 - 保存済みアイデアを再読み込み
      await loadSavedIdeas();
      
      // 成功通知
      console.log('Idea saved successfully with ID:', ideaId);
      
      // 保存後に検証結果も更新
      if (verification) {
        await ideaStorageService.updateIdeaWithVerification(ideaId, verification);
      }
      
    } catch (error) {
      console.error('Failed to save idea:', error);
      setError('アイデアの保存に失敗しました');
    }
  };

  // Beta v2: AI検証機能
  const handleVerifyIdea = async (idea: BusinessIdea, index: number) => {
    if (!selectedCompany) {
      setError('企業情報が必要です');
      return;
    }

    setIsVerifying(true);
    setSelectedIdeaForVerification(index);
    setError(null);

    try {
      // API Clientを使用してキャッシュ機能付きで検証実行
      console.log(`🔍 Starting ${verificationLevel} verification for "${idea.title}"`);
      
      const result = await verifyBusinessIdea({
        businessIdea: idea,
        verificationLevel,
        companyData: selectedCompany
      });

      // キャッシュ使用状況をログ
      if (result?.metadata?.cacheUsed) {
        console.log(`⚡ Cache acceleration: ${result.metadata.cacheLevel} level`);
      }
      
      if (result.success) {
        setVerificationResults(prev => ({
          ...prev,
          [index]: result.data
        }));
      } else {
        throw new Error(result.error || 'アイデア検証に失敗しました');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'アイデア検証中にエラーが発生しました');
    } finally {
      setIsVerifying(false);
      setSelectedIdeaForVerification(null);
    }
  };

  // アイデア管理機能

  const handleExportComplete = (fileName: string) => {
    setError(null);
    // 成功メッセージを表示（必要に応じて）
    console.log(`Excel export completed: ${fileName}`);
  };

  // Note: Idea selection functionality can be added later for enhanced Excel export

  const handleToggleStar = async (ideaId: string) => {
    try {
      await ideaStorageService.toggleStar(ideaId);
      await loadSavedIdeas();
      
      // SavedIdeasPanelの更新をトリガー
      setSavedIdeasRefreshKey(prev => prev + 1);
      
      // モーダル表示中のアイデアも更新
      if (selectedIdeaForDetail && selectedIdeaForDetail.id === ideaId) {
        const updatedIdea = await ideaStorageService.getIdea(ideaId);
        if (updatedIdea) {
          setSelectedIdeaForDetail(updatedIdea);
        }
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
      setError('スター状態の変更に失敗しました');
    }
  };


  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedIdeaForDetail(null);
  };

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDetailModal) {
        handleCloseDetailModal();
      }
    };

    if (showDetailModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showDetailModal]);



  const getAnalysisSteps = () => [
    { name: '企業MVV分析', status: progress >= 20 ? 'completed' : progress >= 10 ? 'current' : 'upcoming' },
    { name: '業界課題特定', status: progress >= 40 ? 'completed' : progress >= 20 ? 'current' : 'upcoming' },
    { name: 'ソリューション設計', status: progress >= 60 ? 'completed' : progress >= 40 ? 'current' : 'upcoming' },
    { name: 'リーンキャンバス構築', status: progress >= 80 ? 'completed' : progress >= 60 ? 'current' : 'upcoming' },
    { name: '実現可能性評価', status: progress >= 100 ? 'completed' : progress >= 80 ? 'current' : 'upcoming' }
  ];

  const renderStepProgress = () => (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-blue-900">AI分析プロセス</span>
        <span className="text-sm text-blue-700 font-medium">{Math.round(progress)}%完了</span>
      </div>
      <div className="flex items-center space-x-2">
        {getAnalysisSteps().map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all duration-300 ${
              step.status === 'completed' 
                ? 'bg-green-500 text-white' 
                : step.status === 'current' 
                ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step.status === 'completed' ? '✓' : index + 1}
            </div>
            <div className="flex-1 ml-2">
              <div className={`text-xs font-medium transition-colors ${
                step.status === 'completed' ? 'text-green-700' : 
                step.status === 'current' ? 'text-blue-700' : 'text-gray-500'
              }`}>
                {step.name}
              </div>
            </div>
            {index < getAnalysisSteps().length - 1 && (
              <div className={`h-0.5 w-4 mx-2 transition-colors ${
                step.status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
              }`}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // メインアイデア生成ボタン
  const renderMainGenerateButton = () => (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-6">
      <div className="text-center">
        <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <Lightbulb className="h-10 w-10 text-blue-600" />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-3">AI ビジネスアイデア生成</h3>
        <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
          企業のMVV（ミッション・ビジョン・バリュー）と高度な業界分析に基づく革新的なビジネスアイデアを生成します。
          プリセット機能、詳細なパラメータ設定、条件付きガイダンスで最適なアイデアを創出。
        </p>
        
        <button
          onClick={() => setShowGenerationDialog(true)}
          disabled={isGenerating}
          className="inline-flex items-center px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Zap className="h-6 w-6 mr-3" />
          アイデア生成を開始
        </button>
        
        <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-500">
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
            プリセット機能
          </span>
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
            条件付きガイダンス
          </span>
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
            詳細パラメータ設定
          </span>
        </div>
      </div>
      
      {isGenerating && (
        <div className="mt-8 space-y-4">
          {renderStepProgress()}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-blue-900">全体進捗</span>
              <span className="text-sm text-blue-700 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-700 mt-3 font-medium">
              {progress < 20 ? '企業のMVVを深く分析しています...' :
               progress < 40 ? '業界の真の課題を特定しています...' :
               progress < 60 ? '革新的なソリューションを設計しています...' :
               progress < 80 ? 'ビジネスモデルを構築しています...' :
               progress < 100 ? '実現可能性を評価しています...' :
               'アイデア生成が完了しました！'}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-2 rounded-lg mr-3">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">革新的ビジネスアイデア</h3>
                <p className="text-sm text-gray-600 mt-1">AI powered 深度分析結果</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-700">
                {results.ideas.length}案生成完了
              </div>
              <div className="text-xs text-gray-500 mt-1">
                処理コスト: ${results.metadata.estimatedCost.toFixed(4)}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {results.ideas.map((idea, index) => (
              <div key={index} className="border-2 border-gray-100 rounded-xl p-6 bg-gradient-to-br from-gray-50 to-white hover:border-blue-200 transition-all duration-200 hover:shadow-md">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mr-3">
                        アイデア {index + 1}
                      </div>
                      {results.metadata?.cacheLevel && (
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          results.metadata.cacheLevel === 1 ? 'bg-green-100 text-green-700' :
                          results.metadata.cacheLevel === 2 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {results.metadata.cacheLevel === 1 ? '企業固有分析' :
                           results.metadata.cacheLevel === 2 ? '類似パラメータ' :
                           '業界テンプレート'}
                        </div>
                      )}
                    </div>
                    <h4 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">{idea.title}</h4>
                    <p className="text-gray-700 text-lg leading-relaxed">{idea.description}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {/* Beta v2: AI検証ボタン */}
                    <button
                      onClick={() => handleVerifyIdea(idea, index)}
                      disabled={isVerifying && selectedIdeaForVerification === index}
                      className="flex items-center px-4 py-2 text-sm bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-lg hover:from-purple-200 hover:to-purple-300 hover:text-purple-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying && selectedIdeaForVerification === index ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      <span className="text-xs">β</span>
                      検証
                    </button>
                    
                    <button
                      onClick={() => handleSaveIdea(idea, index)}
                      className="flex items-center px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      保存
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-md mb-4">
                  <h5 className="font-medium text-blue-900 mb-2">MVV世界観</h5>
                  <p className="text-blue-800">{idea.worldview}</p>
                  {results.metadata?.cacheLevel === 3 && (
                    <p className="text-xs text-blue-600 mt-2 italic">
                      ※ 業界テンプレートから生成されたアイデアです
                    </p>
                  )}
                </div>

                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-md mb-4">
                  <h5 className="font-semibold text-orange-900 mb-3 flex items-center">
                    <span className="bg-orange-200 p-1 rounded mr-2">💡</span>
                    業界課題の深い洞察
                  </h5>
                  <div className="text-orange-800 space-y-2">
                    <p className="leading-relaxed">{idea.industryInsight}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-900 mb-4">リーンキャンバス</h5>
                  <LeanCanvas data={idea.leanCanvas} />
                </div>

                <div className="mt-6">
                  <h5 className="font-medium text-gray-900 mb-3">実現可能性評価</h5>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-center mb-3">
                        <div className="text-sm font-medium text-blue-900">MVV適合度</div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">
                          {(idea.feasibility.mvvAlignment * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${idea.feasibility.mvvAlignment * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-xs text-blue-800 leading-relaxed">
                        {idea.feasibility.mvvAlignmentReason}
                      </div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-center mb-3">
                        <div className="text-sm font-medium text-green-900">実装容易性</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                          {(idea.feasibility.implementationScore * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${idea.feasibility.implementationScore * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-xs text-green-800 leading-relaxed">
                        {idea.feasibility.implementationReason}
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-center mb-3">
                        <div className="text-sm font-medium text-purple-900">市場ポテンシャル</div>
                        <div className="text-2xl font-bold text-purple-600 mt-1">
                          {(idea.feasibility.marketPotential * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full" 
                            style={{ width: `${idea.feasibility.marketPotential * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-xs text-purple-800 leading-relaxed">
                        {idea.feasibility.marketPotentialReason}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beta v2: AI検証結果表示 */}
                {verificationResults[index] && (
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <div className="flex items-center mb-4">
                      <div className="bg-purple-100 p-2 rounded-lg mr-3">
                        <CheckCircle className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900">AI検証結果</h5>
                        <p className="text-sm text-gray-600">専門AI による多角的分析結果</p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-xs text-gray-500">
                          検証レベル: {verificationResults[index].metadata.verificationLevel}
                        </div>
                        <div className="text-xs text-gray-500">
                          信頼度: {(verificationResults[index].metadata.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {/* 総合評価 */}
                    {verificationResults[index].overallAssessment && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                        <h6 className="font-semibold text-purple-900 mb-3">総合評価</h6>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-600">
                              {verificationResults[index].overallAssessment.overallScore?.viabilityScore || 'N/A'}
                            </div>
                            <div className="text-xs text-purple-700">実行可能性</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {verificationResults[index].overallAssessment.overallScore?.innovationScore || 'N/A'}
                            </div>
                            <div className="text-xs text-blue-700">革新性</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">
                              {verificationResults[index].overallAssessment.overallScore?.marketPotentialScore || 'N/A'}
                            </div>
                            <div className="text-xs text-green-700">市場ポテンシャル</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">
                              {verificationResults[index].overallAssessment.overallScore?.totalScore || 'N/A'}
                            </div>
                            <div className="text-xs text-orange-700">総合スコア</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            verificationResults[index].overallAssessment.recommendation?.decision === 'GO' ? 'bg-green-100 text-green-800' :
                            verificationResults[index].overallAssessment.recommendation?.decision === 'CONDITIONAL-GO' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            推奨: {verificationResults[index].overallAssessment.recommendation?.decision || 'N/A'}
                          </div>
                          <p className="text-sm text-purple-800">
                            {verificationResults[index].overallAssessment.recommendation?.reasoning || '詳細な理由は分析中です'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 改善提案 */}
                    {verificationResults[index].improvementSuggestions && (
                      <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h6 className="font-semibold text-orange-900 mb-3">改善提案</h6>
                        {verificationResults[index].improvementSuggestions.improvementRecommendations?.slice(0, 3).map((rec: any, recIndex: number) => (
                          <div key={recIndex} className="mb-3 p-3 bg-orange-100 rounded border">
                            <div className="font-medium text-orange-900 text-sm">{rec.area}</div>
                            <div className="text-orange-800 text-xs mt-1">{rec.recommendedChange}</div>
                            <div className="text-orange-700 text-xs mt-1">期待効果: {rec.expectedImpact}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 業界分析サマリー */}
                    {verificationResults[index].industryAnalysis && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h6 className="font-semibold text-blue-900 mb-2">業界専門分析</h6>
                          <div className="text-sm text-blue-800 space-y-1">
                            <div>
                              <span className="font-medium">緊急度:</span> 
                              {verificationResults[index].industryAnalysis.problemValidation?.urgencyLevel || 'N/A'}/10
                            </div>
                            <div>
                              <span className="font-medium">革新性:</span> 
                              {verificationResults[index].industryAnalysis.solutionAssessment?.innovationLevel || 'N/A'}/10
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h6 className="font-semibold text-green-900 mb-2">競合分析</h6>
                          <div className="text-sm text-green-800 space-y-1">
                            <div>
                              <span className="font-medium">直接競合:</span> 
                              {verificationResults[index].competitiveAnalysis?.directCompetitors?.length || 0}社
                            </div>
                            <div>
                              <span className="font-medium">優位性持続:</span> 
                              {verificationResults[index].competitiveAnalysis?.competitiveAdvantageAnalysis?.sustainabilityScore || 'N/A'}/10
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-analysis-screen="innovation">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Lightbulb className="h-6 w-6 mr-2" />
            <h2 className="text-2xl font-bold">ビジネス革新ラボ (β版)</h2>
            <span className="bg-purple-500 bg-opacity-90 text-white px-2 py-1 rounded-full text-xs font-medium ml-2">
              v2 NEW
            </span>
          </div>
          
          {/* ヘッダーアクションボタン */}
          <div className="flex items-center gap-3">
            
            <button
              onClick={() => setShowSavedIdeasPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200 shadow-sm border border-blue-200"
              title="保存済みアイデアを表示・復元"
            >
              <Database className="w-4 h-4" />
              <span className="text-sm font-medium">保存済み</span>
              {savedIdeas.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {savedIdeas.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setShowExportWizard(true)}
              disabled={savedIdeas.length === 0 || isLoadingIdeas}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm ${
                savedIdeas.length > 0 && !isLoadingIdeas
                  ? 'bg-white text-green-700 hover:bg-green-50 border border-green-200'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
              title={savedIdeas.length > 0 ? "Excel形式で出力" : "保存済みアイデアがありません"}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-sm font-medium">Excel出力</span>
            </button>
          </div>
        </div>
        <p className="text-blue-100">
          企業のMVVと事業プロファイルから、AI powered 新規事業アイデアを生成・検証します
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm">
            <span className="bg-blue-800 bg-opacity-80 px-3 py-1 rounded-full text-blue-100 font-semibold border border-blue-200 border-opacity-30">
              Phase β
            </span>
            <span className="text-blue-100 opacity-90">AI検証システム</span>
            <span className="text-blue-100 opacity-90">業界エキスパート分析</span>
            <span className="text-blue-100 opacity-90">改善提案機能</span>
          </div>
        </div>
        
        {/* Beta v2: 検証レベル選択 */}
        <div className="mt-4 bg-blue-800 bg-opacity-20 rounded-lg p-4 border border-blue-300 border-opacity-30">
          <label className="block text-sm font-medium text-blue-100 mb-3 flex items-center">
            <Zap className="h-4 w-4 mr-2" />
            AI検証レベル選択
          </label>
          <select
            value={verificationLevel}
            onChange={(e) => setVerificationLevel(e.target.value as 'basic' | 'comprehensive' | 'expert')}
            className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm font-medium"
          >
            <option value="basic" className="text-gray-900 py-2">
              🚀 Basic - 基本的な検証（推奨・高速）
            </option>
            <option value="comprehensive" className="text-gray-900 py-2">
              🎯 Comprehensive (β版) - 詳細分析 + 競合調査
            </option>
            <option value="expert" className="text-gray-900 py-2">
              🔬 Expert (開発中) - 専門家レベル分析
            </option>
          </select>
          <div className="mt-2 text-xs text-blue-200 opacity-80 space-y-1">
            <p>• Basic: 高速検証（15-30秒、業界分析簡略化）</p>
            <p>• Comprehensive (β版): 詳細分析 + 競合調査（45-90秒）</p>
            <p>• Expert (開発中): 現在はComprehensiveと同等の処理</p>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      {true && (
        <>
          {renderMainGenerateButton()}
          {renderResults()}
        </>
      )}

      {/* アイデア管理画面 */}

      {/* アイデア詳細モーダル */}
      <IdeaDetailModal
        isOpen={showDetailModal}
        idea={selectedIdeaForDetail}
        onClose={handleCloseDetailModal}
        onToggleStar={handleToggleStar}
      />

      {/* Excel出力ウィザード */}
      <IdeaExportWizard
        ideas={savedIdeas}
        isOpen={showExportWizard}
        onClose={() => setShowExportWizard(false)}
        onExportComplete={handleExportComplete}
      />

      {/* 保存済みアイデアパネル */}
      <SavedIdeasPanel
        isOpen={showSavedIdeasPanel}
        onClose={() => setShowSavedIdeasPanel(false)}
        onRestoreIdea={handleRestoreIdea}
        onViewDetails={(idea) => {
          setSelectedIdeaForDetail(idea);
          setShowDetailModal(true);
        }}
        refreshKey={savedIdeasRefreshKey}
      />

      {/* 統合アイデア生成ダイアログ */}
      <IdeaGenerationDialog
        isOpen={showGenerationDialog}
        onClose={() => setShowGenerationDialog(false)}
        onGenerate={handleGenerateFromDialog}
        isGenerating={isGenerating}
      />
    </div>
  );
};