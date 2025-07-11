/**
 * Enhanced Segmentation Service
 * Improves compound word detection by combining TinySegmenter with custom compound word processing
 * Addresses the specific issue where "社会課題" gets split into "社会" + "課題"
 */

import { TinySegmenter } from '@birchill/tiny-segmenter';

export interface CompoundWordRule {
  pattern: RegExp;
  compounds: string[];
  category: 'business' | 'medical' | 'technology' | 'environment' | 'social';
  priority: number;
}

export interface SegmentationOptions {
  preserveCompounds: boolean;
  enableCustomRules: boolean;
  industryFocus?: 'healthcare' | 'technology' | 'general';
}

export interface SegmentationResult {
  segments: string[];
  preservedCompounds: string[];
  originalSegments: string[];
  processingTime: number;
}

export class EnhancedSegmentationService {
  private tinySegmenter: TinySegmenter;
  private compoundWordDictionary: Map<string, CompoundWordRule>;
  private protectionTokens: Map<string, string>;

  constructor() {
    this.tinySegmenter = new TinySegmenter();
    this.compoundWordDictionary = new Map();
    this.protectionTokens = new Map();
    
    this.initializeCompoundWordDictionary();
  }

  /**
   * Initialize compound word dictionary with common business terms
   */
  private initializeCompoundWordDictionary(): void {
    const compoundRules: CompoundWordRule[] = [
      // 社会・環境関連の複合語（最優先）
      {
        pattern: /社会課題|社会貢献|社会責任|社会価値|社会問題|社会保障|社会保険|社会福祉|社会制度/g,
        compounds: ['社会課題', '社会貢献', '社会責任', '社会価値', '社会問題', '社会保障', '社会保険', '社会福祉', '社会制度'],
        category: 'social',
        priority: 10
      },
      {
        pattern: /持続可能|地球環境|環境保護|環境配慮|環境負荷|循環型社会|脱炭素|温室効果|生物多様性/g,
        compounds: ['持続可能', '地球環境', '環境保護', '環境配慮', '環境負荷', '循環型社会', '脱炭素', '温室効果', '生物多様性'],
        category: 'environment',
        priority: 10
      },

      // ビジネス・経営関連
      {
        pattern: /顧客満足|顧客中心|顧客価値|顧客体験|顧客志向|顧客第一|顧客サービス|顧客関係|顧客基盤/g,
        compounds: ['顧客満足', '顧客中心', '顧客価値', '顧客体験', '顧客志向', '顧客第一', '顧客サービス', '顧客関係', '顧客基盤'],
        category: 'business',
        priority: 9
      },
      {
        pattern: /品質管理|品質向上|品質改善|品質保証|品質第一|経済発展|経済成長|経済効率|事業展開|事業拡大|事業戦略|企業価値|企業成長|企業文化|企業理念/g,
        compounds: ['品質管理', '品質向上', '品質改善', '品質保証', '品質第一', '経済発展', '経済成長', '経済効率', '事業展開', '事業拡大', '事業戦略', '企業価値', '企業成長', '企業文化', '企業理念'],
        category: 'business',
        priority: 9
      },

      // 医療・ヘルスケア関連
      {
        pattern: /医療従事者|患者中心|患者安全|患者満足|医療技術|医療機器|医療サービス|医療システム|医療情報|医療費|予防医学|在宅医療|地域医療|高度医療/g,
        compounds: ['医療従事者', '患者中心', '患者安全', '患者満足', '医療技術', '医療機器', '医療サービス', '医療システム', '医療情報', '医療費', '予防医学', '在宅医療', '地域医療', '高度医療'],
        category: 'medical',
        priority: 9
      },
      {
        pattern: /健康寿命|健康管理|健康増進|健康維持|健康指導|生活習慣|疾病予防|早期発見|早期治療|診断技術|治療方法|治療効果|副作用|安全性/g,
        compounds: ['健康寿命', '健康管理', '健康増進', '健康維持', '健康指導', '生活習慣', '疾病予防', '早期発見', '早期治療', '診断技術', '治療方法', '治療効果', '副作用', '安全性'],
        category: 'medical',
        priority: 9
      },

      // 技術・イノベーション関連
      {
        pattern: /次世代技術|人工知能|機械学習|深層学習|自然言語処理|画像認識|音声認識|IoT技術|クラウド技術|ブロックチェーン|量子コンピュータ/g,
        compounds: ['次世代技術', '人工知能', '機械学習', '深層学習', '自然言語処理', '画像認識', '音声認識', 'IoT技術', 'クラウド技術', 'ブロックチェーン', '量子コンピュータ'],
        category: 'technology',
        priority: 9
      },
      {
        pattern: /デジタルトランスフォーメーション|デジタル化|デジタル技術|情報技術|情報システム|データ分析|ビッグデータ|データサイエンス|サイバーセキュリティ|情報セキュリティ/g,
        compounds: ['デジタルトランスフォーメーション', 'デジタル化', 'デジタル技術', '情報技術', '情報システム', 'データ分析', 'ビッグデータ', 'データサイエンス', 'サイバーセキュリティ', '情報セキュリティ'],
        category: 'technology',
        priority: 9
      },

      // 組織・人材関連
      {
        pattern: /人材育成|人材開発|働き方改革|ワークライフバランス|ダイバーシティ|女性活躍|高齢化社会|少子高齢化|労働力不足|生産性向上|業務効率/g,
        compounds: ['人材育成', '人材開発', '働き方改革', 'ワークライフバランス', 'ダイバーシティ', '女性活躍', '高齢化社会', '少子高齢化', '労働力不足', '生産性向上', '業務効率'],
        category: 'business',
        priority: 8
      },

      // 国際・グローバル関連
      {
        pattern: /グローバル企業|グローバル展開|国際協力|国際貢献|国際標準|持続可能な開発|SDGs|ESG経営|コーポレートガバナンス|ステークホルダー/g,
        compounds: ['グローバル企業', 'グローバル展開', '国際協力', '国際貢献', '国際標準', '持続可能な開発', 'SDGs', 'ESG経営', 'コーポレートガバナンス', 'ステークホルダー'],
        category: 'business',
        priority: 8
      }
    ];

    // ルールを辞書に追加
    compoundRules.forEach((rule, index) => {
      this.compoundWordDictionary.set(`rule_${index}`, rule);
    });
  }

