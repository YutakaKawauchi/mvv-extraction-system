const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');
const { getMockTaskStatus } = require('./long-running-mock');

/**
 * タスクステータス取得API (Phase ε.1.3)
 * 
 * 非同期タスクの進捗状況と結果を取得するポーリングエンドポイント
 * フロントエンドのuseSmartPollingが定期的にこのAPIを呼び出す
 * 
 * URL Pattern: /.netlify/functions/task-status
 * Method: GET
 * Query Params: 
 *   - taskId: 必須、タスクID
 *   - includeResult: オプション、結果データを含めるか (true/false)
 *   - includeProgress: オプション、詳細進捗を含めるか (true/false)
 */

exports.handler = async (event, context) => {
  // Handle CORS preflight
  const corsResponse = handleCors(event);
  if (corsResponse) {
    return corsResponse;
  }

  // Get CORS headers for all responses
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  if (event.httpMethod !== 'GET') {
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

    // クエリパラメータの解析
    const queryParams = event.queryStringParameters || {};
    const {
      taskId,
      includeResult = 'true',
      includeProgress = 'true'
    } = queryParams;

    // 入力検証
    if (!taskId) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId query parameter is required',
          example: '/.netlify/functions/task-status?taskId=async_12345'
        })
      };
    }

    logger.info('Task status request', { 
      taskId,
      includeResult: includeResult === 'true',
      includeProgress: includeProgress === 'true',
      user: authResult.user?.username
    });

    // タスクステータスの取得
    const taskStatus = await getTaskStatus(
      taskId,
      {
        includeResult: includeResult === 'true',
        includeProgress: includeProgress === 'true'
      }
    );

    if (!taskStatus) {
      return {
        statusCode: 404,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Task not found',
          taskId,
          message: 'The specified task ID does not exist or has expired'
        })
      };
    }

    logger.info('Task status retrieved', { 
      taskId,
      status: taskStatus.status,
      progress: taskStatus.progress?.percentage,
      hasResult: !!taskStatus.result
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
        data: taskStatus,
        metadata: {
          polledAt: Date.now(),
          continuePoll: shouldContinuePolling(taskStatus.status)
        }
      })
    };

  } catch (error) {
    logger.error('Task status retrieval error', {
      taskId: event.queryStringParameters?.taskId,
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to retrieve task status',
        message: error.message,
        taskId: event.queryStringParameters?.taskId || 'unknown'
      })
    };
  }
};

/**
 * タスクステータスの取得
 * 
 * Phase ε.1.4: IndexedDB統合により、クライアントサイドとサーバーサイドの
 * タスク状態管理を統合します。
 * 
 * 現在の実装: 
 * 1. ログファイルからBackgroundFunction実行状況を確認
 * 2. フォールバックとしてモックデータを生成
 * 3. 本番環境では、共有ストレージ（Redis/DynamoDB）への移行が推奨
 */
async function getTaskStatus(taskId, options = {}) {
  try {
    // 0. モックタスクの状態確認（long-running-mock.jsからの取得）
    if (taskId.startsWith('mock_')) {
      const mockStatus = getMockTaskStatus(taskId);
      if (mockStatus) {
        return formatMockTaskStatus(mockStatus, options);
      }
    }
    
    // 0.5. 開発環境の非同期タスクシミュレーション（本番環境では実行しない）
    if (taskId.startsWith('async_') && process.env.NODE_ENV !== 'production') {
      const devStatus = generateDevTaskStatus(taskId, options);
      if (devStatus) {
        return devStatus;
      }
    }
    
    // 1. ログファイルからタスクの実行状況を確認
    const logBasedStatus = await checkTaskStatusFromLogs(taskId);
    if (logBasedStatus) {
      return logBasedStatus;
    }
    
    // 2. Background Functionの直接ステータス確認（開発中の実装）
    const backgroundStatus = await checkBackgroundFunctionStatus(taskId);
    if (backgroundStatus) {
      return backgroundStatus;
    }
    
    // 3. フォールバック: 模擬状態データ生成（開発/テスト用、本番環境では無効）
    if (process.env.NODE_ENV !== 'production') {
      const mockTaskStatus = generateMockTaskStatus(taskId, options);
      if (mockTaskStatus) {
        return mockTaskStatus;
      }
    }
    
    // 4. タスクが見つからない場合
    return null;
    
  } catch (error) {
    logger.error('Failed to retrieve task status from storage', {
      taskId,
      error: error.message
    });
    throw error;
  }
}

