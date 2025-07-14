/**
 * IdeaGenerationDialog - 統合アイデア生成ダイアログ
 * 企業選択 → パラメータ設定 → アイデア生成までを一つのダイアログで完結
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Settings, 
  Lightbulb, 
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useCompanyStore } from '../../stores/companyStore';
import { LoadingSpinner } from '../common';

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

interface IdeaGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (companyId: string, params: AnalysisParams) => Promise<void>;
  isGenerating: boolean;
}

const focusAreaOptions = [
  'デジタル変革・DX推進',
  '顧客体験・CX向上', 
  '業務効率化・オペレーション改善',
  '新市場開拓・事業領域拡大',
  'ESG・持続可能性',
  'データ活用・AI導入',
  '人材育成・組織変革',
  'パートナーシップ・アライアンス'
];

const businessModelOptions = [
  '',
  'B2B（企業向けサービス）',
  'B2C（消費者向けサービス）', 
  'B2B2C（企業経由で消費者向け）',
  'プラットフォーム・マーケットプレイス',
  'サブスクリプション・継続課金',
  'フリーミアム・階層型',
  'コンサルティング・専門サービス'
];

const targetMarketOptions = [
  '',
  '既存顧客の深掘り',
  '同業界の新規セグメント',
  '隣接業界への展開',
  '海外市場への進出',
  '全く新しい市場の創造'
];

const techOptions = [
  'AI・機械学習',
  'IoT・センサー技術',
  'ブロックチェーン',
  'AR・VR技術',
  'クラウド技術',
  'モバイルアプリ',
  'ビッグデータ解析',
  'ロボティクス',
  'API・システム連携',
  'セキュリティ技術'
];

const riskToleranceOptions = [
  { value: 'conservative', label: '保守的', description: '確実性を重視、リスクを最小限に' },
  { value: 'moderate', label: '中程度', description: 'バランスの取れたリスク・リターン' },
  { value: 'aggressive', label: '積極的', description: '高リスク・高リターンを志向' }
];

const revenueExpectationOptions = [
  { value: 'short-term', label: '短期収益重視', description: '1-2年での収益化を目指す' },
  { value: 'medium-term', label: '中期収益重視', description: '3-5年での本格収益化を目指す' },
  { value: 'long-term', label: '長期投資重視', description: '5年以上の長期的なリターンを重視' }
];

// プリセット定義
const presets = [
  {
    id: 'digital-transformation',
    name: 'DX推進・安全重視',
    description: 'デジタル変革を確実に実現したい企業向け',
    params: {
      focusAreas: ['デジタル変革・DX推進', '業務効率化・オペレーション改善'],
      businessModel: 'B2B（企業向けサービス）',
      targetMarket: '既存顧客の深掘り',
      constraints: {
        budget: '段階的投資',
        timeframe: '6-12ヶ月での段階実装',
        resources: '既存チーム活用'
      },
      techPreferences: {
        preferred: ['クラウド技術', 'API・システム連携', 'モバイルアプリ'],
        avoided: ['ブロックチェーン', 'AR・VR技術']
      },
      riskTolerance: 'conservative' as const,
      revenueExpectation: 'medium-term' as const
    }
  },
  {
    id: 'innovation-aggressive',
    name: 'イノベーション・積極投資',
    description: '革新的な新事業で市場をリードしたい企業向け',
    params: {
      focusAreas: ['新市場開拓・事業領域拡大', 'データ活用・AI導入'],
      businessModel: 'プラットフォーム・マーケットプレイス',
      targetMarket: '全く新しい市場の創造',
      constraints: {
        budget: '大規模投資',
        timeframe: '2-3年での市場投入',
        resources: '専門チーム新設'
      },
      techPreferences: {
        preferred: ['AI・機械学習', 'ビッグデータ解析', 'IoT・センサー技術'],
        avoided: []
      },
      riskTolerance: 'aggressive' as const,
      revenueExpectation: 'long-term' as const
    }
  },
  {
    id: 'customer-experience',
    name: '顧客体験・バランス型',
    description: '顧客満足度向上と安定した収益を両立したい企業向け',
    params: {
      focusAreas: ['顧客体験・CX向上', 'パートナーシップ・アライアンス'],
      businessModel: 'B2C（消費者向けサービス）',
      targetMarket: '同業界の新規セグメント',
      constraints: {
        budget: '中規模投資',
        timeframe: '1年での収益化開始',
        resources: 'パートナー連携活用'
      },
      techPreferences: {
        preferred: ['モバイルアプリ', 'クラウド技術'],
        avoided: ['ロボティクス']
      },
      riskTolerance: 'moderate' as const,
      revenueExpectation: 'short-term' as const
    }
  }
];

export const IdeaGenerationDialog: React.FC<IdeaGenerationDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isGenerating
}) => {
  const { companies } = useCompanyStore();
  const [currentStep, setCurrentStep] = useState(0);
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

  // ダイアログが開かれたときにリセット
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setSelectedCompanyId('');
      setAnalysisParams({
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    { id: 'company', title: '企業選択', icon: Building2 },
    { id: 'params', title: 'パラメータ設定', icon: Settings },
    { id: 'generate', title: 'アイデア生成', icon: Lightbulb }
  ];

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: return selectedCompanyId !== '';
      case 1: return analysisParams.focusAreas.length > 0 && analysisParams.businessModel !== '';
      case 2: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGenerate = async () => {
    if (selectedCompanyId && analysisParams) {
      await onGenerate(selectedCompanyId, analysisParams);
    }
  };

  const renderCompanySelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">分析対象企業を選択</h3>
        <p className="text-sm text-gray-600 mb-4">
          MVV情報が登録されている企業から選択してください
        </p>
      </div>
      
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
        {companies.filter(company => company.mission || company.vision || (company.values && company.values.length > 0)).map(company => (
          <label
            key={company.id}
            className={`flex items-center p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedCompanyId === company.id ? 'bg-blue-50 border-blue-200' : ''
            }`}
          >
            <input
              type="radio"
              name="company"
              value={company.id}
              checked={selectedCompanyId === company.id}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="mr-3 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{company.name}</div>
              <div className="text-sm text-gray-600">{company.category || '未分類'}</div>
              <div className="flex items-center mt-1 space-x-4 text-xs text-gray-500">
                {company.mission && <span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-500" />ミッション</span>}
                {company.vision && <span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-500" />ビジョン</span>}
                {company.values && company.values.length > 0 && <span className="flex items-center"><CheckCircle className="h-3 w-3 mr-1 text-green-500" />バリュー</span>}
              </div>
            </div>
          </label>
        ))}
      </div>
      
      {selectedCompany && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">選択された企業</h4>
          <div className="text-sm text-blue-800">
            <div className="font-medium">{selectedCompany.name}</div>
            <div>{selectedCompany.category || '未分類'}</div>
          </div>
        </div>
      )}
    </div>
  );

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setAnalysisParams(preset.params);
    }
  };

  const getBusinessModelHint = (businessModel: string): string => {
    const hints: { [key: string]: string } = {
      'B2B（企業向けサービス）': '企業の課題解決と長期パートナーシップが重要です。ROI・効率化・コスト削減に焦点を当てましょう。',
      'B2C（消費者向けサービス）': 'ユーザー体験と感情的価値が重要です。ブランディング・口コミ・リピート利用を重視しましょう。',
      'B2B2C（企業経由で消費者向け）': 'パートナー企業と最終消費者の両方にメリットを提供する仕組みが必要です。',
      'プラットフォーム・マーケットプレイス': 'ネットワーク効果の構築が成功のカギです。供給者と需要者の両方を獲得しましょう。',
      'サブスクリプション・継続課金': '顧客の継続的な価値実感とチャーン率の低下が重要です。段階的な価値提供を設計しましょう。',
      'フリーミアム・階層型': '無料ユーザーの価値体験と有料転換のタイミングが成功要因です。',
      'コンサルティング・専門サービス': '専門知識とブランドの信頼性が競争優位の源泉です。実績とケーススタディの蓄積が重要です。'
    };
    return hints[businessModel] || 'ビジネスモデルに最適化された戦略を検討しましょう。';
  };

  const getRecommendedTech = (businessModel: string): string[] => {
    const recommendations: { [key: string]: string[] } = {
      'B2B（企業向けサービス）': ['API・システム連携', 'クラウド技術', 'セキュリティ技術'],
      'B2C（消費者向けサービス）': ['モバイルアプリ', 'AI・機械学習', 'ビッグデータ解析'],
      'B2B2C（企業経由で消費者向け）': ['API・システム連携', 'モバイルアプリ', 'クラウド技術'],
      'プラットフォーム・マーケットプレイス': ['API・システム連携', 'ビッグデータ解析', 'AI・機械学習'],
      'サブスクリプション・継続課金': ['ビッグデータ解析', 'AI・機械学習', 'モバイルアプリ'],
      'フリーミアム・階層型': ['モバイルアプリ', 'クラウド技術', 'ビッグデータ解析'],
      'コンサルティング・専門サービス': ['AI・機械学習', 'ビッグデータ解析', 'セキュリティ技術']
    };
    return recommendations[businessModel] || ['クラウド技術', 'API・システム連携'];
  };

  const renderParameterSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">分析パラメータの設定</h3>
        <p className="text-sm text-gray-600 mb-6">
          プリセットから選択するか、カスタムでパラメータを設定してください
        </p>
      </div>

      {/* プリセット選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          プリセット選択（オプション）
        </label>
        <div className="grid grid-cols-1 gap-3">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-900">{preset.name}</div>
              <div className="text-sm text-gray-600 mt-1">{preset.description}</div>
              <div className="text-xs text-gray-500 mt-2">
                重点領域: {preset.params.focusAreas.slice(0, 2).join('、')}
                {preset.params.focusAreas.length > 2 ? '...' : ''}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-500">
          プリセットを選択すると下記の設定が自動入力されます。個別に調整も可能です。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 重点領域 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            重点領域 <span className="text-red-500">*</span> (複数選択可)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {focusAreaOptions.map(area => (
              <label key={area} className="flex items-center p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
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

        {/* ビジネスモデル */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            想定ビジネスモデル <span className="text-red-500">*</span>
          </label>
          <select
            value={analysisParams.businessModel}
            onChange={(e) => setAnalysisParams(prev => ({
              ...prev,
              businessModel: e.target.value
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">ビジネスモデルを選択してください</option>
            {businessModelOptions.slice(1).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        {/* ターゲット市場 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ターゲット市場
          </label>
          <select
            value={analysisParams.targetMarket}
            onChange={(e) => setAnalysisParams(prev => ({
              ...prev,
              targetMarket: e.target.value
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">市場戦略を選択してください</option>
            {targetMarketOptions.slice(1).map(market => (
              <option key={market} value={market}>{market}</option>
            ))}
          </select>
          
          {/* ビジネスモデル固有のヒント */}
          {analysisParams.businessModel && (
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
              <span className="font-medium">💡 {analysisParams.businessModel}向けヒント: </span>
              {getBusinessModelHint(analysisParams.businessModel)}
            </div>
          )}
        </div>

        {/* 制約条件 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            制約条件（任意）
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">予算規模</label>
              <input
                type="text"
                placeholder="例: 1000万円以下"
                value={analysisParams.constraints.budget || ''}
                onChange={(e) => setAnalysisParams(prev => ({
                  ...prev,
                  constraints: { ...prev.constraints, budget: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">実現期間</label>
              <input
                type="text"
                placeholder="例: 6ヶ月以内"
                value={analysisParams.constraints.timeframe || ''}
                onChange={(e) => setAnalysisParams(prev => ({
                  ...prev,
                  constraints: { ...prev.constraints, timeframe: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">利用可能リソース</label>
              <input
                type="text"
                placeholder="例: エンジニア3名"
                value={analysisParams.constraints.resources || ''}
                onChange={(e) => setAnalysisParams(prev => ({
                  ...prev,
                  constraints: { ...prev.constraints, resources: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 技術選好 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            技術選好（任意）
          </label>
          {/* ビジネスモデル別推奨技術 */}
          {analysisParams.businessModel && (
            <div className="mb-4 text-xs text-green-700 bg-green-50 p-3 rounded border border-green-200">
              <span className="font-medium">🔧 {analysisParams.businessModel}で推奨される技術: </span>
              {getRecommendedTech(analysisParams.businessModel).join('、')}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">活用したい技術</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {techOptions.map(tech => (
                  <label key={tech} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={analysisParams.techPreferences.preferred.includes(tech)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAnalysisParams(prev => ({
                            ...prev,
                            techPreferences: {
                              ...prev.techPreferences,
                              preferred: [...prev.techPreferences.preferred, tech]
                            }
                          }));
                        } else {
                          setAnalysisParams(prev => ({
                            ...prev,
                            techPreferences: {
                              ...prev.techPreferences,
                              preferred: prev.techPreferences.preferred.filter(t => t !== tech)
                            }
                          }));
                        }
                      }}
                      className="mr-2 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-gray-700">{tech}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">避けたい技術</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {techOptions.map(tech => (
                  <label key={tech} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={analysisParams.techPreferences.avoided.includes(tech)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAnalysisParams(prev => ({
                            ...prev,
                            techPreferences: {
                              ...prev.techPreferences,
                              avoided: [...prev.techPreferences.avoided, tech]
                            }
                          }));
                        } else {
                          setAnalysisParams(prev => ({
                            ...prev,
                            techPreferences: {
                              ...prev.techPreferences,
                              avoided: prev.techPreferences.avoided.filter(t => t !== tech)
                            }
                          }));
                        }
                      }}
                      className="mr-2 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700">{tech}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* リスク許容度と収益期待 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              リスク許容度
            </label>
            <div className="space-y-3">
              {riskToleranceOptions.map(option => (
                <label key={option.value} className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value={option.value}
                    checked={analysisParams.riskTolerance === option.value}
                    onChange={(e) => setAnalysisParams(prev => ({
                      ...prev,
                      riskTolerance: e.target.value as 'conservative' | 'moderate' | 'aggressive'
                    }))}
                    className="mr-3 mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{option.label}</span>
                    <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              収益期待
            </label>
            <div className="space-y-3">
              {revenueExpectationOptions.map(option => (
                <label key={option.value} className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="revenueExpectation"
                    value={option.value}
                    checked={analysisParams.revenueExpectation === option.value}
                    onChange={(e) => setAnalysisParams(prev => ({
                      ...prev,
                      revenueExpectation: e.target.value as 'short-term' | 'medium-term' | 'long-term'
                    }))}
                    className="mr-3 mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{option.label}</span>
                    <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGenerationStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">アイデア生成の実行</h3>
        <p className="text-sm text-gray-600 mb-6">
          設定内容を確認して、AIによるビジネスアイデア生成を実行してください
        </p>
      </div>

      {/* 設定内容の確認 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">設定内容の確認</h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex">
            <span className="font-medium text-gray-700 w-24">企業:</span>
            <span className="text-gray-900">{selectedCompany?.name}</span>
          </div>
          
          <div className="flex">
            <span className="font-medium text-gray-700 w-24">重点領域:</span>
            <span className="text-gray-900">{analysisParams.focusAreas.join(', ')}</span>
          </div>
          
          <div className="flex">
            <span className="font-medium text-gray-700 w-24">ビジネスモデル:</span>
            <span className="text-gray-900">{analysisParams.businessModel}</span>
          </div>
          
          {analysisParams.targetMarket && (
            <div className="flex">
              <span className="font-medium text-gray-700 w-24">ターゲット市場:</span>
              <span className="text-gray-900">{analysisParams.targetMarket}</span>
            </div>
          )}
          
          <div className="flex">
            <span className="font-medium text-gray-700 w-24">リスク許容度:</span>
            <span className="text-gray-900">
              {riskToleranceOptions.find(opt => opt.value === analysisParams.riskTolerance)?.label}
            </span>
          </div>
          
          <div className="flex">
            <span className="font-medium text-gray-700 w-24">収益期待:</span>
            <span className="text-gray-900">
              {revenueExpectationOptions.find(opt => opt.value === analysisParams.revenueExpectation)?.label}
            </span>
          </div>
          
          {analysisParams.techPreferences.preferred.length > 0 && (
            <div className="flex">
              <span className="font-medium text-gray-700 w-24">優先技術:</span>
              <span className="text-gray-900">{analysisParams.techPreferences.preferred.join(', ')}</span>
            </div>
          )}
          
          {analysisParams.techPreferences.avoided.length > 0 && (
            <div className="flex">
              <span className="font-medium text-gray-700 w-24">回避技術:</span>
              <span className="text-gray-900">{analysisParams.techPreferences.avoided.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 実行ボタン */}
      <div className="text-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 mx-auto"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner size="sm" />
              <span>アイデア生成中...</span>
            </>
          ) : (
            <>
              <Lightbulb className="h-5 w-5" />
              <span>AIアイデア生成を実行</span>
            </>
          )}
        </button>
        
        {isGenerating && (
          <p className="mt-3 text-sm text-gray-600">
            企業のMVVと設定パラメータに基づいて革新的なビジネスアイデアを生成しています...
          </p>
        )}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderCompanySelection();
      case 1: return renderParameterSettings();
      case 2: return renderGenerationStep();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden w-full">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">AI ビジネスアイデア生成</h2>
              <p className="text-blue-100 mt-1">企業のMVVに基づく革新的アイデアの創出</p>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ステップインジケーター */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-blue-600 text-white' 
                    : index < currentStep 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium transition-colors ${
                  index === currentStep 
                    ? 'text-blue-600' 
                    : index < currentStep 
                    ? 'text-green-600' 
                    : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <ArrowRight className={`h-4 w-4 mx-4 transition-colors ${
                    index < currentStep ? 'text-green-600' : 'text-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {renderStepContent()}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isGenerating}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              戻る
            </button>

            <div className="flex items-center space-x-3">
              {currentStep < steps.length - 1 && (
                <button
                  onClick={handleNext}
                  disabled={!canProceedToNext() || isGenerating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <span>次へ</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};