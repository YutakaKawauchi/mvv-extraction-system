/**
 * IdeaExportWizard - ビジネスアイデア Excel出力ウィザード
 * 美しいリーンキャンバスレイアウトを含む洗練されたExcel出力機能
 */

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  X, 
  CheckCircle, 
  Users,
  Star,
  Filter,
  Palette,
  FileText,
  BarChart,
  Target,
  BrainCircuit,
  AlertCircle,
  Clock
} from 'lucide-react';
import { LoadingSpinner } from '../common';
import { 
  exportIdeasToExcel, 
  type IdeaExportOptions
} from '../../services/ideaExcelExporter';
import { type StoredBusinessIdea } from '../../services/ideaStorage';

interface IdeaExportWizardProps {
  ideas: StoredBusinessIdea[];
  selectedIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onExportComplete?: (fileName: string) => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
}

export const IdeaExportWizard: React.FC<IdeaExportWizardProps> = ({
  ideas,
  selectedIds = [],
  isOpen,
  onClose,
  onExportComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<IdeaExportOptions>({
    includeIdeasSummary: true,
    includeLeanCanvasGallery: true,
    includeAIVerificationReport: true,
    includeFeasibilityDashboard: true,
    includeActionPlan: true,
    exportScope: selectedIds.length > 0 ? 'selected' : 'all',
    selectedIds: selectedIds,
    includeOnlyVerified: false,
    includeOnlyStarred: false,
    optimizeForPrint: true
  });

  const [filteredIdeas, setFilteredIdeas] = useState<StoredBusinessIdea[]>([]);

  // ウィザードステップ定義
  const steps: WizardStep[] = [
    {
      id: 'scope',
      title: '出力範囲の選択',
      description: '出力するアイデアの範囲を選択してください',
      icon: Filter,
      completed: false
    },
    {
      id: 'sheets',
      title: 'シート構成の設定',
      description: '出力するシートを選択してください',
      icon: FileSpreadsheet,
      completed: false
    },
    {
      id: 'preview',
      title: 'プレビュー・確認',
      description: '設定内容を確認して出力を実行してください',
      icon: CheckCircle,
      completed: false
    }
  ];

  // フィルタリングされたアイデアを計算
  useEffect(() => {
    let filtered = [...ideas];

    if (exportOptions.exportScope === 'selected' && exportOptions.selectedIds) {
      filtered = filtered.filter(idea => exportOptions.selectedIds!.includes(idea.id));
    }

    if (exportOptions.includeOnlyVerified) {
      filtered = filtered.filter(idea => !!idea.verification);
    }

    if (exportOptions.includeOnlyStarred) {
      filtered = filtered.filter(idea => idea.starred);
    }

    setFilteredIdeas(filtered);
  }, [ideas, exportOptions]);

  // ステップ完了状態を更新
  useEffect(() => {
    steps[0].completed = exportOptions.exportScope !== undefined;
    steps[1].completed = Object.values(exportOptions).some(v => v === true);
    steps[2].completed = filteredIdeas.length > 0;
  }, [exportOptions, filteredIdeas]);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      await exportIdeasToExcel(filteredIdeas, exportOptions);
      
      // ファイル名生成（同じロジック）
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
      const scope = exportOptions.exportScope === 'all' ? '全件' : 
                    exportOptions.exportScope === 'filtered' ? 'フィルタ済み' : '選択項目';
      const companyCount = new Set(filteredIdeas.map(i => i.companyName)).size;
      const fileName = `ビジネスアイデア_${scope}_${filteredIdeas.length}件_${companyCount}社_${timestamp}.xlsx`;
      
      onExportComplete?.(fileName);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Excel出力に失敗しました: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderScopeStep();
      case 1:
        return renderSheetsStep();
      case 2:
        return renderPreviewStep();
      default:
        return null;
    }
  };

  const renderScopeStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">出力範囲の選択</h3>
        
        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="exportScope"
              value="all"
              checked={exportOptions.exportScope === 'all'}
              onChange={(e) => setExportOptions(prev => ({ ...prev, exportScope: e.target.value as any }))}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">全てのアイデア</span>
              <p className="text-sm text-gray-500">{ideas.length}件のアイデアを出力</p>
            </div>
          </label>

          {selectedIds.length > 0 && (
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                name="exportScope"
                value="selected"
                checked={exportOptions.exportScope === 'selected'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, exportScope: e.target.value as any }))}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">選択されたアイデア</span>
                <p className="text-sm text-gray-500">{selectedIds.length}件の選択されたアイデアを出力</p>
              </div>
            </label>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-md font-medium text-gray-900 mb-3">フィルター設定</h4>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeOnlyVerified}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeOnlyVerified: e.target.checked }))}
              className="h-4 w-4 text-blue-600"
            />
            <div className="flex items-center space-x-2">
              <BrainCircuit className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-900">AI検証済みのみ</span>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={exportOptions.includeOnlyStarred}
              onChange={(e) => setExportOptions(prev => ({ ...prev, includeOnlyStarred: e.target.checked }))}
              className="h-4 w-4 text-blue-600"
            />
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-gray-900">スター付きのみ</span>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            出力予定: {filteredIdeas.length}件のアイデア
          </span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          {new Set(filteredIdeas.map(i => i.companyName)).size}社からのアイデアが含まれます
        </p>
      </div>
    </div>
  );

  const renderSheetsStep = () => {
    const sheetOptions = [
      {
        key: 'includeIdeasSummary',
        title: 'アイデアサマリー',
        description: '全アイデアの一覧表とスコア概要',
        icon: FileText,
        recommended: true
      },
      {
        key: 'includeLeanCanvasGallery',
        title: 'リーンキャンバス ギャラリー',
        description: '美しい9ブロックキャンバスレイアウト（重要）',
        icon: Target,
        recommended: true
      },
      {
        key: 'includeAIVerificationReport',
        title: 'AI検証レポート',
        description: 'AI検証結果の詳細分析レポート',
        icon: BrainCircuit,
        recommended: true
      },
      {
        key: 'includeFeasibilityDashboard',
        title: '実行可能性ダッシュボード',
        description: 'MVV適合度・実装難易度・市場性の分析',
        icon: BarChart,
        recommended: false
      },
      {
        key: 'includeActionPlan',
        title: 'アクションプラン',
        description: '次のステップと推奨アクション',
        icon: CheckCircle,
        recommended: false
      }
    ];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">出力シートの選択</h3>
          <p className="text-sm text-gray-600 mb-6">
            リーンキャンバス ギャラリーは特に美しいレイアウトで設計されています
          </p>
        </div>

        <div className="space-y-4">
          {sheetOptions.map((option) => (
            <div key={option.key} className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={exportOptions[option.key as keyof IdeaExportOptions] as boolean}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    [option.key]: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <option.icon className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">{option.title}</span>
                    {option.recommended && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        推奨
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // デザインステップは削除（プロフェッショナルテーマ固定）

  const renderPreviewStep = () => {
    const enabledSheets = Object.entries(exportOptions)
      .filter(([key, value]) => key.startsWith('include') && value === true)
      .map(([key]) => {
        const sheetNames = {
          includeIdeasSummary: 'アイデアサマリー',
          includeLeanCanvasGallery: 'リーンキャンバス ギャラリー',
          includeAIVerificationReport: 'AI検証レポート',
          includeFeasibilityDashboard: '実行可能性ダッシュボード',
          includeActionPlan: 'アクションプラン'
        };
        return sheetNames[key as keyof typeof sheetNames];
      })
      .filter(Boolean);

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">出力設定の確認</h3>
          <p className="text-sm text-gray-600 mb-6">
            以下の設定でExcelファイルを生成します
          </p>
        </div>

        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">レイアウト設定</h4>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={exportOptions.optimizeForPrint}
              onChange={(e) => setExportOptions(prev => ({ ...prev, optimizeForPrint: e.target.checked }))}
              className="h-4 w-4 text-blue-600 mt-1"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">印刷最適化</span>
              <div className="text-sm text-gray-600 mt-1">
                <p>✓ A4サイズに最適化されたページ設定</p>
                <p>✓ 適切なマージン設定（上下左右 0.25インチ）</p>
                <p>✓ セル高さとテキスト折り返しの自動調整</p>
                <p>✓ 印刷時の改ページ位置を考慮したレイアウト</p>
              </div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-blue-900 mb-3 flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              出力範囲
            </h4>
            <div className="space-y-2 text-sm text-blue-800">
              <p>範囲: {exportOptions.exportScope === 'all' ? '全件' : '選択項目'}</p>
              <p>件数: {filteredIdeas.length}件のアイデア</p>
              <p>企業数: {new Set(filteredIdeas.map(i => i.companyName)).size}社</p>
              {exportOptions.includeOnlyVerified && <p>✓ AI検証済みのみ</p>}
              {exportOptions.includeOnlyStarred && <p>✓ スター付きのみ</p>}
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-green-900 mb-3 flex items-center">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              出力シート
            </h4>
            <div className="space-y-1 text-sm text-green-800">
              {enabledSheets.map((sheet, index) => (
                <p key={index}>• {sheet}</p>
              ))}
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-purple-900 mb-3 flex items-center">
              <Palette className="h-4 w-4 mr-2" />
              レイアウト
            </h4>
            <div className="space-y-2 text-sm text-purple-800">
              <p>テーマ: プロフェッショナル（固定）</p>
              {exportOptions.optimizeForPrint && (
                <div>
                  <p>✓ 印刷最適化</p>
                  <p className="text-xs">A4サイズ、適切なマージン、セル高さ調整</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="text-md font-medium text-yellow-900 mb-3 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              特別機能
            </h4>
            <div className="space-y-1 text-sm text-yellow-800">
              <p>• 美しいリーンキャンバスレイアウト</p>
              <p>• 9ブロック構造の可視化</p>
              <p>• 色分けされたMVVスコア</p>
              <p>• AI検証結果の詳細表示</p>
            </div>
          </div>
        </div>

        {filteredIdeas.length === 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                出力するアイデアがありません
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              フィルター設定を調整してください
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center">
                <FileSpreadsheet className="h-6 w-6 mr-2" />
                ビジネスアイデア Excel出力
              </h2>
              <p className="text-blue-100 mt-1">
                美しいリーンキャンバスレイアウトで洗練されたレポートを生成
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ステップインジケーター */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 ${
                  index === currentStep ? 'text-blue-600' : 
                  index < currentStep ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div className={`rounded-full p-2 ${
                  index === currentStep ? 'bg-blue-100' :
                  index < currentStep ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {renderStepContent()}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              戻る
            </button>

            <div className="flex items-center space-x-3">
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  次へ
                </button>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={filteredIdeas.length === 0 || isExporting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                >
                  {isExporting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>出力中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Excel出力</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};