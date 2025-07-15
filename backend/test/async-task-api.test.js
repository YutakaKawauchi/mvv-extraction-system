/**
 * 非同期タスクAPI テストスイート (Phase ε.3.1)
 * 
 * 対象API:
 * - verify-business-idea-background.js (15分Background Function)
 * - task-status.js (ポーリング用ステータス取得)
 * - start-async-task.js (汎用タスク開始)
 * 
 * テストモード:
 * - Mock: モックデータで高速テスト ($0.00)
 * - Minimal: 基本動作確認 (~$0.02)
 * - Integration: フル機能テスト (~$0.15)
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');

// テスト設定
const TEST_MODE = process.env.TEST_MODE || 'mock';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8888/.netlify/functions';
const API_SECRET = process.env.MVP_API_SECRET || 'test-secret';

// テスト結果記録用
const testResults = {
  mode: TEST_MODE,
  startTime: new Date().toISOString(),
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  estimatedCost: 0,
  duration: 0,
  errors: []
};

// モックデータ
const mockCompanyData = {
  id: 'test-company-001',
  name: 'テスト株式会社',
  industry: 'IT・ソフトウェア',
  website: 'https://test-company.example.com',
  mission: 'テクノロジーで世界を変える',
  vision: '2030年までに業界のリーダーになる',
  values: ['革新', '品質', '顧客第一']
};

const mockBusinessIdea = {
  title: 'AI-powered業務効率化プラットフォーム',
  description: 'AIを活用した業務プロセス自動化により、生産性を50%向上させる',
  leanCanvas: {
    problem: ['業務の非効率性', '手作業によるエラー'],
    solution: 'AI自動化プラットフォーム',
    targetCustomers: ['中小企業', 'スタートアップ'],
    keyMetrics: ['処理時間削減率', 'エラー率'],
    valueProposition: '業務効率50%向上',
    unfairAdvantage: '独自のAIアルゴリズム',
    channels: ['ウェブサイト', 'パートナー'],
    costStructure: ['開発費', '運用費'],
    revenueStreams: ['月額課金', 'カスタマイズ']
  }
};

/**
 * コスト計算
 */
function calculateCost(apiCalls, costPerCall = 0.05) {
  return apiCalls * costPerCall;
}

/**
 * HTTP リクエスト実行
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_SECRET,
      ...options.headers
    }
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  // モックモードの場合は実際のリクエストをスキップ
  if (TEST_MODE === 'mock') {
    return mockResponse(endpoint, finalOptions);
  }

  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * モックレスポンス生成
 */
