import React, { useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { Search, Building2, TrendingUp, Eye, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { HybridCompany } from '../../services/hybridDataLoader';
import { TinySegmenter } from '@birchill/tiny-segmenter';

const SimilarCompanyFinder: React.FC = () => {
  const { 
    getFilteredCompanies, 
    getSimilarCompanies, 
    selectedCompany, 
    setSelectedCompany,
    getCacheStats,
    data,
    filters
  } = useAnalysisStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSimilarity, setExpandedSimilarity] = useState<string | null>(null);
  
  const companies = getFilteredCompanies();
  
  
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const similarCompanies = selectedCompany 
    ? getSimilarCompanies(selectedCompany.id, 10)
    : [];

  const handleCompanySelect = (company: HybridCompany) => {
    setSelectedCompany(company);
    setSearchTerm('');
  };

  const formatConfidenceScore = (scores: HybridCompany['confidenceScores']) => {
    if (!scores || typeof scores !== 'object') {
      return '0.00';
    }
    const avg = (scores.mission + scores.vision + scores.values) / 3;
    return avg.toFixed(2);
  };

  // 形態素解析を使ったテキスト類似度分析
  const analyzeTextSimilarity = (company1: HybridCompany, company2: HybridCompany) => {
    const calculateWordOverlap = (text1: string, text2: string) => {
      // TinySegmenterのインスタンス作成
      const segmenter = new TinySegmenter();

      const extractKeywords = (text: string) => {
        // 形態素解析で分かち書き
        const segments = segmenter.segment(text);
        
        // ストップワード定義
        const stopWords = new Set([
          'の', 'に', 'は', 'を', 'が', 'で', 'と', 'て', 'た', 'だ', 'し', 'た', 'り', 'れ', 'る', 'ら',
          'か', 'も', 'や', 'ば', 'ね', 'な', 'よ', 'な', 'へ', 'や', 'から', 'まで', 'より', 'では',
          'こと', 'もの', 'ため', 'とき', 'ところ', 'など', 'また', 'さらに', 'そして', 'しかし',
          'ただし', 'として', 'について', 'において', 'により', 'による', 'です', 'ます', 'である',
          'した', 'して', 'する', 'され', 'させ', 'られ', 'いる', 'ある', 'なる', 'やっ', 'いっ',
          'その', 'この', 'それ', 'あの', 'どの', 'すべて', 'わたし', 'わたくし', 'あなた', 'これ'
        ]);
        
        // 重要な医療・ビジネス用語の辞書
        const importantTerms = new Set([
          '医療', '健康', '患者', '社会', '貢献', '技術', '品質', '安全', '信頼', '価値',
          '生活', '福祉', '課題', '解決', '未来', '革新', '発展', '成長', '向上', '実現',
          '提供', 'サービス', '商品', '企業', '事業', '人々', '豊か', '使命', '責任',
          '尊重', '誠実', 'ケア', '創造', 'イノベーション', '支援', '改善', '発明',
          'いのち', '生命', '命', '治療', '診断', '予防', '看護', '介護', '福祉',
          'グローバル', '国際', '世界', '地域', '地球', '環境', '持続', '可能',
          '最高', '最良', '最適', '優秀', '優れた', '高度', '先進', '最新', '現場',
          '目指す', '追求', '実現', '貢献', '発展', '向上', '改善', '革新', '創出'
        ]);
        
        // フィルタリングとキーワード抽出
        const keywords = segments
          .filter((word: string) => {
            // 基本フィルター
            if (word.length < 2) return false;
            if (stopWords.has(word)) return false;
            if (/^[ぁ-ん]+$/.test(word)) return false; // ひらがなのみ除外
            if (/^[0-9]+$/.test(word)) return false; // 数字のみ除外
            if (/^[a-zA-Z]+$/.test(word)) return false; // 英字のみ除外
            
            return true;
          })
          .map((word: string) => {
            // 語尾の活用形を正規化
            const normalized = word
              .replace(/[っ]$/, '') // 「やっ」→「や」
              .replace(/[する|した|します|しま|して]$/, '') // 動詞活用を除去
              .replace(/[です|ます|である]$/, ''); // 敬語・断定を除去
            
            return normalized.length >= 2 ? normalized : word;
          })
          .filter((word: string) => word.length >= 2);
        
        // 重要語を優先し、頻度でソート
        const wordCounts = keywords.reduce((acc: Record<string, number>, word: string) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const sortedKeywords = Object.keys(wordCounts)
          .sort((a, b) => {
            // 重要語を優先
            const aImportant = importantTerms.has(a);
            const bImportant = importantTerms.has(b);
            if (aImportant && !bImportant) return -1;
            if (!aImportant && bImportant) return 1;
            
            // 頻度でソート
            const freqDiff = wordCounts[b] - wordCounts[a];
            if (freqDiff !== 0) return freqDiff;
            
            // 長さでソート
            return b.length - a.length;
          })
          .slice(0, 12); // 上位12語に限定
        
        return sortedKeywords;
      };

      const words1 = extractKeywords(text1);
      const words2 = extractKeywords(text2);
      
      // 形態素解析結果に適した一致判定
      const findMatches = (arr1: string[], arr2: string[]) => {
        const matches: string[] = [];
        const processed = new Set<string>();
        
        arr1.forEach(word1 => {
          arr2.forEach(word2 => {
            const key = [word1, word2].sort().join('|');
            if (processed.has(key)) return;
            processed.add(key);
            
            // 完全一致
            if (word1 === word2) {
              matches.push(word1);
            }
            // 語根が共通している場合（医療分野特有の語彙）
            else if (word1.length >= 2 && word2.length >= 2) {
              // 医療関連の語根マッチング
              if (
                (word1.includes('医療') && word2.includes('医療')) ||
                (word1.includes('健康') && word2.includes('健康')) ||
                (word1.includes('患者') && word2.includes('患者')) ||
                (word1.includes('社会') && word2.includes('社会')) ||
                (word1.includes('価値') && word2.includes('価値')) ||
                (word1.includes('生活') && word2.includes('生活')) ||
                (word1.includes('安全') && word2.includes('安全')) ||
                (word1.includes('品質') && word2.includes('品質')) ||
                (word1.includes('技術') && word2.includes('技術')) ||
                (word1.includes('信頼') && word2.includes('信頼'))
              ) {
                // より具体的な語を採用
                matches.push(word1.length > word2.length ? word1 : word2);
              }
              // 包含関係（「医療」と「医療機器」など）
              else if (word1.length <= word2.length && word2.includes(word1) && word1.length >= 2) {
                matches.push(word2); // より長い語を採用
              } else if (word2.length <= word1.length && word1.includes(word2) && word2.length >= 2) {
                matches.push(word1); // より長い語を採用
              }
            }
          });
        });
        
        // 重複除去と重要度でソート
        return [...new Set(matches)]
          .sort((a, b) => {
            // 重要な医療用語を優先
            const medicalTerms = ['医療', '健康', '患者', '社会', '価値', '品質', '安全', '技術'];
            const aIsMedical = medicalTerms.some(term => a.includes(term));
            const bIsMedical = medicalTerms.some(term => b.includes(term));
            
            if (aIsMedical && !bIsMedical) return -1;
            if (!aIsMedical && bIsMedical) return 1;
            
            // 長さでソート
            return b.length - a.length;
          });
      };

      const commonWords = findMatches(words1, words2);
      const union = [...new Set([...words1, ...words2])];
      
      return {
        overlap: commonWords.length,
        jaccard: commonWords.length / Math.max(union.length, 1),
        commonWords,
        words1, // デバッグ用
        words2  // デバッグ用
      };
    };

    return {
      mission: calculateWordOverlap(company1.mission, company2.mission),
      vision: calculateWordOverlap(company1.vision, company2.vision),
      values: calculateWordOverlap(company1.values, company2.values)
    };
  };

  // 類似度の理由を説明
  const explainSimilarity = (company1: HybridCompany, company2: HybridCompany, similarity: number) => {
    const analysis = analyzeTextSimilarity(company1, company2);
    const reasons = [];

    if (analysis.mission.overlap > 0) {
      reasons.push(`Mission共通語: ${analysis.mission.commonWords.slice(0, 3).join('、')}`);
    }
    if (analysis.vision.overlap > 0) {
      reasons.push(`Vision共通語: ${analysis.vision.commonWords.slice(0, 3).join('、')}`);
    }
    if (analysis.values.overlap > 0) {
      reasons.push(`Values共通語: ${analysis.values.commonWords.slice(0, 3).join('、')}`);
    }

    if (company1.category === company2.category) {
      reasons.push(`同業界: ${company1.category}`);
    }

    if (similarity > 0.8) {
      reasons.push('非常に高い意味的類似性');
    } else if (similarity > 0.6) {
      reasons.push('高い意味的類似性');
    } else if (similarity > 0.4) {
      reasons.push('中程度の意味的類似性');
    }

    return reasons.length > 0 ? reasons : ['AI埋め込みベクトルでの意味的類似性'];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 企業選択パネル */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Search className="mr-2 h-5 w-5 text-blue-500" />
              企業を選択
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              類似企業を調べたい企業を選択してください
            </p>
          </div>
          
          <div className="p-6">
            {/* 検索フィールド */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="企業名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>


            {/* 企業リスト */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCompanies.slice(0, 20).map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleCompanySelect(company)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCompany?.id === company.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-600">{company.category}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      信頼度: {formatConfidenceScore(company.confidenceScores)}
                    </div>
                  </div>
                </button>
              ))}
              
              {filteredCompanies.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  該当する企業が見つかりません
                </div>
              )}
              
              {filteredCompanies.length > 20 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  {filteredCompanies.length - 20}社の企業が追加で見つかりました
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 選択企業の詳細 */}
        {selectedCompany && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Building2 className="mr-2 h-5 w-5 text-green-500" />
                選択企業の詳細
              </h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{selectedCompany.name}</h4>
                  <p className="text-sm text-gray-600">{selectedCompany.category}</p>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Mission</h5>
                  <p className="text-sm text-gray-600">{selectedCompany.mission}</p>
                </div>
                
                {selectedCompany.vision && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-1">Vision</h5>
                    <p className="text-sm text-gray-600">{selectedCompany.vision}</p>
                  </div>
                )}
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Values</h5>
                  <p className="text-sm text-gray-600">{selectedCompany.values}</p>
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-blue-600">
                        {selectedCompany.confidenceScores?.mission?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Mission</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-green-600">
                        {selectedCompany.confidenceScores?.vision?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Vision</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-purple-600">
                        {selectedCompany.confidenceScores?.values?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Values</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 類似企業表示パネル */}
      <div className="space-y-6">
        {selectedCompany ? (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-purple-500" />
                類似企業ランキング
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCompany.name} と最も類似するMVVを持つ企業
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {similarCompanies.map((similar, index) => {
                  const isExpanded = expandedSimilarity === similar.company.id;
                  const similarityReasons = selectedCompany 
                    ? explainSimilarity(selectedCompany, similar.company, similar.similarity)
                    : [];
                  const textAnalysis = selectedCompany 
                    ? analyzeTextSimilarity(selectedCompany, similar.company)
                    : null;

                  return (
                    <div key={similar.company.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900">{similar.company.name}</div>
                            <div className="text-sm text-gray-600">{similar.company.category}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-purple-600">
                            {similar.similarity.toFixed(3)}
                          </div>
                          <div className="text-xs text-gray-500">類似度</div>
                        </div>
                      </div>
                      
                      {/* 類似度の理由 */}
                      <div className="mb-3">
                        <div className="text-sm text-gray-700 mb-2">
                          <strong>類似理由:</strong>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {similarityReasons.slice(0, 2).map((reason, idx) => {
                            // 理由の種類に応じて色を決定
                            let colorClass = "bg-blue-50 text-blue-700";
                            if (reason.includes('Mission')) {
                              colorClass = "bg-green-50 text-green-700";
                            } else if (reason.includes('Vision')) {
                              colorClass = "bg-blue-50 text-blue-700";
                            } else if (reason.includes('Values')) {
                              colorClass = "bg-purple-50 text-purple-700";
                            } else if (reason.includes('同業界')) {
                              colorClass = "bg-orange-50 text-orange-700";
                            } else if (reason.includes('意味的類似性')) {
                              colorClass = "bg-indigo-50 text-indigo-700";
                            }

                            return (
                              <span 
                                key={idx}
                                className={`inline-block px-2 py-1 text-xs rounded ${colorClass}`}
                              >
                                {reason}
                              </span>
                            );
                          })}
                          {similarityReasons.length > 2 && (
                            <button
                              onClick={() => setExpandedSimilarity(isExpanded ? null : similar.company.id)}
                              className="inline-flex items-center px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded hover:bg-gray-100"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  簡易表示
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  +{similarityReasons.length - 2}個
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 詳細分析（展開時） */}
                      {isExpanded && textAnalysis && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="font-medium text-gray-700 mb-2">詳細分析:</div>
                          <div className="space-y-2">
                            {textAnalysis.mission.overlap > 0 ? (
                              <div>
                                <span className="font-medium text-green-600">Mission共通語({textAnalysis.mission.overlap}):</span>
                                <span className="ml-2 text-gray-600">
                                  {textAnalysis.mission.commonWords.join('、')}
                                </span>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Mission: 共通キーワードなし
                              </div>
                            )}
                            
                            {textAnalysis.vision.overlap > 0 ? (
                              <div>
                                <span className="font-medium text-blue-600">Vision共通語({textAnalysis.vision.overlap}):</span>
                                <span className="ml-2 text-gray-600">
                                  {textAnalysis.vision.commonWords.join('、')}
                                </span>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Vision: 共通キーワードなし
                              </div>
                            )}
                            
                            {textAnalysis.values.overlap > 0 ? (
                              <div>
                                <span className="font-medium text-purple-600">Values共通語({textAnalysis.values.overlap}):</span>
                                <span className="ml-2 text-gray-600">
                                  {textAnalysis.values.commonWords.join('、')}
                                </span>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Values: 共通キーワードなし
                              </div>
                            )}

                            
                            {/* 全理由リスト */}
                            <div className="mt-2">
                              <span className="font-medium text-gray-700">全ての類似要因:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {similarityReasons.map((reason, idx) => {
                                  // 理由の種類に応じて色を決定
                                  let colorClass = "bg-blue-50 text-blue-700";
                                  if (reason.includes('Mission')) {
                                    colorClass = "bg-green-50 text-green-700";
                                  } else if (reason.includes('Vision')) {
                                    colorClass = "bg-blue-50 text-blue-700";
                                  } else if (reason.includes('Values')) {
                                    colorClass = "bg-purple-50 text-purple-700";
                                  } else if (reason.includes('同業界')) {
                                    colorClass = "bg-orange-50 text-orange-700";
                                  } else if (reason.includes('意味的類似性')) {
                                    colorClass = "bg-indigo-50 text-indigo-700";
                                  }

                                  return (
                                    <span 
                                      key={idx}
                                      className={`inline-block px-2 py-1 text-xs rounded ${colorClass}`}
                                    >
                                      {reason}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          信頼度: {formatConfidenceScore(similar.company.confidenceScores)}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setExpandedSimilarity(isExpanded ? null : similar.company.id)}
                            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                詳細を隠す
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                詳細分析
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleCompanySelect(similar.company)}
                            className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            詳細を見る
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {similarCompanies.length === 0 && selectedCompany && (
                  <div className="text-center py-8 text-gray-500">
                    {selectedCompany.source === 'api' ? (
                      <div>
                        <div className="mb-2">🔄 新しく追加された企業です</div>
                        <div className="text-sm">
                          類似度マトリックスは次回のシステム更新時に計算されます。<br />
                          現在は形態素解析による共通語分析のみ利用可能です。
                        </div>
                      </div>
                    ) : (
                      '類似企業データがありません'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="p-12 text-center">
              <Search className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                企業を選択してください
              </h3>
              <p className="text-gray-600">
                左側から企業を選択すると、<br />
                その企業と類似するMVVを持つ企業が表示されます
              </p>
              <ArrowRight className="mx-auto h-8 w-8 text-gray-300 mt-4 transform rotate-180" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimilarCompanyFinder;