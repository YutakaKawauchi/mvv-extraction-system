const { logger } = require('../../utils/logger');
const { corsHeaders, handleCors } = require('../../utils/cors');
const { rateLimiter } = require('../../utils/rateLimiter');
const { validateJWT } = require('../../utils/jwt');
const { validateApiKey } = require('../../utils/auth');

/**
 * 新企業追加API - Perplexity AIによる自動MVV抽出とシステム統合
 * Phase 2ハイブリッド戦略: 動的企業データの生成と分析
 */
exports.handler = async (event, context) => {
  // CORS preflight handling
  if (event.httpMethod === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();
  const requestId = context.awsRequestId;
  
  logger.info('New company addition request started', {
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

    // Rate limiting - more restrictive for company addition
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const rateLimitResult = await rateLimiter(clientIP, 5, 60); // 5 requests per minute
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for company addition', {
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
            message: 'Rate limit exceeded. Company addition is limited to 5 requests per minute.',
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
          keyType: 'company-addition'
        });
      }
    }

    if (!isAuthenticated) {
      logger.warn('Authentication failed for company addition', {
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
    const validation = validateCompanyRequest(requestData);
    if (!validation.valid) {
      logger.warn('Invalid request data for company addition', {
        requestId,
        errors: validation.errors,
        companyName: requestData.name
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

    // Extract MVV using Perplexity AI
    const extractionResult = await extractCompanyMVV(requestData, requestId);
    
    if (!extractionResult.success) {
      return {
        statusCode: 502,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: extractionResult.error
        })
      };
    }

    // Generate embeddings for similarity analysis
    const embeddingResult = await generateEmbeddings(extractionResult.data, requestId);
    
    if (!embeddingResult.success) {
      return {
        statusCode: 502,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: embeddingResult.error
        })
      };
    }

    // Calculate similarity with existing companies
    const similarityResult = await calculateSimilarities(embeddingResult.data, requestId);

    const processingTime = Date.now() - startTime;
    
    logger.info('Company addition completed successfully', {
      requestId,
      companyName: requestData.name,
      category: requestData.category,
      processingTime,
      extractionTokens: extractionResult.tokensUsed,
      embeddingTokens: embeddingResult.tokensUsed,
      authMethod
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: true,
        data: {
          company: {
            id: generateCompanyId(requestData.name),
            name: requestData.name,
            website: requestData.website,
            category: requestData.category,
            ...extractionResult.data,
            embeddings: embeddingResult.data.embeddings,
            similarCompanies: similarityResult.similarCompanies || []
          },
          metadata: {
            processingTime,
            extractionSource: 'perplexity',
            embeddingModel: 'text-embedding-3-small',
            tokensUsed: {
              extraction: extractionResult.tokensUsed,
              embedding: embeddingResult.tokensUsed
            },
            requestId
          }
        }
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Unexpected error in company addition', {
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
          message: 'An unexpected error occurred while adding the company'
        }
      })
    };
  }
};

/**
 * リクエストデータのバリデーション
 */
function validateCompanyRequest(data) {
  const errors = [];

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('name field is required and must be a non-empty string');
  }

  if (!data.website || typeof data.website !== 'string') {
    errors.push('website field is required and must be a string');
  } else {
    // Basic URL validation
    try {
      new URL(data.website);
    } catch {
      errors.push('website must be a valid URL');
    }
  }

  if (!data.category || typeof data.category !== 'string' || data.category.trim().length === 0) {
    errors.push('category field is required and must be a non-empty string');
  }

  // Optional fields validation
  if (data.description && typeof data.description !== 'string') {
    errors.push('description must be a string if provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Perplexity AIを使用したMVV抽出
 */
async function extractCompanyMVV(companyData, requestId) {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: `あなたは企業のMission・Vision・Valuesを分析する専門家です。
企業の公式ウェブサイトから最新の情報を検索し、正確で一貫したMVVを抽出してください。

回答は必ず以下のJSON形式で返してください：
{
  "mission": "企業の使命（150文字以内）",
  "vision": "企業のビジョン（150文字以内）",
  "values": "企業の価値観（200文字以内、複数の価値観を含む場合は適切に統合）",
  "confidence_scores": {
    "mission": 0.9,
    "vision": 0.85,
    "values": 0.8
  },
  "extracted_from": "情報を取得したページのURL"
}`
          },
          {
            role: 'user',
            content: `以下の企業のMission・Vision・Valuesを公式ウェブサイトから調査して抽出してください：

企業名: ${companyData.name}
ウェブサイト: ${companyData.website}
業界: ${companyData.category}
${companyData.description ? `企業概要: ${companyData.description}` : ''}

公式サイトの最新情報を検索し、正確なMVVを日本語で抽出してください。`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      logger.error('Perplexity API error', {
        requestId,
        status: response.status,
        statusText: response.statusText
      });
      
      return {
        success: false,
        error: {
          code: 'PERPLEXITY_API_ERROR',
          message: 'Failed to extract MVV using Perplexity AI'
        }
      };
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const tokensUsed = result.usage.total_tokens;

    logger.info('Perplexity API response received', {
      requestId,
      companyName: companyData.name,
      tokensUsed,
      responseLength: content.length
    });

    // Parse JSON response
    let mvvData;
    try {
      mvvData = JSON.parse(content);
    } catch (error) {
      logger.error('Failed to parse Perplexity JSON response', {
        requestId,
        error: error.message,
        response: content.substring(0, 500)
      });
      
      return {
        success: false,
        error: {
          code: 'AI_RESPONSE_PARSE_ERROR',
          message: 'Failed to parse AI response'
        }
      };
    }

    return {
      success: true,
      data: mvvData,
      tokensUsed
    };

  } catch (error) {
    logger.error('Perplexity API call failed', {
      requestId,
      companyName: companyData.name,
      error: error.message
    });

    return {
      success: false,
      error: {
        code: 'AI_API_ERROR',
        message: 'Failed to extract MVV using AI',
        details: error.message
      }
    };
  }
}

/**
 * OpenAI埋め込みベクトル生成
 */
async function generateEmbeddings(mvvData, requestId) {
  try {
    const OpenAI = require('openai');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Combine MVV text for embedding
    const combinedText = `Mission: ${mvvData.mission} Vision: ${mvvData.vision} Values: ${mvvData.values}`;
    
    logger.info('Generating embeddings with OpenAI', {
      requestId,
      textLength: combinedText.length,
      model: 'text-embedding-3-small'
    });

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: combinedText,
      encoding_format: 'float'
    });

    const embeddings = response.data[0].embedding;
    const tokensUsed = response.usage.total_tokens;

    logger.info('OpenAI embeddings generated', {
      requestId,
      tokensUsed,
      embeddingDimensions: embeddings.length
    });

    return {
      success: true,
      data: {
        embeddings,
        combinedText
      },
      tokensUsed
    };

  } catch (error) {
    logger.error('OpenAI embeddings generation failed', {
      requestId,
      error: error.message,
      type: error.type || 'unknown'
    });

    return {
      success: false,
      error: {
        code: 'EMBEDDING_API_ERROR',
        message: 'Failed to generate embeddings',
        details: error.message
      }
    };
  }
}

/**
 * 既存企業との類似度計算（簡易版）
 */
async function calculateSimilarities(companyData, requestId) {
  try {
    // Note: This is a simplified version. In production, this would:
    // 1. Load existing company embeddings from storage
    // 2. Calculate cosine similarity with all existing companies
    // 3. Return top N similar companies
    
    logger.info('Calculating similarities (placeholder)', {
      requestId,
      embeddingDimensions: companyData.embeddings.length
    });

    // Placeholder similar companies - in production this would be calculated
    const similarCompanies = [
      { name: '類似企業1', similarity: 0.85, category: '医療機器' },
      { name: '類似企業2', similarity: 0.78, category: '医療機器' },
      { name: '類似企業3', similarity: 0.72, category: 'ヘルスケア' }
    ];

    return {
      success: true,
      similarCompanies
    };

  } catch (error) {
    logger.error('Similarity calculation failed', {
      requestId,
      error: error.message
    });

    // Don't fail the entire request for similarity calculation errors
    return {
      success: true,
      similarCompanies: []
    };
  }
}

/**
 * 企業IDの生成
 */
function generateCompanyId(companyName) {
  // Generate a unique ID based on company name and timestamp
  const timestamp = Date.now();
  const nameHash = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
  return `company_${nameHash}_${timestamp}`;
}