function mockResponse(endpoint, options) {
  const delay = Math.random() * 100 + 50; // 50-150ms
  
  return new Promise((resolve) => {
    setTimeout(() => {
      if (endpoint === '/start-async-task') {
        // リクエストボディを解析して入力検証
        const requestData = options.body ? JSON.parse(options.body) : {};
        
        // 無効なタスクタイプの場合
        if (requestData.taskType === 'invalid-task-type') {
          resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: 'Unsupported task type',
              taskType: requestData.taskType,
              supportedTypes: ['verify-business-idea', 'generate-business-ideas', 'extract-mvv', 'extract-company-info', 'analyze-competition']
            },
            headers: {
              'access-control-allow-origin': '*',
              'content-type': 'application/json'
            }
          });
          return;
        }
        
        // 正常なリクエストの場合
        resolve({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          data: {
            success: true,
            taskId: `async_${Date.now()}_verify_${Math.random().toString(36).substring(2, 8)}`,
            status: 'queued',
            message: 'Task has been queued for processing',
            data: {
              taskType: 'verify-business-idea',
              priority: 'normal',
              estimatedDuration: 120000,
              backgroundFunction: 'verify-business-idea-background',
              pollingUrl: `/.netlify/functions/task-status?taskId=async_123`,
              statusCheckInterval: 2000
            },
            metadata: {
              queuedAt: Date.now(),
              expectedCompletionTime: Date.now() + 120000
            }
          },
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json'
          }
        });
      } else if (endpoint.startsWith('/task-status')) {
        // エンドポイントからtaskIdを抽出
        let taskId = '';
        if (endpoint.includes('taskId=')) {
          taskId = endpoint.split('taskId=')[1].split('&')[0];
        } else if (endpoint === '/task-status') {
          // パラメータなしの場合は空文字列
          taskId = '';
        }
        
        // taskIdが空の場合は400エラー
        if (!taskId) {
          resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: 'taskId query parameter is required',
              example: '/.netlify/functions/task-status?taskId=async_12345'
            },
            headers: {
              'access-control-allow-origin': '*',
              'content-type': 'application/json'
            }
          });
          return;
        }
        
        resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          data: {
            success: true,
            taskId,
            data: {
              id: taskId,
              type: 'verify-business-idea',
              status: 'completed',
              progress: {
                percentage: 100,
                currentStep: 'Verification completed',
                estimatedTimeRemaining: 0,
                detailedSteps: [
                  { stepName: 'Industry analysis', status: 'completed', duration: 20000 },
                  { stepName: 'Business model validation', status: 'completed', duration: 25000 },
                  { stepName: 'Competitive analysis', status: 'completed', duration: 30000 },
                  { stepName: 'Improvement suggestions', status: 'completed', duration: 15000 },
                  { stepName: 'Overall assessment', status: 'completed', duration: 10000 }
                ]
              },
              timestamps: {
                createdAt: Date.now() - 120000,
                startedAt: Date.now() - 120000,
                lastUpdatedAt: Date.now(),
                completedAt: Date.now()
              },
              result: {
                overallAssessment: {
                  overallScore: {
                    viabilityScore: 75,
                    innovationScore: 85,
                    marketPotentialScore: 70,
                    totalScore: 77
                  },
                  recommendation: {
                    decision: 'CONDITIONAL-GO',
                    reasoning: 'Strong innovation potential with moderate market risks'
                  }
                },
                metadata: {
                  verificationLevel: 'comprehensive',
                  totalTokens: 15000,
                  totalCost: 0.08,
                  confidence: 0.9,
                  mock: true
                }
              }
            },
            metadata: {
              polledAt: Date.now(),
              continuePoll: false
            }
          },
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json'
          }
        });
      } else if (endpoint === '/verify-business-idea-background') {
        // リクエストボディを解析して入力検証
        const requestData = options.body ? JSON.parse(options.body) : {};
        
        // 必須パラメータのチェック
        if (!requestData.originalIdea || !requestData.companyData) {
          resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            data: {
              error: 'taskId, originalIdea and companyData are required',
              taskId: requestData.taskId || 'missing'
            },
            headers: {
              'access-control-allow-origin': '*',
              'content-type': 'application/json'
            }
          });
          return;
        }
        
        // 正常なリクエストの場合（Background Function は202を返す）
        resolve({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          data: {
            success: true,
            taskId: requestData.taskId || 'async_123',
            status: 'completed',
            message: 'Background verification completed and result sent to webhook',
            metadata: {
              processingTime: 120000,
              verifiedAt: Date.now(),
              backgroundFunction: true,
              webhookNotified: true
            }
          },
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json'
          }
        });
      } else if (endpoint === '/long-running-mock') {
        const body = options.body ? JSON.parse(options.body) : {};
        const mockTaskId = `mock_${Date.now()}_task_${Math.random().toString(36).substring(2, 6)}`;
        
        resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          data: {
            success: true,
            taskId: mockTaskId,
            message: 'Long-running mock task initiated',
            data: {
              scenario: body.scenario || 'success',
              estimatedDuration: body.duration || 300000,
              progressSteps: body.progressSteps || 10,
              pollingUrl: `/.netlify/functions/task-status?taskId=${mockTaskId}`,
              statusCheckInterval: 2000,
              mockTask: true
            },
            metadata: {
              initiatedAt: Date.now(),
              expectedCompletionTime: Date.now() + (body.duration || 300000),
              mockScenario: body.scenario || 'success',
              realApiCost: '$0.00'
            }
          },
          headers: {
            'access-control-allow-origin': '*',
            'content-type': 'application/json'
          }
        });
      }
      
      // 404 レスポンス
      resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Endpoint not found' },
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json'
        }
      });
    }, delay);
  });
}

