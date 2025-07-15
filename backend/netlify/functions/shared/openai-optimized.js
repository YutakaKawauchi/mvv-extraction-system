const { logger } = require('../../../utils/logger');

/**
 * OpenAI トークン最適化ライブラリ
 * 
 * 機能:
 * - プロンプト最適化（トークン効率化）
 * - 構造化レスポンス解析
 * - エラーハンドリング
 * - コスト追跡
 */

/**
 * プロンプト最適化（トークン効率重視）
 */
function optimizePrompt({ company, analysisParams, maxIdeas }) {
  // 企業データの要約（トークン節約）
  const companySummary = createCompanySummary(company);
  
  // 分析パラメータの構造化
  const analysisContext = formatAnalysisParams(analysisParams);
  
  // 効率的なプロンプト構築
  const prompt = `
## 企業情報
${companySummary}

## 分析要求
${analysisContext}
最大${maxIdeas}案のビジネスアイデアを生成してください。

## 出力要件
- 必ずJSON形式
- 各アイデアに簡潔なリーンキャンバス
- MVVとの適合度を数値化
- 実現可能性を重視

企業の強みとMVVを活かした、実現可能性の高い新規事業アイデアを提案してください。`.trim();

  return prompt;
}

/**
 * 企業データの要約作成（トークン効率化）
 */
function createCompanySummary(company) {
  const parts = [];
  
  // 基本情報（必須）
  parts.push(`**企業名**: ${company.name}`);
  
  if (company.industry) {
    parts.push(`**業界**: ${company.industry}`);
  }
  
  // MVV情報（コア要素）
  if (company.mvv) {
    if (company.mvv.mission) {
      parts.push(`**ミッション**: ${company.mvv.mission}`);
    }
    if (company.mvv.vision) {
      parts.push(`**ビジョン**: ${company.mvv.vision}`);
    }
    if (company.mvv.values && company.mvv.values.length > 0) {
      parts.push(`**バリュー**: ${Array.isArray(company.mvv.values) ? company.mvv.values.join('、') : company.mvv.values}`);
    }
  }
  
  // 企業プロファイル（簡潔に）
  if (company.profile) {
    const profileParts = [];
    
    if (company.profile.foundedYear) {
      profileParts.push(`設立${company.profile.foundedYear}年`);
    }
    if (company.profile.employeeCount) {
      profileParts.push(`従業員${formatNumber(company.profile.employeeCount)}人`);
    }
    if (company.profile.location) {
      profileParts.push(`本社${company.profile.location}`);
    }
    
    if (profileParts.length > 0) {
      parts.push(`**概要**: ${profileParts.join('、')}`);
    }
  }
  
  return parts.join('\n');
}

/**
 * 分析パラメータのフォーマット
 */
