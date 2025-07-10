/**
 * Progressive similarity calculation system
 * Provides instant display with gradual enhancement
 */

import type { Company } from '../types';
import type { HybridCompany } from './hybridDataLoader';
import { SimilarityCalculator } from './similarityCalculator';
import { similarityCache } from './similarityCache';

export interface ProgressiveResult {
  companyA: Company | HybridCompany;
  companyB: Company | HybridCompany;
  quickSimilarity: number;
  enhancedSimilarity: number | null;
  isEnhanced: boolean;
}

export interface ProgressiveStats {
  totalCompanies: number;
  companiesWithEmbeddings: number;
  quickAvgSimilarity: number;
  enhancedAvgSimilarity: number | null;
  processingProgress: number;
  cacheHitRate: number;
}

export class ProgressiveCalculator {
  private isProcessing = false;
  // private processingProgress = 0;
  private abortController: AbortController | null = null;

  /**
   * Get quick similarity (cosine similarity only)
   */
  public static getQuickSimilarity(companyA: Company | HybridCompany, companyB: Company | HybridCompany): number {
    if (!companyA.embeddings || !companyB.embeddings) {
      return 0;
    }
    
    return SimilarityCalculator.cosineSimilarity(companyA.embeddings, companyB.embeddings);
  }

  /**
   * Get enhanced similarity (with caching)
   */
  public static getEnhancedSimilarity(companyA: Company | HybridCompany, companyB: Company | HybridCompany): number {
    // Check cache first
    const cached = similarityCache.get(companyA.id, companyB.id);
    if (cached !== null) {
      return cached;
    }

    // Calculate and cache
    const similarity = SimilarityCalculator.calculateEnhancedSimilarity(companyA, companyB);
    similarityCache.set(companyA.id, companyB.id, similarity);
    
    return similarity;
  }

  /**
   * Find similar companies with progressive enhancement
   */
  public async findSimilarCompanies(
    targetCompany: Company | HybridCompany,
    companies: (Company | HybridCompany)[],
    limit: number = 5,
    onProgress?: (progress: ProgressiveResult[]) => void
  ): Promise<ProgressiveResult[]> {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0 && c.id !== targetCompany.id
    );

    if (companiesWithEmbeddings.length === 0) {
      return [];
    }

    // Phase 1: Quick similarity (instant)
    const quickResults: ProgressiveResult[] = companiesWithEmbeddings.map(company => ({
      companyA: targetCompany,
      companyB: company,
      quickSimilarity: ProgressiveCalculator.getQuickSimilarity(targetCompany, company),
      enhancedSimilarity: null,
      isEnhanced: false
    }));

    // Sort by quick similarity
    quickResults.sort((a, b) => b.quickSimilarity - a.quickSimilarity);
    const topResults = quickResults.slice(0, limit);

    // Notify with quick results
    if (onProgress) {
      onProgress([...topResults]);
    }

    // Phase 2: Enhanced similarity (gradual)
    this.abortController = new AbortController();
    
    try {
      for (let i = 0; i < topResults.length; i++) {
        if (this.abortController.signal.aborted) {
          break;
        }

        const result = topResults[i];
        
        // Calculate enhanced similarity
        const enhancedSimilarity = ProgressiveCalculator.getEnhancedSimilarity(
          result.companyA,
          result.companyB
        );

        result.enhancedSimilarity = enhancedSimilarity;
        result.isEnhanced = true;

        // Re-sort by enhanced similarity
        topResults.sort((a, b) => {
          const aScore = a.enhancedSimilarity ?? a.quickSimilarity;
          const bScore = b.enhancedSimilarity ?? b.quickSimilarity;
          return bScore - aScore;
        });

        // Notify with updated results
        if (onProgress) {
          onProgress([...topResults]);
        }

        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Progressive calculation error:', error.message);
      }
    }

    return topResults;
  }

  /**
   * Calculate progressive statistics
   */
  public async calculateProgressiveStats(
    companies: Company[],
    onProgress?: (stats: ProgressiveStats) => void
  ): Promise<ProgressiveStats> {
    const companiesWithEmbeddings = companies.filter(
      c => c.embeddings && c.embeddings.length > 0
    );

    if (companiesWithEmbeddings.length < 2) {
      const emptyStats: ProgressiveStats = {
        totalCompanies: companies.length,
        companiesWithEmbeddings: companiesWithEmbeddings.length,
        quickAvgSimilarity: 0,
        enhancedAvgSimilarity: null,
        processingProgress: 0,
        cacheHitRate: 0
      };
      return emptyStats;
    }

    // Phase 1: Quick statistics
    const quickSimilarities: number[] = [];
    
    for (let i = 0; i < companiesWithEmbeddings.length; i++) {
      for (let j = i + 1; j < companiesWithEmbeddings.length; j++) {
        const quickSimilarity = ProgressiveCalculator.getQuickSimilarity(
          companiesWithEmbeddings[i],
          companiesWithEmbeddings[j]
        );
        quickSimilarities.push(quickSimilarity);
      }
    }

    const quickAvgSimilarity = quickSimilarities.reduce((a, b) => a + b, 0) / quickSimilarities.length;
    
    const initialStats: ProgressiveStats = {
      totalCompanies: companies.length,
      companiesWithEmbeddings: companiesWithEmbeddings.length,
      quickAvgSimilarity,
      enhancedAvgSimilarity: null,
      processingProgress: 0,
      cacheHitRate: similarityCache.getStats().hitRate
    };

    if (onProgress) {
      onProgress(initialStats);
    }

    // Phase 2: Enhanced statistics (sample-based for performance)
    const sampleSize = Math.min(100, quickSimilarities.length);
    const enhancedSimilarities: number[] = [];
    
    this.abortController = new AbortController();
    
    try {
      for (let i = 0; i < sampleSize; i++) {
        if (this.abortController.signal.aborted) {
          break;
        }

        const companyA = companiesWithEmbeddings[Math.floor(Math.random() * companiesWithEmbeddings.length)];
        const companyB = companiesWithEmbeddings[Math.floor(Math.random() * companiesWithEmbeddings.length)];
        
        if (companyA.id !== companyB.id) {
          const enhancedSimilarity = ProgressiveCalculator.getEnhancedSimilarity(companyA, companyB);
          enhancedSimilarities.push(enhancedSimilarity);
        }

        const progress = i / sampleSize;
        const enhancedAvgSimilarity = enhancedSimilarities.length > 0 
          ? enhancedSimilarities.reduce((a, b) => a + b, 0) / enhancedSimilarities.length
          : null;

        const updatedStats: ProgressiveStats = {
          ...initialStats,
          enhancedAvgSimilarity,
          processingProgress: progress,
          cacheHitRate: similarityCache.getStats().hitRate
        };

        if (onProgress) {
          onProgress(updatedStats);
        }

        await new Promise(resolve => setTimeout(resolve, 5));
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Progressive stats calculation error:', error.message);
      }
    }

    const finalStats: ProgressiveStats = {
      ...initialStats,
      enhancedAvgSimilarity: enhancedSimilarities.length > 0 
        ? enhancedSimilarities.reduce((a, b) => a + b, 0) / enhancedSimilarities.length
        : null,
      processingProgress: 1.0,
      cacheHitRate: similarityCache.getStats().hitRate
    };

    return finalStats;
  }

  /**
   * Abort current processing
   */
  public abortProcessing(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if currently processing
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}