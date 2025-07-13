const { logger } = require('../../utils/logger');

/**
 * 利用量追跡・コスト監視システム
 * 
 * 機能:
 * - 段階的利用制限（Free/Beta/Premium）
 * - リアルタイムコスト追跡
 * - 日次・月次利用量管理
 * - 最適化提案
 */
class UsageTracker {
  constructor() {
    this.usage = new Map(); // ユーザー別利用データ
    this.costs = new Map();  // コスト追跡
    this.limits = this.getUsageLimits();
    
    // 統計情報
    this.stats = {
      totalApiCalls: 0,
      totalCosts: 0,
      cacheHits: 0,
      costSavings: 0
    };

    // 日次リセットタイマー
    this.startDailyResetTimer();
  }

  /**
   * 段階的利用制限設定
   */
  getUsageLimits() {
    return {
      free: {
        ideasPerDay: 3,
        ideasPerMonth: 20,
        savedIdeas: 10,
        features: ['basic_generation', 'simple_save'],
        maxCostPerDay: 0.10,   // $0.10/day
        maxCostPerMonth: 2.00  // $2.00/month
      },
      
      beta: {
        ideasPerDay: 10,
        ideasPerMonth: 100,
        savedIdeas: 50,
        features: ['enhanced_generation', 'advanced_save', 'export_json'],
        maxCostPerDay: 0.50,   // $0.50/day
        maxCostPerMonth: 10.00 // $10.00/month
      },
      
      premium: {
        ideasPerDay: 'unlimited',
        ideasPerMonth: 'unlimited',
        savedIdeas: 'unlimited',
        features: ['all_features', 'visual_assets', 'professional_export'],
        maxCostPerDay: 5.00,   // $5.00/day
        maxCostPerMonth: 100.00 // $100.00/month
      }
    };
  }

  /**
   * 利用制限チェック
   */
  async checkUsageLimits(username, tier = 'free') {
    const limits = this.limits[tier];
    const usage = await this.getUserUsage(username);
    const costs = await this.getUserCosts(username);

    // 日次制限チェック
    const dailyCheck = this.checkDailyLimits(usage, costs, limits);
    if (!dailyCheck.allowed) {
      return dailyCheck;
    }

    // 月次制限チェック
    const monthlyCheck = this.checkMonthlyLimits(usage, costs, limits);
    if (!monthlyCheck.allowed) {
      return monthlyCheck;
    }

    return {
      allowed: true,
      remainingDaily: this.calculateRemaining(usage.daily, limits, 'daily'),
      remainingMonthly: this.calculateRemaining(usage.monthly, limits, 'monthly'),
      currentTier: tier
    };
  }

  /**
   * 日次制限チェック
   */
  checkDailyLimits(usage, costs, limits) {
    const today = this.getDateKey(new Date());
    const dailyUsage = usage.daily[today] || { ideas: 0, apiCalls: 0 };
    const dailyCosts = costs.daily[today] || 0;

    // アイデア生成回数制限
    if (limits.ideasPerDay !== 'unlimited' && 
        dailyUsage.ideas >= limits.ideasPerDay) {
      return {
        allowed: false,
        reason: 'daily_ideas_limit',
        details: `Daily limit of ${limits.ideasPerDay} ideas reached`,
        resetTime: this.getNextDayReset()
      };
    }

    // 日次コスト制限
    if (dailyCosts >= limits.maxCostPerDay) {
      return {
        allowed: false,
        reason: 'daily_cost_limit',
        details: `Daily cost limit of $${limits.maxCostPerDay} reached`,
        resetTime: this.getNextDayReset()
      };
    }

    return { allowed: true };
  }

  /**
   * 月次制限チェック
   */
  checkMonthlyLimits(usage, costs, limits) {
    const thisMonth = this.getMonthKey(new Date());
    const monthlyUsage = usage.monthly[thisMonth] || { ideas: 0, apiCalls: 0 };
    const monthlyCosts = costs.monthly[thisMonth] || 0;

    // 月次アイデア制限
    if (limits.ideasPerMonth !== 'unlimited' && 
        monthlyUsage.ideas >= limits.ideasPerMonth) {
      return {
        allowed: false,
        reason: 'monthly_ideas_limit',
        details: `Monthly limit of ${limits.ideasPerMonth} ideas reached`,
        resetTime: this.getNextMonthReset()
      };
    }

    // 月次コスト制限
    if (monthlyCosts >= limits.maxCostPerMonth) {
      return {
        allowed: false,
        reason: 'monthly_cost_limit',
        details: `Monthly cost limit of $${limits.maxCostPerMonth} reached`,
        resetTime: this.getNextMonthReset()
      };
    }

    return { allowed: true };
  }