  /**
   * Enhanced segmentation with compound word preservation
   */
  public segmentWithCompounds(
    text: string, 
    options: SegmentationOptions = { preserveCompounds: true, enableCustomRules: true }
  ): SegmentationResult {
    const startTime = performance.now();
    
    if (!text || text.trim().length === 0) {
      return {
        segments: [],
        preservedCompounds: [],
        originalSegments: [],
        processingTime: performance.now() - startTime
      };
    }

    // Step 1: Store original segmentation for comparison
    const originalSegments = this.tinySegmenter.segment(text);

    if (!options.preserveCompounds) {
      return {
        segments: originalSegments,
        preservedCompounds: [],
        originalSegments,
        processingTime: performance.now() - startTime
      };
    }

    // Step 2: Pre-process text to protect compound words
    const { protectedText, preservedCompounds: protectedList } = this.protectCompoundWords(text, options);

    // Step 3: Segment the protected text
    const protectedSegments = this.tinySegmenter.segment(protectedText);

    // Step 4: Post-process to restore compound words
    const finalSegments = this.restoreCompoundWords(protectedSegments, protectedList);

    const processingTime = performance.now() - startTime;

    return {
      segments: finalSegments,
      preservedCompounds: protectedList.map(p => p.original),
      originalSegments,
      processingTime
    };
  }

  /**
   * Protect compound words by replacing them with tokens
   */
  private protectCompoundWords(
    text: string, 
    options: SegmentationOptions
  ): { protectedText: string; preservedCompounds: Array<{ original: string; token: string; category: string }> } {
    let protectedText = text;
    const preservedCompounds: Array<{ original: string; token: string; category: string }> = [];
    
    // Clear previous protection tokens
    this.protectionTokens.clear();

    // Sort rules by priority (highest first)
    const sortedRules = Array.from(this.compoundWordDictionary.values())
      .sort((a, b) => b.priority - a.priority);

    // Apply industry focus filtering if specified
    const relevantRules = options.industryFocus 
      ? sortedRules.filter(rule => this.isRuleRelevant(rule, options.industryFocus!))
      : sortedRules;

    let tokenCounter = 0;

    for (const rule of relevantRules) {
      if (!options.enableCustomRules && rule.priority < 10) continue;

      let match;
      rule.pattern.lastIndex = 0; // Reset regex
      
      while ((match = rule.pattern.exec(protectedText)) !== null) {
        const compound = match[0];
        const token = `__COMPOUND_${tokenCounter}__`;
        
        // Replace the compound with a protection token
        protectedText = protectedText.replace(compound, token);
        
        // Store the mapping
        this.protectionTokens.set(token, compound);
        preservedCompounds.push({
          original: compound,
          token,
          category: rule.category
        });
        
        tokenCounter++;
        
        // Reset regex to continue searching
        rule.pattern.lastIndex = 0;
      }
    }

    return { protectedText, preservedCompounds };
  }

