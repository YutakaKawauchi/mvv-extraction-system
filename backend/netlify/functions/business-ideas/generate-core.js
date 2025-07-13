const { OpenAI } = require('openai');
const { cors } = require('../../utils/cors');
const { validateAuth } = require('../../utils/auth');
const { logger } = require('../../utils/logger');
const { CacheManager } = require('./cache-manager');
const { UsageTracker } = require('./usage-tracker');
const { optimizePrompt, parseStructuredResponse } = require('../shared/openai-optimized');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// キャッシュとトラッカー初期化
const cacheManager = new CacheManager();
const usageTracker = new UsageTracker();

/**
 * ビジネスアイデア生成API (Phase α: Core Foundation)
 * 
 * 機能:
 * - 基本的なビジネスアイデア生成（3案）
 * - 簡易リーンキャンバス
 * - MVV適合度分析
 * - コスト最適化（キャッシュ、トークン最適化）
 */
exports.handler = async (event, context) => {
  // CORS headers
  const corsHeaders = cors();
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 認証チェック
    const authResult = await validateAuth(event.headers);
    if (!authResult.isValid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // リクエスト解析
    const requestBody = JSON.parse(event.body);
    const { 
      companyId, 
      analysisParams = {}, 
      options = {} 
    } = requestBody;

    // 入力検証
    if (!companyId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'companyId is required' })
      };
    }

    logger.info('Starting business idea generation', { 
      companyId, 
      analysisParams, 
      user: authResult.user?.username 
    });

    // 利用量チェック
    const usageCheck = await usageTracker.checkUsageLimits(authResult.user?.username);
    if (!usageCheck.allowed) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Usage limit exceeded',
          details: usageCheck.details,
          resetTime: usageCheck.resetTime
        })
      };
    }

    // キャッシュチェック（コスト最適化）
    const cacheKey = cacheManager.generateCacheKey(companyId, analysisParams);
    const cachedResult = await cacheManager.getCached(cacheKey);
    
    if (cachedResult) {
      logger.info('Returning cached result', { cacheKey, companyId });
      
      // 利用量記録（キャッシュヒット）
      await usageTracker.recordUsage(authResult.user?.username, {
        type: 'cache_hit',
        companyId,
        cost: 0
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: cachedResult.data,
          metadata: {
            ...cachedResult.metadata,
            cached: true,
            cacheAge: Date.now() - cachedResult.generatedAt
          }
        })
      };
    }

    // 企業データ取得
    const companyData = await getCompanyData(companyId);
    if (!companyData) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Company not found' })
      };
    }

    // AI分析実行
    const startTime = Date.now();
    const analysisResult = await generateBusinessIdeas(companyData, analysisParams, options);
    const processingTime = Date.now() - startTime;

    // キャッシュに保存
    await cacheManager.setCached(cacheKey, {
      data: analysisResult,
      metadata: {
        companyId,
        analysisParams,
        processingTime,
        generatedAt: Date.now(),
        tokensUsed: analysisResult.metadata.tokensUsed
      }
    });

    // 利用量記録
    await usageTracker.recordUsage(authResult.user?.username, {
      type: 'api_call',
      companyId,
      cost: analysisResult.metadata.estimatedCost,
      tokensUsed: analysisResult.metadata.tokensUsed
    });

    logger.info('Business idea generation completed', { 
      companyId, 
      processingTime,
      tokensUsed: analysisResult.metadata.tokensUsed,
      estimatedCost: analysisResult.metadata.estimatedCost
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: analysisResult,
        metadata: {
          processingTime,
          generatedAt: Date.now(),
          cached: false,
          costOptimization: {
            cacheHitRate: await cacheManager.getHitRate(),
            estimatedSavings: await cacheManager.getEstimatedSavings()
          }
        }
      })
    };

  } catch (error) {
    logger.error('Business idea generation error', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

/**
 * 企業データ取得（既存システムとの統合）
 */
async function getCompanyData(companyId) {
  try {
    // TODO: 既存の企業データベースから取得
    // 現段階では仮のデータ構造を返す
    return {
      id: companyId,
      name: "Sample Company",
      industry: "Technology",
      mvv: {
        mission: "Sample mission",
        vision: "Sample vision", 
        values: ["Sample value 1", "Sample value 2"]
      },
      profile: {
        foundedYear: 2010,
        employeeCount: 500,
        capital: 1000000000,
        location: "Tokyo, Japan"
      }
    };
  } catch (error) {
    logger.error('Failed to get company data', error);
    return null;
  }
}

/**
 * ビジネスアイデア生成（Phase α版）
 */
async function generateBusinessIdeas(companyData, analysisParams, options) {
  const maxIdeas = options.maxIdeas || 3; // Phase α: 最大3案
  
  // プロンプト最適化（トークン効率化）
  const systemPrompt = `あなたは日本企業の新規事業開発の専門家です。企業のMVVと事業プロファイルから、実現可能性の高い新規事業アイデアを生成してください。

出力は必ずJSON形式で、以下の構造に従ってください：
{
  "ideas": [
    {
      "title": "アイデアタイトル",
      "description": "150文字以内の説明",
      "worldview": "MVVで表現された世界観",
      "leanCanvas": {
        "problem": ["課題1", "課題2"],
        "solution": "ソリューション説明",
        "valueProposition": "価値提案",
        "targetCustomers": ["顧客セグメント1", "顧客セグメント2"],
        "revenueStreams": ["収益モデル1", "収益モデル2"]
      },
      "feasibility": {
        "mvvAlignment": 0.8,
        "implementationScore": 0.7,
        "marketPotential": 0.6
      }
    }
  ]
}`;

  const userPrompt = optimizePrompt({
    company: companyData,
    analysisParams,
    maxIdeas
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Phase α: コスト効率重視
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2000, // トークン制限
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = parseStructuredResponse(response);
    
    return {
      ideas: result.ideas || [],
      metadata: {
        model: "gpt-4o-mini",
        tokensUsed: response.usage.total_tokens,
        estimatedCost: calculateCost(response.usage),
        confidence: 0.8, // Phase α: 基本品質
        version: "alpha"
      }
    };

  } catch (error) {
    logger.error('OpenAI API error', error);
    throw new Error('Failed to generate business ideas');
  }
}

/**
 * API利用コスト計算
 */
function calculateCost(usage) {
  // GPT-4o-mini pricing (参考値)
  const inputCostPer1M = 0.15; // $0.15/1M tokens
  const outputCostPer1M = 0.60; // $0.60/1M tokens
  
  const inputCost = (usage.prompt_tokens / 1000000) * inputCostPer1M;
  const outputCost = (usage.completion_tokens / 1000000) * outputCostPer1M;
  
  return inputCost + outputCost;
}