/**
 * AI APIキャッシュサービス
 * クライアントサイドで決定論的なAI結果をキャッシュして
 * API呼び出しコストとレスポンス時間を大幅に削減
 */

import Dexie, { type Table } from 'dexie';

// 企業基本情報キャッシュ（temperature: 0.1, 決定論的）
export interface CompanyInfoCache {
  id: string;
  companyId: string;
  companyName: string;
  companyWebsite?: string;
  cacheType: 'company-info' | 'mvv-extraction' | 'company-classification';
  apiEndpoint: string;
  requestHash: string; // パラメータのハッシュ
  responseData: any;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt: Date;
  hitCount: number;
  estimatedCostSaved: number; // $単位
}

// 業界分析キャッシュ（temperature: 0.2-0.4, 部分的決定論的）
export interface IndustryAnalysisCache {
  id: string;
  industry: string;
  analysisType: string; // 'market-trends', 'competitive-landscape', 'regulatory-environment'
  requestHash: string;
  responseData: any;
  createdAt: Date;
  lastAccessed: Date;
  expiresAt: Date;
  confidence: number; // 再利用の信頼度
  hitCount: number;
  estimatedCostSaved: number;
}

// キャッシュ統計
export interface CacheStats {
  id: string;
  totalHits: number;
  totalMisses: number;
  totalCostSaved: number;
  lastUpdated: Date;
  hitRateByType: {
    companyInfo: number;
    industryAnalysis: number;
  };
}

class AICacheDatabase extends Dexie {
  companyInfoCache!: Table<CompanyInfoCache>;
  industryAnalysisCache!: Table<IndustryAnalysisCache>;
  cacheStats!: Table<CacheStats>;

  constructor() {
    super('AICacheDatabase');
    
    this.version(1).stores({
      companyInfoCache: '++id, companyId, companyName, cacheType, requestHash, createdAt, expiresAt, lastAccessed',
      industryAnalysisCache: '++id, industry, analysisType, requestHash, createdAt, expiresAt, lastAccessed',
      cacheStats: '++id, lastUpdated'
    });

    // 自動フック
    this.companyInfoCache.hook('creating', (_, obj) => {
      obj.createdAt = new Date();
      obj.lastAccessed = new Date();
      obj.hitCount = 0;
      obj.id = obj.id || this.generateCacheId();
    });

    this.industryAnalysisCache.hook('creating', (_, obj) => {
      obj.createdAt = new Date();
      obj.lastAccessed = new Date();
      obj.hitCount = 0;
      obj.id = obj.id || this.generateCacheId();
    });
  }

