/**
 * Company Info API Test Helper
 * 
 * 課金を最小限に抑えるためのテストヘルパー
 * - モックデータの管理
 * - テストモードの制御
 * - APIレスポンスの検証
 */

const fs = require('fs');
const path = require('path');

// テストフィクスチャの読み込み
const FIXTURES_PATH = path.join(__dirname, '../fixtures/company-info-responses.json');
const mockResponses = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));

// テストモードの制御
const TEST_MODE = process.env.TEST_MODE || 'mock'; // 'mock' | 'integration' | 'minimal'

/**
 * モックレスポンスの生成
 * @param {string} companyName - 企業名
 * @param {object} options - オプション
 * @returns {object} モックレスポンス
 */
function generateMockResponse(companyName, options = {}) {
  const {
    includeFinancials = true,
    includeESG = false,
    includeCompetitors = false
  } = options;

  // フィクスチャからベースデータを取得
  let baseData = mockResponses[companyName];
  
  // 企業が見つからない場合は、類似企業のデータを基に生成
  if (!baseData) {
    baseData = {
      ...mockResponses['スタートアップ企業'],
      // 基本情報をランダム化
      founded_year: 2000 + Math.floor(Math.random() * 24),
      employee_count: 10 + Math.floor(Math.random() * 1000),
      headquarters_location: "東京都",
      metadata: {
        sources: [`https://${companyName.toLowerCase()}.com`],
        extraction_date: new Date().toISOString(),
        confidence_score: 0.5 + Math.random() * 0.3
      }
    };
  }

  // オプションに応じてデータを調整
  const response = {
    basic_info: {
      founded_year: baseData.founded_year,
      employee_count: baseData.employee_count,
      headquarters_location: baseData.headquarters_location
    },
    financial_data: includeFinancials ? baseData.financial_data : {
      revenue: null,
      revenue_year: null,
      operating_profit: null,
      net_profit: null,
      market_cap: null
    },
    business_structure: baseData.business_structure,
    listing_info: baseData.listing_info,
    organization_info: baseData.organization_info,
    esg_info: includeESG ? baseData.esg_info : null,
    competitive_info: includeCompetitors ? baseData.competitive_info : null,
    metadata: {
      ...baseData.metadata,
      extraction_date: new Date().toISOString()
    }
  };

  return response;
}

/**
 * Perplexity APIのモック
 * @param {string} companyName - 企業名
 * @param {string} website - ウェブサイト
 * @param {object} options - オプション
 * @returns {Promise<object>} モックレスポンス
 */
async function mockPerplexityAPI(companyName, website, options = {}) {
  // 実際のAPIのレスポンス時間をシミュレート
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

  const response = generateMockResponse(companyName, options);
  
  // 特定の企業名でエラーをシミュレート（制御可能）
  if (companyName === 'エラーテスト企業') {
    throw new Error(`Mock API error for ${companyName}`);
  }

  return response;
}

/**
 * API レスポンスの検証
 * @param {object} response - APIレスポンス
 * @param {string} companyName - 企業名
 * @returns {object} 検証結果
 */
function validateResponse(response, companyName) {
  const errors = [];
  const warnings = [];

  // 必須フィールドの検証
  if (!response.basic_info) {
    errors.push('basic_info is required');
  }

  if (!response.metadata) {
    errors.push('metadata is required');
  }

  if (!response.metadata?.confidence_score) {
    errors.push('metadata.confidence_score is required');
  }

  // 信頼度スコアの範囲チェック
  if (response.metadata?.confidence_score < 0 || response.metadata?.confidence_score > 1) {
    errors.push('confidence_score must be between 0 and 1');
  }

  // 財務情報の妥当性チェック
  if (response.financial_data?.revenue && response.financial_data?.revenue < 0) {
    errors.push('revenue cannot be negative');
  }

  // 従業員数の妥当性チェック
  if (response.basic_info?.employee_count && response.basic_info?.employee_count < 0) {
    errors.push('employee_count cannot be negative');
  }

  // 警告レベルのチェック
  if (response.metadata?.confidence_score < 0.5) {
    warnings.push('Low confidence score');
  }

  if (!response.financial_data?.revenue) {
    warnings.push('No financial data available');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    companyName,
    confidenceScore: response.metadata?.confidence_score
  };
}

/**
 * テストケースの生成
 * @param {string} testType - テストタイプ ('unit' | 'integration' | 'minimal')
 * @returns {Array} テストケース
 */
function generateTestCases(testType = 'unit') {
  const baseTestCases = [
    {
      name: 'トヨタ自動車',
      companyId: 'test-toyota',
      companyName: 'トヨタ自動車',
      companyWebsite: 'https://global.toyota/jp/',
      options: { includeFinancials: true, includeESG: true, includeCompetitors: true },
      expected: {
        hasFinancialData: true,
        hasESGData: true,
        hasCompetitorData: true,
        minConfidenceScore: 0.9
      }
    },
    {
      name: 'サイバーエージェント',
      companyId: 'test-cyberagent',
      companyName: 'サイバーエージェント',
      companyWebsite: 'https://www.cyberagent.co.jp/',
      options: { includeFinancials: true, includeESG: false, includeCompetitors: true },
      expected: {
        hasFinancialData: true,
        hasESGData: false,
        hasCompetitorData: true,
        minConfidenceScore: 0.8
      }
    }
  ];

  if (testType === 'unit') {
    return baseTestCases;
  }

  if (testType === 'integration') {
    return baseTestCases.slice(0, 1); // 1つだけ実行
  }

  if (testType === 'minimal') {
    return [{
      name: 'スタートアップ企業',
      companyId: 'test-startup',
      companyName: 'スタートアップ企業',
      companyWebsite: 'https://example-startup.com/',
      options: { includeFinancials: false, includeESG: false, includeCompetitors: false },
      expected: {
        hasFinancialData: false,
        hasESGData: false,
        hasCompetitorData: false,
        minConfidenceScore: 0.5
      }
    }];
  }

  return baseTestCases;
}

/**
 * テスト結果の保存
 * @param {object} testResult - テスト結果
 * @param {string} testType - テストタイプ
 */
function saveTestResult(testResult, testType) {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `company-info-test-${testType}-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(testResult, null, 2));
  
  console.log(`Test results saved to: ${filepath}`);
}

/**
 * コスト計算（推定）
 * @param {number} apiCalls - API呼び出し回数
 * @returns {object} コスト情報
 */
function calculateCosts(apiCalls) {
  const PERPLEXITY_COST_PER_REQUEST = 0.011; // 約$0.011/リクエスト
  const JPY_RATE = 150; // 1USD = 150JPY（概算）

  const costUSD = apiCalls * PERPLEXITY_COST_PER_REQUEST;
  const costJPY = costUSD * JPY_RATE;

  return {
    apiCalls,
    costUSD: Number(costUSD.toFixed(4)),
    costJPY: Number(costJPY.toFixed(2)),
    costPerRequest: PERPLEXITY_COST_PER_REQUEST
  };
}

module.exports = {
  TEST_MODE,
  generateMockResponse,
  mockPerplexityAPI,
  validateResponse,
  generateTestCases,
  saveTestResult,
  calculateCosts,
  mockResponses
};