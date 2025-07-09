/**
 * Real-time similarity calculation service
 * Computes enhanced similarity between embeddings vectors for AI analysis
 * Combines embeddings similarity with morphological text analysis
 */

import type { Company } from '../types';
import { TinySegmenter } from '@birchill/tiny-segmenter';
import { similarityCache } from './similarityCache';

export interface SimilarityResult {
  companyA: Company;
  companyB: Company;
  similarity: number;
}

export interface SimilarityMatrix {
  [companyId: string]: {
    [companyId: string]: number;
  };
}

export interface CompanyWithSimilarity {
  company: Company;
  similarity: number;
}

export class SimilarityCalculator {
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  public static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    if (vectorA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate morphological text similarity using TinySegmenter
   */
  public static calculateTextSimilarity(companyA: Company, companyB: Company): number {
    const segmenter = new TinySegmenter();
    
    // Extract text from MVV data
    const textA = [companyA.mission, companyA.vision, ...(companyA.values || [])].join(' ');
    const textB = [companyB.mission, companyB.vision, ...(companyB.values || [])].join(' ');
    
    if (!textA || !textB) return 0;

    // Segment text
    const segmentsA = segmenter.segment(textA);
    const segmentsB = segmenter.segment(textB);

    // Define important terms and stop words
    const importantTerms = new Set([
      // General business terms
      '社会', '貢献', '価値', '品質', '技術', '革新', '創造', '発展', '成長', '向上',
      '安全', '信頼', '責任', '持続', '環境', '未来', '世界', '地域', '人々', '顧客',
      'サービス', '製品', '事業', '企業', '組織', 'チーム', '協力', '連携', '推進',
      'イノベーション', 'グローバル', 'リーダー', 'パートナー', 'ソリューション',
      
      // Digital/IT terms
      'AI', 'DX', 'デジタル', 'データ', 'テクノロジー', 'システム', 'プラットフォーム',
      'クラウド', 'IoT', 'ネットワーク', 'セキュリティ', 'インフラ',
      
      // Medical/Healthcare terms
      '医療', '健康', '患者', '福祉', 'ケア', 'いのち', '生命', '命', '治療', 
      '診断', '予防', '看護', '介護'
    ]);

    const stopWords = new Set([
      'の', 'は', 'を', 'が', 'に', 'で', 'と', 'も', 'から', 'まで', 'より',
      'こと', 'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'ため', 'によって',
      'について', 'において', 'により', 'として', 'という', 'といった', 'なお',
      'また', 'さらに', 'ただし', 'しかし', 'また', 'そして', 'そのため'
    ]);

    // Extract keywords
    const extractKeywords = (segments: string[]) => {
      return segments
        .filter(word => {
          if (word.length < 2) return false;
          if (stopWords.has(word)) return false;
          if (/^[ぁ-ん]+$/.test(word)) return false;
          if (/^[0-9]+$/.test(word)) return false;
          if (/^[a-zA-Z]+$/.test(word)) return false;
          return true;
        })
        .map(word => {
          return word
            .replace(/[っ]$/, '')
            .replace(/[する|した|します|しま|して]$/, '')
            .replace(/[です|ます|である]$/, '');
        })
        .filter(word => word.length >= 2);
    };

    const keywordsA = extractKeywords(segmentsA);
    const keywordsB = extractKeywords(segmentsB);

    if (keywordsA.length === 0 || keywordsB.length === 0) return 0;

    // Calculate word overlap
    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    // Base similarity (Jaccard index)
    const jaccardSimilarity = intersection.size / union.size;

    // Boost for important terms
    const importantIntersection = [...intersection].filter(word => importantTerms.has(word));
    const importantBoost = importantIntersection.length * 0.1;

    return Math.min(1.0, jaccardSimilarity + importantBoost);
  }

  /**
   * Calculate enhanced similarity combining embeddings and text analysis
   */
  public static calculateEnhancedSimilarity(companyA: Company, companyB: Company): number {
    // Check if both companies have embeddings
    if (!companyA.embeddings || !companyB.embeddings) {
      return 0;
    }

    // Calculate embeddings similarity
    const embeddingsSimilarity = this.cosineSimilarity(companyA.embeddings, companyB.embeddings);

    // Calculate text similarity
    const textSimilarity = this.calculateTextSimilarity(companyA, companyB);

    // Industry bonus
    const industryBonus = companyA.category === companyB.category ? 0.15 : 0;

    // Combined similarity (70% embeddings + 25% text + 15% industry bonus)
    const combined = embeddingsSimilarity * 0.7 + textSimilarity * 0.25 + industryBonus;

    // Scale to more intuitive range (0.8xx+)
    const scaled = Math.min(1.0, combined * 1.3 + 0.2);

    return scaled;
  }

  /**
   * Find similar companies for a given company (with caching)
   */
  public static findSimilarCompanies(
    targetCompany: Company,
    companies: Company[],
    limit: number = 5
  ): CompanyWithSimilarity[] {
    if (!targetCompany.embeddings || targetCompany.embeddings.length === 0) {
      return [];
    }

    const similarities: CompanyWithSimilarity[] = [];

    for (const company of companies) {
      // Skip self comparison
      if (company.id === targetCompany.id) {
        continue;
      }

      // Skip companies without embeddings
      if (!company.embeddings || company.embeddings.length === 0) {
        continue;
      }

      // Check cache first
      let similarity = similarityCache.get(targetCompany.id, company.id);
      if (similarity === null) {
        similarity = this.calculateEnhancedSimilarity(targetCompany, company);
        similarityCache.set(targetCompany.id, company.id, similarity);
      }

      similarities.push({
        company,
        similarity
      });
    }

    // Sort by similarity (highest first) and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate similarity matrix for all companies with embeddings (optimized)
   */
  public static calculateSimilarityMatrix(companies: Company[]): SimilarityMatrix {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );

    const matrix: SimilarityMatrix = {};

    // Initialize matrix
    for (const company of companiesWithEmbeddings) {
      matrix[company.id] = {};
    }

    // Calculate upper triangle only (symmetric matrix optimization)
    for (let i = 0; i < companiesWithEmbeddings.length; i++) {
      const companyA = companiesWithEmbeddings[i];
      
      for (let j = i; j < companiesWithEmbeddings.length; j++) {
        const companyB = companiesWithEmbeddings[j];
        
        if (i === j) {
          // Self similarity is 1
          matrix[companyA.id][companyB.id] = 1.0;
        } else {
          // Check cache first
          let similarity = similarityCache.get(companyA.id, companyB.id);
          if (similarity === null) {
            similarity = this.calculateEnhancedSimilarity(companyA, companyB);
            similarityCache.set(companyA.id, companyB.id, similarity);
          }
          
          // Set both directions (symmetric)
          matrix[companyA.id][companyB.id] = similarity;
          matrix[companyB.id][companyA.id] = similarity;
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate category-based similarity analysis
   */
  public static calculateCategoryAnalysis(companies: Company[]): {
    [category: string]: {
      companies: Company[];
      avgInternalSimilarity: number;
      avgExternalSimilarity: number;
    };
  } {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );

    const categoryMap = new Map<string, Company[]>();
    
    // Group companies by category
    for (const company of companiesWithEmbeddings) {
      if (!categoryMap.has(company.category)) {
        categoryMap.set(company.category, []);
      }
      categoryMap.get(company.category)!.push(company);
    }

    const result: any = {};

    for (const [category, categoryCompanies] of categoryMap) {
      const otherCompanies = companiesWithEmbeddings.filter(
        c => c.category !== category
      );

      // Calculate internal similarity (within category)
      let internalSimilaritySum = 0;
      let internalCount = 0;

      for (let i = 0; i < categoryCompanies.length; i++) {
        for (let j = i + 1; j < categoryCompanies.length; j++) {
          const similarity = this.calculateEnhancedSimilarity(
            categoryCompanies[i],
            categoryCompanies[j]
          );
          internalSimilaritySum += similarity;
          internalCount++;
        }
      }

      // Calculate external similarity (with other categories)
      let externalSimilaritySum = 0;
      let externalCount = 0;

      for (const categoryCompany of categoryCompanies) {
        for (const otherCompany of otherCompanies) {
          const similarity = this.calculateEnhancedSimilarity(
            categoryCompany,
            otherCompany
          );
          externalSimilaritySum += similarity;
          externalCount++;
        }
      }

      result[category] = {
        companies: categoryCompanies,
        avgInternalSimilarity: internalCount > 0 ? internalSimilaritySum / internalCount : 0,
        avgExternalSimilarity: externalCount > 0 ? externalSimilaritySum / externalCount : 0
      };
    }

    return result;
  }

  /**
   * Calculate overall statistics
   */
  public static calculateOverallStats(companies: Company[]): {
    totalCompanies: number;
    companiesWithEmbeddings: number;
    avgSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
  } {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );

    if (companiesWithEmbeddings.length < 2) {
      return {
        totalCompanies: companies.length,
        companiesWithEmbeddings: companiesWithEmbeddings.length,
        avgSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0
      };
    }

    const similarities: number[] = [];

    for (let i = 0; i < companiesWithEmbeddings.length; i++) {
      for (let j = i + 1; j < companiesWithEmbeddings.length; j++) {
        const similarity = this.calculateEnhancedSimilarity(
          companiesWithEmbeddings[i],
          companiesWithEmbeddings[j]
        );
        similarities.push(similarity);
      }
    }

    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const maxSimilarity = Math.max(...similarities);
    const minSimilarity = Math.min(...similarities);

    return {
      totalCompanies: companies.length,
      companiesWithEmbeddings: companiesWithEmbeddings.length,
      avgSimilarity,
      maxSimilarity,
      minSimilarity
    };
  }

  /**
   * Find outlier companies (companies with low average similarity to others)
   */
  public static findOutliers(
    companies: Company[],
    threshold: number = 0.3
  ): CompanyWithSimilarity[] {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );

    if (companiesWithEmbeddings.length < 2) {
      return [];
    }

    const outliers: CompanyWithSimilarity[] = [];

    for (const company of companiesWithEmbeddings) {
      const otherCompanies = companiesWithEmbeddings.filter(c => c.id !== company.id);
      
      let totalSimilarity = 0;
      for (const other of otherCompanies) {
        totalSimilarity += this.calculateEnhancedSimilarity(company, other);
      }

      const avgSimilarity = totalSimilarity / otherCompanies.length;

      if (avgSimilarity < threshold) {
        outliers.push({
          company,
          similarity: avgSimilarity
        });
      }
    }

    return outliers.sort((a, b) => a.similarity - b.similarity);
  }
}