/**
 * Smart caching system for similarity calculations
 * LRU cache with persistence support
 */

export interface CacheEntry {
  similarity: number;
  timestamp: number;
  accessCount: number;
}

export class SimilarityCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from two company IDs
   */
  private generateKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('|');
  }

  /**
   * Get similarity from cache
   */
  get(id1: string, id2: string): number | null {
    const key = this.generateKey(id1, id2);
    const entry = this.cache.get(key);
    
    if (entry) {
      // Update access count and timestamp
      entry.accessCount++;
      entry.timestamp = Date.now();
      
      // Move to end of access order (LRU)
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      
      return entry.similarity;
    }
    
    return null;
  }

  /**
   * Set similarity in cache
   */
  set(id1: string, id2: string, similarity: number): void {
    const key = this.generateKey(id1, id2);
    
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    const entry: CacheEntry = {
      similarity,
      timestamp: Date.now(),
      accessCount: 1
    };
    
    this.cache.set(key, entry);
    
    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict oldest (least recently used) entry
   */
  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Check if similarity is cached
   */
  has(id1: string, id2: string): boolean {
    const key = this.generateKey(id1, id2);
    return this.cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; accessCount: number; timestamp: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      timestamp: entry.timestamp
    }));

    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (totalAccesses - this.cache.size) / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount)
    };
  }

  /**
   * Preload similarities for a set of companies
   */
  async preloadSimilarities(
    companies: Array<{ id: string; embeddings?: number[] }>,
    calculateSimilarity: (companyA: any, companyB: any) => number
  ): Promise<void> {
    const companiesWithEmbeddings = companies.filter(c => c.embeddings);
    
    for (let i = 0; i < companiesWithEmbeddings.length; i++) {
      for (let j = i + 1; j < companiesWithEmbeddings.length; j++) {
        const companyA = companiesWithEmbeddings[i];
        const companyB = companiesWithEmbeddings[j];
        
        if (!this.has(companyA.id, companyB.id)) {
          const similarity = calculateSimilarity(companyA, companyB);
          this.set(companyA.id, companyB.id, similarity);
        }
      }
    }
  }
}

// Global cache instance
export const similarityCache = new SimilarityCache();