  /**
   * Restore compound words from protection tokens
   */
  private restoreCompoundWords(
    segments: string[], 
    _preservedCompounds: Array<{ original: string; token: string; category: string }>
  ): string[] {
    return segments.map(segment => {
      let restoredSegment = segment;
      
      // Check if this segment contains any protection token
      for (const [token, compound] of this.protectionTokens.entries()) {
        if (restoredSegment.includes(token)) {
          // Replace all occurrences of the token with the compound word
          restoredSegment = restoredSegment.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), compound);
        }
      }
      
      return restoredSegment;
    }).filter(segment => {
      // Filter out any remaining unrestored protection tokens
      const hasUnrestoredToken = segment.match(/__COMPOUND_\d+__/) || segment.includes('COMPOUND');
      return !hasUnrestoredToken && segment.trim().length > 0;
    });
  }

  /**
   * Check if a rule is relevant for the specified industry focus
   */
  private isRuleRelevant(rule: CompoundWordRule, industryFocus: string): boolean {
    switch (industryFocus) {
      case 'healthcare':
        return ['medical', 'social', 'technology'].includes(rule.category);
      case 'technology':
        return ['technology', 'business', 'social'].includes(rule.category);
      case 'general':
      default:
        return true;
    }
  }

  /**
   * Analyze compound word detection effectiveness
   */
  public analyzeCompoundDetection(text: string): {
    originalCount: number;
    enhancedCount: number;
    preservedCompounds: string[];
    improvementRate: number;
  } {
    const original = this.tinySegmenter.segment(text);
    const enhanced = this.segmentWithCompounds(text);
    
    // Count meaningful compound words (heuristic: words containing kanji with 4+ characters)
    const countMeaningfulCompounds = (segments: string[]) => {
      return segments.filter(segment => 
        segment.length >= 3 && 
        /[\u4e00-\u9faf]/.test(segment) && // Contains kanji
        !['について', 'において', 'により', 'として'].includes(segment)
      ).length;
    };

    const originalCount = countMeaningfulCompounds(original);
    const enhancedCount = countMeaningfulCompounds(enhanced.segments);
    const improvementRate = enhancedCount > 0 ? ((enhancedCount - originalCount) / originalCount) * 100 : 0;

    return {
      originalCount,
      enhancedCount,
      preservedCompounds: enhanced.preservedCompounds,
      improvementRate
    };
  }

  /**
   * Get compound word statistics
   */
  public getCompoundWordStats(): {
    totalRules: number;
    totalCompounds: number;
    categoryCounts: Record<string, number>;
  } {
    const stats = {
      totalRules: this.compoundWordDictionary.size,
      totalCompounds: 0,
      categoryCounts: {} as Record<string, number>
    };

    for (const rule of this.compoundWordDictionary.values()) {
      stats.totalCompounds += rule.compounds.length;
      stats.categoryCounts[rule.category] = (stats.categoryCounts[rule.category] || 0) + rule.compounds.length;
    }

    return stats;
  }

  /**
   * Add custom compound word rule
   */
  public addCustomRule(rule: CompoundWordRule): void {
    const ruleId = `custom_${Date.now()}`;
    this.compoundWordDictionary.set(ruleId, rule);
  }

  /**
   * Test specific compound words
   */
  public testCompoundWords(testCases: Array<{ text: string; expectedCompounds: string[] }>): Array<{
    text: string;
    expectedCompounds: string[];
    originalSegments: string[];
    enhancedSegments: string[];
    preservedCompounds: string[];
    successRate: number;
  }> {
    return testCases.map(testCase => {
      const result = this.segmentWithCompounds(testCase.text);
      const originalSegments = this.tinySegmenter.segment(testCase.text);
      
      const preservedExpected = testCase.expectedCompounds.filter(compound => 
        result.preservedCompounds.includes(compound)
      );
      
      const successRate = (preservedExpected.length / testCase.expectedCompounds.length) * 100;

      return {
        text: testCase.text,
        expectedCompounds: testCase.expectedCompounds,
        originalSegments,
        enhancedSegments: result.segments,
        preservedCompounds: result.preservedCompounds,
        successRate
      };
    });
  }
}

// Export singleton instance for consistent usage
export const enhancedSegmentationService = new EnhancedSegmentationService();

// Export convenience functions
export const segmentWithCompounds = (text: string, options?: SegmentationOptions) => 
  enhancedSegmentationService.segmentWithCompounds(text, options);

export const analyzeCompoundDetection = (text: string) => 
  enhancedSegmentationService.analyzeCompoundDetection(text);