  private generateCacheId(): string {
    return `cache_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export class AICacheService {
  private db: AICacheDatabase;
  private stats = {
    hits: 0,
    misses: 0,
    totalSaved: 0
  };

  constructor() {
    this.db = new AICacheDatabase();
    this.initializeStats();
  }

  private async initializeStats(): Promise<void> {
    const existingStats = await this.db.cacheStats.toArray();
    if (existingStats.length === 0) {
      await this.db.cacheStats.add({
        id: 'main',
        totalHits: 0,
        totalMisses: 0,
        totalCostSaved: 0,
        lastUpdated: new Date(),
        hitRateByType: {
          companyInfo: 0,
          industryAnalysis: 0
        }
      });
    }
  }

  /**
   * 企業基本情報のキャッシュ取得
   * 対象: extract-company-info, extract-mvv-perplexity, add-company (temperature: 0.1)
   */
  async getCompanyInfoCache(
    cacheType: 'company-info' | 'mvv-extraction' | 'company-classification',
    companyId: string,
    companyName: string,
    requestParams: any
  ): Promise<any | null> {
    try {
      const requestHash = this.generateRequestHash(requestParams);
      
      const cached = await this.db.companyInfoCache
        .where('[companyId+cacheType+requestHash]')
        .equals([companyId, cacheType, requestHash])
        .first();

      if (!cached) {
        this.stats.misses++;
        await this.updateStats('miss', 'companyInfo');
        return null;
      }

      // 有効期限チェック
      if (new Date() > cached.expiresAt) {
        await this.db.companyInfoCache.delete(cached.id);
        this.stats.misses++;
        await this.updateStats('miss', 'companyInfo');
        return null;
      }

      // ヒット記録
      await this.db.companyInfoCache.update(cached.id, {
        lastAccessed: new Date(),
        hitCount: cached.hitCount + 1
      });

      this.stats.hits++;
      this.stats.totalSaved += cached.estimatedCostSaved;
      await this.updateStats('hit', 'companyInfo', cached.estimatedCostSaved);

      console.log(`💰 Cache HIT: ${cacheType} for ${companyName} (saved $${cached.estimatedCostSaved.toFixed(4)})`);
      return cached.responseData;

    } catch (error) {
      console.error('企業情報キャッシュ取得エラー:', {
        error: error instanceof Error ? error.message : String(error),
        cacheType,
        companyName,
        companyId
      });
      return null;
    }
  }

  /**
   * 企業基本情報のキャッシュ保存
   */
  async setCompanyInfoCache(
    cacheType: 'company-info' | 'mvv-extraction' | 'company-classification',
    companyId: string,
    companyName: string,
    companyWebsite: string | undefined,
    requestParams: any,
    responseData: any,
    apiEndpoint: string,
    estimatedCost: number
  ): Promise<void> {
    try {
      const requestHash = this.generateRequestHash(requestParams);
      
      // 有効期限設定（企業情報は7日間）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const cacheEntry: Partial<CompanyInfoCache> = {
        companyId,
        companyName,
        companyWebsite,
        cacheType,
        apiEndpoint,
        requestHash,
        responseData,
        expiresAt,
        estimatedCostSaved: estimatedCost
      };

      await this.db.companyInfoCache.add(cacheEntry as CompanyInfoCache);
      console.log(`💾 Cache SET: ${cacheType} for ${companyName} (cost: $${estimatedCost.toFixed(4)})`);

    } catch (error) {
      console.error('企業情報キャッシュ保存エラー:', {
        error: error instanceof Error ? error.message : String(error),
        cacheType,
        companyName,
        estimatedCost
      });
    }
  }

  /**
   * 業界分析キャッシュ取得
   * 対象: verify-business-idea の業界分析部分 (temperature: 0.2-0.4)
   */
  async getIndustryAnalysisCache(
    industry: string,
    analysisType: string,
    requestParams: any
  ): Promise<any | null> {
    try {
      const requestHash = this.generateRequestHash(requestParams);
      
      const cached = await this.db.industryAnalysisCache
        .where('[industry+analysisType+requestHash]')
        .equals([industry, analysisType, requestHash])
        .first();

      if (!cached) {
        this.stats.misses++;
        await this.updateStats('miss', 'industryAnalysis');
        return null;
      }

      // 有効期限チェック
      if (new Date() > cached.expiresAt) {
        await this.db.industryAnalysisCache.delete(cached.id);
        this.stats.misses++;
        await this.updateStats('miss', 'industryAnalysis');
        return null;
      }

      // 信頼度チェック（0.7以上で再利用）
      if (cached.confidence < 0.7) {
        this.stats.misses++;
        await this.updateStats('miss', 'industryAnalysis');
        return null;
      }

      // ヒット記録
      await this.db.industryAnalysisCache.update(cached.id, {
        lastAccessed: new Date(),
        hitCount: cached.hitCount + 1
      });

      this.stats.hits++;
      this.stats.totalSaved += cached.estimatedCostSaved;
      await this.updateStats('hit', 'industryAnalysis', cached.estimatedCostSaved);

      console.log(`🎯 Industry Cache HIT: ${industry}/${analysisType} (saved $${cached.estimatedCostSaved.toFixed(4)})`);
      return cached.responseData;

    } catch (error) {
      console.error('Industry cache get error:', error);
      return null;
    }
  }

  /**
   * 業界分析キャッシュ保存
   */
  async setIndustryAnalysisCache(
    industry: string,
    analysisType: string,
    requestParams: any,
    responseData: any,
    estimatedCost: number,
    confidence: number = 0.8
  ): Promise<void> {
    try {
      const requestHash = this.generateRequestHash(requestParams);
      
      // 有効期限設定（業界分析は30日間）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const cacheEntry: Partial<IndustryAnalysisCache> = {
        industry,
        analysisType,
        requestHash,
        responseData,
        expiresAt,
        confidence,
        estimatedCostSaved: estimatedCost
      };

      await this.db.industryAnalysisCache.add(cacheEntry as IndustryAnalysisCache);
      console.log(`🏭 Industry Cache SET: ${industry}/${analysisType} (cost: $${estimatedCost.toFixed(4)})`);

    } catch (error) {
      console.error('Industry cache set error:', error);
    }
  }

  /**
   * リクエストハッシュ生成
   */
  private generateRequestHash(params: any): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return btoa(normalized).substring(0, 32);
  }

  /**
   * 統計更新
   */
  private async updateStats(type: 'hit' | 'miss', cacheType: 'companyInfo' | 'industryAnalysis', costSaved?: number): Promise<void> {
    try {
      const stats = await this.db.cacheStats.get('main');
      if (stats) {
        const updates: Partial<CacheStats> = {
          lastUpdated: new Date()
        };

        if (type === 'hit') {
          updates.totalHits = stats.totalHits + 1;
          if (costSaved) {
            updates.totalCostSaved = stats.totalCostSaved + costSaved;
          }
        } else {
          updates.totalMisses = stats.totalMisses + 1;
        }

        // ヒット率計算
        const total = (updates.totalHits || stats.totalHits) + (updates.totalMisses || stats.totalMisses);
        if (total > 0) {
          const hitRate = (updates.totalHits || stats.totalHits) / total;
          updates.hitRateByType = {
            ...stats.hitRateByType,
            [cacheType]: hitRate
          };
        }

        await this.db.cacheStats.update('main', updates);
      }
    } catch (error) {
      console.error('Stats update error:', error);
    }
  }

  /**
   * キャッシュ統計取得
   */
  async getCacheStats(): Promise<{
    hitRate: number;
    totalSaved: number;
    companyInfoEntries: number;
    industryAnalysisEntries: number;
    oldestEntry: Date | null;
  }> {
    try {
      const stats = await this.db.cacheStats.get('main');
      const companyInfoCount = await this.db.companyInfoCache.count();
      const industryAnalysisCount = await this.db.industryAnalysisCache.count();
      
      // 最古のエントリ
      const oldestCompanyInfo = await this.db.companyInfoCache.orderBy('createdAt').first();
      const oldestIndustryAnalysis = await this.db.industryAnalysisCache.orderBy('createdAt').first();
      
      let oldestEntry: Date | null = null;
      if (oldestCompanyInfo && oldestIndustryAnalysis) {
        oldestEntry = oldestCompanyInfo.createdAt < oldestIndustryAnalysis.createdAt 
          ? oldestCompanyInfo.createdAt 
          : oldestIndustryAnalysis.createdAt;
      } else if (oldestCompanyInfo) {
        oldestEntry = oldestCompanyInfo.createdAt;
      } else if (oldestIndustryAnalysis) {
        oldestEntry = oldestIndustryAnalysis.createdAt;
      }

      if (!stats) {
        return {
          hitRate: 0,
          totalSaved: 0,
          companyInfoEntries: companyInfoCount,
          industryAnalysisEntries: industryAnalysisCount,
          oldestEntry
        };
      }

      const total = stats.totalHits + stats.totalMisses;
      const hitRate = total > 0 ? stats.totalHits / total : 0;

      return {
        hitRate,
        totalSaved: stats.totalCostSaved,
        companyInfoEntries: companyInfoCount,
        industryAnalysisEntries: industryAnalysisCount,
        oldestEntry
      };

    } catch (error) {
      console.error('Get cache stats error:', error);
      return {
        hitRate: 0,
        totalSaved: 0,
        companyInfoEntries: 0,
        industryAnalysisEntries: 0,
        oldestEntry: null
      };
    }
  }

  /**
   * 期限切れキャッシュクリーンアップ
   */
  async cleanupExpiredCache(): Promise<{ deletedCount: number; savedStorage: number }> {
    try {
      const now = new Date();
      
      // 期限切れ企業情報キャッシュ
      const expiredCompanyInfo = await this.db.companyInfoCache
        .where('expiresAt')
        .below(now)
        .toArray();
      
      // 期限切れ業界分析キャッシュ
      const expiredIndustryAnalysis = await this.db.industryAnalysisCache
        .where('expiresAt')
        .below(now)
        .toArray();

      // 削除実行
      await this.db.companyInfoCache.where('expiresAt').below(now).delete();
      await this.db.industryAnalysisCache.where('expiresAt').below(now).delete();

      const deletedCount = expiredCompanyInfo.length + expiredIndustryAnalysis.length;
      const savedStorage = this.estimateStorageSize(expiredCompanyInfo) + this.estimateStorageSize(expiredIndustryAnalysis);

      console.log(`🧹 Cache cleanup: ${deletedCount} entries deleted, ${savedStorage}KB storage freed`);
      
      return { deletedCount, savedStorage };

    } catch (error) {
      console.error('Cache cleanup error:', error);
      return { deletedCount: 0, savedStorage: 0 };
    }
  }

  /**
   * 全キャッシュクリア
   */
  async clearAllCache(): Promise<void> {
    try {
      await this.db.companyInfoCache.clear();
      await this.db.industryAnalysisCache.clear();
      await this.db.cacheStats.clear();
      await this.initializeStats();
      
      this.stats = { hits: 0, misses: 0, totalSaved: 0 };
      
      console.log('🗑️ All cache cleared');
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  }

  /**
   * ストレージサイズ推定
   */
  private estimateStorageSize(entries: any[]): number {
    return Math.round(JSON.stringify(entries).length / 1024); // KB
  }
}

// シングルトンインスタンス
export const aiCacheService = new AICacheService();