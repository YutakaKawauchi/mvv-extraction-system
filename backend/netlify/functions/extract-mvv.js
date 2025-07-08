const OpenAI = require('openai');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { rateLimiter, getRateLimitHeaders } = require('../../utils/rateLimiter');
const { logger } = require('../../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const EXTRACTION_PROMPT = `
以下の企業情報からMission（使命）、Vision（理念）、Values（価値観）を抽出してください。

企業情報: {companyDescription}

出力形式（必ずJSON形式で回答）:
{
  "mission": "企業の使命・目的（見つからない場合はnull）",
  "vision": "企業の理念・将来像（見つからない場合はnull）", 
  "values": ["価値観1", "価値観2", "価値観3"],
  "confidence_scores": {
    "mission": 0.95,
    "vision": 0.90,
    "values": 0.85
  },
  "extracted_from": "抽出元の情報ソース"
}

注意事項:
- 元の文章に忠実に抽出してください（創作・推測は禁止）
- 明確な情報がない場合はnullを設定
- 信頼度は0.0〜1.0で評価
- valuesは配列形式で、最大5つまで
`;

const getClientId = (event) => {
  // Use IP address as client identifier
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         'unknown';
};

const extractMVVFromCompany = async (companyInfo) => {
  const startTime = Date.now();
  
  try {
    const prompt = EXTRACTION_PROMPT.replace(
      '{companyDescription}', 
      `企業名: ${companyInfo.companyName}\nウェブサイト: ${companyInfo.companyWebsite}\n追加情報: ${companyInfo.companyDescription || 'なし'}`
    );

    logger.debug(`Starting OpenAI API call for ${companyInfo.companyName}`, {
      model: 'gpt-4o',
      promptLength: prompt.length
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'あなたは企業情報からMission、Vision、Valuesを正確に抽出する専門家です。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    const processingTime = Date.now() - startTime;
    logger.info(`OpenAI API call completed for ${companyInfo.companyName}`, {
      processingTime,
      tokensUsed: completion.usage?.total_tokens || 0,
      success: true
    });
    
    // Validate and sanitize the result
    return {
      mission: result.mission || null,
      vision: result.vision || null,
      values: Array.isArray(result.values) ? result.values.slice(0, 5) : [],
      confidence_scores: {
        mission: Math.min(Math.max(result.confidence_scores?.mission || 0, 0), 1),
        vision: Math.min(Math.max(result.confidence_scores?.vision || 0, 0), 1),
        values: Math.min(Math.max(result.confidence_scores?.values || 0, 0), 1)
      },
      extracted_from: result.extracted_from || 'OpenAI GPT-4o analysis'
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`OpenAI API call failed for ${companyInfo.companyName}`, {
      error: error.message,
      processingTime,
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
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Validate API access (API key or JWT token)
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: authResult.error || 'Authentication required'
        })
      };
    }

    // Log authentication type
    logger.info('Request authenticated', { 
      type: authResult.type,
      user: authResult.user?.username || 'api_key'
    });

    // Rate limiting
    const clientId = getClientId(event);
    const rateLimitResult = rateLimiter(clientId);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: {
          ...corsHeadersObj,
          ...rateLimitHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Rate limit exceeded'
        })
      };
    }

    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        })
      };
    }

    // Validate required fields
    const { companyId, companyName, companyWebsite, companyDescription } = requestData;
    if (!companyId || !companyName || !companyWebsite) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: companyId, companyName, companyWebsite'
        })
      };
    }

    // Extract MVV
    logger.info(`Starting MVV extraction for company: ${companyName}`, {
      companyId,
      hasDescription: !!companyDescription
    });
    
    const extractedData = await extractMVVFromCompany({
      companyId,
      companyName,
      companyWebsite,
      companyDescription
    });
    
    const totalProcessingTime = Date.now() - requestStartTime;
    
    const response = {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        ...rateLimitHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: extractedData,
        metadata: {
          processingTime: totalProcessingTime,
          timestamp: new Date().toISOString()
        }
      })
    };
    
    logger.apiResponse(200, extractedData, totalProcessingTime);
    return response;

  } catch (error) {
    const totalProcessingTime = Date.now() - requestStartTime;
    
    logger.error('Extract MVV Error', {
      error: error.message,
      stack: error.stack,
      processingTime: totalProcessingTime
    });
    
    const response = {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
    
    logger.apiResponse(500, { error: 'Internal server error' }, totalProcessingTime);
    return response;
  }
};