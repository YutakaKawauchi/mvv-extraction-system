import React, { useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { Building2, TrendingUp, Users, BarChart3, Filter } from 'lucide-react';

const IndustryAnalysis: React.FC = () => {
  const { data } = useAnalysisStore();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  if (!data) return null;

  const { categoryAnalysis } = data;
  
  // 業界別データを配列に変換し、フィルター適用、ソート
  const allIndustryData = Object.entries(categoryAnalysis)
    .map(([category, analysis]) => ({
      category,
      companyCount: analysis.companies.length,
      coherenceIndex: analysis.avgInternalSimilarity - analysis.avgExternalSimilarity,
      ...analysis
    }));
    
  const industryData = selectedCategories.length === 0 
    ? allIndustryData
    : allIndustryData.filter(industry => selectedCategories.includes(industry.category));
    
  const sortedIndustryData = industryData.sort((a, b) => b.avgInternalSimilarity - a.avgInternalSimilarity);

  const maxInternalSimilarity = Math.max(...sortedIndustryData.map(d => d.avgInternalSimilarity));
  const maxExternalSimilarity = Math.max(...sortedIndustryData.map(d => d.avgExternalSimilarity));
  const maxCoherenceIndex = Math.max(...sortedIndustryData.map(d => d.coherenceIndex));
  
  const allCategories = Object.keys(categoryAnalysis);
  
  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const showAllCategories = () => setSelectedCategories([]);

  return (
    <div className="space-y-8">
      {/* 業界フィルター */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">業界フィルター</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={showAllCategories}
              className={`px-3 py-1 rounded text-sm ${
                selectedCategories.length === 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全業界表示
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {allCategories.map(category => (
            <button
              key={category}
              onClick={() => handleCategoryToggle(category)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategories.includes(category)
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
              {selectedCategories.includes(category) && (
                <span className="ml-1 text-blue-600">✓</span>
              )}
            </button>
          ))}
        </div>
        
        {selectedCategories.length > 0 && (
          <div className="mt-3 text-sm text-gray-600">
            {selectedCategories.length}業界を選択中 ({sortedIndustryData.length}業界表示)
          </div>
        )}
      </div>

      {/* 概要統計 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-blue-100 text-blue-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    業界数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {sortedIndustryData.length}
                  </dd>
                  <dd className="text-xs text-gray-500 mt-1">
                    ヘルスケア関連業界
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-green-100 text-green-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    最高業界内類似度
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {maxInternalSimilarity.toFixed(3)}
                  </dd>
                  <dd className="text-xs text-gray-500 mt-1">
                    {sortedIndustryData[0]?.category || '-'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-purple-100 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    最大企業数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {sortedIndustryData.length > 0 ? Math.max(...sortedIndustryData.map(d => d.companyCount)) : 0}社
                  </dd>
                  <dd className="text-xs text-gray-500 mt-1">
                    {sortedIndustryData.find(d => d.companyCount === Math.max(...sortedIndustryData.map(d => d.companyCount)))?.category || '-'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 rounded-md p-3 bg-yellow-100 text-yellow-600">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div className="ml-4 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    最高一貫性指数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {maxCoherenceIndex.toFixed(3)}
                  </dd>
                  <dd className="text-xs text-gray-500 mt-1">
                    業界内結束度
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 業界別詳細分析 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            業界別MVV類似度分析
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            各業界内での類似度と他業界との比較
          </p>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {sortedIndustryData.map((industry) => (
              <div key={industry.category} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{industry.category}</h4>
                    <p className="text-sm text-gray-600">{industry.companyCount}社</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">一貫性指数</div>
                    <div className="text-xl font-bold text-blue-600">
                      {industry.coherenceIndex.toFixed(3)}
                    </div>
                  </div>
                </div>

                {/* プログレスバー表示 */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">業界内平均類似度</span>
                      <span className="font-medium text-green-600">
                        {industry.avgInternalSimilarity.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(industry.avgInternalSimilarity / maxInternalSimilarity) * 100}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">業界間平均類似度</span>
                      <span className="font-medium text-blue-600">
                        {industry.avgExternalSimilarity.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(industry.avgExternalSimilarity / maxExternalSimilarity) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 業界特徴の解釈 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    {industry.coherenceIndex > 0.05 ? (
                      <span className="text-green-700">
                        🎯 <strong>高い業界一貫性</strong>: この業界の企業は共通したMVVパターンを持っています
                      </span>
                    ) : industry.coherenceIndex > 0.02 ? (
                      <span className="text-yellow-700">
                        ⚖️ <strong>中程度の業界一貫性</strong>: 業界内である程度の共通性があります
                      </span>
                    ) : (
                      <span className="text-orange-700">
                        🌐 <strong>多様な業界特性</strong>: 他業界と同程度の類似性を示しています
                      </span>
                    )}
                  </div>
                </div>

                {/* 代表企業 */}
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">代表企業:</div>
                  <div className="flex flex-wrap gap-2">
                    {industry.companies.slice(0, 6).map((company) => (
                      <span 
                        key={company.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {company.name}
                      </span>
                    ))}
                    {industry.companies.length > 6 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                        +{industry.companies.length - 6}社
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 業界間比較マトリックス */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            業界一貫性ランキング
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            業界内類似度 - 業界間類似度の差分（一貫性指数）
          </p>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {sortedIndustryData
              .sort((a, b) => b.coherenceIndex - a.coherenceIndex)
              .map((industry, index) => (
                <div key={industry.category} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{industry.category}</div>
                      <div className="text-sm text-gray-600">{industry.companyCount}社</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {industry.coherenceIndex.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500">一貫性指数</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustryAnalysis;