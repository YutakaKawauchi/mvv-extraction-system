const { OpenAI } = require('openai');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');
const { UsageTracker } = require('./usage-tracker');
const { optimizePrompt, parseStructuredResponse } = require('./shared/openai-optimized');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// トラッカー初期化
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
  // Handle CORS preflight
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
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: authResult.error || 'Authentication required' })
      };
    }

    // リクエスト解析
    const requestBody = JSON.parse(event.body);
    const { 
      companyData, 
      analysisParams = {}, 
      options = {} 
    } = requestBody;

    // 入力検証
    if (!companyData || !companyData.id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'companyData is required' })
      };
    }

    logger.info('Starting business idea generation', { 
      companyId: companyData.id, 
      companyName: companyData.name,
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

    // ビジネスアイデア生成は創造的プロセス（temperature 0.7）のため
    // クライアントサイドキャッシュを使用し、サーバーサイドキャッシュは無効
    logger.info('Generating fresh business ideas (no server-side cache)', { 
      companyId: companyData.id, 
      companyName: companyData.name 
    });

    // AI分析実行
    const startTime = Date.now();
    const analysisResult = await generateBusinessIdeas(companyData, analysisParams, options);
    const processingTime = Date.now() - startTime;

    // サーバーサイドキャッシュは使用しない（Netlify Functions stateless + creative content）

    // 利用量記録
    await usageTracker.recordUsage(authResult.user?.username, {
      type: 'api_call',
      companyId: companyData.id,
      cost: analysisResult.metadata.estimatedCost,
      tokensUsed: analysisResult.metadata.tokensUsed
    });

    logger.info('Business idea generation completed', { 
      companyId: companyData.id, 
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
          note: "Server-side caching disabled (stateless functions + creative content)"
        }
      })
    };

  } catch (error) {
    logger.error('Business idea generation error', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};


/**
 * ビジネスアイデア生成（Phase α版）
 */
async function generateBusinessIdeas(companyData, analysisParams, options) {
  const maxIdeas = options.maxIdeas || 1; // Phase α+: デフォルト1案（質重視）
  
  // 段階的分析プロンプト（Phase α+）
  const systemPrompt = `あなたは日本企業の新規事業開発の専門家です。以下の段階的分析に従って、深い洞察に基づく革新的なビジネスアイデアを生成してください。

## 分析手順：
### 1. 業界理解
指定された業界の現状、トレンド、規制環境、競合状況を深く理解する

### 2. 真の課題発見と代替品分析
表面的な課題ではなく、業界関係者が本当に困っている「バーニングニーズ」を特定する
**CRITICAL**: 顧客が現在その課題をどう解決しているか（既存の代替品・回避策）を必ず分析する

### 3. MVV統合設計
企業のMission、Vision、Valuesを深く分析し、それらが新規事業にどう体現されるかを具体化する

### 4. 顧客セグメント特定とアーリーアダプター分析
明確な顧客セグメントを特定し、特に「誰が最初に購入してくれるか」（アーリーアダプター）を具体的に分析する
**CRITICAL**: リスクを取ってでも新しいソリューションを試す意欲のある初期顧客を特定する

### 5. ソリューション設計
企業のMVVと技術的強みを活かし、既存の代替品より圧倒的に優れた解決策を設計する

### 6. 事業化検証
市場性、実現性、収益性を多角的に評価する

## CRITICAL MVV統合要件：
- **worldview**フィールドは必ず企業固有のMission/Vision/Valuesを正確に引用し、プレースホルダー（[企業名]等）は一切使用しない
- 企業の具体的なMVVテキストをそのまま引用し、それがどう新規事業に活かされるかを詳細に説明する
- 一般的な表現や業界テンプレートは避け、必ずこの企業独自のMVVキーワードを含める

## CRITICAL ビジネスモデル要件：
- **支払者（Revenue Payer）を明確化**：誰がお金を払うのかを必ず明記する
- **課題の主語・述語を明確化**：誰の、どんな課題を、どう解決するかを具体的に記述する
- **業界洞察**では、課題を抱える具体的なステークホルダーと、それに対価を払う意思のある主体を特定する

## 重要な指示：
- ${maxIdeas === 1 ? '1つの精巧なアイデア' : `${maxIdeas}つのアイデア`}に集中し、質を最優先する
- 企業のMVVを深く理解し、それが事業アイデアに自然に反映されるようにする
- 業界の専門知識を活用し、表面的でない深い課題を特定する
- 実現可能性評価には具体的な根拠を含める

出力は必ずJSON形式で、以下の構造に従ってください：
{
  "ideas": [
    {
      "title": "アイデアタイトル（MVVキーワードを含む）",
      "description": "200文字以内の詳細説明",
      "worldview": "この企業の具体的なMission「〇〇」、Vision「〇〇」、Values「〇〇」に基づき、どのような価値創造ストーリーを描くか。企業固有のMVVキーワードを正確に引用して説明する。プレースホルダーは使用しない。",
      "industryInsight": "誰の（具体的なステークホルダー）、どんな課題を（明確な問題定義）、どう解決するか（ソリューション）を明記。特に、誰がお金を払うのか（支払者）を必ず特定する。",
      "leanCanvas": {
        "problem": ["具体的な課題1", "具体的な課題2", "根本的な課題3"],
        "existingAlternatives": "顧客が現在この課題をどう解決しているか（既存の代替品・回避策）を具体的に記述",
        "solution": "既存の代替品より圧倒的に優れた革新的なソリューション詳細",
        "keyMetrics": ["測定可能な指標1", "測定可能な指標2"],
        "valueProposition": "既存の代替品に対する明確で差別化された価値提案",
        "unfairAdvantage": "この企業だけが持つ競合優位性",
        "channels": ["効果的なチャネル1", "効果的なチャネル2"],
        "targetCustomers": ["詳細な顧客セグメント1", "詳細な顧客セグメント2"],
        "earlyAdopters": "リスクを取ってでも新しいソリューションを最初に試してくれる具体的な初期顧客層",
        "costStructure": ["主要コスト要素1", "主要コスト要素2"],
        "revenueStreams": ["具体的な収益モデル1（誰が支払うかを明記）", "具体的な収益モデル2（誰が支払うかを明記）"]
      },
      "feasibility": {
        "mvvAlignment": 0.85,
        "mvvAlignmentReason": "MVV適合度の具体的な理由",
        "implementationScore": 0.75,
        "implementationReason": "実装容易性の具体的な理由",
        "marketPotential": 0.65,
        "marketPotentialReason": "市場ポテンシャルの具体的な理由"
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