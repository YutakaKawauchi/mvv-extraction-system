const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * 長時間処理モックサービス (Phase ε.3.2)
 * 
 * 5-15分の長時間処理をシミュレートし、段階的なプログレス更新を提供
 * 実際のAPI呼び出しなしで非同期タスクシステムの完全なテストが可能
 * 
 * URL Pattern: /.netlify/functions/long-running-mock
 * Method: POST
 * 
 * Mock Scenarios:
 * - success: 正常完了（5-10分）
 * - timeout: タイムアウトシミュレート（15分+）
 * - error: エラーシミュレート（2-5分でエラー）
 * - intermittent: 断続的エラー（リトライ成功）
 */

// グローバルタスク状態管理（実際の環境では Redis や DB を使用）
const mockTaskState = new Map();

exports.handler = async (event, context) => {
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
    // 認証チェック（開発環境では緩和）
    if (process.env.NODE_ENV === 'production') {
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
    }

    // リクエスト解析
    const requestBody = JSON.parse(event.body || '{}');
    const { 
      taskId,
      scenario = 'success',
      duration = 300000, // デフォルト5分
      progressSteps = 10,
      taskType = 'mock-task'
    } = requestBody;

    // タスクID生成またはバリデーション
    const finalTaskId = taskId || generateMockTaskId();

    logger.info('Starting long-running mock task', {
      taskId: finalTaskId,
      scenario,
      duration,
      progressSteps,
      taskType
    });

    // シナリオ検証
    if (!isValidScenario(scenario)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Invalid scenario',
          scenario,
          validScenarios: getValidScenarios()
        })
      };
    }

    // モックタスク初期化
    const mockTask = initializeMockTask({
      taskId: finalTaskId,
      scenario,
      duration,
      progressSteps,
      taskType
    });

    // タスク状態保存
    mockTaskState.set(finalTaskId, mockTask);

    // バックグラウンド処理開始
    startMockBackgroundProcess(mockTask);

    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        taskId: finalTaskId,
        message: 'Long-running mock task initiated',
        data: {
          scenario,
          estimatedDuration: duration,
          progressSteps,
          pollingUrl: `/.netlify/functions/task-status?taskId=${finalTaskId}`,
          statusCheckInterval: 2000,
          mockTask: true
        },
        metadata: {
          initiatedAt: Date.now(),
          expectedCompletionTime: Date.now() + duration,
          mockScenario: scenario,
          realApiCost: '$0.00'
        }
      })
    };

  } catch (error) {
    logger.error('Long-running mock task error', {
      error: error.message,
      stack: error.stack,
      requestBody: event.body
    });

    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to start mock task',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

/**
 * モックタスク初期化
 */
function initializeMockTask(options) {
  const { taskId, scenario, duration, progressSteps, taskType } = options;
  
  return {
    id: taskId,
    type: taskType,
    scenario,
    status: 'processing',
    progress: {
      percentage: 0,
      currentStep: 'Starting mock task...',
      estimatedTimeRemaining: duration,
      detailedSteps: []
    },
    timestamps: {
      createdAt: Date.now(),
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      completedAt: null
    },
    config: {
      totalDuration: duration,
      progressSteps,
      scenario
    },
    result: null,
    error: null,
    metadata: {
      mock: true,
      realApiCalls: 0,
      estimatedCost: 0.00
    }
  };
}

/**
 * モックバックグラウンド処理開始
 */
function startMockBackgroundProcess(task) {
  const { id, config } = task;
  const { totalDuration, progressSteps, scenario } = config;
  
  const stepInterval = totalDuration / progressSteps;
  let currentStep = 0;

  const updateProgress = () => {
    const mockTask = mockTaskState.get(id);
    if (!mockTask || mockTask.status === 'completed' || mockTask.status === 'failed') {
      return; // タスクが完了またはキャンセル済み
    }

    currentStep++;
    const percentage = Math.min((currentStep / progressSteps) * 100, 100);
    
    // シナリオ別の処理
    const result = processScenario(scenario, currentStep, progressSteps, mockTask);
    
    if (result.shouldStop) {
      // エラーまたは完了
      mockTask.status = result.status;
      mockTask.error = result.error;
      mockTask.result = result.result;
      mockTask.timestamps.completedAt = Date.now();
      
      logger.info('Mock task completed', {
        taskId: id,
        scenario,
        status: result.status,
        duration: Date.now() - mockTask.timestamps.startedAt
      });
      
      return;
    }

    // プログレス更新
    mockTask.progress = {
      percentage: Math.round(percentage),
      currentStep: result.currentStep,
      estimatedTimeRemaining: Math.max(0, totalDuration - (stepInterval * currentStep)),
      detailedSteps: [
        ...mockTask.progress.detailedSteps,
        {
          stepName: result.stepName,
          status: 'completed',
          duration: stepInterval,
          timestamp: Date.now()
        }
      ]
    };
    
    mockTask.timestamps.lastUpdatedAt = Date.now();
    mockTaskState.set(id, mockTask);

    // 次のステップをスケジュール
    if (currentStep < progressSteps) {
      setTimeout(updateProgress, stepInterval);
    } else {
      // 完了処理
      finalizeMockTask(mockTask, scenario);
    }
  };

  // 初回更新をスケジュール
  setTimeout(updateProgress, stepInterval);
}

/**
 * シナリオ別処理
 */
function processScenario(scenario, currentStep, totalSteps, task) {
  switch (scenario) {
    case 'success':
      return processSuccessScenario(currentStep, totalSteps);
    
    case 'timeout':
      return processTimeoutScenario(currentStep, totalSteps);
    
    case 'error':
      return processErrorScenario(currentStep, totalSteps);
    
    case 'intermittent':
      return processIntermittentScenario(currentStep, totalSteps, task);
    
    case 'slow':
      return processSlowScenario(currentStep, totalSteps);
    
    default:
      return processSuccessScenario(currentStep, totalSteps);
  }
}

/**
 * 成功シナリオ処理
 */
function processSuccessScenario(currentStep, totalSteps) {
  const steps = [
    'Initializing task environment',
    'Loading company data',
    'Analyzing business context',
    'Generating industry insights',
    'Performing competitive analysis',
    'Validating business model',
    'Generating recommendations',
    'Compiling final results',
    'Quality assurance check',
    'Finalizing output'
  ];
  
  const stepIndex = Math.min(currentStep - 1, steps.length - 1);
  
  return {
    shouldStop: false,
    currentStep: steps[stepIndex] || `Processing step ${currentStep}`,
    stepName: steps[stepIndex] || `Step ${currentStep}`
  };
}

/**
 * タイムアウトシナリオ処理
 */
function processTimeoutScenario(currentStep, totalSteps) {
  // 80%進捗でタイムアウトシミュレート
  if (currentStep > totalSteps * 0.8) {
    return {
      shouldStop: true,
      status: 'failed',
      error: {
        message: 'Task timeout - exceeded maximum execution time',
        code: 'MOCK_TIMEOUT',
        retryable: true
      }
    };
  }
  
  return processSuccessScenario(currentStep, totalSteps);
}

/**
 * エラーシナリオ処理
 */
function processErrorScenario(currentStep, totalSteps) {
  // 50%進捗でエラーシミュレート
  if (currentStep > totalSteps * 0.5) {
    return {
      shouldStop: true,
      status: 'failed',
      error: {
        message: 'Mock API error - simulated service failure',
        code: 'MOCK_API_ERROR',
        retryable: false
      }
    };
  }
  
  return processSuccessScenario(currentStep, totalSteps);
}

/**
 * 断続的エラーシナリオ処理
 */
function processIntermittentScenario(currentStep, totalSteps, task) {
  // 30%と70%でエラー、その後回復
  if (currentStep === Math.floor(totalSteps * 0.3) || currentStep === Math.floor(totalSteps * 0.7)) {
    return {
      shouldStop: false,
      currentStep: 'Recovering from temporary error...',
      stepName: 'Error Recovery'
    };
  }
  
  return processSuccessScenario(currentStep, totalSteps);
}

/**
 * スロータスクシナリオ処理
 */
function processSlowScenario(currentStep, totalSteps) {
  return {
    shouldStop: false,
    currentStep: `Slow processing step ${currentStep} (simulating heavy computation)`,
    stepName: `Heavy Processing ${currentStep}`
  };
}

/**
 * モックタスク完了処理
 */
function finalizeMockTask(task, scenario) {
  task.status = 'completed';
  task.timestamps.completedAt = Date.now();
  
  // シナリオ別結果生成
  task.result = generateMockResult(scenario, task);
  
  mockTaskState.set(task.id, task);
  
  logger.info('Mock task finalized', {
    taskId: task.id,
    scenario,
    duration: task.timestamps.completedAt - task.timestamps.startedAt,
    finalStatus: task.status
  });
}

/**
 * モック結果生成
 */
function generateMockResult(scenario, task) {
  const baseResult = {
    taskId: task.id,
    scenario,
    processingTime: task.timestamps.completedAt - task.timestamps.startedAt,
    mockGenerated: true,
    realApiCost: 0.00
  };

  switch (scenario) {
    case 'success':
    case 'intermittent':
    case 'slow':
      return {
        ...baseResult,
        success: true,
        data: {
          overallAssessment: {
            overallScore: {
              viabilityScore: 85,
              innovationScore: 92,
              marketPotentialScore: 78,
              totalScore: 85
            },
            recommendation: {
              decision: 'GO',
              reasoning: 'Mock analysis shows strong potential across all metrics'
            }
          },
          industryAnalysis: {
            marketSize: 'Large and growing',
            competitiveIntensity: 'Moderate',
            trends: ['Digital transformation', 'Sustainability focus', 'Remote work adoption']
          },
          businessValidation: {
            revenueModel: 'Validated and scalable',
            costStructure: 'Efficient and optimized',
            riskAssessment: 'Low to moderate risk'
          },
          metadata: {
            confidence: 0.95,
            mockScenario: scenario,
            processingSteps: task.progress.detailedSteps.length
          }
        }
      };
      
    default:
      return baseResult;
  }
}

/**
 * タスク状態取得（task-status.jsからの呼び出し用）
 */
function getMockTaskStatus(taskId) {
  return mockTaskState.get(taskId) || null;
}

/**
 * 有効なシナリオ確認
 */
function isValidScenario(scenario) {
  return getValidScenarios().includes(scenario);
}

/**
 * 有効なシナリオ一覧
 */
function getValidScenarios() {
  return ['success', 'timeout', 'error', 'intermittent', 'slow'];
}

/**
 * モックタスクID生成
 */
function generateMockTaskId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `mock_${timestamp}_task_${random}`;
}

/**
 * モックタスク状態クリーンアップ（メモリ管理）
 */
function cleanupOldMockTasks() {
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24時間前
  
  for (const [taskId, task] of mockTaskState) {
    if (task.timestamps.createdAt < cutoffTime) {
      mockTaskState.delete(taskId);
      logger.info('Cleaned up old mock task', { taskId });
    }
  }
}

// 定期的なクリーンアップ（1時間間隔）
setInterval(cleanupOldMockTasks, 60 * 60 * 1000);

// エクスポート（他のファイルからの利用用）
module.exports = {
  handler: exports.handler,
  getMockTaskStatus,
  generateMockTaskId,
  getValidScenarios
};