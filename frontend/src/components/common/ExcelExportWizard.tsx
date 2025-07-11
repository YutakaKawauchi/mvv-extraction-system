/**
 * Excel Export Wizard Component
 * ステップバイステップでExcelエクスポート設定を行うUIコンポーネント
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, LoadingSpinner } from './';
import { Download, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { ExcelProcessor, type ExcelReportOptions } from '../../services/excelProcessor';
import type { Company, MVVData, CompanyInfo } from '../../types';
import { useNotification } from '../../hooks/useNotification';

interface ExcelExportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  mvvDataMap: Map<string, MVVData>;
  companyInfoMap?: Map<string, CompanyInfo>;
  onExportComplete?: () => void;
}

type WizardStep = 'options' | 'preview' | 'generating' | 'complete';

interface ExportStats {
  totalCompanies: number;
  mvvCompletedCompanies: number;
  categoriesCount: number;
  estimatedFileSize: string;
  estimatedGenerationTime: string;
}

export const ExcelExportWizard: React.FC<ExcelExportWizardProps> = ({
  isOpen,
  onClose,
  companies,
  mvvDataMap,
  companyInfoMap,
  onExportComplete
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('options');
  const [options, setOptions] = useState<ExcelReportOptions>({
    includeExecutiveSummary: true,
    includeMVVPivot: true,
    includeMVVDetail: true,
    includeCompanyMaster: true,
    includeDetailedProfiles: true, // デフォルトでtrueに設定
    includeVisualAnalytics: false,
    corporateTheme: 'professional',
    includeCharts: true,
    highResolution: true,
    dataQualityFilter: 'all'
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { success, error: notifyError } = useNotification();

  // 統計計算
  const stats: ExportStats = React.useMemo(() => {
    const mvvCompletedCompanies = companies.filter(c => mvvDataMap.has(c.id)).length;
    const categoriesCount = new Set(companies.map(c => c.category).filter(Boolean)).size;
    
    // ファイルサイズとエクスポート時間の推定
    const baseSize = companies.length * 0.5; // KB per company
    const sheetsMultiplier = Object.values(options).filter(Boolean).length;
    const estimatedSizeKB = baseSize * sheetsMultiplier;
    const estimatedSize = estimatedSizeKB > 1024 ? 
      `${(estimatedSizeKB / 1024).toFixed(1)} MB` : 
      `${Math.round(estimatedSizeKB)} KB`;
    
    const estimatedTimeSeconds = Math.max(2, Math.round(companies.length / 50));
    const estimatedTime = estimatedTimeSeconds > 60 ? 
      `${Math.round(estimatedTimeSeconds / 60)} 分` : 
      `${estimatedTimeSeconds} 秒`;

    return {
      totalCompanies: companies.length,
      mvvCompletedCompanies,
      categoriesCount,
      estimatedFileSize: estimatedSize,
      estimatedGenerationTime: estimatedTime
    };
  }, [companies, mvvDataMap, options]);

  // ステップリセット
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('options');
      setError(null);
      setGenerationProgress(0);
    }
  }, [isOpen]);

  const handleOptionChange = (key: keyof ExcelReportOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    if (currentStep === 'options') {
      setCurrentStep('preview');
    } else if (currentStep === 'preview') {
      handleStartGeneration();
    }
  };

  const handleBack = () => {
    if (currentStep === 'preview') {
      setCurrentStep('options');
    }
  };

  const handleStartGeneration = async () => {
    setCurrentStep('generating');
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      // 進捗シミュレーション
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // ExcelProcessor実行
      const processor = new ExcelProcessor(options);
      await processor.generatePremiumReport(companies, mvvDataMap, companyInfoMap);

      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      setTimeout(() => {
        setCurrentStep('complete');
        setIsGenerating(false);
        success('エクスポート完了', 'Excelレポートが正常に生成されました');
        onExportComplete?.();
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'エクスポートに失敗しました');
      setIsGenerating(false);
      setCurrentStep('options');
      notifyError('エクスポートエラー', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="flex items-center space-x-4">
        {/* Step 1 */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === 'options' ? 'bg-blue-600 text-white' : 
          ['preview', 'generating', 'complete'].includes(currentStep) ? 'bg-green-500 text-white' : 
          'bg-gray-300 text-gray-600'
        }`}>
          {['preview', 'generating', 'complete'].includes(currentStep) ? 
            <CheckCircle className="w-5 h-5" /> : '1'
          }
        </div>
        <div className={`h-1 w-12 ${
          ['preview', 'generating', 'complete'].includes(currentStep) ? 'bg-green-500' : 'bg-gray-300'
        }`} />
        
        {/* Step 2 */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === 'preview' ? 'bg-blue-600 text-white' : 
          ['generating', 'complete'].includes(currentStep) ? 'bg-green-500 text-white' : 
          'bg-gray-300 text-gray-600'
        }`}>
          {['generating', 'complete'].includes(currentStep) ? 
            <CheckCircle className="w-5 h-5" /> : '2'
          }
        </div>
        <div className={`h-1 w-12 ${
          ['generating', 'complete'].includes(currentStep) ? 'bg-green-500' : 'bg-gray-300'
        }`} />
        
        {/* Step 3 */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === 'generating' ? 'bg-blue-600 text-white' : 
          currentStep === 'complete' ? 'bg-green-500 text-white' : 
          'bg-gray-300 text-gray-600'
        }`}>
          {currentStep === 'complete' ? 
            <CheckCircle className="w-5 h-5" /> : '3'
          }
        </div>
      </div>
    </div>
  );

  const renderOptionsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">エクスポートオプション設定</h3>
        <p className="text-gray-600">含めるシートとオプションを選択してください</p>
      </div>

      {/* シート選択 */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">含めるシート</h4>
        
        <div className="grid grid-cols-1 gap-3">
          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={options.includeExecutiveSummary}
              onChange={(e) => handleOptionChange('includeExecutiveSummary', e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">Executive Summary</div>
              <div className="text-sm text-gray-600">プロジェクト概要・統計サマリー</div>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={options.includeMVVPivot}
              onChange={(e) => handleOptionChange('includeMVVPivot', e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">MVV Analysis (Simple)</div>
              <div className="text-sm text-gray-600">基本的なMVV分析データ</div>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={options.includeMVVDetail}
              onChange={(e) => handleOptionChange('includeMVVDetail', e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">MVV Analysis (Detail)</div>
              <div className="text-sm text-gray-600">MVV + 企業詳細情報の統合データ ({companyInfoMap?.size || 0}件のデータ)</div>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={options.includeCompanyMaster}
              onChange={(e) => handleOptionChange('includeCompanyMaster', e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">Company Master Data</div>
              <div className="text-sm text-gray-600">企業基本情報・処理ステータス</div>
            </div>
          </label>

          <label className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={options.includeDetailedProfiles}
              onChange={(e) => handleOptionChange('includeDetailedProfiles', e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">Company Detailed Profiles</div>
              <div className="text-sm text-gray-600">
                財務・ESG・競合データ ({companyInfoMap?.size || 0}件のデータ)
              </div>
            </div>
          </label>


          <label className="flex items-start space-x-3 opacity-50">
            <input
              type="checkbox"
              checked={false}
              disabled={true}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">Visual Analytics Gallery</div>
              <div className="text-sm text-gray-600">AI分析画面キャプチャ (Phase 2で実装予定)</div>
            </div>
          </label>
        </div>
      </div>

      {/* 詳細オプション */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">詳細オプション</h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">テーマ</label>
            <select
              value={options.corporateTheme}
              onChange={(e) => handleOptionChange('corporateTheme', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="professional">プロフェッショナル</option>
              <option value="modern">モダン</option>
              <option value="default">デフォルト</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">データ品質フィルター</label>
            <select
              value={options.dataQualityFilter}
              onChange={(e) => handleOptionChange('dataQualityFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全データ</option>
              <option value="high">高品質のみ</option>
              <option value="medium">中品質以上</option>
            </select>
          </div>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.includeCharts}
              onChange={(e) => handleOptionChange('includeCharts', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">チャート・グラフを含める</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.highResolution}
              onChange={(e) => handleOptionChange('highResolution', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">高解像度出力</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">エクスポート設定プレビュー</h3>
        <p className="text-gray-600">設定内容を確認してエクスポートを開始してください</p>
      </div>

      {/* 統計情報 */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">エクスポート統計</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">総企業数:</span>
            <span className="font-medium ml-2">{stats.totalCompanies}社</span>
          </div>
          <div>
            <span className="text-blue-700">MVV抽出完了:</span>
            <span className="font-medium ml-2">{stats.mvvCompletedCompanies}社</span>
          </div>
          <div>
            <span className="text-blue-700">業界数:</span>
            <span className="font-medium ml-2">{stats.categoriesCount}業界</span>
          </div>
          <div>
            <span className="text-blue-700">推定ファイルサイズ:</span>
            <span className="font-medium ml-2">{stats.estimatedFileSize}</span>
          </div>
          <div className="col-span-2">
            <span className="text-blue-700">推定生成時間:</span>
            <span className="font-medium ml-2">{stats.estimatedGenerationTime}</span>
          </div>
        </div>
      </div>

      {/* 選択されたシート */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">含まれるシート</h4>
        <div className="space-y-2">
          {options.includeExecutiveSummary && (
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Executive Summary</span>
            </div>
          )}
          {options.includeMVVPivot && (
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>MVV Analysis (Simple)</span>
            </div>
          )}
          {options.includeMVVDetail && (
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>MVV Analysis (Detail)</span>
            </div>
          )}
          {options.includeCompanyMaster && (
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Company Master Data</span>
            </div>
          )}
          {options.includeDetailedProfiles && (
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Company Detailed Profiles</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="space-y-6 text-center">
      <div>
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Excelレポートを生成中...</h3>
        <p className="text-gray-600">しばらくお待ちください</p>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${generationProgress}%` }}
        />
      </div>
      <div className="text-sm text-gray-600">
        {Math.round(generationProgress)}% 完了
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center">
      <div>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">エクスポート完了！</h3>
        <p className="text-gray-600">Excelレポートが正常に生成されました</p>
      </div>

      <div className="bg-green-50 rounded-lg p-4">
        <p className="text-sm text-green-800">
          ファイルがダウンロードフォルダに保存されました。<br />
          ファイル名: MVV_Analysis_Report_[日付].xlsx
        </p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'options':
        return renderOptionsStep();
      case 'preview':
        return renderPreviewStep();
      case 'generating':
        return renderGeneratingStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (currentStep === 'generating') return null;
    
    return (
      <div className="flex justify-between pt-6 border-t">
        <div>
          {currentStep === 'preview' && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isGenerating}
            >
              戻る
            </Button>
          )}
        </div>
        
        <div className="flex space-x-3">
          {currentStep !== 'complete' && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
            >
              キャンセル
            </Button>
          )}
          
          {currentStep === 'options' && (
            <Button
              onClick={handleNext}
              disabled={isGenerating}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Eye className="w-4 h-4 mr-2" />
              プレビュー
            </Button>
          )}
          
          {currentStep === 'preview' && (
            <Button
              onClick={handleNext}
              disabled={isGenerating}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              エクスポート開始
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button
              onClick={onClose}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              完了
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={currentStep === 'generating' ? () => {} : onClose}
      title="Excelレポートエクスポート"
      size="lg"
    >
      <div className="space-y-6">
        {renderStepIndicator()}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div className="text-red-800">
                <div className="font-medium">エクスポートエラー</div>
                <div className="text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}
        
        {renderContent()}
        {renderFooter()}
      </div>
    </Modal>
  );
};