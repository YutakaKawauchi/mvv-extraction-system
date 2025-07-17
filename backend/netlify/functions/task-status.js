const { getStore, connectLambda } = require('@netlify/blobs');
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
  // Netlify Blobs Lambda互換性のための初期化
  connectLambda(event);
  
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
    
    // ★ 新規実装: 1. Netlify Blobs から実際の結果を取得
    try {
      const taskStore = getStore('async-task-results');
      const taskResultRaw = await taskStore.get(taskId);
      let taskResult = null; // Move variable declaration to outer scope
      
      if (taskResultRaw) {
        // JSON文字列をパース
        try {
          taskResult = typeof taskResultRaw === 'string' ? JSON.parse(taskResultRaw) : taskResultRaw;
        } catch (parseError) {
          logger.error('Failed to parse task result JSON', {
            taskId,
            dataType: typeof taskResultRaw,
            dataLength: taskResultRaw ? taskResultRaw.length : 0,
            dataSample: taskResultRaw ? String(taskResultRaw).substring(0, 100) : null,
            parseError: parseError.message
          });
          throw parseError;
        }
        
        logger.info('Task result retrieved from Netlify Blobs', {
          taskId,
          status: taskResult.status,
          hasResult: !!taskResult.result,
          hasError: !!taskResult.error,
          dataType: typeof taskResultRaw,
          dataLength: taskResultRaw ? taskResultRaw.length : 0
        });
      } else {
        logger.warn('Task not found in Netlify Blobs', {
          taskId,
          blobsChecked: true
        });
      }
      
      if (taskResult) {
        // 完了済みタスクの場合、結果を返す
        return {
          id: taskId,
          type: 'verify-business-idea',
          status: taskResult.status,
          result: options.includeResult ? taskResult.result : undefined,
          error: taskResult.error ? {
            message: taskResult.error,
            code: 'BACKGROUND_FUNCTION_ERROR',
            retryable: false
          } : undefined,
          progress: taskResult.status === 'completed' ? {
            percentage: 100,
            currentStep: 'Verification completed'
          } : {
            percentage: 0,
            currentStep: 'Verification failed'
          },
          timestamps: {
            createdAt: taskResult.metadata?.createdAt || taskResult.timestamps?.receivedAt,
            startedAt: taskResult.metadata?.createdAt || taskResult.timestamps?.receivedAt,
            lastUpdatedAt: taskResult.timestamps?.completedAt || Date.now(),
            completedAt: taskResult.timestamps?.completedAt || taskResult.metadata?.completedAt
          },
          metadata: {
            ...taskResult.metadata,
            fromNetlifyBlobs: true,
            backgroundFunction: true,
            method: 'webhook-blobs'
          }
        };
      }
    } catch (blobError) {
      logger.warn('Failed to retrieve task from Netlify Blobs', {
        taskId,
        error: blobError.message
      });
      // Blobs取得に失敗した場合は、従来の方法にフォールバック
    }
    
    
    // 2. タスクIDの年齢を確認して処理中か判断
    const taskAge = getTaskAge(taskId);
    if (taskAge !== null) {
      // 30秒以内の新しいタスクは処理中と判断
      if (taskAge < 30000) {
        return {
          id: taskId,
          type: 'verify-business-idea',
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
            method: 'age-based-inference'
          }
        };
      }
      
      // 5分以上経過したタスクはタイムアウトと判断
      if (taskAge > 300000) {
        return {
          id: taskId,
          type: 'verify-business-idea',
          status: 'failed',
          progress: {
            percentage: 0,
            currentStep: 'Task timeout',
            estimatedTimeRemaining: 0
          },
          timestamps: {
            createdAt: Date.now() - taskAge,
            startedAt: Date.now() - taskAge,
            lastUpdatedAt: Date.now(),
            completedAt: Date.now() - 60000
          },
          error: {
            message: 'Background Function timeout',
            code: 'BACKGROUND_TIMEOUT',
            retryable: true,
            timestamp: Date.now()
          },
          metadata: {
            backgroundFunction: true,
            inferredTimeout: true,
            method: 'age-based-inference'
          }
        };
      }
    }
    
    // 3. 開発環境でのフォールバック処理（削除済み）
    // generateDevTaskStatus は削除済み - 年齢ベースの推定を使用
    
    // 4. タスクが見つからない場合
    logger.warn('Task not found anywhere', {
      taskId,
      taskAge: getTaskAge(taskId),
      searchedInBlobs: true,
      searchedInMocks: taskId.startsWith('mock_')
    });
    
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
 * ★ 削除済み: ログファイルからタスクステータスを確認
 * 
 * Webhook + Netlify Blobs 実装により、ログファイル検索は不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: Background Functionのステータス直接確認
 * 
 * Webhook + Netlify Blobs 実装により、推測ベースの状態確認は不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: ログエントリからタスクステータスを構築
 * 
 * Webhook + Netlify Blobs 実装により、ログベースの状態構築は不要
 * 実際のBackground Function結果を使用
 */

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
 * ★ 削除済み: TaskIDからタスクタイプを抽出
 * 
 * Webhook + Netlify Blobs 実装により、タスクタイプ推定は不要
 * 実際のBackground Function結果に含まれる
 */

/**
 * ★ 削除済み: 模擬タスクステータス生成（開発/テスト用）
 * 
 * Webhook + Netlify Blobs 実装により、モックデータは不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: タスクIDから作成時刻を抽出（模擬実装）
 * 
 * Webhook + Netlify Blobs 実装により、タイムスタンプ推定は不要
 * 実際のBackground Function結果に含まれる
 */

/**
 * ★ 削除済み: 進捗状況のシミュレート
 * 
 * Webhook + Netlify Blobs 実装により、模擬進捗は不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: 現在のステップを取得
 * 
 * Webhook + Netlify Blobs 実装により、模擬ステップは不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: 詳細ステップ生成
 * 
 * Webhook + Netlify Blobs 実装により、模擬ステップは不要
 * 実際のBackground Function結果を使用
 */

/**
 * ★ 削除済み: 模擬検証結果生成
 * 
 * Webhook + Netlify Blobs 実装により、モック結果は不要
 * 実際のBackground Function結果を使用
 */

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
 * ★ 削除済み: タスクIDバリデーション
 * 
 * Webhook + Netlify Blobs 実装により、タスクID検証は不要
 * Netlify Blobs でタスクIDが見つからない場合は自動的に null を返す
 */

/**
 * ★ 削除済み: 開発環境用タスクステータス生成
 * 
 * Webhook + Netlify Blobs 実装により、開発環境でも実際のBackground Function結果を使用
 * フォールバック処理として年齢ベースの推定を使用
 */