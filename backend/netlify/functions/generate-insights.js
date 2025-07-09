const { logger } = require('../../utils/logger');
const { corsHeaders, handleCors } = require('../../utils/cors');
const { rateLimiter } = require('../../utils/rateLimiter');
const { validateJWT } = require('../../utils/jwt');
const { validateApiKey } = require('../../utils/auth');

/**
 * AI洞察生成API - GPT-4o-miniによる深い分析洞察の生成
 * Phase 2ハイブリッド戦略の第一段階
 */
exports.handler = async (event, context) => {
  // CORS preflight handling
  if (event.httpMethod === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();
  const requestId = context.awsRequestId;
  
  logger.info('AI insights generation request started', {
    requestId,
    method: event.httpMethod,
    origin: event.headers.origin,
    userAgent: event.headers['user-agent']
  });

  try {
    // Method validation
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'POST method required'
          }
        })
      };
    }

    // Rate limiting
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const rateLimitResult = await rateLimiter(clientIP, 10, 60); // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for insights generation', {
        requestId,
        clientIP,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      });
      
      return {
        statusCode: 429,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please wait before making another request.',
            details: {
              remaining: rateLimitResult.remaining,
              resetTime: rateLimitResult.resetTime
            }
          }
        })
      };
    }

    // Authentication
    const authHeader = event.headers.authorization;
    const apiKey = event.headers['x-api-key'];
    
    let isAuthenticated = false;
    let authMethod = 'none';

    // JWT Authentication (primary)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = validateJWT(token);
      
      if (decoded) {
        isAuthenticated = true;
        authMethod = 'jwt';
        logger.info('JWT authentication successful', {
          requestId,
          userId: decoded.username,
          expiresAt: new Date(decoded.exp * 1000).toISOString()
        });
      }
    }

    // API Key Authentication (fallback)
    if (!isAuthenticated && apiKey) {
      const apiKeyResult = validateApiKey(event);
      
      if (apiKeyResult.valid) {
        isAuthenticated = true;
        authMethod = 'apikey';
        logger.info('API key authentication successful', {
          requestId,
          keyType: 'mvv-insights'
        });
      }
    }

    if (!isAuthenticated) {
      logger.warn('Authentication failed for insights generation', {
        requestId,
        hasAuthHeader: !!authHeader,
        hasApiKey: !!apiKey
      });
      
      return {
        statusCode: 401,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Valid JWT token or API key required'
          }
        })
      };
    }

    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      logger.error('Invalid JSON in request body', {
        requestId,
        error: error.message,
        body: event.body?.substring(0, 200)
      });
      
      return {
        statusCode: 400,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body'
          }
        })
      };
    }

    // Validate request data
    const validation = validateInsightRequest(requestData);
    if (!validation.valid) {
      logger.warn('Invalid request data for insights generation', {
        requestId,
        errors: validation.errors,
        requestType: requestData.type
      });
      
      return {
        statusCode: 400,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST_DATA',
            message: 'Invalid request data',
            details: validation.errors
          }
        })
      };
    }

    // Generate insights using OpenAI GPT-4o-mini
    const insightResult = await generateInsights(requestData, requestId);
    
    if (!insightResult.success) {
      return {
        statusCode: 502,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: insightResult.error
        })
      };
    }

    const processingTime = Date.now() - startTime;
    
    logger.info('AI insights generation completed successfully', {
      requestId,
      type: requestData.type,
      processingTime,
      tokensUsed: insightResult.tokensUsed,
      authMethod
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: true,
        data: {
          insights: insightResult.insights,
          metadata: {
            analysisType: requestData.type,
            processingTime,
            confidence: insightResult.confidence,
            tokensUsed: insightResult.tokensUsed,
            requestId
          }
        }
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Unexpected error in insights generation', {
      requestId,
      error: error.message,
      stack: error.stack,
      processingTime
    });

    return {
      statusCode: 500,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while generating insights'
        }
      })
    };
  }
};

/**
 * リクエストデータのバリデーション
 */
