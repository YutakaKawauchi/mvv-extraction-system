import React, { useMemo, useState } from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import { LoadingSpinner } from '../common';
import { Award, CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import { TinySegmenter } from '@birchill/tiny-segmenter';

interface QualityMetrics {
  clarity: number;      // 明確性
  specificity: number;  // 具体性
  actionability: number; // 行動指向性
  authenticity: number; // 独自性
  completeness: number; // 完全性
  overall: number;      // 総合スコア
}

interface CompanyAssessment {
  companyId: string;
  companyName: string;
  category: string;
  mission: QualityMetrics;
  vision: QualityMetrics;
  values: QualityMetrics;
  overall: QualityMetrics;
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export const MVVQualityAssessment: React.FC = () => {
  const { data, isLoading } = useAnalysisStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'overall' | 'mission' | 'vision' | 'values'>('overall');

  const segmenter = useMemo(() => new TinySegmenter(), []);

  const { assessments, categoryStats, loading } = useMemo(() => {
    if (!data || !data.companies) {
      return { assessments: [], categoryStats: {}, loading: true };
    }

    console.log('🔄 MVV品質評価分析開始...');
    const startTime = performance.now();

    // 有効な企業のみフィルター
    const validCompanies = data.companies.filter(company => 
      company.mission || company.vision || company.values
    );

    if (validCompanies.length === 0) {
      return { assessments: [], categoryStats: {}, loading: false };
    }

    console.log(`📊 ${validCompanies.length}社で品質評価実行中...`);

    const assessments: CompanyAssessment[] = validCompanies.map(company => {
      const missionMetrics = assessMVVText(company.mission || '', 'mission', segmenter);
      const visionMetrics = assessMVVText(company.vision || '', 'vision', segmenter);
      const valuesMetrics = assessMVVText(company.values || '', 'values', segmenter);

      // 総合評価
      const overall: QualityMetrics = {
        clarity: (missionMetrics.clarity + visionMetrics.clarity + valuesMetrics.clarity) / 3,
        specificity: (missionMetrics.specificity + visionMetrics.specificity + valuesMetrics.specificity) / 3,
        actionability: (missionMetrics.actionability + visionMetrics.actionability + valuesMetrics.actionability) / 3,
        authenticity: (missionMetrics.authenticity + visionMetrics.authenticity + valuesMetrics.authenticity) / 3,
        completeness: calculateCompleteness(company.mission, company.vision, company.values),
        overall: 0
      };
      overall.overall = (overall.clarity + overall.specificity + overall.actionability + overall.authenticity + overall.completeness) / 5;

      // 推奨事項
      const recommendations = generateRecommendations(company, overall);

      // グレード算出
      const grade = calculateGrade(overall.overall);

      return {
        companyId: company.id,
        companyName: company.name,
        category: company.category,
        mission: missionMetrics,
        vision: visionMetrics,
        values: valuesMetrics,
        overall,
        recommendations,
        grade
      };
    });

    // カテゴリ別統計
    const categoryStats = assessments.reduce((acc, assessment) => {
      const category = assessment.category;
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          avgOverall: 0,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
          topIssues: []
        };
      }
      acc[category].count++;
      acc[category].avgOverall += assessment.overall.overall;
      acc[category].gradeDistribution[assessment.grade]++;
      return acc;
    }, {} as any);

    // 平均スコア計算
    Object.keys(categoryStats).forEach(category => {
      categoryStats[category].avgOverall /= categoryStats[category].count;
    });

    const endTime = performance.now();
    console.log(`✅ MVV品質評価完了: ${Math.round(endTime - startTime)}ms`);

    return { assessments, categoryStats, loading: false };
  }, [data, segmenter]);

  // MVVテキストの品質評価（安全化版）
  const assessMVVText = (text: string, type: 'mission' | 'vision' | 'values', segmenter: any): QualityMetrics => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { clarity: 0, specificity: 0, actionability: 0, authenticity: 0, completeness: 0, overall: 0 };
    }

    try {
      const words = segmenter.segment(text);
      if (!Array.isArray(words)) {
        console.warn('Segmenter did not return an array:', words);
        return { clarity: 0, specificity: 0, actionability: 0, authenticity: 0, completeness: 0, overall: 0 };
      }
      
      const wordCount = words.filter((w: string) => typeof w === 'string' && w.length > 1).length;

      // 明確性評価
      const clarity = assessClarity(text, wordCount);
      
      // 具体性評価
      const specificity = assessSpecificity(text, words);
      
      // 行動指向性評価
      const actionability = assessActionability(text, words, type);
      
      // 独自性評価（一般的でない語彙の使用）
      const authenticity = assessAuthenticity(words);
      
      // 完全性（このメソッドでは文字数ベース）
      const completeness = Math.min(wordCount / 20, 1); // 20語以上で満点

      const overall = (clarity + specificity + actionability + authenticity + completeness) / 5;

      // スコアの検証と正規化
      const normalizeScore = (score: number) => Math.max(0, Math.min(1, isFinite(score) ? score : 0));

      return { 
        clarity: normalizeScore(clarity), 
        specificity: normalizeScore(specificity), 
        actionability: normalizeScore(actionability), 
        authenticity: normalizeScore(authenticity), 
        completeness: normalizeScore(completeness), 
        overall: normalizeScore(overall) 
      };
    } catch (error) {
      console.error('Error in MVV text assessment:', error);
      return { clarity: 0, specificity: 0, actionability: 0, authenticity: 0, completeness: 0, overall: 0 };
    }
  };

  const assessClarity = (text: string, wordCount: number): number => {
    // 文の長さ、句読点の使用、専門用語の回避をチェック
    const sentences = text.split(/[。．！？]/).filter(s => s.length > 0);
    const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
    
    let score = 0.5; // ベーススコア
    
    // 適切な文の長さ（10-25語）
    if (avgSentenceLength >= 10 && avgSentenceLength <= 25) score += 0.3;
    
    // 複雑な語彙の回避
    const complexWords = ['実装', '最適化', '効率化', '革新的', 'イノベーション'];
    const complexWordCount = complexWords.filter(word => text.includes(word)).length;
    score += Math.max(0, 0.2 - complexWordCount * 0.05);
    
    return Math.min(score, 1);
  };

  const assessSpecificity = (text: string, _words: string[]): number => {
    // 具体的な数値、固有名詞、業界用語の使用をチェック
    let score = 0.3; // ベーススコア
    
    // 数値の使用
    if (/\d+/.test(text)) score += 0.2;
    
    // 具体的な行動動詞
    const actionVerbs = ['創る', '提供', '実現', '支援', '開発', '構築', '改善'];
    const actionVerbCount = actionVerbs.filter(verb => text.includes(verb)).length;
    score += Math.min(actionVerbCount * 0.1, 0.3);
    
    // 抽象的すぎる語彙の減点
    const abstractWords = ['すべて', 'あらゆる', '最高', '最良', '究極'];
    const abstractWordCount = abstractWords.filter(word => text.includes(word)).length;
    score -= abstractWordCount * 0.1;
    
    return Math.max(0, Math.min(score, 1));
  };

  const assessActionability = (text: string, words: string[], type: string): number => {
    // 行動を促す表現、実現可能性をチェック
    let score = 0.3; // ベーススコア
    
    // タイプ別の期待される表現
    const expectedPatterns = {
      mission: ['ため', '目的', '使命', '責任'],
      vision: ['目指', '実現', '未来', 'ビジョン'],
      values: ['大切', '重視', '信念', 'バリュー']
    };
    
    const patterns = expectedPatterns[type as keyof typeof expectedPatterns] || [];
    const patternCount = patterns.filter(pattern => text.includes(pattern)).length;
    score += Math.min(patternCount * 0.15, 0.4);
    
    // 動詞の使用
    const verbCount = words.filter((word: string) => 
      word.endsWith('る') || word.endsWith('す') || word.endsWith('ます')
    ).length;
    score += Math.min(verbCount * 0.05, 0.3);
    
    return Math.min(score, 1);
  };

  const assessAuthenticity = (words: string[]): number => {
    // 一般的すぎる表現の回避、独自性をチェック
    const commonWords = ['お客様', '社会', '貢献', '品質', '向上', '最高', '一番'];
    const commonWordCount = words.filter(word => commonWords.includes(word)).length;
    
    const uniqueWords = new Set(words).size;
    const totalWords = words.length;
    const vocabularyDiversity = totalWords > 0 ? uniqueWords / totalWords : 0;
    
    let score = 0.5 + vocabularyDiversity * 0.3;
    score -= commonWordCount * 0.1;
    
    return Math.max(0, Math.min(score, 1));
  };

  const calculateCompleteness = (mission?: string, vision?: string, values?: string): number => {
    let score = 0;
    if (mission && mission.length > 10) score += 0.33;
    if (vision && vision.length > 10) score += 0.33;
    if (values && values.length > 10) score += 0.34;
    return score;
  };

  const generateRecommendations = (_company: any, overall: QualityMetrics): string[] => {
    const recommendations: string[] = [];
    
    if (overall.clarity < 0.6) {
      recommendations.push('より明確で理解しやすい表現に改善してください');
    }
    if (overall.specificity < 0.6) {
      recommendations.push('具体的な数値や事例を含めて表現を具体化してください');
    }
    if (overall.actionability < 0.6) {
      recommendations.push('行動指向の動詞を使用して実行可能性を高めてください');
    }
    if (overall.authenticity < 0.6) {
      recommendations.push('独自性を強調し、一般的な表現を避けてください');
    }
    if (overall.completeness < 0.8) {
      recommendations.push('ミッション・ビジョン・バリューを充実させてください');
    }

    return recommendations;
  };

  const calculateGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  };

  const filteredAssessments = useMemo(() => {
    let filtered = assessments;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(assessment => assessment.category === selectedCategory);
    }
    
    return filtered.sort((a, b) => {
      const aScore = sortBy === 'overall' ? a.overall.overall : a[sortBy].overall;
      const bScore = sortBy === 'overall' ? b.overall.overall : b[sortBy].overall;
      return bScore - aScore;
    });
  }, [assessments, selectedCategory, sortBy]);

  const categories = useMemo(() => {
    return ['all', ...Object.keys(categoryStats)];
  }, [categoryStats]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">MVV品質を評価中...</p>
        </div>
      </div>
    );
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (score >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Award className="mr-3 h-8 w-8 text-indigo-500" />
              MVV品質評価システム
            </h2>
            <p className="text-gray-600 mt-1">
              ルールベース分析による包括的なMVV品質評価
            </p>
          </div>
          <div className="text-sm text-gray-500">
            評価対象: {assessments.length}社
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'すべて' : category}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">並び順:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="overall">総合スコア</option>
              <option value="mission">ミッション</option>
              <option value="vision">ビジョン</option>
              <option value="values">バリュー</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              結果: {filteredAssessments.length}社
            </div>
          </div>
        </div>
      </div>

      {/* 品質評価結果 */}
      <div className="space-y-4">
        {filteredAssessments.map(assessment => (
          <div key={assessment.companyId} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">{assessment.companyName}</h3>
                  <span className={`px-2 py-1 rounded-full text-sm font-bold ${getGradeColor(assessment.grade)}`}>
                    {assessment.grade}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{assessment.category}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(assessment.overall.overall * 100)}
                </div>
                <div className="text-xs text-gray-500">総合スコア</div>
              </div>
            </div>

            {/* 詳細スコア */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-center mb-1">
                  {getScoreIcon(assessment.overall.clarity)}
                </div>
                <div className="text-sm font-medium">{Math.round(assessment.overall.clarity * 100)}</div>
                <div className="text-xs text-gray-600">明確性</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-center mb-1">
                  {getScoreIcon(assessment.overall.specificity)}
                </div>
                <div className="text-sm font-medium">{Math.round(assessment.overall.specificity * 100)}</div>
                <div className="text-xs text-gray-600">具体性</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-center mb-1">
                  {getScoreIcon(assessment.overall.actionability)}
                </div>
                <div className="text-sm font-medium">{Math.round(assessment.overall.actionability * 100)}</div>
                <div className="text-xs text-gray-600">行動性</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-center mb-1">
                  {getScoreIcon(assessment.overall.authenticity)}
                </div>
                <div className="text-sm font-medium">{Math.round(assessment.overall.authenticity * 100)}</div>
                <div className="text-xs text-gray-600">独自性</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-center mb-1">
                  {getScoreIcon(assessment.overall.completeness)}
                </div>
                <div className="text-sm font-medium">{Math.round(assessment.overall.completeness * 100)}</div>
                <div className="text-xs text-gray-600">完全性</div>
              </div>
            </div>

            {/* 推奨事項 */}
            {assessment.recommendations.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">改善推奨事項:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {assessment.recommendations.map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* カテゴリ別統計 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="mr-2 h-5 w-5 text-indigo-500" />
          カテゴリ別品質統計
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(categoryStats).map(([category, stats]: [string, any]) => (
            <div key={category} className="border rounded-lg p-4">
              <div className="font-semibold text-gray-900 mb-3">{category}</div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">企業数:</span>
                  <span className="font-medium">{stats.count}社</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">平均スコア:</span>
                  <span className="font-medium">{Math.round(stats.avgOverall * 100)}</span>
                </div>
                <div className="mt-3">
                  <div className="text-gray-600 mb-1">グレード分布:</div>
                  <div className="flex space-x-1">
                    {Object.entries(stats.gradeDistribution).map(([grade, count]: [string, any]) => (
                      <div key={grade} className={`px-2 py-1 rounded text-xs ${getGradeColor(grade)}`}>
                        {grade}: {count}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};