function formatAnalysisParams(analysisParams) {
  const parts = [];
  
  // フォーカス領域
  if (analysisParams.focusAreas && analysisParams.focusAreas.length > 0) {
    parts.push(`**重点領域**: ${analysisParams.focusAreas.join('、')}`);
  }
  
  // ビジネスモデル
  if (analysisParams.businessModel) {
    parts.push(`**想定モデル**: ${analysisParams.businessModel}`);
  }
  
  // 制約条件
  if (analysisParams.constraints) {
    const constraints = [];
    if (analysisParams.constraints.budget) {
      constraints.push(`予算${analysisParams.constraints.budget}`);
    }
    if (analysisParams.constraints.timeframe) {
      constraints.push(`期間${analysisParams.constraints.timeframe}`);
    }
    if (analysisParams.constraints.resources) {
      constraints.push(`リソース${analysisParams.constraints.resources}`);
    }
    
    if (constraints.length > 0) {
      parts.push(`**制約**: ${constraints.join('、')}`);
    }
  }
  
  // ターゲット市場
  if (analysisParams.targetMarket) {
    parts.push(`**対象市場**: ${analysisParams.targetMarket}`);
  }
  
  // 技術選好
  if (analysisParams.techPreferences) {
    const techParts = [];
    if (analysisParams.techPreferences.preferred && analysisParams.techPreferences.preferred.length > 0) {
      techParts.push(`活用したい技術: ${analysisParams.techPreferences.preferred.join('、')}`);
    }
    if (analysisParams.techPreferences.avoided && analysisParams.techPreferences.avoided.length > 0) {
      techParts.push(`避けたい技術: ${analysisParams.techPreferences.avoided.join('、')}`);
    }
    if (techParts.length > 0) {
      parts.push(`**技術選好**: ${techParts.join('　/ ')}`);
    }
  }
  
  // リスク許容度
  if (analysisParams.riskTolerance) {
    const riskLabels = {
      'conservative': '保守的（確実性を重視、リスクを最小限に）',
      'moderate': '中程度（バランスの取れたリスク・リターン）',
      'aggressive': '積極的（高リスク・高リターンを志向）'
    };
    const riskLabel = riskLabels[analysisParams.riskTolerance] || analysisParams.riskTolerance;
    parts.push(`**リスク許容度**: ${riskLabel}`);
  }
  
  // 収益期待
  if (analysisParams.revenueExpectation) {
    const revenueLabels = {
      'short-term': '短期収益重視（1-2年での収益化を目指す）',
      'medium-term': '中期収益重視（3-5年での本格収益化を目指す）',
      'long-term': '長期投資重視（5年以上の長期的なリターンを重視）'
    };
    const revenueLabel = revenueLabels[analysisParams.revenueExpectation] || analysisParams.revenueExpectation;
    parts.push(`**収益期待**: ${revenueLabel}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : '**分析条件**: 一般的なビジネス機会を探索';
}

/**
 * 構造化レスポンス解析
 */
function parseStructuredResponse(response) {
  try {
    if (!response || !response.choices || !response.choices[0]) {
      throw new Error('Invalid OpenAI response structure');
    }
    
    const content = response.choices[0].message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }
    
    // JSON解析
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (jsonError) {
      // JSON解析失敗時のフォールバック処理
      logger.warn('JSON parsing failed, attempting cleanup', { content: content.substring(0, 200) });
      
      // 不正な文字を除去してリトライ
      const cleanedContent = cleanJsonString(content);
      parsedData = JSON.parse(cleanedContent);
    }
    
    // データ構造の検証
    const validatedData = validateBusinessIdeasStructure(parsedData);
    
    return validatedData;
    
  } catch (error) {
    logger.error('Response parsing failed', { 
      error: error.message,
      responseStructure: !!response?.choices?.[0]?.message?.content 
    });
    
    // フォールバック: 最小限の構造を返す
    return {
      ideas: [],
      parseError: error.message,
      fallbackUsed: true
    };
  }
}

/**
 * JSON文字列のクリーンアップ
 */
function cleanJsonString(content) {
  return content
    .replace(/```json\n?/g, '') // コードブロック除去
    .replace(/```\n?/g, '')     // コードブロック終了除去
    .replace(/^\s*/, '')        // 先頭空白除去
    .replace(/\s*$/, '')        // 末尾空白除去
    .replace(/,(\s*[}\]])/g, '$1'); // trailing comma除去
}

/**
 * ビジネスアイデア構造の検証
 */
function validateBusinessIdeasStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Response is not a valid object');
  }
  
  // ideas配列の検証
  if (!Array.isArray(data.ideas)) {
    throw new Error('Response must contain an "ideas" array');
  }
  
  // 各アイデアの検証と補完
  const validatedIdeas = data.ideas.map((idea, index) => {
    const validatedIdea = {
      title: idea.title || `ビジネスアイデア ${index + 1}`,
      description: idea.description || '詳細な説明が必要です',
      worldview: idea.worldview || 'MVVに基づく世界観の詳細化が必要です',
      industryInsight: idea.industryInsight || '業界課題の深い分析が必要です',
      leanCanvas: validateLeanCanvas(idea.leanCanvas || {}),
      feasibility: validateFeasibility(idea.feasibility || {})
    };
    
    return validatedIdea;
  });
  
  return {
    ideas: validatedIdeas,
    metadata: {
      originalIdeasCount: data.ideas.length,
      validatedAt: new Date().toISOString(),
      hasParseError: false
    }
  };
}

/**
 * リーンキャンバス構造の検証
 */
function validateLeanCanvas(leanCanvas) {
  return {
    problem: Array.isArray(leanCanvas.problem) ? leanCanvas.problem : 
             leanCanvas.problem ? [leanCanvas.problem] : ['課題の特定が必要'],
    existingAlternatives: leanCanvas.existingAlternatives || '既存の代替品・回避策の分析が必要',
    solution: leanCanvas.solution || 'ソリューションの詳細化が必要',
    keyMetrics: Array.isArray(leanCanvas.keyMetrics) ? leanCanvas.keyMetrics :
                leanCanvas.keyMetrics ? [leanCanvas.keyMetrics] : ['主要指標の設定が必要'],
    valueProposition: leanCanvas.valueProposition || '価値提案の明確化が必要',
    unfairAdvantage: leanCanvas.unfairAdvantage || '競合優位性の検討が必要',
    channels: Array.isArray(leanCanvas.channels) ? leanCanvas.channels :
              leanCanvas.channels ? [leanCanvas.channels] : ['チャネルの検討が必要'],
    targetCustomers: Array.isArray(leanCanvas.targetCustomers) ? leanCanvas.targetCustomers :
                     leanCanvas.targetCustomers ? [leanCanvas.targetCustomers] : ['ターゲット顧客の特定が必要'],
    earlyAdopters: leanCanvas.earlyAdopters || 'アーリーアダプター（初期顧客層）の特定が必要',
    costStructure: Array.isArray(leanCanvas.costStructure) ? leanCanvas.costStructure :
                   leanCanvas.costStructure ? [leanCanvas.costStructure] : ['コスト構造の分析が必要'],
    revenueStreams: Array.isArray(leanCanvas.revenueStreams) ? leanCanvas.revenueStreams :
                    leanCanvas.revenueStreams ? [leanCanvas.revenueStreams] : ['収益モデルの検討が必要']
  };
}

/**
 * 実現可能性スコアの検証
 */
function validateFeasibility(feasibility) {
  return {
    mvvAlignment: validateScore(feasibility.mvvAlignment, 0.5),
    mvvAlignmentReason: feasibility.mvvAlignmentReason || 'MVV適合度の詳細分析が必要',
    implementationScore: validateScore(feasibility.implementationScore, 0.5),
    implementationReason: feasibility.implementationReason || '実装容易性の詳細分析が必要',
    marketPotential: validateScore(feasibility.marketPotential, 0.5),
    marketPotentialReason: feasibility.marketPotentialReason || '市場ポテンシャルの詳細分析が必要'
  };
}

/**
 * スコア値の検証（0-1の範囲）
 */
function validateScore(score, defaultValue = 0.5) {
  const numScore = parseFloat(score);
  if (isNaN(numScore) || numScore < 0 || numScore > 1) {
    return defaultValue;
  }
  return numScore;
}

/**
 * 数値フォーマット（千単位区切り）
 */
function formatNumber(num) {
  if (typeof num !== 'number') return num;
  return num.toLocaleString('ja-JP');
}

/**
 * トークン使用量の推定
 */
function estimateTokens(text) {
  // 日本語を考慮した概算（1文字≈1.5トークン）
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
  const otherChars = text.length - japaneseChars;
  
  return Math.ceil(japaneseChars * 1.5 + otherChars * 0.75);
}

/**
 * プロンプト統計の取得
 */
function getPromptStats(prompt) {
  return {
    length: prompt.length,
    estimatedTokens: estimateTokens(prompt),
    lines: prompt.split('\n').length,
    optimization: 'token-efficient'
  };
}

module.exports = {
  optimizePrompt,
  parseStructuredResponse,
  estimateTokens,
  getPromptStats
};