function validateInsightRequest(data) {
  const errors = [];

  // Required fields
  if (!data.type) {
    errors.push('type field is required');
  } else if (!['similarity', 'company', 'industry'].includes(data.type)) {
    errors.push('type must be one of: similarity, company, industry');
  }

  if (!data.companyIds || !Array.isArray(data.companyIds)) {
    errors.push('companyIds must be an array');
  } else {
    if (data.type === 'similarity' && data.companyIds.length !== 2) {
      errors.push('similarity analysis requires exactly 2 company IDs');
    } else if (data.type === 'company' && data.companyIds.length !== 1) {
      errors.push('company analysis requires exactly 1 company ID');
    }
  }

  if (!data.analysisData) {
    errors.push('analysisData field is required');
  }

  // Language validation (optional, defaults to 'ja')
  if (data.language && !['ja', 'en'].includes(data.language)) {
    errors.push('language must be ja or en');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * OpenAI GPT-4o-miniを使用した洞察生成
 */
async function generateInsights(requestData, requestId) {
  try {
    const OpenAI = require('openai');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // プロンプト生成
    const prompt = generatePrompt(requestData);
    
    logger.info('Generating insights with OpenAI', {
      requestId,
      type: requestData.type,
      promptLength: prompt.length,
      model: 'gpt-4o-mini'
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(requestData.language || 'ja')
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;

    logger.info('OpenAI response received', {
      requestId,
      tokensUsed,
      responseLength: response.length
    });

    // Parse JSON response
    let insights;
    try {
      insights = JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse OpenAI JSON response', {
        requestId,
        error: error.message,
        response: response.substring(0, 500)
      });
      
      return {
        success: false,
        error: {
          code: 'AI_RESPONSE_PARSE_ERROR',
          message: 'Failed to parse AI response'
        }
      };
    }

    // Confidence score calculation (simplified)
    const confidence = calculateConfidence(insights, requestData);

    return {
      success: true,
      insights,
      confidence,
      tokensUsed
    };

  } catch (error) {
    logger.error('OpenAI API error in insights generation', {
      requestId,
      error: error.message,
      type: error.type || 'unknown'
    });

    return {
      success: false,
      error: {
        code: 'AI_API_ERROR',
        message: 'Failed to generate insights using AI',
        details: error.message
      }
    };
  }
}

/**
 * システムプロンプトの生成
 */
function getSystemPrompt(language) {
  if (language === 'en') {
    return `You are an expert analyst of Mission, Vision, and Values (MVV) for Japanese healthcare companies.
Provide deep business insights and strategic recommendations based on MVV analysis.

Analysis perspectives:
1. Essential meaning of MVV and impact on corporate culture
2. Industry positioning and competitive relationships  
3. Business strategy implications
4. Specific and actionable recommendations

Always respond in JSON format with clear, business-focused language.`;
  }

  return `あなたは日本のヘルスケア業界のMVV（Mission・Vision・Values）分析の専門家です。
企業の理念と価値観を深く理解し、ビジネス的な洞察を提供してください。

分析の観点：
1. MVVの本質的な意味と企業文化への影響
2. 業界内での位置づけと競合関係
3. ビジネス戦略への示唆
4. 具体的で実行可能な推奨事項

必ずJSON形式で、ビジネスパーソンが理解しやすい言葉で回答してください。`;
}

/**
 * ユーザープロンプトの生成
 */
function generatePrompt(requestData) {
  const { type, companyIds, analysisData, language } = requestData;

  if (type === 'similarity') {
    return generateSimilarityPrompt(analysisData, language);
  } else if (type === 'company') {
    return generateCompanyPrompt(analysisData, language);
  } else if (type === 'industry') {
    return generateIndustryPrompt(analysisData, language);
  }

  throw new Error(`Unknown analysis type: ${type}`);
}

/**
 * 類似度分析プロンプト生成
 */
function generateSimilarityPrompt(analysisData, language) {
  const isJapanese = language === 'ja' || !language;
  
  if (isJapanese) {
    return `以下の2社のMVV類似度分析結果について詳細な洞察を提供してください：

類似度: ${analysisData.similarity}
共通キーワード:
- Mission: ${analysisData.commonKeywords?.mission?.join('、') || 'なし'}
- Vision: ${analysisData.commonKeywords?.vision?.join('、') || 'なし'}  
- Values: ${analysisData.commonKeywords?.values?.join('、') || 'なし'}

業界カテゴリ: ${analysisData.categories?.join('、') || '未分類'}

以下のJSON形式で回答してください：
{
  "summary": "類似度の要約説明（150文字以内）",
  "keyFactors": ["類似している主要な要因1", "要因2", "要因3"],
  "businessImplications": ["ビジネス上の示唆1", "示唆2", "示唆3"],
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`;
  }

  return `Provide detailed insights on the MVV similarity analysis between two companies:

Similarity Score: ${analysisData.similarity}
Common Keywords:
- Mission: ${analysisData.commonKeywords?.mission?.join(', ') || 'None'}
- Vision: ${analysisData.commonKeywords?.vision?.join(', ') || 'None'}
- Values: ${analysisData.commonKeywords?.values?.join(', ') || 'None'}

Industry Categories: ${analysisData.categories?.join(', ') || 'Unclassified'}

Respond in the following JSON format:
{
  "summary": "Summary of similarity (150 chars max)",
  "keyFactors": ["Key similarity factor 1", "Factor 2", "Factor 3"],
  "businessImplications": ["Business implication 1", "Implication 2", "Implication 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}`;
}

/**
 * 企業分析プロンプト生成
 */
function generateCompanyPrompt(analysisData, language) {
  const isJapanese = language === 'ja' || !language;
  
  if (isJapanese) {
    return `以下の企業のMVV分析について詳細な洞察を提供してください：

Mission: ${analysisData.mvv?.mission || '未設定'}
Vision: ${analysisData.mvv?.vision || '未設定'}
Values: ${analysisData.mvv?.values || '未設定'}

業界: ${analysisData.category || '未分類'}
類似企業: ${analysisData.similarCompanies?.map(c => `${c.name}(${c.similarity})`).join('、') || 'なし'}

以下のJSON形式で回答してください：
{
  "summary": "企業MVVの特徴要約（150文字以内）",
  "strengths": ["強みとなるMVV要素1", "要素2", "要素3"],
  "uniqueness": ["独自性のある点1", "点2", "点3"],
  "recommendations": ["MVV活用の推奨事項1", "推奨事項2", "推奨事項3"]
}`;
  }

  return `Provide detailed insights on the company's MVV analysis:

Mission: ${analysisData.mvv?.mission || 'Not set'}
Vision: ${analysisData.mvv?.vision || 'Not set'}
Values: ${analysisData.mvv?.values || 'Not set'}

Industry: ${analysisData.category || 'Unclassified'}
Similar Companies: ${analysisData.similarCompanies?.map(c => `${c.name}(${c.similarity})`).join(', ') || 'None'}

Respond in the following JSON format:
{
  "summary": "Company MVV characteristics summary (150 chars max)",
  "strengths": ["MVV strength 1", "Strength 2", "Strength 3"],
  "uniqueness": ["Unique aspect 1", "Aspect 2", "Aspect 3"],
  "recommendations": ["MVV utilization recommendation 1", "Recommendation 2", "Recommendation 3"]
}`;
}

/**
 * 業界分析プロンプト生成
 */
function generateIndustryPrompt(analysisData, language) {
  const isJapanese = language === 'ja' || !language;
  
  if (isJapanese) {
    return `以下の業界のMVV分析について詳細な洞察を提供してください：

業界: ${analysisData.category}
対象企業: ${analysisData.companies?.join('、') || 'なし'}
業界内平均類似度: ${analysisData.avgInternalSimilarity}
業界間平均類似度: ${analysisData.avgExternalSimilarity}
一貫性指数: ${analysisData.coherenceIndex}

以下のJSON形式で回答してください：
{
  "summary": "業界MVV特性の要約（150文字以内）",
  "industryCharacteristics": ["業界特徴1", "特徴2", "特徴3"],
  "competitiveInsights": ["競合環境の洞察1", "洞察2", "洞察3"],
  "trends": ["業界トレンド1", "トレンド2", "トレンド3"]
}`;
  }

  return `Provide detailed insights on the industry MVV analysis:

Industry: ${analysisData.category}
Companies: ${analysisData.companies?.join(', ') || 'None'}
Average Internal Similarity: ${analysisData.avgInternalSimilarity}
Average External Similarity: ${analysisData.avgExternalSimilarity}
Coherence Index: ${analysisData.coherenceIndex}

Respond in the following JSON format:
{
  "summary": "Industry MVV characteristics summary (150 chars max)",
  "industryCharacteristics": ["Industry characteristic 1", "Characteristic 2", "Characteristic 3"],
  "competitiveInsights": ["Competitive insight 1", "Insight 2", "Insight 3"],
  "trends": ["Industry trend 1", "Trend 2", "Trend 3"]
}`;
}

/**
 * 信頼度スコア計算（簡易版）
 */
function calculateConfidence(insights, requestData) {
  let score = 0.8; // Base confidence

  // JSON structure completeness
  if (insights.summary && insights.summary.length > 0) score += 0.05;
  if (insights.keyFactors && Array.isArray(insights.keyFactors) && insights.keyFactors.length >= 2) score += 0.05;
  if (insights.businessImplications && Array.isArray(insights.businessImplications)) score += 0.05;
  if (insights.recommendations && Array.isArray(insights.recommendations)) score += 0.05;

  return Math.min(score, 1.0);
}