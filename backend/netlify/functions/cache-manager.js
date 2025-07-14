const crypto = require('crypto');
const { logger } = require('../../utils/logger');

/**
 * ⚠️ DEPRECATED: サーバーサイドキャッシュシステム
 * 
 * このキャッシュシステムはNetlify Functionsのstateless性により無効です。
 * Map()ベースのキャッシュは関数呼び出し間で失われます。
 * 
 * 新しいキャッシュ戦略:
 * - クライアントサイドIndexedDBキャッシュ (決定論的API用)
 * - 選択的業界分析キャッシュ (部分決定論的API用)
 * - 創造的コンテンツはキャッシュなし (temperature 0.7)
 * 
 * このファイルは後方互換性のために保持されています。
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      totalSavings: 0,
      lastCleanup: Date.now()
    };
    
    // キャッシュ設定
    this.config = {
      level1: {
        duration: 24 * 60 * 60 * 1000, // 24時間
        prefix: 'L1_company_',
        maxSize: 1000
      },
      level2: {
        duration: 7 * 24 * 60 * 60 * 1000, // 7日間
        prefix: 'L2_similar_',
        maxSize: 500
      },
      level3: {
        duration: 30 * 24 * 60 * 60 * 1000, // 30日間
        prefix: 'L3_industry_',
        maxSize: 100
      }
    };

    // 定期クリーンアップ
    this.startCleanupTimer();
  }

  /**
   * キャッシュキー生成（階層的戦略）
   */
  generateCacheKey(companyId, analysisParams) {
    // Level 1: 企業固有キーの生成
    const companySpecific = this.generateCompanySpecificKey(companyId, analysisParams);
    
    // Level 2: 類似パラメータキーの生成
    const similarParams = this.generateSimilarParamsKey(analysisParams);
    
    // Level 3: 業界テンプレートキーの生成
    const industryTemplate = this.generateIndustryTemplateKey(analysisParams);

    return {
      level1: companySpecific,
      level2: similarParams,
      level3: industryTemplate,
      primary: companySpecific // 優先キー
    };
  }

  /**
   * Level 1: 企業固有キャッシュキー
   */
  generateCompanySpecificKey(companyId, analysisParams) {
    const params = {
      companyId,
      focusAreas: (analysisParams.focusAreas || []).sort(),
      constraints: analysisParams.constraints || {},
      version: 'alpha'
    };
    
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    
    return `${this.config.level1.prefix}${hash}`;
  }

  /**
   * Level 2: 類似パラメータキャッシュキー
   */
  generateSimilarParamsKey(analysisParams) {
    const params = {
      industry: analysisParams.industry,
      focusAreas: (analysisParams.focusAreas || []).sort(),
      businessType: analysisParams.businessType,
      version: 'alpha'
    };
    
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    
    return `${this.config.level2.prefix}${hash}`;
  }

  /**
   * Level 3: 業界テンプレートキャッシュキー
   */
  generateIndustryTemplateKey(analysisParams) {
    const params = {
      industry: analysisParams.industry || 'general',
      businessModel: analysisParams.businessModel || 'general',
      version: 'alpha'
    };
    
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    
    return `${this.config.level3.prefix}${hash}`;
  }

  /**
   * 階層的キャッシュ取得（L1 → L2 → L3 の順）
   */
  async getCached(cacheKeys) {
    const keys = typeof cacheKeys === 'string' ? 
      { primary: cacheKeys } : cacheKeys;

    // Level 1 チェック（最優先）
    if (keys.level1) {
      const l1Result = await this.getCachedByKey(keys.level1, 'level1');
      if (l1Result) {
        this.stats.hits++;
        logger.info('Cache hit L1', { key: keys.level1 });
        return this.adaptCachedResult(l1Result, 'level1');
      }
    }

    // Level 2 チェック
    if (keys.level2) {
      const l2Result = await this.getCachedByKey(keys.level2, 'level2');
      if (l2Result) {
        this.stats.hits++;
        logger.info('Cache hit L2', { key: keys.level2 });
        return this.adaptCachedResult(l2Result, 'level2');
      }
    }

    // Level 3 チェック
    if (keys.level3) {
      const l3Result = await this.getCachedByKey(keys.level3, 'level3');
      if (l3Result) {
        this.stats.hits++;
        logger.info('Cache hit L3', { key: keys.level3 });
        return this.adaptCachedResult(l3Result, 'level3');
      }
    }

    // Primary key チェック（後方互換性）
    if (keys.primary && keys.primary !== keys.level1) {
      const primaryResult = await this.getCachedByKey(keys.primary, 'primary');
      if (primaryResult) {
        this.stats.hits++;
        logger.info('Cache hit primary', { key: keys.primary });
        return primaryResult;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 単一キーでのキャッシュ取得
   */
  async getCachedByKey(key, level) {
    try {
      const cached = this.cache.get(key);
      
      if (!cached) {
        return null;
      }

      // 有効期限チェック
      const config = this.getLevelConfig(level);
      const isExpired = Date.now() - cached.timestamp > config.duration;
      
      if (isExpired) {
        this.cache.delete(key);
        logger.info('Cache expired and removed', { key, level });
        return null;
      }

      return cached;
    } catch (error) {
      logger.error('Cache get error', { key, level, error });
      return null;
    }
  }

  /**
   * キャッシュされた結果の適応（レベル別調整）
   */
  adaptCachedResult(cachedResult, level) {
    const adapted = { ...cachedResult };
    
    // キャッシュレベルをデータに含める
    adapted.cacheLevel = level === 'level1' ? 1 : level === 'level2' ? 2 : level === 'level3' ? 3 : 0;
    
    switch (level) {
      case 'level2':
        // 類似パラメータキャッシュ: 企業固有情報を調整
        adapted.metadata = {
          ...adapted.metadata,
          cacheLevel: 2,
          adaptationType: 'similar_params',
          confidence: Math.max(0.6, (adapted.metadata.confidence || 0.8) - 0.1)
        };
        break;
        
      case 'level3':
        // 業界テンプレート: より一般的な内容に調整
        adapted.metadata = {
          ...adapted.metadata,
          cacheLevel: 3,
          adaptationType: 'industry_template',
          confidence: Math.max(0.5, (adapted.metadata.confidence || 0.8) - 0.2),
          isTemplate: true
        };
        break;
        
      default:
        adapted.metadata = {
          ...adapted.metadata,
          cacheLevel: 1,
          adaptationType: 'exact_match'
        };
    }

    return adapted;
  }

  /**
   * キャッシュ保存（全レベル対応）
   */
  async setCached(cacheKeys, data) {
    const keys = typeof cacheKeys === 'string' ? 
      { primary: cacheKeys } : cacheKeys;

    const cachedItem = {
      data: data.data,
      metadata: data.metadata,
      timestamp: Date.now()
    };

    try {
      // Level 1 保存
      if (keys.level1) {
        await this.setCachedByKey(keys.level1, cachedItem, 'level1');
      }

      // Level 2 保存（一般化）
      if (keys.level2) {
        const generalizedData = this.generalizeForLevel2(cachedItem);
        await this.setCachedByKey(keys.level2, generalizedData, 'level2');
      }

      // Level 3 保存（テンプレート化）
      if (keys.level3) {
        const templateData = this.generalizeForLevel3(cachedItem);
        await this.setCachedByKey(keys.level3, templateData, 'level3');
      }

      // Primary key 保存（後方互換性）
      if (keys.primary && keys.primary !== keys.level1) {
        await this.setCachedByKey(keys.primary, cachedItem, 'primary');
      }

      // コスト節約効果の記録
      if (data.metadata.estimatedCost) {
        this.stats.totalSavings += data.metadata.estimatedCost;
      }

    } catch (error) {
      logger.error('Cache set error', { keys, error });
    }
  }

  /**
   * 単一キーでのキャッシュ保存
   */
  async setCachedByKey(key, data, level) {
    const config = this.getLevelConfig(level);
    
    // サイズ制限チェック
    if (this.cache.size >= config.maxSize) {
      await this.evictOldestByLevel(level);
    }

    this.cache.set(key, data);
    logger.info('Cache set', { key, level, size: this.cache.size });
  }

  /**
   * Level 2用データ一般化
   */
  generalizeForLevel2(cachedItem) {
    const generalized = { ...cachedItem };
    
    // 企業固有情報を除去・一般化
    if (generalized.data.ideas) {
      generalized.data.ideas = generalized.data.ideas.map(idea => ({
        ...idea,
        title: this.generalizeTitle(idea.title),
        description: this.generalizeDescription(idea.description),
        // worldviewは企業名のみ一般化してMVV内容は保持
        worldview: this.generalizeCompanyNameInWorldview(idea.worldview)
      }));
    }

    return generalized;
  }

  /**
   * Level 3用データテンプレート化
   */
  generalizeForLevel3(cachedItem) {
    const template = { ...cachedItem };
    
    // より高度な一般化（MVV worldviewは保持してcompany固有性を維持）
    if (template.data.ideas) {
      template.data.ideas = template.data.ideas.map(idea => ({
        ...idea,
        title: this.createTemplate(idea.title),
        description: this.createTemplate(idea.description),
        // worldviewはMVV固有性が重要なので企業名のみ一般化
        worldview: this.generalizeCompanyNameInWorldview(idea.worldview)
      }));
    }

    return template;
  }

  /**
   * レベル設定取得
   */
  getLevelConfig(level) {
    switch (level) {
      case 'level1': return this.config.level1;
      case 'level2': return this.config.level2;
      case 'level3': return this.config.level3;
      default: return this.config.level1;
    }
  }

  /**
   * レベル別古いキャッシュの削除
   */
  async evictOldestByLevel(level) {
    const prefix = this.getLevelConfig(level).prefix;
    const keysToEvict = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        keysToEvict.push({ key, timestamp: value.timestamp });
      }
    }

    // 古い順にソート
    keysToEvict.sort((a, b) => a.timestamp - b.timestamp);
    
    // 古いものから削除（10%削除）
    const evictCount = Math.max(1, Math.floor(keysToEvict.length * 0.1));
    for (let i = 0; i < evictCount; i++) {
      this.cache.delete(keysToEvict[i].key);
    }

    logger.info('Cache eviction', { level, evictCount, remaining: this.cache.size });
  }

  /**
   * 定期クリーンアップ
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // 1時間ごと
  }

  /**
   * 期限切れキャッシュのクリーンアップ
   */
  async cleanup() {
    const before = this.cache.size;
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, value] of this.cache.entries()) {
      const level = this.detectLevel(key);
      const config = this.getLevelConfig(level);
      
      if (now - value.timestamp > config.duration) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    this.stats.lastCleanup = now;
    logger.info('Cache cleanup completed', { 
      removed: keysToDelete.length, 
      before, 
      after: this.cache.size 
    });
  }

  /**
   * キーからレベル検出
   */
  detectLevel(key) {
    if (key.startsWith(this.config.level1.prefix)) return 'level1';
    if (key.startsWith(this.config.level2.prefix)) return 'level2';
    if (key.startsWith(this.config.level3.prefix)) return 'level3';
    return 'primary';
  }

  /**
   * キャッシュ統計情報
   */
  async getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  async getEstimatedSavings() {
    return this.stats.totalSavings;
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * ヘルパーメソッド
   */
  generalizeTitle(title) {
    return title?.replace(/[企業名][\w\s]+/g, '[企業名]') || title;
  }

  generalizeDescription(description) {
    return description?.replace(/[企業名][\w\s]+/g, '[企業名]') || description;
  }

  createTemplate(text) {
    return text?.replace(/[\w\s]+業界/g, '[業界]')
               ?.replace(/[\w\s]+向け/g, '[ターゲット]向け') || text;
  }

  generalizeCompanyNameInWorldview(worldview) {
    if (!worldview) return worldview;
    
    // MVV worldviewはキャッシュでの一般化を最小限に抑制
    // プレースホルダー問題を避けるため、過度な置換は行わない
    return worldview
      // 既存のプレースホルダーパターンを修正
      .replace(/\[企業名\]/g, '対象企業')
      // 法人格付き企業名の置換（より控えめに）
      .replace(/(SCSK|サイバーエージェント|トヨタ自動車)株式会社/g, '対象企業')
      // Mission/Vision/Values引用符内は完全に保護
      .replace(/「([^」]+)」/g, (match) => {
        // 引用符内のMVVテキストは一切変更しない
        return match;
      });
  }
}

module.exports = { CacheManager };