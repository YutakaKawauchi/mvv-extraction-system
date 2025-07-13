import React, { useState, useEffect } from 'react';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner } from '../common';
import { 
  Lightbulb, 
  Building2, 
  Settings, 
  Zap, 
  Save, 
  AlertCircle,
  CheckCircle,
  Star
} from 'lucide-react';

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
  const [savedIdeas, setSavedIdeas] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [maxIdeas, setMaxIdeas] = useState(1); // デフォルト1案

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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

  const handleSaveIdea = (idea: BusinessIdea, index: number) => {
    const savedIdea = {
      ...idea,
      id: `${selectedCompanyId}-${Date.now()}-${index}`,
      companyId: selectedCompanyId,
      companyName: selectedCompany?.name,
      savedAt: new Date().toISOString(),
      analysisParams
    };

    setSavedIdeas(prev => [...prev, savedIdea]);
    
    // TODO: IndexedDBに保存
    console.log('Saving idea to IndexedDB:', savedIdea);
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
                  <button
                    onClick={() => handleSaveIdea(idea, index)}
                    className="flex items-center px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow-md ml-4"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </button>
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
                    <div className="mt-3 p-3 bg-orange-100 rounded-lg border border-orange-200">
                      <div className="text-sm font-semibold text-orange-900 mb-1">💰 支払者（Revenue Payer）</div>
                      <div className="text-sm text-orange-800">
                        {idea.leanCanvas.revenueStreams.join(' / ')}
                      </div>
                    </div>
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
        <div className="flex items-center mb-2">
          <Lightbulb className="h-6 w-6 mr-2" />
          <h2 className="text-2xl font-bold">ビジネス革新ラボ (α版)</h2>
        </div>
        <p className="text-blue-100">
          企業のMVVと事業プロファイルから、AI powered 新規事業アイデアを生成します
        </p>
        <div className="mt-4 flex items-center space-x-4 text-sm">
          <span className="bg-white bg-opacity-20 px-2 py-1 rounded">Phase α</span>
          <span>最大3案生成</span>
          <span>GPT-4o-mini使用</span>
          <span>基本保存機能</span>
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
      {renderCompanySelection()}
      {renderAnalysisParams()}
      {renderGenerateButton()}
      {renderResults()}

      {/* 保存済みアイデア */}
      {savedIdeas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Star className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">保存済みアイデア</h3>
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
              {savedIdeas.length}件
            </span>
          </div>
          <div className="text-center text-gray-600 py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>アイデア保存機能は Phase β で実装予定です</p>
          </div>
        </div>
      )}
    </div>
  );
};