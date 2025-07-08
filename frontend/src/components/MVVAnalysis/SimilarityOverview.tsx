import React from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { TrendingUp, Users, Building2, Star } from 'lucide-react';

const SimilarityOverview: React.FC = () => {
  const { data } = useAnalysisStore();

  if (!data) return null;

  const { summary, topSimilarities } = data;

  const stats = [
    {
      name: '分析対象企業数',
      value: summary.totalCompanies,
      icon: Building2,
      description: '完全なMVVデータを持つ企業',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      name: '平均類似度',
      value: summary.avgSimilarity.toFixed(3),
      icon: TrendingUp,
      description: '全企業ペア間の平均値',
      color: 'text-green-600 bg-green-100'
    },
    {
      name: '業界カテゴリ数',
      value: Object.keys(summary.categoryAnalysis).length,
      icon: Users,
      description: 'ヘルスケア関連業界',
      color: 'text-purple-600 bg-purple-100'
    },
    {
      name: '最高類似度',
      value: summary.maxSimilarity.toFixed(3),
      icon: Star,
      description: '最も類似する企業ペア',
      color: 'text-yellow-600 bg-yellow-100'
    }
  ];

  return (
    <div className="space-y-8">
      {/* 統計情報 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white overflow-hidden rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-md p-3 ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </dd>
                      <dd className="text-xs text-gray-500 mt-1">
                        {stat.description}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 最類似企業ペア */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Star className="mr-2 h-5 w-5 text-yellow-500" />
            最も類似する企業ペア
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            MVVの内容が最も似ている企業同士
          </p>
        </div>
        
        <div className="p-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.maxSimilarPair[0].name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {summary.maxSimilarPair[0].category}
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ⟷
                  </div>
                  <div className="text-lg font-semibold text-blue-600">
                    {summary.maxSimilarity.toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-500">
                    類似度
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.maxSimilarPair[1].name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {summary.maxSimilarPair[1].category}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* トップ類似企業リスト */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            類似度の高い企業ペア Top 10
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            MVVの類似性が高い企業組み合わせ
          </p>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {topSimilarities.slice(0, 10).map((similarity, index) => (
              <div key={similarity.company.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {similarity.company.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {similarity.company.category}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pl-11">
                  <div className="text-sm text-gray-600 mb-2">最類似企業:</div>
                  <div className="space-y-2">
                    {similarity.mostSimilar.slice(0, 3).map((similar, similarIndex) => (
                      <div key={similarIndex} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <div>
                          <span className="font-medium text-gray-900">{similar.name}</span>
                          <span className="text-sm text-gray-600 ml-2">({similar.category})</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-600">
                          {similar.similarity.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimilarityOverview;