const { handleCors } = require('../../utils/cors');
const { validateApiKey } = require('../../utils/auth');
const { rateLimiter, getRateLimitHeaders } = require('../../utils/rateLimiter');
const { logger } = require('../../utils/logger');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const getClientId = (event) => {
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         'unknown';
};

const searchCompanyMVV = async (companyName, website, additionalInfo) => {
  const searchQuery = `${companyName} ミッション ビジョン バリュー 企業理念 価値観 会社概要 ${website}`;
  
  const prompt = `${companyName}の以下の情報について詳しく調べて、正確なJSON形式で回答してください：

1. Mission（使命・目的）
2. Vision（理念・将来像）  
3. Values（価値観・行動指針）

企業ウェブサイト: ${website}
${additionalInfo ? `追加情報: ${additionalInfo}` : ''}

出力形式（必ずこのJSON形式で）:
{
  "mission": "企業の使命・目的（見つからない場合はnull）",
  "vision": "企業の理念・将来像（見つからない場合はnull）", 
  "values": ["価値観1", "価値観2", "価値観3"],
  "confidence_scores": {
    "mission": 0.95,
    "vision": 0.90,
    "values": 0.85
  },
  "extracted_from": "情報の出典URL"
}

注意事項:
- 公式サイトや信頼できるソースからの情報のみ使用
- 推測や創作は禁止、明確な記載がない場合はnullを設定
- 信頼度は情報の確実性に基づいて0.0〜1.0で評価
- valuesは配列形式で、最大5つまで
- 日本語で回答してください`;

  const startTime = Date.now();
  
  try {
    logger.debug(`Starting Perplexity API call for ${companyName}`, {
      model: 'sonar-pro',
      promptLength: prompt.length,
      website: website
    });
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.debug(`Perplexity API response for ${companyName}`, {
      status: response.status,
      hasChoices: !!result.choices,
      choicesLength: result.choices?.length || 0,
      model: result.model
    });
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('No choices returned from Perplexity API');
    }
    
    const content = result.choices[0].message.content;
    
    logger.debug(`Perplexity response content for ${companyName}`, {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 200) || 'No content'
    });

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error(`No valid JSON found in Perplexity response for ${companyName}`, {
        content: content,
        contentLength: content?.length || 0
      });
      throw new Error('No valid JSON found in Perplexity response');
    }

    const mvvData = JSON.parse(jsonMatch[0]);
    
    const processingTime = Date.now() - startTime;
    
    // Validate and sanitize response
    const sanitizedData = {
      mission: mvvData.mission || null,
      vision: mvvData.vision || null,
      values: Array.isArray(mvvData.values) ? mvvData.values : [],
      confidence_scores: {
        mission: Math.min(Math.max(mvvData.confidence_scores?.mission || 0, 0), 1),
        vision: Math.min(Math.max(mvvData.confidence_scores?.vision || 0, 0), 1),
        values: Math.min(Math.max(mvvData.confidence_scores?.values || 0, 0), 1)
      },
      extracted_from: mvvData.extracted_from || 'Perplexity AI search'
    };
    
    logger.perplexityCall(companyName, searchQuery, JSON.stringify(sanitizedData), {
      processingTime,
      success: true
    });
    
    return sanitizedData;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error(`Perplexity API call failed for ${companyName}`, {
      error: error.message,
      processingTime,
      website: website,
      success: false
    });
    
    throw new Error(`MVV extraction failed: ${error.message}`);
  }
};

exports.handler = async (event, context) => {
  const requestStartTime = Date.now();
  
  logger.apiRequest(event.httpMethod, event.path, event.headers, event.body);
  
  // Handle CORS
  const corsResult = handleCors(event);
  if (corsResult) return corsResult;

  // Get CORS headers for all responses
  const corsHeaders = require('../../utils/cors').corsHeaders(event.headers.origin || event.headers.Origin);

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      })
    };
  }

  try {
    // Validate API key
    const authResult = validateApiKey(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ 
          success: false, 
          error: authResult.error 
        })
      };
    }

    // Rate limiting
    const clientId = getClientId(event);
    const rateLimitResult = rateLimiter(clientId);
    
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult)
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        })
      };
    }

    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { companyId, companyName, companyWebsite, companyDescription } = requestBody;

    // Validate required fields
    if (!companyId || !companyName || !companyWebsite) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: companyId, companyName, companyWebsite' 
        })
      };
    }

    // Check if Perplexity API key is configured
    if (!PERPLEXITY_API_KEY) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ 
          success: false, 
          error: 'Perplexity API key not configured' 
        })
      };
    }

    logger.info(`Starting Perplexity MVV extraction for company: ${companyName}`, {
      companyId,
      hasDescription: !!companyDescription,
      website: companyWebsite
    });

    // Extract MVV using Perplexity API
    const mvvData = await searchCompanyMVV(companyName, companyWebsite, companyDescription);
    
    logger.debug(`Perplexity MVV extraction completed for ${companyName}`, {
      companyId,
      hasMission: !!mvvData.mission,
      hasVision: !!mvvData.vision,
      valuesCount: mvvData.values?.length || 0
    });

    const totalProcessingTime = Date.now() - requestStartTime;

    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...getRateLimitHeaders(rateLimitResult)
      },
      body: JSON.stringify({
        success: true,
        data: mvvData,
        metadata: {
          processingTime: totalProcessingTime,
          timestamp: new Date().toISOString(),
          source: 'perplexity'
        }
      })
    };
    
    logger.apiResponse(200, mvvData, totalProcessingTime);
    return response;

  } catch (error) {
    const totalProcessingTime = Date.now() - requestStartTime;
    
    logger.error('Extract MVV Perplexity Error', {
      error: error.message,
      stack: error.stack,
      processingTime: totalProcessingTime
    });
    
    const response = {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error during MVV extraction' 
      })
    };
    
    logger.apiResponse(500, { error: 'Internal server error during MVV extraction' }, totalProcessingTime);
    return response;
  }
};