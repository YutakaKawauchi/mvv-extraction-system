/**
 * Enhanced Similar Company Finder for Unified Dashboard
 * Migrated from Phase 2-b EmbeddingsSimilarCompanyFinder with real-time analysis
 */

import React, { useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { Search, Building2, TrendingUp, Eye, ArrowRight, ChevronDown, ChevronUp, Loader2, Info, Copy, X, Pin, FileText } from 'lucide-react';
import type { HybridCompany } from '../../services/hybridDataLoader';
import type { CompanyWithSimilarity } from '../../services/similarityCalculator';
import { SimilarityCalculator } from '../../services/similarityCalculator';
import { ProgressiveCalculator } from '../../services/progressiveCalculator';
import { similarityCache } from '../../services/similarityCache';
import { enhancedSegmentationService } from '../../services/enhancedSegmentationService';

const SimilarCompanyFinder: React.FC = () => {
  const { 
    getFilteredCompanies, 
    getSimilarCompanies, 
    selectedCompany, 
    setSelectedCompany
  } = useAnalysisStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSimilarity, setExpandedSimilarity] = useState<string | null>(null);
  const [progressiveResults, setProgressiveResults] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [pinnedTooltips, setPinnedTooltips] = useState<Set<string>>(new Set());
  const [industryFocus, _setIndustryFocus] = useState<'general' | 'healthcare' | 'technology'>('general');
  
  const companies = getFilteredCompanies();
  
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.category || '未分類').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 外側クリック時にピン留めを解除
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tooltip-container]')) {
        setPinnedTooltips(new Set());
      }
    };

    if (pinnedTooltips.size > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [pinnedTooltips]);

  const handleCompanySelect = async (company: HybridCompany) => {
    setSelectedCompany(company);
    setSearchTerm('');
    setIsCalculating(true);
    setCalculationProgress(0);
    
    // Use progressive calculator for optimized similarity calculation
    const progressiveCalculator = new ProgressiveCalculator();
    
    try {
      await progressiveCalculator.findSimilarCompanies(
        company,
        companies,
        10,
        (results) => {
          setProgressiveResults(results);
          const enhancedCount = results.filter(r => r.isEnhanced).length;
          setCalculationProgress(enhancedCount / results.length);
        }
      );
    } catch (error) {
      console.error('Progressive calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const formatConfidenceScore = (scores?: { mission: number; vision: number; values: number }) => {
    if (!scores || typeof scores !== 'object') {
      return '0.00';
    }
    const avg = (scores.mission + scores.vision + scores.values) / 3;
    return avg.toFixed(2);
  };

  // 形態素解析を使ったテキスト類似度分析 (デバッグ用)
  const analyzeTextSimilarity = (company1: HybridCompany, company2: HybridCompany) => {
    const calculateWordOverlap = (text1: string, text2: string) => {
      // 拡張形態素解析サービスを使用
      const segmentationOptions = {
        preserveCompounds: true,
        enableCustomRules: true,
        industryFocus
      };

      const extractKeywords = (text: string) => {
        // 拡張形態素解析で分かち書き（複合語保持）
        const segmentationResult = enhancedSegmentationService.segmentWithCompounds(text, segmentationOptions);
        const segments = segmentationResult.segments;
        
        // ストップワード定義
        const stopWords = new Set([
          'の', 'に', 'は', 'を', 'が', 'で', 'と', 'て', 'た', 'だ', 'し', 'た', 'り', 'れ', 'る', 'ら',
          'か', 'も', 'や', 'ば', 'ね', 'な', 'よ', 'な', 'へ', 'や', 'から', 'まで', 'より', 'では',
          'こと', 'もの', 'ため', 'とき', 'ところ', 'など', 'また', 'さらに', 'そして', 'しかし',
          'ただし', 'として', 'について', 'において', 'により', 'による', 'です', 'ます', 'である',
          'した', 'して', 'する', 'され', 'させ', 'られ', 'いる', 'ある', 'なる', 'やっ', 'いっ',
          'その', 'この', 'それ', 'あの', 'どの', 'すべて', 'わたし', 'わたくし', 'あなた', 'これ'
        ]);
        
        // 重要なビジネス・価値観用語の辞書（業界共通）
        const importantTerms = new Set([
          // 一般的な価値観・使命関連
          '社会', '貢献', '技術', '品質', '安全', '信頼', '価値', '生活', '課題', '解決', 
          '未来', '革新', '発展', '成長', '向上', '実現', '提供', 'サービス', '商品', '企業', 
          '事業', '人々', '豊か', '使命', '責任', '尊重', '誠実', '創造', 'イノベーション', 
          '支援', '改善', '発明', 'グローバル', '国際', '世界', '地域', '地球', '環境', 
          '持続', '可能', '最高', '最良', '最適', '優秀', '優れた', '高度', '先進', '最新', 
          '現場', '目指す', '追求', '実現', '貢献', '発展', '向上', '改善', '革新', '創出',
          
          // デジタル・IT関連
          'デジタル', 'AI', 'DX', 'データ', 'テクノロジー', 'プラットフォーム', 'ソリューション',
          'クラウド', 'システム', 'ネットワーク', 'セキュリティ', 'イノベーション',
          
          // 製造・産業関連
          '製造', '生産', 'ものづくり', '工場', '製品', '素材', '加工', '開発',
          
          // 金融・サービス関連
          '金融', '投資', '資産', 'ファイナンス', 'コンサルティング', 'アドバイザリー',
          
          // エネルギー・インフラ関連
          'エネルギー', '電力', 'インフラ', '建設', '都市', '交通', 'モビリティ',
          
          // 小売・消費財関連
          '顧客', 'カスタマー', '消費者', 'ブランド', 'マーケティング', '流通',
          
          // 医療・ヘルスケア関連（既存）
          '医療', '健康', '患者', '福祉', 'ケア', 'いのち', '生命', '命', '治療', 
          '診断', '予防', '看護', '介護'
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
            // 語根が共通している場合（業界特有の語彙）
            else if (word1.length >= 2 && word2.length >= 2) {
              // 語根マッチング
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
            // 重要な用語を優先
            const importantTerms = ['医療', '健康', '患者', '社会', '価値', '品質', '安全', '技術'];
            const aIsImportant = importantTerms.some(term => a.includes(term));
            const bIsImportant = importantTerms.some(term => b.includes(term));
            
            if (aIsImportant && !bIsImportant) return -1;
            if (!aIsImportant && bIsImportant) return 1;
            
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
      mission: calculateWordOverlap(company1.mission || '', company2.mission || ''),
      vision: calculateWordOverlap(company1.vision || '', company2.vision || ''),
      values: calculateWordOverlap(
        Array.isArray(company1.values) ? company1.values.join(' ') : company1.values || '',
        Array.isArray(company2.values) ? company2.values.join(' ') : company2.values || ''
      )
    };
  };

  // 複合類似度の計算（embeddings + 形態素解析）
  const calculateEnhancedSimilarity = (company1: HybridCompany, company2: HybridCompany) => {
    const enhancedSimilarity = SimilarityCalculator.calculateEnhancedSimilarity(company1, company2);
    const textAnalysis = analyzeTextSimilarity(company1, company2); // デバッグ用
    
    // 詳細解析結果
    const embeddingsSimilarity = company1.embeddings && company2.embeddings 
      ? SimilarityCalculator.cosineSimilarity(company1.embeddings, company2.embeddings)
      : 0;
    
    const textSimilarityScore = SimilarityCalculator.calculateTextSimilarity(company1, company2);
    const industryBonus = company1.category === company2.category ? 0.15 : 0;
    
    return {
      similarity: enhancedSimilarity,
      textAnalysis,
      components: {
        embeddings: embeddingsSimilarity,
        textSimilarity: textSimilarityScore,
        industryBonus
      }
    };
  };

  // 類似度の理由を説明（改善版）
  const explainSimilarity = (company1: HybridCompany, company2: HybridCompany, similarity: number, textAnalysis: any) => {
    const reasons: Array<{ type: 'mission' | 'vision' | 'values' | 'industry' | 'general', content: string | string[] }> = [];

    if (textAnalysis.mission.overlap > 0) {
      reasons.push({
        type: 'mission',
        content: textAnalysis.mission.commonWords.slice(0, 5)
      });
    }
    if (textAnalysis.vision.overlap > 0) {
      reasons.push({
        type: 'vision',
        content: textAnalysis.vision.commonWords.slice(0, 5)
      });
    }
    if (textAnalysis.values.overlap > 0) {
      reasons.push({
        type: 'values',
        content: textAnalysis.values.commonWords.slice(0, 5)
      });
    }

    if (company1.category === company2.category) {
      reasons.push({
        type: 'industry',
        content: company1.category || '未分類'
      });
    }

    if (similarity > 0.8) {
      reasons.push({
        type: 'general',
        content: '非常に高い意味的類似性'
      });
    } else if (similarity > 0.6) {
      reasons.push({
        type: 'general',
        content: '高い意味的類似性'
      });
    } else if (similarity > 0.4) {
      reasons.push({
        type: 'general',
        content: '中程度の意味的類似性'
      });
    }

    return reasons;
  };

  const getSimilarityLevel = (similarity: number) => {
    if (similarity > 0.9) return { level: 'very-high', color: 'text-green-600', bg: 'bg-green-50' };
    if (similarity > 0.7) return { level: 'high', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (similarity > 0.5) return { level: 'medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (similarity > 0.3) return { level: 'low', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { level: 'very-low', color: 'text-red-600', bg: 'bg-red-50' };
  };

  // タグ表示コンポーネント
  const ReasonTag = ({ type, content }: { type: string, content: string | string[] }) => {
    const getTagStyle = (type: string) => {
      switch (type) {
        case 'mission':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'vision':
          return 'bg-green-100 text-green-800 border-green-200';
        case 'values':
          return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'industry':
          return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'general':
          return 'bg-gray-100 text-gray-800 border-gray-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const baseStyle = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border';
    const typeStyle = getTagStyle(type);

    if (Array.isArray(content)) {
      return (
        <div className="flex flex-wrap gap-1">
          {content.map((word, index) => (
            <span key={index} className={`${baseStyle} ${typeStyle}`}>
              {word}
            </span>
          ))}
        </div>
      );
    }

    return (
      <span className={`${baseStyle} ${typeStyle}`}>
        {content}
      </span>
    );
  };

  // コピー機能
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 簡単なフィードバック（実際の実装では通知システムを使用）
      console.log(`${type} copied to clipboard: ${text.substring(0, 50)}...`);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // マークダウン形式でMVV全体をコピー
  const copyAsMarkdown = async (company: HybridCompany) => {
    const parts = [];
    
    // ヘッダー
    parts.push(`# ${company.name}`);
    parts.push(`**業界**: ${company.category}`);
    parts.push('');
    
    // MVV情報
    if (company.mission) {
      parts.push(`## Mission`);
      parts.push(company.mission);
      parts.push('');
    }
    
    if (company.vision) {
      parts.push(`## Vision`);
      parts.push(company.vision);
      parts.push('');
    }
    
    if (company.values) {
      parts.push(`## Values`);
      const valuesText = Array.isArray(company.values) 
        ? company.values.join(', ') 
        : company.values;
      parts.push(valuesText);
      parts.push('');
    }
    
    // 信頼度スコア
    if (company.confidenceScores) {
      parts.push(`## 信頼度スコア`);
      parts.push(`- Mission: ${company.confidenceScores.mission?.toFixed(2) || '0.00'}`);
      parts.push(`- Vision: ${company.confidenceScores.vision?.toFixed(2) || '0.00'}`);
      parts.push(`- Values: ${company.confidenceScores.values?.toFixed(2) || '0.00'}`);
    }
    
    const markdownText = parts.join('\n');
    
    try {
      await navigator.clipboard.writeText(markdownText);
      console.log('Markdown copied to clipboard');
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  // MVVツールチップコンポーネント（改善版）
  const MVVTooltip = ({ company, children }: { company: HybridCompany, children: React.ReactNode }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isPinned = pinnedTooltips.has(company.id);
    const isVisible = isHovered || isPinned;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newPinnedTooltips = new Set(pinnedTooltips);
      if (isPinned) {
        newPinnedTooltips.delete(company.id);
      } else {
        newPinnedTooltips.add(company.id);
      }
      setPinnedTooltips(newPinnedTooltips);
    };

    const handleClose = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newPinnedTooltips = new Set(pinnedTooltips);
      newPinnedTooltips.delete(company.id);
      setPinnedTooltips(newPinnedTooltips);
    };

    return (
      <div className="relative inline-block" data-tooltip-container>
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
          className="cursor-pointer"
        >
          {children}
        </div>
        
        {isVisible && (
          <div className="absolute z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg -top-2 left-full ml-2" data-tooltip-container>
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 pb-2 border-b border-gray-200">
              <div>
                <h4 className="font-semibold text-gray-900">{company.name}</h4>
                <p className="text-sm text-gray-600">{company.category}</p>
              </div>
              <div className="flex items-center space-x-1">
                {isPinned ? (
                  <>
                    <button
                      onClick={() => copyAsMarkdown(company)}
                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                      title="Copy as Markdown"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleClose}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center text-xs text-gray-500">
                    <Pin className="h-3 w-3 mr-1" />
                    <span>Click to pin</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* コンテンツ */}
            <div className="p-4 space-y-3">
              {company.mission && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-blue-700">Mission</h5>
                    <button
                      onClick={() => copyToClipboard(company.mission!, 'Mission')}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Copy Mission"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed select-text">{company.mission}</p>
                </div>
              )}
              
              {company.vision && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-green-700">Vision</h5>
                    <button
                      onClick={() => copyToClipboard(company.vision!, 'Vision')}
                      className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                      title="Copy Vision"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed select-text">{company.vision}</p>
                </div>
              )}
              
              {company.values && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-purple-700">Values</h5>
                    <button
                      onClick={() => copyToClipboard(
                        Array.isArray(company.values) ? company.values.join(', ') : (company.values || ''),
                        'Values'
                      )}
                      className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                      title="Copy Values"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed select-text">
                    {Array.isArray(company.values) 
                      ? company.values.join(', ') 
                      : company.values}
                  </p>
                </div>
              )}
              
              {company.confidenceScores && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-blue-600">
                        {company.confidenceScores.mission?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Mission</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-green-600">
                        {company.confidenceScores.vision?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Vision</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-purple-600">
                        {company.confidenceScores.values?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">Values</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Optimized similarity calculation with progressive enhancement
  const similarCompanies: (CompanyWithSimilarity & { 
    company: HybridCompany;
    enhancedData?: { 
      similarity: number; 
      textAnalysis: any; 
      components: any; 
    };
    isEnhanced?: boolean;
  })[] = selectedCompany && progressiveResults.length > 0
    ? progressiveResults.map(result => {
        const enhancedData = calculateEnhancedSimilarity(selectedCompany, result.companyB);
        return {
          company: result.companyB,
          similarity: result.enhancedSimilarity || result.quickSimilarity,
          enhancedData,
          isEnhanced: result.isEnhanced
        };
      })
    : selectedCompany 
      ? getSimilarCompanies(selectedCompany.id, 10).map(item => {
          const enhancedData = calculateEnhancedSimilarity(selectedCompany, item.company);
          return {
            ...item,
            similarity: enhancedData.similarity,
            enhancedData,
            isEnhanced: true
          };
        }).sort((a, b) => b.similarity - a.similarity)
      : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Company Selection Panel */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Search className="mr-2 h-5 w-5 text-blue-500" />
              企業を選択
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              類似企業を調べたい企業を選択してください (Embeddings生成済み: {companies.length}社)
            </p>
          </div>
          
          <div className="p-6">
            {/* Search Field */}
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

            {/* Company List */}
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
                      <div className="font-medium text-gray-900">
                        {company.name}
                      </div>
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

        {/* Selected Company Details */}
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
                  <h4 className="font-semibold text-gray-900">
                    {selectedCompany.name}
                  </h4>
                  <p className="text-sm text-gray-600">{selectedCompany.category}</p>
                </div>
                
                {selectedCompany.mission && (
                  <div>
                    <h5 className="text-sm font-medium text-blue-700 mb-1">Mission</h5>
                    <p className="text-sm text-gray-600">{selectedCompany.mission}</p>
                  </div>
                )}
                
                {selectedCompany.vision && (
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-1">Vision</h5>
                    <p className="text-sm text-gray-600">{selectedCompany.vision}</p>
                  </div>
                )}
                
                {selectedCompany.values && (
                  <div>
                    <h5 className="text-sm font-medium text-purple-700 mb-1">Values</h5>
                    <p className="text-sm text-gray-600">
                      {Array.isArray(selectedCompany.values) 
                        ? selectedCompany.values.join(', ') 
                        : selectedCompany.values}
                    </p>
                  </div>
                )}
                
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

                {selectedCompany.embeddings && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Embeddings: {selectedCompany.embeddings.length}次元ベクトル
                    </div>
                  </div>
                )}
                
                {/* Progress indicator */}
                {isCalculating && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700">
                        類似度計算中... ({Math.round(calculationProgress * 100)}%)
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${calculationProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {/* Cache statistics */}
                {selectedCompany && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <span>💾 キャッシュ使用率: {(similarityCache.getStats().hitRate * 100).toFixed(1)}%</span>
                        <span>📊 計算済み: {similarityCache.getStats().size}組</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Similar Companies Panel */}
      <div className="space-y-6">
        {selectedCompany ? (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-purple-500" />
                類似企業ランキング (リアルタイム計算)
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCompany.name} と最も類似するMVVを持つ企業 (OpenAI Embeddings使用)
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {similarCompanies.map((similar, index) => {
                  const isExpanded = expandedSimilarity === similar.company.id;
                  const textAnalysis = similar.enhancedData?.textAnalysis;
                  const similarityReasons = selectedCompany && textAnalysis
                    ? explainSimilarity(selectedCompany, similar.company, similar.similarity, textAnalysis)
                    : [];
                  const similarityLevel = getSimilarityLevel(similar.similarity);

                  return (
                    <div key={similar.company.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 flex items-center space-x-2">
                              <span>{similar.company.name}</span>
                              <MVVTooltip company={similar.company}>
                                <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 transition-colors" />
                              </MVVTooltip>
                            </div>
                            <div className="text-sm text-gray-600">{similar.company.category}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${similarityLevel.color}`}>
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
                        <div className="space-y-2">
                          {similarityReasons.slice(0, 2).map((reason, idx) => (
                            <div key={idx} className="flex items-start space-x-2">
                              <ReasonTag type={reason.type} content={reason.content} />
                            </div>
                          ))}
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
                              <div className="space-y-2">
                                <span className="font-medium text-blue-600">Mission共通語({textAnalysis.mission.overlap}):</span>
                                <div className="ml-2">
                                  <ReasonTag type="mission" content={textAnalysis.mission.commonWords.slice(0, 8)} />
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Mission: 共通キーワードなし
                              </div>
                            )}
                            
                            {textAnalysis.vision.overlap > 0 ? (
                              <div className="space-y-2">
                                <span className="font-medium text-green-600">Vision共通語({textAnalysis.vision.overlap}):</span>
                                <div className="ml-2">
                                  <ReasonTag type="vision" content={textAnalysis.vision.commonWords.slice(0, 8)} />
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Vision: 共通キーワードなし
                              </div>
                            )}
                            
                            {textAnalysis.values.overlap > 0 ? (
                              <div className="space-y-2">
                                <span className="font-medium text-purple-600">Values共通語({textAnalysis.values.overlap}):</span>
                                <div className="ml-2">
                                  <ReasonTag type="values" content={textAnalysis.values.commonWords.slice(0, 8)} />
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">
                                Values: 共通キーワードなし
                              </div>
                            )}

                            {/* Enhanced similarity components */}
                            {similar.enhancedData && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <span className="font-medium text-gray-700">類似度構成要素:</span>
                                <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                                  <div>
                                    <span className="text-indigo-600">Embeddings:</span>
                                    <span className="ml-1">{similar.enhancedData.components.embeddings.toFixed(3)}</span>
                                  </div>
                                  <div>
                                    <span className="text-green-600">形態素解析:</span>
                                    <span className="ml-1">{similar.enhancedData.components.textSimilarity.toFixed(3)}</span>
                                  </div>
                                  <div>
                                    <span className="text-orange-600">業界ボーナス:</span>
                                    <span className="ml-1">{similar.enhancedData.components.industryBonus.toFixed(3)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* 全理由リスト */}
                            <div className="mt-2">
                              <span className="font-medium text-gray-700">全ての類似要因:</span>
                              <div className="space-y-2 mt-1">
                                {similarityReasons.map((reason, idx) => (
                                  <div key={idx} className="flex items-start space-x-2">
                                    <ReasonTag type={reason.type} content={reason.content} />
                                  </div>
                                ))}
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
                    <div className="mb-2">❌ 類似企業データがありません</div>
                    <div className="text-sm">
                      この企業にはEmbeddingsが生成されていないか、<br />
                      他の企業との比較データがありません。
                    </div>
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
                リアルタイムでその企業と類似するMVVを持つ企業が表示されます
              </p>
              <div className="mt-4 text-sm text-blue-600">
                <TrendingUp className="inline h-4 w-4 mr-1" />
                OpenAI Embeddings による高精度分析
              </div>
              <ArrowRight className="mx-auto h-8 w-8 text-gray-300 mt-4 transform rotate-180" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimilarCompanyFinder;