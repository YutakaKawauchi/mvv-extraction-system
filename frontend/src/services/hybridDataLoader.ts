/**
 * ハイブリッドデータローダー
 * Phase 2のハイブリッド戦略：静的データ + 動的APIデータの統合管理
 */

import type { AnalysisData, AnalysisCompany } from '../types/analysis';
import { apiClient } from './apiClient';

export interface HybridCompany extends AnalysisCompany {
  // 動的データの追加プロパティ
  isNew?: boolean; // 新しく追加された企業
  lastUpdated?: string; // 最終更新日時
  source: 'static' | 'api'; // データソース
  embeddings?: number[]; // 埋め込みベクトル（オプション）
  insights?: {
    summary?: string;
    keyFactors?: string[];
    businessImplications?: string[];
    recommendations?: string[];
    confidence?: number;
    lastGenerated?: string;
  };
}

export interface HybridAnalysisData extends Omit<AnalysisData, 'companies'> {
  companies: HybridCompany[];
  metadata: {
    staticDataVersion: string;
    lastStaticLoad: string;
    dynamicCompaniesCount: number;
    lastApiUpdate: string;
    hybridVersion: string;
  };
}

interface CachedInsight {
  companyId: string;
  insight: any;
  timestamp: string;
  expiresAt: string;
}

interface CachedData {
  staticData?: AnalysisData;
  dynamicCompanies: HybridCompany[];
  cachedInsights: CachedInsight[];
  lastLoad: string;
}

class HybridDataLoader {
  private static instance: HybridDataLoader;
  private cache: CachedData;
  private isLoading = false;
  private loadPromise: Promise<HybridAnalysisData> | null = null;

  // キャッシュ設定
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間
  private readonly INSIGHT_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6時間
  private readonly STORAGE_KEY = 'mvv-hybrid-cache';
  private readonly MAX_CACHE_SIZE = 3 * 1024 * 1024; // 3MB制限

  private constructor() {
    this.cache = this.loadFromStorage();
  }

  public static getInstance(): HybridDataLoader {
    if (!HybridDataLoader.instance) {
      HybridDataLoader.instance = new HybridDataLoader();
    }
    return HybridDataLoader.instance;
  }

  /**
   * ハイブリッドデータの読み込み
   */
  public async loadHybridData(forceRefresh = false): Promise<HybridAnalysisData> {
    // 既に読み込み中の場合は、その Promise を返す
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // キャッシュチェック
    if (!forceRefresh && this.isCacheValid()) {
      return this.buildHybridData();
    }
    this.isLoading = true;

    this.loadPromise = this.performDataLoad();
    
    try {
      const result = await this.loadPromise;
      this.isLoading = false;
      this.loadPromise = null;
      return result;
    } catch (error) {
      this.isLoading = false;
      this.loadPromise = null;
      throw error;
    }
  }

  /**
   * 実際のデータ読み込み処理
   */
  private async performDataLoad(): Promise<HybridAnalysisData> {
    try {
      // 1. 静的データの読み込み
      const staticData = await this.loadStaticData();
      
      // 2. 動的企業データの読み込み（キャッシュから）
      const dynamicCompanies = this.cache.dynamicCompanies || [];
      
      // 3. ハイブリッドデータの構築
      const hybridData = this.buildHybridDataFromSources(staticData, dynamicCompanies);
      
      // 4. キャッシュの更新
      this.updateCache(staticData, dynamicCompanies);

      return hybridData;
    } catch (error) {
      console.error('❌ Failed to load hybrid data:', error);
      
      // フォールバック: キャッシュされた静的データを使用
      if (this.cache.staticData) {
        return this.buildHybridDataFromSources(this.cache.staticData, this.cache.dynamicCompanies || []);
      }
      
      throw error;
    }
  }

