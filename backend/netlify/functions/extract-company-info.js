const { handleCors } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { rateLimiter, getRateLimitHeaders } = require('../../utils/rateLimiter');
const { logger } = require('../../utils/logger');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Perplexityを使用した企業情報の抽出
async function extractCompanyInfoWithPerplexity(companyName, website, options = {}) {
  const { includeFinancials = true, includeESG = false, includeCompetitors = false } = options;
  
  const currentYear = new Date().getFullYear();
  const prompt = `${companyName}の以下の情報について、${website}を含む公式情報源から詳しく調べて、正確なJSON形式で回答してください：

基本情報:
- 設立年
- 従業員数（最新）
- 本社所在地（詳細）
- 都道府県
- 市区町村
- 郵便番号

${includeFinancials ? `
財務情報（${currentYear}年または最新年度）:
- 売上高（百万円単位）
- 営業利益（百万円単位）
- 純利益（百万円単位）
- 時価総額（百万円単位、上場企業の場合）
` : ''}

事業構造:
- 主要事業セグメント
- 主要製品・サービス
- 市場シェア（主要事業）
- 海外売上比率（%）

産業分類（日本標準産業分類に基づく）:
- 大分類（A-T）と名称
- 中分類コード（3桁）と名称
- 小分類コード（4桁）と名称（可能であれば）
- 主業界・業種名

上場情報:
- 上場状況（listed/unlisted/delisted）
- 証券コード（上場企業の場合）
- 上場市場（東証プライム、グロース等）

組織情報:
- 平均年齢
- 平均勤続年数
- 女性管理職比率（%）
- 新卒採用数

${includeESG ? `
ESG情報:
- ESGスコアまたは評価
- CO2削減目標
- 主要な社会貢献活動
` : ''}

${includeCompetitors ? `
競合情報:
- 主要競合企業（3-5社）
- 業界での立ち位置
- 競争優位性
` : ''}

出力形式（必ずこのJSON形式で）:
{
  "basic_info": {
    "founded_year": 設立年（数値、不明ならnull）,
    "employee_count": 従業員数（数値、不明ならnull）,
    "headquarters_location": "本社所在地詳細（不明ならnull）",
    "prefecture": "都道府県（不明ならnull）",
    "city": "市区町村（不明ならnull）",
    "postal_code": "郵便番号（不明ならnull）"
  },
  "financial_data": {
    "revenue": 売上高（百万円単位、不明ならnull）,
    "revenue_year": 売上高の年度（数値、不明ならnull）,
    "operating_profit": 営業利益（百万円単位、不明ならnull）,
    "net_profit": 純利益（百万円単位、不明ならnull）,
    "market_cap": 時価総額（百万円単位、不明ならnull）
  },
  "business_structure": {
    "segments": ["事業セグメント1", "事業セグメント2"],
    "main_products": ["製品1", "製品2"],
    "market_share": 市場シェア（%、不明ならnull）,
    "overseas_revenue_ratio": 海外売上比率（%、不明ならnull）
  },
  "industry_classification": {
    "jsic_major_category": "大分類コード（A-T、不明ならnull）",
    "jsic_major_name": "大分類名称（不明ならnull）",
    "jsic_middle_category": "中分類コード（3桁、不明ならnull）",
    "jsic_middle_name": "中分類名称（不明ならnull）",
    "jsic_minor_category": "小分類コード（4桁、不明ならnull）",
    "jsic_minor_name": "小分類名称（不明ならnull）",
    "primary_industry": "主業界名（不明ならnull）",
    "business_type": "業種名（不明ならnull）"
  },
  "listing_info": {
    "status": "listed/unlisted/delisted/unknown",
    "stock_code": "証券コード（不明ならnull）",
    "exchange": "上場市場（不明ならnull）"
  },
  "organization_info": {
    "average_age": 平均年齢（数値、不明ならnull）,
    "average_tenure": 平均勤続年数（数値、不明ならnull）,
    "female_manager_ratio": 女性管理職比率（%、不明ならnull）,
    "new_graduate_hires": 新卒採用数（数値、不明ならnull）
  },
  "esg_info": {
    "score": ESGスコア（0-100、不明ならnull）,
    "co2_target": "CO2削減目標（不明ならnull）",
    "social_activities": "社会貢献活動（不明ならnull）"
  },
  "competitive_info": {
    "main_competitors": ["競合1", "競合2"],
    "industry_position": "業界での立ち位置（不明ならnull）",
    "advantages": ["優位性1", "優位性2"]
  },
  "metadata": {
    "sources": ["情報源URL1", "情報源URL2"],
    "extraction_date": "${new Date().toISOString()}",
    "confidence_score": 0.0-1.0の信頼度
  }
}

注意事項:
- 最優先：有価証券報告書、統合報告書、IR資料（特に財務情報）
- 次点：公式ウェブサイト、信頼できるニュースソース
- 推測や創作は禁止、明確な記載がない場合はnullを設定
- 信頼度は情報源の確実性と情報の網羅性に基づいて評価
- 数値は適切な単位に変換（売上高は百万円単位）
- 産業分類は日本標準産業分類（JSIC）に厳密に従い、最も適切な分類を選択
- 複数事業の場合は主要事業（売上高最大）に基づいて分類
- 本社所在地は詳細住所、都道府県、市区町村、郵便番号に分けて記載
- 日本語で回答してください`;

  try {
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
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    logger.info('Perplexity API response received', { 
      companyName,
      contentLength: content.length 
    });

    // JSONの抽出と解析
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const companyInfo = JSON.parse(jsonMatch[0]);
    
    // レスポンスの正規化と検証
    const normalizedInfo = {
      founded_year: companyInfo.basic_info?.founded_year || null,
      employee_count: companyInfo.basic_info?.employee_count || null,
      headquarters_location: companyInfo.basic_info?.headquarters_location || null,
      prefecture: companyInfo.basic_info?.prefecture || null,
      city: companyInfo.basic_info?.city || null,
      postal_code: companyInfo.basic_info?.postal_code || null,
      
      financial_data: {
        revenue: companyInfo.financial_data?.revenue || null,
        revenue_year: companyInfo.financial_data?.revenue_year || null,
        operating_profit: companyInfo.financial_data?.operating_profit || null,
        net_profit: companyInfo.financial_data?.net_profit || null,
        market_cap: companyInfo.financial_data?.market_cap || null
      },
      
      business_structure: {
        segments: companyInfo.business_structure?.segments || [],
        main_products: companyInfo.business_structure?.main_products || [],
        market_share: companyInfo.business_structure?.market_share || null,
        overseas_revenue_ratio: companyInfo.business_structure?.overseas_revenue_ratio || null
      },
      
      listing_info: {
        status: companyInfo.listing_info?.status || 'unknown',
        stock_code: companyInfo.listing_info?.stock_code || null,
        exchange: companyInfo.listing_info?.exchange || null
      },
      
      industry_classification: {
        jsic_major_category: companyInfo.industry_classification?.jsic_major_category || null,
        jsic_major_name: companyInfo.industry_classification?.jsic_major_name || null,
        jsic_middle_category: companyInfo.industry_classification?.jsic_middle_category || null,
        jsic_middle_name: companyInfo.industry_classification?.jsic_middle_name || null,
        jsic_minor_category: companyInfo.industry_classification?.jsic_minor_category || null,
        jsic_minor_name: companyInfo.industry_classification?.jsic_minor_name || null,
        primary_industry: companyInfo.industry_classification?.primary_industry || null,
        business_type: companyInfo.industry_classification?.business_type || null
      },
      
      organization_info: {
        average_age: companyInfo.organization_info?.average_age || null,
        average_tenure: companyInfo.organization_info?.average_tenure || null,
        female_manager_ratio: companyInfo.organization_info?.female_manager_ratio || null,
        new_graduate_hires: companyInfo.organization_info?.new_graduate_hires || null
      },
      
      esg_info: includeESG ? {
        score: companyInfo.esg_info?.score || null,
        co2_target: companyInfo.esg_info?.co2_target || null,
        social_activities: companyInfo.esg_info?.social_activities || null
      } : null,
      
      competitive_info: includeCompetitors ? {
        main_competitors: companyInfo.competitive_info?.main_competitors || [],
        industry_position: companyInfo.competitive_info?.industry_position || null,
        advantages: companyInfo.competitive_info?.advantages || []
      } : null,
      
      metadata: {
        sources: companyInfo.metadata?.sources || [],
        extraction_date: new Date().toISOString(),
        confidence_score: companyInfo.metadata?.confidence_score || 0.7
      }
    };

    return normalizedInfo;
  } catch (error) {
    logger.error('Failed to extract company info with Perplexity', { 
      error: error.message,
      companyName 
    });
    throw error;
  }
}

const getClientId = (event) => {
  return event.headers?.['x-forwarded-for'] || 
         event.headers?.['x-real-ip'] || 
         'unknown';
};

// メインハンドラー
const handler = async (event, context) => {
  const startTime = Date.now();
  const clientId = getClientId(event);
  
  // CORS処理
  const corsResult = handleCors(event);
  if (event.httpMethod === 'OPTIONS') {
    return corsResult;
  }
  
  // Get CORS headers for all responses
  const corsHeaders = require('../../utils/cors').corsHeaders(event.headers?.origin || event.headers?.Origin);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // API認証
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: authResult.error })
      };
    }

    // レート制限
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
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        })
      };
    }

    const { 
      companyId, 
      companyName, 
      companyWebsite,
      includeFinancials = true,
      includeESG = false,
      includeCompetitors = false
    } = JSON.parse(event.body);

    // 入力検証
    if (!companyId || !companyName || !companyWebsite) {
      logger.warn('Missing required parameters', { companyId, companyName, companyWebsite });
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameters: companyId, companyName, and companyWebsite are required'
        })
      };
    }

    logger.info('Extracting company info', { 
      companyId, 
      companyName,
      options: { includeFinancials, includeESG, includeCompetitors }
    });

    // Perplexity APIを使用して企業情報を抽出
    const companyInfo = await extractCompanyInfoWithPerplexity(
      companyName, 
      companyWebsite,
      { includeFinancials, includeESG, includeCompetitors }
    );

    const processingTime = Date.now() - startTime;

    logger.info('Company info extraction completed', {
      companyId,
      companyName,
      processingTime,
      confidenceScore: companyInfo.metadata.confidence_score
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...getRateLimitHeaders(rateLimitResult)
      },
      body: JSON.stringify({
        success: true,
        data: companyInfo,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString(),
          source: 'perplexity'
        }
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Company info extraction failed', {
      error: error.message,
      stack: error.stack,
      processingTime
    });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: false,
        error: 'Failed to extract company information',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString(),
          source: 'perplexity'
        }
      })
    };
  }
};

exports.handler = handler;