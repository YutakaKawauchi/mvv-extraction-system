const { OpenAI } = require('openai');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');
const { UsageTracker } = require('./usage-tracker');

/**
 * Background Function for Business Idea Verification (Phase ε.1.3)
 * 15分間の長時間実行が可能な非同期検証プロセス
 * 
 * URL Pattern: /.netlify/functions/verify-business-idea-background
 * Timeout: 15 minutes (900 seconds)
 * Usage: Called by asyncTaskService for long-running verification
 */

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Perplexity クライアント初期化 (市場検証用)
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
});

// トラッカー初期化
const usageTracker = new UsageTracker();

exports.handler = async (event, context) => {
  // Background Functions specific context
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Handle CORS preflight
  const corsResponse = handleCors(event);
  if (corsResponse) {
    return corsResponse;
  }

  // Get CORS headers for all responses
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 認証チェック
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: authResult.error || 'Authentication required' })
      };
    }

    // リクエスト解析
    const requestBody = JSON.parse(event.body);
    const { 
      taskId,
      originalIdea,
      companyData,
      verificationLevel = 'comprehensive', // basic | comprehensive | expert
      progress = {
        percentage: 0,
        currentStep: 'Initialization',
        detailedSteps: []
      }
    } = requestBody;

    // 入力検証
    if (!taskId || !originalIdea || !companyData) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId, originalIdea and companyData are required',
          taskId: taskId || 'missing'
        })
      };
    }

    logger.info('Starting background business idea verification', { 
      taskId,
      companyId: companyData.id, 
      ideaTitle: originalIdea.title,
      verificationLevel,
      user: authResult.user?.username,
      backgroundFunction: true,
      timeout: '15 minutes'
    });

    // Progress tracking helper
    const updateProgress = async (percentage, currentStep, detailedStep = null) => {
      const progressUpdate = {
        percentage,
        currentStep,
        detailedSteps: progress.detailedSteps || []
      };
      
      if (detailedStep) {
        progressUpdate.detailedSteps.push({
          stepName: detailedStep,
          status: 'processing',
          startTime: Date.now()
        });
      }
      
      logger.info('Background verification progress', {
        taskId,
        percentage,
        currentStep,
        detailedStep
      });
      
      // In a real implementation, you would update the task status in a database
      // For now, we log the progress for monitoring
    };

    // 利用量チェック
    await updateProgress(5, '利用量チェック中', '利用制限確認');
    const usageCheck = await usageTracker.checkUsageLimits(authResult.user?.username);
    if (!usageCheck.allowed) {
      return {
        statusCode: 429,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Usage limit exceeded',
          details: usageCheck.details,
          resetTime: usageCheck.resetTime,
          taskId
        })
      };
    }

    await updateProgress(10, 'AI検証プロセス開始');

    // AI検証実行
    const startTime = Date.now();
    const verificationResult = await performBackgroundAIVerification(
      originalIdea, 
      companyData, 
      verificationLevel,
      taskId,
      updateProgress
    );
    const processingTime = Date.now() - startTime;

    await updateProgress(95, '利用量記録中', '使用量の記録');

    // 利用量記録
    await usageTracker.recordUsage(authResult.user?.username, {
      type: 'idea_verification_background',
      companyId: companyData.id,
      cost: verificationResult.metadata.totalCost,
      tokensUsed: verificationResult.metadata.totalTokens,
      backgroundFunction: true
    });

    await updateProgress(100, '検証完了', '結果の最終処理');

    logger.info('Background business idea verification completed', { 
      taskId,
      companyId: companyData.id, 
      processingTime,
      totalTokens: verificationResult.metadata.totalTokens,
      totalCost: verificationResult.metadata.totalCost,
      backgroundFunction: true
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        taskId,
        data: verificationResult,
        metadata: {
          processingTime,
          verifiedAt: Date.now(),
          backgroundFunction: true,
          timeoutUsed: '15 minutes available'
        }
      })
    };

  } catch (error) {
    logger.error('Background business idea verification error', {
      taskId: requestBody?.taskId,
      error: error.message,
      stack: error.stack,
      name: error.name,
      backgroundFunction: true
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Background verification failed',
        message: error.message,
        taskId: requestBody?.taskId,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

/**
 * Background AI検証プロセス実行（進捗更新付き）
 */
async function performBackgroundAIVerification(originalIdea, companyData, verificationLevel, taskId, updateProgress) {
  const results = {
    industryAnalysis: null,
    marketValidation: null,
    businessModelValidation: null,
    competitiveAnalysis: null,
    improvementSuggestions: null,
    overallAssessment: null
  };

  let totalTokens = 0;
  let totalCost = 0;

  try {
    // Step 1: Industry Analysis (15-40%)
    await updateProgress(15, '業界分析開始', '業界エキスパート分析実行');
    
    if (verificationLevel === 'basic') {
      logger.info('Using lightweight basic verification (skipping industry analysis)', { taskId });
      results.industryAnalysis = {
        industryTrends: {
          currentState: "Basic検証では業界分析を簡略化",
          emergingTrends: ["高速検証モード"],
          regulatoryEnvironment: "Comprehensive以上で詳細分析",
          marketSize: "Basic検証では推定値のみ"
        },
        problemValidation: {
          realityCheck: "基本的な妥当性検証済み",
          stakeholderImpact: "一般的な影響を想定",
          urgencyLevel: 5,
          evidence: "Comprehensive以上で詳細な根拠収集"
        },
        lightweightMode: true
      };
      await updateProgress(40, '業界分析完了（簡易モード）');
    } else {
      try {
        await updateProgress(20, '詳細業界分析実行中', 'Perplexity API呼び出し');
        const industryResult = await performIndustryAnalysis(originalIdea, companyData, verificationLevel);
        results.industryAnalysis = industryResult.data;
        totalTokens += industryResult.tokens;
        totalCost += industryResult.cost;
        await updateProgress(40, '業界分析完了');
      } catch (industryError) {
        logger.warn('Industry analysis failed, using fallback', { 
          taskId, 
          error: industryError.message 
        });
        results.industryAnalysis = {
          industryTrends: {
            currentState: "業界分析は一時的に利用できません",
            emergingTrends: ["リアルタイム分析準備中"],
            regulatoryEnvironment: "規制環境の詳細分析は後日実施",
            marketSize: "市場規模推定は準備中"
          },
          problemValidation: {
            realityCheck: "課題の妥当性は基本検証のみ実施",
            stakeholderImpact: "ステークホルダー影響分析は準備中",
            urgencyLevel: 5,
            evidence: "詳細な根拠収集は後日実施"
          },
          fallbackUsed: true
        };
        await updateProgress(40, '業界分析完了（フォールバック）');
      }
    }

    // Step 2-3: 並列処理でビジネスモデル検証と競合分析 (40-70%)
    await updateProgress(45, '並列検証プロセス開始', 'ビジネスモデル・競合分析並列実行');
    
    const parallelPromises = [];
    
    // ビジネスモデル検証（必須）
    parallelPromises.push(
      performBusinessModelValidation(originalIdea, companyData, results.industryAnalysis)
        .then(result => ({ type: 'businessModel', result }))
        .catch(error => ({ type: 'businessModel', error }))
    );
    
    // 競合分析（条件付き）
    if (verificationLevel === 'comprehensive' || verificationLevel === 'expert') {
      parallelPromises.push(
        performCompetitiveAnalysis(originalIdea, companyData, verificationLevel)
          .then(result => ({ type: 'competitive', result }))
          .catch(error => ({ type: 'competitive', error }))
      );
    }

    await updateProgress(50, '並列検証実行中');

    // 並列実行
    const parallelResults = await Promise.allSettled(parallelPromises);
    
    // 結果の処理
    parallelResults.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { type, result, error } = promiseResult.value;
        
        if (error) {
          logger.warn(`${type} analysis failed, using fallback`, { 
            taskId, 
            error: error.message 
          });
          if (type === 'competitive') {
            results.competitiveAnalysis = {
              directCompetitors: [],
              indirectCompetitors: [],
              competitiveAdvantageAnalysis: {
                sustainabilityScore: 5,
                moatStrength: "競合分析は一時的に利用できません"
              },
              fallbackUsed: true
            };
          }
        } else {
          if (type === 'businessModel') {
            results.businessModelValidation = result.data;
            totalTokens += result.tokens;
            totalCost += result.cost;
          } else if (type === 'competitive') {
            results.competitiveAnalysis = result.data;
            totalTokens += result.tokens;
            totalCost += result.cost;
          }
        }
      }
    });

    await updateProgress(70, '並列検証完了');

    // Step 4: 改善提案生成 (70-85%)
    await updateProgress(75, '改善提案生成中', '改善提案・代替案生成');
    const improvementResult = await generateImprovementSuggestions(originalIdea, companyData, results);
    results.improvementSuggestions = improvementResult.data;
    totalTokens += improvementResult.tokens;
    totalCost += improvementResult.cost;
    await updateProgress(85, '改善提案生成完了');

    // Step 5: 総合評価 (85-90%)
    await updateProgress(87, '総合評価生成中', '最終評価・意思決定支援');
    const assessmentResult = await generateOverallAssessment(originalIdea, results);
    results.overallAssessment = assessmentResult.data;
    totalTokens += assessmentResult.tokens;
    totalCost += assessmentResult.cost;
    await updateProgress(90, '総合評価完了');

    return {
      ...results,
      metadata: {
        verificationLevel,
        totalTokens,
        totalCost,
        model: 'gpt-4o-mini + sonar-pro',
        confidence: 0.9,
        version: 'background-beta',
        backgroundFunction: true,
        taskId,
        note: verificationLevel === 'expert' ? 'Expert mode currently equivalent to Comprehensive' : undefined
      }
    };

  } catch (error) {
    logger.error('Background AI verification process error', { 
      taskId, 
      error: error.message,
      stack: error.stack 
    });
    throw new Error(`Failed to complete background AI verification process: ${error.message}`);
  }
}

// Reuse existing verification functions from the main verify-business-idea.js
// These functions are copied to maintain consistency

/**
 * 業界別の特化した分析観点を取得
 */
function getIndustrySpecificPrompts(industry, jsicCategory) {
  const industryPrompts = {
    'ヘルスケア': {
      additionalPoints: [
        '医療規制・薬事法への適合性',
        '患者プライバシー・データセキュリティ要件',
        '医療従事者の負担軽減効果と業務フローへの影響',
        '診療報酬制度との整合性と収益モデル'
      ],
      keyQuestions: [
        '医療機関での導入障壁は何か？',
        '患者アウトカムの改善にどう貢献するか？',
        '既存の医療システムとの統合は可能か？'
      ]
    },
    '製造業': {
      additionalPoints: [
        'サプライチェーンへの影響と最適化効果',
        'IoT・Industry 4.0との親和性',
        '品質管理・トレーサビリティの向上',
        '環境規制・サステナビリティ目標への貢献'
      ],
      keyQuestions: [
        '生産効率はどの程度向上するか？',
        '既存の生産設備との互換性は？',
        'ROIはどの程度で実現可能か？'
      ]
    },
    'IT・ソフトウェア': {
      additionalPoints: [
        'スケーラビリティ・パフォーマンス要件',
        'セキュリティ・コンプライアンス基準',
        'オープンソース戦略とエコシステム',
        'クラウドネイティブ・マルチクラウド対応'
      ],
      keyQuestions: [
        '技術的な差別化要因は何か？',
        '開発者エクスペリエンスはどう向上するか？',
        'ベンダーロックインのリスクは？'
      ]
    },
    '金融': {
      additionalPoints: [
        '金融規制・コンプライアンス要件（FISC等）',
        'リスク管理・内部統制への影響',
        'フィンテック動向との整合性',
        'サイバーセキュリティ・不正検知機能'
      ],
      keyQuestions: [
        '規制当局の承認は得られるか？',
        '既存の金融インフラとの統合性は？',
        '顧客の金融行動にどう影響するか？'
      ]
    },
    '小売・流通': {
      additionalPoints: [
        'オムニチャネル戦略との整合性',
        '在庫管理・物流効率化への貢献',
        '顧客体験（CX）の向上効果',
        'データドリブンな意思決定支援'
      ],
      keyQuestions: [
        '顧客の購買行動にどう影響するか？',
        'オペレーションコストの削減効果は？',
        '競合他社との差別化は可能か？'
      ]
    },
    'エネルギー・環境': {
      additionalPoints: [
        'カーボンニュートラル目標への貢献',
        'エネルギー効率の改善効果',
        '環境規制・ESG要件への対応',
        '再生可能エネルギーとの統合'
      ],
      keyQuestions: [
        'CO2削減効果は定量化可能か？',
        '投資回収期間はどの程度か？',
        '既存インフラとの互換性は？'
      ]
    }
  };

  // JSIC分類に基づく追加の判定
  if (jsicCategory) {
    switch(jsicCategory) {
      case 'E': // 製造業
        return industryPrompts['製造業'] || getDefaultPrompts();
      case 'G': // 情報通信業
        return industryPrompts['IT・ソフトウェア'] || getDefaultPrompts();
      case 'J': // 金融業、保険業
        return industryPrompts['金融'] || getDefaultPrompts();
      case 'I': // 卸売業、小売業
        return industryPrompts['小売・流通'] || getDefaultPrompts();
      default:
        break;
    }
  }

  // 業界名で直接マッチング
  for (const [key, value] of Object.entries(industryPrompts)) {
    if (industry && industry.includes(key)) {
      return value;
    }
  }

  return getDefaultPrompts();
}

