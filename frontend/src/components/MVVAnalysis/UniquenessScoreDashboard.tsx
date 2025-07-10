import React, { useMemo, useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { LoadingSpinner } from '../common';
import { Star, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { calculateEmbeddingSimilarity } from '../../services/similarityCalculator';

interface UniquenessScore {
  companyId: string;
  companyName: string;
  category: string;
  uniquenessScore: number;
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  similarCompaniesCount: number;
}

export const UniquenessScoreDashboard: React.FC = () => {
  const { data, isLoading } = useAnalysisStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { uniquenessScores, categoryStats, loading } = useMemo(() => {
    if (!data || !data.companies) {
      return { uniquenessScores: [], categoryStats: {}, loading: true };
    }

    console.log('🔄 独自性スコア計算開始...');
    const startTime = performance.now();

    // 埋め込みベクトルを持つ企業のみフィルター
    const validCompanies = data.companies.filter(company => 
      company.embeddings && Array.isArray(company.embeddings) && company.embeddings.length > 0
    );

    if (validCompanies.length === 0) {
      return { uniquenessScores: [], categoryStats: {}, loading: false };
    }

    console.log(`📊 ${validCompanies.length}社で独自性分析実行中...`);

    // 対称性を利用した最適化された類似度計算
    const similarityMatrix: number[][] = Array(validCompanies.length)
      .fill(null)
      .map(() => Array(validCompanies.length).fill(0));

    // 上三角行列のみ計算
    for (let i = 0; i < validCompanies.length; i++) {
      for (let j = i + 1; j < validCompanies.length; j++) {
        const similarity = calculateEmbeddingSimilarity(
          validCompanies[i].embeddings!,
          validCompanies[j].embeddings!
        );
        similarityMatrix[i][j] = similarity;
        similarityMatrix[j][i] = similarity; // 対称性を利用
      }
      similarityMatrix[i][i] = 1.0; // 自分自身は1.0
    }

    // 各企業の独自性スコア計算
    const scores: UniquenessScore[] = validCompanies.map((company, index) => {
      const similarities = similarityMatrix[index].filter((_, i) => i !== index);
      const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      const maxSimilarity = Math.max(...similarities);
      const minSimilarity = Math.min(...similarities);
      
      // 独自性スコア = 1 - 平均類似度 (より独特な企業ほど高いスコア)
      const uniquenessScore = 1 - avgSimilarity;
      
      // 高い類似度(0.8以上)の企業数をカウント
      const similarCompaniesCount = similarities.filter(sim => sim > 0.8).length;

      return {
        companyId: company.id,
        companyName: company.name,
        category: company.category,
        uniquenessScore,
        avgSimilarity,
        minSimilarity,
        maxSimilarity,
        similarCompaniesCount
      };
    });

    // カテゴリ別統計
    const categoryStats = scores.reduce((acc, score) => {
      const category = score.category;
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          avgUniqueness: 0,
          maxUniqueness: 0,
          minUniqueness: 1
        };
      }
      acc[category].count++;
      acc[category].avgUniqueness += score.uniquenessScore;
      acc[category].maxUniqueness = Math.max(acc[category].maxUniqueness, score.uniquenessScore);
      acc[category].minUniqueness = Math.min(acc[category].minUniqueness, score.uniquenessScore);
      return acc;
    }, {} as any);

    // 平均独自性スコアを計算
    Object.keys(categoryStats).forEach(category => {
      categoryStats[category].avgUniqueness /= categoryStats[category].count;
    });

    const endTime = performance.now();
    console.log(`✅ 独自性スコア計算完了: ${Math.round(endTime - startTime)}ms`);

    return {
      uniquenessScores: scores.sort((a, b) => b.uniquenessScore - a.uniquenessScore),
      categoryStats,
      loading: false
    };
  }, [data]);

  const filteredScores = useMemo(() => {
    if (selectedCategory === 'all') return uniquenessScores;
    return uniquenessScores.filter(score => score.category === selectedCategory);
  }, [uniquenessScores, selectedCategory]);

  const categories = useMemo(() => {
    return ['all', ...Object.keys(categoryStats)];
  }, [categoryStats]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">独自性スコアを計算中...</p>
        </div>
      </div>
    );
  }

  if (uniquenessScores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto w-16 h-16 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            埋め込みベクトルがありません
          </h3>
          <p className="text-gray-600">
            独自性分析には埋め込みベクトルが必要です。<br />
            企業管理画面でMVV抽出を実行してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Star className="mr-3 h-8 w-8 text-yellow-500" />
              企業独自性スコア分析
            </h2>
            <p className="text-gray-600 mt-1">
              類似度マトリックスから算出した企業の独自性評価
            </p>
          </div>
          <div className="text-sm text-gray-500">
            対象企業: {uniquenessScores.length}社
          </div>
        </div>
      </div>

      {/* カテゴリフィルター */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">カテゴリ:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">すべて</option>
            {categories.slice(1).map(category => (
              <option key={category} value={category}>
                {category} ({categoryStats[category]?.count || 0}社)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* トップ10独自性企業 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="mr-2 h-5 w-5 text-gold-500" />
          独自性ランキング {selectedCategory !== 'all' ? `(${selectedCategory})` : ''}
        </h3>
        
        <div className="grid gap-4">
          {filteredScores.slice(0, 10).map((score, index) => (
            <div
              key={score.companyId}
              className={`p-4 rounded-lg border-l-4 ${
                index === 0 ? 'border-l-yellow-500 bg-yellow-50' :
                index === 1 ? 'border-l-gray-400 bg-gray-50' :
                index === 2 ? 'border-l-amber-600 bg-amber-50' :
                'border-l-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-amber-600 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{score.companyName}</div>
                    <div className="text-sm text-gray-600">{score.category}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {(score.uniquenessScore * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    独自性スコア
                  </div>
                </div>
              </div>
              
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">平均類似度:</span>
                  <span className="ml-1 font-medium">{(score.avgSimilarity * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">最高類似度:</span>
                  <span className="ml-1 font-medium">{(score.maxSimilarity * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">類似企業:</span>
                  <span className="ml-1 font-medium">{score.similarCompaniesCount}社</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* カテゴリ別統計 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
          カテゴリ別独自性統計
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(categoryStats).map(([category, stats]: [string, any]) => (
            <div key={category} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
              <div className="font-semibold text-gray-900 mb-2">{category}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">企業数:</span>
                  <span className="font-medium">{stats.count}社</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">平均独自性:</span>
                  <span className="font-medium">{(stats.avgUniqueness * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最高独自性:</span>
                  <span className="font-medium">{(stats.maxUniqueness * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最低独自性:</span>
                  <span className="font-medium">{(stats.minUniqueness * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};