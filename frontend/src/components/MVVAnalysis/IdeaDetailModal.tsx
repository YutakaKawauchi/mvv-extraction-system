/**
 * IdeaDetailModal - アイデア詳細表示モーダル
 * BusinessInnovationLabから分離された独立コンポーネント
 */

import React from 'react';
import { 
  Star, 
  Eye, 
  X, 
  Building2, 
  Clock, 
  Tag, 
  CheckCircle
} from 'lucide-react';
import type { StoredBusinessIdea } from '../../services/ideaStorage';

interface IdeaDetailModalProps {
  isOpen: boolean;
  idea: StoredBusinessIdea | null;
  onClose: () => void;
  onToggleStar: (ideaId: string) => void;
}

export const IdeaDetailModal: React.FC<IdeaDetailModalProps> = ({
  isOpen,
  idea,
  onClose,
  onToggleStar
}) => {
  if (!isOpen || !idea) return null;

  // 背景クリックでモーダルを閉じる
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
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
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-4">
          {/* 基本情報 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{idea.title}</h3>
            <p className="text-gray-700 mb-4 leading-relaxed">{idea.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <Building2 className="h-4 w-4 mr-2" />
                <span className="font-medium">企業:</span>
                <span className="ml-1">{idea.companyName}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                <span className="font-medium">作成日:</span>
                <span className="ml-1">{new Date(idea.createdAt).toLocaleDateString('ja-JP')}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Tag className="h-4 w-4 mr-2" />
                <span className="font-medium">タグ:</span>
                <span className="ml-1">{idea.tags.length > 0 ? idea.tags.join(', ') : 'なし'}</span>
              </div>
              {idea.verification && (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">AI検証済み</span>
                  <span className="ml-1">信頼度: {(idea.verification.metadata.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* MVV世界観・業界課題・実現可能性評価を3列レイアウト */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MVV世界観 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-blue-900 mb-2">MVV世界観</h4>
              <p className="text-sm text-blue-800 leading-relaxed">{idea.worldview}</p>
            </div>

            {/* 業界課題の深い洞察 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-purple-900 mb-2">業界課題の深い洞察</h4>
              <p className="text-sm text-purple-800 leading-relaxed">{idea.industryInsight}</p>
            </div>

            {/* 実現可能性評価 */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-green-900 mb-2">実現可能性評価</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-green-800">MVV適合度</span>
                    <span className="text-xs font-bold text-green-900">{(idea.feasibility.mvvAlignment * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-green-700">{idea.feasibility.mvvAlignmentReason}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-green-800">実装容易性</span>
                    <span className="text-xs font-bold text-green-900">{(idea.feasibility.implementationScore * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-green-700">{idea.feasibility.implementationReason}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-green-800">市場性</span>
                    <span className="text-xs font-bold text-green-900">{(idea.feasibility.marketPotential * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-green-700">{idea.feasibility.marketPotentialReason}</p>
                </div>
              </div>
            </div>
          </div>


          {/* AI検証結果（検証済みの場合のみ表示） */}
          {idea.verification && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                AI検証結果
                <span className="ml-2 text-sm text-gray-600">
                  ({idea.verification.metadata.verificationLevel})
                </span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* 業界分析 */}
                {idea.verification.industryAnalysis && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <h5 className="font-semibold text-gray-800 mb-2">業界分析</h5>
                    <div className="text-gray-700 text-xs leading-relaxed">
                      {typeof idea.verification.industryAnalysis === 'string' 
                        ? idea.verification.industryAnalysis
                        : JSON.stringify(idea.verification.industryAnalysis, null, 2)}
                    </div>
                  </div>
                )}

                {/* 市場検証 */}
                {idea.verification.marketValidation && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <h5 className="font-semibold text-gray-800 mb-2">市場検証</h5>
                    <div className="text-gray-700 text-xs leading-relaxed">
                      {typeof idea.verification.marketValidation === 'string' 
                        ? idea.verification.marketValidation
                        : JSON.stringify(idea.verification.marketValidation, null, 2)}
                    </div>
                  </div>
                )}

                {/* ビジネスモデル検証 */}
                {idea.verification.businessModelValidation && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <h5 className="font-semibold text-gray-800 mb-2">ビジネスモデル検証</h5>
                    <div className="text-gray-700 text-xs leading-relaxed">
                      {typeof idea.verification.businessModelValidation === 'string' 
                        ? idea.verification.businessModelValidation
                        : JSON.stringify(idea.verification.businessModelValidation, null, 2)}
                    </div>
                  </div>
                )}

                {/* 競合分析 */}
                {idea.verification.competitiveAnalysis && (
                  <div className="bg-white rounded p-3 border border-gray-200">
                    <h5 className="font-semibold text-gray-800 mb-2">競合分析</h5>
                    <div className="text-gray-700 text-xs leading-relaxed">
                      {typeof idea.verification.competitiveAnalysis === 'string' 
                        ? idea.verification.competitiveAnalysis
                        : JSON.stringify(idea.verification.competitiveAnalysis, null, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* 改善提案 */}
              {idea.verification.improvementSuggestions && (
                <div className="mt-4 bg-yellow-50 rounded p-3 border border-yellow-200">
                  <h5 className="font-semibold text-yellow-800 mb-2">改善提案</h5>
                  <div className="text-yellow-700 text-xs leading-relaxed">
                    {typeof idea.verification.improvementSuggestions === 'string' 
                      ? idea.verification.improvementSuggestions
                      : JSON.stringify(idea.verification.improvementSuggestions, null, 2)}
                  </div>
                </div>
              )}

              {/* 総合評価 */}
              {idea.verification.overallAssessment && (
                <div className="mt-4 bg-blue-50 rounded p-3 border border-blue-200">
                  <h5 className="font-semibold text-blue-800 mb-2">総合評価</h5>
                  <div className="text-blue-700 text-xs leading-relaxed">
                    {typeof idea.verification.overallAssessment === 'string' 
                      ? idea.verification.overallAssessment
                      : JSON.stringify(idea.verification.overallAssessment, null, 2)}
                  </div>
                </div>
              )}

              {/* メタデータ */}
              <div className="mt-4 text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">モデル:</span> {idea.verification.metadata.model}
                </div>
                <div>
                  <span className="font-medium">トークン使用:</span> {idea.verification.metadata.totalTokens.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">コスト:</span> ${idea.verification.metadata.totalCost.toFixed(4)}
                </div>
                <div>
                  <span className="font-medium">信頼度:</span> {(idea.verification.metadata.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          )}

          {/* 生成メタデータ */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-3">生成情報</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">モデル:</span>
                <div className="text-gray-600">{idea.generationMetadata.model}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">トークン使用:</span>
                <div className="text-gray-600">{idea.generationMetadata.tokensUsed.toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">推定コスト:</span>
                <div className="text-gray-600">${idea.generationMetadata.estimatedCost.toFixed(4)}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">信頼度:</span>
                <div className="text-gray-600">{(idea.generationMetadata.confidence * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={() => onToggleStar(idea.id)}
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
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};