/**
 * デフォルトの汎用分析プロンプト
 */
function getDefaultPrompts() {
  return {
    additionalPoints: [
      '業界特有の規制・法令への対応',
      '主要ステークホルダーへの価値提供',
      '既存ビジネスモデルへの影響と統合性',
      '技術的実現可能性と導入コスト'
    ],
    keyQuestions: [
      'この業界の主要な課題をどう解決するか？',
      '競合優位性は持続可能か？',
      '顧客獲得コストと生涯価値のバランスは？'
    ]
  };
}

/**
 * 業界エキスパート分析 (Perplexity API)
 */
async function performIndustryAnalysis(originalIdea, companyData, verificationLevel = 'comprehensive') {
  const industrySpecific = getIndustrySpecificPrompts(
    companyData.industry || companyData.category,
    companyData.jsicMajorCategory
  );

  const prompt = `あなたは${companyData.industry || companyData.category || '企業'}業界の専門家です。以下のビジネスアイデアを業界の視点から専門的に分析してください。

## 企業情報
- 企業名: ${companyData.name}
- 業界: ${companyData.industry || companyData.category || '不明'}
- ウェブサイト: ${companyData.website || 'N/A'}
${companyData.jsicMajorCategory ? `- JSIC分類: ${companyData.jsicMajorCategory}` : ''}

## ビジネスアイデア
- タイトル: ${originalIdea.title}
- 概要: ${originalIdea.description}
- 想定課題: ${originalIdea.leanCanvas?.problem?.join(', ') || 'N/A'}
- ソリューション: ${originalIdea.leanCanvas?.solution || 'N/A'}

## 業界特化の追加分析観点
${industrySpecific.additionalPoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

## 重要な検討事項
${industrySpecific.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## 分析要件
以下の観点から専門的な分析を行い、JSON形式で回答してください：

{
  "industryTrends": {
    "currentState": "業界の現状",
    "emergingTrends": ["トレンド1", "トレンド2"],
    "regulatoryEnvironment": "規制環境の分析",
    "marketSize": "市場規模の推定"
  },
  "problemValidation": {
    "realityCheck": "提示された課題が本当に業界で重要な問題か",
    "stakeholderImpact": "各ステークホルダーへの影響度",
    "urgencyLevel": "解決の緊急度（1-10）",
    "evidence": "課題の存在を裏付ける具体的証拠"
  },
  "solutionAssessment": {
    "innovationLevel": "ソリューションの革新性（1-10）",
    "feasibilityCheck": "技術的・運用的実現可能性",
    "adoptionBarriers": ["導入障壁1", "導入障壁2"],
    "successFactors": ["成功要因1", "成功要因2"]
  },
  "industrySpecificInsights": {
    "keyPlayersReaction": "主要プレイヤーの想定反応",
    "valueChainImpact": "バリューチェーンへの影響",
    "timing": "市場投入タイミングの評価",
    "riskFactors": ["リスク要因1", "リスク要因2"]
  }
}`;

  try {
    const response = await perplexity.chat.completions.create({
      model: "sonar-pro",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return {
      data: parsedData,
      tokens: response.usage.total_tokens,
      cost: calculatePerplexityCost(response.usage)
    };
  } catch (error) {
    logger.error('Industry analysis error', error);
    throw new Error(`Failed to perform industry analysis: ${error.message}`);
  }
}

/**
 * ビジネスモデル検証 (OpenAI GPT-4o-mini)
 */
async function performBusinessModelValidation(originalIdea, companyData, industryAnalysis) {
  const prompt = `あなたはビジネスモデル設計の専門家です。以下の情報を基に、提案されたビジネスモデルを詳細に検証してください。

## 元のアイデア
${JSON.stringify(originalIdea.leanCanvas, null, 2)}

## 業界分析結果
${JSON.stringify(industryAnalysis, null, 2)}

## 検証要件
ビジネスモデルの各要素を詳細に検証し、JSON形式で回答してください：

{
  "revenueModelValidation": {
    "viability": "収益モデルの実行可能性（1-10）",
    "payerAnalysis": "支払者の特定と支払い意欲の分析",
    "pricingSustainability": "価格設定の持続可能性",
    "revenueProjection": "収益予測（1年目、3年目、5年目）",
    "monetizationRisks": ["収益化リスク1", "収益化リスク2"]
  },
  "costStructureAnalysis": {
    "criticalCosts": ["重要コスト1", "重要コスト2"],
    "scalabilityFactor": "スケーラビリティ要因",
    "breakEvenAnalysis": "損益分岐点分析",
    "unitEconomics": "ユニットエコノミクス分析"
  },
  "valuePropositionTest": {
    "uniquenessScore": "独自性スコア（1-10）",
    "customerJobsFit": "顧客ジョブとの適合度",
    "painRelieverEffectiveness": "ペインリリーバーの効果",
    "gainCreatorPotential": "ゲインクリエーターのポテンシャル"
  },
  "marketFitAssessment": {
    "productMarketFitPotential": "プロダクトマーケットフィットの可能性",
    "customerSegmentValidation": "顧客セグメントの妥当性",
    "channelEffectiveness": "チャネル効果性の評価",
    "scalingPotential": "スケーリングポテンシャル"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return {
      data: parsedData,
      tokens: response.usage.total_tokens,
      cost: calculateOpenAICost(response.usage)
    };
  } catch (error) {
    logger.error('Business model validation error', error);
    throw new Error('Failed to validate business model');
  }
}

/**
 * 競合分析 (Perplexity API)
 */
async function performCompetitiveAnalysis(originalIdea, companyData, verificationLevel = 'comprehensive') {
  const industrySpecific = getIndustrySpecificPrompts(
    companyData.industry || companyData.category,
    companyData.jsicMajorCategory
  );

  const prompt = `あなたは${companyData.industry || companyData.category || '企業'}業界の競合分析専門家です。以下のビジネスアイデアについて、最新の市場情報を基に競合分析を行ってください。

## 企業・アイデア情報
- 企業: ${companyData.name}
- 業界: ${companyData.industry || companyData.category || '不明'}
- アイデア: ${originalIdea.title}
- ソリューション: ${originalIdea.leanCanvas?.solution || 'N/A'}
- ターゲット: ${originalIdea.leanCanvas?.targetCustomers?.join(', ') || 'N/A'}

## 業界特有の競合環境
この業界では特に以下の点が重要です：
${industrySpecific.additionalPoints.slice(0, 2).map((point, i) => `- ${point}`).join('\n')}

## 分析要件
最新の市場情報を調査し、JSON形式で競合分析結果を提供してください：

{
  "directCompetitors": [
    {
      "name": "競合企業名",
      "description": "サービス概要",
      "marketPosition": "市場ポジション",
      "strengths": ["強み1", "強み2"],
      "weaknesses": ["弱み1", "弱み2"]
    }
  ],
  "indirectCompetitors": [
    {
      "name": "間接競合名",
      "substituteSolution": "代替ソリューション",
      "threatLevel": "脅威レベル（1-10）"
    }
  ],
  "competitiveAdvantageAnalysis": {
    "proposedAdvantages": ["提案された優位性1", "提案された優位性2"],
    "realityCheck": "優位性の現実性評価",
    "sustainabilityScore": "持続可能性スコア（1-10）",
    "moatStrength": "参入障壁の強さ"
  },
  "marketPositioning": {
    "whitespaceOpportunities": ["ホワイトスペース1", "ホワイトスペース2"],
    "differentiationStrategy": "差別化戦略の提案",
    "competitiveResponse": "競合の想定対応",
    "marketEntryTiming": "市場参入タイミングの評価"
  }
}`;

  try {
    const response = await perplexity.chat.completions.create({
      model: "sonar-pro",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return {
      data: parsedData,
      tokens: response.usage.total_tokens,
      cost: calculatePerplexityCost(response.usage)
    };
  } catch (error) {
    logger.error('Competitive analysis error', error);
    throw new Error('Failed to perform competitive analysis');
  }
}

/**
 * 改善提案生成 (OpenAI GPT-4o-mini)
 */
async function generateImprovementSuggestions(originalIdea, companyData, verificationResults) {
  const prompt = `あなたはビジネス戦略コンサルタントです。以下の検証結果を基に、元のビジネスアイデアの改善提案を行ってください。

## 元のアイデア
${JSON.stringify(originalIdea, null, 2)}

## 検証結果
- 業界分析: ${JSON.stringify(verificationResults.industryAnalysis, null, 2)}
- ビジネスモデル検証: ${JSON.stringify(verificationResults.businessModelValidation, null, 2)}
- 競合分析: ${JSON.stringify(verificationResults.competitiveAnalysis, null, 2)}

## 改善提案要件
検証結果を踏まえて、具体的で実行可能な改善提案をJSON形式で提供してください：

{
  "criticalIssues": [
    {
      "issue": "重要な課題",
      "impact": "影響度（1-10）",
      "urgency": "緊急度（1-10）"
    }
  ],
  "improvementRecommendations": [
    {
      "area": "改善領域",
      "currentState": "現状",
      "recommendedChange": "推奨変更",
      "expectedImpact": "期待される効果",
      "implementationDifficulty": "実装難易度（1-10）",
      "timeline": "実装タイムライン"
    }
  ],
  "alternativeApproaches": [
    {
      "approach": "代替アプローチ",
      "description": "詳細説明",
      "prosAndCons": {
        "pros": ["メリット1", "メリット2"],
        "cons": ["デメリット1", "デメリット2"]
      }
    }
  ],
  "actionPlan": {
    "immediateActions": ["即座に実行すべき行動1", "即座に実行すべき行動2"],
    "shortTermGoals": ["短期目標1", "短期目標2"],
    "longTermVision": "長期ビジョン"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.4,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return {
      data: parsedData,
      tokens: response.usage.total_tokens,
      cost: calculateOpenAICost(response.usage)
    };
  } catch (error) {
    logger.error('Improvement suggestions generation error', error);
    throw new Error('Failed to generate improvement suggestions');
  }
}

/**
 * 総合評価生成 (OpenAI GPT-4o-mini)
 */
async function generateOverallAssessment(originalIdea, verificationResults) {
  const prompt = `あなたは経験豊富なビジネス評価者です。以下の検証結果を統合して、総合的な評価を行ってください。

## 検証結果サマリー
${JSON.stringify(verificationResults, null, 2)}

## 総合評価要件
すべての検証結果を統合し、JSON形式で総合評価を提供してください：

{
  "overallScore": {
    "viabilityScore": "実行可能性スコア（1-100）",
    "innovationScore": "革新性スコア（1-100）",
    "marketPotentialScore": "市場ポテンシャルスコア（1-100）",
    "riskScore": "リスクスコア（1-100、低いほど良い）",
    "totalScore": "総合スコア（1-100）"
  },
  "strengthsAndWeaknesses": {
    "keyStrengths": ["主要な強み1", "主要な強み2", "主要な強み3"],
    "criticalWeaknesses": ["重要な弱み1", "重要な弱み2", "重要な弱み3"],
    "surprisingInsights": ["意外な洞察1", "意外な洞察2"]
  },
  "recommendation": {
    "decision": "GO / NO-GO / CONDITIONAL-GO",
    "reasoning": "判断理由",
    "conditions": ["条件1", "条件2"],
    "nextSteps": ["次のステップ1", "次のステップ2"]
  },
  "confidence": {
    "level": "信頼度（1-10）",
    "uncertaintyFactors": ["不確実要因1", "不確実要因2"],
    "additionalResearchNeeded": ["追加調査が必要な項目1", "追加調査が必要な項目2"]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return {
      data: parsedData,
      tokens: response.usage.total_tokens,
      cost: calculateOpenAICost(response.usage)
    };
  } catch (error) {
    logger.error('Overall assessment generation error', error);
    throw new Error('Failed to generate overall assessment');
  }
}

/**
 * OpenAI API利用コスト計算
 */
function calculateOpenAICost(usage) {
  const inputCostPer1M = 0.15; // $0.15/1M tokens
  const outputCostPer1M = 0.60; // $0.60/1M tokens
  
  const inputCost = (usage.prompt_tokens / 1000000) * inputCostPer1M;
  const outputCost = (usage.completion_tokens / 1000000) * outputCostPer1M;
  
  return inputCost + outputCost;
}

/**
 * Perplexity API利用コスト計算
 */
function calculatePerplexityCost(usage) {
  // Perplexity pricing (参考値)
  const costPer1M = 1.0; // $1.0/1M tokens (概算)
  
  return (usage.total_tokens / 1000000) * costPer1M;
}