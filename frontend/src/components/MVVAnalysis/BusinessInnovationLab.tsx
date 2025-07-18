import React, { useState, useEffect, useRef } from 'react';
import { useCompanyStore } from '../../stores/companyStore';
import { 
  Lightbulb, 
  Zap, 
  Save, 
  AlertCircle,
  CheckCircle,
  Database,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { ideaStorageService, type StoredBusinessIdea } from '../../services/ideaStorage';
import { apiLoggerService } from '../../services/apiLogger';
import { IdeaExportWizard } from './IdeaExportWizard';
import { SavedIdeasPanel } from './SavedIdeasPanel';
import { IdeaDetailModal } from './IdeaDetailModal';
import { LeanCanvas } from './LeanCanvas';
import { IdeaGenerationDialog } from './IdeaGenerationDialog';
import { useAsyncTask } from '../../hooks/useAsyncTask';
import { AsyncTaskProgress } from '../common/AsyncTaskProgress';
import type { AsyncTaskCreateRequest } from '../../types/asyncTask';

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

// 星評価表示のヘルパー関数
const renderStarRating = (score: number | string, maxScore: number = 10): string => {
  const numScore = typeof score === 'string' ? parseInt(score) : score;
  if (isNaN(numScore) || numScore < 0) return '☆☆☆☆☆';
  
  // 10段階を5つ星に変換
  const starScore = Math.round((numScore / maxScore) * 5);
  const filledStars = Math.min(starScore, 5);
  const emptyStars = 5 - filledStars;
  
  return '★'.repeat(filledStars) + '☆'.repeat(emptyStars);
};

export const BusinessInnovationLab: React.FC = () => {
  const { companies, loadCompanies } = useCompanyStore();
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
  
  // 進捗表示への参照
  const progressRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // 通知状態
  const [showVerificationStarted, setShowVerificationStarted] = useState(false);
  
  // Beta v2: AI検証機能のstate (Phase ε.1.5: 非同期対応)
  const [verificationResults, setVerificationResults] = useState<{[ideaId: string]: VerificationResult}>({});
  const [selectedIdeaForVerification, setSelectedIdeaForVerification] = useState<string | null>(null);
  const [verificationLevel, setVerificationLevel] = useState<'basic' | 'comprehensive' | 'expert'>('basic');
  
  // 非同期タスク管理（検証用）
  const verificationTask = useAsyncTask(undefined, {
    onComplete: async (result: VerificationResult) => {
      console.log('🎉 Async verification completed:', result);
      
      // Defensive check for undefined result
      if (!result) {
        console.error('❌ Verification result is undefined');
        return;
      }
      
      // Comprehensive検証結果の詳細構造をデバッグ
      if (result.metadata?.verificationLevel === 'comprehensive') {
        console.log('📊 Comprehensive検証結果詳細構造:', {
          verificationLevel: result.metadata.verificationLevel,
          hasMarketValidation: !!result.marketValidation,
          marketValidationKeys: result.marketValidation ? Object.keys(result.marketValidation) : 'null',
          industryAnalysisStructure: {
            hasData: !!result.industryAnalysis,
            keys: result.industryAnalysis ? Object.keys(result.industryAnalysis) : [],
            solutionAssessment: result.industryAnalysis?.solutionAssessment,
            problemValidation: result.industryAnalysis?.problemValidation
          },
          competitiveAnalysisStructure: {
            hasData: !!result.competitiveAnalysis,
            keys: result.competitiveAnalysis ? Object.keys(result.competitiveAnalysis) : [],
            directCompetitors: result.competitiveAnalysis?.directCompetitors,
            competitiveAdvantageAnalysis: result.competitiveAnalysis?.competitiveAdvantageAnalysis
          },
          overallAssessmentStructure: {
            hasData: !!result.overallAssessment,
            keys: result.overallAssessment ? Object.keys(result.overallAssessment) : [],
            overallScore: result.overallAssessment?.overallScore,
            recommendation: result.overallAssessment?.recommendation
          }
        });
      }
      
      if (selectedIdeaForVerification !== null) {
        setVerificationResults(prev => {
          const newResults = {
            ...prev,
            [selectedIdeaForVerification]: result
          };
          
          return newResults;
        });
        
        // 自動保存機能: 検証結果を既存アイデアに保存
        const currentIdea = savedIdeas.find(idea => idea.id === selectedIdeaForVerification);
        console.log('🔍 Auto-save debug info:', {
          selectedIdeaForVerification,
          hasCurrentIdea: !!currentIdea,
          currentIdeaId: currentIdea?.id,
          savedIdeasCount: savedIdeas.length,
          verificationLevel: result.metadata?.verificationLevel,
          resultDataSize: JSON.stringify(result).length,
          resultKeys: Object.keys(result),
          metadataKeys: result.metadata ? Object.keys(result.metadata) : []
        });
        
        if (currentIdea) {
          try {
            const startTime = Date.now();
            const verificationData = {
              industryAnalysis: result.industryAnalysis,
              marketValidation: result.marketValidation,
              businessModelValidation: result.businessModelValidation,
              competitiveAnalysis: result.competitiveAnalysis,
              improvementSuggestions: result.improvementSuggestions,
              overallAssessment: result.overallAssessment,
              metadata: {
                ...result.metadata,
                verifiedAt: Date.now()
              }
            };
            
            console.log('💾 Starting auto-save with data:', {
              verificationDataSize: JSON.stringify(verificationData).length,
              verificationLevel: verificationData.metadata?.verificationLevel,
              ideaId: currentIdea.id,
              timestamp: new Date().toISOString()
            });
            
            await ideaStorageService.updateIdeaWithVerification(currentIdea.id, verificationData);
            const saveTime = Date.now() - startTime;
            
            console.log('✅ Verification result auto-saved successfully:', {
              ideaId: currentIdea.id,
              verificationLevel: verificationData.metadata?.verificationLevel,
              saveTimeMs: saveTime,
              dataSize: JSON.stringify(verificationData).length
            });
            
            // 保存されたアイデアリストを更新
            await loadSavedIdeas();
          } catch (saveError) {
            console.error('❌ Failed to auto-save verification result:', {
              error: saveError,
              errorMessage: saveError instanceof Error ? saveError.message : String(saveError),
              errorStack: saveError instanceof Error ? saveError.stack : undefined,
              ideaId: currentIdea.id,
              verificationLevel: result.metadata?.verificationLevel,
              timestamp: new Date().toISOString()
            });
            // 自動保存の失敗はユーザーに通知しない（サイレント失敗）
          }
        } else {
          console.warn('⚠️ Cannot auto-save: currentIdea is null', {
            selectedIdeaForVerification,
            savedIdeasCount: savedIdeas.length,
            verificationLevel: result.metadata?.verificationLevel
          });
        }
        
        // UIの更新後にselectedIdeaForVerificationをリセット
        setTimeout(() => {
          setSelectedIdeaForVerification(null);
        }, 500); // 少し長めに変更
      } else {
        console.warn('⚠️ selectedIdeaForVerification is null, cannot store result');
        setSelectedIdeaForVerification(null);
      }
    },
    onError: (error: Error) => {
      console.error('❌ Async verification failed:', error);
      setError(`検証エラー: ${error.message}`);
      setSelectedIdeaForVerification(null);
    },
    enablePersistence: true
  });

  
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
      const endpoint = `${API_BASE_URL}/generate-business-ideas`;
      const requestBody = {
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
      };
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': import.meta.env.VITE_API_SECRET,
      };

      // Phase δ.2: APIリクエストログ開始
      const logId = await apiLoggerService.logRequest(
        'generate-business-ideas',
        'POST',
        endpoint,
        headers,
        requestBody,
        {
          companyId: company.id,
          operationType: 'generate-ideas'
        }
      );

      const requestStart = Date.now();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      let result: any;
      let responseError: Error | undefined;

      if (!response.ok) {
        try {
          const errorData = await response.json();
          responseError = new Error(errorData.error || `API error: ${response.status}`);
          
          // Phase δ.2: エラーレスポンスもログ
          await apiLoggerService.logResponse(
            logId,
            response.status,
            response.statusText,
            Object.fromEntries(response.headers),
            errorData,
            requestStart,
            responseError
          );
          
          throw responseError;
        } catch (parseError) {
          responseError = new Error(`API error: ${response.status} - ${response.statusText}`);
          
          await apiLoggerService.logResponse(
            logId,
            response.status,
            response.statusText,
            Object.fromEntries(response.headers),
            null,
            requestStart,
            responseError
          );
          
          throw responseError;
        }
      }

      result = await response.json();
      
      // Phase δ.2: 成功レスポンスをログ
      await apiLoggerService.logResponse(
        logId,
        response.status,
        response.statusText,
        Object.fromEntries(response.headers),
        result,
        requestStart
      );
      
      if (result.success) {
        setProgress(100);
        setResults(result.data);
        
        // Phase δ.1: 自動保存機能
        // アイデア生成が成功したら自動的に保存
        if (result.data.ideas && result.data.ideas.length > 0) {
          const savedIdeaIds: string[] = [];
          
          for (const idea of result.data.ideas) {
            try {
              const ideaId = `auto-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
              const storedIdea: StoredBusinessIdea = {
                ...idea,
                id: ideaId,
                companyId: company.id,
                companyName: company.name,
                companyCategory: company.category,
                analysisParams: params,
                generationMetadata: result.data.metadata,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isStarred: false,
                autoSaved: true, // 自動保存フラグ
                generationContext: {
                  timestamp: Date.now(),
                  apiVersion: result.data.metadata?.version || 'unknown',
                  modelUsed: result.data.metadata?.model || 'unknown',
                  cacheLevel: result.data.metadata?.cacheLevel,
                  apiLogId: logId // APIログとの紐づけ
                }
              };
              
              await ideaStorageService.saveIdea(storedIdea);
              savedIdeaIds.push(ideaId);
              console.log('Idea auto-saved:', ideaId);
            } catch (saveError) {
              console.error('Failed to auto-save idea:', saveError);
              // 自動保存の失敗はユーザーに通知しない（サイレント失敗）
            }
          }
          
          // Phase δ.2: APIログにアイデアIDを追加で記録
          if (savedIdeaIds.length > 0) {
            try {
              await apiLoggerService.updateLogWithIdeaIds(logId, savedIdeaIds);
            } catch (logUpdateError) {
              console.error('Failed to update API log with idea IDs:', logUpdateError);
            }
          }
          
          // 保存済みアイデアリストを更新
          await loadSavedIdeas();
        }
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
      // 企業データの存在確認
      const targetCompany = companies.find(c => c.id === idea.companyId);
      if (!targetCompany) {
        console.warn(`Company with ID ${idea.companyId} not found. Available companies:`, companies.map(c => ({id: c.id, name: c.name})));
        setError(`企業「${idea.companyName}」が見つかりません。企業データを確認してください。`);
        return;
      }

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
        setVerificationResults({ [idea.id]: idea.verification });
      } else {
        setVerificationResults({});
      }

      // 4. UI状態をリセット
      setError(null);
      setProgress(0);
      setSelectedIdeaForVerification(null);
      
      // 5. savedIdeas を再読み込みして同期
      await loadSavedIdeas();

      // 6. パネルを閉じる
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
  


  const handleSaveIdea = async (idea: BusinessIdea) => {
    if (!selectedCompany) {
      setError('企業情報が不正です');
      return;
    }

    try {
      const verification = getVerificationResult(idea);
      
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

  // ヘルパー関数: 生成されたアイデアに対応する保存済みアイデアのIDを取得
  const getCorrespondingIdeaId = (idea: BusinessIdea): string | null => {
    const correspondingIdea = savedIdeas.find(savedIdea => 
      savedIdea.title === idea.title && 
      savedIdea.description === idea.description
    );
    return correspondingIdea?.id || null;
  };

  // ヘルパー関数: 現在のアイデアが検証中かどうかを確認
  const isIdeaBeingVerified = (idea: BusinessIdea): boolean => {
    const ideaId = getCorrespondingIdeaId(idea);
    return verificationTask.isRunning && selectedIdeaForVerification === ideaId;
  };

  // ヘルパー関数: 生成されたアイデアに対応する検証結果を取得
  const getVerificationResult = (idea: BusinessIdea): VerificationResult | undefined => {
    const ideaId = getCorrespondingIdeaId(idea);
    if (ideaId && verificationResults[ideaId]) {
      return verificationResults[ideaId];
    }
    
    // フォールバック: 復元されたアイデアの場合、アイデア自体に検証結果が含まれている可能性
    if (idea.verification) {
      return idea.verification;
    }
    
    // フォールバック: 単一復元アイデアの場合、インデックス"0"に保存されている可能性（レガシー対応）
    if (Object.keys(verificationResults).length === 1 && verificationResults["0"]) {
      return verificationResults["0"];
    }
    
    return undefined;
  };

  // Beta v2: AI検証機能 (Phase ε.1.5: 非同期対応)
  const handleVerifyIdea = async (idea: BusinessIdea, index: number) => {
    if (!selectedCompany) {
      setError('企業情報が必要です');
      return;
    }

    // 生成されたアイデアに対応する保存済みアイデアIDを取得
    const correspondingIdeaId = getCorrespondingIdeaId(idea);
    
    if (!correspondingIdeaId) {
      setError('対応する保存済みアイデアが見つかりません');
      return;
    }

    setSelectedIdeaForVerification(correspondingIdeaId);
    setError(null);

    try {
      console.log(`⏳ Starting async ${verificationLevel} verification for "${idea.title}"`);
      
      // 非同期タスクリクエストを作成
      // embeddingsデータを削除してリクエストサイズを軽量化
      const { embeddings, ...companyDataWithoutEmbeddings } = selectedCompany;
      
      const taskRequest: AsyncTaskCreateRequest = {
        type: 'verify-business-idea',
        inputData: {
          originalIdea: idea,
          companyData: companyDataWithoutEmbeddings,
          verificationLevel
        },
        config: {
          timeoutMs: 900000, // 15分タイムアウト
          pollIntervalMs: 5000, // 5秒間隔（サーバー負荷軽減）
          persistResult: true,
          autoCleanup: false
        },
        metadata: {
          companyId: selectedCompany.id,
          priority: 'normal',
          maxRetries: 2,
          currentRetry: 0,
          userId: 'current-user' // TODO: 実際のユーザーIDに置き換え
        }
      };
      
      // 非同期タスクを開始
      const startedTask = await verificationTask.startTask(taskRequest);
      
      console.log(`⏳ Async verification task started for "${idea.title}" (Task ID: ${startedTask?.id || 'unknown'})`);
      
      // 開始通知を表示
      setShowVerificationStarted(true);
      setTimeout(() => setShowVerificationStarted(false), 3000);
      
      // 進捗表示部分へ自動スクロール（少し遅延を入れて確実に表示後にスクロール）
      setTimeout(() => {
        const progressElement = progressRefs.current[index];
        if (progressElement) {
          progressElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300);
      
    } catch (error) {
      console.error('Failed to start async verification:', error);
      setError(error instanceof Error ? error.message : '検証の開始に失敗しました');
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
                    {/* Beta v2: AI検証ボタン (Phase ε.1.5: 非同期対応) */}
                    <div className="flex items-center space-x-2">
                      {/* 検証レベル選択 */}
                      <select
                        value={verificationLevel}
                        onChange={(e) => setVerificationLevel(e.target.value as 'basic' | 'comprehensive' | 'expert')}
                        disabled={isIdeaBeingVerified(idea)}
                        className="text-xs bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border border-purple-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="basic">🚀 Basic</option>
                        <option value="comprehensive">🎯 Comprehensive</option>
                        <option value="expert">🔬 Expert</option>
                      </select>
                      
                      {/* 検証ボタン */}
                      <button
                        onClick={() => handleVerifyIdea(idea, index)}
                        disabled={isIdeaBeingVerified(idea)}
                        className="flex items-center px-4 py-2 text-sm bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-lg hover:from-purple-200 hover:to-purple-300 hover:text-purple-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isIdeaBeingVerified(idea) ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : getVerificationResult(idea) ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        ) : verificationTask.isFailed && selectedIdeaForVerification === getCorrespondingIdeaId(idea) ? (
                          <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        <span className="text-xs">β</span>
                        {isIdeaBeingVerified(idea) ? '検証中' : '検証'}
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleSaveIdea(idea)}
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

                {/* Beta v2: 非同期検証進捗表示 (Phase ε.1.5) */}
                {isIdeaBeingVerified(idea) && (
                  <div 
                    ref={(el) => { progressRefs.current[index] = el; }}
                    className="mt-6 border-t border-gray-200 pt-6 scroll-mt-4 animate-in slide-in-from-bottom-4 duration-500"
                  >
                    {/* 注目を引くヘッダー */}
                    <div className="mb-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-4 border-l-4 border-purple-500">
                      <h6 className="font-semibold text-purple-900 mb-2 flex items-center">
                        <RefreshCw className="h-5 w-5 mr-2 text-purple-600 animate-spin" />
                        🤖 AI検証進行中 - {verificationLevel}レベル
                      </h6>
                      <p className="text-sm text-purple-700">
                        高度なAI分析により、アイデアの詳細検証を実行しています...
                      </p>
                    </div>
                    
                    <AsyncTaskProgress 
                      task={verificationTask.task}
                      showDetailedSteps={true}
                      showElapsedTime={true}
                      showEstimatedTime={true}
                      showControls={true}
                      onCancel={() => {
                        verificationTask.cancelTask();
                        setSelectedIdeaForVerification(null);
                      }}
                      onRetry={() => {
                        if (verificationTask.task) {
                          verificationTask.retryTask();
                        }
                      }}
                      className="bg-purple-50 border border-purple-200 shadow-lg"
                    />
                  </div>
                )}

                {/* Beta v2: AI検証結果表示 */}
                {(() => {
                  const verificationResult = getVerificationResult(idea);
                  return verificationResult && (
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
                          検証レベル: {verificationResult.metadata.verificationLevel}
                        </div>
                        <div className="text-xs text-gray-500">
                          信頼度: {(verificationResult.metadata.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {/* 総合評価 */}
                    {verificationResult.overallAssessment && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h6 className="font-semibold text-purple-900">検証1: 総合評価</h6>
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            verificationResult.overallAssessment.recommendation?.decision === 'GO' ? 'bg-green-100 text-green-800' :
                            verificationResult.overallAssessment.recommendation?.decision === 'CONDITIONAL-GO' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            推奨: {verificationResult.overallAssessment.recommendation?.decision || 'N/A'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-600">
                              {verificationResult.overallAssessment.overallScore?.viabilityScore || 'N/A'}
                            </div>
                            <div className="text-xs text-purple-700">実行可能性</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {verificationResult.overallAssessment.overallScore?.innovationScore || 'N/A'}
                            </div>
                            <div className="text-xs text-blue-700">革新性</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">
                              {verificationResult.overallAssessment.overallScore?.marketPotentialScore || 'N/A'}
                            </div>
                            <div className="text-xs text-green-700">市場ポテンシャル</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-orange-600">
                              {verificationResult.overallAssessment.overallScore?.totalScore || 'N/A'}
                            </div>
                            <div className="text-xs text-orange-700">総合スコア</div>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-purple-800">
                            {verificationResult.overallAssessment.recommendation?.reasoning || '詳細な理由は分析中です'}
                          </p>
                        </div>

                        {/* 業界専門分析・競合分析サマリー (総合評価内に統合) */}
                        {(verificationResult.industryAnalysis || verificationResult.competitiveAnalysis) && (
                          <div className="mt-4 grid md:grid-cols-2 gap-3">
                            {verificationResult.industryAnalysis && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="font-semibold text-blue-900 mb-2">業界専門分析</div>
                                <div className="text-sm text-blue-800 space-y-1">
                                  <div>
                                    <span className="font-medium">緊急度:</span> 
                                    {(() => {
                                      const urgency = verificationResult.industryAnalysis?.data?.problemValidation?.urgencyLevel || 
                                                     verificationResult.industryAnalysis?.problemValidation?.urgencyLevel;
                                      const urgencyScore = urgency || 'N/A';
                                      return urgencyScore === 'N/A' ? 'N/A' : `${renderStarRating(urgencyScore)} (${urgencyScore}/10)`;
                                    })()}
                                  </div>
                                  <div>
                                    <span className="font-medium">革新性:</span> 
                                    {(() => {
                                      const innovation = verificationResult.industryAnalysis?.data?.solutionAssessment?.innovationLevel || 
                                                        verificationResult.industryAnalysis?.solutionAssessment?.innovationLevel;
                                      const innovationScore = innovation || 'N/A';
                                      return innovationScore === 'N/A' ? 'N/A' : `${renderStarRating(innovationScore)} (${innovationScore}/10)`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                            {verificationResult.competitiveAnalysis && (
                              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="font-semibold text-green-900 mb-2">競合分析</div>
                                <div className="text-sm text-green-800 space-y-1">
                                  <div>
                                    <span className="font-medium">直接競合:</span> 
                                    {(() => {
                                      const competitors = verificationResult.competitiveAnalysis?.data?.directCompetitors || 
                                                         verificationResult.competitiveAnalysis?.directCompetitors;
                                      return Array.isArray(competitors) ? competitors.length : 0;
                                    })()}社
                                  </div>
                                  <div>
                                    <span className="font-medium">優位性持続:</span> 
                                    {(() => {
                                      const sustainability = verificationResult.competitiveAnalysis?.data?.competitiveAdvantageAnalysis?.sustainabilityScore || 
                                                            verificationResult.competitiveAnalysis?.competitiveAdvantageAnalysis?.sustainabilityScore;
                                      const sustainabilityScore = sustainability || 'N/A';
                                      return sustainabilityScore === 'N/A' ? 'N/A' : `${renderStarRating(sustainabilityScore)} (${sustainabilityScore}/10)`;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 市場検証結果 (Comprehensive/Expert レベル) */}
                    {verificationResult.marketValidation ? (
                      <div className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <h6 className="font-semibold text-cyan-900 mb-3">検証2: 市場検証結果</h6>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium text-cyan-800 mb-2">市場規模</div>
                            <div className="text-sm text-cyan-700 space-y-1">
                              <div>総市場: {verificationResult.marketValidation.marketSize?.totalMarket || '調査中'}</div>
                              <div>対象市場: {verificationResult.marketValidation.marketSize?.targetMarket || '調査中'}</div>
                              <div>成長率: {verificationResult.marketValidation.marketSize?.growthRate || 'N/A'}%</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-cyan-800 mb-2">顧客セグメント</div>
                            <div className="text-sm text-cyan-700 space-y-1">
                              <div>主要顧客: {verificationResult.marketValidation.customerSegmentation?.primarySegment || '分析中'}</div>
                              <div>支払意欲: {verificationResult.marketValidation.customerSegmentation?.willingness_to_pay || 'N/A'}/10</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      verificationResult.metadata?.verificationLevel === 'comprehensive' && (
                        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <h6 className="font-semibold text-amber-900 mb-3">🔄 検証2: 市場検証結果</h6>
                          <div className="text-sm text-amber-700">
                            <p>市場検証が現在実行されていません。競合分析からの市場洞察をご確認ください。</p>
                            <p className="text-xs mt-1">※次回のアップデートで市場検証機能が強化されます</p>
                          </div>
                        </div>
                      )
                    )}

                    {/* ビジネスモデル検証結果 */}
                    {verificationResult.businessModelValidation && (
                      <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h6 className="font-semibold text-purple-900 mb-3">検証3: ビジネスモデル検証</h6>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium text-purple-800 mb-2">収益モデル</div>
                            <div className="text-sm text-purple-700 space-y-1">
                              <div>実行可能性: {verificationResult.businessModelValidation.revenueModelValidation?.viability || 'N/A'}/10</div>
                              <div>価格持続性: {verificationResult.businessModelValidation.revenueModelValidation?.pricingSustainability || '分析中'}</div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-purple-800 mb-2">価値提案</div>
                            <div className="text-sm text-purple-700 space-y-1">
                              <div>独自性: {verificationResult.businessModelValidation.valuePropositionTest?.uniquenessScore || 'N/A'}/10</div>
                              <div>顧客適合: {verificationResult.businessModelValidation.valuePropositionTest?.customerJobsFit || '評価中'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 業界固有の詳細分析 */}
                    {verificationResult.industryAnalysis?.industrySpecificInsights && (
                      <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <h6 className="font-semibold text-indigo-900 mb-3">検証4: 業界固有の洞察</h6>
                        <div className="space-y-3">
                          {verificationResult.industryAnalysis.industrySpecificInsights.keyPlayersReaction && (
                            <div>
                              <div className="font-medium text-indigo-800 mb-1">主要プレイヤーの想定反応</div>
                              <div className="text-sm text-indigo-700">
                                {verificationResult.industryAnalysis.industrySpecificInsights.keyPlayersReaction}
                              </div>
                            </div>
                          )}
                          {verificationResult.industryAnalysis.industrySpecificInsights.valueChainImpact && (
                            <div>
                              <div className="font-medium text-indigo-800 mb-1">バリューチェーンへの影響</div>
                              <div className="text-sm text-indigo-700">
                                {verificationResult.industryAnalysis.industrySpecificInsights.valueChainImpact}
                              </div>
                            </div>
                          )}
                          {verificationResult.industryAnalysis.industrySpecificInsights.timing && (
                            <div>
                              <div className="font-medium text-indigo-800 mb-1">市場投入タイミング</div>
                              <div className="text-sm text-indigo-700">
                                {verificationResult.industryAnalysis.industrySpecificInsights.timing}
                              </div>
                            </div>
                          )}
                          {verificationResult.industryAnalysis.industrySpecificInsights.riskFactors && (
                            <div>
                              <div className="font-medium text-indigo-800 mb-1">リスク要因</div>
                              <div className="text-sm text-indigo-700 space-y-1">
                                {verificationResult.industryAnalysis.industrySpecificInsights.riskFactors.map((risk: string, riskIndex: number) => (
                                  <div key={riskIndex} className="flex items-start">
                                    <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full mt-1.5 mr-2"></span>
                                    <span>{risk}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 競合分析の詳細 */}
                    {verificationResult.competitiveAnalysis && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h6 className="font-semibold text-red-900 mb-3">検証5: 競合分析詳細</h6>
                        <div className="overflow-x-auto">
                          {verificationResult.competitiveAnalysis.directCompetitors?.length === 0 ? (
                            <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-center">
                              <p className="text-red-800 font-medium">直接競合は見つかりませんでした。</p>
                              <p className="text-red-700 text-sm mt-1">
                                このアイデアは革新的なソリューションの可能性があります。
                              </p>
                            </div>
                          ) : (
                            <div className="flex space-x-3 pb-2" style={{ minWidth: 'max-content' }}>
                              {verificationResult.competitiveAnalysis.directCompetitors?.map((competitor: any, compIndex: number) => (
                              <div key={compIndex} className="flex-shrink-0 w-80 p-3 bg-red-100 rounded border">
                                <div className="font-medium text-red-900 text-sm mb-2">
                                  {competitor.website ? (
                                    <a 
                                      href={competitor.website} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-red-900 hover:text-red-700 hover:underline transition-colors"
                                    >
                                      {competitor.name}
                                    </a>
                                  ) : (
                                    competitor.name
                                  )}
                                  {competitor.productName && (
                                    <span className="text-xs font-normal text-red-700 block">({competitor.productName})</span>
                                  )}
                                </div>
                                <div className="text-red-800 text-xs mb-2 line-clamp-3">{competitor.description}</div>
                                {competitor.website && (
                                  <div className="text-red-600 text-xs mb-1 truncate">
                                    <span className="font-medium">URL:</span> 
                                    <a 
                                      href={competitor.website} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="ml-1 text-red-600 hover:text-red-800 hover:underline transition-colors"
                                    >
                                      {competitor.website}
                                    </a>
                                  </div>
                                )}
                                {competitor.pricingModel && (
                                  <div className="text-red-700 text-xs mb-1">
                                    <span className="font-medium">価格:</span> {competitor.pricingModel}
                                  </div>
                                )}
                                <div className="text-red-700 text-xs mb-1">
                                  <span className="font-medium">強み:</span> {competitor.strengths?.slice(0, 2).join(', ') || 'N/A'}
                                </div>
                                <div className="text-red-700 text-xs">
                                  <span className="font-medium">弱み:</span> {competitor.weaknesses?.slice(0, 2).join(', ') || 'N/A'}
                                </div>
                              </div>
                            ))}
                            </div>
                          )}
                        </div>
                        {verificationResult.competitiveAnalysis.marketPositioning && (
                          <div className="mt-3">
                            <div className="font-medium text-red-800 mb-1">市場ポジショニング</div>
                            <div className="text-sm text-red-700">
                              {verificationResult.competitiveAnalysis.marketPositioning.differentiationStrategy || '戦略分析中'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 改善提案 */}
                    {verificationResult.improvementSuggestions && (
                      <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h6 className="font-semibold text-orange-900 mb-3">検証6: 改善提案</h6>
                        {verificationResult.improvementSuggestions.improvementRecommendations?.slice(0, 3).map((rec: any, recIndex: number) => (
                          <div key={recIndex} className="mb-3 p-3 bg-orange-100 rounded border">
                            <div className="font-medium text-orange-900 text-sm">改善提案 {recIndex + 1}: {rec.area}</div>
                            <div className="text-orange-800 text-xs mt-1">{rec.recommendedChange}</div>
                            <div className="text-orange-700 text-xs mt-1">期待効果: {rec.expectedImpact}</div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                  );
                })()}
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
              {savedIdeas.filter(idea => !!idea.verification).length > 0 && (
                <span className="ml-1 bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full" title="検証済みアイデア数">
                  ✓{savedIdeas.filter(idea => !!idea.verification).length}
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

      {/* 検証開始通知 */}
      {showVerificationStarted && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-semibold">🤖 AI検証を開始しました</p>
              <p className="text-sm opacity-90">詳細な分析を実行中...</p>
            </div>
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