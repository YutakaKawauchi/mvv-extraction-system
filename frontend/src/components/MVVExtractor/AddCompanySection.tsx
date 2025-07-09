import React, { useState } from 'react';
import { useCompanyStore } from '../../stores/companyStore';
import { useMVVStore } from '../../stores/mvvStore';
import { useApiClient } from '../../hooks/useApiClient';
import { useNotification } from '../../hooks/useNotification';
import { Button } from '../common';
import { Plus, Building2, Globe, Tag, FileText, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Company, MVVData } from '../../types';

interface AddCompanySectionProps {
  onSuccess?: (company: Company) => void;
}

interface FormData {
  name: string;
  website: string;
  category: string;
  description: string;
}

type ProcessingStatus = 'idle' | 'extracting' | 'saving' | 'success' | 'error';

export const AddCompanySection: React.FC<AddCompanySectionProps> = ({ onSuccess }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    website: '',
    category: '',
    description: ''
  });
  
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  
  const { addCompany } = useCompanyStore();
  const { addMVVData } = useMVVStore();
  const { extractMVVPerplexity } = useApiClient();
  const { success, error: showError } = useNotification();

  // Category options
  const defaultCategories = [
    // ヘルスケア関連
    '医療機器', 'ヘルスケア', 'バイオ・製薬', '医療サービス', 
    'メディカル', '健康食品', '医療情報', '介護・福祉',
    
    // テクノロジー関連
    'IT・ソフトウェア', 'AI・機械学習', 'SaaS', 'フィンテック',
    'エドテック', 'アグリテック', 'IoT', 'ブロックチェーン',
    
    // ビジネス関連
    'コンサルティング', '人材・HR', 'マーケティング', '広告',
    'メディア', 'エンターテインメント', 'EC・小売', '物流',
    
    // 製造・産業
    '製造業', '自動車', '電子機器', '化学', '素材', 'エネルギー',
    
    // その他
    '不動産', '金融', '教育', '飲食', 'その他'
  ];

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value }));
    
    if (value) {
      const filtered = defaultCategories.filter(cat => 
        cat.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCategories(filtered);
      setShowCategoryDropdown(filtered.length > 0);
    } else {
      setFilteredCategories(defaultCategories);
      setShowCategoryDropdown(true);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      website: '',
      category: '',
      description: ''
    });
    setProcessingStatus('idle');
    setErrorMessage('');
    setProcessingStep('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.website.trim() || !formData.category.trim()) {
      setErrorMessage('企業名、ウェブサイト、業界は必須項目です');
      return;
    }

    // URL validation
    try {
      new URL(formData.website);
    } catch {
      setErrorMessage('有効なウェブサイトURLを入力してください');
      return;
    }

    setProcessingStatus('extracting');
    setErrorMessage('');
    setProcessingStep('Perplexity AIがMVVを抽出中...');

    try {
      // Step 1: Extract MVV using Perplexity AI
      const extractionResult = await extractMVVPerplexity({
        companyId: `temp-${Date.now()}`,
        companyName: formData.name.trim(),
        companyWebsite: formData.website.trim(),
        companyDescription: formData.description.trim() || undefined
      });

      if (!extractionResult) {
        throw new Error('MVV抽出に失敗しました');
      }

      setProcessingStatus('saving');
      setProcessingStep('企業情報とMVVデータを保存中...');

      // Step 2: Add company to the store
      const newCompany = await addCompany({
        name: formData.name.trim(),
        website: formData.website.trim(),
        category: formData.category.trim(),
        notes: formData.description.trim() || undefined
      });

      // Step 3: Add MVV data
      const mvvData: MVVData = {
        companyId: newCompany.id,
        version: 1,
        mission: extractionResult.mission,
        vision: extractionResult.vision,
        values: extractionResult.values,
        confidenceScores: extractionResult.confidence_scores,
        extractedAt: new Date(),
        source: 'perplexity',
        isActive: true,
        extractedFrom: extractionResult.extracted_from
      };

      await addMVVData(mvvData);

      // Step 4: Update company status to completed
      await addCompany({
        ...newCompany,
        status: 'completed'
      });

      setProcessingStatus('success');
      setProcessingStep('企業の追加が完了しました！');
      
      success('企業追加完了', `${formData.name}のMVV情報が正常に抽出・保存されました`);
      
      onSuccess?.(newCompany);
      
      // Reset form after a short delay
      setTimeout(() => {
        resetForm();
        setIsExpanded(false);
      }, 2000);

    } catch (error) {
      setProcessingStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'MVV抽出に失敗しました';
      setErrorMessage(errorMsg);
      showError('抽出エラー', errorMsg);
    }
  };

  if (!isExpanded) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-blue-500" />
              新しい企業を追加
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Perplexity AIを使用してMVVを自動抽出
            </p>
          </div>
          <Button onClick={() => setIsExpanded(true)}>
            <Plus className="w-4 h-4 mr-2" />
            企業を追加
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Plus className="w-5 h-5 mr-2 text-blue-500" />
          新しい企業を追加
        </h3>
        <Button 
          variant="outline" 
          onClick={() => {
            setIsExpanded(false);
            resetForm();
          }}
          disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
        >
          キャンセル
        </Button>
      </div>

      {processingStatus === 'success' ? (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            企業の追加が完了しました！
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            {formData.name}のMVV情報が正常に抽出・保存されました
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
            <p className="text-sm text-green-800">
              <strong>✅ 完了した処理:</strong><br />
              • Perplexity AIによるMVV抽出<br />
              • 企業情報の保存<br />
              • MVVデータの統合
            </p>
          </div>
        </div>
      ) : processingStatus === 'extracting' || processingStatus === 'saving' ? (
        <div className="text-center py-8">
          <div className="relative">
            <Sparkles className="mx-auto h-16 w-16 text-purple-500 mb-4" />
            <Loader2 className="absolute top-0 left-1/2 transform -translate-x-1/2 h-16 w-16 text-purple-300 animate-spin" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            処理を実行中...
          </h4>
          <p className="text-gray-600 mb-4">
            {processingStep}
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• MVV情報の自動抽出（10-20秒）</p>
            <p>• 企業情報の保存</p>
            <p>• データベースへの統合</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline h-4 w-4 mr-1" />
              企業名 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="サイバーエージェント"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="inline h-4 w-4 mr-1" />
              ウェブサイト *
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://www.cyberagent.co.jp/"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
              required
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="inline h-4 w-4 mr-1" />
              業界 * <span className="text-xs text-gray-500">（新規入力可）</span>
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              onFocus={() => setShowCategoryDropdown(true)}
              onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
              placeholder="業界を入力または選択..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
              required
            />
            
            {showCategoryDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, category }));
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    >
                      {category}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    「{formData.category}」を新規カテゴリとして追加
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              企業概要（任意）
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="企業の簡単な説明（MVV抽出の精度向上に役立ちます）"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
            />
          </div>

          {errorMessage && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-700">{errorMessage}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>自動処理:</strong> Perplexity AIがウェブサイトからMVVを自動抽出し、
              企業管理システムに統合します。
            </p>
            <p className="text-xs text-blue-600 mt-1">
              処理時間: 約10-20秒
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsExpanded(false);
                resetForm();
              }}
              disabled={processingStatus === 'extracting' || processingStatus === 'saving'}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={
                processingStatus === 'extracting' || 
                processingStatus === 'saving' || 
                !formData.name.trim() || 
                !formData.website.trim() || 
                !formData.category.trim()
              }
              className="flex items-center"
            >
              {processingStatus === 'extracting' || processingStatus === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  MVVを抽出して追加
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};