/**
 * ログファイルからタスクステータスを確認
 */
async function checkTaskStatusFromLogs(taskId) {
  try {
    // ログファイルのパターンで最新のログから該当タスクを検索
    const fs = require('fs').promises;
    const path = require('path');
    
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(process.cwd(), 'logs', `app-${today}.log`);
    
    try {
      const logContent = await fs.readFile(logPath, 'utf8');
      const logLines = logContent.split('\n').reverse(); // 最新のログから確認
      
      let latestTaskLog = null;
      for (const line of logLines) {
        if (line.includes(taskId)) {
          try {
            const logEntry = JSON.parse(line);
            if (logEntry.taskId === taskId) {
              latestTaskLog = logEntry;
              break;
            }
          } catch (e) {
            // JSON解析失敗は無視してテキスト検索を継続
            continue;
          }
        }
      }
      
      if (latestTaskLog) {
        return constructTaskStatusFromLog(latestTaskLog, taskId);
      }
    } catch (error) {
      // ログファイルが存在しない場合は正常（新しいタスクの可能性）
      logger.info('Log file not found or readable', { 
        taskId, 
        logPath,
        error: error.message 
      });
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to check task status from logs', { taskId, error: error.message });
    return null;
  }
}

/**
 * Background Functionのステータス直接確認
 */
async function checkBackgroundFunctionStatus(taskId) {
  try {
    // Background Functionが実行中かどうかを確認する方法
    // Netlify Functionsでは、実行中のfunctionを直接確認する方法は限られているため、
    // ここでは間接的な方法で確認します
    
    // 1. TaskIDの形式確認とタイムスタンプ抽出
    const taskAge = getTaskAge(taskId);
    if (taskAge === null) {
      return null; // 不正なタスクID
    }
    
    // 2. タスクが新しすぎる場合（30秒以内）はprocessing状態と仮定
    if (taskAge < 30000) {
      return {
        id: taskId,
        type: extractTaskTypeFromId(taskId) || 'verify-business-idea',
        status: 'processing',
        progress: {
          percentage: 10,
          currentStep: 'Background Function processing...',
          estimatedTimeRemaining: 90000
        },
        timestamps: {
          createdAt: Date.now() - taskAge,
          startedAt: Date.now() - taskAge,
          lastUpdatedAt: Date.now(),
          completedAt: null
        },
        metadata: {
          backgroundFunction: true,
          realTimeStatus: true,
          method: 'background-inference'
        }
      };
    }
    
    // 3. タスクが古い場合（5分以上）はfailed状態と仮定
    if (taskAge > 300000) {
      return {
        id: taskId,
        type: extractTaskTypeFromId(taskId) || 'verify-business-idea',
        status: 'failed',
        progress: {
          percentage: 0,
          currentStep: 'Task timeout or failed',
          estimatedTimeRemaining: 0
        },
        timestamps: {
          createdAt: Date.now() - taskAge,
          startedAt: Date.now() - taskAge,
          lastUpdatedAt: Date.now(),
          completedAt: Date.now() - 60000
        },
        error: {
          message: 'Background Function timeout or failed',
          code: 'BACKGROUND_TIMEOUT',
          retryable: true,
          timestamp: Date.now()
        },
        metadata: {
          backgroundFunction: true,
          inferredTimeout: true,
          method: 'background-inference'
        }
      };
    }
    
    return null; // 中間状態は他の方法で確認
  } catch (error) {
    logger.error('Failed to check background function status', { taskId, error: error.message });
    return null;
  }
}

/**
 * ログエントリからタスクステータスを構築
 */
function constructTaskStatusFromLog(logEntry, taskId) {
  try {
    // ログの内容に基づいてタスクステータスを推定
    const currentTime = Date.now();
    const logTime = new Date(logEntry.timestamp).getTime();
    
    let status = 'processing';
    let progress = { percentage: 50, currentStep: 'Processing...' };
    
    // ログメッセージの解析
    if (logEntry.message) {
      if (logEntry.message.includes('completed') || logEntry.message.includes('finished')) {
        status = 'completed';
        progress = { percentage: 100, currentStep: 'Completed' };
      } else if (logEntry.message.includes('error') || logEntry.message.includes('failed')) {
        status = 'failed';
        progress = { percentage: 0, currentStep: 'Failed' };
      } else if (logEntry.message.includes('started') || logEntry.message.includes('beginning')) {
        status = 'processing';
        progress = { percentage: 10, currentStep: 'Started processing' };
      }
    }
    
    return {
      id: taskId,
      type: logEntry.taskType || extractTaskTypeFromId(taskId) || 'verify-business-idea',
      status,
      progress,
      timestamps: {
        createdAt: logTime,
        startedAt: logTime,
        lastUpdatedAt: currentTime,
        completedAt: status === 'completed' ? logTime : null
      },
      metadata: {
        fromLog: true,
        logLevel: logEntry.level,
        backgroundFunction: true,
        method: 'log-based'
      },
      ...(status === 'failed' && logEntry.error ? {
        error: {
          message: logEntry.error.message || logEntry.message,
          code: logEntry.error.code || 'LOG_BASED_ERROR',
          retryable: true,
          timestamp: logTime
        }
      } : {})
    };
  } catch (error) {
    logger.error('Failed to construct task status from log', { taskId, error: error.message });
    return null;
  }
}

/**
 * TaskIDからタスクの経過時間を取得
 */
function getTaskAge(taskId) {
  try {
    const parts = taskId.split('_');
    if (parts.length >= 2 && !isNaN(parts[1])) {
      const taskTimestamp = parseInt(parts[1]);
      return Date.now() - taskTimestamp;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * TaskIDからタスクタイプを抽出
 */
function extractTaskTypeFromId(taskId) {
  try {
    const parts = taskId.split('_');
    if (parts.length >= 3) {
      const typePrefix = parts[2];
      switch (typePrefix) {
        case 'verify':
          return 'verify-business-idea';
        case 'generate':
          return 'generate-business-ideas';
        case 'extract':
          return 'extract-mvv';
        default:
          return null;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 模擬タスクステータス生成（開発/テスト用）
 * 
 * Phase ε.1.4で実際のIndexedDBとの統合時に削除予定
 */
function generateMockTaskStatus(taskId, options) {
  // タスクIDの形式確認
  if (!taskId.startsWith('async_')) {
    return null;
  }
  
  // タスクIDから時間を推定（開発用の簡易実装）
  const taskCreationTime = extractTimestampFromTaskId(taskId);
  const currentTime = Date.now();
  const elapsedTime = currentTime - taskCreationTime;
  
  // 進捗状況をシミュレート
  const progressSimulation = simulateProgress(elapsedTime, taskId);
  
  const baseStatus = {
    id: taskId,
    type: 'verify-business-idea',
    status: progressSimulation.status,
    progress: progressSimulation.progress,
    timestamps: {
      createdAt: taskCreationTime,
      startedAt: taskCreationTime,
      lastUpdatedAt: currentTime,
      completedAt: progressSimulation.status === 'completed' ? currentTime : null
    },
    metadata: {
      userId: 'dev-user',
      companyId: 'mock-company',
      ideaId: 'mock-idea',
      backgroundFunction: true,
      estimatedDuration: 120000, // 2分
      mock: true
    }
  };

  // 結果データの含有
  if (options.includeResult && progressSimulation.status === 'completed') {
    baseStatus.result = generateMockVerificationResult();
  }

  // エラー状態のシミュレート
  if (progressSimulation.status === 'failed') {
    baseStatus.error = {
      message: 'Mock verification error for testing',
      code: 'MOCK_ERROR',
      retryable: true,
      timestamp: currentTime
    };
  }

  return baseStatus;
}

/**
 * タスクIDから作成時刻を抽出（模擬実装）
 */
function extractTimestampFromTaskId(taskId) {
  // async_<timestamp>_<random> 形式を想定
  const parts = taskId.split('_');
  if (parts.length >= 2 && !isNaN(parts[1])) {
    return parseInt(parts[1]);
  }
  
  // フォールバック: 現在時刻から30秒前
  return Date.now() - 30000;
}

/**
 * 進捗状況のシミュレート
 */
function simulateProgress(elapsedTime, taskId) {
  const totalDuration = 120000; // 2分で完了想定
  const progressPercentage = Math.min(100, Math.floor((elapsedTime / totalDuration) * 100));
  
  // 異なるタスクIDで異なる進行パターンをシミュレート
  const idHash = taskId.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
  const shouldFail = (idHash % 10) === 0; // 10%の確率で失敗
  
  if (shouldFail && elapsedTime > 60000) { // 1分後に失敗
    return {
      status: 'failed',
      progress: {
        percentage: Math.max(30, progressPercentage - 20),
        currentStep: 'Error occurred during verification',
        estimatedTimeRemaining: 0,
        detailedSteps: [
          { stepName: 'Industry analysis', status: 'completed', duration: 20000 },
          { stepName: 'Business model validation', status: 'failed', duration: 15000 }
        ]
      }
    };
  }
  
  if (progressPercentage >= 100) {
    return {
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
      }
    };
  }
  
  // 進行中の状態
  const currentStep = getCurrentStep(progressPercentage);
  return {
    status: 'processing',
    progress: {
      percentage: progressPercentage,
      currentStep: currentStep.name,
      estimatedTimeRemaining: Math.max(0, totalDuration - elapsedTime),
      detailedSteps: generateDetailedSteps(progressPercentage)
    }
  };
}

/**
 * 現在のステップを取得
 */
function getCurrentStep(progressPercentage) {
  const steps = [
    { range: [0, 15], name: '業界分析実行中' },
    { range: [15, 40], name: '業界エキスパート分析' },
    { range: [40, 70], name: 'ビジネスモデル・競合分析' },
    { range: [70, 85], name: '改善提案生成中' },
    { range: [85, 100], name: '総合評価生成中' }
  ];
  
  for (const step of steps) {
    if (progressPercentage >= step.range[0] && progressPercentage < step.range[1]) {
      return step;
    }
  }
  
  return { name: '検証完了' };
}

/**
 * 詳細ステップ生成
 */
function generateDetailedSteps(progressPercentage) {
  const steps = [];
  
  if (progressPercentage > 15) {
    steps.push({ stepName: 'Industry analysis', status: 'completed', duration: 20000 });
  } else if (progressPercentage > 0) {
    steps.push({ stepName: 'Industry analysis', status: 'processing', startTime: Date.now() - 10000 });
  }
  
  if (progressPercentage > 40) {
    steps.push({ stepName: 'Business model validation', status: 'completed', duration: 25000 });
  } else if (progressPercentage > 15) {
    steps.push({ stepName: 'Business model validation', status: 'processing', startTime: Date.now() - 5000 });
  }
  
  if (progressPercentage > 70) {
    steps.push({ stepName: 'Competitive analysis', status: 'completed', duration: 30000 });
  } else if (progressPercentage > 40) {
    steps.push({ stepName: 'Competitive analysis', status: 'processing', startTime: Date.now() - 3000 });
  }
  
  if (progressPercentage > 85) {
    steps.push({ stepName: 'Improvement suggestions', status: 'completed', duration: 15000 });
  } else if (progressPercentage > 70) {
    steps.push({ stepName: 'Improvement suggestions', status: 'processing', startTime: Date.now() - 2000 });
  }
  
  if (progressPercentage > 85) {
    steps.push({ stepName: 'Overall assessment', status: 'processing', startTime: Date.now() - 1000 });
  }
  
  return steps;
}

/**
 * 模擬検証結果生成
 */
function generateMockVerificationResult() {
  return {
    industryAnalysis: {
      industryTrends: {
        currentState: "Mock industry analysis for testing purposes",
        emergingTrends: ["AI integration", "Sustainability focus"],
        regulatoryEnvironment: "Evolving regulatory landscape",
        marketSize: "Estimated $10B market"
      },
      problemValidation: {
        realityCheck: "Problem is well-documented in industry reports",
        stakeholderImpact: "High impact on operational efficiency",
        urgencyLevel: 8,
        evidence: "Multiple case studies and market research"
      }
    },
    businessModelValidation: {
      revenueModelValidation: {
        viability: 7,
        payerAnalysis: "Enterprise customers with budget allocation",
        pricingSustainability: "Competitive pricing with value-based model",
        revenueProjection: "Year 1: $500K, Year 3: $5M, Year 5: $20M"
      }
    },
    competitiveAnalysis: {
      directCompetitors: [
        {
          name: "Competitor A",
          description: "Market leader with established presence",
          marketPosition: "Dominant",
          strengths: ["Brand recognition", "Large customer base"],
          weaknesses: ["Legacy technology", "High pricing"]
        }
      ]
    },
    improvementSuggestions: {
      criticalIssues: [
        {
          issue: "Market differentiation needed",
          impact: 8,
          urgency: 7
        }
      ],
      improvementRecommendations: [
        {
          area: "Value proposition",
          currentState: "Generic positioning",
          recommendedChange: "Focus on specific vertical",
          expectedImpact: "25% better conversion rate",
          implementationDifficulty: 6,
          timeline: "3-6 months"
        }
      ]
    },
    overallAssessment: {
      overallScore: {
        viabilityScore: 75,
        innovationScore: 65,
        marketPotentialScore: 80,
        riskScore: 40,
        totalScore: 70
      },
      recommendation: {
        decision: "CONDITIONAL-GO",
        reasoning: "Strong market potential with moderate risks",
        conditions: ["Secure initial funding", "Build MVP"],
        nextSteps: ["Market validation", "Team building"]
      }
    },
    metadata: {
      verificationLevel: 'comprehensive',
      totalTokens: 15000,
      totalCost: 0.05,
      model: 'gpt-4o-mini + sonar-pro',
      confidence: 0.85,
      version: 'mock-beta',
      backgroundFunction: true,
      mock: true
    }
  };
}

/**
 * モックタスクステータスフォーマット
 */
function formatMockTaskStatus(mockTask, options = {}) {
  const { includeResult = true, includeProgress = true } = options;
  
  const formattedStatus = {
    success: true,
    taskId: mockTask.id,
    data: {
      id: mockTask.id,
      type: mockTask.type,
      status: mockTask.status,
      timestamps: mockTask.timestamps
    },
    metadata: {
      polledAt: Date.now(),
      continuePoll: shouldContinuePolling(mockTask.status),
      mock: true,
      scenario: mockTask.scenario,
      longRunningTest: true
    }
  };

  // プログレス情報を含める
  if (includeProgress && mockTask.progress) {
    formattedStatus.data.progress = mockTask.progress;
  }

  // 結果データを含める
  if (includeResult && mockTask.result) {
    formattedStatus.data.result = mockTask.result;
  }

  // エラー情報を含める
  if (mockTask.error) {
    formattedStatus.data.error = mockTask.error;
  }

  return formattedStatus;
}

/**
 * ポーリング継続判定
 */
function shouldContinuePolling(status) {
  return status === 'queued' || status === 'processing';
}

/**
 * タスクIDバリデーション
 */
function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    return false;
  }
  
  // async_<timestamp>_<random> 形式
  const pattern = /^async_\d+_[a-zA-Z0-9]+$/;
  return pattern.test(taskId);
}

/**
 * 開発環境用タスクステータス生成
 */
function generateDevTaskStatus(taskId, options = {}) {
  const taskCreationTime = extractTimestampFromTaskId(taskId);
  const currentTime = Date.now();
  const elapsedTime = currentTime - taskCreationTime;
  
  // 2分間のシミュレーション
  const totalDuration = 120000;
  const progressPercentage = Math.min(100, Math.floor((elapsedTime / totalDuration) * 100));
  
  let status = 'processing';
  let currentStep = 'Processing...';
  
  if (progressPercentage >= 100) {
    status = 'completed';
    currentStep = 'Verification completed';
  } else if (progressPercentage >= 85) {
    currentStep = '総合評価生成中';
  } else if (progressPercentage >= 70) {
    currentStep = '改善提案生成中';
  } else if (progressPercentage >= 40) {
    currentStep = 'ビジネスモデル・競合分析';
  } else if (progressPercentage >= 15) {
    currentStep = '業界エキスパート分析';
  } else {
    currentStep = '業界分析実行中';
  }
  
  const baseStatus = {
    id: taskId,
    type: 'verify-business-idea',
    status,
    progress: {
      percentage: progressPercentage,
      currentStep,
      estimatedTimeRemaining: Math.max(0, totalDuration - elapsedTime)
    },
    timestamps: {
      createdAt: taskCreationTime,
      startedAt: taskCreationTime,
      lastUpdatedAt: currentTime,
      completedAt: status === 'completed' ? currentTime : null
    },
    metadata: {
      development: true,
      backgroundFunction: true
    }
  };
  
  // 完了時に結果を追加
  if (status === 'completed' && options.includeResult) {
    baseStatus.result = generateMockVerificationResult();
  }
  
  return baseStatus;
}