  /**
   * 利用量記録
   */
  async recordUsage(username, usageData) {
    const {
      type,           // 'api_call', 'cache_hit', 'idea_generation'
      companyId,
      cost = 0,
      tokensUsed = 0,
      metadata = {}
    } = usageData;

    try {
      const usage = await this.getUserUsage(username);
      const costs = await this.getUserCosts(username);
      
      const today = this.getDateKey(new Date());
      const thisMonth = this.getMonthKey(new Date());

      // 日次使用量更新
      if (!usage.daily[today]) {
        usage.daily[today] = { ideas: 0, apiCalls: 0, tokens: 0 };
      }
      
      if (!usage.monthly[thisMonth]) {
        usage.monthly[thisMonth] = { ideas: 0, apiCalls: 0, tokens: 0 };
      }

      // 使用量カウント
      if (type === 'api_call' || type === 'idea_generation') {
        usage.daily[today].ideas += 1;
        usage.daily[today].apiCalls += 1;
        usage.daily[today].tokens += tokensUsed;
        
        usage.monthly[thisMonth].ideas += 1;
        usage.monthly[thisMonth].apiCalls += 1;
        usage.monthly[thisMonth].tokens += tokensUsed;
      }

      // コスト記録
      if (cost > 0) {
        costs.daily[today] = (costs.daily[today] || 0) + cost;
        costs.monthly[thisMonth] = (costs.monthly[thisMonth] || 0) + cost;
        
        this.stats.totalCosts += cost;
      }

      // キャッシュヒット記録
      if (type === 'cache_hit') {
        this.stats.cacheHits += 1;
        this.stats.costSavings += (metadata.estimatedSavings || 0);
      }

      // 統計更新
      this.stats.totalApiCalls += 1;

      // 保存
      this.usage.set(username, usage);
      this.costs.set(username, costs);

      // 詳細ログ記録
      await this.logUsageDetail(username, {
        ...usageData,
        timestamp: new Date().toISOString(),
        dailyTotal: usage.daily[today],
        monthlyTotal: usage.monthly[thisMonth]
      });

      logger.info('Usage recorded', {
        username,
        type,
        cost,
        tokensUsed,
        dailyTotal: usage.daily[today].ideas,
        monthlyTotal: usage.monthly[thisMonth].ideas
      });

    } catch (error) {
      logger.error('Failed to record usage', { username, usageData, error });
    }
  }

  /**
   * ユーザー利用データ取得
   */
  async getUserUsage(username) {
    if (!this.usage.has(username)) {
      this.usage.set(username, {
        daily: {},
        monthly: {},
        total: { ideas: 0, apiCalls: 0, tokens: 0 }
      });
    }
    return this.usage.get(username);
  }

  /**
   * ユーザーコストデータ取得
   */
  async getUserCosts(username) {
    if (!this.costs.has(username)) {
      this.costs.set(username, {
        daily: {},
        monthly: {},
        total: 0
      });
    }
    return this.costs.get(username);
  }

  /**
   * 最適化提案生成
   */
  async generateOptimizationSuggestions(username) {
    const usage = await this.getUserUsage(username);
    const costs = await this.getUserCosts(username);
    const suggestions = [];

    // キャッシュ活用提案
    const cacheHitRate = this.calculateCacheHitRate(username);
    if (cacheHitRate < 0.3) {
      suggestions.push({
        type: 'cache_optimization',
        title: 'キャッシュ活用でコスト削減',
        description: '同じパラメータでの再実行を避けることで最大90%のコスト削減が可能です',
        potentialSavings: this.estimateCacheSavings(usage)
      });
    }

    // パラメータ最適化提案
    const duplicateParams = this.findDuplicateParameters(username);
    if (duplicateParams.length > 0) {
      suggestions.push({
        type: 'parameter_optimization',
        title: 'パラメータ設定の最適化',
        description: '類似パラメータの統合により効率的な分析が可能です',
        duplicateCount: duplicateParams.length
      });
    }

    // 利用パターン最適化
    const usagePattern = this.analyzeUsagePattern(usage);
    if (usagePattern.inefficient) {
      suggestions.push({
        type: 'usage_pattern',
        title: '利用パターンの最適化',
        description: usagePattern.suggestion,
        potentialImprovement: usagePattern.improvement
      });
    }

    return suggestions;
  }

