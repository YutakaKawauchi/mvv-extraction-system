import React, { useMemo, useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { LoadingSpinner } from '../common';
import { Cloud, Filter } from 'lucide-react';
import { enhancedSegmentationService } from '../../services/enhancedSegmentationService';
import { WordCloud } from './WordCloud';

interface KeywordFrequency {
  keyword: string;
  frequency: number;
  categories: string[];
  companies: string[];
  type: 'mission' | 'vision' | 'values';
}

export const WordCloudDashboard: React.FC = () => {
  const { data, isLoading } = useAnalysisStore();
  const [selectedType, setSelectedType] = useState<'all' | 'mission' | 'vision' | 'values'>('all');
  const [categoryLevel, setCategoryLevel] = useState<'major' | 'middle'>('major');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minFrequency, setMinFrequency] = useState<number>(2);
  const [industryFocus, setIndustryFocus] = useState<'general' | 'healthcare' | 'technology'>('general');
  const [selectedWordDetails, setSelectedWordDetails] = useState<{
    keyword: string;
    companies: Array<{
      name: string;
      text: string;
      type: 'mission' | 'vision' | 'values';
    }>;
  } | null>(null);

  // Enhanced segmentation service for better compound word handling
  const segmentationOptions = useMemo(() => ({
    preserveCompounds: true,
    enableCustomRules: true,
    industryFocus
  }), [industryFocus]);

  // Helper function to get middle category name for a company
  const getCompanyMiddleCategoryName = (companyName: string): string => {
    const hybridCompany = data?.companies?.find(c => c.name === companyName);
    return hybridCompany?.category || '未分類';
  };

  const { keywordAnalysis, loading } = useMemo(() => {
    if (!data || !data.companies) {
      return { keywordAnalysis: [], loading: true };
    }

    console.log('🔄 ワードクラウド用キーワード分析開始...');
    const startTime = performance.now();

    // 有効な企業のみフィルター
    const validCompanies = data.companies.filter(company => 
      company.mission || company.vision || company.values
    );

    if (validCompanies.length === 0) {
      return { keywordAnalysis: [], loading: false };
    }

    console.log(`☁️ ${validCompanies.length}社でワードクラウド分析実行中...`);

    // キーワード抽出と頻度計算
    const keywordMap = new Map<string, KeywordFrequency>();

    const processText = (text: string, type: 'mission' | 'vision' | 'values', companyName: string, category: string) => {
      if (!text) return;

      const segmentationResult = enhancedSegmentationService.segmentWithCompounds(text, segmentationOptions);
      const words = segmentationResult.segments;
      const filteredWords = words.filter((word: string) => {
        // 意味のある単語のみ抽出
        return word.length >= 2 && 
               !['です', 'ます', 'である', 'として', 'により', 'という', 'こと', 'もの', 'ため', 'など'].includes(word) &&
               !/^[0-9]+$/.test(word) && // 数字のみ除外
               !/^[ぁ-ん]+$/.test(word) && // ひらがなのみ除外
               !/__COMPOUND_\d+__/.test(word) && // 保護トークンの残存を除外
               !/COMPOUND/.test(word); // 部分的なトークン残存も除外
      });

      filteredWords.forEach((word: string) => {
        const key = `${word}_${type}`;
        if (!keywordMap.has(key)) {
          keywordMap.set(key, {
            keyword: word,
            frequency: 0,
            categories: [],
            companies: [],
            type
          });
        }
        
        const keywordData = keywordMap.get(key)!;
        keywordData.frequency++;
        
        if (!keywordData.categories.includes(category)) {
          keywordData.categories.push(category);
        }
        
        if (!keywordData.companies.includes(companyName)) {
          keywordData.companies.push(companyName);
        }
      });
    };

    validCompanies.forEach(company => {
      processText(company.mission || '', 'mission', company.name, company.category);
      processText(company.vision || '', 'vision', company.name, company.category);
      processText(company.values || '', 'values', company.name, company.category);
    });

    const keywordAnalysis = Array.from(keywordMap.values())
      .filter(kw => kw.frequency >= minFrequency)
      .sort((a, b) => b.frequency - a.frequency);

    const endTime = performance.now();
    console.log(`✅ ワードクラウド分析完了: ${Math.round(endTime - startTime)}ms`);

    return { keywordAnalysis, loading: false };
  }, [data, segmentationOptions, minFrequency, categoryLevel, getCompanyMiddleCategoryName]);

  const filteredKeywords = useMemo(() => {
    let filtered = keywordAnalysis;

    if (selectedType !== 'all') {
      filtered = filtered.filter(kw => kw.type === selectedType);
    }

    if (selectedCategory !== 'all') {
      if (categoryLevel === 'major') {
        filtered = filtered.filter(kw => kw.categories.includes(selectedCategory));
      } else {
        if (!data?.companies) return filtered;
        const companyNames = new Set(
          data.companies
            .filter(company => getCompanyMiddleCategoryName(company.name) === selectedCategory)
            .map(c => c.name)
        );
        filtered = filtered.filter(kw => 
          kw.companies.some(companyName => companyNames.has(companyName))
        );
      }
    }

    return filtered;
  }, [keywordAnalysis, selectedType, selectedCategory, categoryLevel, data, getCompanyMiddleCategoryName]);

  // 利用可能なカテゴリを動的に生成
  const categories = useMemo(() => {
    if (!data || !data.companies) return ['all'];
    
    if (categoryLevel === 'major') {
      const majorCategories = new Set<string>();
      data.companies.forEach(company => {
        if (company.category) {
          majorCategories.add(company.category);
        }
      });
      return ['all', ...Array.from(majorCategories).sort()];
    } else {
      const middleCategories = new Set<string>();
      data.companies.forEach(company => {
        const middleName = getCompanyMiddleCategoryName(company.name);
        if (middleName !== '未分類') {
          middleCategories.add(middleName);
        }
      });
      return ['all', ...Array.from(middleCategories).sort()];
    }
  }, [data, categoryLevel, getCompanyMiddleCategoryName]);

  // ワードクラウド用のデータ変換
  const wordCloudData = useMemo(() => {
    return filteredKeywords.map(kw => ({
      text: kw.keyword,
      frequency: kw.frequency,
      type: kw.type,
      companies: kw.companies
    }));
  }, [filteredKeywords]);

  // ワードクリック時の詳細情報取得
  const handleWordClick = (word: { text: string; type: 'mission' | 'vision' | 'values'; companies?: string[] }) => {
    if (!data?.companies || !word.companies) return;

    const companyDetails = word.companies.map(companyName => {
      const company = data.companies.find(c => c.name === companyName);
      if (!company) return null;

      let text = '';
      switch (word.type) {
        case 'mission':
          text = company.mission || '';
          break;
        case 'vision':
          text = company.vision || '';
          break;
        case 'values':
          text = company.values || '';
          break;
      }

      return {
        name: companyName,
        text,
        type: word.type
      };
    }).filter(Boolean) as Array<{
      name: string;
      text: string;
      type: 'mission' | 'vision' | 'values';
    }>;

    setSelectedWordDetails({
      keyword: word.text,
      companies: companyDetails
    });
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">ワードクラウドを生成中...</p>
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
              <Cloud className="mr-3 h-8 w-8 text-purple-500" />
              MVVキーワードワードクラウド
            </h2>
            <p className="text-gray-600 mt-1">
              拡張形態素解析（複合語保持）で抽出されたキーワードを視覚的に表示
            </p>
          </div>
          <div className="text-sm text-gray-500">
            対象キーワード: {filteredKeywords.length}個
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">フィルター設定</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MVVタイプ:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">すべて</option>
              <option value="mission">ミッション</option>
              <option value="vision">ビジョン</option>
              <option value="values">バリュー</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分類レベル:</label>
            <select
              value={categoryLevel}
              onChange={(e) => {
                setCategoryLevel(e.target.value as 'major' | 'middle');
                setSelectedCategory('all');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="major">大分類（20分類）</option>
              <option value="middle">中分類（詳細）</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {categoryLevel === 'major' ? 'JSIC大分類' : 'JSIC中分類'}:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'すべて' : category}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">最小頻度:</label>
            <select
              value={minFrequency}
              onChange={(e) => setMinFrequency(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={1}>1回以上</option>
              <option value={2}>2回以上</option>
              <option value={3}>3回以上</option>
              <option value={5}>5回以上</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">業界フォーカス:</label>
            <select
              value={industryFocus}
              onChange={(e) => setIndustryFocus(e.target.value as 'general' | 'healthcare' | 'technology')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="general">汎用</option>
              <option value="healthcare">医療・ヘルスケア</option>
              <option value="technology">技術・IT</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              表示: {filteredKeywords.length}キーワード
            </div>
          </div>
        </div>
      </div>

      {/* ワードクラウド表示 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Cloud className="mr-2 h-5 w-5 text-purple-500" />
          インタラクティブワードクラウド
        </h3>
        
        <div className="flex justify-center">
          <WordCloud 
            words={wordCloudData} 
            width={800} 
            height={500} 
            maxWords={100}
            onWordClick={handleWordClick}
          />
        </div>
        
        <div className="mt-4 text-sm text-gray-600 text-center space-y-1">
          <p>フォントサイズは出現頻度に比例します。色は種類を表します（緑：ミッション、青：ビジョン、紫：バリュー）</p>
          <p>キーワードをクリックすると、使用している企業の詳細が表示されます</p>
          <p>🖱️ マウスホイールでズーム、ドラッグで移動できます</p>
        </div>
      </div>

      {/* 選択されたキーワードの詳細モーダル */}
      {selectedWordDetails && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSelectedWordDetails(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  「{selectedWordDetails.keyword}」を含む{
                    selectedWordDetails.companies[0]?.type === 'mission' ? 'ミッション' :
                    selectedWordDetails.companies[0]?.type === 'vision' ? 'ビジョン' : 'バリュー'
                  }
                </h3>
                <button
                  onClick={() => setSelectedWordDetails(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedWordDetails.companies.length}社が使用しています
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {selectedWordDetails.companies.map((company, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center mb-2">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        company.type === 'mission' ? 'bg-green-500' :
                        company.type === 'vision' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}></div>
                      <h4 className="font-medium text-gray-900">{company.name}</h4>
                    </div>
                    <div className="mt-2">
                      <p 
                        className="text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: company.text.replace(
                            new RegExp(`(${selectedWordDetails.keyword})`, 'gi'), 
                            '<mark class="bg-yellow-200 px-1 rounded font-medium">$1</mark>'
                          )
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};