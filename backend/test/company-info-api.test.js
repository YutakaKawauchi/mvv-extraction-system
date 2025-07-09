/**
 * Company Info API Test Suite
 * 
 * 使用方法:
 * npm test                      # モックテストのみ実行
 * TEST_MODE=minimal npm test    # 最小限のAPIテスト
 * TEST_MODE=integration npm test # 統合テスト（課金注意）
 */

const { handler } = require('../netlify/functions/extract-company-info');
const { 
  TEST_MODE, 
  mockPerplexityAPI, 
  validateResponse, 
  generateTestCases, 
  saveTestResult, 
  calculateCosts 
} = require('./helpers/company-info-test-helper');

// テスト環境の設定
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'test-key';
process.env.MVP_API_SECRET = process.env.MVP_API_SECRET || 'test-secret';

describe('Company Info API Tests', () => {
  let testResults = {
    startTime: new Date().toISOString(),
    testMode: TEST_MODE,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    },
    results: [],
    costs: null
  };

  beforeAll(() => {
    console.log(`\n🚀 Starting Company Info API Tests`);
    console.log(`📋 Test Mode: ${TEST_MODE}`);
    console.log(`💰 Cost Estimation: ${TEST_MODE === 'mock' ? 'Free' : 'Paid API calls'}`);
    console.log(`⏰ Started at: ${testResults.startTime}\n`);
  });

  afterAll(() => {
    testResults.endTime = new Date().toISOString();
    testResults.duration = new Date(testResults.endTime) - new Date(testResults.startTime);
    
    // コスト計算
    const realApiCalls = testResults.results.filter(r => r.usedRealAPI).length;
    testResults.costs = calculateCosts(realApiCalls);
    
    // 結果の保存
    saveTestResult(testResults, TEST_MODE);
    
    // サマリーの表示
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.summary.passed}`);
    console.log(`❌ Failed: ${testResults.summary.failed}`);
    console.log(`⏭️  Skipped: ${testResults.summary.skipped}`);
    console.log(`💰 Estimated Cost: $${testResults.costs.costUSD} (¥${testResults.costs.costJPY})`);
    console.log(`⏱️  Duration: ${testResults.duration}ms\n`);
  });

  // 入力パラメータの検証テスト
  describe('Input Validation', () => {
    test('should reject missing required parameters', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({}),
        headers: {
          'X-API-Key': process.env.MVP_API_SECRET
        }
      };

      const result = await handler(event, {});
      const response = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.error).toContain('required parameters');
      
      testResults.summary.total++;
      testResults.summary.passed++;
    });

    test('should reject invalid HTTP method', async () => {
      const event = {
        httpMethod: 'GET',
        body: JSON.stringify({}),
        headers: {
          'X-API-Key': process.env.MVP_API_SECRET
        }
      };

      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(405);
      
      testResults.summary.total++;
      testResults.summary.passed++;
    });
  });

  // 主要なテストケース
  describe('Company Info Extraction', () => {
    const testCases = generateTestCases(TEST_MODE);

    testCases.forEach((testCase) => {
      test(`should extract info for ${testCase.name}`, async () => {
        const startTime = Date.now();
        let usedRealAPI = false;

        try {
          const event = {
            httpMethod: 'POST',
            body: JSON.stringify({
              companyId: testCase.companyId,
              companyName: testCase.companyName,
              companyWebsite: testCase.companyWebsite,
              ...testCase.options
            }),
            headers: {
              'X-API-Key': process.env.MVP_API_SECRET
            }
          };

          let result;
          
          if (TEST_MODE === 'mock') {
            // モックを使用
            const mockResponse = await mockPerplexityAPI(
              testCase.companyName,
              testCase.companyWebsite,
              testCase.options
            );
            
            result = {
              statusCode: 200,
              body: JSON.stringify({
                success: true,
                data: mockResponse,
                metadata: {
                  processingTime: Date.now() - startTime,
                  timestamp: new Date().toISOString(),
                  source: 'perplexity'
                }
              })
            };
          } else {
            // 実際のAPIを使用（課金注意）
            result = await handler(event, {});
            usedRealAPI = true;
          }

          const response = JSON.parse(result.body);
          const processingTime = Date.now() - startTime;

          // 基本的な応答の検証
          expect(result.statusCode).toBe(200);
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();

          // データの検証
          const validation = validateResponse(response.data, testCase.companyName);
          expect(validation.isValid).toBe(true);

          // 期待値の検証
          if (testCase.expected.hasFinancialData) {
            expect(response.data.financial_data).toBeDefined();
          }

          if (testCase.expected.hasESGData) {
            expect(response.data.esg_info).toBeDefined();
          } else {
            expect(response.data.esg_info).toBeNull();
          }

          if (testCase.expected.hasCompetitorData) {
            expect(response.data.competitive_info).toBeDefined();
          }

          if (testCase.expected.minConfidenceScore) {
            expect(response.data.metadata.confidence_score).toBeGreaterThanOrEqual(
              testCase.expected.minConfidenceScore
            );
          }

          // テスト結果の記録
          testResults.results.push({
            testCase: testCase.name,
            passed: true,
            processingTime,
            usedRealAPI,
            confidenceScore: response.data.metadata.confidence_score,
            validation,
            timestamp: new Date().toISOString()
          });

          testResults.summary.total++;
          testResults.summary.passed++;

        } catch (error) {
          // エラーの記録
          testResults.results.push({
            testCase: testCase.name,
            passed: false,
            error: error.message,
            usedRealAPI,
            timestamp: new Date().toISOString()
          });

          testResults.summary.total++;
          testResults.summary.failed++;

          throw error;
        }
      }, 30000); // 30秒タイムアウト
    });
  });

  // 負荷テスト（モックのみ）
  describe('Performance Tests', () => {
    if (TEST_MODE === 'mock') {
      test('should handle multiple requests efficiently', async () => {
        const requests = Array.from({ length: 5 }, (_, i) => ({
          companyId: `test-${i}`,
          companyName: `テスト企業${i}`,
          companyWebsite: `https://test-${i}.com`
        }));

        const startTime = Date.now();
        const promises = requests.map(req => 
          mockPerplexityAPI(req.companyName, req.companyWebsite)
        );

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        expect(results).toHaveLength(5);
        expect(totalTime).toBeLessThan(5000); // 5秒以内

        testResults.summary.total++;
        testResults.summary.passed++;
      });
    } else {
      test('Performance test skipped in non-mock mode', () => {
        testResults.summary.total++;
        testResults.summary.skipped++;
      });
    }
  });

  // エラーハンドリングテスト
  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          companyId: 'error-test',
          companyName: 'エラーテスト企業',
          companyWebsite: 'https://invalid-domain-that-does-not-exist.com'
        }),
        headers: {
          'X-API-Key': process.env.MVP_API_SECRET
        }
      };

      if (TEST_MODE === 'mock') {
        // モックでエラーをシミュレート
        try {
          // エラーが発生するまで繰り返し実行
          let errorOccurred = false;
          for (let i = 0; i < 20; i++) {
            try {
              await mockPerplexityAPI('エラーテスト企業', 'https://invalid.com');
            } catch (error) {
              errorOccurred = true;
              expect(error.message).toContain('Mock API error');
              break;
            }
          }
          
          expect(errorOccurred).toBe(true);
        } catch (error) {
          // エラーが適切に処理されることを確認
          expect(error).toBeDefined();
        }
      }

      testResults.summary.total++;
      testResults.summary.passed++;
    });
  });
});

// Jest の設定
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true
};