  /**
   * リアルタイムコスト情報取得
   */
  async getRealTimeCostInfo(username) {
    const usage = await this.getUserUsage(username);
    const costs = await this.getUserCosts(username);
    const today = this.getDateKey(new Date());
    const thisMonth = this.getMonthKey(new Date());

    return {
      current: {
        daily: costs.daily[today] || 0,
        monthly: costs.monthly[thisMonth] || 0,
        total: costs.total || 0
      },
      usage: {
        dailyIdeas: usage.daily[today]?.ideas || 0,
        monthlyIdeas: usage.monthly[thisMonth]?.ideas || 0,
        totalTokens: usage.total?.tokens || 0
      },
      efficiency: {
        costPerIdea: this.calculateCostPerIdea(costs, usage),
        cacheHitRate: this.calculateCacheHitRate(username),
        savings: this.stats.costSavings
      },
      projections: {
        dailyProjected: this.projectDailyCost(usage, costs),
        monthlyProjected: this.projectMonthlyCost(usage, costs)
      }
    };
  }

  /**
   * 詳細利用ログ記録
   */
  async logUsageDetail(username, detail) {
    // 開発環境では詳細ログを記録
    if (process.env.NODE_ENV === 'development') {
      logger.info('Usage detail', { username, detail });
    }
    
    // 本番環境では集約データのみ
    // TODO: 外部ログシステムとの統合
  }

  /**
   * ヘルパーメソッド
   */
  getDateKey(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }

  getNextDayReset() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  getNextMonthReset() {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth.toISOString();
  }

  calculateRemaining(usage, limits, period) {
    const key = period === 'daily' ? 'ideasPerDay' : 'ideasPerMonth';
    const limit = limits[key];
    
    if (limit === 'unlimited') {
      return 'unlimited';
    }
    
    const used = usage?.ideas || 0;
    return Math.max(0, limit - used);
  }

  calculateCacheHitRate(username) {
    // TODO: ユーザー固有のキャッシュヒット率計算
    return this.stats.cacheHits / (this.stats.totalApiCalls || 1);
  }

  calculateCostPerIdea(costs, usage) {
    const totalCost = costs.total || 0;
    const totalIdeas = usage.total?.ideas || 1;
    return totalCost / totalIdeas;
  }

  estimateCacheSavings(usage) {
    const totalIdeas = usage.total?.ideas || 0;
    const avgCost = 0.05; // 平均コスト
    const potentialCacheRate = 0.6; // 60%キャッシュ可能
    return totalIdeas * avgCost * potentialCacheRate;
  }

  findDuplicateParameters(username) {
    // TODO: ユーザーのパラメータ履歴から重複を検出
    return [];
  }

  analyzeUsagePattern(usage) {
    // TODO: 利用パターン分析
    return { inefficient: false };
  }

  projectDailyCost(usage, costs) {
    // TODO: 日次コスト予測
    return 0;
  }

  projectMonthlyCost(usage, costs) {
    // TODO: 月次コスト予測
    return 0;
  }

  /**
   * 日次リセットタイマー
   */
  startDailyResetTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.performDailyReset();
      
      // 以降は24時間ごと
      setInterval(() => {
        this.performDailyReset();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * 日次リセット処理
   */
  performDailyReset() {
    logger.info('Performing daily usage reset');
    
    // 古い日次データのクリーンアップ（30日以上前）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffKey = this.getDateKey(cutoffDate);

    for (const [username, usage] of this.usage.entries()) {
      Object.keys(usage.daily).forEach(dateKey => {
        if (dateKey < cutoffKey) {
          delete usage.daily[dateKey];
        }
      });
    }

    for (const [username, costs] of this.costs.entries()) {
      Object.keys(costs.daily).forEach(dateKey => {
        if (dateKey < cutoffKey) {
          delete costs.daily[dateKey];
        }
      });
    }

    logger.info('Daily reset completed');
  }

  /**
   * 統計情報取得
   */
  getGlobalStats() {
    return {
      ...this.stats,
      activeUsers: this.usage.size,
      avgCostPerUser: this.stats.totalCosts / (this.usage.size || 1),
      cacheEfficiency: this.stats.cacheHits / (this.stats.totalApiCalls || 1)
    };
  }
}

module.exports = { UsageTracker };