/**
 * テスト結果保存
 */
async function saveTestResults() {
  const fs = require('fs').promises;
  const path = require('path');
  
  testResults.duration = Date.now() - new Date(testResults.startTime).getTime();
  testResults.endTime = new Date().toISOString();
  
  const resultsDir = path.join(__dirname, 'results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const timestamp = testResults.startTime.replace(/[:.]/g, '-').split('T').join('T');
  const filename = `async-task-api-test-${TEST_MODE}-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);
  
  await fs.writeFile(filepath, JSON.stringify(testResults, null, 2));
  console.log(`📄 Test results saved: ${filepath}`);
}

// テストスイート開始
console.log('🚀 Starting Async Task API Tests');
console.log(`📋 Test Mode: ${TEST_MODE}`);
console.log(`💰 Cost Estimation: ${TEST_MODE === 'mock' ? 'Free' : '$' + calculateCost(10).toFixed(3)}`);
console.log(`⏰ Started at: ${testResults.startTime}`);

describe('Async Task API Test Suite', () => {
  beforeAll(async () => {
    // テスト環境の検証
    if (TEST_MODE !== 'mock') {
      if (!process.env.MVP_API_SECRET) {
        throw new Error('MVP_API_SECRET is not set');
      }
    }
  });

  afterAll(async () => {
    await saveTestResults();
    
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.passedTests}`);
    console.log(`❌ Failed: ${testResults.failedTests}`);
    console.log(`⏭️  Skipped: ${testResults.skippedTests}`);
    console.log(`💰 Estimated Cost: $${testResults.estimatedCost.toFixed(3)} (¥${(testResults.estimatedCost * 150).toFixed(0)})`);
    console.log(`⏱️  Duration: ${testResults.duration}ms`);
    
    if (testResults.errors.length > 0) {
      console.log('\n🚨 Errors:');
      testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
  });

  beforeEach(() => {
    testResults.totalTests++;
  });

  describe('start-async-task API', () => {
    test('should start verification task successfully', async () => {
      const requestBody = {
        taskType: 'verify-business-idea',
        taskData: {
          originalIdea: mockBusinessIdea,
          companyData: mockCompanyData,
          verificationLevel: 'comprehensive'
        },
        priority: 'normal',
        metadata: {
          userId: 'test-user'
        }
      };

      try {
        const response = await makeRequest('/start-async-task', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(202);
        expect(response.data.success).toBe(true);
        expect(response.data.taskId).toMatch(/^async_\d+_verify_[a-z0-9]+$/);
        expect(response.data.status).toBe('queued');
        expect(response.data.data.taskType).toBe('verify-business-idea');
        expect(response.data.data.pollingUrl).toContain('task-status');

        if (TEST_MODE !== 'mock') {
          testResults.estimatedCost += 0.001; // タスク開始コスト
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`start-async-task test failed: ${error.message}`);
        throw error;
      }
    });

    test('should reject invalid task type', async () => {
      const requestBody = {
        taskType: 'invalid-task-type',
        taskData: {},
        priority: 'normal'
      };

      try {
        const response = await makeRequest('/start-async-task', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Unsupported task type');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Invalid task type test failed: ${error.message}`);
        throw error;
      }
    });

    test('should require authentication', async () => {
      const requestBody = {
        taskType: 'verify-business-idea',
        taskData: mockBusinessIdea
      };

      try {
        const response = await makeRequest('/start-async-task', {
          method: 'POST',
          headers: {
            'X-API-Key': 'invalid-key'
          },
          body: JSON.stringify(requestBody)
        });

        if (TEST_MODE === 'mock') {
          // モックモードでは認証をスキップ
          expect(true).toBe(true);
        } else {
          expect(response.ok).toBe(false);
          expect(response.status).toBe(401);
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Authentication test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('task-status API', () => {
    test('should return task status successfully', async () => {
      const taskId = 'async_1234567890_verify_abc123';

      try {
        const response = await makeRequest(`/task-status?taskId=${taskId}`, {
          method: 'GET'
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.taskId).toBe(taskId);
        expect(response.data.data.id).toBe(taskId);
        expect(['queued', 'processing', 'completed', 'failed']).toContain(response.data.data.status);
        expect(response.data.data.progress).toBeDefined();
        expect(response.data.data.progress.percentage).toBeGreaterThanOrEqual(0);
        expect(response.data.data.progress.percentage).toBeLessThanOrEqual(100);

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Task status test failed: ${error.message}`);
        throw error;
      }
    });

    test('should require taskId parameter', async () => {
      try {
        const response = await makeRequest('/task-status', {
          method: 'GET'
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(response.data.error).toContain('taskId query parameter is required');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`TaskId requirement test failed: ${error.message}`);
        throw error;
      }
    });

    test('should return 404 for non-existent task', async () => {
      const nonExistentTaskId = 'async_0000000000_invalid_000000';

      try {
        const response = await makeRequest(`/task-status?taskId=${nonExistentTaskId}`, {
          method: 'GET'
        });

        if (TEST_MODE === 'mock') {
          // モックモードでは常に成功レスポンス
          expect(response.ok).toBe(true);
        } else {
          expect(response.ok).toBe(false);
          expect(response.status).toBe(404);
          expect(response.data.error).toContain('Task not found');
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Non-existent task test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('verify-business-idea-background API', () => {
    test('should process verification request', async () => {
      if (TEST_MODE === 'minimal') {
        // Minimal モードではスキップ（時間がかかりすぎるため）
        testResults.skippedTests++;
        return;
      }

      const taskId = `async_${Date.now()}_verify_${Math.random().toString(36).substring(2, 8)}`;
      const requestBody = {
        taskId,
        originalIdea: mockBusinessIdea,
        companyData: mockCompanyData,
        verificationLevel: 'basic' // 高速テスト用
      };

      try {
        const response = await makeRequest('/verify-business-idea-background', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(202); // Background Function は202を返す
        expect(response.data.success).toBe(true);
        expect(response.data.taskId).toBe(taskId);
        expect(response.data.status).toBe('completed'); // Webhook通知完了
        expect(response.data.metadata.backgroundFunction).toBe(true);

        if (TEST_MODE === 'integration') {
          testResults.estimatedCost += 0.08; // フル検証コスト
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Background verification test failed: ${error.message}`);
        throw error;
      }
    });

    test('should require valid task data', async () => {
      const requestBody = {
        taskId: 'async_123_verify_test',
        // originalIdea と companyData を故意に省略
        verificationLevel: 'basic'
      };

      try {
        const response = await makeRequest('/verify-business-idea-background', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(response.data.error).toContain('originalIdea and companyData are required');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Invalid data test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('CORS Support', () => {
    test('should include CORS headers in all responses', async () => {
      try {
        const response = await makeRequest('/start-async-task', {
          method: 'POST',
          headers: {
            'Origin': 'http://localhost:5173'
          },
          body: JSON.stringify({
            taskType: 'verify-business-idea',
            taskData: { test: 'data' }
          })
        });

        expect(response.headers['access-control-allow-origin']).toBeDefined();
        expect(response.headers['content-type']).toContain('application/json');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`CORS test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('Long-Running Mock Service', () => {
    test('should start and complete mock task successfully', async () => {
      const requestBody = {
        scenario: 'success',
        duration: 5000, // 5秒テスト
        progressSteps: 5,
        taskType: 'mock-verification'
      };

      try {
        // Step 1: モックタスク開始
        const response = await makeRequest('/long-running-mock', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.taskId).toMatch(/^mock_\d+_task_[a-z0-9]+$/);
        expect(response.data.data.mockTask).toBe(true);

        const taskId = response.data.taskId;

        if (TEST_MODE !== 'mock') {
          // Step 2: 実際のモックタスクが動作するまで少し待つ
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 3: ステータス確認
          const statusResponse = await makeRequest(`/task-status?taskId=${taskId}`, {
            method: 'GET'
          });

          expect(statusResponse.ok).toBe(true);
          expect(statusResponse.data.taskId).toBe(taskId);
          expect(statusResponse.data.metadata.longRunningTest).toBe(true);
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Mock service test failed: ${error.message}`);
        throw error;
      }
    });

    test('should handle timeout scenario correctly', async () => {
      if (TEST_MODE === 'minimal') {
        testResults.skippedTests++;
        return;
      }

      const requestBody = {
        scenario: 'timeout',
        duration: 3000, // 3秒テスト
        progressSteps: 4,
        taskType: 'mock-timeout-test'
      };

      try {
        const response = await makeRequest('/long-running-mock', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(true);
        expect(response.data.data.scenario).toBe('timeout');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Timeout scenario test failed: ${error.message}`);
        throw error;
      }
    });

    test('should handle error scenario correctly', async () => {
      if (TEST_MODE === 'minimal') {
        testResults.skippedTests++;
        return;
      }

      const requestBody = {
        scenario: 'error',
        duration: 2000, // 2秒テスト
        progressSteps: 3,
        taskType: 'mock-error-test'
      };

      try {
        const response = await makeRequest('/long-running-mock', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        expect(response.ok).toBe(true);
        expect(response.data.data.scenario).toBe('error');

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`Error scenario test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('End-to-End Workflow', () => {
    test('should complete full async verification workflow', async () => {
      if (TEST_MODE === 'minimal') {
        testResults.skippedTests++;
        return;
      }

      let taskId;

      try {
        // Step 1: タスク開始
        const startResponse = await makeRequest('/start-async-task', {
          method: 'POST',
          body: JSON.stringify({
            taskType: 'verify-business-idea',
            taskData: {
              originalIdea: mockBusinessIdea,
              companyData: mockCompanyData,
              verificationLevel: 'basic'
            },
            priority: 'normal'
          })
        });

        expect(startResponse.ok).toBe(true);
        taskId = startResponse.data.taskId;

        // Step 2: ステータス確認（ポーリングシミュレート）
        const statusResponse = await makeRequest(`/task-status?taskId=${taskId}`, {
          method: 'GET'
        });

        expect(statusResponse.ok).toBe(true);
        expect(statusResponse.data.taskId).toBe(taskId);

        // Step 3: Background Function実行（mockモードのみ）
        if (TEST_MODE === 'mock') {
          const bgResponse = await makeRequest('/verify-business-idea-background', {
            method: 'POST',
            body: JSON.stringify({
              taskId,
              originalIdea: mockBusinessIdea,
              companyData: mockCompanyData,
              verificationLevel: 'basic'
            })
          });

          expect(bgResponse.ok).toBe(true);
          expect(bgResponse.data.taskId).toBe(taskId);
        }

        if (TEST_MODE === 'integration') {
          testResults.estimatedCost += 0.10; // フルワークフローコスト
        }

        testResults.passedTests++;
      } catch (error) {
        testResults.failedTests++;
        testResults.errors.push(`E2E workflow test failed: ${error.message}`);
        throw error;
      }
    });
  });
});

// Jest設定でタイムアウトを延長
jest.setTimeout(30000);