  /**
   * 静的データの読み込み
   */
  private async loadStaticData(): Promise<AnalysisData> {
    try {
      const response = await fetch('/mvv-analysis-data.json');
      if (!response.ok) {
        throw new Error(`Failed to load static data: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Failed to load static data:', error);
      throw new Error('Failed to load static analysis data');
    }
  }


  /**
   * AI洞察の生成とキャッシュ
   */
  public async generateInsights(
    type: 'similarity' | 'company' | 'industry',
    companyIds: string[],
    analysisData: any,
    language = 'ja'
  ): Promise<any> {
    try {
      // キャッシュキーの生成
      const cacheKey = this.generateInsightCacheKey(type, companyIds, analysisData);
      
      // キャッシュチェック
      const cachedInsight = this.getCachedInsight(cacheKey);
      if (cachedInsight) {
        return cachedInsight.insight;
      }
      
      const response = await apiClient.post('/generate-insights', {
        type,
        companyIds,
        analysisData,
        language
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to generate insights');
      }

      // 洞察をキャッシュ
      this.cacheInsight(cacheKey, response.data, this.INSIGHT_CACHE_DURATION);
      
      return response.data;

    } catch (error) {
      console.error('❌ Failed to generate insights:', error);
      throw error;
    }
  }

  /**
   * ハイブリッドデータの構築
   */
  private buildHybridData(): HybridAnalysisData {
    if (!this.cache.staticData) {
      throw new Error('No static data available in cache');
    }
    
    return this.buildHybridDataFromSources(
      this.cache.staticData,
      this.cache.dynamicCompanies || []
    );
  }

  /**
   * ソースからハイブリッドデータを構築
   */
  private buildHybridDataFromSources(
    staticData: AnalysisData,
    dynamicCompanies: HybridCompany[]
  ): HybridAnalysisData {
    // 静的企業データをHybridCompanyに変換
    const staticCompanies: HybridCompany[] = staticData.companies.map(company => ({
      ...company,
      source: 'static' as const,
      lastUpdated: this.cache.lastLoad
    }));

    // 動的企業データとマージ
    const allCompanies = [...staticCompanies, ...dynamicCompanies];

    // 重複除去（同じIDの企業があれば動的データを優先）
    const uniqueCompanies = this.deduplicateCompanies(allCompanies);

    // カテゴリ分析の更新（動的企業のカテゴリを追加）
    const updatedCategoryAnalysis = { ...staticData.categoryAnalysis };
    dynamicCompanies.forEach(company => {
      if (!updatedCategoryAnalysis[company.category]) {
        updatedCategoryAnalysis[company.category] = {
          companies: [],
          avgInternalSimilarity: 0,
          avgExternalSimilarity: 0
        };
      }
    });

    return {
      ...staticData,
      companies: uniqueCompanies,
      categoryAnalysis: updatedCategoryAnalysis,
      metadata: {
        staticDataVersion: '1.0.0',
        lastStaticLoad: this.cache.lastLoad,
        dynamicCompaniesCount: dynamicCompanies.length,
        lastApiUpdate: dynamicCompanies.length > 0 
          ? Math.max(...dynamicCompanies.map(c => new Date(c.lastUpdated || 0).getTime())).toString()
          : 'none',
        hybridVersion: '2.0.0'
      }
    };
  }

  /**
   * 企業データの重複除去
   */
  private deduplicateCompanies(companies: HybridCompany[]): HybridCompany[] {
    const seen = new Map<string, HybridCompany>();
    
    // 動的データを優先（後に追加されたものが残る）
    companies.forEach(company => {
      const existing = seen.get(company.id);
      if (!existing || company.source === 'api') {
        seen.set(company.id, company);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * キャッシュの妥当性チェック
   */
  private isCacheValid(): boolean {
    if (!this.cache.lastLoad || !this.cache.staticData) {
      return false;
    }
    
    const lastLoad = new Date(this.cache.lastLoad);
    const now = new Date();
    
    return (now.getTime() - lastLoad.getTime()) < this.CACHE_DURATION;
  }

  /**
   * キャッシュの更新
   */
  private updateCache(staticData: AnalysisData, dynamicCompanies: HybridCompany[]): void {
    this.cache = {
      staticData,
      dynamicCompanies,
      cachedInsights: this.cache.cachedInsights || [],
      lastLoad: new Date().toISOString()
    };
    
    this.saveToStorage();
  }

  /**
   * 洞察キャッシュキーの生成
   */
  private generateInsightCacheKey(
    type: string,
    companyIds: string[],
    analysisData: any
  ): string {
    const dataHash = JSON.stringify({ type, companyIds: companyIds.sort(), analysisData });
    return btoa(dataHash).substring(0, 32); // Base64エンコードして短縮
  }

  /**
   * キャッシュされた洞察の取得
   */
  private getCachedInsight(cacheKey: string): CachedInsight | null {
    const cached = this.cache.cachedInsights?.find(c => c.companyId === cacheKey);
    
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached;
    }
    
    // 期限切れのキャッシュを削除
    if (cached) {
      this.cache.cachedInsights = this.cache.cachedInsights.filter(c => c.companyId !== cacheKey);
      this.saveToStorage();
    }
    
    return null;
  }

  /**
   * 洞察のキャッシュ
   */
  private cacheInsight(cacheKey: string, insight: any, duration: number): void {
    const expiresAt = new Date(Date.now() + duration).toISOString();
    
    const cachedInsight: CachedInsight = {
      companyId: cacheKey,
      insight,
      timestamp: new Date().toISOString(),
      expiresAt
    };

    this.cache.cachedInsights = this.cache.cachedInsights || [];
    
    // 既存のキャッシュを削除
    this.cache.cachedInsights = this.cache.cachedInsights.filter(c => c.companyId !== cacheKey);
    
    // 新しいキャッシュを追加
    this.cache.cachedInsights.push(cachedInsight);
    
    // 古いキャッシュをクリーンアップ（最大100件）
    if (this.cache.cachedInsights.length > 100) {
      this.cache.cachedInsights.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      this.cache.cachedInsights = this.cache.cachedInsights.slice(0, 100);
    }
    
    this.saveToStorage();
  }

  /**
   * ローカルストレージからの読み込み（軽量データのみ）
   */
  private loadFromStorage(): CachedData {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // 埋め込みベクトルをフィルタして容量削減 & confidence_scores正規化
        if (parsed.dynamicCompanies) {
          parsed.dynamicCompanies = parsed.dynamicCompanies.map((company: any) => {
            const { embeddings, ...companyWithoutEmbeddings } = company;
            
            // confidence_scores (下線) を confidenceScores (キャメルケース) に正規化
            if (companyWithoutEmbeddings.confidence_scores && !companyWithoutEmbeddings.confidenceScores) {
              companyWithoutEmbeddings.confidenceScores = companyWithoutEmbeddings.confidence_scores;
              delete companyWithoutEmbeddings.confidence_scores;
            }
            
            // デフォルト値の設定
            if (!companyWithoutEmbeddings.confidenceScores) {
              companyWithoutEmbeddings.confidenceScores = {
                mission: 0.5,
                vision: 0.5,
                values: 0.5
              };
            }
            
            return companyWithoutEmbeddings;
          });
        }
        
        return parsed;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cache from storage:', error);
      // 容量エラーの場合はキャッシュクリア
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.log('🗑️ Clearing cache due to quota exceeded');
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
    
    // 緊急キャッシュから復元を試行
    try {
      const emergencyCache = localStorage.getItem(this.STORAGE_KEY + '_emergency');
      if (emergencyCache) {
        const emergencyData = JSON.parse(emergencyCache);
        
        // 緊急キャッシュを使用後削除
        localStorage.removeItem(this.STORAGE_KEY + '_emergency');
        
        // 緊急データも正規化
        const normalizedEmergencyCompanies = (emergencyData.dynamicCompanies || []).map((company: any) => {
          // confidence_scores正規化
          if (company.confidence_scores && !company.confidenceScores) {
            company.confidenceScores = company.confidence_scores;
            delete company.confidence_scores;
          }
          if (!company.confidenceScores) {
            company.confidenceScores = { mission: 0.5, vision: 0.5, values: 0.5 };
          }
          return company;
        });
        
        return {
          dynamicCompanies: normalizedEmergencyCompanies,
          cachedInsights: [],
          lastLoad: new Date().toISOString()
        };
      }
    } catch (emergencyError) {
      console.warn('⚠️ Failed to restore from emergency cache:', emergencyError);
    }
    
    return {
      dynamicCompanies: [],
      cachedInsights: [],
      lastLoad: new Date().toISOString()
    };
  }

  /**
   * ローカルストレージへの保存（軽量化）
   */
  private saveToStorage(): void {
    try {
      // 埋め込みベクトルを除外してサイズを削減
      const lightweightCache = {
        ...this.cache,
        staticData: this.cache.staticData ? {
          ...this.cache.staticData,
          // 静的データの埋め込みは保存しない（必要時に再取得）
          companies: this.cache.staticData.companies.map(company => {
            const { embeddings, ...companyData } = company as any;
            return companyData;
          })
        } : undefined,
        dynamicCompanies: this.cache.dynamicCompanies.map(company => {
          const { embeddings, ...companyData } = company;
          return companyData;
        })
      };
      
      let cacheString = JSON.stringify(lightweightCache);
      
      // サイズチェックと段階的削減
      if (cacheString.length > this.MAX_CACHE_SIZE) {
        // 段階的にデータを削減
        lightweightCache.cachedInsights = lightweightCache.cachedInsights.slice(0, 10);
        cacheString = JSON.stringify(lightweightCache);
        
        if (cacheString.length > this.MAX_CACHE_SIZE) {
          lightweightCache.staticData = undefined;
          cacheString = JSON.stringify(lightweightCache);
          
          if (cacheString.length > this.MAX_CACHE_SIZE) {
            lightweightCache.dynamicCompanies = lightweightCache.dynamicCompanies.slice(-3);
            lightweightCache.cachedInsights = [];
            cacheString = JSON.stringify(lightweightCache);
          }
        }
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(lightweightCache));
      
    } catch (error) {
      console.warn('⚠️ Failed to save cache to storage:', error);
      
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        try {
          // 最小限のデータのみ保存
          const minimalCache = {
            dynamicCompanies: this.cache.dynamicCompanies.slice(-5).map(company => {
              const { embeddings, ...companyData } = company;
              return companyData as HybridCompany;
            }),
            cachedInsights: [],
            lastLoad: this.cache.lastLoad
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(minimalCache));
        } catch (retryError) {
          // 完全にクリアする前に、動的企業だけは別キーで保存を試行
          try {
            const emergencyData = {
              dynamicCompanies: this.cache.dynamicCompanies.slice(-3).map(company => {
                const { embeddings, ...companyData } = company;
                return companyData as HybridCompany;
              })
            };
            localStorage.setItem(this.STORAGE_KEY + '_emergency', JSON.stringify(emergencyData));
          } catch (emergencyError) {
            console.error('❌ Even emergency cache failed:', emergencyError);
          }
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }
    }
  }

  /**
   * キャッシュのクリア
   */
  public clearCache(): void {
    this.cache = {
      dynamicCompanies: [],
      cachedInsights: [],
      lastLoad: new Date().toISOString()
    };
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * キャッシュ統計の取得
   */
  public getCacheStats() {
    return {
      staticDataExists: !!this.cache.staticData,
      dynamicCompanies: this.cache.dynamicCompanies?.length || 0,
      cachedInsights: this.cache.cachedInsights?.length || 0,
      lastLoad: this.cache.lastLoad,
      cacheValid: this.isCacheValid(),
      cacheSize: JSON.stringify(this.cache).length
    };
  }
}

// シングルトンインスタンスをエクスポート
export const hybridDataLoader = HybridDataLoader.getInstance();