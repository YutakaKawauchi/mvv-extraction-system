import React, { useState, useEffect } from 'react';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner } from '../common';
import { useApiClient } from '../../services/apiClient';
import { 
  Lightbulb, 
  Building2, 
  Settings, 
  Zap, 
  Save, 
  AlertCircle,
  CheckCircle,
  Star,
  Database,
  Trash2,
  Eye,
  Calendar,
  RefreshCw,
  X,
  Clock,
  Tag,
  FileSpreadsheet
} from 'lucide-react';
import { ideaStorageService, type StoredBusinessIdea } from '../../services/ideaStorage';
import { IdeaExportWizard } from './IdeaExportWizard';
import { SavedIdeasPanel } from './SavedIdeasPanel';

interface AnalysisParams {
  focusAreas: string[];
  businessModel: string;
  targetMarket: string;
  constraints: {
    budget?: string;
    timeframe?: string;
    resources?: string;
  };
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
    constraints: {}
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<StoredBusinessIdea[]>([]);
  const [showSavedIdeasPanel, setShowSavedIdeasPanel] = useState(false);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [selectedIdeaForDetail, setSelectedIdeaForDetail] = useState<StoredBusinessIdea | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [savedIdeasRefreshKey, setSavedIdeasRefreshKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [maxIdeas, setMaxIdeas] = useState(1); // デフォルト1案
  
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
  }, [loadCompanies]);

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

  // アイデア復元機能
  const handleRestoreIdea = async (idea: StoredBusinessIdea) => {
    try {
      // 1. 元のパラメータを復元
      setSelectedCompanyId(idea.companyId);
      setAnalysisParams(idea.analysisParams);

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
  
  const focusAreaOptions = [
    'デジタル変革', 'サステナビリティ', '新市場開拓', 'プロダクト革新',
    'サービス拡張', 'グローバル展開', 'パートナーシップ', 'テクノロジー活用'
  ];

  const businessModelOptions = [
    'SaaS・サブスクリプション', 'プラットフォーム', 'マーケットプレイス',
    'フリーミアム', 'ライセンシング', 'コンサルティング', 'ハードウェア＋サービス'
  ];

  const handleGenerateIdeas = async () => {
    if (!selectedCompany) {
      setError('企業を選択してください');
      return;
    }

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
            id: selectedCompany.id,
            name: selectedCompany.name,
            industry: selectedCompany.category,
            mvv: {
              mission: selectedCompany.mission,
              vision: selectedCompany.vision,
              values: selectedCompany.values
            },
            profile: {
              foundedYear: 2020, // Default values since we don't have this in basic company data
              employeeCount: 100,
              capital: 100000000,
              location: "Japan"
            }
          },
          analysisParams,
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
  const handleDeleteIdea = async (ideaId: string) => {
    if (!confirm('このアイデアを削除しますか？')) return;
    
    try {
      await ideaStorageService.deleteIdea(ideaId);
      await loadSavedIdeas();
    } catch (error) {
      console.error('Failed to delete idea:', error);
      setError('アイデアの削除に失敗しました');
    }
  };

  // Excel Export handlers
  const handleExportToExcel = () => {
    setShowExportWizard(true);
  };

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

  const handleViewIdeaDetail = (idea: StoredBusinessIdea) => {
    setSelectedIdeaForDetail(idea);
    setShowDetailModal(true);
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


  const renderIdeaDetailModal = () => {
    if (!showDetailModal || !selectedIdeaForDetail) return null;

    const idea = selectedIdeaForDetail;

    // 背景クリックでモーダルを閉じる
    const handleBackgroundClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleCloseDetailModal();
      }
    };

    return (
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-60 flex items-center justify-center z-50 p-4"
        onClick={handleBackgroundClick}
      >
        <div 
          className="bg-white rounded-xl shadow-2xl max-w-6xl max-h-[90vh] overflow-y-auto w-full relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <Eye className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-bold text-gray-900">アイデア詳細</h2>
              <div className="flex items-center ml-4 space-x-2">
                {idea.starred && (
                  <Star className="h-5 w-5 text-yellow-500 fill-current" />
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  idea.status === 'verified' ? 'bg-green-100 text-green-700' :
                  idea.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {idea.status === 'verified' ? '検証済み' :
                   idea.status === 'draft' ? '下書き' : 'アーカイブ'}
                </span>
              </div>
            </div>
            <button
              onClick={handleCloseDetailModal}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-4 space-y-4">
            {/* 基本情報 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">{idea.title}</h1>
                </div>
                <button
                  onClick={() => handleToggleStar(idea.id)}
                  className="p-2 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
                  title={idea.starred ? 'スターを外す' : 'スターを付ける'}
                >
                  <Star className={`h-6 w-6 ${idea.starred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                </button>
              </div>
              <p className="text-gray-700 leading-relaxed mb-3">{idea.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="font-medium">企業:</span>
                  <span className="ml-1">{idea.companyName}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium">作成:</span>
                  <span className="ml-1">{new Date(idea.createdAt).toLocaleDateString('ja-JP')}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Tag className="h-4 w-4 mr-2" />
                  <span className="font-medium">タグ:</span>
                  <span className="ml-1">{idea.tags.length > 0 ? idea.tags.join(', ') : 'なし'}</span>
                </div>
              </div>
            </div>

            {/* リーンキャンバス - 最重要情報なので上部に配置 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                リーンキャンバス
              </h3>
              <div className="grid grid-cols-10 grid-rows-3 gap-1 border border-gray-300 rounded-lg overflow-hidden text-xs min-h-[320px]">
                
                {/* ②課題 */}
                <div className="col-span-2 row-span-2 bg-slate-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-slate-800 mb-1 text-xs">②課題</div>
                  <div className="text-slate-700 space-y-1">
                    {idea.leanCanvas.problem.map((p, i) => (
                      <div key={i} className="border-l-2 border-slate-300 pl-1 text-xs leading-tight">{p}</div>
                    ))}
                    {idea.leanCanvas.existingAlternatives && (
                      <div className="mt-2 pt-1 border-t border-slate-200">
                        <div className="font-semibold text-slate-900 mb-1 text-xs">既存の代替品</div>
                        <div className="text-slate-700 text-xs leading-tight">
                          {idea.leanCanvas.existingAlternatives}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* ④ソリューション */}
                <div className="col-span-2 bg-blue-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-blue-800 mb-1 text-xs">④ソリューション</div>
                  <div className="text-blue-700 text-xs leading-tight">{idea.leanCanvas.solution}</div>
                </div>
                
                {/* ③独自の価値提案 */}
                <div className="col-span-2 row-span-2 bg-amber-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-amber-800 mb-1 text-xs">③独自の価値提案</div>
                  <div className="text-amber-700 font-medium text-xs leading-tight">{idea.leanCanvas.valueProposition}</div>
                </div>
                
                {/* ⑨圧倒的な優位性 */}
                <div className="col-span-2 bg-indigo-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-indigo-800 mb-1 text-xs">⑨圧倒的な優位性</div>
                  <div className="text-indigo-700 text-xs leading-tight">{idea.leanCanvas.unfairAdvantage}</div>
                </div>
                
                {/* ①顧客セグメント */}
                <div className="col-span-2 row-span-2 bg-emerald-50 border-b border-gray-300 p-2">
                  <div className="font-semibold text-emerald-800 mb-1 text-xs">①顧客セグメント</div>
                  <div className="text-emerald-700 space-y-1">
                    {idea.leanCanvas.targetCustomers.map((customer, i) => (
                      <div key={i} className="bg-emerald-100 px-1 py-0.5 rounded text-xs">{customer}</div>
                    ))}
                    {idea.leanCanvas.earlyAdopters && (
                      <div className="mt-2 pt-1 border-t border-emerald-200">
                        <div className="font-semibold text-emerald-900 mb-1 text-xs">アーリーアダプター</div>
                        <div className="text-emerald-700 text-xs leading-tight">
                          {idea.leanCanvas.earlyAdopters}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* ⑦主要指標 */}
                <div className="col-span-2 bg-teal-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-teal-800 mb-1 text-xs">⑦主要指標</div>
                  <div className="text-teal-700 space-y-1">
                    {idea.leanCanvas.keyMetrics?.map((metric, i) => (
                      <div key={i} className="bg-teal-100 px-1 py-0.5 rounded text-xs">{metric}</div>
                    )) || <div className="text-gray-500 text-xs">設定が必要</div>}
                  </div>
                </div>
                
                {/* ⑤チャネル */}
                <div className="col-span-2 bg-violet-50 border-r border-b border-gray-300 p-2">
                  <div className="font-semibold text-violet-800 mb-1 text-xs">⑤チャネル</div>
                  <div className="text-violet-700 space-y-1">
                    {idea.leanCanvas.channels?.map((channel, i) => (
                      <div key={i} className="bg-violet-100 px-1 py-0.5 rounded text-xs">{channel}</div>
                    )) || <div className="text-gray-500 text-xs">検討が必要</div>}
                  </div>
                </div>
                
                {/* ⑧コスト構造 */}
                <div className="col-span-5 bg-rose-50 border-r border-gray-300 p-2">
                  <div className="font-semibold text-rose-800 mb-1 text-xs">⑧コスト構造</div>
                  <div className="text-rose-700 space-y-1">
                    {idea.leanCanvas.costStructure?.map((cost, i) => (
                      <div key={i} className="border-l-2 border-rose-300 pl-1 text-xs leading-tight">{cost}</div>
                    )) || <div className="text-gray-500 text-xs">分析が必要</div>}
                  </div>
                </div>
                
                {/* ⑥収益の流れ */}
                <div className="col-span-5 bg-green-50 p-2">
                  <div className="font-semibold text-green-800 mb-1 flex items-center text-xs">
                    <span className="mr-1">💰</span>
                    ⑥収益の流れ（支払者明記）
                  </div>
                  <div className="text-green-700 space-y-1">
                    {idea.leanCanvas.revenueStreams.map((revenue, i) => (
                      <div key={i} className="bg-green-100 px-1 py-0.5 rounded text-xs font-medium border border-green-200">
                        {revenue}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* コンパクトな3列レイアウト */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* MVV世界観 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">MVV世界観</h4>
                <p className="text-blue-800 leading-relaxed text-xs">{idea.worldview}</p>
              </div>

              {/* 業界洞察 */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-orange-900 mb-2">業界課題の深い洞察</h4>
                <p className="text-orange-800 leading-relaxed text-xs">{idea.industryInsight}</p>
              </div>

              {/* 実現可能性評価 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">実現可能性評価</h4>
                <div className="space-y-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{(idea.feasibility.mvvAlignment * 100).toFixed(0)}%</div>
                    <div className="text-xs text-blue-900">MVV適合度</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{(idea.feasibility.implementationScore * 100).toFixed(0)}%</div>
                    <div className="text-xs text-green-900">実装容易性</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{(idea.feasibility.marketPotential * 100).toFixed(0)}%</div>
                    <div className="text-xs text-purple-900">市場ポテンシャル</div>
                  </div>
                </div>
              </div>
            </div>


            {/* AI検証結果 */}
            {idea.verification && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4">AI検証結果</h3>
                
                {/* 検証メタデータ */}
                <div className="mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {idea.verification.metadata.verificationLevel}
                      </div>
                      <div className="text-xs text-purple-700">検証レベル</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {(idea.verification.metadata.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-purple-700">信頼度</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        {idea.verification.metadata.totalTokens.toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-700">トークン数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        ${idea.verification.metadata.totalCost.toFixed(4)}
                      </div>
                      <div className="text-xs text-purple-700">検証コスト</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-purple-800">
                    <p><strong>使用モデル:</strong> {idea.verification.metadata.model}</p>
                    <p><strong>バージョン:</strong> {idea.verification.metadata.version}</p>
                  </div>
                </div>

                {/* 総合評価 */}
                {idea.verification.overallAssessment && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-300 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-4">総合評価</h4>
                    
                    {idea.verification.overallAssessment.overallScore && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-xl font-bold text-blue-600">
                            {idea.verification.overallAssessment.overallScore.viabilityScore || 'N/A'}
                          </div>
                          <div className="text-xs text-blue-700">実行可能性</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            {idea.verification.overallAssessment.overallScore.innovationScore || 'N/A'}
                          </div>
                          <div className="text-xs text-green-700">革新性</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-xl font-bold text-purple-600">
                            {idea.verification.overallAssessment.overallScore.marketPotentialScore || 'N/A'}
                          </div>
                          <div className="text-xs text-purple-700">市場ポテンシャル</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-xl font-bold text-red-600">
                            {idea.verification.overallAssessment.overallScore.riskScore || 'N/A'}
                          </div>
                          <div className="text-xs text-red-700">リスクスコア</div>
                        </div>
                      </div>
                    )}

                    {idea.verification.overallAssessment.recommendation && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">推奨判定</h5>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                          idea.verification.overallAssessment.recommendation.decision === 'GO' 
                            ? 'bg-green-100 text-green-800'
                            : idea.verification.overallAssessment.recommendation.decision === 'NO-GO'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {idea.verification.overallAssessment.recommendation.decision}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>判断理由:</strong> {idea.verification.overallAssessment.recommendation.reasoning}
                        </p>
                        {idea.verification.overallAssessment.recommendation.conditions && idea.verification.overallAssessment.recommendation.conditions.length > 0 && (
                          <div className="text-sm text-gray-700">
                            <strong>条件:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {idea.verification.overallAssessment.recommendation.conditions.map((condition: string, i: number) => (
                                <li key={i}>{condition}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {idea.verification.overallAssessment.strengthsAndWeaknesses && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <h5 className="font-semibold text-green-900 mb-2">主要な強み</h5>
                          <ul className="text-sm text-green-800 space-y-1">
                            {idea.verification.overallAssessment.strengthsAndWeaknesses.keyStrengths?.map((strength: string, i: number) => (
                              <li key={i} className="flex items-start">
                                <span className="text-green-600 mr-2">✓</span>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <h5 className="font-semibold text-red-900 mb-2">重要な弱み</h5>
                          <ul className="text-sm text-red-800 space-y-1">
                            {idea.verification.overallAssessment.strengthsAndWeaknesses.criticalWeaknesses?.map((weakness: string, i: number) => (
                              <li key={i} className="flex items-start">
                                <span className="text-red-600 mr-2">⚠</span>
                                {weakness}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 業界専門分析 */}
                {idea.verification.industryAnalysis && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-4">業界専門分析</h4>
                    
                    {idea.verification.industryAnalysis.problemValidation && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">課題検証</h5>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>現実性チェック:</strong> {idea.verification.industryAnalysis.problemValidation.realityCheck}</p>
                            <p><strong>ステークホルダー影響:</strong> {idea.verification.industryAnalysis.problemValidation.stakeholderImpact}</p>
                          </div>
                          <div>
                            <p><strong>緊急度:</strong> {idea.verification.industryAnalysis.problemValidation.urgencyLevel}/10</p>
                            <p><strong>根拠:</strong> {idea.verification.industryAnalysis.problemValidation.evidence}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {idea.verification.industryAnalysis.solutionAssessment && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">ソリューション評価</h5>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>革新性レベル:</strong> {idea.verification.industryAnalysis.solutionAssessment.innovationLevel}/10</p>
                            <p><strong>実現可能性:</strong> {idea.verification.industryAnalysis.solutionAssessment.feasibilityCheck}</p>
                          </div>
                          <div>
                            {idea.verification.industryAnalysis.solutionAssessment.adoptionBarriers && (
                              <div>
                                <p><strong>導入障壁:</strong></p>
                                <ul className="list-disc list-inside ml-2">
                                  {idea.verification.industryAnalysis.solutionAssessment.adoptionBarriers.map((barrier: string, i: number) => (
                                    <li key={i}>{barrier}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {idea.verification.industryAnalysis.industryTrends && (
                      <div className="p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">業界トレンド</h5>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p><strong>現状:</strong> {idea.verification.industryAnalysis.industryTrends.currentState}</p>
                          <p><strong>規制環境:</strong> {idea.verification.industryAnalysis.industryTrends.regulatoryEnvironment}</p>
                          <p><strong>市場規模:</strong> {idea.verification.industryAnalysis.industryTrends.marketSize}</p>
                          {idea.verification.industryAnalysis.industryTrends.emergingTrends && (
                            <div>
                              <p><strong>新興トレンド:</strong></p>
                              <ul className="list-disc list-inside ml-2">
                                {idea.verification.industryAnalysis.industryTrends.emergingTrends.map((trend: string, i: number) => (
                                  <li key={i}>{trend}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ビジネスモデル検証 */}
                {idea.verification.businessModelValidation && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-4">ビジネスモデル検証</h4>
                    
                    {idea.verification.businessModelValidation.revenueModelValidation && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">収益モデル検証</h5>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p><strong>実行可能性:</strong> {idea.verification.businessModelValidation.revenueModelValidation.viability}/10</p>
                          <p><strong>支払者分析:</strong> {idea.verification.businessModelValidation.revenueModelValidation.payerAnalysis}</p>
                          <p><strong>価格持続性:</strong> {idea.verification.businessModelValidation.revenueModelValidation.pricingSustainability}</p>
                        </div>
                      </div>
                    )}

                    {idea.verification.businessModelValidation.valuePropositionTest && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">価値提案テスト</h5>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p><strong>独自性スコア:</strong> {idea.verification.businessModelValidation.valuePropositionTest.uniquenessScore}/10</p>
                          <p><strong>顧客ジョブ適合:</strong> {idea.verification.businessModelValidation.valuePropositionTest.customerJobsFit}</p>
                          <p><strong>ペインリリーバー効果:</strong> {idea.verification.businessModelValidation.valuePropositionTest.painRelieverEffectiveness}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 競合分析 */}
                {idea.verification.competitiveAnalysis && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-4">競合分析</h4>
                    
                    {idea.verification.competitiveAnalysis.directCompetitors && idea.verification.competitiveAnalysis.directCompetitors.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">直接競合</h5>
                        <div className="space-y-3">
                          {idea.verification.competitiveAnalysis.directCompetitors.map((competitor: any, i: number) => (
                            <div key={i} className="border border-gray-200 rounded p-3">
                              <h6 className="font-medium text-gray-900">{competitor.name}</h6>
                              <p className="text-sm text-gray-600 mb-2">{competitor.description}</p>
                              <div className="grid md:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <strong>強み:</strong> {competitor.strengths?.join(', ')}
                                </div>
                                <div>
                                  <strong>弱み:</strong> {competitor.weaknesses?.join(', ')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {idea.verification.competitiveAnalysis.competitiveAdvantageAnalysis && (
                      <div className="p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">競合優位性分析</h5>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p><strong>持続可能性スコア:</strong> {idea.verification.competitiveAnalysis.competitiveAdvantageAnalysis.sustainabilityScore}/10</p>
                          <p><strong>参入障壁:</strong> {idea.verification.competitiveAnalysis.competitiveAdvantageAnalysis.moatStrength}</p>
                          <p><strong>現実性評価:</strong> {idea.verification.competitiveAnalysis.competitiveAdvantageAnalysis.realityCheck}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 改善提案 */}
                {idea.verification.improvementSuggestions && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-900 mb-4">改善提案</h4>
                    
                    {idea.verification.improvementSuggestions.criticalIssues && idea.verification.improvementSuggestions.criticalIssues.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">重要な課題</h5>
                        <div className="space-y-2">
                          {idea.verification.improvementSuggestions.criticalIssues.map((issue: any, i: number) => (
                            <div key={i} className="border-l-4 border-red-400 pl-3 py-2 bg-red-50">
                              <p className="font-medium text-red-900">{issue.issue}</p>
                              <div className="text-sm text-red-700">
                                <span>影響度: {issue.impact}/10 | </span>
                                <span>緊急度: {issue.urgency}/10</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {idea.verification.improvementSuggestions.improvementRecommendations && idea.verification.improvementSuggestions.improvementRecommendations.length > 0 && (
                      <div className="mb-4 p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">改善推奨事項</h5>
                        <div className="space-y-3">
                          {idea.verification.improvementSuggestions.improvementRecommendations.map((rec: any, i: number) => (
                            <div key={i} className="border border-gray-200 rounded p-3">
                              <h6 className="font-medium text-gray-900 mb-1">{rec.area}</h6>
                              <p className="text-sm text-gray-600 mb-2"><strong>現状:</strong> {rec.currentState}</p>
                              <p className="text-sm text-gray-600 mb-2"><strong>推奨変更:</strong> {rec.recommendedChange}</p>
                              <p className="text-sm text-gray-600 mb-2"><strong>期待効果:</strong> {rec.expectedImpact}</p>
                              <div className="text-xs text-gray-500">
                                <span>実装難易度: {rec.implementationDifficulty}/10 | </span>
                                <span>タイムライン: {rec.timeline}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {idea.verification.improvementSuggestions.actionPlan && (
                      <div className="p-3 bg-white rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-2">アクションプラン</h5>
                        <div className="text-sm text-gray-700 space-y-3">
                          {idea.verification.improvementSuggestions.actionPlan.immediateActions && (
                            <div>
                              <p className="font-medium">即座に実行すべき行動:</p>
                              <ul className="list-disc list-inside ml-2">
                                {idea.verification.improvementSuggestions.actionPlan.immediateActions.map((action: string, i: number) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {idea.verification.improvementSuggestions.actionPlan.shortTermGoals && (
                            <div>
                              <p className="font-medium">短期目標:</p>
                              <ul className="list-disc list-inside ml-2">
                                {idea.verification.improvementSuggestions.actionPlan.shortTermGoals.map((goal: string, i: number) => (
                                  <li key={i}>{goal}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {idea.verification.improvementSuggestions.actionPlan.longTermVision && (
                            <div>
                              <p className="font-medium">長期ビジョン:</p>
                              <p className="ml-2">{idea.verification.improvementSuggestions.actionPlan.longTermVision}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 生成メタデータ */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">生成情報</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                <div>
                  <span className="font-medium">モデル:</span> {idea.generationMetadata.model}
                </div>
                <div>
                  <span className="font-medium">トークン:</span> {idea.generationMetadata.tokensUsed.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">コスト:</span> ${idea.generationMetadata.estimatedCost.toFixed(4)}
                </div>
                <div>
                  <span className="font-medium">信頼度:</span> {(idea.generationMetadata.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
            <button
              onClick={() => handleToggleStar(idea.id)}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                idea.starred 
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Star className={`h-4 w-4 mr-2 ${idea.starred ? 'fill-current' : ''}`} />
              {idea.starred ? 'スター解除' : 'スター追加'}
            </button>
            <button
              onClick={handleCloseDetailModal}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  };

    
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Database className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">保存済みアイデア</h3>
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
              {savedIdeas.length}件
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadSavedIdeas}
              disabled={isLoadingIdeas}
              className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingIdeas ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button
              onClick={handleExportToExcel}
              disabled={savedIdeas.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              title="美しいリーンキャンバスレイアウトでExcel出力"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel出力
            </button>
            <select
              value={ideaFilter}
              onChange={(e) => setIdeaFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              <option value="verified">検証済み</option>
              <option value="draft">下書き</option>
              <option value="starred">スター付き</option>
            </select>
          </div>
        </div>

        {isLoadingIdeas ? (
          <div className="text-center py-8">
            <LoadingSpinner size="md" className="mx-auto mb-4" />
            <p className="text-gray-600">アイデアを読み込み中...</p>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {ideaFilter === 'all' ? '保存済みアイデアはありません' : 
               ideaFilter === 'verified' ? '検証済みアイデアはありません' :
               ideaFilter === 'draft' ? '下書きアイデアはありません' :
               'スター付きアイデアはありません'}
            </p>
            <p className="text-sm">新しいアイデアを生成して保存してください</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIdeas.map((idea) => (
              <div key={idea.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 mr-3">{idea.title}</h4>
                      <div className="flex items-center space-x-2">
                        {idea.starred && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          idea.status === 'verified' ? 'bg-green-100 text-green-700' :
                          idea.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {idea.status === 'verified' ? '検証済み' :
                           idea.status === 'draft' ? '下書き' : 'アーカイブ'}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm mb-2 line-clamp-2">{idea.description}</p>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span className="flex items-center">
                        <Building2 className="h-3 w-3 mr-1" />
                        {idea.companyName}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(idea.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                      {idea.verification && (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          信頼度 {(idea.verification.metadata.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleToggleStar(idea.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        idea.starred 
                          ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title={idea.starred ? 'スターを外す' : 'スターを付ける'}
                    >
                      <Star className={`h-4 w-4 ${idea.starred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleViewIdeaDetail(idea)}
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      title="詳細を表示"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteIdea(idea.id)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* 実現可能性スコア表示 */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-xs text-gray-600">MVV適合</div>
                    <div className="text-sm font-medium text-blue-600">
                      {(idea.feasibility.mvvAlignment * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">実装容易</div>
                    <div className="text-sm font-medium text-green-600">
                      {(idea.feasibility.implementationScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">市場性</div>
                    <div className="text-sm font-medium text-purple-600">
                      {(idea.feasibility.marketPotential * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCompanySelection = () => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center mb-4">
        <Building2 className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">企業選択</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分析対象企業
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">企業を選択してください</option>
            {companies
              .filter(c => c.status === 'mvv_extracted' || c.status === 'fully_completed')
              .map(company => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.category})
              </option>
            ))}
          </select>
        </div>

        {selectedCompany && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-900 mb-2">{selectedCompany.name}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>業界:</strong> {selectedCompany.category}</p>
              {selectedCompany.mission && (
                <p><strong>ミッション:</strong> {selectedCompany.mission.substring(0, 100)}...</p>
              )}
              {selectedCompany.vision && (
                <p><strong>ビジョン:</strong> {selectedCompany.vision.substring(0, 100)}...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalysisParams = () => (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center mb-4">
        <Settings className="h-5 w-5 text-green-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">分析パラメータ</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            重点領域 (複数選択可)
          </label>
          <div className="space-y-2">
            {focusAreaOptions.map(area => (
              <label key={area} className="flex items-center">
                <input
                  type="checkbox"
                  checked={analysisParams.focusAreas.includes(area)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAnalysisParams(prev => ({
                        ...prev,
                        focusAreas: [...prev.focusAreas, area]
                      }));
                    } else {
                      setAnalysisParams(prev => ({
                        ...prev,
                        focusAreas: prev.focusAreas.filter(a => a !== area)
                      }));
                    }
                  }}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{area}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              想定ビジネスモデル
            </label>
            <select
              value={analysisParams.businessModel}
              onChange={(e) => setAnalysisParams(prev => ({
                ...prev,
                businessModel: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {businessModelOptions.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ターゲット市場
            </label>
            <input
              type="text"
              value={analysisParams.targetMarket}
              onChange={(e) => setAnalysisParams(prev => ({
                ...prev,
                targetMarket: e.target.value
              }))}
              placeholder="例: 中小企業、個人消費者、医療機関"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成するアイデア数
            </label>
            <select
              value={maxIdeas}
              onChange={(e) => setMaxIdeas(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1案（深い分析・推奨）</option>
              <option value={2}>2案（比較検討用）</option>
              <option value={3}>3案（幅広いオプション）</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              ※ 1案では最も深い業界分析を行います
            </p>
          </div>
        </div>
      </div>
    </div>
  );

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

  const renderGenerateButton = () => (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">AI powered ビジネス革新</h3>
          <p className="text-sm text-gray-600">
            企業のMVVと業界分析に基づく{maxIdeas === 1 ? '深い洞察' : '複数のアイデア'}を生成
          </p>
        </div>
        
        <button
          onClick={handleGenerateIdeas}
          disabled={!selectedCompany || isGenerating}
          className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              AI分析実行中...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              革新的アイデア生成
            </>
          )}
        </button>
      </div>
      
      {isGenerating && (
        <div className="space-y-4">
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
                  <h5 className="font-medium text-gray-900 mb-4">リーンキャンバス（9ブロック）</h5>
                  <div className="grid grid-cols-10 grid-rows-3 gap-1 border border-gray-300 rounded-lg overflow-hidden text-xs min-h-[400px]">
                    
                    {/* ②課題 - 1-2列目・1-2行目 */}
                    <div className="col-span-2 row-span-2 bg-slate-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-slate-800 mb-2">②課題</div>
                      <div className="text-slate-700 space-y-2">
                        {idea.leanCanvas.problem.map((p, i) => (
                          <div key={i} className="border-l-2 border-slate-300 pl-2 text-xs">{p}</div>
                        ))}
                        <div className="mt-3 pt-2 border-t border-slate-200">
                          <div className="font-semibold text-slate-900 mb-1 text-xs">既存の代替品</div>
                          <div className="text-slate-700 text-xs">
                            {idea.leanCanvas.existingAlternatives || "現在顧客がこの課題をどう解決しているか"}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* ④ソリューション - 3-4列目・1行目 */}
                    <div className="col-span-2 bg-blue-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-blue-800 mb-2">④ソリューション</div>
                      <div className="text-blue-700 text-xs">{idea.leanCanvas.solution}</div>
                    </div>
                    
                    {/* ③独自の価値提案 - 5-6列目・1-2行目 */}
                    <div className="col-span-2 row-span-2 bg-amber-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-amber-800 mb-2">③独自の価値提案</div>
                      <div className="text-amber-700 font-medium text-xs">{idea.leanCanvas.valueProposition}</div>
                    </div>
                    
                    {/* ⑨圧倒的な優位性 - 7-8列目・1行目 */}
                    <div className="col-span-2 bg-indigo-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-indigo-800 mb-2">⑨圧倒的な優位性</div>
                      <div className="text-indigo-700 text-xs">{idea.leanCanvas.unfairAdvantage}</div>
                    </div>
                    
                    {/* ①顧客セグメント - 9-10列目・1-2行目 */}
                    <div className="col-span-2 row-span-2 bg-emerald-50 border-b border-gray-300 p-3">
                      <div className="font-semibold text-emerald-800 mb-2">①顧客セグメント</div>
                      <div className="text-emerald-700 space-y-1">
                        {idea.leanCanvas.targetCustomers.map((customer, i) => (
                          <div key={i} className="bg-emerald-100 px-2 py-1 rounded text-xs">{customer}</div>
                        ))}
                        <div className="mt-3 pt-2 border-t border-emerald-200">
                          <div className="font-semibold text-emerald-900 mb-1 text-xs">アーリーアダプター</div>
                          <div className="text-emerald-700 text-xs">
                            {idea.leanCanvas.earlyAdopters || "誰が一番初めに顧客となってくれるか"}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* ⑦主要指標 - 3-4列目・2行目 */}
                    <div className="col-span-2 bg-teal-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-teal-800 mb-2">⑦主要指標</div>
                      <div className="text-teal-700 space-y-1">
                        {idea.leanCanvas.keyMetrics?.map((metric, i) => (
                          <div key={i} className="bg-teal-100 px-1 py-1 rounded text-xs">{metric}</div>
                        )) || <div className="text-gray-500 text-xs">設定が必要</div>}
                      </div>
                    </div>
                    
                    {/* ⑤チャネル - 7-8列目・2行目 */}
                    <div className="col-span-2 bg-violet-50 border-r border-b border-gray-300 p-3">
                      <div className="font-semibold text-violet-800 mb-2">⑤チャネル</div>
                      <div className="text-violet-700 space-y-1">
                        {idea.leanCanvas.channels?.map((channel, i) => (
                          <div key={i} className="bg-violet-100 px-1 py-1 rounded text-xs">{channel}</div>
                        )) || <div className="text-gray-500 text-xs">検討が必要</div>}
                      </div>
                    </div>
                    
                    {/* ⑧コスト構造 - 1-5列目・3行目（完全に半分） */}
                    <div className="col-span-5 bg-rose-50 border-r border-gray-300 p-3">
                      <div className="font-semibold text-rose-800 mb-2">⑧コスト構造</div>
                      <div className="text-rose-700 space-y-1">
                        {idea.leanCanvas.costStructure?.map((cost, i) => (
                          <div key={i} className="border-l-2 border-rose-300 pl-2 text-xs">{cost}</div>
                        )) || <div className="text-gray-500 text-xs">分析が必要</div>}
                      </div>
                    </div>
                    
                    {/* ⑥収益の流れ - 6-10列目・3行目（完全に半分） */}
                    <div className="col-span-5 bg-green-50 p-3">
                      <div className="font-semibold text-green-800 mb-2 flex items-center">
                        <span className="mr-1">💰</span>
                        ⑥収益の流れ（支払者明記）
                      </div>
                      <div className="text-green-700 space-y-1">
                        {idea.leanCanvas.revenueStreams.map((revenue, i) => (
                          <div key={i} className="bg-green-100 px-2 py-1 rounded text-xs font-medium border border-green-200">
                            {revenue}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                  </div>
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
              <span className="text-sm font-medium">保存済み ({savedIdeas.length})</span>
            </button>
            
            {savedIdeas.length > 0 && (
              <button
                onClick={() => setShowExportWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200 shadow-sm border border-green-200"
                title="Excel形式で出力"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm font-medium">Excel出力</span>
              </button>
            )}
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
          {renderCompanySelection()}
          {renderAnalysisParams()}
          {renderGenerateButton()}
          {renderResults()}
        </>
      )}

      {/* アイデア管理画面 */}

      {/* アイデア詳細モーダル */}
      {renderIdeaDetailModal()}

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
    </div>
  );
};